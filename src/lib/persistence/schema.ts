import { z } from "zod";

export const CURRENT_SCHEMA_VERSION = 5;

const tierSchema = z.enum(["easy", "medium", "hard"]);

const compassRoundAnswerSchema = z.object({
    /** Degrees [0, 360), or null if this round hasn't been answered yet. */
    chosenAngleDeg: z.number().gte(0).lt(360).nullable(),
    /** Credit for this round, in [0, 1]; 0 while unanswered. */
    credit: z.number().gte(0).lte(1),
});

const compassDailyEntrySchema = z.object({
    challengeId: z.string().min(1),
    generatorVersion: z.string().min(1),
    dataVersion: z.string().min(1),
    tier: tierSchema,
    rounds: z.array(compassRoundAnswerSchema),
    /** ISO timestamp once every round is answered, else null (resumable). */
    completedAt: z.string().nullable(),
});

const arrangeRoundAnswerSchema = z.object({
    /** The submitted place-id order, or null if this round hasn't been answered yet. */
    submittedOrder: z.array(z.string().min(1)).nullable(),
    /** Credit for this round, in [0, 1]; 0 while unanswered. */
    credit: z.number().gte(0).lte(1),
});

const arrangeDailyEntrySchema = z.object({
    challengeId: z.string().min(1),
    generatorVersion: z.string().min(1),
    dataVersion: z.string().min(1),
    tier: tierSchema,
    rounds: z.array(arrangeRoundAnswerSchema),
    /** ISO timestamp once every round is answered, else null (resumable). */
    completedAt: z.string().nullable(),
});

const borderRunRoundAnswerSchema = z.object({
    /** The submitted place-id path (origin through destination), or null if this round hasn't been answered yet. */
    submittedPath: z.array(z.string().min(1)).nullable(),
    /** Credit for this round, in [0, 1]; 0 while unanswered (ADR-0004: binary for this mode). */
    credit: z.number().gte(0).lte(1),
});

const borderRunDailyEntrySchema = z.object({
    challengeId: z.string().min(1),
    generatorVersion: z.string().min(1),
    dataVersion: z.string().min(1),
    tier: tierSchema,
    rounds: z.array(borderRunRoundAnswerSchema),
    /** ISO timestamp once every round is answered, else null (resumable). */
    completedAt: z.string().nullable(),
});

const practiceModeStatsSchema = z.object({
    attempts: z.number().int().gte(0),
    roundsAnswered: z.number().int().gte(0),
    totalCredit: z.number().gte(0),
});

const practiceStatsByModeSchema = z.object({
    compass: practiceModeStatsSchema,
    arrange: practiceModeStatsSchema,
    borderRun: practiceModeStatsSchema,
});

/** Bounded rolling history (see practiceGenerate.ts) used to avoid repeating a recently-seen practice challenge within each mode. */
const practiceRecentFingerprintsByModeSchema = z.object({
    compass: z.array(z.string()),
    arrange: z.array(z.string()),
    borderRun: z.array(z.string()),
});

const practiceStatsSchema = z.object({
    world: practiceStatsByModeSchema,
    europe: practiceStatsByModeSchema,
});

const practiceRecentFingerprintsSchema = z.object({
    world: practiceRecentFingerprintsByModeSchema,
    europe: practiceRecentFingerprintsByModeSchema,
});

const streakSchema = z.object({
    current: z.number().int().gte(0),
    longest: z.number().int().gte(0),
    /** UTC date key (YYYY-MM-DD) of the last fully-completed daily ritual. */
    lastCompletedDate: z.string().nullable(),
});

export const persistedStateSchema = z.object({
    schemaVersion: z.literal(CURRENT_SCHEMA_VERSION),
    compass: z.object({
        /** Keyed by UTC date key (YYYY-MM-DD). */
        daily: z.record(z.string(), compassDailyEntrySchema),
    }),
    arrange: z.object({
        /** Keyed by UTC date key (YYYY-MM-DD). */
        daily: z.record(z.string(), arrangeDailyEntrySchema),
    }),
    borderRun: z.object({
        /** Keyed by UTC date key (YYYY-MM-DD). */
        daily: z.record(z.string(), borderRunDailyEntrySchema),
    }),
    practice: z.object({
        stats: practiceStatsSchema,
        recentFingerprints: practiceRecentFingerprintsSchema,
    }),
    streak: streakSchema,
});

export type PersistedState = z.infer<typeof persistedStateSchema>;
export type CompassDailyEntry = z.infer<typeof compassDailyEntrySchema>;
export type CompassRoundAnswer = z.infer<typeof compassRoundAnswerSchema>;
export type ArrangeDailyEntry = z.infer<typeof arrangeDailyEntrySchema>;
export type ArrangeRoundAnswer = z.infer<typeof arrangeRoundAnswerSchema>;
export type BorderRunDailyEntry = z.infer<typeof borderRunDailyEntrySchema>;
export type BorderRunRoundAnswer = z.infer<typeof borderRunRoundAnswerSchema>;
export type PracticeModeStats = z.infer<typeof practiceModeStatsSchema>;
export type PracticeStatsByMode = z.infer<typeof practiceStatsByModeSchema>;
export type PracticeStats = z.infer<typeof practiceStatsSchema>;

function createDefaultPracticeModeStats(): PracticeModeStats {
    return { attempts: 0, roundsAnswered: 0, totalCredit: 0 };
}

function createDefaultPracticeStatsByMode(): PracticeStatsByMode {
    return {
        compass: createDefaultPracticeModeStats(),
        arrange: createDefaultPracticeModeStats(),
        borderRun: createDefaultPracticeModeStats(),
    };
}

export function createDefaultState(): PersistedState {
    return {
        schemaVersion: CURRENT_SCHEMA_VERSION,
        compass: { daily: {} },
        arrange: { daily: {} },
        borderRun: { daily: {} },
        practice: {
            stats: {
                world: createDefaultPracticeStatsByMode(),
                europe: createDefaultPracticeStatsByMode(),
            },
            recentFingerprints: {
                world: { compass: [], arrange: [], borderRun: [] },
                europe: { compass: [], arrange: [], borderRun: [] },
            },
        },
        streak: { current: 0, longest: 0, lastCompletedDate: null },
    };
}
