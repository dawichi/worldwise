/**
 * xmur3 — a small, widely used 32-bit string hash (public domain, commonly
 * attributed to a Java string-hash variant popularized for JS PRNG seeding).
 * Chosen over a dependency per AGENTS.md: pure bitwise/integer arithmetic
 * only, so it is deterministic across every JS engine by construction (no
 * floating-point rounding, no locale dependence).
 *
 * Returns a generator function: each call advances internal state and
 * returns a new 32-bit unsigned integer, suitable for seeding a PRNG (call
 * it multiple times to derive several independent-looking seed words from
 * one string).
 */
export function xmur3(seed: string): () => number {
    let h = 1779033703 ^ seed.length;

    for (let i = 0; i < seed.length; i++) {
        h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
        h = (h << 13) | (h >>> 19);
    }

    return (): number => {
        h = Math.imul(h ^ (h >>> 16), 2246822507);
        h = Math.imul(h ^ (h >>> 13), 3266489909);
        h ^= h >>> 16;
        return h >>> 0;
    };
}
