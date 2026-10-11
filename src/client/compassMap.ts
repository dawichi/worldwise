import type { Place } from "../lib/data/places.schema";
import {
    countryPath,
    drawWrappedWorld,
    loadCountryShapes,
    viewBoxAttribute,
} from "./maps/worldMap";
import { byRole } from "./shared/dom";

export interface CompassMapController {
    render: (origin: Place) => void;
}

/**
 * The context map behind the Compass dial: the world in Mercator (the
 * projection is conformal, so north-up directions at the origin match the
 * dial exactly), framed on the origin country's main landmass.
 */
export function createCompassMapController(
    root: HTMLElement,
): CompassMapController {
    const mapSvg = byRole<SVGSVGElement>(root, "map-svg");
    const worldLayer = byRole<SVGGElement>(root, "map-world");
    const contextLayer = byRole<SVGGElement>(root, "map-context");
    let worldDrawn = false;
    let renderToken = 0;

    function render(origin: Place): void {
        renderToken += 1;
        const token = renderToken;
        void loadCountryShapes().then((shapes) => {
            // A later round may have started while the shapes were loading.
            if (token !== renderToken) {
                return;
            }
            if (!worldDrawn) {
                drawWrappedWorld(
                    worldLayer,
                    shapes,
                    "fill-land stroke-land-edge",
                    "compass-context-world",
                );
                worldDrawn = true;
            }

            const originShape = shapes[origin.iso2];
            if (!originShape) {
                contextLayer.replaceChildren();
                return;
            }
            const { minX, maxX, minY, maxY } = originShape.bounds;
            const paddingX = Math.max((maxX - minX) * 0.72, 2.5);
            const paddingY = Math.max((maxY - minY) * 0.72, 2.5);
            mapSvg.setAttribute(
                "viewBox",
                viewBoxAttribute({
                    x: minX - paddingX,
                    y: minY - paddingY,
                    width: maxX - minX + 2 * paddingX,
                    height: maxY - minY + 2 * paddingY,
                }),
            );

            const originPath = countryPath(
                originShape,
                "fill-accent/45 stroke-accent",
            );
            originPath.dataset.role = "origin-map";
            originPath.setAttribute("stroke-width", "1.5");
            contextLayer.replaceChildren(originPath);
        });
    }

    return { render };
}
