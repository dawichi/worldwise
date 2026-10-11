/**
 * Builds the committed country outlines used by Worldwise's maps from the
 * Natural Earth 1:50m Admin-0 file cached by `bun run data:build`:
 *
 * - `src/data/generated/countryShapes.ts` — every country's land outline in
 *   Mercator "degree units" (see `src/lib/geo/mercator.ts`), used by the
 *   Compass context map and by the reveal maps (Compass great-circle route,
 *   Border Run route). It is loaded lazily by the client, never in the
 *   initial bundle.
 * - `src/data/generated/countryThumbnails.ts` — a tiny normalized 100×100
 *   silhouette per country for result-list thumbnails.
 *
 * Run manually via `bun run data:build:shapes`.
 */
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { projectMercator } from "../src/lib/geo/mercator";

const root = path.join(import.meta.dirname, "..");
const inputPath = path.join(
    root,
    ".data",
    "raw",
    "ne_50m_admin_0_countries.geojson",
);
const generatedDir = path.join(root, "src", "data", "generated");

interface Feature {
    properties?: {
        ADMIN?: string;
        SOVEREIGNT?: string;
        UN_A3?: string;
        TYPE?: string;
        ISO_A2?: string;
        ISO_A2_EH?: string;
    };
    geometry?: {
        type: "Polygon" | "MultiPolygon";
        coordinates: unknown;
    };
}

type Point = [number, number];

/** Rings smaller than this fraction of a country's largest ring are dropped
 * (tiny islets add bytes but are invisible at every zoom Worldwise uses). */
const MIN_RING_AREA_RATIO = 0.004;
/** Absolute floor, in squared Mercator degree units. */
const MIN_RING_AREA = 0.02;

function ringArea(ring: Point[]): number {
    let area = 0;
    for (let index = 0; index < ring.length; index += 1) {
        const current = ring[index];
        const next = ring[(index + 1) % ring.length];
        if (!current || !next) continue;
        area += current[0] * next[1] - next[0] * current[1];
    }
    return Math.abs(area / 2);
}

function perpendicularDistance(point: Point, start: Point, end: Point): number {
    const dx = end[0] - start[0];
    const dy = end[1] - start[1];
    const lengthSquared = dx * dx + dy * dy;
    if (lengthSquared === 0) {
        return Math.hypot(point[0] - start[0], point[1] - start[1]);
    }
    const t = Math.max(
        0,
        Math.min(
            1,
            ((point[0] - start[0]) * dx + (point[1] - start[1]) * dy) /
                lengthSquared,
        ),
    );
    return Math.hypot(
        point[0] - (start[0] + t * dx),
        point[1] - (start[1] + t * dy),
    );
}

/** Iterative Douglas–Peucker: keeps the points that matter to the outline's
 * shape instead of sampling every n-th vertex. */
function douglasPeucker(points: Point[], tolerance: number): Point[] {
    if (points.length <= 3) return points;
    const keep = new Array<boolean>(points.length).fill(false);
    keep[0] = true;
    keep[points.length - 1] = true;
    const stack: Array<[number, number]> = [[0, points.length - 1]];
    while (stack.length > 0) {
        const range = stack.pop();
        if (!range) break;
        const [first, last] = range;
        const start = points[first];
        const end = points[last];
        if (!start || !end) continue;
        let maxDistance = 0;
        let maxIndex = -1;
        for (let index = first + 1; index < last; index += 1) {
            const point = points[index];
            if (!point) continue;
            const distance = perpendicularDistance(point, start, end);
            if (distance > maxDistance) {
                maxDistance = distance;
                maxIndex = index;
            }
        }
        if (maxIndex !== -1 && maxDistance > tolerance) {
            keep[maxIndex] = true;
            stack.push([first, maxIndex], [maxIndex, last]);
        }
    }
    return points.filter((_, index) => keep[index]);
}

function project(ring: Point[]): Point[] {
    return ring.map(([lon, lat]) => {
        const { x, y } = projectMercator({ lat, lon });
        return [x, y];
    });
}

function boundsOf(rings: Point[][]): {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
} {
    const bounds = {
        minX: Infinity,
        maxX: -Infinity,
        minY: Infinity,
        maxY: -Infinity,
    };
    for (const ring of rings) {
        for (const [x, y] of ring) {
            bounds.minX = Math.min(bounds.minX, x);
            bounds.maxX = Math.max(bounds.maxX, x);
            bounds.minY = Math.min(bounds.minY, y);
            bounds.maxY = Math.max(bounds.maxY, y);
        }
    }
    return {
        minX: Number(bounds.minX.toFixed(2)),
        maxX: Number(bounds.maxX.toFixed(2)),
        minY: Number(bounds.minY.toFixed(2)),
        maxY: Number(bounds.maxY.toFixed(2)),
    };
}

/** Compact path: absolute first point, then relative `l` segments, which
 * keeps most numbers to a handful of characters. */
function toPathData(ring: Point[], decimals: number): string {
    const factor = 10 ** decimals;
    const rounded = ring.map(
        ([x, y]) =>
            [Math.round(x * factor), Math.round(y * factor)] as [
                number,
                number,
            ],
    );
    const first = rounded[0];
    if (!first) return "";
    const parts = [`M${first[0] / factor} ${first[1] / factor}`];
    let previous = first;
    let segment: string[] = [];
    for (const point of rounded.slice(1)) {
        const dx = point[0] - previous[0];
        const dy = point[1] - previous[1];
        if (dx === 0 && dy === 0) continue;
        segment.push(`${dx / factor} ${dy / factor}`);
        previous = point;
    }
    if (segment.length > 0) {
        parts.push(`l${segment.join(" ")}`);
        segment = [];
    }
    return `${parts.join("")}z`.replaceAll(" -", "-");
}

/** Normalizes a ring into a centered 100×100 box for thumbnails. */
function toThumbnail(ring: Point[]): string {
    const { minX, maxX, minY, maxY } = boundsOf([ring]);
    const width = Math.max(maxX - minX, 0.01);
    const height = Math.max(maxY - minY, 0.01);
    const scale = 84 / Math.max(width, height);
    const offsetX = (100 - width * scale) / 2;
    const offsetY = (100 - height * scale) / 2;
    const normalized = ring.map(
        ([x, y]) =>
            [offsetX + (x - minX) * scale, offsetY + (y - minY) * scale] as [
                number,
                number,
            ],
    );
    return toPathData(douglasPeucker(normalized, 1.2), 0);
}

const raw = JSON.parse(await readFile(inputPath, "utf8")) as {
    features: Feature[];
};
const shapes: Record<
    string,
    {
        d: string;
        bounds: { minX: number; maxX: number; minY: number; maxY: number };
    }
> = {};
const thumbnails: Record<string, string> = {};

for (const feature of raw.features) {
    const properties = feature.properties;
    const geometry = feature.geometry;
    // Same country filter as scripts/build-world-data.ts (see source.md).
    if (
        !properties ||
        !geometry ||
        properties.SOVEREIGNT !== properties.ADMIN ||
        properties.UN_A3 === "-099" ||
        properties.TYPE === "Indeterminate"
    )
        continue;

    const iso2 =
        properties.ISO_A2 === "-99" ? properties.ISO_A2_EH : properties.ISO_A2;
    if (!iso2 || !geometry.coordinates) continue;

    // Exterior rings only: holes (lakes, enclaves) are invisible at map scale.
    const exteriors: Point[][] =
        geometry.type === "Polygon"
            ? [(geometry.coordinates as Point[][])[0] ?? []]
            : (geometry.coordinates as Point[][][]).map(
                  (polygon) => polygon[0] ?? [],
              );
    const projected = exteriors
        .map(project)
        .sort((a, b) => ringArea(b) - ringArea(a));
    const largest = projected[0];
    if (!largest) continue;
    const largestArea = ringArea(largest);
    const kept = projected.filter(
        (ring) =>
            ring === largest ||
            ringArea(ring) >=
                Math.max(MIN_RING_AREA, largestArea * MIN_RING_AREA_RATIO),
    );

    // Scale the simplification tolerance with the country's size so
    // micro-states keep their outline while continents lose noise.
    const mainBounds = boundsOf([largest]);
    const span = Math.max(
        mainBounds.maxX - mainBounds.minX,
        mainBounds.maxY - mainBounds.minY,
    );
    const tolerance = Math.min(0.12, Math.max(0.01, span * 0.006));

    shapes[iso2] = {
        d: kept
            .map((ring) => toPathData(douglasPeucker(ring, tolerance), 2))
            .join(""),
        // The *main* landmass frames the Compass context map (France's crop
        // should not stretch to include French Guiana).
        bounds: mainBounds,
    };
    thumbnails[iso2] = toThumbnail(largest);
}

const shapeHeader = `// AUTO-GENERATED by scripts/build-country-shapes.ts — do not edit by hand.
// Regenerate with \`bun run data:build:shapes\`. Coordinates are Mercator
// "degree units" (see src/lib/geo/mercator.ts), y grows southward.

export interface CountryShape {
    /** SVG path data for every significant landmass of the country. */
    d: string;
    /** Bounds of the main landmass, in the same projected units. */
    bounds: { minX: number; maxX: number; minY: number; maxY: number };
}

`;
await writeFile(
    path.join(generatedDir, "countryShapes.ts"),
    `${shapeHeader}export const countryShapes: Record<string, CountryShape> = ${JSON.stringify(shapes)};\n`,
    "utf8",
);
await writeFile(
    path.join(generatedDir, "countryThumbnails.ts"),
    `// AUTO-GENERATED by scripts/build-country-shapes.ts — do not edit by hand.
// Main-landmass silhouette per ISO 3166-1 alpha-2 code, normalized to a
// centered 100×100 box.

export const countryThumbnails: Record<string, string> = ${JSON.stringify(thumbnails)};\n`,
    "utf8",
);
console.log(`Wrote ${Object.keys(shapes).length} country shapes`);
