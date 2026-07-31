import {
    type CompassDailyStatus,
    computeCompassStatus,
    countAnsweredRounds,
    resolveDailyCompass,
} from "../lib/challenge/dailyCompass";
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

function renderCompassCard(
    locale: Locale,
    status: CompassDailyStatus,
    answeredCount: number,
    totalRounds: number,
): void {
    const card = document.getElementById("compass-mode-card");
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
            statusLabel.textContent = t(locale, "compass.roundOf", {
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

export function mountHome(): void {
    const locale = getLocale();
    const now = new Date();
    const state = loadState(localStorage);
    const { entry } = resolveDailyCompass(now, state);
    const status = computeCompassStatus(entry);
    const answeredCount = countAnsweredRounds(entry);
    const totalRounds = entry.rounds.length;

    const dateEl = document.getElementById("today-date");
    if (dateEl) {
        dateEl.textContent = formatDate(locale, now);
    }

    renderStreak(locale, state.streak.current);
    // Only Compass is built so far; the daily ritual is "complete" once it is.
    renderRitualProgress(locale, status === "completed" ? 1 : 0, 1);
    renderCompassCard(locale, status, answeredCount, totalRounds);
}
