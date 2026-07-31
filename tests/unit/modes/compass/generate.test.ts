import { describe, expect, it } from "vitest";
import { worldCollection } from "../../../../src/data/generated/world";
import type { Place } from "../../../../src/lib/data/places.schema";
import { generateCompassChallenge } from "../../../../src/lib/modes/compass/generate";
import { COMPASS_TIERS } from "../../../../src/lib/modes/compass/tiers";

const BASE_PARAMS = {
    challengeId: "worldwise:daily:v1:data-v1:2026-07-31:world:compass:medium",
    generatorVersion: "v1",
    dataVersion: "data-v1",
    collectionId: "world",
    tier: "medium" as const,
    places: worldCollection.places,
};

function place(id: string, lat: number, lon: number): Place {
    return {
        id,
        kind: "country",
        names: { en: id, es: id },
        point: { lat, lon },
        iso2: "XX",
        iso3: "XXX",
        sourceVersion: "test-fixture",
    };
}

describe("generateCompassChallenge", () => {
    it("produces an identical challenge for the same seed", () => {
        const a = generateCompassChallenge({ ...BASE_PARAMS, seed: "seed-a" });
        const b = generateCompassChallenge({ ...BASE_PARAMS, seed: "seed-a" });
        expect(a).toEqual(b);
    });

    it("produces a different challenge for a different seed", () => {
        const a = generateCompassChallenge({ ...BASE_PARAMS, seed: "seed-a" });
        const b = generateCompassChallenge({ ...BASE_PARAMS, seed: "seed-b" });
        expect(a.rounds).not.toEqual(b.rounds);
    });

    it("produces the configured number of rounds", () => {
        const challenge = generateCompassChallenge({
            ...BASE_PARAMS,
            seed: "round-count",
        });
        expect(challenge.rounds).toHaveLength(
            COMPASS_TIERS.medium.roundsPerChallenge,
        );
    });

    it("never repeats an origin/destination pair (in either direction) within a challenge", () => {
        const challenge = generateCompassChallenge({
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

    it("every round meets the tier's minimum distance and has a valid bearing", () => {
        const challenge = generateCompassChallenge({
            ...BASE_PARAMS,
            seed: "distance-check",
        });
        for (const round of challenge.rounds) {
            expect(round.distanceKm).toBeGreaterThanOrEqual(
                COMPASS_TIERS.medium.minDistanceKm,
            );
            expect(round.bearingDeg).toBeGreaterThanOrEqual(0);
            expect(round.bearingDeg).toBeLessThan(360);
            expect(round.originId).not.toBe(round.destinationId);
        }
    });

    it("carries the passed-through metadata onto the challenge", () => {
        const challenge = generateCompassChallenge({
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
            generateCompassChallenge({
                ...BASE_PARAMS,
                seed: "too-small",
                places: [place("only", 0, 0)],
            }),
        ).toThrow();
    });

    it("falls back deterministically (without throwing) when no unused pair meets distance", () => {
        // Deliberately adversarial: only the A–B pair clears medium's 300km
        // minimum distance (~311.7km); C sits ~155.8km from each of them.
        // With 3 rounds requested, round 1 takes A–B; rounds 2 and 3 must
        // fall back and legitimately re-return the same pair.
        const tinyPlaces = [
            place("A", 0, 0),
            place("B", 0, 2.8),
            place("C", 0, 1.4),
        ];

        const challenge = generateCompassChallenge({
            ...BASE_PARAMS,
            seed: "force-fallback",
            places: tinyPlaces,
        });

        expect(challenge.rounds).toHaveLength(3);
        for (const round of challenge.rounds) {
            const pair = new Set([round.originId, round.destinationId]);
            expect(pair).toEqual(new Set(["A", "B"]));
            expect(round.distanceKm).toBeGreaterThanOrEqual(
                COMPASS_TIERS.medium.minDistanceKm,
            );
        }
    });

    it("throws when no pair in the collection can ever meet the tier's minimum distance", () => {
        const tooClose = [
            place("A", 0, 0),
            place("B", 0, 0.01),
            place("C", 0, 0.02),
        ];
        expect(() =>
            generateCompassChallenge({
                ...BASE_PARAMS,
                seed: "impossible",
                places: tooClose,
            }),
        ).toThrow();
    });
});
