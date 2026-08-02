import { describe, expect, it } from "vitest";
import { worldCollection } from "../../../../src/data/generated/world";
import type { Place } from "../../../../src/lib/data/places.schema";
import { bfsDistances } from "../../../../src/lib/geo/graph";
import { generateBorderRunChallenge } from "../../../../src/lib/modes/borderRun/generate";
import { BORDER_RUN_TIERS } from "../../../../src/lib/modes/borderRun/tiers";

const BASE_PARAMS = {
    challengeId:
        "worldwise:daily:v1:data-v1:2026-07-31:world:borderRun:medium",
    generatorVersion: "v1",
    dataVersion: "data-v1",
    collectionId: "world",
    tier: "medium" as const,
    places: worldCollection.places,
};

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

describe("generateBorderRunChallenge", () => {
    it("produces an identical challenge for the same seed", () => {
        const a = generateBorderRunChallenge({
            ...BASE_PARAMS,
            seed: "seed-a",
        });
        const b = generateBorderRunChallenge({
            ...BASE_PARAMS,
            seed: "seed-a",
        });
        expect(a).toEqual(b);
    });

    it("produces a different challenge for a different seed", () => {
        const a = generateBorderRunChallenge({
            ...BASE_PARAMS,
            seed: "seed-a",
        });
        const b = generateBorderRunChallenge({
            ...BASE_PARAMS,
            seed: "seed-b",
        });
        expect(a.rounds).not.toEqual(b.rounds);
    });

    it("produces the configured number of rounds", () => {
        const challenge = generateBorderRunChallenge({
            ...BASE_PARAMS,
            seed: "round-count",
        });
        expect(challenge.rounds).toHaveLength(
            BORDER_RUN_TIERS.medium.roundsPerChallenge,
        );
    });

    it("never repeats an origin/destination pair (in either direction) within a challenge", () => {
        const challenge = generateBorderRunChallenge({
            ...BASE_PARAMS,
            seed: "no-repeat-check",
        });
        const seen = new Set<string>();
        for (const round of challenge.rounds) {
            const forward = `${round.originId}|${round.destinationId}`;
            const backward = `${round.destinationId}|${round.originId}`;
            expect(seen.has(forward) || seen.has(backward)).toBe(false);
            seen.add(forward);
        }
    });

    it("every round's shortest-path hop count is within the tier's range", () => {
        const challenge = generateBorderRunChallenge({
            ...BASE_PARAMS,
            seed: "hop-range-check",
        });
        for (const round of challenge.rounds) {
            const distances = bfsDistances(
                worldCollection.places,
                round.originId,
            );
            const hopCount = distances.get(round.destinationId);
            expect(hopCount).toBeDefined();
            expect(hopCount).toBeGreaterThanOrEqual(
                BORDER_RUN_TIERS.medium.minHops,
            );
            expect(hopCount).toBeLessThanOrEqual(
                BORDER_RUN_TIERS.medium.maxHops,
            );
            expect(round.originId).not.toBe(round.destinationId);
        }
    });

    it("carries the passed-through metadata onto the challenge", () => {
        const challenge = generateBorderRunChallenge({
            ...BASE_PARAMS,
            seed: "metadata-check",
        });
        expect(challenge.id).toBe(BASE_PARAMS.challengeId);
        expect(challenge.generatorVersion).toBe("v1");
        expect(challenge.dataVersion).toBe("data-v1");
        expect(challenge.collectionId).toBe("world");
        expect(challenge.tier).toBe("medium");
    });

    it("rejects a collection with fewer than 2 places", () => {
        expect(() =>
            generateBorderRunChallenge({
                ...BASE_PARAMS,
                seed: "too-small",
                places: [place("only", [])],
            }),
        ).toThrow();
    });

    it("falls back deterministically (without throwing) when no unused pair meets the hop range", () => {
        // A 4-node chain A-B-C-D: the only pair with a hop count in medium's
        // [3,4] range is A-D (hop count 3). With 3 rounds requested, round 1
        // takes A-D; rounds 2 and 3 must fall back and legitimately re-return
        // the same pair (mirroring Compass's fallback, which also relaxes
        // the no-repeat constraint for small collections).
        const chain = [
            place("A", ["B"]),
            place("B", ["A", "C"]),
            place("C", ["B", "D"]),
            place("D", ["C"]),
        ];

        const challenge = generateBorderRunChallenge({
            ...BASE_PARAMS,
            seed: "force-fallback",
            places: chain,
        });

        expect(challenge.rounds).toHaveLength(3);
        for (const round of challenge.rounds) {
            const pair = new Set([round.originId, round.destinationId]);
            expect(pair).toEqual(new Set(["A", "D"]));
        }
    });

    it("throws when no pair in the collection can ever meet the tier's hop range", () => {
        // A 2-node chain: only possible hop count is 1, well below medium's
        // minimum of 3.
        const tooSmallChain = [place("A", ["B"]), place("B", ["A"])];
        expect(() =>
            generateBorderRunChallenge({
                ...BASE_PARAMS,
                seed: "impossible",
                places: tooSmallChain,
            }),
        ).toThrow();
    });
});
