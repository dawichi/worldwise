import { compassCountryShapes } from "../data/generated/compassShapes";
import { worldCollection } from "../data/generated/world";
import { resolveDailyCompass } from "../lib/challenge/dailyCompass";
import { parseDailyTierParam, withTierQuery } from "../lib/challenge/dailyTier";
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
    originIso2: string,
    trueDirectionName: string,
    chosenAngleDeg: number,
    trueBearingDeg: number,
    credit: number,
): HTMLLIElement {
    const item = document.createElement("li");
    item.className =
        "flex items-center gap-3 rounded-card border border-border bg-surface p-3";
    item.dataset.credit = creditLevel(credit);

    const visual = document.createElement("div");
    visual.className = "compass-result-visual";
    visual.setAttribute("aria-hidden", "true");
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 100 100");
    const map = document.createElementNS("http://www.w3.org/2000/svg", "path");
    map.setAttribute(
        "d",
        compassCountryShapes[originIso2] ??
            "M20 35 L65 20 L82 55 L61 82 L25 72 Z",
    );
    map.setAttribute("class", "fill-accent/20 stroke-accent");
    map.setAttribute("stroke-width", "1.5");
    const chosen = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "line",
    );
    chosen.setAttribute("x1", "50");
    chosen.setAttribute("y1", "50");
    chosen.setAttribute("x2", "50");
    chosen.setAttribute("y2", "8");
    chosen.setAttribute("transform", `rotate(${chosenAngleDeg} 50 50)`);
    chosen.setAttribute(
        "stroke",
        `hsl(${Math.round(12 + credit * 128)} 78% 43%)`,
    );
    chosen.setAttribute("stroke-width", "3");
    chosen.setAttribute("stroke-linecap", "round");
    const perfect = chosen.cloneNode() as SVGLineElement;
    perfect.setAttribute("transform", `rotate(${trueBearingDeg} 50 50)`);
    perfect.setAttribute("stroke", "var(--color-success-icon)");
    perfect.setAttribute("stroke-width", "1.5");
    perfect.setAttribute("stroke-dasharray", "3 2");
    svg.append(map, perfect, chosen);
    visual.append(svg);

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

    item.append(visual, dot, label, direction);
    return item;
}

export function mountCompassResult(): void {
    const locale = getLocale();
    const tier = parseDailyTierParam(
        new URLSearchParams(window.location.search),
    );
    const state = loadState(localStorage);
    const { challenge, entry } = resolveDailyCompass(new Date(), state, tier);

    if (entry.completedAt === null) {
        window.location.href = withTierQuery("/play/compass", tier);
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
                origin.iso2,
                trueDirectionName,
                answer.chosenAngleDeg ?? 0,
                round.bearingDeg,
                answer.credit,
            ),
        );
    }
}
