import { describe, expect, it } from "vitest";
import {
    computeDailyHistory,
    computeModeStats,
    computeStatisticsOverview,
} from "../../../src/lib/challenge/statistics";
import {
    createDefaultState,
    type PersistedState,
} from "../../../src/lib/persistence/schema";

const NOW = new Date("2026-07-31T12:00:00Z");

describe("computeDailyHistory", () => {
    it("returns `days` entries, most recent first, all zeroed for a fresh state", () => {
        const history = computeDailyHistory(createDefaultState(), NOW, 5);
        expect(history).toHaveLength(5);
        expect(history[0]).toEqual({
            dateKey: "2026-07-31",
            completedModes: 0,
            totalModes: 3,
        });
        expect(history[4]).toEqual({
            dateKey: "2026-07-27",
            completedModes: 0,
            totalModes: 3,
        });
    });

    it("reflects partial and full completion for specific days", () => {
        const state: PersistedState = {
            ...createDefaultState(),
            compass: {
                daily: {
                    "2026-07-30": {
                        challengeId: "x",
                        generatorVersion: "v1",
                        dataVersion: "data-v1",
                        tier: "medium",
                        rounds: [],
                        completedAt: "2026-07-30T10:00:00.000Z",
                    },
                },
                dailyBonus: {},
            },
            arrange: {
                daily: {
                    "2026-07-30": {
                        challengeId: "y",
                        generatorVersion: "v1",
                        dataVersion: "data-v1",
                        tier: "medium",
                        rounds: [],
                        completedAt: "2026-07-30T11:00:00.000Z",
                    },
                },
                dailyBonus: {},
            },
        };

        const history = computeDailyHistory(state, NOW, 3);
        const day30 = history.find((day) => day.dateKey === "2026-07-30");
        expect(day30).toEqual({
            dateKey: "2026-07-30",
            completedModes: 2,
            totalModes: 3,
        });
        const day31 = history.find((day) => day.dateKey === "2026-07-31");
        expect(day31?.completedModes).toBe(0);
    });
});

describe("computeModeStats", () => {
    it("returns null accuracy and zero counts for a fresh state", () => {
        expect(computeModeStats(createDefaultState(), "compass")).toEqual({
            dailyCompletedDays: 0,
            dailyAccuracy: null,
            practiceAttempts: 0,
            practiceAccuracy: null,
        });
    });

    it("only counts completed daily entries, and averages round credit into a percentage", () => {
        const state: PersistedState = {
            ...createDefaultState(),
            compass: {
                daily: {
                    "2026-07-30": {
                        challengeId: "x",
                        generatorVersion: "v1",
                        dataVersion: "data-v1",
                        tier: "medium",
                        rounds: [
                            { chosenAngleDeg: 10, credit: 1 },
                            { chosenAngleDeg: 20, credit: 0.5 },
                        ],
                        completedAt: "2026-07-30T10:00:00.000Z",
                    },
                    "2026-07-31": {
                        challengeId: "z",
                        generatorVersion: "v1",
                        dataVersion: "data-v1",
                        tier: "medium",
                        rounds: [{ chosenAngleDeg: null, credit: 0 }],
                        completedAt: null,
                    },
                },
                dailyBonus: {},
            },
        };

        const stats = computeModeStats(state, "compass");
        expect(stats.dailyCompletedDays).toBe(1);
        expect(stats.dailyAccuracy).toBe(75);
    });

    it("reads practice attempts/accuracy straight from practice.stats", () => {
        const state: PersistedState = {
            ...createDefaultState(),
            practice: {
                ...createDefaultState().practice,
                stats: {
                    ...createDefaultState().practice.stats,
                    europe: {
                        ...createDefaultState().practice.stats.europe,
                        arrange: {
                            attempts: 3,
                            roundsAnswered: 9,
                            totalCredit: 6,
                        },
                    },
                },
            },
        };

        const stats = computeModeStats(state, "arrange", "europe");
        expect(stats.practiceAttempts).toBe(3);
        expect(stats.practiceAccuracy).toBe(67);
    });
});

describe("computeStatisticsOverview", () => {
    it("returns zeroed values for a fresh state", () => {
        expect(
            computeStatisticsOverview(createDefaultState(), NOW, 14),
        ).toEqual({
            completedRituals: 0,
            activeDays: 0,
            modeCompletionRate: 0,
            practiceRoundsAnswered: 0,
            practiceAccuracy: null,
        });
    });

    it("combines recent daily completion with practice totals", () => {
        const defaultState = createDefaultState();
        const state: PersistedState = {
            ...defaultState,
            compass: {
                daily: {
                    "2026-07-31": {
                        challengeId: "c",
                        generatorVersion: "v1",
                        dataVersion: "data-v1",
                        tier: "medium",
                        rounds: [],
                        completedAt: "2026-07-31T10:00:00.000Z",
                    },
                },
                dailyBonus: {},
            },
            arrange: {
                daily: {
                    "2026-07-31": {
                        challengeId: "a",
                        generatorVersion: "v1",
                        dataVersion: "data-v1",
                        tier: "medium",
                        rounds: [],
                        completedAt: "2026-07-31T10:00:00.000Z",
                    },
                },
                dailyBonus: {},
            },
            borderRun: {
                daily: {
                    "2026-07-31": {
                        challengeId: "b",
                        generatorVersion: "v1",
                        dataVersion: "data-v1",
                        tier: "medium",
                        rounds: [],
                        completedAt: null,
                    },
                },
                dailyBonus: {},
            },
            practice: {
                ...defaultState.practice,
                stats: {
                    ...defaultState.practice.stats,
                    world: {
                        ...defaultState.practice.stats.world,
                        compass: {
                            attempts: 2,
                            roundsAnswered: 6,
                            totalCredit: 4.5,
                        },
                    },
                    europe: {
                        ...defaultState.practice.stats.europe,
                        arrange: {
                            attempts: 1,
                            roundsAnswered: 3,
                            totalCredit: 3,
                        },
                    },
                },
            },
        };

        expect(computeStatisticsOverview(state, NOW, 14)).toEqual({
            completedRituals: 0,
            activeDays: 1,
            modeCompletionRate: 5,
            practiceRoundsAnswered: 9,
            practiceAccuracy: 83,
        });
    });
});
