/**
 * A fresh random seed for a Practice challenge. Unlike `buildDailyKey`,
 * Practice explicitly doesn't need cross-device/cross-session determinism
 * (IDEA.md's "Practice randomness does not need to be shared between
 * players") — this is real randomness, not a stable hash.
 */
export function buildPracticeSeed(): string {
    return `worldwise:practice:${crypto.randomUUID()}`;
}
