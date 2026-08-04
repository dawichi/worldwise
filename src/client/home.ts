import {
    type ArrangeDailyStatus,
    computeArrangeStatus,
    countAnsweredRounds as countArrangeAnsweredRounds,
    resolveDailyArrange,
} from "../lib/challenge/dailyArrange";
import {
    type BorderRunDailyStatus,
    computeBorderRunStatus,
    countAnsweredRounds as countBorderRunAnsweredRounds,
    resolveDailyBorderRun,
} from "../lib/challenge/dailyBorderRun";
import {
    type CompassDailyStatus,
    computeCompassStatus,
    countAnsweredRounds,
    resolveDailyCompass,
} from "../lib/challenge/dailyCompass";
import {
    countCompletedModesToday,
    ENABLED_MODE_IDS,
} from "../lib/challenge/dailyRitual";
import {
    DAILY_BONUS_TIER_IDS,
    type DailyBonusTier,
} from "../lib/challenge/dailyTier";
import { type Locale, t } from "../lib/i18n/t";
import { loadState } from "../lib/persistence/repository";

function getLocale(): Locale {
    return document.documentElement.lang === "es" ? "es" : "en";
}

function formatDate(locale: Locale, date: Date): string {
    return new Intl.DateTimeFormat(locale === "es" ? "es-ES" : "en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
    }).format(date);
}

function renderStreak(locale: Locale, current: number): void {
    if (current <= 0) {
        return;
    }
    const chip = document.getElementById("streak-chip");
    const countText = document.getElementById("streak-count-text");
    if (!chip || !countText) {
        return;
    }
    chip.classList.remove("hidden");
    chip.classList.add("flex");
    countText.textContent = t(locale, "common.streakDayCount", {
        count: current,
    });
}

function renderRitualProgress(
    locale: Locale,
    completed: number,
    total: number,
): void {
    const label = document.getElementById("ritual-progress-label");
    const bar = document.getElementById("ritual-progress-bar");
    const track = document.getElementById("ritual-progress-track");
    const percent = total > 0 ? Math.round((completed / total) * 100) : 0;

    if (label) {
        label.textContent = t(locale, "home.completeOf", { completed, total });
    }
    if (bar instanceof HTMLElement) {
        bar.style.width = `${percent}%`;
    }
    if (track) {
        track.setAttribute("aria-valuenow", String(percent));
    }
}

function renderModeCard(
    locale: Locale,
    modeId: "compass" | "arrange" | "borderRun",
    status: CompassDailyStatus | ArrangeDailyStatus | BorderRunDailyStatus,
    answeredCount: number,
    totalRounds: number,
): void {
    const card = document.getElementById(`${modeId}-mode-card`);
    if (!card) {
        return;
    }

    const statusLabel = card.querySelector<HTMLElement>(
        '[data-role="status-label"]',
    );
    const actionSlot = card.querySelector<HTMLElement>(
        '[data-role="action-slot"]',
    );
    const actionLink = card.querySelector<HTMLAnchorElement>(
        '[data-role="action-link"]',
    );
    const completedBadge = card.querySelector<HTMLElement>(
        '[data-role="completed-badge"]',
    );

    card.dataset.status = status;

    if (status === "completed") {
        actionSlot?.classList.add("hidden");
        completedBadge?.classList.remove("hidden");
        completedBadge?.classList.add("flex");
        if (statusLabel) {
            statusLabel.textContent = t(locale, "home.completedOf", {
                completed: totalRounds,
                total: totalRounds,
            });
        }
        return;
    }

    actionSlot?.classList.remove("hidden");
    completedBadge?.classList.add("hidden");
    completedBadge?.classList.remove("flex");

    if (status === "in-progress") {
        if (actionLink) {
            actionLink.textContent = t(locale, "common.continue");
        }
        if (statusLabel) {
            statusLabel.textContent = t(locale, `${modeId}.roundOf`, {
                current: answeredCount + 1,
                total: totalRounds,
            });
        }
        return;
    }

    if (actionLink) {
        actionLink.textContent = t(locale, "home.start");
    }
    if (statusLabel) {
        statusLabel.textContent = t(locale, "home.notStarted");
    }
}

function renderBonusTierPills<Entry>(
    modeId: "compass" | "arrange" | "borderRun",
    resolveTier: (tier: DailyBonusTier) => { entry: Entry },
    computeStatus: (
        entry: Entry,
    ) => "not-started" | "in-progress" | "completed",
): void {
    const row = document.getElementById(`${modeId}-bonus-row`);
    if (!row) {
        return;
    }
    for (const tier of DAILY_BONUS_TIER_IDS) {
        const link = row.querySelector<HTMLAnchorElement>(
            `[data-tier="${tier}"]`,
        );
        if (!link) {
            continue;
        }
        const { entry } = resolveTier(tier);
        link.dataset.status = computeStatus(entry);
    }
}

export function mountHome(): void {
    const locale = getLocale();
    const now = new Date();
    const state = loadState(localStorage);
    const compass = resolveDailyCompass(now, state);
    const arrange = resolveDailyArrange(now, state);
    const borderRun = resolveDailyBorderRun(now, state);
    const compassStatus = computeCompassStatus(compass.entry);
    const arrangeStatus = computeArrangeStatus(arrange.entry);
    const borderRunStatus = computeBorderRunStatus(borderRun.entry);

    const dateEl = document.getElementById("today-date");
    if (dateEl) {
        dateEl.textContent = formatDate(locale, now);
    }

    renderStreak(locale, state.streak.current);
    renderRitualProgress(
        locale,
        countCompletedModesToday(state, compass.dateKey),
        ENABLED_MODE_IDS.length,
    );
    renderModeCard(
        locale,
        "compass",
        compassStatus,
        countAnsweredRounds(compass.entry),
        compass.entry.rounds.length,
    );
    renderModeCard(
        locale,
        "arrange",
        arrangeStatus,
        countArrangeAnsweredRounds(arrange.entry),
        arrange.entry.rounds.length,
    );
    renderModeCard(
        locale,
        "borderRun",
        borderRunStatus,
        countBorderRunAnsweredRounds(borderRun.entry),
        borderRun.entry.rounds.length,
    );

    renderBonusTierPills(
        "compass",
        (tier) => resolveDailyCompass(now, state, tier),
        computeCompassStatus,
    );
    renderBonusTierPills(
        "arrange",
        (tier) => resolveDailyArrange(now, state, tier),
        computeArrangeStatus,
    );
    renderBonusTierPills(
        "borderRun",
        (tier) => resolveDailyBorderRun(now, state, tier),
        computeBorderRunStatus,
    );
}
