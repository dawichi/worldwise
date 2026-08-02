import type { PersistedState } from "../persistence/schema";
import { recordDailyCompletion } from "./streak";

/** Only modes that actually exist in code and have a persisted entry shape. */
export const ENABLED_MODE_IDS = ["compass", "arrange", "borderRun"] as const;
export type EnabledModeId = (typeof ENABLED_MODE_IDS)[number];

function isModeCompletedToday(
    state: PersistedState,
    dateKey: string,
    modeId: EnabledModeId,
): boolean {
    return state[modeId].daily[dateKey]?.completedAt != null;
}

export function countCompletedModesToday(
    state: PersistedState,
    dateKey: string,
): number {
    return ENABLED_MODE_IDS.filter((modeId) =>
        isModeCompletedToday(state, dateKey, modeId),
    ).length;
}

/** Per ADR-0002: the daily ritual is complete only once every enabled mode's required tier is done for the day. */
export function isDailyRitualComplete(
    state: PersistedState,
    dateKey: string,
): boolean {
    return countCompletedModesToday(state, dateKey) === ENABLED_MODE_IDS.length;
}

/**
 * The only thing that should ever call `recordDailyCompletion` — a mode's
 * session script calls this after marking its own entry's `completedAt`,
 * rather than advancing the streak unilaterally the moment it finishes.
 */
export function maybeRecordDailyCompletion(
    state: PersistedState,
    dateKey: string,
): PersistedState {
    if (!isDailyRitualComplete(state, dateKey)) {
        return state;
    }
    return { ...state, streak: recordDailyCompletion(state.streak, dateKey) };
}
