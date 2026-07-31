import { describe, expect, it } from "vitest";
import { worldCollection } from "../../../src/data/generated/world";
import { collectionSchema } from "../../../src/lib/data/collections.schema";

describe("worldCollection (generated data)", () => {
    it("validates against the collection schema", () => {
        expect(() => collectionSchema.parse(worldCollection)).not.toThrow();
    });

    it("has a plausible number of real sovereign countries", () => {
        // Bounds, not a pinned count: real-world country counts shift
        // slightly as data sources update, but this range catches a
        // badly broken filter (e.g. only a handful, or thousands).
        expect(worldCollection.places.length).toBeGreaterThan(150);
        expect(worldCollection.places.length).toBeLessThan(210);
    });

    it("has no duplicate place IDs or ISO codes", () => {
        const ids = worldCollection.places.map((place) => place.id);
        const iso2s = worldCollection.places.map((place) => place.iso2);
        expect(new Set(ids).size).toBe(ids.length);
        expect(new Set(iso2s).size).toBe(iso2s.length);
    });

    it("every place has both English and Spanish names", () => {
        for (const place of worldCollection.places) {
            expect(place.names.en.length).toBeGreaterThan(0);
            expect(place.names.es.length).toBeGreaterThan(0);
        }
    });

    it("every coordinate is a real, non-degenerate point", () => {
        for (const place of worldCollection.places) {
            expect(place.point.lat).toBeGreaterThan(-90);
            expect(place.point.lat).toBeLessThan(90);
            expect(place.point.lon).toBeGreaterThanOrEqual(-180);
            expect(place.point.lon).toBeLessThanOrEqual(180);
            expect(place.point.lat === 0 && place.point.lon === 0).toBe(false);
        }
    });

    it("declares Compass as a supported mode", () => {
        expect(worldCollection.supportedModes).toContain("compass");
    });
});
