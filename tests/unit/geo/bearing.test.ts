import { describe, expect, it } from "vitest";
import { initialBearing } from "../../../src/lib/geo/bearing";

describe("initialBearing", () => {
    it("computes cardinal directions exactly", () => {
        expect(
            initialBearing({ lat: 0, lon: 0 }, { lat: 10, lon: 0 }),
        ).toBeCloseTo(0, 6);
        expect(
            initialBearing({ lat: 0, lon: 0 }, { lat: -10, lon: 0 }),
        ).toBeCloseTo(180, 6);
        expect(
            initialBearing({ lat: 0, lon: 0 }, { lat: 0, lon: 10 }),
        ).toBeCloseTo(90, 6);
        expect(
            initialBearing({ lat: 0, lon: 0 }, { lat: 0, lon: -10 }),
        ).toBeCloseTo(270, 6);
    });

    it("computes a known diagonal case", () => {
        // Reference value computed independently via the standard spherical
        // bearing formula (not derived from this implementation).
        expect(
            initialBearing({ lat: 0, lon: 0 }, { lat: 10, lon: 10 }),
        ).toBeCloseTo(44.561451, 5);
    });

    it("handles crossing the antimeridian with no special-casing", () => {
        // 179°E to 179°W is a short 2° hop eastward across the dateline,
        // not the long way around — the formula's periodicity handles this
        // for free.
        expect(
            initialBearing({ lat: 0, lon: 179 }, { lat: 0, lon: -179 }),
        ).toBeCloseTo(90, 6);
        expect(
            initialBearing({ lat: 0, lon: -179 }, { lat: 0, lon: 179 }),
        ).toBeCloseTo(270, 6);
    });

    it("always returns a value in [0, 360)", () => {
        const cases: Array<[number, number, number, number]> = [
            [51.5, -0.1, 48.8, 2.3],
            [-33.9, 151.2, 40.7, -74.0],
            [35.7, 139.7, -22.9, -43.2],
        ];
        for (const [lat1, lon1, lat2, lon2] of cases) {
            const bearing = initialBearing(
                { lat: lat1, lon: lon1 },
                { lat: lat2, lon: lon2 },
            );
            expect(bearing).toBeGreaterThanOrEqual(0);
            expect(bearing).toBeLessThan(360);
        }
    });

    it("throws for a degenerate exact-pole input", () => {
        expect(() =>
            initialBearing({ lat: 90, lon: 0 }, { lat: 0, lon: 0 }),
        ).toThrow(RangeError);
        expect(() =>
            initialBearing({ lat: 0, lon: 0 }, { lat: -90, lon: 0 }),
        ).toThrow(RangeError);
    });
});
