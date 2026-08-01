import { describe, expect, it } from "vitest";
import {
    scoreArrangeChallenge,
    scoreArrangeRound,
} from "../../../../src/lib/modes/arrange/score";
import type { ArrangeRound } from "../../../../src/lib/modes/arrange/types";

describe("scoreArrangeRound", () => {
    it("gives full credit for an exact match", () => {
        expect(
            scoreArrangeRound(["a", "b", "c", "d"], ["a", "b", "c", "d"]),
        ).toBe(1);
    });

    it("gives zero credit when nothing lines up", () => {
        expect(
            scoreArrangeRound(["a", "b", "c", "d"], ["d", "c", "b", "a"]),
        ).toBe(0);
    });

    it("gives proportional credit for a partially-correct sequence", () => {
        // 2 of 4 in place, matching the mockup's own framing.
        expect(
            scoreArrangeRound(["a", "b", "c", "d"], ["a", "b", "d", "c"]),
        ).toBe(0.5);
    });

    it("does not give full credit for a rotation that contains the right items", () => {
        expect(
            scoreArrangeRound(["a", "b", "c", "d"], ["b", "c", "d", "a"]),
        ).toBe(0);
    });

    it("does not give full credit for a full reversal", () => {
        expect(scoreArrangeRound(["a", "b", "c"], ["c", "b", "a"])).toBeCloseTo(
            1 / 3,
            9,
        );
    });

    it("throws when the submitted length does not match", () => {
        expect(() => scoreArrangeRound(["a", "b", "c"], ["a", "b"])).toThrow(
            RangeError,
        );
    });
});

describe("scoreArrangeChallenge", () => {
    const rounds: ArrangeRound[] = [
        {
            variant: "north-to-south",
            itemIds: ["a", "b"],
            correctOrderIds: ["a", "b"],
        },
        {
            variant: "west-to-east",
            itemIds: ["c", "d"],
            correctOrderIds: ["c", "d"],
        },
        {
            variant: "closest-to-farthest",
            itemIds: ["e", "f"],
            correctOrderIds: ["e", "f"],
            referenceId: "ref",
        },
    ];

    it("sums per-round credit across the whole challenge", () => {
        const total = scoreArrangeChallenge(rounds, [
            ["a", "b"], // full credit
            ["d", "c"], // zero credit
            ["e", "f"], // full credit
        ]);
        expect(total).toBeCloseTo(2, 9);
    });

    it("throws if the submitted-order count does not match the round count", () => {
        expect(() => scoreArrangeChallenge(rounds, [["a", "b"]])).toThrow(
            RangeError,
        );
    });
});
