import type { PracticeCollectionId } from "../data/collections";
import type { PersistedState } from "../persistence/schema";
import { getUtcDateKey } from "../prng/dailyKey";
import {
    countCompletedModesToday,
    ENABLED_MODE_IDS,
    type EnabledModeId,
} from "./dailyRitual";

export interface DailyHistoryDay {
    dateKey: string;
    completedModes: number;
    totalModes: number;
}

/**
 * The last `days` UTC dates (most recent first), each with how many of
 * `ENABLED_MODE_IDS` were completed that day — the exact same check
 * `dailyRitual.ts` uses to advance the streak, not a re-derived notion of
 * "completed."
 */
export function computeDailyHistory(
    state: PersistedState,
    today: Date,
    days: number,
): DailyHistoryDay[] {
    const history: DailyHistoryDay[] = [];
    for (let offset = 0; offset < days; offset++) {
        const date = new Date(today);
        date.setUTCDate(date.getUTCDate() - offset);
        const dateKey = getUtcDateKey(date);
        history.push({
            dateKey,
            completedModes: countCompletedModesToday(state, dateKey),
            totalModes: ENABLED_MODE_IDS.length,
        });
    }
    return history;
}

export interface ModeStats {
    dailyCompletedDays: number;
    /** Percentage in [0, 100], or null if no daily mode-challenge has been completed yet. */
    dailyAccuracy: number | null;
    practiceAttempts: number;
    /** Percentage in [0, 100], or null if no practice round has been answered yet. */
    practiceAccuracy: number | null;
}

export interface StatisticsOverview {
    completedRituals: number;
    activeDays: number;
    modeCompletionRate: number;
    practiceRoundsAnswered: number;
    practiceAccuracy: number | null;
}

/** Summarizes the recent daily window and all persisted Practice activity. */
export function computeStatisticsOverview(
    state: PersistedState,
    today: Date,
    historyDays: number,
): StatisticsOverview {
    const history = computeDailyHistory(state, today, historyDays);
    const totalModeChallenges = history.reduce(
        (sum, day) => sum + day.totalModes,
        0,
    );
    const completedModeChallenges = history.reduce(
        (sum, day) => sum + day.completedModes,
        0,
    );
    const completedRituals = history.filter(
        (day) => day.completedModes === day.totalModes,
    ).length;
    const activeDays = history.filter((day) => day.completedModes > 0).length;

    let practiceRoundsAnswered = 0;
    let practiceTotalCredit = 0;
    for (const collectionId of ["world", "europe"] as const) {
        for (const modeId of ENABLED_MODE_IDS) {
            const stats = state.practice.stats[collectionId][modeId];
            practiceRoundsAnswered += stats.roundsAnswered;
            practiceTotalCredit += stats.totalCredit;
        }
    }

    return {
        completedRituals,
        activeDays,
        modeCompletionRate:
            totalModeChallenges > 0
                ? Math.round(
                      (completedModeChallenges / totalModeChallenges) * 100,
                  )
                : 0,
        practiceRoundsAnswered,
        practiceAccuracy:
            practiceRoundsAnswered > 0
                ? Math.round(
                      (practiceTotalCredit / practiceRoundsAnswered) * 100,
                  )
                : null,
    };
}

/**
 * Per-mode performance across both Daily and Practice. Daily accuracy is
 * computed the same way Practice's own accuracy already is (total round
 * credit / rounds answered, from `practice.ts`) so the two numbers mean
 * the same thing and are comparable at a glance.
 */
export function computeModeStats(
    state: PersistedState,
    modeId: EnabledModeId,
    collectionId: PracticeCollectionId = "world",
): ModeStats {
    const completedDailyEntries = Object.values(state[modeId].daily).filter(
        (entry) => entry.completedAt !== null,
    );
    const dailyRoundsAnswered = completedDailyEntries.reduce(
        (sum, entry) => sum + entry.rounds.length,
        0,
    );
    const dailyTotalCredit = completedDailyEntries.reduce(
        (sum, entry) =>
            sum +
            entry.rounds.reduce(
                (roundSum: number, round: { credit: number }) =>
                    roundSum + round.credit,
                0,
            ),
        0,
    );

    const practice = state.practice.stats[collectionId][modeId];

    return {
        dailyCompletedDays: completedDailyEntries.length,
        dailyAccuracy:
            dailyRoundsAnswered > 0
                ? Math.round((dailyTotalCredit / dailyRoundsAnswered) * 100)
                : null,
        practiceAttempts: practice.attempts,
        practiceAccuracy:
            practice.roundsAnswered > 0
                ? Math.round(
                      (practice.totalCredit / practice.roundsAnswered) * 100,
                  )
                : null,
    };
}
