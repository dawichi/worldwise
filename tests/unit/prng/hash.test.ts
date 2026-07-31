import { describe, expect, it } from "vitest";
import { xmur3 } from "../../../src/lib/prng/hash";

describe("xmur3", () => {
    it("produces the same sequence for the same seed string", () => {
        const seqA = Array.from(
            { length: 5 },
            xmur3("worldwise:daily:v1:data-v1:2026-07-31:world:compass:medium"),
        );
        const seqB = Array.from(
            { length: 5 },
            xmur3("worldwise:daily:v1:data-v1:2026-07-31:world:compass:medium"),
        );
        expect(seqA).toEqual(seqB);
    });

    it("produces a different first value for a different seed string", () => {
        const a = xmur3(
            "worldwise:daily:v1:data-v1:2026-07-31:world:compass:medium",
        )();
        const b = xmur3(
            "worldwise:daily:v1:data-v1:2026-08-01:world:compass:medium",
        )();
        expect(a).not.toBe(b);
    });

    it("is sensitive to every component of a daily-key-shaped string", () => {
        const base =
            "worldwise:daily:v1:data-v1:2026-07-31:world:compass:medium";
        const variants = [
            "worldwise:daily:v2:data-v1:2026-07-31:world:compass:medium",
            "worldwise:daily:v1:data-v2:2026-07-31:world:compass:medium",
            "worldwise:daily:v1:data-v1:2026-08-01:world:compass:medium",
            "worldwise:daily:v1:data-v1:2026-07-31:europe:compass:medium",
            "worldwise:daily:v1:data-v1:2026-07-31:world:arrange:medium",
            "worldwise:daily:v1:data-v1:2026-07-31:world:compass:hard",
        ];
        const baseValue = xmur3(base)();
        for (const variant of variants) {
            expect(xmur3(variant)()).not.toBe(baseValue);
        }
    });

    it("returns a different value on each successive call for the same instance", () => {
        const next = xmur3("some-seed");
        const values = new Set([next(), next(), next(), next()]);
        expect(values.size).toBe(4);
    });

    it("returns unsigned 32-bit integers", () => {
        const next = xmur3("some-seed");
        for (let i = 0; i < 20; i++) {
            const value = next();
            expect(Number.isInteger(value)).toBe(true);
            expect(value).toBeGreaterThanOrEqual(0);
            expect(value).toBeLessThanOrEqual(0xffffffff);
        }
    });
});
