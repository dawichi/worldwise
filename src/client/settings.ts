import { t } from "../lib/i18n/t";
import {
    loadState,
    STORAGE_KEY,
    saveState,
} from "../lib/persistence/repository";
import {
    createExportPayload,
    parseExportPayload,
} from "../lib/persistence/transfer";
import {
    loadPreferences,
    PREFERENCES_STORAGE_KEY,
    savePreferences,
} from "../lib/preferences";

function must<T>(value: T | null | undefined, description: string): T {
    if (value === null || value === undefined) {
        throw new Error(`settings: missing required element "${description}"`);
    }
    return value;
}

export function mountSettings(): void {
    const locale = document.documentElement.lang === "es" ? "es" : "en";
    const localeSelect = must(
        document.getElementById("language-select") as HTMLSelectElement | null,
        "language-select",
    );
    const reducedMotion = must(
        document.getElementById("reduced-motion") as HTMLInputElement | null,
        "reduced-motion",
    );
    const exportButton = must(
        document.getElementById("export-data") as HTMLButtonElement | null,
        "export-data",
    );
    const importButton = must(
        document.getElementById("import-data") as HTMLButtonElement | null,
        "import-data",
    );
    const importFile = must(
        document.getElementById("import-file") as HTMLInputElement | null,
        "import-file",
    );
    const resetButton = must(
        document.getElementById("reset-data") as HTMLButtonElement | null,
        "reset-data",
    );
    const status = must(
        document.getElementById("settings-status"),
        "settings-status",
    );

    const preferences = loadPreferences(localStorage);
    localeSelect.value = preferences.locale;
    reducedMotion.checked = preferences.reducedMotion;

    function announce(message: string): void {
        status.textContent = message;
    }

    localeSelect.addEventListener("change", () => {
        const nextLocale = localeSelect.value === "es" ? "es" : "en";
        savePreferences(
            { ...loadPreferences(localStorage), locale: nextLocale },
            localStorage,
        );
        const url = new URL(window.location.href);
        const isSpanishPath =
            url.pathname === "/es" || url.pathname.startsWith("/es/");
        const basePath = isSpanishPath
            ? url.pathname.slice(3) || "/"
            : url.pathname;
        url.pathname =
            nextLocale === "es"
                ? `/es${basePath === "/" ? "/" : basePath}`
                : basePath;
        url.searchParams.delete("lang");
        window.location.assign(url.toString());
    });

    reducedMotion.addEventListener("change", () => {
        const nextPreferences = {
            ...loadPreferences(localStorage),
            reducedMotion: reducedMotion.checked,
        };
        savePreferences(nextPreferences, localStorage);
        document.documentElement.classList.toggle(
            "reduce-motion",
            reducedMotion.checked,
        );
    });

    exportButton.addEventListener("click", () => {
        const payload = createExportPayload(
            loadState(localStorage),
            loadPreferences(localStorage),
        );
        const blob = new Blob([JSON.stringify(payload, null, 2)], {
            type: "application/json",
        });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = "worldwise-progress.json";
        link.click();
        URL.revokeObjectURL(url);
        announce(t(locale, "settings.exported"));
    });

    importButton.addEventListener("click", () => {
        importFile.click();
    });

    importFile.addEventListener("change", async () => {
        const file = importFile.files?.[0];
        if (!file) {
            return;
        }
        const payload = parseExportPayload(await file.text());
        if (!payload) {
            announce(t(locale, "settings.invalidImport"));
            importFile.value = "";
            return;
        }
        saveState(payload.state, localStorage);
        savePreferences(payload.preferences, localStorage);
        announce(t(locale, "settings.imported"));
        window.setTimeout(() => window.location.reload(), 300);
    });

    resetButton.addEventListener("click", () => {
        if (!window.confirm(t(locale, "settings.resetConfirm"))) {
            return;
        }
        localStorage.removeItem(STORAGE_KEY);
        localStorage.removeItem(PREFERENCES_STORAGE_KEY);
        announce(t(locale, "settings.resetComplete"));
        window.setTimeout(() => window.location.assign("/"), 300);
    });
}
