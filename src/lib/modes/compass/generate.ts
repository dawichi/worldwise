import type { Place } from "../../data/places.schema";
import { initialBearing } from "../../geo/bearing";
import { haversineDistanceKm } from "../../geo/distance";
import { createPrng, type Prng } from "../../prng/prng";
import { COMPASS_TIERS, type CompassTierConfig, type Tier } from "./tiers";
import type { CompassChallenge, CompassRound } from "./types";
import { isValidCompassPair } from "./validate";

export interface GenerateCompassChallengeParams {
    seed: string;
    challengeId: string;
    generatorVersion: string;
    dataVersion: string;
    collectionId: string;
    tier: Tier;
    places: Place[];
}

function getPlaceAt(places: Place[], index: number): Place {
    const place = places[index];
    if (place === undefined) {
        throw new RangeError(
            `getPlaceAt: index ${index} out of bounds for ${places.length} places`,
        );
    }
    return place;
}

function pairKey(originId: string, destinationId: string): string {
    return `${originId}|${destinationId}`;
}

function buildRound(origin: Place, destination: Place): CompassRound {
    return {
        originId: origin.id,
        destinationId: destination.id,
        bearingDeg: initialBearing(origin.point, destination.point),
        distanceKm: haversineDistanceKm(origin.point, destination.point),
    };
}

function drawRound(
    prng: Prng,
    places: Place[],
    config: CompassTierConfig,
    usedPairKeys: ReadonlySet<string>,
): CompassRound | undefined {
    for (let attempt = 0; attempt < config.maxAttemptsPerRound; attempt++) {
        const originIndex = prng.nextInt(places.length);
        const destinationIndex = prng.nextInt(places.length);
        if (originIndex === destinationIndex) {
            continue;
        }

        const origin = getPlaceAt(places, originIndex);
        const destination = getPlaceAt(places, destinationIndex);

        if (
            usedPairKeys.has(pairKey(origin.id, destination.id)) ||
            usedPairKeys.has(pairKey(destination.id, origin.id))
        ) {
            continue;
        }

        const distanceKm = haversineDistanceKm(origin.point, destination.point);
        if (!isValidCompassPair(distanceKm, config)) {
            continue;
        }

        return buildRound(origin, destination);
    }

    return undefined;
}

/**
 * Deterministic fallback when `drawRound` exhausts its attempt budget
 * (should be exceedingly rare with a dataset this size). Relaxes the
 * no-repeated-pair constraint and deterministically scans, starting from a
 * seed-derived offset, for the first pair that still meets the min-distance
 * rule. Never falls back to `Math.random()` or throws for a reasonably
 * sized, varied collection.
 */
function drawFallbackRound(
    prng: Prng,
    places: Place[],
    config: CompassTierConfig,
): CompassRound {
    const n = places.length;
    const startOffset = prng.nextInt(n);

    for (let i = 0; i < n; i++) {
        const originIndex = (startOffset + i) % n;
        for (let j = 1; j < n; j++) {
            const destinationIndex = (originIndex + j) % n;
            const origin = getPlaceAt(places, originIndex);
            const destination = getPlaceAt(places, destinationIndex);
            const distanceKm = haversineDistanceKm(
                origin.point,
                destination.point,
            );
            if (isValidCompassPair(distanceKm, config)) {
                return buildRound(origin, destination);
            }
        }
    }

    throw new Error(
        "generateCompassChallenge: no pair in this collection satisfies the tier's minimum distance",
    );
}

export function generateCompassChallenge(
    params: GenerateCompassChallengeParams,
): CompassChallenge {
    const {
        seed,
        challengeId,
        generatorVersion,
        dataVersion,
        collectionId,
        tier,
        places,
    } = params;

    if (places.length < 2) {
        throw new Error(
            "generateCompassChallenge: at least 2 places are required",
        );
    }

    const config = COMPASS_TIERS[tier];
    const prng = createPrng(seed);
    const usedPairKeys = new Set<string>();
    const rounds: CompassRound[] = [];

    for (
        let roundIndex = 0;
        roundIndex < config.roundsPerChallenge;
        roundIndex++
    ) {
        const round =
            drawRound(prng, places, config, usedPairKeys) ??
            drawFallbackRound(prng, places, config);
        usedPairKeys.add(pairKey(round.originId, round.destinationId));
        rounds.push(round);
    }

    return {
        id: challengeId,
        generatorVersion,
        dataVersion,
        collectionId,
        tier,
        rounds,
    };
}
