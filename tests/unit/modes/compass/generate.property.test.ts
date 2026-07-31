import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { worldCollection } from "../../../../src/data/generated/world";
import { generateCompassChallenge } from "../../../../src/lib/modes/compass/generate";
import {
    COMPASS_TIERS,
    type Tier,
} from "../../../../src/lib/modes/compass/tiers";

const TIERS: Tier[] = ["easy", "medium", "hard"];

describe("generateCompassChallenge (property-based, real World collection)", () => {
    it("never throws and always satisfies its invariants, across many seeds and all tiers", () => {
        fc.assert(
            fc.property(
                fc.string({ minLength: 1, maxLength: 40 }),
                fc.constantFrom(...TIERS),
                (seed, tier) => {
                    const challenge = generateCompassChallenge({
                        seed,
                        challengeId: `test:${seed}:${tier}`,
                        generatorVersion: "v1",
                        dataVersion: "data-v1",
                        collectionId: "world",
                        tier,
                        places: worldCollection.places,
                    });

                    const config = COMPASS_TIERS[tier];
                    expect(challenge.rounds).toHaveLength(
                        config.roundsPerChallenge,
                    );

                    const seenPairs = new Set<string>();
                    for (const round of challenge.rounds) {
                        expect(round.originId).not.toBe(round.destinationId);
                        expect(round.distanceKm).toBeGreaterThanOrEqual(
                            config.minDistanceKm,
                        );
                        expect(round.bearingDeg).toBeGreaterThanOrEqual(0);
                        expect(round.bearingDeg).toBeLessThan(360);

                        const forward = `${round.originId}|${round.destinationId}`;
                        const backward = `${round.destinationId}|${round.originId}`;
                        expect(
                            seenPairs.has(forward) || seenPairs.has(backward),
                        ).toBe(false);
                        seenPairs.add(forward);
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
                expect(generateCompassChallenge(params)).toEqual(
                    generateCompassChallenge(params),
                );
            }
        }
    });
});
