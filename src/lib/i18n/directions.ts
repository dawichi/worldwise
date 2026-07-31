import type { CompassLabel } from "../geo/angle";
import type { Locale } from "./t";

/**
 * Full localized direction names for feedback copy (e.g. "Southeast"),
 * separate from the generic dot-path dictionary since the lookup key is a
 * closed 8-value enum rather than a string literal known at each call site.
 */
const DIRECTION_NAMES: Record<Locale, Record<CompassLabel, string>> = {
    en: {
        N: "North",
        NE: "Northeast",
        E: "East",
        SE: "Southeast",
        S: "South",
        SW: "Southwest",
        W: "West",
        NW: "Northwest",
    },
    es: {
        N: "Norte",
        NE: "Noreste",
        E: "Este",
        SE: "Sureste",
        S: "Sur",
        SW: "Suroeste",
        W: "Oeste",
        NW: "Noroeste",
    },
};

export function localizedDirectionName(
    locale: Locale,
    label: CompassLabel,
): string {
    return DIRECTION_NAMES[locale][label];
}
