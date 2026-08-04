import { worldCollection } from "../../data/generated/world";
import { generateArrangeChallenge } from "../modes/arrange/generate";
import type { ArrangeChallenge } from "../modes/arrange/types";
import type { ArrangeDailyEntry, PersistedState } from "../persistence/schema";
import { buildDailyKey, getUtcDateKey } from "../prng/dailyKey";
import { DATA_VERSION, GENERATOR_VERSION } from "../versions";
import {
    DAILY_REQUIRED_TIER,
    type DailyTier,
    dailyBonusEntryKey,
} from "./dailyTier";

const COLLECTION_ID = "world";
const MODE_ID = "arrange";

export interface DailyArrangeContext {
    dateKey: string;
    tier: DailyTier;
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
    tier: DailyTier = DAILY_REQUIRED_TIER,
): DailyArrangeContext {
    const dateKey = getUtcDateKey(now);
    const seed = buildDailyKey({
        generatorVersion: GENERATOR_VERSION,
        dataVersion: DATA_VERSION,
        date: dateKey,
        collectionId: COLLECTION_ID,
        modeId: MODE_ID,
        tierId: tier,
    });

    const challenge = generateArrangeChallenge({
        seed,
        challengeId: seed,
        generatorVersion: GENERATOR_VERSION,
        dataVersion: DATA_VERSION,
        collectionId: COLLECTION_ID,
        tier,
        places: worldCollection.places,
    });

    const entry =
        tier === DAILY_REQUIRED_TIER
            ? (state.arrange.daily[dateKey] ?? createEntry(challenge))
            : (state.arrange.dailyBonus[dailyBonusEntryKey(dateKey, tier)] ??
              createEntry(challenge));

    return { dateKey, tier, challenge, entry };
}

/** Writes `entry` back to the map matching `tier` — required stays in `daily`, bonus goes in `dailyBonus`. */
export function withArrangeDailyEntry(
    state: PersistedState,
    dateKey: string,
    tier: DailyTier,
    entry: ArrangeDailyEntry,
): PersistedState {
    if (tier === DAILY_REQUIRED_TIER) {
        return {
            ...state,
            arrange: {
                ...state.arrange,
                daily: { ...state.arrange.daily, [dateKey]: entry },
            },
        };
    }
    return {
        ...state,
        arrange: {
            ...state.arrange,
            dailyBonus: {
                ...state.arrange.dailyBonus,
                [dailyBonusEntryKey(dateKey, tier)]: entry,
            },
        },
    };
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
