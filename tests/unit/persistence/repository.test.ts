import { beforeEach, describe, expect, it, vi } from "vitest";
import {
    loadState,
    STORAGE_KEY,
    type StorageLike,
    saveState,
} from "../../../src/lib/persistence/repository";
import {
    createDefaultState,
    type PersistedState,
} from "../../../src/lib/persistence/schema";

function createMemoryStorage(): StorageLike {
    const store = new Map<string, string>();
    return {
        getItem: (key: string) => store.get(key) ?? null,
        setItem: (key: string, value: string) => {
            store.set(key, value);
        },
    };
}

describe("loadState", () => {
    beforeEach(() => {
        vi.spyOn(console, "warn").mockImplementation(() => undefined);
    });

    it("returns a fresh default state when nothing is stored", () => {
        const storage = createMemoryStorage();
        expect(loadState(storage)).toEqual(createDefaultState());
    });

    it("round-trips a valid state through save and load", () => {
        const storage = createMemoryStorage();
        const state: PersistedState = {
            schemaVersion: 1,
            compass: {
                daily: {
                    "2026-07-31": {
                        challengeId:
                            "worldwise:daily:v1:data-v1:2026-07-31:world:compass:medium",
                        generatorVersion: "v1",
                        dataVersion: "data-v1",
                        tier: "medium",
                        rounds: [
                            { chosenAngleDeg: 135, credit: 1 },
                            { chosenAngleDeg: null, credit: 0 },
                        ],
                        completedAt: null,
                    },
                },
            },
            streak: {
                current: 3,
                longest: 12,
                lastCompletedDate: "2026-07-30",
            },
        };

        saveState(state, storage);
        expect(loadState(storage)).toEqual(state);
    });

    it("recovers to defaults from invalid JSON rather than throwing", () => {
        const storage = createMemoryStorage();
        storage.setItem(STORAGE_KEY, "{not valid json");
        expect(loadState(storage)).toEqual(createDefaultState());
    });

    it("recovers to defaults when the JSON is well-formed but not an object", () => {
        const storage = createMemoryStorage();
        storage.setItem(STORAGE_KEY, JSON.stringify([1, 2, 3]));
        expect(loadState(storage)).toEqual(createDefaultState());
    });

    it("recovers to defaults when required fields are missing", () => {
        const storage = createMemoryStorage();
        storage.setItem(STORAGE_KEY, JSON.stringify({ schemaVersion: 1 }));
        expect(loadState(storage)).toEqual(createDefaultState());
    });

    it("recovers to defaults when a field has the wrong type", () => {
        const storage = createMemoryStorage();
        storage.setItem(
            STORAGE_KEY,
            JSON.stringify({
                schemaVersion: 1,
                compass: { daily: {} },
                streak: {
                    current: "three",
                    longest: 12,
                    lastCompletedDate: null,
                },
            }),
        );
        expect(loadState(storage)).toEqual(createDefaultState());
    });

    it("recovers to defaults for an unrecoverable future schema version", () => {
        const storage = createMemoryStorage();
        storage.setItem(
            STORAGE_KEY,
            JSON.stringify({ schemaVersion: 999, whoKnows: true }),
        );
        expect(loadState(storage)).toEqual(createDefaultState());
    });
});
