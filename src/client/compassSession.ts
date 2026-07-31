import { worldCollection } from "../data/generated/world";
import {
    computeCompassStatus,
    resolveDailyCompass,
} from "../lib/challenge/dailyCompass";
import { recordDailyCompletion } from "../lib/challenge/streak";
import { getPlaceById } from "../lib/data/lookup";
import { bearingToCompassLabel } from "../lib/geo/angle";
import { localizedDirectionName } from "../lib/i18n/directions";
import { type Locale, type TranslationKey, t } from "../lib/i18n/t";
import { scoreCompassRound } from "../lib/modes/compass/score";
import { COMPASS_TIERS } from "../lib/modes/compass/tiers";
import type { CompassRound } from "../lib/modes/compass/types";
import { loadState, saveState } from "../lib/persistence/repository";
import { createCompassDialController } from "./compassDial";

function getLocale(): Locale {
    return document.documentElement.lang === "es" ? "es" : "en";
}

function creditKeyFor(credit: number): TranslationKey {
    if (credit === 1) {
        return "compass.creditFull";
    }
    return credit > 0 ? "compass.creditPartial" : "compass.creditNone";
}

function creditLevel(credit: number): "full" | "partial" | "none" {
    if (credit === 1) {
        return "full";
    }
    return credit > 0 ? "partial" : "none";
}

/**
 * TypeScript's control-flow narrowing doesn't persist into nested function
 * declarations defined later in the same scope (they might be called at
 * any future time), so a one-time `if (!x) return` guard above a set of
 * closures isn't enough to keep them typed as non-null. Returning an
 * already-non-nullable type from this helper sidesteps that instead of
 * reaching for non-null assertions.
 */
function must<T>(value: T | null | undefined, description: string): T {
    if (value === null || value === undefined) {
        throw new Error(
            `compassSession: missing required element "${description}"`,
        );
    }
    return value;
}

export function mountCompassSession(): void {
    const locale = getLocale();
    const sessionStart = new Date();
    const initialState = loadState(localStorage);
    const { dateKey, challenge, entry } = resolveDailyCompass(
        sessionStart,
        initialState,
    );

    if (computeCompassStatus(entry) === "completed") {
        window.location.href = "/result/compass";
        return;
    }

    // Persist a freshly-initialized entry right away so a reload mid-session resumes correctly.
    saveState(
        {
            ...initialState,
            compass: {
                daily: { ...initialState.compass.daily, [dateKey]: entry },
            },
        },
        localStorage,
    );

    const firstUnanswered = entry.rounds.findIndex(
        (round) => round.chosenAngleDeg === null,
    );
    let roundIndex =
        firstUnanswered === -1 ? entry.rounds.length - 1 : firstUnanswered;

    const tierConfig = COMPASS_TIERS[challenge.tier];

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
        entry.rounds[roundIndex] = { chosenAngleDeg, credit };

        const isLastRound = roundIndex === entry.rounds.length - 1;
        if (isLastRound) {
            entry.completedAt = new Date().toISOString();
        }

        const stateBeforeSave = loadState(localStorage);
        const streak = isLastRound
            ? recordDailyCompletion(stateBeforeSave.streak, dateKey)
            : stateBeforeSave.streak;
        saveState(
            {
                ...stateBeforeSave,
                compass: {
                    daily: {
                        ...stateBeforeSave.compass.daily,
                        [dateKey]: entry,
                    },
                },
                streak,
            },
            localStorage,
        );

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
        const isLastRound = roundIndex === entry.rounds.length - 1;
        if (isLastRound) {
            window.location.href = "/result/compass";
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
