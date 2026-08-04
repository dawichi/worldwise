import { describe, expect, it } from "vitest";
import en from "../../../src/lib/i18n/dictionaries/en.json";
import es from "../../../src/lib/i18n/dictionaries/es.json";
import { localizedPath, t } from "../../../src/lib/i18n/t";

function collectLeafPaths(node: unknown, prefix = ""): string[] {
    if (typeof node === "string") {
        return [prefix];
    }
    if (typeof node !== "object" || node === null) {
        return [];
    }
    return Object.entries(node).flatMap(([key, value]) =>
        collectLeafPaths(value, prefix ? `${prefix}.${key}` : key),
    );
}

describe("i18n dictionaries", () => {
    it("es.json has exactly the same set of translation keys as en.json", () => {
        const enKeys = new Set(collectLeafPaths(en));
        const esKeys = new Set(collectLeafPaths(es));

        expect([...enKeys].sort()).toEqual([...esKeys].sort());
    });

    it("has no empty translation strings in either dictionary", () => {
        for (const [locale, dictionary] of [
            ["en", en],
            ["es", es],
        ] as const) {
            for (const path of collectLeafPaths(dictionary)) {
                expect(
                    t(locale, path as never).length,
                    `${locale}.${path} is empty`,
                ).toBeGreaterThan(0);
            }
        }
    });
});

describe("t()", () => {
    it("resolves a nested key", () => {
        expect(t("en", "common.continue")).toBe("Continue");
        expect(t("es", "common.continue")).toBe("Continuar");
    });

    it("substitutes placeholders", () => {
        expect(t("en", "common.streakDayCount", { count: 12 })).toBe(
            "12 day streak",
        );
        expect(t("es", "common.streakDayCount", { count: 12 })).toBe(
            "Racha de 12 días",
        );
    });

    it("substitutes multiple distinct placeholders", () => {
        expect(t("en", "home.completeOf", { completed: 1, total: 3 })).toBe(
            "1 of 3",
        );
    });

    it("throws for a key that doesn't resolve to a string", () => {
        expect(() => t("en", "common" as never)).toThrow();
        expect(() => t("en", "nonexistent.key" as never)).toThrow();
    });
});

describe("localizedPath()", () => {
    it("prefixes Spanish internal paths while leaving English paths unchanged", () => {
        expect(localizedPath("en", "/statistics")).toBe("/statistics");
        expect(localizedPath("es", "/statistics")).toBe("/es/statistics");
        expect(localizedPath("es", "/")).toBe("/es/");
        expect(localizedPath("es", "/es/about")).toBe("/es/about");
    });
});
