import { worldCollection } from "../../data/generated/world";
import { generateCompassChallenge } from "../modes/compass/generate";
import type { CompassChallenge } from "../modes/compass/types";
import type { CompassDailyEntry, PersistedState } from "../persistence/schema";
import { buildDailyKey, getUtcDateKey } from "../prng/dailyKey";
import { DATA_VERSION, GENERATOR_VERSION } from "../versions";
import {
    DAILY_REQUIRED_TIER,
    type DailyTier,
    dailyBonusEntryKey,
} from "./dailyTier";

const COLLECTION_ID = "world";
const MODE_ID = "compass";

export interface DailyCompassContext {
    dateKey: string;
    tier: DailyTier;
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
    tier: DailyTier = DAILY_REQUIRED_TIER,
): DailyCompassContext {
    const dateKey = getUtcDateKey(now);
    const seed = buildDailyKey({
        generatorVersion: GENERATOR_VERSION,
        dataVersion: DATA_VERSION,
        date: dateKey,
        collectionId: COLLECTION_ID,
        modeId: MODE_ID,
        tierId: tier,
    });

    const challenge = generateCompassChallenge({
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
            ? (state.compass.daily[dateKey] ?? createEntry(challenge))
            : (state.compass.dailyBonus[dailyBonusEntryKey(dateKey, tier)] ??
              createEntry(challenge));

    return { dateKey, tier, challenge, entry };
}

/** Writes `entry` back to the map matching `tier` — required stays in `daily`, bonus goes in `dailyBonus`. */
export function withCompassDailyEntry(
    state: PersistedState,
    dateKey: string,
    tier: DailyTier,
    entry: CompassDailyEntry,
): PersistedState {
    if (tier === DAILY_REQUIRED_TIER) {
        return {
            ...state,
            compass: {
                ...state.compass,
                daily: { ...state.compass.daily, [dateKey]: entry },
            },
        };
    }
    return {
        ...state,
        compass: {
            ...state.compass,
            dailyBonus: {
                ...state.compass.dailyBonus,
                [dailyBonusEntryKey(dateKey, tier)]: entry,
            },
        },
    };
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
