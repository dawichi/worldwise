import type { CountryShape } from "../../data/generated/countryShapes";
import type { GeoPoint } from "../../lib/geo/bearing";
import { projectMercator } from "../../lib/geo/mercator";
import { svgElement } from "../shared/dom";

export type CountryShapes = Record<string, CountryShape>;

let shapesPromise: Promise<CountryShapes> | null = null;

/**
 * Lazily loads the country outlines (~65 KB gzipped). They are only needed
 * for map decoration, so they live in their own chunk and never block the
 * first interaction on a game page.
 */
export function loadCountryShapes(): Promise<CountryShapes> {
    shapesPromise ??= import("../../data/generated/countryShapes").then(
        (module) => module.countryShapes,
    );
    return shapesPromise;
}

export interface ViewBox {
    x: number;
    y: number;
    width: number;
    height: number;
}

export function viewBoxAttribute({ x, y, width, height }: ViewBox): string {
    return `${x.toFixed(3)} ${y.toFixed(3)} ${width.toFixed(3)} ${height.toFixed(3)}`;
}

/** Projects with an *unwrapped* longitude preserved (x may exceed ±180). */
export function project(point: GeoPoint): { x: number; y: number } {
    const { y } = projectMercator(point);
    return { x: point.lon, y };
}

/**
 * Smallest view box around `points` (padded by `paddingRatio` and at least
 * `minWidth` wide) whose proportions match `aspect` (width / height).
 */
export function fitViewBox(
    points: ReadonlyArray<{ x: number; y: number }>,
    aspect: number,
    minWidth: number,
    paddingRatio = 0.18,
): ViewBox {
    const xs = points.map((point) => point.x);
    const ys = points.map((point) => point.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    let width = Math.max(maxX - minX, minWidth / (1 + 2 * paddingRatio));
    let height = maxY - minY;
    width *= 1 + 2 * paddingRatio;
    height *= 1 + 2 * paddingRatio;
    if (width / aspect < height) {
        width = height * aspect;
    } else {
        height = width / aspect;
    }
    return {
        x: (minX + maxX) / 2 - width / 2,
        y: (minY + maxY) / 2 - height / 2,
        width,
        height,
    };
}

export function countryPath(
    shape: CountryShape,
    className: string,
    offsetX = 0,
): SVGPathElement {
    const path = svgElement("path", {
        d: shape.d,
        class: className,
        "vector-effect": "non-scaling-stroke",
        "stroke-linejoin": "round",
    });
    if (offsetX !== 0) {
        path.setAttribute("transform", `translate(${offsetX} 0)`);
    }
    return path;
}

/**
 * Draws every country into `layer` once, then repeats the layer one world
 * to the west and one to the east, so views and routes that cross the
 * antimeridian (x beyond ±180) still sit on continuous land.
 */
export function drawWrappedWorld(
    layer: SVGGElement,
    shapes: CountryShapes,
    className: string,
    id: string,
): void {
    const world = svgElement("g", { id });
    for (const shape of Object.values(shapes)) {
        world.append(countryPath(shape, className));
    }
    layer.replaceChildren(
        world,
        svgElement("use", { href: `#${id}`, x: -360 }),
        svgElement("use", { href: `#${id}`, x: 360 }),
    );
}

/** Longitude offset (a multiple of 360) that brings `lon` next to `referenceLon`. */
export function wrapOffset(lon: number, referenceLon: number): number {
    return Math.round((referenceLon - lon) / 360) * 360;
}

export function polylinePoints(
    points: ReadonlyArray<{ x: number; y: number }>,
): string {
    return points
        .map((point) => `${point.x.toFixed(3)},${point.y.toFixed(3)}`)
        .join(" ");
}
