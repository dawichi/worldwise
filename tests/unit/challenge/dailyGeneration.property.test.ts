import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { worldCollection } from "../../../src/data/generated/world";
import { resolveDailyArrange } from "../../../src/lib/challenge/dailyArrange";
import { resolveDailyBorderRun } from "../../../src/lib/challenge/dailyBorderRun";
import { resolveDailyCompass } from "../../../src/lib/challenge/dailyCompass";
import { haversineDistanceKm } from "../../../src/lib/geo/distance";
import { bfsDistances } from "../../../src/lib/geo/graph";
import { ARRANGE_TIERS, type Tier } from "../../../src/lib/modes/arrange/tiers";
import {
    isValidClosestToFarthestSet,
    isValidNorthToSouthSet,
    isValidWestToEastSet,
} from "../../../src/lib/modes/arrange/validate";
import { BORDER_RUN_TIERS } from "../../../src/lib/modes/borderRun/tiers";
import { COMPASS_TIERS } from "../../../src/lib/modes/compass/tiers";
import { isValidCompassPair } from "../../../src/lib/modes/compass/validate";
import { createDefaultState } from "../../../src/lib/persistence/schema";
import { getUtcDateKey } from "../../../src/lib/prng/dailyKey";
import { DATA_VERSION, GENERATOR_VERSION } from "../../../src/lib/versions";

const TIERS: Tier[] = ["easy", "medium", "hard"];
const placeById = new Map(
    worldCollection.places.map((place) => [place.id, place]),
);

function placeFor(id: string) {
    const place = placeById.get(id);
    if (!place) {
        throw new Error(`Missing generated place: ${id}`);
    }
    return place;
}

function dateFromDayOffset(dayOffset: number): Date {
    const base = Date.UTC(2024, 0, 1, 12);
    return new Date(base + dayOffset * 24 * 60 * 60 * 1000);
}

function assertArrangeRoundIsFair(
    round: ReturnType<
        typeof resolveDailyArrange
    >["challenge"]["rounds"][number],
    tier: Tier,
): void {
    const config = ARRANGE_TIERS[tier];
    const orderedPlaces = round.correctOrderIds.map(placeFor);

    expect(round.itemIds).toHaveLength(config.itemsPerRound);
    expect(new Set(round.itemIds).size).toBe(round.itemIds.length);
    expect(new Set(round.correctOrderIds).size).toBe(
        round.correctOrderIds.length,
    );
    expect(round.itemIds.slice().sort()).toEqual(
        round.correctOrderIds.slice().sort(),
    );
    expect(round.itemIds).not.toEqual(round.correctOrderIds);

    if (round.variant === "north-to-south") {
        expect(isValidNorthToSouthSet(orderedPlaces, config)).toBe(true);
    } else if (round.variant === "west-to-east") {
        expect(isValidWestToEastSet(orderedPlaces, config)).toBe(true);
    } else {
        const reference = round.referenceId;
        if (reference === undefined) {
            throw new Error("Closest-to-farthest round is missing referenceId");
        }
        const referencePlace = placeFor(reference);
        const ranked = orderedPlaces.map((place) => ({
            place,
            distanceKm: haversineDistanceKm(place.point, referencePlace.point),
        }));
        expect(isValidClosestToFarthestSet(ranked, config)).toBe(true);
    }
}

describe("daily generation regression invariants", () => {
    it("keeps every mode deterministic and tier-valid across dates", () => {
        fc.assert(
            fc.property(
                fc.integer({ min: -3650, max: 3650 }),
                fc.constantFrom(...TIERS),
                (dayOffset, tier) => {
                    const now = dateFromDayOffset(dayOffset);
                    const state = createDefaultState();
                    const dateKey = getUtcDateKey(now);

                    const compass = resolveDailyCompass(now, state, tier);
                    const arrange = resolveDailyArrange(now, state, tier);
                    const borderRun = resolveDailyBorderRun(now, state, tier);

                    expect(compass.dateKey).toBe(dateKey);
                    expect(arrange.dateKey).toBe(dateKey);
                    expect(borderRun.dateKey).toBe(dateKey);

                    for (const challenge of [
                        compass.challenge,
                        arrange.challenge,
                        borderRun.challenge,
                    ]) {
                        expect(challenge.id).toContain(dateKey);
                        expect(challenge.generatorVersion).toBe(
                            GENERATOR_VERSION,
                        );
                        expect(challenge.dataVersion).toBe(DATA_VERSION);
                        expect(challenge.collectionId).toBe("world");
                        expect(challenge.tier).toBe(tier);
                        expect(challenge.rounds).toHaveLength(3);
                    }

                    for (const round of compass.challenge.rounds) {
                        expect(
                            isValidCompassPair(
                                round.distanceKm,
                                COMPASS_TIERS[tier],
                            ),
                        ).toBe(true);
                        expect(round.originId).not.toBe(round.destinationId);
                    }

                    for (const round of arrange.challenge.rounds) {
                        assertArrangeRoundIsFair(round, tier);
                    }

                    for (const round of borderRun.challenge.rounds) {
                        const distances = bfsDistances(
                            worldCollection.places,
                            round.originId,
                        );
                        const hopCount = distances.get(round.destinationId);
                        expect(hopCount).toBeDefined();
                        expect(hopCount).toBeGreaterThanOrEqual(
                            BORDER_RUN_TIERS[tier].minHops,
                        );
                        expect(hopCount).toBeLessThanOrEqual(
                            BORDER_RUN_TIERS[tier].maxHops,
                        );
                        expect(round.originId).not.toBe(round.destinationId);
                    }

                    expect(
                        resolveDailyCompass(now, state, tier).challenge,
                    ).toEqual(compass.challenge);
                    expect(
                        resolveDailyArrange(now, state, tier).challenge,
                    ).toEqual(arrange.challenge);
                    expect(
                        resolveDailyBorderRun(now, state, tier).challenge,
                    ).toEqual(borderRun.challenge);
                },
            ),
            { numRuns: 40 },
        );
    });
});
