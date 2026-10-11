import { describe, expect, it } from "vitest";
import {
    type Migration,
    REAL_MIGRATIONS,
    runMigrations,
} from "../../../src/lib/persistence/migrations/index";

describe("runMigrations", () => {
    it("leaves already-current data untouched", () => {
        const current = { schemaVersion: 1, hello: "world" };
        expect(runMigrations(current, {}, 1)).toEqual(current);
    });

    it("treats missing schemaVersion as version 0", () => {
        const noVersionField = { streak: { current: 1 } };
        // No migration registered for version 0 in this table, so it
        // should stop immediately and return the data unchanged (schema
        // validation upstream is what ultimately rejects it).
        expect(runMigrations(noVersionField, {}, 1)).toEqual(noVersionField);
    });

    it("proves the migration-chain mechanism with a synthetic hypothetical prior version", () => {
        // This "v0 -> v1" shape is invented purely to test that the chain
        // mechanism works generically — it is not a real historical
        // Worldwise schema version (only v1 has ever shipped).
        const hypotheticalV0ToV1: Migration = (data) => ({
            schemaVersion: 1,
            renamedField: data.oldFieldName,
        });

        const migrations: Record<number, Migration> = { 0: hypotheticalV0ToV1 };
        const legacyData = { oldFieldName: "carried over" };

        const migrated = runMigrations(legacyData, migrations, 1);
        expect(migrated).toEqual({
            schemaVersion: 1,
            renamedField: "carried over",
        });
    });

    it("chains through multiple synthetic versions in sequence", () => {
        const v0ToV1: Migration = (data) => ({
            ...data,
            schemaVersion: 1,
            addedInV1: true,
        });
        const v1ToV2: Migration = (data) => ({
            ...data,
            schemaVersion: 2,
            addedInV2: true,
        });
        const migrations: Record<number, Migration> = { 0: v0ToV1, 1: v1ToV2 };

        const migrated = runMigrations({}, migrations, 2);
        expect(migrated).toEqual({
            schemaVersion: 2,
            addedInV1: true,
            addedInV2: true,
        });
    });

    it("stops without looping forever when no migration exists for the detected version", () => {
        const migrations: Record<number, Migration> = {
            0: (data) => ({ ...data, schemaVersion: 1 }),
        };
        // Target is 5, but there's no migration registered for version 1 —
        // must stop at v1, not hang or throw.
        const migrated = runMigrations({}, migrations, 5);
        expect(migrated).toEqual({ schemaVersion: 1 });
    });

    it("stops rather than looping forever if a migration doesn't advance the version", () => {
        const stuck: Migration = (data) => ({ ...data, schemaVersion: 0 });
        const migrations: Record<number, Migration> = { 0: stuck };
        const migrated = runMigrations({ schemaVersion: 0 }, migrations, 3);
        expect(migrated).toEqual({ schemaVersion: 0 });
    });
});

describe("REAL_MIGRATIONS[1] (the real v1 -> v2 migration)", () => {
    it("adds an empty arrange.daily and bumps schemaVersion, leaving everything else untouched", () => {
        const migrateV1ToV2 = REAL_MIGRATIONS[1];
        expect(migrateV1ToV2).toBeDefined();

        const v1Data = {
            schemaVersion: 1,
            compass: { daily: { "2026-07-31": { challengeId: "x" } } },
            streak: { current: 5, longest: 9, lastCompletedDate: "2026-07-31" },
        };

        const migrated = migrateV1ToV2?.(v1Data);
        expect(migrated).toEqual({
            ...v1Data,
            schemaVersion: 2,
            arrange: { daily: {} },
        });
    });
});

describe("REAL_MIGRATIONS[2] (the real v2 -> v3 migration)", () => {
    it("adds an empty borderRun.daily and bumps schemaVersion, leaving everything else untouched", () => {
        const migrateV2ToV3 = REAL_MIGRATIONS[2];
        expect(migrateV2ToV3).toBeDefined();

        const v2Data = {
            schemaVersion: 2,
            compass: { daily: { "2026-07-31": { challengeId: "x" } } },
            arrange: { daily: { "2026-07-31": { challengeId: "y" } } },
            streak: { current: 5, longest: 9, lastCompletedDate: "2026-07-31" },
        };

        const migrated = migrateV2ToV3?.(v2Data);
        expect(migrated).toEqual({
            ...v2Data,
            schemaVersion: 3,
            borderRun: { daily: {} },
        });
    });
});

describe("REAL_MIGRATIONS[3] (the real v3 -> v4 migration)", () => {
    it("adds a zeroed practice block and bumps schemaVersion, leaving everything else untouched", () => {
        const migrateV3ToV4 = REAL_MIGRATIONS[3];
        expect(migrateV3ToV4).toBeDefined();

        const v3Data = {
            schemaVersion: 3,
            compass: { daily: { "2026-07-31": { challengeId: "x" } } },
            arrange: { daily: { "2026-07-31": { challengeId: "y" } } },
            borderRun: { daily: { "2026-07-31": { challengeId: "z" } } },
            streak: { current: 5, longest: 9, lastCompletedDate: "2026-07-31" },
        };

        const migrated = migrateV3ToV4?.(v3Data);
        const zeroStats = { attempts: 0, roundsAnswered: 0, totalCredit: 0 };
        expect(migrated).toEqual({
            ...v3Data,
            schemaVersion: 4,
            practice: {
                stats: {
                    compass: zeroStats,
                    arrange: zeroStats,
                    borderRun: zeroStats,
                },
                recentFingerprints: { compass: [], arrange: [], borderRun: [] },
            },
        });
    });
});

describe("REAL_MIGRATIONS[4] (the real v4 -> v5 migration)", () => {
    it("keeps World Practice progress and initializes Europe", () => {
        const migrateV4ToV5 = REAL_MIGRATIONS[4];
        const worldStats = {
            compass: { attempts: 2, roundsAnswered: 6, totalCredit: 4 },
            arrange: { attempts: 0, roundsAnswered: 0, totalCredit: 0 },
            borderRun: { attempts: 1, roundsAnswered: 3, totalCredit: 2 },
        };
        const worldFingerprints = {
            compass: ["a"],
            arrange: [],
            borderRun: ["b"],
        };
        const migrated = migrateV4ToV5?.({
            schemaVersion: 4,
            practice: {
                stats: worldStats,
                recentFingerprints: worldFingerprints,
            },
        });

        expect(migrated).toEqual({
            schemaVersion: 5,
            practice: {
                stats: {
                    world: worldStats,
                    europe: {
                        compass: {
                            attempts: 0,
                            roundsAnswered: 0,
                            totalCredit: 0,
                        },
                        arrange: {
                            attempts: 0,
                            roundsAnswered: 0,
                            totalCredit: 0,
                        },
                        borderRun: {
                            attempts: 0,
                            roundsAnswered: 0,
                            totalCredit: 0,
                        },
                    },
                },
                recentFingerprints: {
                    world: worldFingerprints,
                    europe: { compass: [], arrange: [], borderRun: [] },
                },
            },
        });
    });
});

describe("REAL_MIGRATIONS[5] (the real v5 -> v6 migration)", () => {
    it("adds an empty dailyBonus map to each mode and bumps schemaVersion, leaving everything else untouched", () => {
        const migrateV5ToV6 = REAL_MIGRATIONS[5];
        expect(migrateV5ToV6).toBeDefined();

        const v5Data = {
            schemaVersion: 5,
            compass: { daily: { "2026-07-31": { challengeId: "x" } } },
            arrange: { daily: { "2026-07-31": { challengeId: "y" } } },
            borderRun: { daily: { "2026-07-31": { challengeId: "z" } } },
            streak: { current: 5, longest: 9, lastCompletedDate: "2026-07-31" },
        };

        const migrated = migrateV5ToV6?.(v5Data);
        expect(migrated).toEqual({
            ...v5Data,
            schemaVersion: 6,
            compass: { daily: v5Data.compass.daily, dailyBonus: {} },
            arrange: { daily: v5Data.arrange.daily, dailyBonus: {} },
            borderRun: { daily: v5Data.borderRun.daily, dailyBonus: {} },
        });
    });
});

describe("REAL_MIGRATIONS[6] (the real v6 -> v7 migration)", () => {
    it("adds an empty Compass answer log and bumps schemaVersion, leaving everything else untouched", () => {
        const migrateV6ToV7 = REAL_MIGRATIONS[6];
        expect(migrateV6ToV7).toBeDefined();

        const v6Data = {
            schemaVersion: 6,
            compass: { daily: { "2026-07-31": { challengeId: "x" } } },
            streak: { current: 5, longest: 9, lastCompletedDate: "2026-07-31" },
        };

        expect(migrateV6ToV7?.(v6Data)).toEqual({
            ...v6Data,
            schemaVersion: 7,
            insights: { compassAnswers: [] },
        });
    });
});
