import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { worldCollection } from "../../../../src/data/generated/world";
import { generateArrangeChallenge } from "../../../../src/lib/modes/arrange/generate";
import {
    ARRANGE_TIERS,
    type Tier,
} from "../../../../src/lib/modes/arrange/tiers";

const TIERS: Tier[] = ["easy", "medium", "hard"];

describe("generateArrangeChallenge (property-based, real World collection)", () => {
    it("never throws and always satisfies its invariants, across many seeds and all tiers", () => {
        fc.assert(
            fc.property(
                fc.string({ minLength: 1, maxLength: 40 }),
                fc.constantFrom(...TIERS),
                (seed, tier) => {
                    const challenge = generateArrangeChallenge({
                        seed,
                        challengeId: `test:${seed}:${tier}`,
                        generatorVersion: "v1",
                        dataVersion: "data-v1",
                        collectionId: "world",
                        tier,
                        places: worldCollection.places,
                    });

                    const config = ARRANGE_TIERS[tier];
                    expect(challenge.rounds).toHaveLength(
                        config.roundsPerChallenge,
                    );

                    const seenIds = new Set<string>();
                    for (const round of challenge.rounds) {
                        expect(round.itemIds).toHaveLength(
                            config.itemsPerRound,
                        );
                        expect([...round.itemIds].sort()).toEqual(
                            [...round.correctOrderIds].sort(),
                        );
                        expect(round.itemIds).not.toEqual(
                            round.correctOrderIds,
                        );

                        for (const id of round.itemIds) {
                            expect(seenIds.has(id)).toBe(false);
                            seenIds.add(id);
                        }
                        if (round.variant === "closest-to-farthest") {
                            expect(round.referenceId).toBeTruthy();
                            const referenceId = round.referenceId;
                            if (referenceId !== undefined) {
                                expect(seenIds.has(referenceId)).toBe(false);
                                seenIds.add(referenceId);
                            }
                        } else {
                            expect(round.referenceId).toBeUndefined();
                        }
                    }
                },
            ),
            { numRuns: 300 },
        );
    });

    it("is fully deterministic: re-running the exact same property inputs reproduces the same challenges", () => {
        const seeds = [
            "2026-07-31",
            "2026-01-01",
            "2027-12-25",
            "a",
            "🌍unicode-seed",
        ];
        for (const seed of seeds) {
            for (const tier of TIERS) {
                const params = {
                    seed,
                    challengeId: `test:${seed}:${tier}`,
                    generatorVersion: "v1",
                    dataVersion: "data-v1",
                    collectionId: "world",
                    tier,
                    places: worldCollection.places,
                };
                expect(generateArrangeChallenge(params)).toEqual(
                    generateArrangeChallenge(params),
                );
            }
        }
    });
});
