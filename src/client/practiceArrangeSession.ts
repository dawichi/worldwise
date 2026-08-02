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
import { type Locale, type TranslationKey, t } from "../lib/i18n/t";
import { generateArrangeChallenge } from "../lib/modes/arrange/generate";
import { scoreArrangeRound } from "../lib/modes/arrange/score";
import type {
    ArrangeChallenge,
    ArrangeRound,
} from "../lib/modes/arrange/types";
import { loadState, saveState } from "../lib/persistence/repository";
import { DATA_VERSION, GENERATOR_VERSION } from "../lib/versions";
import { createArrangeListController } from "./arrangeList";

const COLLECTION_ID = "world";
const MODE_ID: PracticeModeId = "arrange";

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
            `practiceArrangeSession: missing required element "${description}"`,
        );
    }
    return value;
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

/** Sorted place ids across all rounds — the dedup fingerprint (see practiceGenerate.ts). */
function fingerprintOf(challenge: ArrangeChallenge): string {
    return challenge.rounds
        .flatMap((round) => round.itemIds)
        .sort()
        .join(",");
}

export function mountPracticeArrangeSession(): void {
    const locale = getLocale();
    const tier = parseTier();
    const state = loadState(localStorage);

    const { challenge, fingerprint } = generateWithDedup(
        (seed) =>
            generateArrangeChallenge({
                seed,
                challengeId: seed,
                generatorVersion: GENERATOR_VERSION,
                dataVersion: DATA_VERSION,
                collectionId: COLLECTION_ID,
                tier,
                places: worldCollection.places,
            }),
        fingerprintOf,
        state.practice.recentFingerprints.arrange,
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

    tierLabelEl.textContent = t(locale, "arrange.tierLabel", {
        tier: t(locale, `tiers.${tier}`),
    });

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
                            arrange: pushRecentFingerprint(
                                stateBeforeSave.practice.recentFingerprints
                                    .arrange,
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
        const isLastRound = roundIndex === challenge.rounds.length - 1;
        if (isLastRound) {
            window.location.href = "/practice/result";
            return;
        }
        roundIndex += 1;
        renderRound();
    }

    submitButton.addEventListener("click", submitAnswer);
    continueButton.addEventListener("click", goToNextRoundOrResult);

    renderRound();
}
