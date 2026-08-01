import { worldCollection } from "../../data/generated/world";
import { generateArrangeChallenge } from "../modes/arrange/generate";
import type { ArrangeChallenge } from "../modes/arrange/types";
import type { ArrangeDailyEntry, PersistedState } from "../persistence/schema";
import { buildDailyKey, getUtcDateKey } from "../prng/dailyKey";
import { DATA_VERSION, GENERATOR_VERSION } from "../versions";

const COLLECTION_ID = "world";
const MODE_ID = "arrange";
/** The required daily tier (ADR-0003); easy/hard are bonus-only, not built this milestone. */
const DAILY_TIER = "medium";

export interface DailyArrangeContext {
    dateKey: string;
    challenge: ArrangeChallenge;
    /** The persisted entry for today — freshly initialized if this is the first visit today. */
    entry: ArrangeDailyEntry;
}

function createEntry(challenge: ArrangeChallenge): ArrangeDailyEntry {
    return {
        challengeId: challenge.id,
        generatorVersion: challenge.generatorVersion,
        dataVersion: challenge.dataVersion,
        tier: challenge.tier,
        rounds: challenge.rounds.map(() => ({
            submittedOrder: null,
            credit: 0,
        })),
        completedAt: null,
    };
}

/**
 * Resolves today's Arrange mode-challenge and the player's in-progress (or
 * fresh) entry for it. The challenge itself is never persisted — it's
 * regenerated deterministically from the daily key every time, per
 * IDEA.md's generation model; only the player's answers are stored.
 */
export function resolveDailyArrange(
    now: Date,
    state: PersistedState,
): DailyArrangeContext {
    const dateKey = getUtcDateKey(now);
    const seed = buildDailyKey({
        generatorVersion: GENERATOR_VERSION,
        dataVersion: DATA_VERSION,
        date: dateKey,
        collectionId: COLLECTION_ID,
        modeId: MODE_ID,
        tierId: DAILY_TIER,
    });

    const challenge = generateArrangeChallenge({
        seed,
        challengeId: seed,
        generatorVersion: GENERATOR_VERSION,
        dataVersion: DATA_VERSION,
        collectionId: COLLECTION_ID,
        tier: DAILY_TIER,
        places: worldCollection.places,
    });

    const entry = state.arrange.daily[dateKey] ?? createEntry(challenge);

    return { dateKey, challenge, entry };
}

export type ArrangeDailyStatus = "not-started" | "in-progress" | "completed";

export function countAnsweredRounds(entry: ArrangeDailyEntry): number {
    return entry.rounds.filter((round) => round.submittedOrder !== null).length;
}

export function computeArrangeStatus(
    entry: ArrangeDailyEntry,
): ArrangeDailyStatus {
    if (entry.completedAt !== null) {
        return "completed";
    }
    return countAnsweredRounds(entry) > 0 ? "in-progress" : "not-started";
}
