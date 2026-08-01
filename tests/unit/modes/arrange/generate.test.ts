import { describe, expect, it } from "vitest";
import { worldCollection } from "../../../../src/data/generated/world";
import type { Place } from "../../../../src/lib/data/places.schema";
import { generateArrangeChallenge } from "../../../../src/lib/modes/arrange/generate";
import { ARRANGE_TIERS } from "../../../../src/lib/modes/arrange/tiers";

const BASE_PARAMS = {
    challengeId: "worldwise:daily:v1:data-v1:2026-07-31:world:arrange:medium",
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

describe("generateArrangeChallenge", () => {
    it("produces an identical challenge for the same seed", () => {
        const a = generateArrangeChallenge({ ...BASE_PARAMS, seed: "seed-a" });
        const b = generateArrangeChallenge({ ...BASE_PARAMS, seed: "seed-a" });
        expect(a).toEqual(b);
    });

    it("produces a different challenge for a different seed", () => {
        const a = generateArrangeChallenge({ ...BASE_PARAMS, seed: "seed-a" });
        const b = generateArrangeChallenge({ ...BASE_PARAMS, seed: "seed-b" });
        expect(a.rounds).not.toEqual(b.rounds);
    });

    it("produces the configured number of rounds", () => {
        const challenge = generateArrangeChallenge({
            ...BASE_PARAMS,
            seed: "round-count",
        });
        expect(challenge.rounds).toHaveLength(
            ARRANGE_TIERS.medium.roundsPerChallenge,
        );
    });

    it("every round's correctOrderIds is a permutation of itemIds, and the presented order is never already correct", () => {
        const challenge = generateArrangeChallenge({
            ...BASE_PARAMS,
            seed: "permutation-check",
        });
        for (const round of challenge.rounds) {
            expect([...round.itemIds].sort()).toEqual(
                [...round.correctOrderIds].sort(),
            );
            expect(round.itemIds).not.toEqual(round.correctOrderIds);
            expect(round.itemIds).toHaveLength(
                ARRANGE_TIERS.medium.itemsPerRound,
            );
        }
    });

    it("sets referenceId only for closest-to-farthest rounds", () => {
        const challenge = generateArrangeChallenge({
            ...BASE_PARAMS,
            seed: "reference-check",
        });
        for (const round of challenge.rounds) {
            if (round.variant === "closest-to-farthest") {
                expect(round.referenceId).toBeTruthy();
                expect(round.itemIds).not.toContain(round.referenceId);
            } else {
                expect(round.referenceId).toBeUndefined();
            }
        }
    });

    it("never repeats a place (including references) across the whole challenge", () => {
        const challenge = generateArrangeChallenge({
            ...BASE_PARAMS,
            seed: "no-repeat-check",
        });
        const seen = new Set<string>();
        for (const round of challenge.rounds) {
            for (const id of round.itemIds) {
                expect(seen.has(id)).toBe(false);
                seen.add(id);
            }
            if (round.referenceId) {
                expect(seen.has(round.referenceId)).toBe(false);
                seen.add(round.referenceId);
            }
        }
    });

    it("rejects a collection too small to ever produce a round", () => {
        const tooSmall = [place("a", 0, 0), place("b", 10, 10)];
        expect(() =>
            generateArrangeChallenge({
                ...BASE_PARAMS,
                seed: "too-small",
                places: tooSmall,
            }),
        ).toThrow();
    });

    it("falls back deterministically (without throwing) when too few unused places remain", () => {
        // Only 5 real, well-separated places for a tier needing 4 (or 5, for
        // closest-to-farthest) per round — round 1 consumes most or all of
        // them, forcing rounds 2 and 3 through the fallback path regardless
        // of which variant gets drawn.
        const fivePlaces = [
            place("a", 80, -60),
            place("b", 60, -30),
            place("c", 40, 0),
            place("d", 20, 30),
            place("e", 0, 60),
        ];

        const challenge = generateArrangeChallenge({
            ...BASE_PARAMS,
            seed: "force-fallback",
            places: fivePlaces,
        });

        expect(challenge.rounds).toHaveLength(3);
        const validIds = new Set(fivePlaces.map((p) => p.id));
        for (const round of challenge.rounds) {
            expect(round.itemIds).toHaveLength(
                ARRANGE_TIERS.medium.itemsPerRound,
            );
            for (const id of round.itemIds) {
                expect(validIds.has(id)).toBe(true);
            }
            expect([...round.itemIds].sort()).toEqual(
                [...round.correctOrderIds].sort(),
            );
            expect(round.itemIds).not.toEqual(round.correctOrderIds);
        }
    });

    it("throws when no window in the collection can ever satisfy the tier's separation rule", () => {
        const tooClose = [
            place("a", 0, 0),
            place("b", 0.001, 0.001),
            place("c", 0.002, 0.002),
            place("d", 0.003, 0.003),
            place("e", 0.004, 0.004),
        ];
        expect(() =>
            generateArrangeChallenge({
                ...BASE_PARAMS,
                seed: "impossible",
                places: tooClose,
            }),
        ).toThrow();
    });
});
