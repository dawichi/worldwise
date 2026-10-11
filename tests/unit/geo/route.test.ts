import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { angularDelta } from "../../../src/lib/geo/angle";
import { initialBearing } from "../../../src/lib/geo/bearing";
import {
    greatCirclePoints,
    rhumbBearing,
    rhumbLinePoints,
    shortLongitudeDelta,
} from "../../../src/lib/geo/route";

const washington = { lat: 38.9, lon: -77.04 };
const tokyo = { lat: 35.69, lon: 139.69 };
const madrid = { lat: 40.42, lon: -3.7 };

describe("shortLongitudeDelta", () => {
    it("takes the short way round", () => {
        expect(shortLongitudeDelta(170, -170)).toBeCloseTo(20, 9);
        expect(shortLongitudeDelta(-170, 170)).toBeCloseTo(-20, 9);
        expect(shortLongitudeDelta(-77, 139.7)).toBeCloseTo(-143.3, 9);
        expect(shortLongitudeDelta(0, 180)).toBe(180);
    });
});

describe("rhumbBearing", () => {
    it("matches cardinal directions on the equator and meridian", () => {
        expect(
            rhumbBearing({ lat: 0, lon: 0 }, { lat: 10, lon: 0 }),
        ).toBeCloseTo(0, 6);
        expect(
            rhumbBearing({ lat: 0, lon: 0 }, { lat: 0, lon: 10 }),
        ).toBeCloseTo(90, 6);
        expect(
            rhumbBearing({ lat: 0, lon: 0 }, { lat: -10, lon: 0 }),
        ).toBeCloseTo(180, 6);
        expect(
            rhumbBearing({ lat: 0, lon: 0 }, { lat: 0, lon: -10 }),
        ).toBeCloseTo(270, 6);
    });

    it("reproduces the flat-map intuition the great circle contradicts", () => {
        // On a flat map Tokyo is west of Washington and Madrid is east; the
        // great-circle departure headings are far from that.
        expect(angularDelta(rhumbBearing(washington, tokyo), 270)).toBeLessThan(
            5,
        );
        expect(
            angularDelta(initialBearing(washington, tokyo), 331),
        ).toBeLessThan(2);
        expect(angularDelta(rhumbBearing(washington, madrid), 90)).toBeLessThan(
            5,
        );
        expect(
            angularDelta(initialBearing(washington, madrid), 63),
        ).toBeLessThan(2);
    });

    it("agrees with the great-circle bearing for short hops", () => {
        fc.assert(
            fc.property(
                fc.double({ min: -60, max: 60, noNaN: true }),
                fc.double({ min: -179, max: 179, noNaN: true }),
                fc.double({ min: -0.5, max: 0.5, noNaN: true }),
                fc.double({ min: -0.5, max: 0.5, noNaN: true }),
                (lat, lon, dLat, dLon) => {
                    fc.pre(Math.abs(dLat) + Math.abs(dLon) > 0.05);
                    const from = { lat, lon };
                    const to = { lat: lat + dLat, lon: lon + dLon };
                    return (
                        angularDelta(
                            rhumbBearing(from, to),
                            initialBearing(from, to),
                        ) < 1
                    );
                },
            ),
        );
    });
});

describe("greatCirclePoints", () => {
    it("starts and ends at the endpoints", () => {
        const points = greatCirclePoints(washington, madrid, 32);
        expect(points).toHaveLength(33);
        expect(points[0]?.lat).toBeCloseTo(washington.lat, 6);
        expect(points[0]?.lon).toBeCloseTo(washington.lon, 6);
        expect(points[32]?.lat).toBeCloseTo(madrid.lat, 6);
        expect(points[32]?.lon).toBeCloseTo(madrid.lon, 6);
    });

    it("heads off along the initial bearing", () => {
        const points = greatCirclePoints(washington, tokyo, 400);
        const second = points[1];
        if (!second) throw new Error("missing point");
        expect(
            angularDelta(
                initialBearing(washington, second),
                initialBearing(washington, tokyo),
            ),
        ).toBeLessThan(0.5);
    });

    it("bulges poleward compared with the flat-map line", () => {
        const maxLat = Math.max(
            ...greatCirclePoints(washington, tokyo).map((p) => p.lat),
        );
        expect(maxLat).toBeGreaterThan(60);
    });

    it("unwraps longitude across the antimeridian", () => {
        const points = greatCirclePoints(
            { lat: -18, lon: 178 },
            { lat: -14, lon: -172 },
        );
        for (let index = 1; index < points.length; index++) {
            const previous = points[index - 1];
            const current = points[index];
            if (!previous || !current) throw new Error("missing point");
            expect(Math.abs(current.lon - previous.lon)).toBeLessThan(5);
        }
        expect(points[points.length - 1]?.lon).toBeCloseTo(188, 6);
    });
});

describe("rhumbLinePoints", () => {
    it("unwraps the destination longitude the short way", () => {
        const [, end] = rhumbLinePoints(washington, tokyo);
        expect(end?.lon).toBeCloseTo(-77.04 - 143.27, 6);
    });
});
