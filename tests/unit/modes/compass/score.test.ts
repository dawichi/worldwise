import { describe, expect, it } from "vitest";
import {
    scoreCompassChallenge,
    scoreCompassRound,
} from "../../../../src/lib/modes/compass/score";
import { COMPASS_TIERS } from "../../../../src/lib/modes/compass/tiers";
import type { CompassRound } from "../../../../src/lib/modes/compass/types";

const medium = COMPASS_TIERS.medium;

describe("scoreCompassRound", () => {
    it("gives full credit for an exact match", () => {
        expect(scoreCompassRound(135, 135, medium)).toBe(1);
    });

    it("gives full credit anywhere within the full-credit margin", () => {
        expect(
            scoreCompassRound(135, 135 + medium.fullCreditMarginDeg, medium),
        ).toBe(1);
        expect(
            scoreCompassRound(135, 135 - medium.fullCreditMarginDeg, medium),
        ).toBe(1);
        expect(scoreCompassRound(140, 135, medium)).toBe(1);
    });

    it("gives zero credit at or beyond the zero-credit threshold", () => {
        expect(
            scoreCompassRound(135 + medium.zeroCreditThresholdDeg, 135, medium),
        ).toBe(0);
        expect(scoreCompassRound(315, 135, medium)).toBe(0); // exactly opposite
    });

    it("tapers linearly between the two boundaries", () => {
        // medium: margin 15, threshold 90 — midpoint of the taper range is
        // delta 52.5, which should score exactly 0.5.
        const midpointDelta =
            medium.fullCreditMarginDeg +
            (medium.zeroCreditThresholdDeg - medium.fullCreditMarginDeg) / 2;
        expect(scoreCompassRound(0, midpointDelta, medium)).toBeCloseTo(0.5, 9);

        // A quarter of the way through the taper should score 0.75.
        const quarterDelta =
            medium.fullCreditMarginDeg +
            (medium.zeroCreditThresholdDeg - medium.fullCreditMarginDeg) * 0.25;
        expect(scoreCompassRound(0, quarterDelta, medium)).toBeCloseTo(0.75, 9);
    });

    it("handles wraparound: a small true angular error near 0/360 still scores as small", () => {
        expect(scoreCompassRound(359, 1, medium)).toBe(1); // 2° apart, well within margin
        expect(scoreCompassRound(1, 359, medium)).toBe(1);
    });

    it("never returns a value outside [0, 1]", () => {
        for (let delta = 0; delta <= 180; delta += 5) {
            const credit = scoreCompassRound(0, delta, medium);
            expect(credit).toBeGreaterThanOrEqual(0);
            expect(credit).toBeLessThanOrEqual(1);
        }
    });

    it("hard tier is stricter than easy tier for the same angular error", () => {
        const delta = 30;
        const easyCredit = scoreCompassRound(0, delta, COMPASS_TIERS.easy);
        const hardCredit = scoreCompassRound(0, delta, COMPASS_TIERS.hard);
        expect(hardCredit).toBeLessThan(easyCredit);
    });
});

describe("scoreCompassChallenge", () => {
    const rounds: CompassRound[] = [
        { originId: "a", destinationId: "b", bearingDeg: 0, distanceKm: 1000 },
        { originId: "c", destinationId: "d", bearingDeg: 90, distanceKm: 1000 },
        {
            originId: "e",
            destinationId: "f",
            bearingDeg: 180,
            distanceKm: 1000,
        },
    ];

    it("sums per-round credit across the whole challenge", () => {
        // Exact, exact, and completely wrong (180° off).
        const total = scoreCompassChallenge(rounds, [0, 90, 0], medium);
        expect(total).toBeCloseTo(2, 9);
    });

    it("gives a perfect score of rounds.length when every answer is exact", () => {
        const total = scoreCompassChallenge(rounds, [0, 90, 180], medium);
        expect(total).toBe(3);
    });

    it("throws if the answer count does not match the round count", () => {
        expect(() => scoreCompassChallenge(rounds, [0, 90], medium)).toThrow(
            RangeError,
        );
    });
});
