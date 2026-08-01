/**
 * Fetches (once, caching under gitignored `.data/raw/`) and normalizes
 * Natural Earth 1:50m Admin-0 Countries + Populated Places into the
 * committed `src/data/generated/world.ts`. Run manually via
 * `bun run data:build` — never invoked by `bun install` or `astro build`.
 *
 * See `src/data/world/source.md` for the sourcing, filtering, and
 * capital-coordinate decisions this script encodes.
 */
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import {
    type Collection,
    collectionSchema,
} from "../src/lib/data/collections.schema";
import { type Place, placeSchema } from "../src/lib/data/places.schema";
import { computeLandBorders, type RingSet } from "./lib/computeAdjacency";

const REPO_ROOT = path.join(import.meta.dirname, "..");
const RAW_DIR = path.join(REPO_ROOT, ".data", "raw");
const OUTPUT_PATH = path.join(
    REPO_ROOT,
    "src",
    "data",
    "generated",
    "world.ts",
);

const COUNTRIES_URL =
    "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_admin_0_countries.geojson";
const PLACES_URL =
    "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_populated_places.geojson";

const SOURCE_VERSION = "natural-earth-50m";

async function ensureRawFile(url: string, filename: string): Promise<string> {
    const filePath = path.join(RAW_DIR, filename);
    if (existsSync(filePath)) {
        return filePath;
    }
    await mkdir(RAW_DIR, { recursive: true });
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Failed to fetch ${url}: HTTP ${response.status}`);
    }
    const text = await response.text();
    await writeFile(filePath, text, "utf-8");
    return filePath;
}

const geoJsonSchema = z.object({
    features: z.array(z.unknown()),
});

const geometrySchema = z.object({
    type: z.enum(["Polygon", "MultiPolygon"]),
    coordinates: z.array(z.unknown()),
});

const countryFeatureSchema = z.object({
    properties: z.object({
        TYPE: z.string(),
        UN_A3: z.string(),
        SOVEREIGNT: z.string(),
        ADMIN: z.string(),
        NAME_EN: z.string(),
        NAME_ES: z.string(),
        ISO_A2: z.string(),
        ISO_A2_EH: z.string(),
        ISO_A3: z.string(),
        ISO_A3_EH: z.string(),
    }),
    geometry: geometrySchema,
});

/** Land-adjacency distance threshold — see source.md for how this value was chosen. */
const ADJACENCY_THRESHOLD_KM = 3;

/**
 * Normalizes a GeoJSON Polygon/MultiPolygon into a flat list of rings
 * (exterior + holes), discarding the polygon-grouping structure — adjacency
 * only cares about the full set of boundary points, not which ring belongs
 * to which sub-polygon.
 */
function ringsFromGeometry(
    geometry: z.infer<typeof geometrySchema>,
): Array<Array<[number, number]>> {
    if (geometry.type === "Polygon") {
        return geometry.coordinates as Array<Array<[number, number]>>;
    }
    return (
        geometry.coordinates as Array<Array<Array<[number, number]>>>
    ).flat();
}

const placeFeatureSchema = z.object({
    properties: z.object({
        ADM0CAP: z.number().nullable().optional(),
        FEATURECLA: z.string().nullable().optional(),
        ISO_A2: z.string().nullable().optional(),
        LATITUDE: z.number(),
        LONGITUDE: z.number(),
        NAME_EN: z.string(),
    }),
});

interface CapitalPoint {
    lat: number;
    lon: number;
    name: string;
}

function buildCapitalIndex(
    placeFeatures: unknown[],
): Map<string, CapitalPoint> {
    const capitalsByIso2 = new Map<string, CapitalPoint>();

    for (const feature of placeFeatures) {
        const parsed = placeFeatureSchema.safeParse(feature);
        if (!parsed.success) {
            continue;
        }
        const props = parsed.data.properties;
        const isCapital =
            props.ADM0CAP === 1 || props.FEATURECLA === "Admin-0 capital";
        if (!isCapital) {
            continue;
        }
        const iso2 = props.ISO_A2;
        if (!iso2 || iso2 === "-99") {
            continue;
        }
        // First occurrence wins (deterministic tie-break for the handful of
        // countries with multiple recognized capitals, e.g. South Africa,
        // Bolivia, Ivory Coast — see source.md).
        if (!capitalsByIso2.has(iso2)) {
            capitalsByIso2.set(iso2, {
                lat: props.LATITUDE,
                lon: props.LONGITUDE,
                name: props.NAME_EN,
            });
        }
    }

    return capitalsByIso2;
}

async function main(): Promise<void> {
    const countriesPath = await ensureRawFile(
        COUNTRIES_URL,
        "ne_50m_admin_0_countries.geojson",
    );
    const placesPath = await ensureRawFile(
        PLACES_URL,
        "ne_50m_populated_places.geojson",
    );

    const countriesRaw = geoJsonSchema.parse(
        JSON.parse(await readFile(countriesPath, "utf-8")),
    );
    const placesRaw = geoJsonSchema.parse(
        JSON.parse(await readFile(placesPath, "utf-8")),
    );

    const capitalsByIso2 = buildCapitalIndex(placesRaw.features);

    type PlaceDraft = Omit<Place, "landBorders">;
    const drafts: PlaceDraft[] = [];
    const ringSets: RingSet[] = [];
    const skipped: string[] = [];
    const seenIso2 = new Set<string>();

    for (const feature of countriesRaw.features) {
        const parsed = countryFeatureSchema.safeParse(feature);
        if (!parsed.success) {
            continue;
        }
        const props = parsed.data.properties;

        // Sovereign, UN-recognized states only. `TYPE === "Sovereign
        // country"` alone is NOT sufficient: Natural Earth splits any
        // country that also has overseas territories (France, the UK, the
        // Netherlands, Denmark, Australia, New Zealand, Finland, the USA,
        // China, Kazakhstan, Cuba, Israel — 12 real countries) into a
        // metropolitan-only row typed "Country" or "Sovereignty" plus
        // separate "Dependency" rows for each territory, with no
        // "Sovereign country" row at all for the metropolitan part. Using
        // `TYPE` alone silently dropped all twelve — a bug found and fixed
        // in this codebase's history; see source.md for the full writeup.
        //
        // The reliable discriminator is `SOVEREIGNT === ADMIN`: true only
        // for a record that represents itself (a real country, whichever
        // TYPE label Natural Earth gives its metropolitan row), false for a
        // dependency/constituent territory (whose ADMIN is itself but
        // SOVEREIGNT names the parent state, e.g. Jersey/SOVEREIGNT="United
        // Kingdom"). `UN_A3 !== "-099"` excludes contested states with no UN
        // M49 code at all (Taiwan, Somaliland, Kosovo). `TYPE !==
        // "Indeterminate"` excludes the two remaining self-administered-but-
        // not-a-country cases that pass both other checks: Western Sahara
        // and Antarctica.
        if (
            props.SOVEREIGNT !== props.ADMIN ||
            props.UN_A3 === "-099" ||
            props.TYPE === "Indeterminate"
        ) {
            continue;
        }

        // Natural Earth records Norway's ISO_A2/ISO_A3 as "-99" in this
        // file; the "_EH" (enhanced) columns carry the real codes. Fall
        // back to them.
        const iso2 = props.ISO_A2 === "-99" ? props.ISO_A2_EH : props.ISO_A2;
        const iso3 = props.ISO_A3 === "-99" ? props.ISO_A3_EH : props.ISO_A3;

        if (seenIso2.has(iso2)) {
            skipped.push(
                `${props.NAME_EN} (${iso2}): duplicate ISO_A2 after resolution`,
            );
            continue;
        }

        const capital = capitalsByIso2.get(iso2);
        if (!capital) {
            skipped.push(
                `${props.NAME_EN} (${iso2}): no capital point in source data`,
            );
            continue;
        }

        seenIso2.add(iso2);
        const id = `country:${iso3.toLowerCase()}`;
        drafts.push({
            id,
            kind: "country",
            names: { en: props.NAME_EN, es: props.NAME_ES },
            point: capital,
            iso2,
            iso3,
            sourceVersion: SOURCE_VERSION,
        });
        ringSets.push({
            id,
            rings: ringsFromGeometry(parsed.data.geometry),
        });
    }

    if (drafts.length < 190) {
        throw new Error(
            `Only ${drafts.length} places produced (expected ~193) — aborting, check the filters`,
        );
    }

    const landBordersById = computeLandBorders(
        ringSets,
        ADJACENCY_THRESHOLD_KM,
    );

    const places: Place[] = drafts
        .map((draft) =>
            placeSchema.parse({
                ...draft,
                landBorders: landBordersById[draft.id] ?? [],
            } satisfies Place),
        )
        .sort((a, b) => a.id.localeCompare(b.id));

    const worldCollection: Collection = collectionSchema.parse({
        id: "world",
        names: { en: "World", es: "Mundo" },
        supportedModes: ["compass", "arrange", "borderRun"],
        places,
    } satisfies Collection);

    const header = [
        "// AUTO-GENERATED by scripts/build-world-data.ts — do not edit by hand.",
        "// Regenerate with `bun run data:build`. See src/data/world/source.md.",
        'import type { Collection } from "../../lib/data/collections.schema";',
        "",
        `export const worldCollection: Collection = ${JSON.stringify(worldCollection, null, 4)};`,
        "",
    ].join("\n");

    await mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
    await writeFile(OUTPUT_PATH, header, "utf-8");

    if (skipped.length > 0) {
        console.warn(
            `Skipped ${skipped.length} entries:\n  ${skipped.join("\n  ")}`,
        );
    }
    console.log(
        `Wrote ${places.length} places to ${path.relative(REPO_ROOT, OUTPUT_PATH)}`,
    );
}

await main();
