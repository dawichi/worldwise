import { describe, expect, it } from "vitest";
import { BORDER_RUN_TIERS } from "../../../../src/lib/modes/borderRun/tiers";
import { isValidHopRange } from "../../../../src/lib/modes/borderRun/validate";

const medium = BORDER_RUN_TIERS.medium;

describe("isValidHopRange", () => {
    it("accepts a hop count within the tier's range", () => {
        expect(isValidHopRange(3, medium)).toBe(true);
        expect(isValidHopRange(4, medium)).toBe(true);
    });

    it("rejects a hop count below the tier's minimum", () => {
        expect(isValidHopRange(2, medium)).toBe(false);
        expect(isValidHopRange(1, medium)).toBe(false);
    });

    it("rejects a hop count above the tier's maximum", () => {
        expect(isValidHopRange(5, medium)).toBe(false);
    });

    it("accepts the exact boundary values", () => {
        expect(isValidHopRange(medium.minHops, medium)).toBe(true);
        expect(isValidHopRange(medium.maxHops, medium)).toBe(true);
    });
});
