import type { Place } from "../../data/places.schema";
import { bfsDistances } from "../../geo/graph";
import { createPrng, type Prng } from "../../prng/prng";
import { BORDER_RUN_TIERS, type BorderRunTierConfig, type Tier } from "./tiers";
import type { BorderRunChallenge, BorderRunRound } from "./types";
import { isValidHopRange } from "./validate";

export interface GenerateBorderRunChallengeParams {
    seed: string;
    challengeId: string;
    generatorVersion: string;
    dataVersion: string;
    collectionId: string;
    tier: Tier;
    places: Place[];
}

/** Unordered-pair key, so a challenge never repeats the same origin and
 * destination even with the two swapped — mirrors Compass's pairKey tracking. */
function pairKey(a: string, b: string): string {
    return [a, b].sort().join("|");
}

function drawRound(
    prng: Prng,
    places: Place[],
    config: BorderRunTierConfig,
    usedPairKeys: ReadonlySet<string>,
): BorderRunRound | undefined {
    for (let attempt = 0; attempt < config.maxAttemptsPerRound; attempt++) {
        const origin = places[prng.nextInt(places.length)];
        if (!origin) {
            continue;
        }

        const distances = bfsDistances(places, origin.id);
        const candidates = places.filter((place) => {
            if (place.id === origin.id) {
                return false;
            }
            const hopCount = distances.get(place.id);
            if (hopCount === undefined || !isValidHopRange(hopCount, config)) {
                return false;
            }
            return !usedPairKeys.has(pairKey(origin.id, place.id));
        });

        if (candidates.length === 0) {
            continue;
        }
        const destination = candidates[prng.nextInt(candidates.length)];
        if (!destination) {
            continue;
        }
        return { originId: origin.id, destinationId: destination.id };
    }

    return undefined;
}

/**
 * Deterministic fallback when `drawRound` exhausts its attempt budget
 * (should be exceedingly rare with a graph this well-connected). Relaxes
 * the no-repeated-pair constraint (mirroring Compass's fallback) and scans
 * every place as a candidate origin in a seed-derived rotation, taking the
 * first (origin, destination) pair — in stable id order — that satisfies
 * the tier's hop range. Never falls back to `Math.random()`; throws only if
 * truly no such pair exists anywhere in the collection.
 */
function drawFallbackRound(
    prng: Prng,
    places: Place[],
    config: BorderRunTierConfig,
): BorderRunRound {
    const sorted = [...places].sort((a, b) => a.id.localeCompare(b.id));
    const n = sorted.length;
    const startOffset = prng.nextInt(n);

    for (let i = 0; i < n; i++) {
        const origin = sorted[(startOffset + i) % n];
        if (!origin) {
            continue;
        }

        const distances = bfsDistances(places, origin.id);
        const candidateIds = [...distances.entries()]
            .filter(
                ([id, hopCount]) =>
                    id !== origin.id && isValidHopRange(hopCount, config),
            )
            .map(([id]) => id)
            .sort();

        const destinationId = candidateIds[0];
        if (destinationId !== undefined) {
            return { originId: origin.id, destinationId };
        }
    }

    throw new Error(
        "drawFallbackRound: no origin/destination pair in this collection satisfies the tier's hop range",
    );
}

export function generateBorderRunChallenge(
    params: GenerateBorderRunChallengeParams,
): BorderRunChallenge {
    const {
        seed,
        challengeId,
        generatorVersion,
        dataVersion,
        collectionId,
        tier,
        places,
    } = params;
    const config = BORDER_RUN_TIERS[tier];

    if (places.length < 2) {
        throw new Error(
            "generateBorderRunChallenge: at least 2 places are required",
        );
    }

    const prng = createPrng(seed);
    const usedPairKeys = new Set<string>();
    const rounds: BorderRunRound[] = [];

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
