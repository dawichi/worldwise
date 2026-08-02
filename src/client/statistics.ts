import {
    ENABLED_MODE_IDS,
    type EnabledModeId,
} from "../lib/challenge/dailyRitual";
import {
    computeDailyHistory,
    computeModeStats,
    type ModeStats,
} from "../lib/challenge/statistics";
import { PRACTICE_COLLECTION_IDS } from "../lib/data/collections";
import { type Locale, type TranslationKey, t } from "../lib/i18n/t";
import { loadState } from "../lib/persistence/repository";

const HISTORY_DAYS = 14;

function getLocale(): Locale {
    return document.documentElement.lang === "es" ? "es" : "en";
}

function must<T>(value: T | null | undefined, description: string): T {
    if (value === null || value === undefined) {
        throw new Error(
            `statistics: missing required element "${description}"`,
        );
    }
    return value;
}

type DayStatus = "full" | "partial" | "none";

function dayStatus(completed: number, total: number): DayStatus {
    if (completed === total) {
        return "full";
    }
    return completed > 0 ? "partial" : "none";
}

function formatDayLabel(locale: Locale, dateKey: string): string {
    const date = new Date(`${dateKey}T00:00:00Z`);
    return new Intl.DateTimeFormat(locale === "es" ? "es-ES" : "en-US", {
        month: "short",
        day: "numeric",
        timeZone: "UTC",
    }).format(date);
}

function dayStatusLabel(
    locale: Locale,
    status: DayStatus,
    completed: number,
    total: number,
): string {
    if (status === "partial") {
        return t(locale, "statistics.dayStatusPartial", { completed, total });
    }
    const key: TranslationKey =
        status === "full"
            ? "statistics.dayStatusFull"
            : "statistics.dayStatusNone";
    return t(locale, key);
}

function buildHistoryCell(
    locale: Locale,
    day: { dateKey: string; completedModes: number; totalModes: number },
): HTMLLIElement {
    const status = dayStatus(day.completedModes, day.totalModes);
    const item = document.createElement("li");
    item.className = "history-cell h-7 w-7 rounded-button";
    item.dataset.status = status;

    const dateLabel = formatDayLabel(locale, day.dateKey);
    const statusLabel = dayStatusLabel(
        locale,
        status,
        day.completedModes,
        day.totalModes,
    );
    item.setAttribute("aria-label", `${dateLabel}: ${statusLabel}`);
    item.title = dateLabel;

    return item;
}

function formatAccuracyLine(
    locale: Locale,
    accuracy: number | null,
    countKey: TranslationKey,
    count: number,
): string {
    if (accuracy === null) {
        return t(locale, "statistics.noData");
    }
    return `${accuracy}% · ${t(locale, countKey, { count })}`;
}

function buildModeCard(
    locale: Locale,
    modeId: EnabledModeId,
    stats: ModeStats,
    includeDaily: boolean,
): HTMLDivElement {
    const card = document.createElement("div");
    card.className = "rounded-card border border-border bg-surface p-4";

    const heading = document.createElement("div");
    heading.className = "mb-2 font-bold text-text";
    heading.textContent = t(locale, `modes.${modeId}.name`);
    card.append(heading);

    const dailyRow = document.createElement("div");
    dailyRow.className = "mb-1 flex items-center justify-between text-sm";
    const dailyLabel = document.createElement("span");
    dailyLabel.className = "text-text-muted";
    dailyLabel.textContent = t(locale, "statistics.dailyAccuracy");
    const dailyValue = document.createElement("span");
    dailyValue.className = "font-semibold text-text";
    dailyValue.textContent = formatAccuracyLine(
        locale,
        stats.dailyAccuracy,
        "statistics.daysCompleted",
        stats.dailyCompletedDays,
    );
    dailyRow.append(dailyLabel, dailyValue);

    const practiceRow = document.createElement("div");
    practiceRow.className = "flex items-center justify-between text-sm";
    const practiceLabel = document.createElement("span");
    practiceLabel.className = "text-text-muted";
    practiceLabel.textContent = t(locale, "statistics.practiceAccuracy");
    const practiceValue = document.createElement("span");
    practiceValue.className = "font-semibold text-text";
    practiceValue.textContent = formatAccuracyLine(
        locale,
        stats.practiceAccuracy,
        "statistics.practiceAttempts",
        stats.practiceAttempts,
    );
    practiceRow.append(practiceLabel, practiceValue);

    if (includeDaily) {
        card.append(dailyRow);
    }
    card.append(practiceRow);
    return card;
}

export function mountStatistics(): void {
    const locale = getLocale();
    const state = loadState(localStorage);

    const streakCurrentEl = must(
        document.getElementById("streak-current"),
        "streak-current",
    );
    const streakLongestEl = must(
        document.getElementById("streak-longest"),
        "streak-longest",
    );
    const historyEl = must(
        document.getElementById("daily-history"),
        "daily-history",
    );
    const modeStatsEl = must(
        document.getElementById("mode-stats"),
        "mode-stats",
    );

    streakCurrentEl.textContent = t(locale, "common.streakDayCount", {
        count: state.streak.current,
    });
    streakLongestEl.textContent = t(locale, "common.streakDayCount", {
        count: state.streak.longest,
    });

    // Oldest first, so the strip reads left-to-right chronologically.
    const history = computeDailyHistory(
        state,
        new Date(),
        HISTORY_DAYS,
    ).reverse();
    for (const day of history) {
        historyEl.append(buildHistoryCell(locale, day));
    }

    for (const collectionId of PRACTICE_COLLECTION_IDS) {
        const collectionHeading = document.createElement("h3");
        collectionHeading.className =
            "mt-4 text-sm font-semibold text-text-muted";
        collectionHeading.textContent = t(
            locale,
            "statistics.practiceCollection",
            {
                collection: t(locale, `collections.${collectionId}`),
            },
        );
        modeStatsEl.append(collectionHeading);

        for (const modeId of ENABLED_MODE_IDS) {
            const stats = computeModeStats(state, modeId, collectionId);
            modeStatsEl.append(
                buildModeCard(locale, modeId, stats, collectionId === "world"),
            );
        }
    }
}
