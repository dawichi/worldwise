import type { GeoPoint } from "./bearing";

/**
 * Latitude limit for the Mercator projection. Mercator diverges at the
 * poles; ±85° is the conventional web-map cut-off and no playable capital
 * comes close to it.
 */
export const MERCATOR_MAX_LAT = 85;

function toRadians(degrees: number): number {
    return (degrees * Math.PI) / 180;
}

function toDegrees(radians: number): number {
    return (radians * 180) / Math.PI;
}

/**
 * Projects a point onto a Mercator plane measured in "degree units": `x` is
 * the longitude unchanged and `y` is the Mercator ordinate scaled so that it
 * matches longitude near the equator. `y` grows *downward* (north is
 * negative) so the result can be dropped straight into SVG coordinates.
 *
 * Mercator is used for every Worldwise map because it is the projection most
 * players carry in their heads: a straight line on it is a constant compass
 * heading (a rhumb line), which is exactly the intuition Compass's reveal
 * contrasts with the real great-circle route.
 */
export function projectMercator(point: GeoPoint): { x: number; y: number } {
    const lat = Math.max(
        -MERCATOR_MAX_LAT,
        Math.min(MERCATOR_MAX_LAT, point.lat),
    );
    const y = Math.log(Math.tan(Math.PI / 4 + toRadians(lat) / 2));
    return { x: point.lon, y: -toDegrees(y) };
}
