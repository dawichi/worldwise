import { describe, expect, it } from "vitest";
import {
    type PracticeResultPayload,
    readPracticeResult,
    recordPracticeAttempt,
    writePracticeResult,
} from "../../../src/lib/challenge/practice";
import type { StorageLike } from "../../../src/lib/persistence/repository";
import { createDefaultState } from "../../../src/lib/persistence/schema";

function createMemoryStorage(): StorageLike {
    const store = new Map<string, string>();
    return {
        getItem: (key: string) => store.get(key) ?? null,
        setItem: (key: string, value: string) => {
            store.set(key, value);
        },
    };
}

describe("recordPracticeAttempt", () => {
    it("increments attempts/roundsAnswered/totalCredit for the given mode only", () => {
        const stats = createDefaultState().practice.stats;
        const result = recordPracticeAttempt(stats, "compass", [1, 0.5, 0]);

        expect(result.compass).toEqual({
            attempts: 1,
            roundsAnswered: 3,
            totalCredit: 1.5,
        });
        expect(result.arrange).toEqual(stats.arrange);
        expect(result.borderRun).toEqual(stats.borderRun);
    });

    it("accumulates across repeated attempts", () => {
        const stats = createDefaultState().practice.stats;
        const once = recordPracticeAttempt(stats, "borderRun", [1, 1, 0]);
        const twice = recordPracticeAttempt(once, "borderRun", [0, 0, 0]);

        expect(twice.borderRun).toEqual({
            attempts: 2,
            roundsAnswered: 6,
            totalCredit: 2,
        });
    });
});

describe("writePracticeResult / readPracticeResult", () => {
    it("round-trips a valid payload", () => {
        const storage = createMemoryStorage();
        const payload: PracticeResultPayload = {
            modeId: "arrange",
            tier: "hard",
            roundCredits: [1, 0.6, 0],
        };
        writePracticeResult(payload, storage);
        expect(readPracticeResult(storage)).toEqual(payload);
    });

    it("returns null when nothing has been written", () => {
        expect(readPracticeResult(createMemoryStorage())).toBeNull();
    });

    it("returns null for invalid JSON", () => {
        const storage = createMemoryStorage();
        storage.setItem("worldwise:practice:lastResult", "{not json");
        expect(readPracticeResult(storage)).toBeNull();
    });

    it("returns null when the payload fails schema validation", () => {
        const storage = createMemoryStorage();
        storage.setItem(
            "worldwise:practice:lastResult",
            JSON.stringify({
                modeId: "compass",
                tier: "extreme",
                roundCredits: [1],
            }),
        );
        expect(readPracticeResult(storage)).toBeNull();
    });
});
