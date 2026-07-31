import { describe, expect, it } from "vitest";
import { haversineDistanceKm } from "../../../src/lib/geo/distance";

describe("haversineDistanceKm", () => {
    it("computes a known distance along the equator", () => {
        // Reference value computed independently via the standard haversine
        // formula (not derived from this implementation).
        expect(
            haversineDistanceKm({ lat: 0, lon: 0 }, { lat: 0, lon: 10 }),
        ).toBeCloseTo(1111.949266, 3);
    });

    it("is zero for identical points and symmetric for any pair", () => {
        const a = { lat: 48.8566, lon: 2.3522 };
        const b = { lat: -33.8688, lon: 151.2093 };
        expect(haversineDistanceKm(a, a)).toBeCloseTo(0, 6);
        expect(haversineDistanceKm(a, b)).toBeCloseTo(
            haversineDistanceKm(b, a),
            6,
        );
    });

    it("treats a hop across the antimeridian as short, not as the long way around", () => {
        const short = haversineDistanceKm(
            { lat: 0, lon: 179 },
            { lat: 0, lon: -179 },
        );
        const halfway = haversineDistanceKm(
            { lat: 0, lon: 0 },
            { lat: 0, lon: 180 },
        );
        expect(short).toBeCloseTo(222.389853, 3);
        expect(short).toBeLessThan(halfway / 10);
    });

    it("never returns a negative distance", () => {
        const cases: Array<[number, number, number, number]> = [
            [51.5, -0.1, 48.8, 2.3],
            [90, 0, -90, 0],
            [0, 0, 0, 0],
        ];
        for (const [lat1, lon1, lat2, lon2] of cases) {
            expect(
                haversineDistanceKm(
                    { lat: lat1, lon: lon1 },
                    { lat: lat2, lon: lon2 },
                ),
            ).toBeGreaterThanOrEqual(0);
        }
    });
});
