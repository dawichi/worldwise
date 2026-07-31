import { describe, expect, it } from "vitest";
import type { CompassLabel } from "../../../src/lib/geo/angle";
import { localizedDirectionName } from "../../../src/lib/i18n/directions";

const LABELS: CompassLabel[] = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];

describe("localizedDirectionName", () => {
    it("has a non-empty name for every direction in both locales", () => {
        for (const label of LABELS) {
            expect(localizedDirectionName("en", label).length).toBeGreaterThan(
                0,
            );
            expect(localizedDirectionName("es", label).length).toBeGreaterThan(
                0,
            );
        }
    });

    it("returns the expected English names", () => {
        expect(localizedDirectionName("en", "N")).toBe("North");
        expect(localizedDirectionName("en", "SE")).toBe("Southeast");
    });

    it("returns the expected Spanish names", () => {
        expect(localizedDirectionName("es", "N")).toBe("Norte");
        expect(localizedDirectionName("es", "SE")).toBe("Sureste");
    });
});
