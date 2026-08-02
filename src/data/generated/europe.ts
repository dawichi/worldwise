// Derived from the committed World collection — do not edit place records here.
// See src/data/europe/source.md for the inclusion rule and boundary decision.
import type { Collection } from "../../lib/data/collections.schema";
import { worldCollection } from "./world";

/**
 * Sovereign European states for Practice. Cyprus is included because the
 * product's collection is geographic-cultural rather than a strict UN M49
 * region; transcontinental Russia is included, while Turkey and the Caucasus
 * remain in World-only Practice for this initial, bounded collection.
 */
const EUROPE_ISO3 = new Set([
    "ALB", "AND", "AUT", "BEL", "BGR", "BIH", "BLR", "CHE", "CYP", "CZE",
    "DEU", "DNK", "ESP", "EST", "FIN", "FRA", "GBR", "GRC", "HRV", "HUN",
    "IRL", "ISL", "ITA", "LIE", "LTU", "LUX", "LVA", "MCO", "MDA", "MKD",
    "MLT", "MNE", "NLD", "NOR", "POL", "PRT", "ROU", "RUS", "SMR", "SRB",
    "SVK", "SVN", "SWE", "UKR", "VAT",
]);

const includedIds = new Set(
    worldCollection.places
        .filter((place) => EUROPE_ISO3.has(place.iso3))
        .map((place) => place.id),
);

export const europeCollection: Collection = {
    id: "europe",
    names: { en: "Europe", es: "Europa" },
    supportedModes: ["compass", "arrange", "borderRun"],
    places: worldCollection.places
        .filter((place) => includedIds.has(place.id))
        .map((place) => ({
            ...place,
            // A collection's Border Run graph must never allow a hop outside
            // the collection, even where World has that land border.
            landBorders: place.landBorders.filter((id) => includedIds.has(id)),
        })),
};
