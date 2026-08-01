import { describe, expect, it } from "vitest";
import type { Place } from "../../../src/lib/data/places.schema";
import {
    bfsDistances,
    isValidLandRoute,
    shortestPath,
} from "../../../src/lib/geo/graph";

function place(id: string, landBorders: string[]): Place {
    return {
        id,
        kind: "country",
        names: { en: id, es: id },
        point: { lat: 0, lon: 0 },
        iso2: "XX",
        iso3: "XXX",
        sourceVersion: "test-fixture",
        landBorders,
    };
}

// A - B - C - D chain, plus an isolated island E with no land borders.
const CHAIN: Place[] = [
    place("A", ["B"]),
    place("B", ["A", "C"]),
    place("C", ["B", "D"]),
    place("D", ["C"]),
    place("E", []),
];

describe("bfsDistances", () => {
    it("includes the origin at distance 0", () => {
        expect(bfsDistances(CHAIN, "A").get("A")).toBe(0);
    });

    it("computes hop counts along a chain", () => {
        const distances = bfsDistances(CHAIN, "A");
        expect(distances.get("B")).toBe(1);
        expect(distances.get("C")).toBe(2);
        expect(distances.get("D")).toBe(3);
    });

    it("omits unreachable places", () => {
        const distances = bfsDistances(CHAIN, "A");
        expect(distances.has("E")).toBe(false);
    });
});

describe("shortestPath", () => {
    it("returns the full chain from one end to the other", () => {
        expect(shortestPath(CHAIN, "A", "D")).toEqual(["A", "B", "C", "D"]);
    });

    it("returns a single-element path when origin equals destination", () => {
        expect(shortestPath(CHAIN, "B", "B")).toEqual(["B"]);
    });

    it("returns null when no route exists", () => {
        expect(shortestPath(CHAIN, "A", "E")).toBeNull();
    });
});

describe("isValidLandRoute", () => {
    it("accepts a route that traverses only real land borders", () => {
        expect(isValidLandRoute(CHAIN, "A", "D", ["A", "B", "C", "D"])).toBe(
            true,
        );
    });

    it("accepts any valid route, not only the shortest one (ADR-0004: binary scoring)", () => {
        const branching: Place[] = [
            place("A", ["B", "X"]),
            place("B", ["A", "D"]),
            place("X", ["A", "Y"]),
            place("Y", ["X", "D"]),
            place("D", ["B", "Y"]),
        ];
        expect(
            isValidLandRoute(branching, "A", "D", ["A", "X", "Y", "D"]),
        ).toBe(true);
    });

    it("rejects a path that doesn't start at the origin", () => {
        expect(isValidLandRoute(CHAIN, "A", "D", ["B", "C", "D"])).toBe(false);
    });

    it("rejects a path that doesn't end at the destination", () => {
        expect(isValidLandRoute(CHAIN, "A", "D", ["A", "B", "C"])).toBe(false);
    });

    it("rejects a step between two places that don't share a land border", () => {
        expect(isValidLandRoute(CHAIN, "A", "D", ["A", "C", "D"])).toBe(false);
    });

    it("rejects a path that revisits a place", () => {
        expect(
            isValidLandRoute(CHAIN, "A", "D", ["A", "B", "A", "B", "C", "D"]),
        ).toBe(false);
    });

    it("rejects an empty path", () => {
        expect(isValidLandRoute(CHAIN, "A", "D", [])).toBe(false);
    });
});
