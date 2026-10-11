import type { GeoPoint } from "../../lib/geo/bearing";
import { byRole, svgElement } from "../shared/dom";
import {
    type CountryShapes,
    countryPath,
    drawWrappedWorld,
    fitViewBox,
    loadCountryShapes,
    project,
    type ViewBox,
    viewBoxAttribute,
    wrapOffset,
} from "./worldMap";

export type RouteLineStyle = "primary" | "secondary";

export interface RouteLine {
    /** Points with unwrapped longitudes (see `greatCirclePoints`). */
    points: GeoPoint[];
    style: RouteLineStyle;
}

export interface RouteHighlight {
    iso2: string;
    /** A point inside the place (unwrapped), used to place the outline on the same world copy as the route. */
    anchor: GeoPoint;
    emphasis: "endpoint" | "route";
}

export interface RouteMapScene {
    highlights: RouteHighlight[];
    lines: RouteLine[];
    markers: GeoPoint[];
    /** Optional player arrow drawn from a point at a compass bearing. */
    arrow?: { from: GeoPoint; bearingDeg: number; color: string };
    /** Minimum view width in Mercator degree units (keeps short routes in context). */
    minWidth?: number;
}

export interface RouteMapController {
    show: (scene: RouteMapScene) => Promise<void>;
    hide: () => void;
}

const ASPECT = 2;

const HIGHLIGHT_CLASS: Record<RouteHighlight["emphasis"], string> = {
    endpoint: "fill-accent/50 stroke-accent",
    route: "fill-accent/25 stroke-accent",
};

function linePath(points: GeoPoint[]): string {
    return points
        .map((point, index) => {
            const { x, y } = project(point);
            return `${index === 0 ? "M" : "L"}${x.toFixed(3)} ${y.toFixed(3)}`;
        })
        .join(" ");
}

function shapeCenterX(shapes: CountryShapes, iso2: string): number | null {
    const shape = shapes[iso2];
    return shape ? (shape.bounds.minX + shape.bounds.maxX) / 2 : null;
}

/**
 * A small Mercator map that explains a round after it's answered: country
 * highlights, route lines, endpoint markers, and optionally the player's
 * arrow. Mercator is conformal, so an arrow drawn at the origin at a given
 * bearing points the same way it did on the dial.
 */
export function createRouteMap(root: HTMLElement): RouteMapController {
    const svg = byRole<SVGSVGElement>(root, "route-svg");
    const worldLayer = byRole<SVGGElement>(root, "route-world");
    const highlightLayer = byRole<SVGGElement>(root, "route-highlight");
    const lineLayer = byRole<SVGGElement>(root, "route-lines");
    let worldDrawn = false;
    let renderVersion = 0;

    function drawLines(scene: RouteMapScene, view: ViewBox): void {
        const unit = view.width / 200;
        const elements: SVGElement[] = [];
        for (const line of scene.lines) {
            const path = svgElement("path", {
                d: linePath(line.points),
                fill: "none",
                "stroke-linecap": "round",
                "stroke-linejoin": "round",
            });
            if (line.style === "primary") {
                path.setAttribute("class", "route-line-primary stroke-accent");
                path.setAttribute("stroke-width", String(2.4 * unit));
                path.setAttribute("pathLength", "1");
            } else {
                path.setAttribute("class", "stroke-text-muted");
                path.setAttribute("stroke-width", String(1.4 * unit));
                path.setAttribute(
                    "stroke-dasharray",
                    `${4 * unit} ${3 * unit}`,
                );
            }
            elements.push(path);
        }

        if (scene.arrow) {
            const start = project(scene.arrow.from);
            const length = view.width * 0.16;
            const radians = (scene.arrow.bearingDeg * Math.PI) / 180;
            const end = {
                x: start.x + Math.sin(radians) * length,
                y: start.y - Math.cos(radians) * length,
            };
            const head = 3.2 * unit;
            const left = radians + Math.PI * 0.82;
            const right = radians - Math.PI * 0.82;
            elements.push(
                svgElement("line", {
                    x1: start.x,
                    y1: start.y,
                    x2: end.x,
                    y2: end.y,
                    stroke: scene.arrow.color,
                    "stroke-width": 2 * unit,
                    "stroke-linecap": "round",
                }),
                svgElement("path", {
                    d: `M${end.x} ${end.y} L${end.x + Math.sin(left) * head} ${end.y - Math.cos(left) * head} L${end.x + Math.sin(right) * head} ${end.y - Math.cos(right) * head} Z`,
                    fill: scene.arrow.color,
                }),
            );
        }

        for (const marker of scene.markers) {
            const { x, y } = project(marker);
            elements.push(
                svgElement("circle", {
                    cx: x,
                    cy: y,
                    r: 2.6 * unit,
                    class: "fill-text stroke-surface",
                    "stroke-width": unit,
                }),
            );
        }
        lineLayer.replaceChildren(...elements);
    }

    async function show(scene: RouteMapScene): Promise<void> {
        renderVersion += 1;
        const version = renderVersion;
        const shapes = await loadCountryShapes();
        if (version !== renderVersion) {
            return;
        }
        if (!worldDrawn) {
            drawWrappedWorld(
                worldLayer,
                shapes,
                "fill-land stroke-land-edge",
                `${root.id}-world`,
            );
            worldDrawn = true;
        }

        const projected = [
            ...scene.lines.flatMap((line) => line.points),
            ...scene.markers,
        ].map(project);
        const view = fitViewBox(projected, ASPECT, scene.minWidth ?? 24);
        svg.setAttribute("viewBox", viewBoxAttribute(view));

        const highlights: SVGElement[] = [];
        for (const highlight of scene.highlights) {
            const shape = shapes[highlight.iso2];
            const centerX = shapeCenterX(shapes, highlight.iso2);
            if (!shape || centerX === null) {
                continue;
            }
            highlights.push(
                countryPath(
                    shape,
                    HIGHLIGHT_CLASS[highlight.emphasis],
                    wrapOffset(centerX, highlight.anchor.lon),
                ),
            );
        }
        highlightLayer.replaceChildren(...highlights);
        drawLines(scene, view);

        root.classList.remove("hidden");
        // Restart the draw-on animation for every reveal.
        root.dataset.revealed = "false";
        void root.getBoundingClientRect();
        root.dataset.revealed = "true";
    }

    function hide(): void {
        renderVersion += 1;
        root.classList.add("hidden");
        root.dataset.revealed = "false";
        highlightLayer.replaceChildren();
        lineLayer.replaceChildren();
    }

    return { show, hide };
}
