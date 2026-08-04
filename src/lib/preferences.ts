import { z } from "zod";

export const PREFERENCES_STORAGE_KEY = "worldwise:preferences";

export const preferencesSchema = z.object({
    locale: z.enum(["en", "es"]),
    reducedMotion: z.boolean(),
});

export type Preferences = z.infer<typeof preferencesSchema>;

export interface PreferencesStorage {
    getItem: (key: string) => string | null;
    setItem: (key: string, value: string) => void;
    removeItem: (key: string) => void;
}

export const DEFAULT_PREFERENCES: Preferences = {
    locale: "en",
    reducedMotion: false,
};

export function loadPreferences(storage: PreferencesStorage): Preferences {
    const raw = storage.getItem(PREFERENCES_STORAGE_KEY);
    if (raw === null) {
        return DEFAULT_PREFERENCES;
    }

    try {
        const parsed: unknown = JSON.parse(raw);
        const result = preferencesSchema.safeParse(parsed);
        return result.success ? result.data : DEFAULT_PREFERENCES;
    } catch {
        return DEFAULT_PREFERENCES;
    }
}

export function savePreferences(
    preferences: Preferences,
    storage: PreferencesStorage,
): void {
    storage.setItem(
        PREFERENCES_STORAGE_KEY,
        JSON.stringify(preferencesSchema.parse(preferences)),
    );
}
