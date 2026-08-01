import type { ArrangeRound } from "./types";

/**
 * Credit for a single Arrange round, in [0, 1]: the fraction of positions
 * where `submittedOrderIds[i] === correctOrderIds[i]`. This is ADR-0004's
 * "proportional credit for a partially-correct sequence" for Arrange — the
 * exact formula isn't written down elsewhere, hence this comment. Order
 * matters: a rotation or full reversal of the correct set scores based on
 * how many positions happen to still line up, not on "containing the right
 * items."
 */
export function scoreArrangeRound(
    correctOrderIds: string[],
    submittedOrderIds: string[],
): number {
    if (correctOrderIds.length !== submittedOrderIds.length) {
        throw new RangeError(
            `scoreArrangeRound: expected ${correctOrderIds.length} submitted ids, got ${submittedOrderIds.length}`,
        );
    }

    const matches = correctOrderIds.filter(
        (id, index) => id === submittedOrderIds[index],
    ).length;
    return matches / correctOrderIds.length;
}

/** Total credit for a completed mode-challenge, out of `rounds.length`. */
export function scoreArrangeChallenge(
    rounds: ArrangeRound[],
    submittedOrders: string[][],
): number {
    if (rounds.length !== submittedOrders.length) {
        throw new RangeError(
            `scoreArrangeChallenge: expected ${rounds.length} submitted orders, got ${submittedOrders.length}`,
        );
    }

    return rounds.reduce((total, round, index) => {
        const submittedOrderIds = submittedOrders[index];
        if (submittedOrderIds === undefined) {
            throw new RangeError(
                `scoreArrangeChallenge: missing submitted order at index ${index}`,
            );
        }
        return (
            total + scoreArrangeRound(round.correctOrderIds, submittedOrderIds)
        );
    }, 0);
}
