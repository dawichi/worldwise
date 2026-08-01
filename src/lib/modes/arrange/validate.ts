import type { Place } from "../../data/places.schema";
import type { ArrangeTierConfig } from "./tiers";

function pairwiseGaps<T>(sorted: T[], gapOf: (a: T, b: T) => number): number[] {
    const gaps: number[] = [];
    for (let i = 0; i < sorted.length - 1; i++) {
        const a = sorted[i];
        const b = sorted[i + 1];
        if (a === undefined || b === undefined) {
            throw new RangeError(
                "pairwiseGaps: unexpected out-of-bounds index",
            );
        }
        gaps.push(gapOf(a, b));
    }
    return gaps;
}

/** `sortedDescByLat` must already be sorted north (high latitude) to south (low). */
export function isValidNorthToSouthSet(
    sortedDescByLat: Place[],
    config: ArrangeTierConfig,
): boolean {
    return pairwiseGaps(
        sortedDescByLat,
        (a, b) => a.point.lat - b.point.lat,
    ).every((gap) => gap >= config.minCoordinateSeparationDeg);
}

/** `sortedAscByLon` must already be sorted west (low longitude) to east (high). */
export function isValidWestToEastSet(
    sortedAscByLon: Place[],
    config: ArrangeTierConfig,
): boolean {
    const longitudes = sortedAscByLon.map((place) => place.point.lon);
    const maxLon = Math.max(...longitudes);
    const minLon = Math.min(...longitudes);
    // A candidate set spanning half the globe or more signals the naive
    // ascending-longitude order is geometrically ambiguous — it likely
    // "actually" wraps the short way across the antimeridian instead.
    if (maxLon - minLon >= 180) {
        return false;
    }
    return pairwiseGaps(
        sortedAscByLon,
        (a, b) => b.point.lon - a.point.lon,
    ).every((gap) => gap >= config.minCoordinateSeparationDeg);
}

export interface DistanceRankedItem {
    place: Place;
    distanceKm: number;
}

/** `sortedAscByDistance` must already be sorted closest to farthest from the reference. */
export function isValidClosestToFarthestSet(
    sortedAscByDistance: DistanceRankedItem[],
    config: ArrangeTierConfig,
): boolean {
    const nearest = sortedAscByDistance[0];
    if (nearest === undefined) {
        throw new RangeError("isValidClosestToFarthestSet: empty set");
    }
    if (nearest.distanceKm < config.minDistanceSeparationKm) {
        return false;
    }
    return pairwiseGaps(
        sortedAscByDistance,
        (a, b) => b.distanceKm - a.distanceKm,
    ).every((gap) => gap >= config.minDistanceSeparationKm);
}
