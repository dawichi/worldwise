import { xmur3 } from "./hash";

export interface Prng {
    /** A float in [0, 1). */
    next: () => number;
    /** An integer in [0, maxExclusive). */
    nextInt: (maxExclusive: number) => number;
}

/**
 * sfc32 — a small, widely used 128-bit-state PRNG (public domain). Chosen
 * over `mulberry32`'s 32-bit state for the couple-hundred draws a
 * mode-challenge needs, and over a dependency per AGENTS.md/IDEA.md: pure
 * integer arithmetic, deterministic across every JS engine.
 */
function sfc32(a: number, b: number, c: number, d: number): () => number {
    let stateA = a;
    let stateB = b;
    let stateC = c;
    let stateD = d;

    return (): number => {
        stateA >>>= 0;
        stateB >>>= 0;
        stateC >>>= 0;
        stateD >>>= 0;
        let t = (stateA + stateB) | 0;
        stateA = stateB ^ (stateB >>> 9);
        stateB = (stateC + (stateC << 3)) | 0;
        stateC = (stateC << 21) | (stateC >>> 11);
        stateD = (stateD + 1) | 0;
        t = (t + stateD) | 0;
        stateC = (stateC + t) | 0;
        return (t >>> 0) / 4294967296;
    };
}

/**
 * Creates a deterministic PRNG from a string seed (typically a daily key or
 * a practice-session seed). The same seed string always produces the same
 * sequence of draws, in every browser, forever.
 */
export function createPrng(seed: string): Prng {
    const deriveSeedWord = xmur3(seed);
    const next = sfc32(
        deriveSeedWord(),
        deriveSeedWord(),
        deriveSeedWord(),
        deriveSeedWord(),
    );

    return {
        next,
        nextInt(maxExclusive: number): number {
            if (!Number.isInteger(maxExclusive) || maxExclusive <= 0) {
                throw new RangeError(
                    `nextInt: maxExclusive must be a positive integer, got ${maxExclusive}`,
                );
            }
            return Math.floor(next() * maxExclusive);
        },
    };
}
