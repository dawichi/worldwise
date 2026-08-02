export type Migration = (
    data: Record<string, unknown>,
) => Record<string, unknown>;

/**
 * v1 → v2: adding the Arrange mode introduced a required top-level
 * `arrange` key. A v1 value has no such key, so it's backfilled with an
 * empty daily record — existing `compass` progress and the `streak` are
 * left untouched.
 */
function migrateV1ToV2(data: Record<string, unknown>): Record<string, unknown> {
    return { ...data, schemaVersion: 2, arrange: { daily: {} } };
}

/**
 * v2 → v3: adding the Border Run mode introduced a required top-level
 * `borderRun` key. A v2 value has no such key, so it's backfilled with an
 * empty daily record — existing `compass`/`arrange` progress and the
 * `streak` are left untouched.
 */
function migrateV2ToV3(data: Record<string, unknown>): Record<string, unknown> {
    return { ...data, schemaVersion: 3, borderRun: { daily: {} } };
}

/**
 * v3 → v4: adding Practice introduced a required top-level `practice` key
 * (per-mode attempt/accuracy stats, plus a recent-fingerprint history used
 * to avoid repeating a challenge). A v3 value has no such key, so it's
 * backfilled zeroed/empty — every daily mode's progress and the `streak`
 * are left untouched.
 */
function migrateV3ToV4(data: Record<string, unknown>): Record<string, unknown> {
    const zeroStats = { attempts: 0, roundsAnswered: 0, totalCredit: 0 };
    return {
        ...data,
        schemaVersion: 4,
        practice: {
            stats: {
                compass: zeroStats,
                arrange: zeroStats,
                borderRun: zeroStats,
            },
            recentFingerprints: { compass: [], arrange: [], borderRun: [] },
        },
    };
}

/**
 * v4 → v5: Practice gained Europe. Stats and dedup fingerprints are now
 * scoped to a collection, so existing World progress is retained verbatim
 * under `world` and Europe starts empty.
 */
function migrateV4ToV5(data: Record<string, unknown>): Record<string, unknown> {
    const practice = data.practice as Record<string, unknown>;
    const emptyStats = { attempts: 0, roundsAnswered: 0, totalCredit: 0 };
    return {
        ...data,
        schemaVersion: 5,
        practice: {
            stats: {
                world: practice.stats,
                europe: {
                    compass: emptyStats,
                    arrange: emptyStats,
                    borderRun: emptyStats,
                },
            },
            recentFingerprints: {
                world: practice.recentFingerprints,
                europe: { compass: [], arrange: [], borderRun: [] },
            },
        },
    };
}

export const REAL_MIGRATIONS: Record<number, Migration> = {
    1: migrateV1ToV2,
    2: migrateV2ToV3,
    3: migrateV3ToV4,
    4: migrateV4ToV5,
};

function detectVersion(data: Record<string, unknown>): number {
    const { schemaVersion } = data;
    return typeof schemaVersion === "number" ? schemaVersion : 0;
}

/**
 * Runs `migrations` forward from whatever version `data` claims to be
 * until `targetVersion` is reached or no migration is registered for the
 * current version (in which case the caller's schema validation is
 * expected to reject the result and fall back to a default state).
 *
 * Generic over the migrations map so tests can prove this mechanism with
 * a synthetic hypothetical-prior-version fixture without the production
 * code needing to invent fake history.
 */
export function runMigrations(
    data: Record<string, unknown>,
    migrations: Record<number, Migration>,
    targetVersion: number,
): Record<string, unknown> {
    let current = data;
    let version = detectVersion(current);

    while (version < targetVersion) {
        const migrate = migrations[version];
        if (!migrate) {
            break;
        }
        current = migrate(current);
        const nextVersion = detectVersion(current);
        // A migration that doesn't advance the detected version would loop
        // forever; treat that as "can't migrate further" instead of hanging.
        if (nextVersion <= version) {
            break;
        }
        version = nextVersion;
    }

    return current;
}
