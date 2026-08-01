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
