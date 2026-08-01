import type { Place } from "../../data/places.schema";
import { haversineDistanceKm } from "../../geo/distance";
import { createPrng, type Prng } from "../../prng/prng";
import { ARRANGE_TIERS, type ArrangeTierConfig, type Tier } from "./tiers";
import type { ArrangeChallenge, ArrangeRound, ArrangeVariant } from "./types";
import {
    type DistanceRankedItem,
    isValidClosestToFarthestSet,
    isValidNorthToSouthSet,
    isValidWestToEastSet,
} from "./validate";

export interface GenerateArrangeChallengeParams {
    seed: string;
    challengeId: string;
    generatorVersion: string;
    dataVersion: string;
    collectionId: string;
    tier: Tier;
    places: Place[];
}

const VARIANTS: ArrangeVariant[] = [
    "north-to-south",
    "west-to-east",
    "closest-to-farthest",
];
const MAX_SHUFFLE_RETRIES = 10;

function shuffle<T>(prng: Prng, items: T[]): T[] {
    const result = [...items];
    for (let i = result.length - 1; i > 0; i--) {
        const j = prng.nextInt(i + 1);
        const a = result[i];
        const b = result[j];
        if (a === undefined || b === undefined) {
            throw new RangeError("shuffle: unexpected out-of-bounds index");
        }
        result[i] = b;
        result[j] = a;
    }
    return result;
}

/** Shuffles `correctOrder`, retrying (bounded) until the result differs from it — a round must never be a free win. */
function shuffleDistinctFrom(prng: Prng, correctOrder: Place[]): Place[] {
    const correctIds = correctOrder.map((place) => place.id).join("|");
    let presented = shuffle(prng, correctOrder);
    let attempts = 0;
    while (
        presented.map((place) => place.id).join("|") === correctIds &&
        attempts < MAX_SHUFFLE_RETRIES
    ) {
        presented = shuffle(prng, correctOrder);
        attempts += 1;
    }
    return presented;
}

function buildRound(
    prng: Prng,
    variant: ArrangeVariant,
    correctOrder: Place[],
    reference?: Place,
): ArrangeRound {
    const correctOrderIds = correctOrder.map((place) => place.id);
    const presented = shuffleDistinctFrom(prng, correctOrder);
    const itemIds = presented.map((place) => place.id);

    return reference
        ? { variant, itemIds, correctOrderIds, referenceId: reference.id }
        : { variant, itemIds, correctOrderIds };
}

function drawDistinctPlaces(
    prng: Prng,
    availablePlaces: Place[],
    count: number,
): Place[] {
    const pool = [...availablePlaces];
    const drawn: Place[] = [];
    for (let i = 0; i < count && pool.length > 0; i++) {
        const index = prng.nextInt(pool.length);
        const [picked] = pool.splice(index, 1);
        if (picked) {
            drawn.push(picked);
        }
    }
    return drawn;
}

function rankByDistance(
    reference: Place,
    places: Place[],
): DistanceRankedItem[] {
    return places
        .map((place) => ({
            place,
            distanceKm: haversineDistanceKm(reference.point, place.point),
        }))
        .sort((a, b) => a.distanceKm - b.distanceKm);
}

function drawRound(
    prng: Prng,
    places: Place[],
    config: ArrangeTierConfig,
    variant: ArrangeVariant,
    usedPlaceIds: ReadonlySet<string>,
): ArrangeRound | undefined {
    const availablePlaces = places.filter(
        (place) => !usedPlaceIds.has(place.id),
    );
    const neededCount =
        variant === "closest-to-farthest"
            ? config.itemsPerRound + 1
            : config.itemsPerRound;
    if (availablePlaces.length < neededCount) {
        return undefined;
    }

    for (let attempt = 0; attempt < config.maxAttemptsPerRound; attempt++) {
        const drawn = drawDistinctPlaces(prng, availablePlaces, neededCount);

        if (variant === "closest-to-farthest") {
            const [reference, ...rest] = drawn;
            if (!reference) {
                continue;
            }
            const ranked = rankByDistance(reference, rest);
            if (!isValidClosestToFarthestSet(ranked, config)) {
                continue;
            }
            return buildRound(
                prng,
                variant,
                ranked.map((item) => item.place),
                reference,
            );
        }

        if (variant === "north-to-south") {
            const sorted = [...drawn].sort((a, b) => b.point.lat - a.point.lat);
            if (!isValidNorthToSouthSet(sorted, config)) {
                continue;
            }
            return buildRound(prng, variant, sorted);
        }

        const sorted = [...drawn].sort((a, b) => a.point.lon - b.point.lon);
        if (!isValidWestToEastSet(sorted, config)) {
            continue;
        }
        return buildRound(prng, variant, sorted);
    }

    return undefined;
}

/**
 * Scans non-wrapping contiguous windows of `windowSize` over an
 * already-sorted `sorted` array — a contiguous slice of a sorted list is
 * automatically in correct order — starting from a seed-derived offset,
 * re-validating each window so fairness rules (including the west-to-east
 * antimeridian guard) are never bypassed even in this fallback path.
 */
function scanContiguousWindows<T>(
    sorted: T[],
    windowSize: number,
    prng: Prng,
    isValidWindow: (window: T[]) => boolean,
): T[] {
    const n = sorted.length;
    const maxStart = n - windowSize;
    if (maxStart < 0) {
        throw new Error(
            `scanContiguousWindows: collection has ${n} places, fewer than the ${windowSize} needed`,
        );
    }
    const startOffset = prng.nextInt(maxStart + 1);
    for (let i = 0; i <= maxStart; i++) {
        const start = (startOffset + i) % (maxStart + 1);
        const window = sorted.slice(start, start + windowSize);
        if (isValidWindow(window)) {
            return window;
        }
    }
    throw new Error(
        "scanContiguousWindows: no window in this collection satisfies the tier's separation rule",
    );
}

/**
 * Deterministic fallback when `drawRound` exhausts its attempt budget
 * (should be exceedingly rare with a dataset this size). Relaxes the
 * whole-challenge no-repeat-place constraint and deterministically scans
 * for the first valid window; never falls back to `Math.random()`.
 */
function drawFallbackRound(
    prng: Prng,
    places: Place[],
    config: ArrangeTierConfig,
    variant: ArrangeVariant,
): ArrangeRound {
    if (variant === "north-to-south") {
        const sorted = [...places].sort((a, b) => b.point.lat - a.point.lat);
        const window = scanContiguousWindows(
            sorted,
            config.itemsPerRound,
            prng,
            (w) => isValidNorthToSouthSet(w, config),
        );
        return buildRound(prng, variant, window);
    }

    if (variant === "west-to-east") {
        const sorted = [...places].sort((a, b) => a.point.lon - b.point.lon);
        const window = scanContiguousWindows(
            sorted,
            config.itemsPerRound,
            prng,
            (w) => isValidWestToEastSet(w, config),
        );
        return buildRound(prng, variant, window);
    }

    const referenceIndex = prng.nextInt(places.length);
    const reference = places[referenceIndex];
    if (reference === undefined) {
        throw new RangeError(
            "drawFallbackRound: unexpected out-of-bounds reference index",
        );
    }
    const ranked = rankByDistance(
        reference,
        places.filter((place) => place.id !== reference.id),
    );
    const window = scanContiguousWindows(
        ranked,
        config.itemsPerRound,
        prng,
        (w) => isValidClosestToFarthestSet(w, config),
    );
    return buildRound(
        prng,
        variant,
        window.map((item) => item.place),
        reference,
    );
}

export function generateArrangeChallenge(
    params: GenerateArrangeChallengeParams,
): ArrangeChallenge {
    const {
        seed,
        challengeId,
        generatorVersion,
        dataVersion,
        collectionId,
        tier,
        places,
    } = params;
    const config = ARRANGE_TIERS[tier];

    const minPlacesNeeded = config.itemsPerRound + 1; // +1 covers closest-to-farthest's reference
    if (places.length < minPlacesNeeded) {
        throw new Error(
            `generateArrangeChallenge: at least ${minPlacesNeeded} places are required`,
        );
    }

    const prng = createPrng(seed);
    const usedPlaceIds = new Set<string>();
    const rounds: ArrangeRound[] = [];

    for (
        let roundIndex = 0;
        roundIndex < config.roundsPerChallenge;
        roundIndex++
    ) {
        const variantIndex = prng.nextInt(VARIANTS.length);
        const variant = VARIANTS[variantIndex];
        if (variant === undefined) {
            throw new RangeError(
                "generateArrangeChallenge: unexpected out-of-bounds variant index",
            );
        }

        const round =
            drawRound(prng, places, config, variant, usedPlaceIds) ??
            drawFallbackRound(prng, places, config, variant);

        for (const id of round.itemIds) {
            usedPlaceIds.add(id);
        }
        if (round.referenceId) {
            usedPlaceIds.add(round.referenceId);
        }
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
