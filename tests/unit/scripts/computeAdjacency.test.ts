import { describe, expect, it } from "vitest";
import {
    computeLandBorders,
    type RingSet,
} from "../../../scripts/lib/computeAdjacency";

function square(
    id: string,
    minLon: number,
    minLat: number,
    maxLon: number,
    maxLat: number,
): RingSet {
    return {
        id,
        rings: [
            [
                [minLon, minLat],
                [maxLon, minLat],
                [maxLon, maxLat],
                [minLon, maxLat],
                [minLon, minLat],
            ],
        ],
    };
}

describe("computeLandBorders", () => {
    it("marks two touching squares as adjacent", () => {
        // A spans lon [0,1], B spans lon [1,2] — they share the lon=1 edge.
        const a = square("A", 0, 0, 1, 1);
        const b = square("B", 1, 0, 2, 1);
        const borders = computeLandBorders([a, b], 1);
        expect(borders.A).toEqual(["B"]);
        expect(borders.B).toEqual(["A"]);
    });

    it("does not mark two distant squares as adjacent", () => {
        const a = square("A", 0, 0, 1, 1);
        const b = square("B", 50, 50, 51, 51);
        const borders = computeLandBorders([a, b], 1);
        expect(borders.A).toEqual([]);
        expect(borders.B).toEqual([]);
    });

    it("bridges a small gap within the threshold but not beyond it", () => {
        // B starts 0.05deg (~5.5km) east of A's edge.
        const a = square("A", 0, 0, 1, 1);
        const b = square("B", 1.05, 0, 2, 1);
        expect(computeLandBorders([a, b], 10).A).toEqual(["B"]);
        expect(computeLandBorders([a, b], 1).A).toEqual([]);
    });

    it("detects an enclave adjacent via a hole, not the exterior ring", () => {
        // D is a large square with a small square hole cut out of its middle;
        // E is a fully-enclosed enclave whose exterior exactly matches that
        // hole — D and E share a border along the hole boundary even though
        // E never comes near D's outer edge (Lesotho/South Africa, San
        // Marino/Italy in the real data).
        const holeRing: Array<[number, number]> = [
            [4, 4],
            [4, 6],
            [6, 6],
            [6, 4],
            [4, 4],
        ];
        const d: RingSet = {
            id: "D",
            rings: [
                [
                    [0, 0],
                    [10, 0],
                    [10, 10],
                    [0, 10],
                    [0, 0],
                ],
                holeRing,
            ],
        };
        const e = square("E", 4, 4, 6, 6);

        const borders = computeLandBorders([d, e], 1);
        expect(borders.D).toEqual(["E"]);
        expect(borders.E).toEqual(["D"]);
    });

    it("never marks a country adjacent to itself and is symmetric across many entries", () => {
        const a = square("A", 0, 0, 1, 1);
        const b = square("B", 1, 0, 2, 1);
        const c = square("C", 2, 0, 3, 1);
        const borders = computeLandBorders([a, b, c], 1);
        for (const [id, neighbors] of Object.entries(borders)) {
            expect(neighbors).not.toContain(id);
        }
        expect(borders.A).toEqual(["B"]);
        expect(borders.B?.slice().sort()).toEqual(["A", "C"]);
        expect(borders.C).toEqual(["B"]);
    });
});
