export type Tier = "easy" | "medium" | "hard";

export interface ArrangeTierConfig {
    itemsPerRound: number;
    /** Min degrees of lat/lon between adjacent items in sorted order (north-to-south / west-to-east). */
    minCoordinateSeparationDeg: number;
    /** Min km between adjacent distances-from-reference (closest-to-farthest). */
    minDistanceSeparationKm: number;
    roundsPerChallenge: number;
    maxAttemptsPerRound: number;
}

/**
 * More items + tighter separation = harder, mirroring how Compass's tiers
 * tighten fullCreditMarginDeg/zeroCreditThresholdDeg. Only `medium` is wired
 * into UI this milestone (the required daily tier per ADR-0003); `easy`/
 * `hard` exist so the tier type stays exhaustive for future bonus-tier work.
 */
export const ARRANGE_TIERS: Record<Tier, ArrangeTierConfig> = {
    easy: {
        itemsPerRound: 3,
        minCoordinateSeparationDeg: 8,
        minDistanceSeparationKm: 400,
        roundsPerChallenge: 3,
        maxAttemptsPerRound: 200,
    },
    medium: {
        itemsPerRound: 4,
        minCoordinateSeparationDeg: 5,
        minDistanceSeparationKm: 300,
        roundsPerChallenge: 3,
        maxAttemptsPerRound: 200,
    },
    hard: {
        itemsPerRound: 5,
        minCoordinateSeparationDeg: 3,
        minDistanceSeparationKm: 200,
        roundsPerChallenge: 3,
        maxAttemptsPerRound: 200,
    },
};
