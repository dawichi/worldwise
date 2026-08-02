import { describe, expect, it } from "vitest";
import {
    generateWithDedup,
    pushRecentFingerprint,
} from "../../../src/lib/challenge/practiceGenerate";

describe("generateWithDedup", () => {
    it("accepts the first draw when it doesn't collide with recent history", () => {
        let calls = 0;
        const { challenge, fingerprint } = generateWithDedup(
            (seed) => {
                calls += 1;
                return { seed };
            },
            (c) => c.seed,
            ["some-other-fingerprint"],
        );
        expect(calls).toBe(1);
        expect(fingerprint).toBe(challenge.seed);
    });

    it("retries when the draw collides, up to the attempt budget", () => {
        const seeds = ["dup", "dup", "dup", "dup", "fresh"];
        let index = 0;
        const { fingerprint } = generateWithDedup(
            () => {
                const seed = seeds[index] ?? "unreachable";
                index += 1;
                return { seed };
            },
            (c) => c.seed,
            ["dup"],
        );
        // 5 attempts max; the 5th draw ("fresh") should be the one accepted.
        expect(index).toBe(5);
        expect(fingerprint).toBe("fresh");
    });

    it("gives up and accepts a colliding result rather than looping forever", () => {
        const { fingerprint } = generateWithDedup(
            () => ({ seed: "always-dup" }),
            (c) => c.seed,
            ["always-dup"],
        );
        expect(fingerprint).toBe("always-dup");
    });
});

describe("pushRecentFingerprint", () => {
    it("appends to an empty history", () => {
        expect(pushRecentFingerprint([], "a")).toEqual(["a"]);
    });

    it("keeps only the last 3 entries, most-recent-last", () => {
        const history = pushRecentFingerprint(["a", "b", "c"], "d");
        expect(history).toEqual(["b", "c", "d"]);
    });
});
