export type Tier = "easy" | "medium" | "hard";

export interface BorderRunTierConfig {
    /** Bounds on the shortest-path hop count between origin and destination.
     * Scoring itself is binary (ADR-0004) and never rewards optimality —
     * this only controls how far apart the generator is willing to place
     * the two places, i.e. puzzle difficulty. */
    minHops: number;
    maxHops: number;
    roundsPerChallenge: number;
    maxAttemptsPerRound: number;
}

/**
 * Wider hop ranges = harder, mirroring how Compass/Arrange's tiers tighten
 * their own separation thresholds. Only `medium` is wired into UI this
 * milestone (the required daily tier per ADR-0003); `easy`/`hard` exist so
 * the tier type stays exhaustive for future bonus-tier work. These ranges
 * are starting defaults — the World collection's actual graph
 * diameter/connectivity wasn't known until `landBorders` existed, so they
 * may need adjustment if e.g. `hard`'s upper bound proves too rare to
 * generate for many seeds.
 */
export const BORDER_RUN_TIERS: Record<Tier, BorderRunTierConfig> = {
    easy: {
        minHops: 1,
        maxHops: 2,
        roundsPerChallenge: 3,
        maxAttemptsPerRound: 200,
    },
    medium: {
        minHops: 3,
        maxHops: 4,
        roundsPerChallenge: 3,
        maxAttemptsPerRound: 200,
    },
    hard: {
        minHops: 5,
        maxHops: 7,
        roundsPerChallenge: 3,
        maxAttemptsPerRound: 200,
    },
};
