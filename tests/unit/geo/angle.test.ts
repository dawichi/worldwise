import { describe, expect, it } from "vitest";
import {
    angularDelta,
    bearingToCompassLabel,
} from "../../../src/lib/geo/angle";

describe("angularDelta", () => {
    it("handles wraparound across 0/360 as the short way", () => {
        expect(angularDelta(350, 10)).toBeCloseTo(20, 9);
        expect(angularDelta(10, 350)).toBeCloseTo(20, 9);
    });

    it("is symmetric", () => {
        expect(angularDelta(30, 200)).toBeCloseTo(angularDelta(200, 30), 9);
    });

    it("returns 0 for identical angles and 180 for opposite angles", () => {
        expect(angularDelta(45, 45)).toBeCloseTo(0, 9);
        expect(angularDelta(0, 180)).toBeCloseTo(180, 9);
    });

    it("never exceeds 180", () => {
        for (let a = 0; a < 360; a += 37) {
            for (let b = 0; b < 360; b += 53) {
                expect(angularDelta(a, b)).toBeLessThanOrEqual(180);
                expect(angularDelta(a, b)).toBeGreaterThanOrEqual(0);
            }
        }
    });
});

describe("bearingToCompassLabel", () => {
    it("names the 8 exact compass points", () => {
        expect(bearingToCompassLabel(0)).toBe("N");
        expect(bearingToCompassLabel(45)).toBe("NE");
        expect(bearingToCompassLabel(90)).toBe("E");
        expect(bearingToCompassLabel(135)).toBe("SE");
        expect(bearingToCompassLabel(180)).toBe("S");
        expect(bearingToCompassLabel(225)).toBe("SW");
        expect(bearingToCompassLabel(270)).toBe("W");
        expect(bearingToCompassLabel(315)).toBe("NW");
    });

    it("rounds a near-boundary bearing to the nearest label", () => {
        expect(bearingToCompassLabel(21)).toBe("N");
        expect(bearingToCompassLabel(24)).toBe("NE");
    });

    it("wraps 360 back to N", () => {
        expect(bearingToCompassLabel(360)).toBe("N");
        expect(bearingToCompassLabel(-45)).toBe("NW");
    });
});
