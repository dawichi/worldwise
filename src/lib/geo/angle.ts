/** Shortest angular distance between two bearings in degrees, in `[0, 180]`. */
export function angularDelta(a: number, b: number): number {
    const diff = Math.abs(a - b) % 360;
    return diff > 180 ? 360 - diff : diff;
}

/**
 * Bearing (degrees, `[0, 360)`, 0 = north) of a point at screen-space
 * offset `(dx, dy)` from a dial's center, where `dy` grows downward as it
 * does in the DOM/SVG coordinate system. Used to convert a pointer
 * position on the `CompassDial` into the angle it represents.
 */
export function bearingFromOffset(dx: number, dy: number): number {
    const radians = Math.atan2(dx, -dy);
    const degrees = (radians * 180) / Math.PI;
    return (degrees + 360) % 360;
}

const COMPASS_LABELS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"] as const;

export type CompassLabel = (typeof COMPASS_LABELS)[number];

/**
 * Names the nearest 8-point compass label for a bearing — display/feedback
 * copy only (e.g. "Correct — Southeast"). Scoring itself is a continuous
 * function of angular error (ADR-0008), not this bucket.
 */
export function bearingToCompassLabel(bearingDeg: number): CompassLabel {
    const normalized = ((bearingDeg % 360) + 360) % 360;
    const index = Math.round(normalized / 45) % 8;
    const label = COMPASS_LABELS[index];
    if (label === undefined) {
        throw new RangeError(
            `bearingToCompassLabel: computed out-of-range index ${index}`,
        );
    }
    return label;
}
