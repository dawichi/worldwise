import { angularDelta } from "../../geo/angle";
import type { CompassTierConfig } from "./tiers";
import type { CompassRound } from "./types";

/**
 * Credit for a single Compass round, in [0, 1] (ADR-0008): full credit
 * within the tier's full-credit margin of the true bearing, tapering
 * linearly to zero credit by the tier's zero-credit threshold.
 */
export function scoreCompassRound(
    chosenAngleDeg: number,
    trueBearingDeg: number,
    config: CompassTierConfig,
): number {
    const delta = angularDelta(chosenAngleDeg, trueBearingDeg);

    if (delta <= config.fullCreditMarginDeg) {
        return 1;
    }
    if (delta >= config.zeroCreditThresholdDeg) {
        return 0;
    }

    const taperRange =
        config.zeroCreditThresholdDeg - config.fullCreditMarginDeg;
    const progressThroughTaper =
        (delta - config.fullCreditMarginDeg) / taperRange;
    return 1 - progressThroughTaper;
}

/** Total credit for a completed mode-challenge, out of `rounds.length`. */
export function scoreCompassChallenge(
    rounds: CompassRound[],
    chosenAnglesDeg: number[],
    config: CompassTierConfig,
): number {
    if (rounds.length !== chosenAnglesDeg.length) {
        throw new RangeError(
            `scoreCompassChallenge: expected ${rounds.length} answers, got ${chosenAnglesDeg.length}`,
        );
    }

    return rounds.reduce((total, round, index) => {
        const chosenAngleDeg = chosenAnglesDeg[index];
        if (chosenAngleDeg === undefined) {
            throw new RangeError(
                `scoreCompassChallenge: missing answer at index ${index}`,
            );
        }
        return (
            total + scoreCompassRound(chosenAngleDeg, round.bearingDeg, config)
        );
    }, 0);
}
