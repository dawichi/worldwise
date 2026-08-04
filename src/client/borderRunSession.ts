import { worldCollection } from "../data/generated/world";
import {
    computeBorderRunStatus,
    resolveDailyBorderRun,
    withBorderRunDailyEntry,
} from "../lib/challenge/dailyBorderRun";
import { maybeRecordDailyCompletion } from "../lib/challenge/dailyRitual";
import {
    DAILY_REQUIRED_TIER,
    parseDailyTierParam,
    withTierQuery,
} from "../lib/challenge/dailyTier";
import { getPlaceById } from "../lib/data/lookup";
import { type Locale, type TranslationKey, t } from "../lib/i18n/t";
import { scoreBorderRunRound } from "../lib/modes/borderRun/score";
import type { BorderRunRound } from "../lib/modes/borderRun/types";
import { loadState, saveState } from "../lib/persistence/repository";
import { createBorderRunPathController } from "./borderRunPath";

function getLocale(): Locale {
    return document.documentElement.lang === "es" ? "es" : "en";
}

function creditKeyFor(credit: number): TranslationKey {
    return credit === 1 ? "common.creditFull" : "common.creditNone";
}

function creditLevel(credit: number): "full" | "none" {
    return credit === 1 ? "full" : "none";
}

/**
 * TypeScript's control-flow narrowing doesn't persist into nested function
 * declarations defined later in the same scope, so returning an
 * already-non-nullable type from this helper sidesteps that instead of
 * reaching for non-null assertions (same pattern as arrangeSession.ts).
 */
function must<T>(value: T | null | undefined, description: string): T {
    if (value === null || value === undefined) {
        throw new Error(
            `borderRunSession: missing required element "${description}"`,
        );
    }
    return value;
}

export function mountBorderRunSession(): void {
    const locale = getLocale();
    const sessionStart = new Date();
    const tier = parseDailyTierParam(
        new URLSearchParams(window.location.search),
    );
    const initialState = loadState(localStorage);
    const { dateKey, challenge, entry } = resolveDailyBorderRun(
        sessionStart,
        initialState,
        tier,
    );

    if (computeBorderRunStatus(entry) === "completed") {
        window.location.href = withTierQuery("/result/border-run", tier);
        return;
    }

    // Persist a freshly-initialized entry right away so a reload mid-session resumes correctly.
    saveState(
        withBorderRunDailyEntry(initialState, dateKey, tier, entry),
        localStorage,
    );

    const firstUnanswered = entry.rounds.findIndex(
        (round) => round.submittedPath === null,
    );
    let roundIndex =
        firstUnanswered === -1 ? entry.rounds.length - 1 : firstUnanswered;

    const roundCounterEl = must(
        document.getElementById("round-counter"),
        "round-counter",
    );
    const promptEl = must(
        document.getElementById("border-run-prompt"),
        "border-run-prompt",
    );
    const routeRoot = must(
        document.getElementById("route-builder"),
        "route-builder",
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

    const path = createBorderRunPathController(
        routeRoot,
        worldCollection.places,
        locale,
        (name) => t(locale, "borderRun.addHop", { name }),
    );

    function currentRound(): BorderRunRound | undefined {
        return challenge.rounds[roundIndex];
    }

    function renderRound(): void {
        const round = currentRound();
        if (!round) {
            return;
        }

        const origin = getPlaceById(worldCollection, round.originId);
        const destination = getPlaceById(worldCollection, round.destinationId);

        path.setRound(round.originId, round.destinationId);

        roundCounterEl.textContent = t(locale, "borderRun.roundOf", {
            current: roundIndex + 1,
            total: challenge.rounds.length,
        });
        promptEl.textContent = t(locale, "borderRun.prompt", {
            origin: origin.names[locale],
            destination: destination.names[locale],
        });

        feedbackPanel.classList.add("hidden");
        continueButton.classList.add("hidden");
        submitButton.classList.remove("hidden");
    }

    function submitAnswer(): void {
        const round = currentRound();
        if (!round) {
            return;
        }

        const submittedPath = path.getPath();
        const credit = scoreBorderRunRound(
            worldCollection.places,
            round,
            submittedPath,
        );
        entry.rounds[roundIndex] = { submittedPath, credit };

        const isLastRound = roundIndex === entry.rounds.length - 1;
        if (isLastRound) {
            entry.completedAt = new Date().toISOString();
        }

        const stateBeforeSave = loadState(localStorage);
        const stateWithEntry = withBorderRunDailyEntry(
            stateBeforeSave,
            dateKey,
            tier,
            entry,
        );
        const finalState =
            isLastRound && tier === DAILY_REQUIRED_TIER
                ? maybeRecordDailyCompletion(stateWithEntry, dateKey)
                : stateWithEntry;
        saveState(finalState, localStorage);

        const isValid = credit === 1;
        path.showResult(isValid);
        submitButton.classList.add("hidden");

        const routeNames = submittedPath
            .map((id) => getPlaceById(worldCollection, id).names[locale])
            .join(" → ");
        const destinationName = getPlaceById(
            worldCollection,
            round.destinationId,
        ).names[locale];

        feedbackHeading.textContent = t(locale, creditKeyFor(credit));
        feedbackBody.textContent = isValid
            ? t(locale, "borderRun.routeValid", { route: routeNames })
            : t(locale, "borderRun.routeInvalid", {
                  destination: destinationName,
              });
        feedbackPanel.dataset.credit = creditLevel(credit);
        feedbackPanel.classList.remove("hidden");
        continueButton.textContent = t(locale, "common.continue");
        continueButton.classList.remove("hidden");
        continueButton.focus();
    }

    function goToNextRoundOrResult(): void {
        const isLastRound = roundIndex === entry.rounds.length - 1;
        if (isLastRound) {
            window.location.href = withTierQuery("/result/border-run", tier);
            return;
        }
        roundIndex += 1;
        renderRound();
    }

    submitButton.addEventListener("click", submitAnswer);
    continueButton.addEventListener("click", goToNextRoundOrResult);

    renderRound();
}
