import { z } from "zod";
import type { StorageLike } from "../persistence/repository";
import type { PracticeStats } from "../persistence/schema";

export const PRACTICE_MODE_IDS = ["compass", "arrange", "borderRun"] as const;
export type PracticeModeId = (typeof PRACTICE_MODE_IDS)[number];

export const PRACTICE_TIERS = ["easy", "medium", "hard"] as const;
export type PracticeTier = (typeof PRACTICE_TIERS)[number];

/** Pure state transition for completing one practice challenge — mirrors `streak.ts`'s style. */
export function recordPracticeAttempt(
    stats: PracticeStats,
    modeId: PracticeModeId,
    roundCredits: number[],
): PracticeStats {
    const current = stats[modeId];
    return {
        ...stats,
        [modeId]: {
            attempts: current.attempts + 1,
            roundsAnswered: current.roundsAnswered + roundCredits.length,
            totalCredit:
                current.totalCredit +
                roundCredits.reduce((sum, credit) => sum + credit, 0),
        },
    };
}

const PRACTICE_RESULT_STORAGE_KEY = "worldwise:practice:lastResult";

const practiceResultPayloadSchema = z.object({
    modeId: z.enum(PRACTICE_MODE_IDS),
    tier: z.enum(PRACTICE_TIERS),
    roundCredits: z.array(z.number().gte(0).lte(1)),
});

export type PracticeResultPayload = z.infer<typeof practiceResultPayloadSchema>;

/**
 * Hands a just-completed practice challenge's result off to
 * `/practice/result` via `sessionStorage` (not `localStorage` — this is
 * ephemeral navigation state, not durable progress; the durable part is
 * `practice.stats`, written separately via `recordPracticeAttempt`).
 * Takes a `StorageLike` (same interface `persistence/repository.ts` uses)
 * rather than touching the `sessionStorage` global directly, so tests can
 * pass an in-memory double instead of requiring a DOM environment. Call
 * sites pass the real `sessionStorage` global.
 */
export function writePracticeResult(
    payload: PracticeResultPayload,
    storage: StorageLike,
): void {
    storage.setItem(PRACTICE_RESULT_STORAGE_KEY, JSON.stringify(payload));
}

/**
 * Reads back the handoff written by `writePracticeResult`. Returns `null`
 * on missing or invalid content — same "recover gracefully" posture as
 * `persistence/repository.ts` — so the result page can redirect to
 * `/practice` instead of crashing.
 */
export function readPracticeResult(
    storage: StorageLike,
): PracticeResultPayload | null {
    const raw = storage.getItem(PRACTICE_RESULT_STORAGE_KEY);
    if (raw === null) {
        return null;
    }

    let parsed: unknown;
    try {
        parsed = JSON.parse(raw);
    } catch {
        return null;
    }

    const result = practiceResultPayloadSchema.safeParse(parsed);
    return result.success ? result.data : null;
}
