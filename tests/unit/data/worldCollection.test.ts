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

    it("declares Compass, Arrange, and Border Run as supported modes", () => {
        expect(worldCollection.supportedModes).toContain("compass");
        expect(worldCollection.supportedModes).toContain("arrange");
        expect(worldCollection.supportedModes).toContain("borderRun");
    });
});

describe("worldCollection landBorders (Border Run adjacency)", () => {
    function idFor(nameEn: string): string {
        const place = worldCollection.places.find(
            (candidate) => candidate.names.en === nameEn,
        );
        if (!place) {
            throw new Error(`fixture place "${nameEn}" not found`);
        }
        return place.id;
    }

    function bordersOf(nameEn: string): string[] {
        const place = worldCollection.places.find(
            (candidate) => candidate.names.en === nameEn,
        );
        if (!place) {
            throw new Error(`fixture place "${nameEn}" not found`);
        }
        return place.landBorders;
    }

    it("is symmetric: if A borders B, B borders A", () => {
        for (const place of worldCollection.places) {
            for (const neighborId of place.landBorders) {
                const neighbor = worldCollection.places.find(
                    (candidate) => candidate.id === neighborId,
                );
                expect(neighbor).toBeDefined();
                expect(neighbor?.landBorders).toContain(place.id);
            }
        }
    });

    it("never lists a place as its own neighbor", () => {
        for (const place of worldCollection.places) {
            expect(place.landBorders).not.toContain(place.id);
        }
    });

    it("recognizes well-known real land borders", () => {
        expect(bordersOf("France")).toContain(idFor("Spain"));
        expect(bordersOf("United States of America")).toContain(
            idFor("Canada"),
        );
        expect(bordersOf("Brazil")).toContain(idFor("Argentina"));
        expect(bordersOf("People's Republic of China")).toContain(
            idFor("Russia"),
        );
        expect(bordersOf("Egypt")).toContain(idFor("Libya"));
    });

    it("does not invent land borders across water", () => {
        // English Channel (~33km) — closer than most real touching borders'
        // simplification gaps, so this is a meaningful negative case, not
        // just an obviously-distant pair.
        expect(bordersOf("United Kingdom")).not.toContain(idFor("France"));
        // Sea of Japan / Korea Strait.
        expect(bordersOf("Japan")).not.toContain(
            worldCollection.places.find((p) => p.names.en.includes("Korea"))
                ?.id,
        );
    });

    it("handles enclaves via the surrounding country's polygon hole, not its exterior", () => {
        expect(bordersOf("Lesotho")).toEqual([idFor("South Africa")]);
        expect(bordersOf("San Marino")).toEqual([idFor("Italy")]);
    });

    it("gives island nations an empty land-border list", () => {
        expect(bordersOf("Japan")).toEqual([]);
        expect(bordersOf("Iceland")).toEqual([]);
    });
});
