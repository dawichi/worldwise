export type Migration = (
    data: Record<string, unknown>,
) => Record<string, unknown>;

/**
 * No migrations exist yet — `schemaVersion: 1` is the only shape that has
 * ever shipped. Add an entry keyed by the version a stored value is
 * migrating *from* (e.g. `{ 1: migrateV1ToV2 }`) the day a breaking change
 * to `schema.ts` ships.
 */
export const REAL_MIGRATIONS: Record<number, Migration> = {};

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
