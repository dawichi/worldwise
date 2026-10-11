import { worldCollection } from "../data/generated/world";
import {
    ENABLED_MODE_IDS,
    type EnabledModeId,
} from "../lib/challenge/dailyRitual";
import {
    computeDailyHistory,
    computeModeStats,
    computeStatisticsOverview,
    type ModeStats,
} from "../lib/challenge/statistics";
import { PRACTICE_COLLECTION_IDS } from "../lib/data/collections";
import { projectMercator } from "../lib/geo/mercator";
import { shortLongitudeDelta } from "../lib/geo/route";
import { type Locale, type TranslationKey, t } from "../lib/i18n/t";
import {
    estimatedDestinationPoint,
    summarizeMentalMap,
} from "../lib/insights/mentalMap";
import { loadState } from "../lib/persistence/repository";
import { drawWrappedWorld, loadCountryShapes } from "./maps/worldMap";
import { svgElement } from "./shared/dom";

const HISTORY_DAYS = 14;
const MENTAL_MAP_PLOT_LIMIT = 24;

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

function renderMentalMap(locale: Locale): void {
    const state = loadState(localStorage);
    const records = state.insights.compassAnswers;
    const content = must(
        document.getElementById("mental-map-content"),
        "mental-map-content",
    );
    const empty = must(
        document.getElementById("mental-map-empty"),
        "mental-map-empty",
    );
    if (records.length === 0) {
        empty.classList.remove("hidden");
        return;
    }

    content.classList.remove("hidden");
    const pointById = new Map(
        worldCollection.places.map((place) => [place.id, place.point]),
    );
    const summary = summarizeMentalMap(records, pointById);
    must(
        document.getElementById("mental-map-mean-error"),
        "mean-error",
    ).textContent =
        summary.meanErrorDeg === null
            ? t(locale, "statistics.notAvailable")
            : `${summary.meanErrorDeg.toFixed(0)}°`;
    const flatMapEl = must(
        document.getElementById("mental-map-flat-map"),
        "flat-map",
    );
    flatMapEl.textContent =
        summary.flatMapTraps === 0
            ? t(locale, "statistics.mentalMapNoFlatMapTraps")
            : t(locale, "statistics.mentalMapFlatMapOf", {
                  followed: summary.flatMapFollowed,
                  total: summary.flatMapTraps,
              });

    const biasEl = must(
        document.getElementById("mental-map-direction-bias"),
        "direction-bias",
    );
    const signedError = summary.meanSignedErrorDeg;
    if (summary.answers < 5) {
        biasEl.textContent = t(locale, "statistics.mentalMapNeedsMore");
    } else if (signedError === null || Math.abs(signedError) < 4) {
        biasEl.textContent = t(locale, "statistics.mentalMapBalanced");
    } else {
        biasEl.textContent = t(
            locale,
            signedError > 0
                ? "statistics.mentalMapClockwise"
                : "statistics.mentalMapCounterclockwise",
            { degrees: Math.abs(signedError).toFixed(0) },
        );
    }

    const biasList = must(
        document.getElementById("mental-map-destination-bias"),
        "destination-bias",
    );
    for (const bias of summary.destinationBiases.slice(0, 3)) {
        const place = worldCollection.places.find(
            (candidate) => candidate.id === bias.destinationId,
        );
        if (!place) {
            continue;
        }
        const northSouth = t(
            locale,
            bias.meanLatitudeOffsetDeg >= 0
                ? "statistics.mentalMapBiasNorth"
                : "statistics.mentalMapBiasSouth",
        );
        const eastWest = t(
            locale,
            bias.meanLongitudeOffsetDeg >= 0
                ? "statistics.mentalMapBiasEast"
                : "statistics.mentalMapBiasWest",
        );
        const item = document.createElement("li");
        item.className = "rounded-button bg-chip px-3 py-2.5";
        item.textContent = t(locale, "statistics.mentalMapBiasItem", {
            place: place.names[locale],
            latitude: Math.abs(bias.meanLatitudeOffsetDeg).toFixed(0),
            northSouth,
            longitude: Math.abs(bias.meanLongitudeOffsetDeg).toFixed(0),
            eastWest,
        });
        biasList.append(item);
    }
    if (biasList.childElementCount === 0) {
        const item = document.createElement("li");
        item.className = "text-text-muted";
        item.textContent = t(locale, "statistics.mentalMapBiasNoData");
        biasList.append(item);
    }

    const bandList = must(
        document.getElementById("mental-map-distance-bands"),
        "distance-bands",
    );
    for (const band of summary.bands) {
        const item = document.createElement("li");
        item.className =
            "flex items-center justify-between gap-3 rounded-button bg-chip px-3 py-2.5";
        const label = document.createElement("span");
        label.className = "font-semibold text-text";
        const bandLabelKey: TranslationKey =
            band.id === "near"
                ? "statistics.mentalMapBandNear"
                : band.id === "regional"
                  ? "statistics.mentalMapBandRegional"
                  : "statistics.mentalMapBandFar";
        label.textContent = t(locale, bandLabelKey);
        const value = document.createElement("span");
        value.className = "text-right text-xs text-text-muted";
        const bandValueKey: TranslationKey =
            band.meanErrorDeg === null
                ? "statistics.mentalMapBandNoData"
                : band.answers === 1
                  ? "statistics.mentalMapBandAnswer"
                  : "statistics.mentalMapBandAnswers";
        value.textContent = t(locale, bandValueKey, {
            count: band.answers,
            degrees: band.meanErrorDeg?.toFixed(0) ?? "",
        });
        item.append(label, value);
        bandList.append(item);
    }

    const mapCount = must(
        document.getElementById("mental-map-map-count"),
        "map-count",
    );
    const plotted = records.slice(-MENTAL_MAP_PLOT_LIMIT);
    mapCount.textContent = t(locale, "statistics.mentalMapMapCount", {
        shown: plotted.length,
        total: records.length,
    });
    const svg = must(
        document.getElementById("mental-map-svg"),
        "mental-map-svg",
    );
    const worldLayer = svg.querySelector<SVGGElement>(
        '[data-role="mental-map-world"]',
    );
    const routeLayer = svg.querySelector<SVGGElement>(
        '[data-role="mental-map-routes"]',
    );
    const pointLayer = svg.querySelector<SVGGElement>(
        '[data-role="mental-map-points"]',
    );
    if (!worldLayer || !routeLayer || !pointLayer) {
        throw new Error("statistics: mental map layers are missing");
    }

    void loadCountryShapes().then((shapes) => {
        drawWrappedWorld(
            worldLayer,
            shapes,
            "fill-land stroke-land-edge",
            "mental-map-world-shapes",
        );
        const routes: SVGElement[] = [];
        const points: SVGElement[] = [];
        for (const record of plotted) {
            const origin = worldCollection.places.find(
                (place) => place.id === record.originId,
            );
            const destination = worldCollection.places.find(
                (place) => place.id === record.destinationId,
            );
            if (!origin || !destination) {
                continue;
            }
            const estimate = estimatedDestinationPoint(
                origin.point,
                record.chosenDeg,
                record.distanceKm,
            );
            const estimateProjected = projectMercator(estimate);
            const actualProjected = projectMercator(destination.point);
            const actualLon =
                estimate.lon +
                shortLongitudeDelta(estimate.lon, destination.point.lon);
            const midpointLon = (estimate.lon + actualLon) / 2;
            const wrap = Math.round(midpointLon / 360) * 360;
            const estimateLon = estimate.lon - wrap;
            const wrappedActualLon = actualLon - wrap;
            routes.push(
                svgElement("path", {
                    d: `M${estimateLon} ${estimateProjected.y} L${wrappedActualLon} ${actualProjected.y}`,
                    fill: "none",
                    stroke: "var(--color-text-muted)",
                    "stroke-width": "0.55",
                    "stroke-dasharray": "1.5 1.5",
                    opacity: "0.65",
                }),
            );
            points.push(
                svgElement("circle", {
                    cx: wrappedActualLon,
                    cy: actualProjected.y,
                    r: 1.8,
                    fill: "var(--color-success-icon)",
                    stroke: "var(--color-surface)",
                    "stroke-width": "0.6",
                }),
                svgElement("circle", {
                    cx: estimateLon,
                    cy: estimateProjected.y,
                    r: 1.8,
                    fill: "var(--color-accent)",
                    stroke: "var(--color-surface)",
                    "stroke-width": "0.6",
                }),
            );
        }
        routeLayer.replaceChildren(...routes);
        pointLayer.replaceChildren(...points);
    });
}

export function mountStatistics(): void {
    const locale = getLocale();
    const state = loadState(localStorage);
    renderMentalMap(locale);

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
    const overviewRitualsEl = must(
        document.getElementById("overview-rituals"),
        "overview-rituals",
    );
    const overviewActiveDaysEl = must(
        document.getElementById("overview-active-days"),
        "overview-active-days",
    );
    const overviewCompletionRateEl = must(
        document.getElementById("overview-completion-rate"),
        "overview-completion-rate",
    );
    const overviewPracticeRoundsEl = must(
        document.getElementById("overview-practice-rounds"),
        "overview-practice-rounds",
    );
    const overviewPracticeAccuracyEl = must(
        document.getElementById("overview-practice-accuracy"),
        "overview-practice-accuracy",
    );

    streakCurrentEl.textContent = t(locale, "common.streakDayCount", {
        count: state.streak.current,
    });
    streakLongestEl.textContent = t(locale, "common.streakDayCount", {
        count: state.streak.longest,
    });

    const overview = computeStatisticsOverview(state, new Date(), HISTORY_DAYS);
    overviewRitualsEl.textContent = t(locale, "statistics.completedRituals", {
        count: overview.completedRituals,
    });
    overviewActiveDaysEl.textContent = t(locale, "statistics.activeDays", {
        count: overview.activeDays,
    });
    overviewCompletionRateEl.textContent = t(
        locale,
        "statistics.modeCompletionRate",
        { rate: overview.modeCompletionRate },
    );
    overviewPracticeRoundsEl.textContent = t(
        locale,
        "statistics.practiceRounds",
        {
            count: overview.practiceRoundsAnswered,
        },
    );
    overviewPracticeAccuracyEl.textContent =
        overview.practiceAccuracy === null
            ? t(locale, "statistics.notAvailable")
            : `${overview.practiceAccuracy}%`;

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
