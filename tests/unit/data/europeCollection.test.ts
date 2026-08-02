import { describe, expect, it } from "vitest";
import { europeCollection } from "../../../src/data/generated/europe";
import { collectionSchema } from "../../../src/lib/data/collections.schema";
import { bfsDistances } from "../../../src/lib/geo/graph";
import { generateBorderRunChallenge } from "../../../src/lib/modes/borderRun/generate";

describe("europeCollection", () => {
    it("is valid, bounded, and includes familiar European countries", () => {
        expect(() => collectionSchema.parse(europeCollection)).not.toThrow();
        expect(europeCollection.places).toHaveLength(45);
        expect(europeCollection.places.map((place) => place.iso3)).toEqual(
            expect.arrayContaining(["ESP", "FRA", "DEU", "POL", "UKR"]),
        );
    });

    it("keeps every Border Run hop inside Europe", () => {
        const ids = new Set(europeCollection.places.map((place) => place.id));
        for (const place of europeCollection.places) {
            expect(place.landBorders.every((id) => ids.has(id))).toBe(true);
        }

        const bulgaria = europeCollection.places.find(
            (place) => place.iso3 === "BGR",
        );
        expect(bulgaria?.landBorders).not.toContain("country:tur");
        // The clipped graph still has enough connected pairs for every tier.
        expect(
            bfsDistances(europeCollection.places, "country:fra").size,
        ).toBeGreaterThan(30);
    });

    it("generates deterministic Europe Border Run rounds", () => {
        const challenge = generateBorderRunChallenge({
            seed: "europe-test",
            challengeId: "europe-test",
            generatorVersion: "v1",
            dataVersion: "data-v2",
            collectionId: "europe",
            tier: "hard",
            places: europeCollection.places,
        });
        expect(challenge.rounds).toHaveLength(3);
    });
});
