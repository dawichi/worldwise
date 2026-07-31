export interface GeoPoint {
    lat: number;
    lon: number;
}

function toRadians(degrees: number): number {
    return (degrees * Math.PI) / 180;
}

function toDegrees(radians: number): number {
    return (radians * 180) / Math.PI;
}

/**
 * Initial great-circle bearing from `from` to `to`, in degrees `[0, 360)`
 * where 0 is north. Longitude wraparound (the antimeridian) needs no
 * special-casing: the formula only depends on sin/cos of the longitude
 * *difference*, which is already periodic.
 *
 * Throws for a point at exactly a geographic pole (`|lat| === 90`), where
 * bearing is undefined (every direction from a pole is the same cardinal
 * direction). Real place data should never reach this — `places.schema.ts`
 * rejects exact-pole coordinates at the data boundary — so this is a
 * defensive guard against degenerate input, not a case generation needs to
 * handle.
 */
export function initialBearing(from: GeoPoint, to: GeoPoint): number {
    if (Math.abs(from.lat) === 90 || Math.abs(to.lat) === 90) {
        throw new RangeError(
            "initialBearing: bearing is undefined at an exact geographic pole (|lat| === 90)",
        );
    }

    const fromLatRad = toRadians(from.lat);
    const toLatRad = toRadians(to.lat);
    const deltaLonRad = toRadians(to.lon - from.lon);

    const y = Math.sin(deltaLonRad) * Math.cos(toLatRad);
    const x =
        Math.cos(fromLatRad) * Math.sin(toLatRad) -
        Math.sin(fromLatRad) * Math.cos(toLatRad) * Math.cos(deltaLonRad);

    const bearingRad = Math.atan2(y, x);
    return (toDegrees(bearingRad) + 360) % 360;
}
