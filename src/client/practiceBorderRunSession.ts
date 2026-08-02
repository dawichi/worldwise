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
import { generateBorderRunChallenge } from "../lib/modes/borderRun/generate";
import { scoreBorderRunRound } from "../lib/modes/borderRun/score";
import type {
    BorderRunChallenge,
    BorderRunRound,
} from "../lib/modes/borderRun/types";
import { loadState, saveState } from "../lib/persistence/repository";
import { DATA_VERSION, GENERATOR_VERSION } from "../lib/versions";
import { createBorderRunPathController } from "./borderRunPath";

const COLLECTION_ID = "world";
const MODE_ID: PracticeModeId = "borderRun";

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
    return credit === 1 ? "common.creditFull" : "common.creditNone";
}

function creditLevel(credit: number): "full" | "none" {
    return credit === 1 ? "full" : "none";
}

function must<T>(value: T | null | undefined, description: string): T {
    if (value === null || value === undefined) {
        throw new Error(
            `practiceBorderRunSession: missing required element "${description}"`,
        );
    }
    return value;
}

/** Sorted place ids across all rounds — the dedup fingerprint (see practiceGenerate.ts). */
function fingerprintOf(challenge: BorderRunChallenge): string {
    return challenge.rounds
        .flatMap((round) => [round.originId, round.destinationId])
        .sort()
        .join(",");
}

export function mountPracticeBorderRunSession(): void {
    const locale = getLocale();
    const tier = parseTier();
    const state = loadState(localStorage);

    const { challenge, fingerprint } = generateWithDedup(
        (seed) =>
            generateBorderRunChallenge({
                seed,
                challengeId: seed,
                generatorVersion: GENERATOR_VERSION,
                dataVersion: DATA_VERSION,
                collectionId: COLLECTION_ID,
                tier,
                places: worldCollection.places,
            }),
        fingerprintOf,
        state.practice.recentFingerprints.borderRun,
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

    tierLabelEl.textContent = t(locale, "borderRun.tierLabel", {
        tier: t(locale, `tiers.${tier}`),
    });

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
                            borderRun: pushRecentFingerprint(
                                stateBeforeSave.practice.recentFingerprints
                                    .borderRun,
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
