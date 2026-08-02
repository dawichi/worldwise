import { worldCollection } from "../data/generated/world";
import {
    type PracticeModeId,
    type PracticeTier,
    recordPracticeAttempt,
    writePracticeResult,
} from "../lib/challenge/practice";
import {
    generateWithDedup,
    pushRecentFingerprint,
} from "../lib/challenge/practiceGenerate";
import { getPlaceById } from "../lib/data/lookup";
import { bearingToCompassLabel } from "../lib/geo/angle";
import { localizedDirectionName } from "../lib/i18n/directions";
import { type Locale, type TranslationKey, t } from "../lib/i18n/t";
import { generateCompassChallenge } from "../lib/modes/compass/generate";
import { scoreCompassRound } from "../lib/modes/compass/score";
import { COMPASS_TIERS } from "../lib/modes/compass/tiers";
import type {
    CompassChallenge,
    CompassRound,
} from "../lib/modes/compass/types";
import { loadState, saveState } from "../lib/persistence/repository";
import { DATA_VERSION, GENERATOR_VERSION } from "../lib/versions";
import { createCompassDialController } from "./compassDial";

const COLLECTION_ID = "world";
const MODE_ID: PracticeModeId = "compass";

function getLocale(): Locale {
    return document.documentElement.lang === "es" ? "es" : "en";
}

function parseTier(): PracticeTier {
    const raw = new URLSearchParams(window.location.search).get("tier");
    return raw === "easy" || raw === "medium" || raw === "hard"
        ? raw
        : "medium";
}

function creditKeyFor(credit: number): TranslationKey {
    if (credit === 1) {
        return "common.creditFull";
    }
    return credit > 0 ? "common.creditPartial" : "common.creditNone";
}

function creditLevel(credit: number): "full" | "partial" | "none" {
    if (credit === 1) {
        return "full";
    }
    return credit > 0 ? "partial" : "none";
}

function must<T>(value: T | null | undefined, description: string): T {
    if (value === null || value === undefined) {
        throw new Error(
            `practiceCompassSession: missing required element "${description}"`,
        );
    }
    return value;
}

/** Sorted place ids across all rounds — the dedup fingerprint (see practiceGenerate.ts). */
function fingerprintOf(challenge: CompassChallenge): string {
    return challenge.rounds
        .flatMap((round) => [round.originId, round.destinationId])
        .sort()
        .join(",");
}

export function mountPracticeCompassSession(): void {
    const locale = getLocale();
    const tier = parseTier();
    const tierConfig = COMPASS_TIERS[tier];
    const state = loadState(localStorage);

    const { challenge, fingerprint } = generateWithDedup(
        (seed) =>
            generateCompassChallenge({
                seed,
                challengeId: seed,
                generatorVersion: GENERATOR_VERSION,
                dataVersion: DATA_VERSION,
                collectionId: COLLECTION_ID,
                tier,
                places: worldCollection.places,
            }),
        fingerprintOf,
        state.practice.recentFingerprints.compass,
    );

    let roundIndex = 0;
    const roundCredits: number[] = [];

    const tierLabelEl = must(
        document.getElementById("tier-label"),
        "tier-label",
    );
    const roundCounterEl = must(
        document.getElementById("round-counter"),
        "round-counter",
    );
    const promptEl = must(
        document.getElementById("compass-prompt"),
        "compass-prompt",
    );
    const originChipEl = must(
        document.getElementById("origin-chip"),
        "origin-chip",
    );
    const destinationChipEl = must(
        document.getElementById("destination-chip"),
        "destination-chip",
    );
    const dialRoot = must(
        document.getElementById("compass-dial"),
        "compass-dial",
    );
    const submitButton = must(
        document.getElementById("submit-answer"),
        "submit-answer",
    );
    const continueButton = must(
        document.getElementById("continue-round"),
        "continue-round",
    );
    const feedbackPanel = must(
        document.getElementById("feedback-panel"),
        "feedback-panel",
    );
    const feedbackHeading = must(
        feedbackPanel.querySelector<HTMLElement>(
            '[data-role="feedback-heading"]',
        ),
        "feedback-heading",
    );
    const feedbackBody = must(
        feedbackPanel.querySelector<HTMLElement>('[data-role="feedback-body"]'),
        "feedback-body",
    );

    tierLabelEl.textContent = t(locale, "compass.tierLabel", {
        tier: t(locale, `tiers.${tier}`),
    });

    const dial = createCompassDialController(dialRoot, (deg) => {
        const label = bearingToCompassLabel(deg);
        return `${Math.round(deg)}° · ${localizedDirectionName(locale, label)}`;
    });

    function currentRound(): CompassRound | undefined {
        return challenge.rounds[roundIndex];
    }

    function renderRound(): void {
        const round = currentRound();
        if (!round) {
            return;
        }
        const origin = getPlaceById(worldCollection, round.originId);
        const destination = getPlaceById(worldCollection, round.destinationId);

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

        feedbackPanel.classList.add("hidden");
        continueButton.classList.add("hidden");
        submitButton.classList.remove("hidden");
    }

    function submitAnswer(): void {
        const round = currentRound();
        if (!round) {
            return;
        }

        const chosenAngleDeg = dial.getValue();
        const credit = scoreCompassRound(
            chosenAngleDeg,
            round.bearingDeg,
            tierConfig,
        );
        roundCredits.push(credit);

        const isLastRound = roundIndex === challenge.rounds.length - 1;
        if (isLastRound) {
            const stateBeforeSave = loadState(localStorage);
            saveState(
                {
                    ...stateBeforeSave,
                    practice: {
                        stats: recordPracticeAttempt(
                            stateBeforeSave.practice.stats,
                            MODE_ID,
                            roundCredits,
                        ),
                        recentFingerprints: {
                            ...stateBeforeSave.practice.recentFingerprints,
                            compass: pushRecentFingerprint(
                                stateBeforeSave.practice.recentFingerprints
                                    .compass,
                                fingerprint,
                            ),
                        },
                    },
                },
                localStorage,
            );
            writePracticeResult(
                { modeId: MODE_ID, tier, roundCredits },
                sessionStorage,
            );
        }

        dial.disable();
        submitButton.classList.add("hidden");

        const trueLabel = bearingToCompassLabel(round.bearingDeg);
        const trueDirectionName = localizedDirectionName(locale, trueLabel);
        const origin = getPlaceById(worldCollection, round.originId);
        const destination = getPlaceById(worldCollection, round.destinationId);

        feedbackHeading.textContent = t(locale, creditKeyFor(credit));
        feedbackBody.textContent = [
            t(locale, "compass.trueBearing", {
                direction: trueDirectionName,
                degrees: Math.round(round.bearingDeg),
            }),
            t(locale, "compass.yourAnswer", {
                degrees: Math.round(chosenAngleDeg),
            }),
            t(locale, "compass.distanceNote", {
                destination: destination.names[locale],
                distance: Math.round(round.distanceKm),
                direction: trueDirectionName,
                origin: origin.names[locale],
            }),
        ].join(" ");
        feedbackPanel.dataset.credit = creditLevel(credit);
        feedbackPanel.classList.remove("hidden");
        continueButton.textContent = t(locale, "common.continue");
        continueButton.classList.remove("hidden");
        continueButton.focus();
    }

    function goToNextRoundOrResult(): void {
        const isLastRound = roundIndex === challenge.rounds.length - 1;
        if (isLastRound) {
            window.location.href = "/practice/result";
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
