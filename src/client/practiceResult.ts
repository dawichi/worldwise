import { readPracticeResult } from "../lib/challenge/practice";
import { type Locale, t } from "../lib/i18n/t";

/** URL path segments differ from mode ids for the multi-word Border Run mode, matching Daily's `/play/border-run` convention. */
const MODE_PATHS: Record<string, string> = {
    compass: "compass",
    arrange: "arrange",
    borderRun: "border-run",
};

function getLocale(): Locale {
    return document.documentElement.lang === "es" ? "es" : "en";
}

function must<T>(value: T | null | undefined, description: string): T {
    if (value === null || value === undefined) {
        throw new Error(
            `practiceResult: missing required element "${description}"`,
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
    round: number,
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
    label.textContent = t(locale, "practice.roundLabel", { round });

    item.append(dot, label);
    return item;
}

export function mountPracticeResult(): void {
    const locale = getLocale();
    const result = readPracticeResult(sessionStorage);

    if (result === null) {
        window.location.href = "/practice";
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
    const playAgainButton = must(
        document.getElementById("play-again"),
        "play-again",
    );

    headingEl.textContent = t(locale, "practice.resultHeading", {
        collection: t(locale, `collections.${result.collectionId}`),
        mode: t(locale, `modes.${result.modeId}.name`),
        tier: t(locale, `tiers.${result.tier}`),
    });

    const totalCredit = result.roundCredits.reduce(
        (sum, credit) => sum + credit,
        0,
    );
    scoreEl.textContent = t(locale, "common.resultScore", {
        score: formatScore(totalCredit),
        total: result.roundCredits.length,
    });

    result.roundCredits.forEach((credit, index) => {
        roundsListEl.append(buildRoundItem(index + 1, credit, locale));
    });

    const path = MODE_PATHS[result.modeId] ?? result.modeId;
    playAgainButton.addEventListener("click", () => {
        window.location.href = `/practice/${path}?collection=${result.collectionId}&tier=${result.tier}`;
    });
}
