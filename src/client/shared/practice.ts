import {
    type PracticeModeId,
    type PracticeTier,
    recordPracticeAttempt,
    writePracticeResult,
} from "../../lib/challenge/practice";
import {
    generateWithDedup,
    pushRecentFingerprint,
} from "../../lib/challenge/practiceGenerate";
import type { PracticeCollectionId } from "../../lib/data/collections";
import { loadState, saveState } from "../../lib/persistence/repository";

/** The practice selection encoded in the session page's query string. */
export interface PracticeSelection {
    tier: PracticeTier;
    collectionId: PracticeCollectionId;
}

export function parsePracticeSelection(search: string): PracticeSelection {
    const params = new URLSearchParams(search);
    const rawTier = params.get("tier");
    return {
        tier:
            rawTier === "easy" || rawTier === "medium" || rawTier === "hard"
                ? rawTier
                : "medium",
        collectionId:
            params.get("collection") === "europe" ? "europe" : "world",
    };
}

/** Sorted place ids across all rounds — the dedup fingerprint (see practiceGenerate.ts). */
export function fingerprintOfRounds(
    rounds: ReadonlyArray<{ originId: string; destinationId: string }>,
): string {
    return rounds
        .flatMap((round) => [round.originId, round.destinationId])
        .sort()
        .join(",");
}

/**
 * Generates a fresh practice challenge for `modeId` that avoids the
 * collection's recently-seen fingerprints.
 */
export function generatePracticeChallenge<T>(
    collectionId: PracticeCollectionId,
    modeId: PracticeModeId,
    generate: (seed: string) => T,
    fingerprintOf: (challenge: T) => string,
): { challenge: T; fingerprint: string } {
    const state = loadState(localStorage);
    return generateWithDedup(
        generate,
        fingerprintOf,
        state.practice.recentFingerprints[collectionId][modeId],
    );
}

/**
 * Records a finished practice challenge: updates the per-collection stats
 * and dedup history in `localStorage`, and hands the result to
 * `/practice/result` via `sessionStorage`.
 */
export function savePracticeCompletion(
    selection: PracticeSelection,
    modeId: PracticeModeId,
    fingerprint: string,
    roundCredits: number[],
): void {
    const { collectionId, tier } = selection;
    const state = loadState(localStorage);
    const recent = state.practice.recentFingerprints;
    saveState(
        {
            ...state,
            practice: {
                stats: recordPracticeAttempt(
                    state.practice.stats,
                    collectionId,
                    modeId,
                    roundCredits,
                ),
                recentFingerprints: {
                    ...recent,
                    [collectionId]: {
                        ...recent[collectionId],
                        [modeId]: pushRecentFingerprint(
                            recent[collectionId][modeId],
                            fingerprint,
                        ),
                    },
                },
            },
        },
        localStorage,
    );
    writePracticeResult(
        { collectionId, modeId, tier, roundCredits },
        sessionStorage,
    );
}
