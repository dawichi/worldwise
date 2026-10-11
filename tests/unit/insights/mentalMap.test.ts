import { describe, expect, it } from "vitest";
import {
    appendCompassAnswer,
    distanceBandOf,
    followedFlatMap,
    isFlatMapTrap,
    MAX_COMPASS_ANSWER_RECORDS,
    signedAngularError,
    summarizeMentalMap,
} from "../../../src/lib/insights/mentalMap";
import type { CompassAnswerRecord } from "../../../src/lib/persistence/schema";

function record(
    overrides: Partial<CompassAnswerRecord> = {},
): CompassAnswerRecord {
    return {
        originId: "country:usa",
        destinationId: "country:jpn",
        chosenDeg: 270,
        trueBearingDeg: 331,
        flatBearingDeg: 266,
        distanceKm: 10900,
        answeredAt: "2026-07-30T10:00:00.000Z",
        ...overrides,
    };
}

describe("signedAngularError", () => {
    it("is positive clockwise and wraps around north", () => {
        expect(signedAngularError(10, 350)).toBe(20);
        expect(signedAngularError(350, 10)).toBe(-20);
        expect(signedAngularError(90, 90)).toBe(0);
        expect(signedAngularError(270, 90)).toBe(180);
    });
});

describe("flat-map trap detection", () => {
    it("only counts rounds where the flat map and the globe disagree", () => {
        expect(isFlatMapTrap(record())).toBe(true);
        expect(
            isFlatMapTrap(record({ trueBearingDeg: 100, flatBearingDeg: 95 })),
        ).toBe(false);
    });

    it("detects an arrow that followed the flat map", () => {
        expect(followedFlatMap(record({ chosenDeg: 270 }))).toBe(true);
        expect(followedFlatMap(record({ chosenDeg: 330 }))).toBe(false);
    });
});

describe("distanceBandOf", () => {
    it("buckets by distance", () => {
        expect(distanceBandOf(500)).toBe("near");
        expect(distanceBandOf(2000)).toBe("regional");
        expect(distanceBandOf(5999)).toBe("regional");
        expect(distanceBandOf(12000)).toBe("far");
    });
});

describe("summarizeMentalMap", () => {
    it("returns nulls for an empty history", () => {
        const summary = summarizeMentalMap([]);
        expect(summary.answers).toBe(0);
        expect(summary.meanErrorDeg).toBeNull();
        expect(summary.meanSignedErrorDeg).toBeNull();
        expect(summary.flatMapTraps).toBe(0);
        expect(summary.bands.every((band) => band.meanErrorDeg === null)).toBe(
            true,
        );
    });

    it("aggregates errors, bias, traps, and distance bands", () => {
        const summary = summarizeMentalMap([
            record({ chosenDeg: 270 }),
            record({ chosenDeg: 331 }),
            record({
                chosenDeg: 100,
                trueBearingDeg: 90,
                flatBearingDeg: 91,
                distanceKm: 800,
            }),
        ]);
        expect(summary.answers).toBe(3);
        expect(summary.meanErrorDeg).toBeCloseTo((61 + 0 + 10) / 3, 9);
        expect(summary.meanSignedErrorDeg).toBeCloseTo((-61 + 0 + 10) / 3, 9);
        expect(summary.flatMapTraps).toBe(2);
        expect(summary.flatMapFollowed).toBe(1);
        expect(summary.bands).toEqual([
            { id: "near", answers: 1, meanErrorDeg: 10 },
            { id: "regional", answers: 0, meanErrorDeg: null },
            { id: "far", answers: 2, meanErrorDeg: 30.5 },
        ]);
    });
});

describe("appendCompassAnswer", () => {
    it("keeps only the newest records", () => {
        let records: CompassAnswerRecord[] = [];
        for (let index = 0; index < MAX_COMPASS_ANSWER_RECORDS + 5; index++) {
            records = appendCompassAnswer(
                records,
                record({ distanceKm: index }),
            );
        }
        expect(records).toHaveLength(MAX_COMPASS_ANSWER_RECORDS);
        expect(records[0]?.distanceKm).toBe(5);
    });
});
