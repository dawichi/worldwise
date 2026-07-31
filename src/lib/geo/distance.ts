import type { GeoPoint } from "./bearing";

const EARTH_RADIUS_KM = 6371;

function toRadians(degrees: number): number {
    return (degrees * Math.PI) / 180;
}

/**
 * Great-circle (haversine) distance between two points, in kilometers.
 * Longitude wraparound needs no special-casing, for the same reason as
 * `initialBearing`: it depends only on the periodic sin/cos of the
 * longitude difference.
 */
export function haversineDistanceKm(from: GeoPoint, to: GeoPoint): number {
    const fromLatRad = toRadians(from.lat);
    const toLatRad = toRadians(to.lat);
    const deltaLatRad = toRadians(to.lat - from.lat);
    const deltaLonRad = toRadians(to.lon - from.lon);

    const a =
        Math.sin(deltaLatRad / 2) ** 2 +
        Math.cos(fromLatRad) *
            Math.cos(toLatRad) *
            Math.sin(deltaLonRad / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return EARTH_RADIUS_KM * c;
}
