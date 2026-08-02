import { describe, expect, it } from "vitest";
import {
    computeDailyHistory,
    computeModeStats,
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
                    arrange: { attempts: 3, roundsAnswered: 9, totalCredit: 6 },
                },
            },
        };

        const stats = computeModeStats(state, "arrange");
        expect(stats.practiceAttempts).toBe(3);
        expect(stats.practiceAccuracy).toBe(67);
    });
});
