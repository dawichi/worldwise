import type { Locale, TranslationKey } from "../../lib/i18n/t";

export function getLocale(): Locale {
    return document.documentElement.lang === "es" ? "es" : "en";
}

/**
 * TypeScript's control-flow narrowing doesn't persist into nested function
 * declarations defined later in the same scope (they might be called at
 * any future time), so a one-time `if (!x) return` guard above a set of
 * closures isn't enough to keep them typed as non-null. Returning an
 * already-non-nullable type from this helper sidesteps that instead of
 * reaching for non-null assertions.
 */
export function must<T>(value: T | null | undefined, description: string): T {
    if (value === null || value === undefined) {
        throw new Error(`worldwise: missing required element "${description}"`);
    }
    return value;
}

/** Looks up an element by id, throwing if the page markup lacks it. */
export function byId(id: string): HTMLElement {
    return must(document.getElementById(id), id);
}

/** Looks up a `[data-role]` descendant, throwing if the markup lacks it. */
export function byRole<T extends Element = HTMLElement>(
    root: ParentNode,
    role: string,
): T {
    return must(root.querySelector<T>(`[data-role="${role}"]`), role);
}

export type CreditLevel = "full" | "partial" | "none";

export function creditLevel(credit: number): CreditLevel {
    if (credit === 1) {
        return "full";
    }
    return credit > 0 ? "partial" : "none";
}

export function creditKeyFor(credit: number): TranslationKey {
    const level = creditLevel(credit);
    if (level === "full") {
        return "common.creditFull";
    }
    return level === "partial" ? "common.creditPartial" : "common.creditNone";
}

export function formatScore(value: number): string {
    return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

export const SVG_NAMESPACE = "http://www.w3.org/2000/svg";

export function svgElement<K extends keyof SVGElementTagNameMap>(
    tag: K,
    attributes: Record<string, string | number> = {},
): SVGElementTagNameMap[K] {
    const element = document.createElementNS(SVG_NAMESPACE, tag);
    for (const [name, value] of Object.entries(attributes)) {
        element.setAttribute(name, String(value));
    }
    return element;
}
