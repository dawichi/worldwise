import type { Place } from "../../data/places.schema";
import { isValidLandRoute, shortestPath } from "../../geo/graph";
import type { BorderRunRound } from "./types";

export interface BorderRunRouteAssessment {
    isValid: boolean;
    shortestHops: number;
    submittedHops: number;
    hopBudget: number;
    credit: number;
}

/**
 * Scores a route by its efficiency. A shortest valid route earns full credit;
 * a valid route within the visible hop budget receives proportional partial
 * credit. Invalid and over-budget routes score zero.
 */
export function assessBorderRunRoute(
    places: Place[],
    round: BorderRunRound,
    submittedPathIds: string[],
    maxExtraHops: number,
): BorderRunRouteAssessment {
    const optimalPath = shortestPath(
        places,
        round.originId,
        round.destinationId,
    );
    const shortestHops = Math.max((optimalPath?.length ?? 1) - 1, 0);
    const submittedHops = Math.max(submittedPathIds.length - 1, 0);
    const hopBudget = shortestHops + Math.max(0, Math.floor(maxExtraHops));
    const isValid = isValidLandRoute(
        places,
        round.originId,
        round.destinationId,
        submittedPathIds,
    );
    const credit =
        isValid &&
        optimalPath !== null &&
        submittedHops <= hopBudget &&
        submittedHops > 0
            ? shortestHops / submittedHops
            : 0;

    return { isValid, shortestHops, submittedHops, hopBudget, credit };
}

/**
 * Credit for a single Border Run round. The default allows no extra hops,
 * keeping this helper useful for checking whether a path is optimal.
 */
export function scoreBorderRunRound(
    places: Place[],
    round: BorderRunRound,
    submittedPathIds: string[],
    maxExtraHops = 0,
): number {
    return assessBorderRunRoute(places, round, submittedPathIds, maxExtraHops)
        .credit;
}

/** Total credit for a completed mode-challenge, out of `rounds.length`. */
export function scoreBorderRunChallenge(
    places: Place[],
    rounds: BorderRunRound[],
    submittedPaths: string[][],
    maxExtraHops = 0,
): number {
    if (rounds.length !== submittedPaths.length) {
        throw new RangeError(
            `scoreBorderRunChallenge: expected ${rounds.length} submitted paths, got ${submittedPaths.length}`,
        );
    }

    return rounds.reduce((total, round, index) => {
        const submittedPathIds = submittedPaths[index];
        if (submittedPathIds === undefined) {
            throw new RangeError(
                `scoreBorderRunChallenge: missing submitted path at index ${index}`,
            );
        }
        return (
            total +
            scoreBorderRunRound(places, round, submittedPathIds, maxExtraHops)
        );
    }, 0);
}
