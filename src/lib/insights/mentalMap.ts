import { angularDelta } from "../geo/angle";
import type { GeoPoint } from "../geo/bearing";
import { shortLongitudeDelta } from "../geo/route";
import {
    type CompassAnswerRecord,
    MAX_COMPASS_ANSWER_RECORDS,
} from "../persistence/schema";

export { MAX_COMPASS_ANSWER_RECORDS } from "../persistence/schema";

const EARTH_RADIUS_KM = 6371;

/**
 * A round only says something about flat-map thinking when the flat-map
 * (rhumb) direction and the true great-circle direction are clearly
 * different. Below this gap, both readings point the same way.
 */
export const FLAT_MAP_GAP_THRESHOLD_DEG = 20;

/** Distance bands used to show where a player's mental map breaks down. */
export const DISTANCE_BANDS = [
    { id: "near", maxKm: 2000 },
    { id: "regional", maxKm: 6000 },
    { id: "far", maxKm: Number.POSITIVE_INFINITY },
] as const;

export type DistanceBandId = (typeof DISTANCE_BANDS)[number]["id"];

export function distanceBandOf(distanceKm: number): DistanceBandId {
    for (const band of DISTANCE_BANDS) {
        if (distanceKm < band.maxKm) {
            return band.id;
        }
    }
    return "far";
}

/**
 * Signed angular error from the true bearing to the chosen one, in
 * `(-180, 180]`: positive means the player's arrow sat clockwise of the
 * truth.
 */
export function signedAngularError(chosenDeg: number, trueDeg: number): number {
    const delta = (((chosenDeg - trueDeg) % 360) + 540) % 360;
    return delta - 180 === -180 ? 180 : delta - 180;
}

/** Whether a round was one where the flat map and the globe disagree. */
export function isFlatMapTrap(record: CompassAnswerRecord): boolean {
    return (
        angularDelta(record.flatBearingDeg, record.trueBearingDeg) >=
        FLAT_MAP_GAP_THRESHOLD_DEG
    );
}

/** On a flat-map trap, did the player's arrow sit closer to the flat-map
 * direction than to the true one? */
export function followedFlatMap(record: CompassAnswerRecord): boolean {
    return (
        angularDelta(record.chosenDeg, record.flatBearingDeg) <
        angularDelta(record.chosenDeg, record.trueBearingDeg)
    );
}

export interface DistanceBandSummary {
    id: DistanceBandId;
    answers: number;
    /** Mean absolute angular error, or null with no answers in the band. */
    meanErrorDeg: number | null;
}

export interface MentalMapSummary {
    answers: number;
    meanErrorDeg: number | null;
    /** Mean signed error; a clear positive/negative value is a rotational bias. */
    meanSignedErrorDeg: number | null;
    flatMapTraps: number;
    /** Of the flat-map traps, how many answers followed the flat map. */
    flatMapFollowed: number;
    bands: DistanceBandSummary[];
    destinationBiases: DestinationBias[];
}

export interface DestinationBias {
    destinationId: string;
    answers: number;
    /** Positive values mean the imagined destination is north/east of reality. */
    meanLatitudeOffsetDeg: number;
    meanLongitudeOffsetDeg: number;
}

function toRadians(degrees: number): number {
    return (degrees * Math.PI) / 180;
}

function toDegrees(radians: number): number {
    return (radians * 180) / Math.PI;
}

function wrapLongitude(degrees: number): number {
    return ((((degrees + 180) % 360) + 360) % 360) - 180;
}

/**
 * Estimate where a player's chosen bearing would place the destination if
 * they travelled the real great-circle distance from the origin. This makes
 * the profile's map a direct picture of the player's directional estimate.
 */
export function estimatedDestinationPoint(
    origin: GeoPoint,
    bearingDeg: number,
    distanceKm: number,
): GeoPoint {
    const angularDistance = distanceKm / EARTH_RADIUS_KM;
    const bearing = toRadians(bearingDeg);
    const latitude1 = toRadians(origin.lat);
    const longitude1 = toRadians(origin.lon);
    const latitude2 = Math.asin(
        Math.sin(latitude1) * Math.cos(angularDistance) +
            Math.cos(latitude1) * Math.sin(angularDistance) * Math.cos(bearing),
    );
    const longitude2 =
        longitude1 +
        Math.atan2(
            Math.sin(bearing) * Math.sin(angularDistance) * Math.cos(latitude1),
            Math.cos(angularDistance) -
                Math.sin(latitude1) * Math.sin(latitude2),
        );
    return {
        lat: toDegrees(latitude2),
        lon: wrapLongitude(toDegrees(longitude2)),
    };
}

function summarizeDestinationBiases(
    records: readonly CompassAnswerRecord[],
    places: ReadonlyMap<string, GeoPoint> | undefined,
): DestinationBias[] {
    if (!places) {
        return [];
    }
    const groups = new Map<
        string,
        { latitudeOffsets: number[]; longitudeOffsets: number[] }
    >();
    for (const record of records) {
        const origin = places.get(record.originId);
        const destination = places.get(record.destinationId);
        if (!origin || !destination) {
            continue;
        }
        const estimate = estimatedDestinationPoint(
            origin,
            record.chosenDeg,
            record.distanceKm,
        );
        const offsets = groups.get(record.destinationId) ?? {
            latitudeOffsets: [],
            longitudeOffsets: [],
        };
        offsets.latitudeOffsets.push(estimate.lat - destination.lat);
        offsets.longitudeOffsets.push(
            shortLongitudeDelta(destination.lon, estimate.lon),
        );
        groups.set(record.destinationId, offsets);
    }
    return [...groups.entries()]
        .map(([destinationId, offsets]) => ({
            destinationId,
            answers: offsets.latitudeOffsets.length,
            meanLatitudeOffsetDeg: mean(offsets.latitudeOffsets) ?? 0,
            meanLongitudeOffsetDeg: mean(offsets.longitudeOffsets) ?? 0,
        }))
        .filter((bias) => bias.answers >= 2)
        .sort((a, b) => b.answers - a.answers);
}

function mean(values: number[]): number | null {
    if (values.length === 0) {
        return null;
    }
    return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function summarizeMentalMap(
    records: readonly CompassAnswerRecord[],
    placePoints?: ReadonlyMap<string, GeoPoint>,
): MentalMapSummary {
    const traps = records.filter(isFlatMapTrap);
    return {
        answers: records.length,
        meanErrorDeg: mean(
            records.map((record) =>
                angularDelta(record.chosenDeg, record.trueBearingDeg),
            ),
        ),
        meanSignedErrorDeg: mean(
            records.map((record) =>
                signedAngularError(record.chosenDeg, record.trueBearingDeg),
            ),
        ),
        flatMapTraps: traps.length,
        flatMapFollowed: traps.filter(followedFlatMap).length,
        bands: DISTANCE_BANDS.map(({ id }) => {
            const inBand = records.filter(
                (record) => distanceBandOf(record.distanceKm) === id,
            );
            return {
                id,
                answers: inBand.length,
                meanErrorDeg: mean(
                    inBand.map((record) =>
                        angularDelta(record.chosenDeg, record.trueBearingDeg),
                    ),
                ),
            };
        }),
        destinationBiases: summarizeDestinationBiases(records, placePoints),
    };
}

/** Appends a record, keeping only the newest `MAX_COMPASS_ANSWER_RECORDS`. */
export function appendCompassAnswer(
    records: readonly CompassAnswerRecord[],
    record: CompassAnswerRecord,
): CompassAnswerRecord[] {
    return [...records, record].slice(-MAX_COMPASS_ANSWER_RECORDS);
}
