import { z } from "zod";
import { type Preferences, preferencesSchema } from "../preferences";
import { type PersistedState, persistedStateSchema } from "./schema";

const exportSchema = z.object({
    format: z.literal("worldwise-export"),
    version: z.literal(1),
    exportedAt: z.iso.datetime(),
    state: persistedStateSchema,
    preferences: preferencesSchema,
});

export interface ExportPayload {
    format: "worldwise-export";
    version: 1;
    exportedAt: string;
    state: PersistedState;
    preferences: Preferences;
}

export function createExportPayload(
    state: PersistedState,
    preferences: Preferences,
    exportedAt = new Date().toISOString(),
): ExportPayload {
    return {
        format: "worldwise-export",
        version: 1,
        exportedAt,
        state,
        preferences,
    };
}

export function parseExportPayload(raw: string): ExportPayload | null {
    try {
        const parsed: unknown = JSON.parse(raw);
        const result = exportSchema.safeParse(parsed);
        return result.success ? result.data : null;
    } catch {
        return null;
    }
}
