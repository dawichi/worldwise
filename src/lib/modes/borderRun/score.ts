import type { Place } from "../../data/places.schema";
import { isValidLandRoute } from "../../geo/graph";
import type { BorderRunRound } from "./types";

/**
 * Credit for a single Border Run round: 1 if the submitted path is a valid
 * land route from the round's origin to its destination, 0 otherwise
 * (ADR-0004: Border Run is binary, a connectivity puzzle has no natural
 * partial-credit notion).
 */
export function scoreBorderRunRound(
    places: Place[],
    round: BorderRunRound,
    submittedPathIds: string[],
): number {
    return isValidLandRoute(
        places,
        round.originId,
        round.destinationId,
        submittedPathIds,
    )
        ? 1
        : 0;
}

/** Total credit for a completed mode-challenge, out of `rounds.length`. */
export function scoreBorderRunChallenge(
    places: Place[],
    rounds: BorderRunRound[],
    submittedPaths: string[][],
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
        return total + scoreBorderRunRound(places, round, submittedPathIds);
    }, 0);
}
