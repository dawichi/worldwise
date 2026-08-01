import { describe, expect, it } from "vitest";
import type { Place } from "../../../../src/lib/data/places.schema";
import { ARRANGE_TIERS } from "../../../../src/lib/modes/arrange/tiers";
import {
    isValidClosestToFarthestSet,
    isValidNorthToSouthSet,
    isValidWestToEastSet,
} from "../../../../src/lib/modes/arrange/validate";

const medium = ARRANGE_TIERS.medium;

function place(id: string, lat: number, lon: number): Place {
    return {
        id,
        kind: "country",
        names: { en: id, es: id },
        point: { lat, lon },
        iso2: "XX",
        iso3: "XXX",
        sourceVersion: "test-fixture",
        landBorders: [],
    };
}

describe("isValidNorthToSouthSet", () => {
    it("accepts a well-separated descending-latitude set", () => {
        const set = [
            place("a", 60, 0),
            place("b", 45, 0),
            place("c", 30, 0),
            place("d", 15, 0),
        ];
        expect(isValidNorthToSouthSet(set, medium)).toBe(true);
    });

    it("rejects a set with two adjacent items too close in latitude", () => {
        const set = [
            place("a", 60, 0),
            place("b", 45, 0),
            place("c", 44, 0),
            place("d", 15, 0),
        ];
        expect(isValidNorthToSouthSet(set, medium)).toBe(false);
    });

    it("accepts a two-item set with enough separation", () => {
        expect(
            isValidNorthToSouthSet(
                [place("a", 60, 0), place("b", 10, 0)],
                medium,
            ),
        ).toBe(true);
    });
});

describe("isValidWestToEastSet", () => {
    it("accepts a well-separated ascending-longitude set", () => {
        const set = [
            place("a", 0, -60),
            place("b", 0, -30),
            place("c", 0, 0),
            place("d", 0, 30),
        ];
        expect(isValidWestToEastSet(set, medium)).toBe(true);
    });

    it("rejects a set with two adjacent items too close in longitude", () => {
        const set = [
            place("a", 0, -60),
            place("b", 0, -30),
            place("c", 0, -29),
            place("d", 0, 30),
        ];
        expect(isValidWestToEastSet(set, medium)).toBe(false);
    });

    it("rejects a set that spans the antimeridian ambiguously", () => {
        const set = [
            place("a", 0, -179),
            place("b", 0, -90),
            place("c", 0, 0),
            place("d", 0, 179),
        ];
        expect(isValidWestToEastSet(set, medium)).toBe(false);
    });

    it("accepts a legitimately wide but non-ambiguous set (< 180 span)", () => {
        const set = [
            place("a", 0, -89),
            place("b", 0, -30),
            place("c", 0, 30),
            place("d", 0, 89),
        ];
        expect(isValidWestToEastSet(set, medium)).toBe(true);
    });
});

describe("isValidClosestToFarthestSet", () => {
    it("accepts a well-separated ascending-distance set", () => {
        const set = [
            { place: place("a", 0, 0), distanceKm: 400 },
            { place: place("b", 0, 0), distanceKm: 800 },
            { place: place("c", 0, 0), distanceKm: 1300 },
        ];
        expect(isValidClosestToFarthestSet(set, medium)).toBe(true);
    });

    it("rejects when the nearest item is too close to the reference", () => {
        const set = [
            { place: place("a", 0, 0), distanceKm: 50 },
            { place: place("b", 0, 0), distanceKm: 800 },
        ];
        expect(isValidClosestToFarthestSet(set, medium)).toBe(false);
    });

    it("rejects when two adjacent distances are too close together", () => {
        const set = [
            { place: place("a", 0, 0), distanceKm: 400 },
            { place: place("b", 0, 0), distanceKm: 420 },
            { place: place("c", 0, 0), distanceKm: 1300 },
        ];
        expect(isValidClosestToFarthestSet(set, medium)).toBe(false);
    });
});
