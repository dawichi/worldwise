import type { GeoPoint } from "./bearing";

function toRadians(degrees: number): number {
    return (degrees * Math.PI) / 180;
}

function toDegrees(radians: number): number {
    return (radians * 180) / Math.PI;
}

/** Longitude difference `to - from`, wrapped into `(-180, 180]` (the short way round). */
export function shortLongitudeDelta(fromLon: number, toLon: number): number {
    const delta = (((toLon - fromLon) % 360) + 540) % 360;
    return delta - 180 === -180 ? 180 : delta - 180;
}

/**
 * Rhumb-line bearing from `from` to `to`, in degrees `[0, 360)`: the
 * constant compass heading of the straight line joining the two places on a
 * Mercator map, taking the short way round in longitude. This is the
 * "flat-map" direction most people picture — Compass contrasts it with the
 * true great-circle bearing (`initialBearing`) at reveal time.
 */
export function rhumbBearing(from: GeoPoint, to: GeoPoint): number {
    const fromLatRad = toRadians(from.lat);
    const toLatRad = toRadians(to.lat);
    const deltaPsi = Math.log(
        Math.tan(Math.PI / 4 + toLatRad / 2) /
            Math.tan(Math.PI / 4 + fromLatRad / 2),
    );
    const deltaLonRad = toRadians(shortLongitudeDelta(from.lon, to.lon));
    return (toDegrees(Math.atan2(deltaLonRad, deltaPsi)) + 360) % 360;
}

/**
 * Points along the great circle from `from` to `to` (inclusive), by
 * spherical linear interpolation. Longitudes are *unwrapped*: each point's
 * longitude stays within 180° of the previous one, so a route that crosses
 * the antimeridian keeps going (e.g. 175 → 185) instead of jumping to -175.
 * Callers drawing on a flat map can then render one continuous line and
 * repeat the world horizontally to fill the gap.
 */
export function greatCirclePoints(
    from: GeoPoint,
    to: GeoPoint,
    segments = 64,
): GeoPoint[] {
    const phi1 = toRadians(from.lat);
    const lambda1 = toRadians(from.lon);
    const phi2 = toRadians(to.lat);
    const lambda2 = toRadians(to.lon);

    const a = [
        Math.cos(phi1) * Math.cos(lambda1),
        Math.cos(phi1) * Math.sin(lambda1),
        Math.sin(phi1),
    ] as const;
    const b = [
        Math.cos(phi2) * Math.cos(lambda2),
        Math.cos(phi2) * Math.sin(lambda2),
        Math.sin(phi2),
    ] as const;
    const dot = Math.min(
        1,
        Math.max(-1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2]),
    );
    const omega = Math.acos(dot);

    const points: GeoPoint[] = [];
    let previousLon = from.lon;
    for (let index = 0; index <= segments; index++) {
        const t = index / segments;
        let x: number;
        let y: number;
        let z: number;
        if (omega < 1e-9) {
            [x, y, z] = a;
        } else {
            const wa = Math.sin((1 - t) * omega) / Math.sin(omega);
            const wb = Math.sin(t * omega) / Math.sin(omega);
            x = wa * a[0] + wb * b[0];
            y = wa * a[1] + wb * b[1];
            z = wa * a[2] + wb * b[2];
        }
        const lat = toDegrees(Math.atan2(z, Math.hypot(x, y)));
        const rawLon = toDegrees(Math.atan2(y, x));
        const lon = previousLon + shortLongitudeDelta(previousLon, rawLon);
        previousLon = lon;
        points.push({ lat, lon });
    }
    return points;
}

/**
 * The rhumb line from `from` to `to` as two points with an unwrapped
 * destination longitude (short way round), i.e. a straight segment on a
 * Mercator map.
 */
export function rhumbLinePoints(from: GeoPoint, to: GeoPoint): GeoPoint[] {
    return [
        from,
        { lat: to.lat, lon: from.lon + shortLongitudeDelta(from.lon, to.lon) },
    ];
}
