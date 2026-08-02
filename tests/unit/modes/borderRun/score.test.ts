import { describe, expect, it } from "vitest";
import type { Place } from "../../../../src/lib/data/places.schema";
import {
    scoreBorderRunChallenge,
    scoreBorderRunRound,
} from "../../../../src/lib/modes/borderRun/score";
import type { BorderRunRound } from "../../../../src/lib/modes/borderRun/types";

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

// A-B-C-D chain, plus an isolated E with no borders.
const places: Place[] = [
    place("A", ["B"]),
    place("B", ["A", "C"]),
    place("C", ["B", "D"]),
    place("D", ["C"]),
    place("E", []),
];

describe("scoreBorderRunRound", () => {
    const round: BorderRunRound = { originId: "A", destinationId: "D" };

    it("gives full credit for a valid land route", () => {
        expect(scoreBorderRunRound(places, round, ["A", "B", "C", "D"])).toBe(
            1,
        );
    });

    it("gives zero credit for a route that skips a required hop", () => {
        expect(scoreBorderRunRound(places, round, ["A", "D"])).toBe(0);
    });

    it("gives zero credit for a route through a place with no shared border", () => {
        expect(
            scoreBorderRunRound(places, round, ["A", "B", "C", "E", "D"]),
        ).toBe(0);
    });

    it("gives zero credit for an empty submission", () => {
        expect(scoreBorderRunRound(places, round, [])).toBe(0);
    });
});

describe("scoreBorderRunChallenge", () => {
    const rounds: BorderRunRound[] = [
        { originId: "A", destinationId: "C" },
        { originId: "B", destinationId: "D" },
    ];

    it("sums per-round credit across the whole challenge", () => {
        const total = scoreBorderRunChallenge(places, rounds, [
            ["A", "B", "C"], // valid
            ["B", "A"], // invalid, doesn't reach D
        ]);
        expect(total).toBe(1);
    });

    it("throws if the submitted-path count does not match the round count", () => {
        expect(() =>
            scoreBorderRunChallenge(places, rounds, [["A", "B", "C"]]),
        ).toThrow(RangeError);
    });
});
