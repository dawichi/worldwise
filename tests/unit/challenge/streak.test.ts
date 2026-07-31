import { describe, expect, it } from "vitest";
import {
    recordDailyCompletion,
    type StreakState,
} from "../../../src/lib/challenge/streak";

describe("recordDailyCompletion", () => {
    it("starts a streak of 1 on the very first completion", () => {
        const initial: StreakState = {
            current: 0,
            longest: 0,
            lastCompletedDate: null,
        };
        const result = recordDailyCompletion(initial, "2026-07-31");
        expect(result).toEqual({
            current: 1,
            longest: 1,
            lastCompletedDate: "2026-07-31",
        });
    });

    it("increments the streak on a consecutive day", () => {
        const yesterday: StreakState = {
            current: 5,
            longest: 5,
            lastCompletedDate: "2026-07-30",
        };
        const result = recordDailyCompletion(yesterday, "2026-07-31");
        expect(result).toEqual({
            current: 6,
            longest: 6,
            lastCompletedDate: "2026-07-31",
        });
    });

    it("resets to 1 after a gap day", () => {
        const gapped: StreakState = {
            current: 10,
            longest: 10,
            lastCompletedDate: "2026-07-20",
        };
        const result = recordDailyCompletion(gapped, "2026-07-31");
        expect(result).toEqual({
            current: 1,
            longest: 10,
            lastCompletedDate: "2026-07-31",
        });
    });

    it("is idempotent for the same day (revisiting an already-completed today)", () => {
        const alreadyDone: StreakState = {
            current: 4,
            longest: 9,
            lastCompletedDate: "2026-07-31",
        };
        const result = recordDailyCompletion(alreadyDone, "2026-07-31");
        expect(result).toEqual(alreadyDone);
    });

    it("preserves the longest streak across a later reset", () => {
        const priorBest: StreakState = {
            current: 20,
            longest: 20,
            lastCompletedDate: "2026-01-01",
        };
        const result = recordDailyCompletion(priorBest, "2026-06-15");
        expect(result.current).toBe(1);
        expect(result.longest).toBe(20);
    });

    it("handles a month/year boundary as a consecutive day", () => {
        const yearEnd: StreakState = {
            current: 1,
            longest: 1,
            lastCompletedDate: "2026-12-31",
        };
        const result = recordDailyCompletion(yearEnd, "2027-01-01");
        expect(result).toEqual({
            current: 2,
            longest: 2,
            lastCompletedDate: "2027-01-01",
        });
    });
});
