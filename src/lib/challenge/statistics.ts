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

/**
 * Per-mode performance across both Daily and Practice. Daily accuracy is
 * computed the same way Practice's own accuracy already is (total round
 * credit / rounds answered, from `practice.ts`) so the two numbers mean
 * the same thing and are comparable at a glance.
 */
export function computeModeStats(
    state: PersistedState,
    modeId: EnabledModeId,
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

    const practice = state.practice.stats[modeId];

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
