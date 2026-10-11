import type { Collection } from "../lib/data/collections.schema";
import { getPlaceById } from "../lib/data/lookup";
import type { Place } from "../lib/data/places.schema";
import { angularDelta, bearingToCompassLabel } from "../lib/geo/angle";
import {
    greatCirclePoints,
    rhumbBearing,
    rhumbLinePoints,
} from "../lib/geo/route";
import { localizedDirectionName } from "../lib/i18n/directions";
import { type Locale, t } from "../lib/i18n/t";
import {
    appendCompassAnswer,
    FLAT_MAP_GAP_THRESHOLD_DEG,
} from "../lib/insights/mentalMap";
import { scoreCompassRound } from "../lib/modes/compass/score";
import { COMPASS_TIERS } from "../lib/modes/compass/tiers";
import type {
    CompassChallenge,
    CompassRound,
} from "../lib/modes/compass/types";
import { loadState, saveState } from "../lib/persistence/repository";
import { createCompassDialController } from "./compassDial";
import { createCompassMapController } from "./compassMap";
import { createRouteMap } from "./maps/routeMap";
import { byId, byRole, creditKeyFor, creditLevel } from "./shared/dom";

export interface CompassPlayOptions {
    locale: Locale;
    collection: Collection;
    challenge: CompassChallenge;
    /** Round to start on (a resumed daily session may start mid-challenge). */
    startRoundIndex: number;
    /** Persists an answer; called before any feedback is shown. */
    onAnswer: (
        roundIndex: number,
        chosenAngleDeg: number,
        credit: number,
        isLastRound: boolean,
    ) => void;
    /** Called when the player continues past the last round. */
    onFinish: () => void;
}

/** Colour for the player's arrow, from red (no credit) to green (full credit). */
export function creditHue(credit: number): string {
    return `hsl(${Math.round(12 + Math.min(credit, 1) * 128)} 78% 43%)`;
}

function directionName(locale: Locale, bearingDeg: number): string {
    return localizedDirectionName(locale, bearingToCompassLabel(bearingDeg));
}

/** Logs the answer for the Statistics "mental map" profile (ADR-0010). */
function recordInsight(
    round: CompassRound,
    chosenDeg: number,
    flatBearingDeg: number,
): void {
    const state = loadState(localStorage);
    saveState(
        {
            ...state,
            insights: {
                compassAnswers: appendCompassAnswer(
                    state.insights.compassAnswers,
                    {
                        originId: round.originId,
                        destinationId: round.destinationId,
                        chosenDeg,
                        trueBearingDeg: round.bearingDeg,
                        flatBearingDeg,
                        distanceKm: round.distanceKm,
                        answeredAt: new Date().toISOString(),
                    },
                ),
            },
        },
        localStorage,
    );
}

/**
 * Builds the feedback copy. Besides the score, every round where the
 * flat-map direction and the true great-circle direction disagree explains
 * *why* (ADR-0010): that gap is the lesson Compass is built around.
 */
function feedbackParagraphs(
    locale: Locale,
    origin: Place,
    destination: Place,
    round: CompassRound,
    chosenDeg: number,
    flatBearingDeg: number,
): string[] {
    const trueDirection = directionName(locale, round.bearingDeg);
    const paragraphs = [
        [
            t(locale, "compass.trueBearing", {
                direction: trueDirection,
                degrees: Math.round(round.bearingDeg),
            }),
            t(locale, "compass.angleDifference", {
                degrees: Math.round(angularDelta(chosenDeg, round.bearingDeg)),
            }),
            t(locale, "compass.distanceNote", {
                destination: destination.names[locale],
                distance: Math.round(round.distanceKm).toLocaleString(
                    locale === "es" ? "es-ES" : "en-US",
                ),
            }),
        ].join(" "),
    ];

    if (
        angularDelta(flatBearingDeg, round.bearingDeg) >=
        FLAT_MAP_GAP_THRESHOLD_DEG
    ) {
        const path = greatCirclePoints(origin.point, destination.point, 32);
        const midpoint = path[16];
        const straightMidLat = (origin.point.lat + destination.point.lat) / 2;
        const bendsNorth = (midpoint?.lat ?? straightMidLat) > straightMidLat;
        const params = {
            destination: destination.names[locale],
            flatDirection: directionName(
                locale,
                flatBearingDeg,
            ).toLocaleLowerCase(locale),
            flatDegrees: Math.round(flatBearingDeg),
            side: t(
                locale,
                bendsNorth
                    ? "compass.flatMapSideNorth"
                    : "compass.flatMapSideSouth",
            ),
            origin: origin.names[locale],
            direction: trueDirection.toLocaleLowerCase(locale),
            degrees: Math.round(round.bearingDeg),
        };
        // When both readings share an 8-point name ("northeast" vs
        // "northeast"), name the gap in degrees instead.
        const sameName =
            bearingToCompassLabel(flatBearingDeg) ===
            bearingToCompassLabel(round.bearingDeg);
        const note = [
            t(
                locale,
                sameName
                    ? "compass.flatMapNoteSameDirection"
                    : "compass.flatMapNote",
                params,
            ),
        ];
        if (
            angularDelta(chosenDeg, flatBearingDeg) <
            angularDelta(chosenDeg, round.bearingDeg)
        ) {
            note.push(t(locale, "compass.followedFlatMap"));
        }
        paragraphs.push(note.join(" "));
    }
    return paragraphs;
}

/**
 * The Compass round loop shared by Daily and Practice: renders each round,
 * scores the dial answer, and reveals the true route. Callers own only
 * persistence and navigation, via `onAnswer` / `onFinish`.
 */
export function mountCompassPlay(options: CompassPlayOptions): void {
    const { locale, collection, challenge, onAnswer, onFinish } = options;
    const tierConfig = COMPASS_TIERS[challenge.tier];
    let roundIndex = options.startRoundIndex;

    const roundCounterEl = byId("round-counter");
    const promptEl = byId("compass-prompt");
    const originChipEl = byId("origin-chip");
    const destinationChipEl = byId("destination-chip");
    const dialRoot = byId("compass-dial");
    const originLabelEl = byRole(dialRoot, "origin-label");
    const destinationLabelEl = byRole(dialRoot, "flight-destination");
    const submitButton = byId("submit-answer");
    const continueButton = byId("continue-round");
    const feedbackPanel = byId("feedback-panel");
    const feedbackHeading = byRole(feedbackPanel, "feedback-heading");
    const feedbackBody = byRole(feedbackPanel, "feedback-body");
    const routeMap = createRouteMap(byId("route-map"));

    const dial = createCompassDialController(dialRoot, (deg) => {
        return `${Math.round(deg)}° · ${directionName(locale, deg)}`;
    });
    const contextMap = createCompassMapController(dialRoot);

    function currentRound(): CompassRound | undefined {
        return challenge.rounds[roundIndex];
    }

    function renderRound(): void {
        const round = currentRound();
        if (!round) {
            return;
        }
        const origin = getPlaceById(collection, round.originId);
        const destination = getPlaceById(collection, round.destinationId);

        roundCounterEl.textContent = t(locale, "compass.roundOf", {
            current: roundIndex + 1,
            total: challenge.rounds.length,
        });
        promptEl.textContent = t(locale, "compass.prompt", {
            origin: origin.names[locale],
            destination: destination.names[locale],
        });
        originChipEl.textContent = origin.names[locale];
        destinationChipEl.textContent = destination.names[locale];
        contextMap.render(origin);
        originLabelEl.textContent = origin.names[locale];
        destinationLabelEl.textContent = destination.names[locale];

        feedbackPanel.classList.add("hidden");
        routeMap.hide();
        continueButton.classList.add("hidden");
        submitButton.classList.remove("hidden");
    }

    function submitAnswer(): void {
        const round = currentRound();
        if (!round) {
            return;
        }
        const origin = getPlaceById(collection, round.originId);
        const destination = getPlaceById(collection, round.destinationId);
        const chosenAngleDeg = dial.getValue();
        const credit = scoreCompassRound(
            chosenAngleDeg,
            round.bearingDeg,
            tierConfig,
        );
        const isLastRound = roundIndex === challenge.rounds.length - 1;
        const flatBearingDeg = rhumbBearing(origin.point, destination.point);

        onAnswer(roundIndex, chosenAngleDeg, credit, isLastRound);
        recordInsight(round, chosenAngleDeg, flatBearingDeg);

        dial.disable();
        dial.revealAnswer(round.bearingDeg, credit);
        submitButton.classList.add("hidden");

        feedbackHeading.textContent = t(locale, creditKeyFor(credit));
        feedbackBody.replaceChildren(
            ...feedbackParagraphs(
                locale,
                origin,
                destination,
                round,
                chosenAngleDeg,
                flatBearingDeg,
            ).map((text) => {
                const paragraph = document.createElement("p");
                paragraph.textContent = text;
                return paragraph;
            }),
        );
        feedbackPanel.dataset.credit = creditLevel(credit);
        feedbackPanel.classList.remove("hidden");

        const greatCircle = greatCirclePoints(origin.point, destination.point);
        const destinationOnRoute =
            greatCircle[greatCircle.length - 1] ?? destination.point;
        void routeMap.show({
            highlights: [
                {
                    iso2: origin.iso2,
                    anchor: origin.point,
                    emphasis: "endpoint",
                },
                {
                    iso2: destination.iso2,
                    anchor: destinationOnRoute,
                    emphasis: "endpoint",
                },
            ],
            lines: [
                {
                    points: rhumbLinePoints(origin.point, destination.point),
                    style: "secondary",
                },
                { points: greatCircle, style: "primary" },
            ],
            markers: [origin.point, destinationOnRoute],
            arrow: {
                from: origin.point,
                bearingDeg: chosenAngleDeg,
                color: creditHue(credit),
            },
        });

        continueButton.textContent = t(locale, "common.continue");
        continueButton.classList.remove("hidden");
        continueButton.focus();
    }

    function goToNextRoundOrResult(): void {
        if (roundIndex === challenge.rounds.length - 1) {
            onFinish();
            return;
        }
        roundIndex += 1;
        dial.reset();
        renderRound();
    }

    submitButton.addEventListener("click", submitAnswer);
    continueButton.addEventListener("click", goToNextRoundOrResult);

    renderRound();
}
