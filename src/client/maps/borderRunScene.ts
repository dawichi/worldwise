import type { Place } from "../../lib/data/places.schema";
import { shortestPath } from "../../lib/geo/graph";
import { shortLongitudeDelta } from "../../lib/geo/route";
import type { BorderRunRound } from "../../lib/modes/borderRun/types";
import type { RouteMapScene } from "./routeMap";

function pointsForRoute(placesById: Map<string, Place>, ids: string[]) {
    let previousLon: number | null = null;
    const points = [];
    for (const id of ids) {
        const place = placesById.get(id);
        if (!place) {
            continue;
        }
        const lon: number =
            previousLon === null
                ? place.point.lon
                : previousLon +
                  shortLongitudeDelta(previousLon, place.point.lon);
        points.push({ lat: place.point.lat, lon });
        previousLon = lon;
    }
    return points;
}

/** Creates the answer reveal comparing a player's route with the BFS optimum. */
export function createBorderRunScene(
    places: Place[],
    round: BorderRunRound,
    submittedPathIds: string[],
): RouteMapScene {
    const placesById = new Map(places.map((place) => [place.id, place]));
    const optimalPath =
        shortestPath(places, round.originId, round.destinationId) ?? [];
    const routeIds = new Set([...optimalPath, ...submittedPathIds]);
    const highlights: RouteMapScene["highlights"] = [];

    for (const id of routeIds) {
        const place = placesById.get(id);
        if (!place) {
            continue;
        }
        highlights.push({
            iso2: place.iso2,
            anchor: place.point,
            emphasis:
                id === round.originId || id === round.destinationId
                    ? "endpoint"
                    : "route",
        });
    }

    const lines: RouteMapScene["lines"] = [
        {
            points: pointsForRoute(placesById, submittedPathIds),
            style: "secondary",
        },
    ];
    if (optimalPath.length > 1) {
        lines.push({
            points: pointsForRoute(placesById, optimalPath),
            style: "primary",
        });
    }

    const origin = placesById.get(round.originId);
    const destination = placesById.get(round.destinationId);
    return {
        highlights,
        lines,
        markers: [origin?.point, destination?.point].filter(
            (point): point is NonNullable<typeof point> => point !== undefined,
        ),
    };
}
