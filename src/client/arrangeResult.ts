import { worldCollection } from "../data/generated/world";
import { resolveDailyArrange } from "../lib/challenge/dailyArrange";
import { parseDailyTierParam, withTierQuery } from "../lib/challenge/dailyTier";
import { getPlaceById } from "../lib/data/lookup";
import { type Locale, t } from "../lib/i18n/t";
import { loadState } from "../lib/persistence/repository";

function getLocale(): Locale {
    return document.documentElement.lang === "es" ? "es" : "en";
}

function must<T>(value: T | null | undefined, description: string): T {
    if (value === null || value === undefined) {
        throw new Error(
            `arrangeResult: missing required element "${description}"`,
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

function creditKeyFor(
    credit: number,
): "common.creditFull" | "common.creditPartial" | "common.creditNone" {
    if (credit === 1) {
        return "common.creditFull";
    }
    return credit > 0 ? "common.creditPartial" : "common.creditNone";
}

function formatScore(value: number): string {
    return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function buildRoundItem(
    order: string,
    credit: number,
    locale: Locale,
): HTMLLIElement {
    const item = document.createElement("li");
    item.className =
        "flex items-center gap-3 rounded-card border border-border bg-surface p-3";
    item.dataset.credit = creditLevel(credit);
    item.setAttribute("aria-label", t(locale, creditKeyFor(credit)));

    const dot = document.createElement("span");
    dot.dataset.role = "credit-dot";
    dot.className = "h-2.5 w-2.5 flex-shrink-0 rounded-full";
    dot.setAttribute("aria-hidden", "true");

    const label = document.createElement("span");
    label.className = "flex-1 text-sm text-text";
    label.textContent = order;

    item.append(dot, label);
    return item;
}

export function mountArrangeResult(): void {
    const locale = getLocale();
    const tier = parseDailyTierParam(
        new URLSearchParams(window.location.search),
    );
    const state = loadState(localStorage);
    const { challenge, entry } = resolveDailyArrange(new Date(), state, tier);

    if (entry.completedAt === null) {
        window.location.href = withTierQuery("/play/arrange", tier);
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

    headingEl.textContent = t(locale, "arrange.resultComplete", {
        tier: t(locale, `tiers.${tier}`),
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

        const order = round.correctOrderIds
            .map((id) => getPlaceById(worldCollection, id).names[locale])
            .join(" → ");
        roundsListEl.append(buildRoundItem(order, answer.credit, locale));
    }
}
