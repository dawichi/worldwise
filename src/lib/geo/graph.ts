import type { Place } from "../data/places.schema";

function neighborsOf(places: Place[], placeId: string): string[] {
    const place = places.find((candidate) => candidate.id === placeId);
    return place ? place.landBorders : [];
}

/**
 * BFS hop-count from `originId` to every place reachable via `landBorders`.
 * `originId` itself is included with a distance of 0. Places with no land
 * route from the origin (e.g. an unreachable island) are simply absent from
 * the returned map.
 */
export function bfsDistances(
    places: Place[],
    originId: string,
): Map<string, number> {
    const distances = new Map<string, number>([[originId, 0]]);
    const queue: string[] = [originId];

    let head = 0;
    while (head < queue.length) {
        const current = queue[head];
        head += 1;
        if (current === undefined) {
            continue;
        }
        const currentDistance = distances.get(current);
        if (currentDistance === undefined) {
            continue;
        }
        for (const neighborId of neighborsOf(places, current)) {
            if (!distances.has(neighborId)) {
                distances.set(neighborId, currentDistance + 1);
                queue.push(neighborId);
            }
        }
    }

    return distances;
}

/**
 * Shortest land-border path from `originId` to `destinationId` (inclusive of
 * both endpoints), via BFS with parent-pointer reconstruction. Returns `null`
 * if no land route exists. If `originId === destinationId`, returns a
 * single-element path.
 */
export function shortestPath(
    places: Place[],
    originId: string,
    destinationId: string,
): string[] | null {
    if (originId === destinationId) {
        return [originId];
    }

    const parents = new Map<string, string>();
    const visited = new Set<string>([originId]);
    const queue: string[] = [originId];

    let head = 0;
    let found = false;
    while (head < queue.length && !found) {
        const current = queue[head];
        head += 1;
        if (current === undefined) {
            continue;
        }
        for (const neighborId of neighborsOf(places, current)) {
            if (visited.has(neighborId)) {
                continue;
            }
            visited.add(neighborId);
            parents.set(neighborId, current);
            if (neighborId === destinationId) {
                found = true;
                break;
            }
            queue.push(neighborId);
        }
    }

    if (!visited.has(destinationId)) {
        return null;
    }

    const path: string[] = [destinationId];
    let current = destinationId;
    while (current !== originId) {
        const parent = parents.get(current);
        if (parent === undefined) {
            return null;
        }
        path.push(parent);
        current = parent;
    }
    return path.reverse();
}

/**
 * Structural validity of a submitted route: it must start at `originId`, end
 * at `destinationId`, visit no place twice (a simple path, no cycles), and
 * every consecutive pair must actually share a land border. This is the
 * single source of truth for Border Run scoring (see `modes/borderRun/score.ts`)
 * and for generation-time sanity checks — it deliberately says nothing about
 * path length, since ADR-0004 makes Border Run's scoring binary rather than
 * optimality-based.
 */
export function isValidLandRoute(
    places: Place[],
    originId: string,
    destinationId: string,
    pathIds: string[],
): boolean {
    if (pathIds.length === 0) {
        return false;
    }
    if (pathIds[0] !== originId) {
        return false;
    }
    if (pathIds[pathIds.length - 1] !== destinationId) {
        return false;
    }
    if (new Set(pathIds).size !== pathIds.length) {
        return false;
    }

    for (let i = 0; i < pathIds.length - 1; i++) {
        const current = pathIds[i];
        const next = pathIds[i + 1];
        if (current === undefined || next === undefined) {
            return false;
        }
        if (!neighborsOf(places, current).includes(next)) {
            return false;
        }
    }

    return true;
}
