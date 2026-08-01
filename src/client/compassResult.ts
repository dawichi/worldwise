import { worldCollection } from "../data/generated/world";
import { resolveDailyCompass } from "../lib/challenge/dailyCompass";
import { getPlaceById } from "../lib/data/lookup";
import { bearingToCompassLabel } from "../lib/geo/angle";
import { localizedDirectionName } from "../lib/i18n/directions";
import { type Locale, t } from "../lib/i18n/t";
import { loadState } from "../lib/persistence/repository";

function getLocale(): Locale {
    return document.documentElement.lang === "es" ? "es" : "en";
}

function must<T>(value: T | null | undefined, description: string): T {
    if (value === null || value === undefined) {
        throw new Error(
            `compassResult: missing required element "${description}"`,
        );
    }
    return value;
}

function creditLevel(credit: number): "full" | "partial" | "none" {
    if (credit === 1) {
        return "full";
    }
    return credit > 0 ? "partial" : "none";
}

function formatScore(value: number): string {
    return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function buildRoundItem(
    originName: string,
    destinationName: string,
    trueDirectionName: string,
    credit: number,
): HTMLLIElement {
    const item = document.createElement("li");
    item.className =
        "flex items-center gap-3 rounded-card border border-border bg-surface p-3";
    item.dataset.credit = creditLevel(credit);

    const dot = document.createElement("span");
    dot.dataset.role = "credit-dot";
    dot.className = "h-2.5 w-2.5 flex-shrink-0 rounded-full";
    dot.setAttribute("aria-hidden", "true");

    const label = document.createElement("span");
    label.className = "flex-1 truncate text-sm text-text";
    label.textContent = `${originName} → ${destinationName}`;

    const direction = document.createElement("span");
    direction.dataset.role = "true-direction";
    direction.className = "flex-shrink-0 text-sm font-bold";
    direction.textContent = trueDirectionName;

    item.append(dot, label, direction);
    return item;
}

export function mountCompassResult(): void {
    const locale = getLocale();
    const state = loadState(localStorage);
    const { challenge, entry } = resolveDailyCompass(new Date(), state);

    if (entry.completedAt === null) {
        window.location.href = "/play/compass";
        return;
    }

    const headingEl = must(
        document.getElementById("result-heading"),
        "result-heading",
    );
    const scoreEl = must(
        document.getElementById("result-score"),
        "result-score",
    );
    const roundsListEl = must(
        document.getElementById("result-rounds"),
        "result-rounds",
    );

    headingEl.textContent = t(locale, "compass.resultComplete", {
        tier: t(locale, "tiers.medium"),
    });

    const totalCredit = entry.rounds.reduce(
        (sum, round) => sum + round.credit,
        0,
    );
    scoreEl.textContent = t(locale, "common.resultScore", {
        score: formatScore(totalCredit),
        total: entry.rounds.length,
    });

    for (let index = 0; index < challenge.rounds.length; index++) {
        const round = challenge.rounds[index];
        const answer = entry.rounds[index];
        if (!round || !answer) {
            continue;
        }

        const origin = getPlaceById(worldCollection, round.originId);
        const destination = getPlaceById(worldCollection, round.destinationId);
        const trueDirectionName = localizedDirectionName(
            locale,
            bearingToCompassLabel(round.bearingDeg),
        );

        roundsListEl.append(
            buildRoundItem(
                origin.names[locale],
                destination.names[locale],
                trueDirectionName,
                answer.credit,
            ),
        );
    }
}
