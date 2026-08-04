import { compassCountryGeoShapes } from "../data/generated/compassShapes";
import type { Collection } from "../lib/data/collections.schema";
import type { Place } from "../lib/data/places.schema";

const SVG_NAMESPACE = "http://www.w3.org/2000/svg";

function pathForPlace(place: Place, className: string): SVGPathElement | null {
    const shape = compassCountryGeoShapes[place.iso2];
    if (!shape) {
        return null;
    }
    const path = document.createElementNS(SVG_NAMESPACE, "path");
    path.setAttribute("d", shape.path);
    path.setAttribute("class", className);
    path.setAttribute("stroke-width", "0.05");
    path.setAttribute("stroke-linejoin", "round");
    path.dataset.countryId = place.id;
    return path;
}

export interface CompassMapController {
    render: (origin: Place) => void;
}

export function createCompassMapController(
    root: HTMLElement,
    collection: Collection,
): CompassMapController {
    const mapSvg = root.querySelector<SVGSVGElement>('[data-role="map-svg"]');
    const context = root.querySelector<SVGGElement>(
        '[data-role="map-context"]',
    );
    if (!mapSvg || !context) {
        throw new Error("compassMap: missing map elements");
    }
    const mapSvgElement = mapSvg;
    const contextElement = context;

    function render(origin: Place): void {
        const originShape = compassCountryGeoShapes[origin.iso2];
        if (!originShape) {
            return;
        }

        const originWidth =
            originShape.bounds.maxLon - originShape.bounds.minLon;
        const originHeight =
            originShape.bounds.maxLat - originShape.bounds.minLat;
        const paddingLon = Math.max(originWidth * 0.72, 2.5);
        const paddingLat = Math.max(originHeight * 0.72, 2.5);
        const minLon = originShape.bounds.minLon - paddingLon;
        const maxLon = originShape.bounds.maxLon + paddingLon;
        const minLat = originShape.bounds.minLat - paddingLat;
        const maxLat = originShape.bounds.maxLat + paddingLat;
        mapSvgElement.setAttribute(
            "viewBox",
            `${minLon} ${-maxLat} ${maxLon - minLon} ${maxLat - minLat}`,
        );

        contextElement.replaceChildren();
        for (const neighborId of origin.landBorders) {
            const neighbor = collection.places.find(
                (place) => place.id === neighborId,
            );
            if (!neighbor) {
                continue;
            }
            const neighborPath = pathForPlace(
                neighbor,
                "fill-chip stroke-border",
            );
            if (neighborPath) {
                contextElement.append(neighborPath);
            }
        }

        const originPath = pathForPlace(origin, "fill-accent/45 stroke-accent");
        if (originPath) {
            originPath.dataset.role = "origin-map";
            originPath.setAttribute("stroke-width", "0.08");
            contextElement.append(originPath);
        }
    }

    return { render };
}
