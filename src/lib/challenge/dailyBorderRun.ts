import { worldCollection } from "../../data/generated/world";
import { generateBorderRunChallenge } from "../modes/borderRun/generate";
import type { BorderRunChallenge } from "../modes/borderRun/types";
import type {
    BorderRunDailyEntry,
    PersistedState,
} from "../persistence/schema";
import { buildDailyKey, getUtcDateKey } from "../prng/dailyKey";
import { DATA_VERSION, GENERATOR_VERSION } from "../versions";
import {
    DAILY_REQUIRED_TIER,
    type DailyTier,
    dailyBonusEntryKey,
} from "./dailyTier";

const COLLECTION_ID = "world";
const MODE_ID = "borderRun";

export interface DailyBorderRunContext {
    dateKey: string;
    tier: DailyTier;
    challenge: BorderRunChallenge;
    /** The persisted entry for today — freshly initialized if this is the first visit today. */
    entry: BorderRunDailyEntry;
}

function createEntry(challenge: BorderRunChallenge): BorderRunDailyEntry {
    return {
        challengeId: challenge.id,
        generatorVersion: challenge.generatorVersion,
        dataVersion: challenge.dataVersion,
        tier: challenge.tier,
        rounds: challenge.rounds.map(() => ({
            submittedPath: null,
            credit: 0,
        })),
        completedAt: null,
    };
}

/**
 * Resolves today's Border Run mode-challenge and the player's in-progress
 * (or fresh) entry for it. The challenge itself is never persisted — it's
 * regenerated deterministically from the daily key every time, per
 * IDEA.md's generation model; only the player's answers are stored.
 */
export function resolveDailyBorderRun(
    now: Date,
    state: PersistedState,
    tier: DailyTier = DAILY_REQUIRED_TIER,
): DailyBorderRunContext {
    const dateKey = getUtcDateKey(now);
    const seed = buildDailyKey({
        generatorVersion: GENERATOR_VERSION,
        dataVersion: DATA_VERSION,
        date: dateKey,
        collectionId: COLLECTION_ID,
        modeId: MODE_ID,
        tierId: tier,
    });

    const challenge = generateBorderRunChallenge({
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
            ? (state.borderRun.daily[dateKey] ?? createEntry(challenge))
            : (state.borderRun.dailyBonus[dailyBonusEntryKey(dateKey, tier)] ??
              createEntry(challenge));

    return { dateKey, tier, challenge, entry };
}

/** Writes `entry` back to the map matching `tier` — required stays in `daily`, bonus goes in `dailyBonus`. */
export function withBorderRunDailyEntry(
    state: PersistedState,
    dateKey: string,
    tier: DailyTier,
    entry: BorderRunDailyEntry,
): PersistedState {
    if (tier === DAILY_REQUIRED_TIER) {
        return {
            ...state,
            borderRun: {
                ...state.borderRun,
                daily: { ...state.borderRun.daily, [dateKey]: entry },
            },
        };
    }
    return {
        ...state,
        borderRun: {
            ...state.borderRun,
            dailyBonus: {
                ...state.borderRun.dailyBonus,
                [dailyBonusEntryKey(dateKey, tier)]: entry,
            },
        },
    };
}

export type BorderRunDailyStatus = "not-started" | "in-progress" | "completed";

export function countAnsweredRounds(entry: BorderRunDailyEntry): number {
    return entry.rounds.filter((round) => round.submittedPath !== null).length;
}

export function computeBorderRunStatus(
    entry: BorderRunDailyEntry,
): BorderRunDailyStatus {
    if (entry.completedAt !== null) {
        return "completed";
    }
    return countAnsweredRounds(entry) > 0 ? "in-progress" : "not-started";
}
