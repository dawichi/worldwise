export type Tier = "easy" | "medium" | "hard";

export interface CompassTierConfig {
    /** Angular error at or below this earns full round credit. */
    fullCreditMarginDeg: number;
    /** Angular error at or above this earns zero credit (linear taper between the two). */
    zeroCreditThresholdDeg: number;
    /** Origin/destination pairs closer than this are rejected as too easy/unstable. */
    minDistanceKm: number;
    roundsPerChallenge: number;
    maxAttemptsPerRound: number;
}

/**
 * Only `medium` is wired into UI in this milestone (it is the required
 * daily tier per ADR-0003); `easy`/`hard` exist so the tier type stays
 * exhaustive for future bonus-tier work. All four numbers per tier are
 * named constants, trivially retuned later.
 */
export const COMPASS_TIERS: Record<Tier, CompassTierConfig> = {
    easy: {
        fullCreditMarginDeg: 20,
        zeroCreditThresholdDeg: 100,
        minDistanceKm: 250,
        roundsPerChallenge: 3,
        maxAttemptsPerRound: 200,
    },
    medium: {
        fullCreditMarginDeg: 15,
        zeroCreditThresholdDeg: 90,
        minDistanceKm: 300,
        roundsPerChallenge: 3,
        maxAttemptsPerRound: 200,
    },
    hard: {
        fullCreditMarginDeg: 8,
        zeroCreditThresholdDeg: 70,
        minDistanceKm: 400,
        roundsPerChallenge: 3,
        maxAttemptsPerRound: 200,
    },
};
