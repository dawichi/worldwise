import { getUtcDateKey } from "../prng/dailyKey";

export interface StreakState {
    current: number;
    longest: number;
    lastCompletedDate: string | null;
}

function getPreviousUtcDateKey(dateKey: string): string {
    const date = new Date(`${dateKey}T00:00:00Z`);
    date.setUTCDate(date.getUTCDate() - 1);
    return getUtcDateKey(date);
}

/**
 * Records that the daily ritual was completed for `todayKey` (per
 * ADR-0002, currently just Compass's required tier since it's the only
 * mode built so far). Idempotent if called again for the same day.
 * Resets to a streak of 1 if the previous completion wasn't the day
 * before `todayKey`.
 */
export function recordDailyCompletion(
    streak: StreakState,
    todayKey: string,
): StreakState {
    if (streak.lastCompletedDate === todayKey) {
        return streak;
    }

    const isConsecutive =
        streak.lastCompletedDate === getPreviousUtcDateKey(todayKey);
    const current = isConsecutive ? streak.current + 1 : 1;

    return {
        current,
        longest: Math.max(streak.longest, current),
        lastCompletedDate: todayKey,
    };
}
