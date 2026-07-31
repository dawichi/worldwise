import { REAL_MIGRATIONS, runMigrations } from "./migrations/index";
import {
    CURRENT_SCHEMA_VERSION,
    createDefaultState,
    type PersistedState,
    persistedStateSchema,
} from "./schema";

export const STORAGE_KEY = "worldwise:state";

/**
 * Minimal surface this module needs from `localStorage`, so tests can pass
 * a plain in-memory double instead of requiring a browser-like DOM
 * environment. Call sites pass the real `localStorage` global.
 */
export interface StorageLike {
    getItem: (key: string) => string | null;
    setItem: (key: string, value: string) => void;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Loads and validates persisted state. Recovers gracefully — never
 * throws — from a missing key, invalid JSON, or data that fails schema
 * validation even after migration, returning a fresh default state in
 * every such case (AGENTS.md's "recover gracefully from corrupt or
 * partial content").
 */
export function loadState(storage: StorageLike): PersistedState {
    const raw = storage.getItem(STORAGE_KEY);
    if (raw === null) {
        return createDefaultState();
    }

    let parsed: unknown;
    try {
        parsed = JSON.parse(raw);
    } catch {
        // biome-ignore lint/suspicious/noConsole: deliberate diagnostic for corrupt-storage recovery, not a debug leftover
        console.warn(
            "worldwise: localStorage value is not valid JSON, resetting to defaults",
        );
        return createDefaultState();
    }

    const migrated = isPlainObject(parsed)
        ? runMigrations(parsed, REAL_MIGRATIONS, CURRENT_SCHEMA_VERSION)
        : parsed;

    const result = persistedStateSchema.safeParse(migrated);
    if (!result.success) {
        // biome-ignore lint/suspicious/noConsole: deliberate diagnostic for corrupt-storage recovery, not a debug leftover
        console.warn(
            "worldwise: localStorage value failed schema validation, resetting to defaults",
            result.error.message,
        );
        return createDefaultState();
    }

    return result.data;
}

export function saveState(state: PersistedState, storage: StorageLike): void {
    storage.setItem(STORAGE_KEY, JSON.stringify(state));
}
