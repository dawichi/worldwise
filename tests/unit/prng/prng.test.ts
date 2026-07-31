import { describe, expect, it } from "vitest";
import { createPrng } from "../../../src/lib/prng/prng";

describe("createPrng", () => {
    it("produces an identical sequence of draws for the same seed", () => {
        const seed =
            "worldwise:daily:v1:data-v1:2026-07-31:world:compass:medium";
        const drawsA = Array.from({ length: 50 }, () =>
            createPrng(seed).next(),
        );
        const drawsB = Array.from({ length: 50 }, () =>
            createPrng(seed).next(),
        );
        expect(drawsA).toEqual(drawsB);

        const prngA = createPrng(seed);
        const prngB = createPrng(seed);
        const sequenceA = Array.from({ length: 50 }, () => prngA.next());
        const sequenceB = Array.from({ length: 50 }, () => prngB.next());
        expect(sequenceA).toEqual(sequenceB);
    });

    it("produces a different sequence for a different seed", () => {
        const prngA = createPrng(
            "worldwise:daily:v1:data-v1:2026-07-31:world:compass:medium",
        );
        const prngB = createPrng(
            "worldwise:daily:v1:data-v1:2026-08-01:world:compass:medium",
        );
        const sequenceA = Array.from({ length: 10 }, () => prngA.next());
        const sequenceB = Array.from({ length: 10 }, () => prngB.next());
        expect(sequenceA).not.toEqual(sequenceB);
    });

    it("next() always returns a float in [0, 1)", () => {
        const prng = createPrng("bounds-check");
        for (let i = 0; i < 500; i++) {
            const value = prng.next();
            expect(value).toBeGreaterThanOrEqual(0);
            expect(value).toBeLessThan(1);
        }
    });

    it("nextInt() always returns an integer in [0, maxExclusive)", () => {
        const prng = createPrng("bounds-check-int");
        for (let i = 0; i < 500; i++) {
            const value = prng.nextInt(7);
            expect(Number.isInteger(value)).toBe(true);
            expect(value).toBeGreaterThanOrEqual(0);
            expect(value).toBeLessThan(7);
        }
    });

    it("nextInt() rejects a non-positive or non-integer bound", () => {
        const prng = createPrng("invalid-bound");
        expect(() => prng.nextInt(0)).toThrow(RangeError);
        expect(() => prng.nextInt(-3)).toThrow(RangeError);
        expect(() => prng.nextInt(2.5)).toThrow(RangeError);
    });

    it("draws vary across calls rather than repeating a constant", () => {
        const prng = createPrng("variety-check");
        const values = new Set(
            Array.from({ length: 20 }, () => prng.nextInt(1000)),
        );
        expect(values.size).toBeGreaterThan(1);
    });
});
