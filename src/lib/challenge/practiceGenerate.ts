import { buildPracticeSeed } from "../prng/practiceKey";

const MAX_DEDUP_ATTEMPTS = 5;
const RECENT_FINGERPRINT_WINDOW = 3;

/**
 * Generates a fresh practice challenge, retrying with a new random seed
 * (bounded, never an unbounded rejection loop) if the result's fingerprint
 * matches one of `recentFingerprints` — IDEA.md's "repeated challenges
 * should be avoided within a reasonable recent-history window." Generic
 * over the challenge shape so all three modes share one retry loop; each
 * caller supplies its own `fingerprintOf` (e.g. the sorted place ids
 * referenced across all rounds).
 */
export function generateWithDedup<T>(
    generate: (seed: string) => T,
    fingerprintOf: (challenge: T) => string,
    recentFingerprints: readonly string[],
): { challenge: T; fingerprint: string } {
    let challenge = generate(buildPracticeSeed());
    let fingerprint = fingerprintOf(challenge);

    for (
        let attempt = 1;
        attempt < MAX_DEDUP_ATTEMPTS &&
        recentFingerprints.includes(fingerprint);
        attempt++
    ) {
        challenge = generate(buildPracticeSeed());
        fingerprint = fingerprintOf(challenge);
    }

    return { challenge, fingerprint };
}

/** Rolling history of the last `RECENT_FINGERPRINT_WINDOW` fingerprints, most-recent-last. */
export function pushRecentFingerprint(
    recent: readonly string[],
    fingerprint: string,
): string[] {
    return [...recent, fingerprint].slice(-RECENT_FINGERPRINT_WINDOW);
}
