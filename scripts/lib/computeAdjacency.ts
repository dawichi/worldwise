/**
 * Computes a land-border adjacency graph directly from country polygon
 * geometry, so `scripts/build-world-data.ts` never needs a separate
 * adjacency data source (Natural Earth's admin-0 layer has no such field).
 * See `src/data/world/source.md` for the full methodology writeup.
 */
import { haversineDistanceKm } from "../../src/lib/geo/distance";

export interface GeoPoint {
    lat: number;
    lon: number;
}

export interface RingSet {
    id: string;
    /** Every ring — exterior *and* interior (holes) — as flat [lon, lat] point lists.
     *  Holes must be included: an enclave (e.g. Lesotho, San Marino) borders the
     *  country around it along the boundary of a hole in that country's polygon,
     *  not along its exterior ring. */
    rings: Array<Array<[number, number]>>;
}

interface AnalyzedRingSet {
    id: string;
    points: GeoPoint[];
    centroid: GeoPoint;
    /** Max distance from the centroid to any of this country's own points —
     *  together with another country's radius, bounds how close their
     *  centroids could possibly be while a point pair is still within
     *  `thresholdKm` of each other (triangle inequality). */
    radiusKm: number;
}

function analyzeRingSet(ringSet: RingSet): AnalyzedRingSet {
    const points = ringSet.rings
        .flat()
        .map(([lon, lat]) => ({ lat, lon }) satisfies GeoPoint);
    if (points.length === 0) {
        throw new Error(`analyzeRingSet: "${ringSet.id}" has no points`);
    }

    const avgLat =
        points.reduce((sum, point) => sum + point.lat, 0) / points.length;
    const avgLon =
        points.reduce((sum, point) => sum + point.lon, 0) / points.length;
    const centroid: GeoPoint = { lat: avgLat, lon: avgLon };
    const radiusKm = Math.max(
        ...points.map((point) => haversineDistanceKm(centroid, point)),
    );

    return { id: ringSet.id, points, centroid, radiusKm };
}

function minPointDistanceKm(pointsA: GeoPoint[], pointsB: GeoPoint[]): number {
    let min = Number.POSITIVE_INFINITY;
    for (const a of pointsA) {
        for (const b of pointsB) {
            const distance = haversineDistanceKm(a, b);
            if (distance < min) {
                min = distance;
                if (min === 0) {
                    return 0;
                }
            }
        }
    }
    return min;
}

/**
 * Two countries are land-adjacent if the minimum distance between any pair
 * of their boundary points (across every ring, including holes) is at most
 * `thresholdKm`. A small positive threshold (rather than requiring exact
 * point coincidence) bridges gaps introduced by Natural Earth's 1:50m
 * simplification while staying well under every real strait separating two
 * non-adjacent included countries (Gibraltar ~13 km, English Channel
 * ~33 km) — see source.md for the chosen value and validation approach.
 *
 * A centroid/radius bound (triangle inequality) prefilters pairs that
 * couldn't possibly be within `thresholdKm`, so the expensive full
 * point-to-point scan only runs for genuinely nearby candidates.
 */
export function computeLandBorders(
    countries: RingSet[],
    thresholdKm: number,
): Record<string, string[]> {
    const analyzed = countries.map(analyzeRingSet);
    const borders: Record<string, string[]> = {};
    for (const country of countries) {
        borders[country.id] = [];
    }

    for (let i = 0; i < analyzed.length; i++) {
        for (let j = i + 1; j < analyzed.length; j++) {
            const a = analyzed[i];
            const b = analyzed[j];
            if (!a || !b) {
                continue;
            }

            const centroidDistance = haversineDistanceKm(
                a.centroid,
                b.centroid,
            );
            if (centroidDistance > a.radiusKm + b.radiusKm + thresholdKm) {
                continue;
            }

            if (minPointDistanceKm(a.points, b.points) <= thresholdKm) {
                borders[a.id]?.push(b.id);
                borders[b.id]?.push(a.id);
            }
        }
    }

    return borders;
}
