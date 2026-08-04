import { describe, expect, it } from "vitest";
import { createDefaultState } from "../../src/lib/persistence/schema";
import {
    createExportPayload,
    parseExportPayload,
} from "../../src/lib/persistence/transfer";
import {
    DEFAULT_PREFERENCES,
    loadPreferences,
    savePreferences,
} from "../../src/lib/preferences";

function createStorage(): Storage {
    const values = new Map<string, string>();
    return {
        getItem: (key) => values.get(key) ?? null,
        setItem: (key, value) => values.set(key, value),
        removeItem: (key) => values.delete(key),
        clear: () => values.clear(),
        key: (index) => [...values.keys()][index] ?? null,
        get length() {
            return values.size;
        },
    };
}

describe("preferences", () => {
    it("recovers defaults and persists valid preferences", () => {
        const storage = createStorage();
        expect(loadPreferences(storage)).toEqual(DEFAULT_PREFERENCES);

        savePreferences({ locale: "es", reducedMotion: true }, storage);
        expect(loadPreferences(storage)).toEqual({
            locale: "es",
            reducedMotion: true,
        });
    });
});

describe("progress transfer", () => {
    it("round-trips a validated export and rejects malformed data", () => {
        const payload = createExportPayload(
            createDefaultState(),
            DEFAULT_PREFERENCES,
            "2026-08-04T00:00:00.000Z",
        );
        expect(parseExportPayload(JSON.stringify(payload))).toEqual(payload);
        expect(
            parseExportPayload(JSON.stringify({ format: "other" })),
        ).toBeNull();
    });
});
