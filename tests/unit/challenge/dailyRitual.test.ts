import { describe, expect, it } from "vitest";
import {
    countCompletedModesToday,
    ENABLED_MODE_IDS,
    isDailyRitualComplete,
    maybeRecordDailyCompletion,
} from "../../../src/lib/challenge/dailyRitual";
import {
    createDefaultState,
    type PersistedState,
} from "../../../src/lib/persistence/schema";

const DATE_KEY = "2026-07-31";

function withCompassDone(
    state: PersistedState,
    dateKey: string,
): PersistedState {
    return {
        ...state,
        compass: {
            daily: {
                [dateKey]: {
                    challengeId: "x",
                    generatorVersion: "v1",
                    dataVersion: "data-v1",
                    tier: "medium",
                    rounds: [],
                    completedAt: "2026-07-31T10:00:00.000Z",
                },
            },
        },
    };
}

function withArrangeDone(
    state: PersistedState,
    dateKey: string,
): PersistedState {
    return {
        ...state,
        arrange: {
            daily: {
                [dateKey]: {
                    challengeId: "y",
                    generatorVersion: "v1",
                    dataVersion: "data-v1",
                    tier: "medium",
                    rounds: [],
                    completedAt: "2026-07-31T11:00:00.000Z",
                },
            },
        },
    };
}

function withBorderRunDone(
    state: PersistedState,
    dateKey: string,
): PersistedState {
    return {
        ...state,
        borderRun: {
            daily: {
                [dateKey]: {
                    challengeId: "z",
                    generatorVersion: "v1",
                    dataVersion: "data-v1",
                    tier: "medium",
                    rounds: [],
                    completedAt: "2026-07-31T12:00:00.000Z",
                },
            },
        },
    };
}

describe("ENABLED_MODE_IDS", () => {
    it("only lists modes that actually exist in code", () => {
        expect(ENABLED_MODE_IDS).toEqual(["compass", "arrange", "borderRun"]);
    });
});

describe("countCompletedModesToday / isDailyRitualComplete", () => {
    it("counts zero and is incomplete when no mode is done", () => {
        const state = createDefaultState();
        expect(countCompletedModesToday(state, DATE_KEY)).toBe(0);
        expect(isDailyRitualComplete(state, DATE_KEY)).toBe(false);
    });

    it("counts one and is incomplete when only Compass is done", () => {
        const state = withCompassDone(createDefaultState(), DATE_KEY);
        expect(countCompletedModesToday(state, DATE_KEY)).toBe(1);
        expect(isDailyRitualComplete(state, DATE_KEY)).toBe(false);
    });

    it("counts one and is incomplete when only Arrange is done", () => {
        const state = withArrangeDone(createDefaultState(), DATE_KEY);
        expect(countCompletedModesToday(state, DATE_KEY)).toBe(1);
        expect(isDailyRitualComplete(state, DATE_KEY)).toBe(false);
    });

    it("counts two and is incomplete when only two of three modes are done", () => {
        const state = withArrangeDone(
            withCompassDone(createDefaultState(), DATE_KEY),
            DATE_KEY,
        );
        expect(countCompletedModesToday(state, DATE_KEY)).toBe(2);
        expect(isDailyRitualComplete(state, DATE_KEY)).toBe(false);
    });

    it("counts three and is complete once every mode is done", () => {
        const state = withBorderRunDone(
            withArrangeDone(
                withCompassDone(createDefaultState(), DATE_KEY),
                DATE_KEY,
            ),
            DATE_KEY,
        );
        expect(countCompletedModesToday(state, DATE_KEY)).toBe(3);
        expect(isDailyRitualComplete(state, DATE_KEY)).toBe(true);
    });

    it("does not count a different day's completion", () => {
        const state = withCompassDone(createDefaultState(), "2026-07-30");
        expect(isDailyRitualComplete(state, DATE_KEY)).toBe(false);
    });
});

describe("maybeRecordDailyCompletion", () => {
    it("does not touch the streak when only one mode is done", () => {
        const state = withCompassDone(createDefaultState(), DATE_KEY);
        const result = maybeRecordDailyCompletion(state, DATE_KEY);
        expect(result.streak).toEqual(state.streak);
    });

    it("does not touch the streak when only two of three modes are done", () => {
        const state = withArrangeDone(
            withCompassDone(createDefaultState(), DATE_KEY),
            DATE_KEY,
        );
        const result = maybeRecordDailyCompletion(state, DATE_KEY);
        expect(result.streak).toEqual(state.streak);
    });

    it("advances the streak exactly once every mode is done", () => {
        const state = withBorderRunDone(
            withArrangeDone(
                withCompassDone(createDefaultState(), DATE_KEY),
                DATE_KEY,
            ),
            DATE_KEY,
        );
        const result = maybeRecordDailyCompletion(state, DATE_KEY);
        expect(result.streak).toEqual({
            current: 1,
            longest: 1,
            lastCompletedDate: DATE_KEY,
        });
    });

    it("is idempotent: calling it again the same day does not double-increment", () => {
        const state = withBorderRunDone(
            withArrangeDone(
                withCompassDone(createDefaultState(), DATE_KEY),
                DATE_KEY,
            ),
            DATE_KEY,
        );
        const once = maybeRecordDailyCompletion(state, DATE_KEY);
        const twice = maybeRecordDailyCompletion(once, DATE_KEY);
        expect(twice.streak).toEqual(once.streak);
    });
});
