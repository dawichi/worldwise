import type { BorderRunTierConfig } from "./tiers";

/** Is this origin/destination pair's shortest-path hop count an appropriate
 * difficulty for the tier? */
export function isValidHopRange(
    hopCount: number,
    config: BorderRunTierConfig,
): boolean {
    return hopCount >= config.minHops && hopCount <= config.maxHops;
}

export { isValidLandRoute } from "../../geo/graph";
