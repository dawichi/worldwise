import type { CompassTierConfig } from "./tiers";

/**
 * Whether a candidate origin/destination pair meets Compass's fairness
 * rule for the given tier. The only rule left, now that scoring is a
 * continuous function of angular error (ADR-0008): reject pairs that are
 * too close together, since a tiny distance makes the bearing unstable
 * and the round trivially easy. The old "too close to a direction
 * boundary" rule existed only for the discrete 8-bucket answer model and
 * no longer applies.
 */
export function isValidCompassPair(
    distanceKm: number,
    config: CompassTierConfig,
): boolean {
    return distanceKm >= config.minDistanceKm;
}
