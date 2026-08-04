import { worldCollection } from "../data/generated/world";
import {
    computeArrangeStatus,
    resolveDailyArrange,
    withArrangeDailyEntry,
} from "../lib/challenge/dailyArrange";
import { maybeRecordDailyCompletion } from "../lib/challenge/dailyRitual";
import {
    DAILY_REQUIRED_TIER,
    parseDailyTierParam,
    withTierQuery,
} from "../lib/challenge/dailyTier";
import { getPlaceById } from "../lib/data/lookup";
import { type Locale, type TranslationKey, t } from "../lib/i18n/t";
import { scoreArrangeRound } from "../lib/modes/arrange/score";
import type { ArrangeRound } from "../lib/modes/arrange/types";
import { loadState, saveState } from "../lib/persistence/repository";
import { createArrangeListController } from "./arrangeList";

function getLocale(): Locale {
    return document.documentElement.lang === "es" ? "es" : "en";
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

function promptKeyFor(variant: ArrangeRound["variant"]): TranslationKey {
    if (variant === "north-to-south") {
        return "arrange.promptNorthToSouth";
    }
    if (variant === "west-to-east") {
        return "arrange.promptWestToEast";
    }
    return "arrange.promptClosestToFarthest";
}

/**
 * TypeScript's control-flow narrowing doesn't persist into nested function
 * declarations defined later in the same scope, so returning an
 * already-non-nullable type from this helper sidesteps that instead of
 * reaching for non-null assertions (same pattern as compassSession.ts).
 */
function must<T>(value: T | null | undefined, description: string): T {
    if (value === null || value === undefined) {
        throw new Error(
            `arrangeSession: missing required element "${description}"`,
        );
    }
    return value;
}

export function mountArrangeSession(): void {
    const locale = getLocale();
    const sessionStart = new Date();
    const tier = parseDailyTierParam(
        new URLSearchParams(window.location.search),
    );
    const initialState = loadState(localStorage);
    const { dateKey, challenge, entry } = resolveDailyArrange(
        sessionStart,
        initialState,
        tier,
    );

    if (computeArrangeStatus(entry) === "completed") {
        window.location.href = withTierQuery("/result/arrange", tier);
        return;
    }

    // Persist a freshly-initialized entry right away so a reload mid-session resumes correctly.
    saveState(
        withArrangeDailyEntry(initialState, dateKey, tier, entry),
        localStorage,
    );

    const firstUnanswered = entry.rounds.findIndex(
        (round) => round.submittedOrder === null,
    );
    let roundIndex =
        firstUnanswered === -1 ? entry.rounds.length - 1 : firstUnanswered;

    const roundCounterEl = must(
        document.getElementById("round-counter"),
        "round-counter",
    );
    const promptEl = must(
        document.getElementById("arrange-prompt"),
        "arrange-prompt",
    );
    const listRoot = must(
        document.getElementById("arrange-list"),
        "arrange-list",
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

    const list = createArrangeListController(
        listRoot,
        (direction, name) =>
            t(
                locale,
                direction === "up" ? "arrange.moveUp" : "arrange.moveDown",
                { name },
            ),
        (correct) =>
            t(
                locale,
                correct
                    ? "arrange.positionCorrect"
                    : "arrange.positionIncorrect",
            ),
    );

    function currentRound(): ArrangeRound | undefined {
        return challenge.rounds[roundIndex];
    }

    function renderRound(): void {
        const round = currentRound();
        if (!round) {
            return;
        }

        const items = round.itemIds.map((id) => {
            const place = getPlaceById(worldCollection, id);
            return { id, name: place.names[locale] };
        });
        list.setOrder(round.itemIds, items);

        roundCounterEl.textContent = t(locale, "arrange.roundOf", {
            current: roundIndex + 1,
            total: challenge.rounds.length,
        });

        if (round.variant === "closest-to-farthest" && round.referenceId) {
            const reference = getPlaceById(worldCollection, round.referenceId);
            promptEl.textContent = t(
                locale,
                "arrange.promptClosestToFarthest",
                {
                    reference: reference.names[locale],
                },
            );
        } else {
            promptEl.textContent = t(locale, promptKeyFor(round.variant));
        }

        feedbackPanel.classList.add("hidden");
        continueButton.classList.add("hidden");
        submitButton.classList.remove("hidden");
    }

    function submitAnswer(): void {
        const round = currentRound();
        if (!round) {
            return;
        }

        const submittedOrder = list.getOrder();
        const credit = scoreArrangeRound(round.correctOrderIds, submittedOrder);
        entry.rounds[roundIndex] = { submittedOrder, credit };

        const isLastRound = roundIndex === entry.rounds.length - 1;
        if (isLastRound) {
            entry.completedAt = new Date().toISOString();
        }

        const stateBeforeSave = loadState(localStorage);
        const stateWithEntry = withArrangeDailyEntry(
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

        list.showResult(round.correctOrderIds);
        list.disable();
        submitButton.classList.add("hidden");

        const matches = round.correctOrderIds.filter(
            (id, index) => id === submittedOrder[index],
        ).length;
        const correctNames = round.correctOrderIds
            .map((id) => getPlaceById(worldCollection, id).names[locale])
            .join(", ");

        feedbackHeading.textContent = t(locale, creditKeyFor(credit));
        feedbackBody.textContent = [
            t(locale, "arrange.inPlaceOf", {
                matches,
                total: round.correctOrderIds.length,
            }),
            t(locale, "arrange.correctOrderWas", { order: correctNames }),
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
            window.location.href = withTierQuery("/result/arrange", tier);
            return;
        }
        roundIndex += 1;
        renderRound();
    }

    submitButton.addEventListener("click", submitAnswer);
    continueButton.addEventListener("click", goToNextRoundOrResult);

    renderRound();
}
