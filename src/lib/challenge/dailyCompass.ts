import { worldCollection } from "../../data/generated/world";
import { generateCompassChallenge } from "../modes/compass/generate";
import type { CompassChallenge } from "../modes/compass/types";
import type { CompassDailyEntry, PersistedState } from "../persistence/schema";
import { buildDailyKey, getUtcDateKey } from "../prng/dailyKey";
import { DATA_VERSION, GENERATOR_VERSION } from "../versions";

const COLLECTION_ID = "world";
const MODE_ID = "compass";
/** The required daily tier (ADR-0003); easy/hard are bonus-only, not built this milestone. */
const DAILY_TIER = "medium";

export interface DailyCompassContext {
    dateKey: string;
    challenge: CompassChallenge;
    /** The persisted entry for today — freshly initialized if this is the first visit today. */
    entry: CompassDailyEntry;
}

function createEntry(challenge: CompassChallenge): CompassDailyEntry {
    return {
        challengeId: challenge.id,
        generatorVersion: challenge.generatorVersion,
        dataVersion: challenge.dataVersion,
        tier: challenge.tier,
        rounds: challenge.rounds.map(() => ({
            chosenAngleDeg: null,
            credit: 0,
        })),
        completedAt: null,
    };
}

/**
 * Resolves today's Compass mode-challenge and the player's in-progress (or
 * fresh) entry for it. The challenge itself is never persisted — it's
 * regenerated deterministically from the daily key every time, per
 * IDEA.md's generation model; only the player's answers are stored.
 */
export function resolveDailyCompass(
    now: Date,
    state: PersistedState,
): DailyCompassContext {
    const dateKey = getUtcDateKey(now);
    const seed = buildDailyKey({
        generatorVersion: GENERATOR_VERSION,
        dataVersion: DATA_VERSION,
        date: dateKey,
        collectionId: COLLECTION_ID,
        modeId: MODE_ID,
        tierId: DAILY_TIER,
    });

    const challenge = generateCompassChallenge({
        seed,
        challengeId: seed,
        generatorVersion: GENERATOR_VERSION,
        dataVersion: DATA_VERSION,
        collectionId: COLLECTION_ID,
        tier: DAILY_TIER,
        places: worldCollection.places,
    });

    const entry = state.compass.daily[dateKey] ?? createEntry(challenge);

    return { dateKey, challenge, entry };
}

export type CompassDailyStatus = "not-started" | "in-progress" | "completed";

export function countAnsweredRounds(entry: CompassDailyEntry): number {
    return entry.rounds.filter((round) => round.chosenAngleDeg !== null).length;
}

export function computeCompassStatus(
    entry: CompassDailyEntry,
): CompassDailyStatus {
    if (entry.completedAt !== null) {
        return "completed";
    }
    return countAnsweredRounds(entry) > 0 ? "in-progress" : "not-started";
}
