import { describe, expect, it } from "vitest";
import { buildDailyKey, getUtcDateKey } from "../../../src/lib/prng/dailyKey";

describe("getUtcDateKey", () => {
    it("formats a UTC date as YYYY-MM-DD", () => {
        expect(getUtcDateKey(new Date("2026-07-31T23:59:59Z"))).toBe(
            "2026-07-31",
        );
    });

    it("pads single-digit months and days", () => {
        expect(getUtcDateKey(new Date("2026-01-05T00:00:00Z"))).toBe(
            "2026-01-05",
        );
    });

    it("uses the UTC date, not a locale-shifted local date", () => {
        // 2026-01-01T00:30Z is still Jan 1 in UTC, even though it would be
        // Dec 31 in timezones west of UTC-1 — this must not leak in.
        expect(getUtcDateKey(new Date("2026-01-01T00:30:00Z"))).toBe(
            "2026-01-01",
        );
    });
});

describe("buildDailyKey", () => {
    it("matches the conceptual format from IDEA.md", () => {
        const key = buildDailyKey({
            generatorVersion: "v1",
            dataVersion: "data-v1",
            date: "2026-07-31",
            collectionId: "world",
            modeId: "compass",
            tierId: "medium",
        });
        expect(key).toBe(
            "worldwise:daily:v1:data-v1:2026-07-31:world:compass:medium",
        );
    });
});
