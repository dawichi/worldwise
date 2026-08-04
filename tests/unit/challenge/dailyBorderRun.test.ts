import { describe, expect, it } from "vitest";
import {
    computeBorderRunStatus,
    countAnsweredRounds,
    resolveDailyBorderRun,
} from "../../../src/lib/challenge/dailyBorderRun";
import { BORDER_RUN_TIERS } from "../../../src/lib/modes/borderRun/tiers";
import {
    createDefaultState,
    type PersistedState,
} from "../../../src/lib/persistence/schema";

const NOW = new Date("2026-07-31T12:00:00Z");

describe("resolveDailyBorderRun", () => {
    it("initializes a fresh, unanswered entry when nothing is persisted yet", () => {
        const state = createDefaultState();
        const { dateKey, challenge, entry } = resolveDailyBorderRun(NOW, state);

        expect(dateKey).toBe("2026-07-31");
        expect(challenge.rounds).toHaveLength(
            BORDER_RUN_TIERS.medium.roundsPerChallenge,
        );
        expect(entry.rounds).toHaveLength(challenge.rounds.length);
        expect(
            entry.rounds.every((round) => round.submittedPath === null),
        ).toBe(true);
        expect(entry.completedAt).toBeNull();
        expect(entry.challengeId).toBe(challenge.id);
    });

    it("regenerates an identical challenge for the same date every time", () => {
        const state = createDefaultState();
        const a = resolveDailyBorderRun(NOW, state);
        const b = resolveDailyBorderRun(NOW, state);
        expect(a.challenge).toEqual(b.challenge);
    });

    it("returns the persisted entry (with the player's progress) when one already exists", () => {
        const state = createDefaultState();
        const { dateKey, challenge } = resolveDailyBorderRun(NOW, state);

        const inProgressState: PersistedState = {
            ...state,
            borderRun: {
                daily: {
                    [dateKey]: {
                        challengeId: challenge.id,
                        generatorVersion: challenge.generatorVersion,
                        dataVersion: challenge.dataVersion,
                        tier: challenge.tier,
                        rounds: challenge.rounds.map((round, index) =>
                            index === 0
                                ? {
                                      submittedPath: [
                                          round.originId,
                                          round.destinationId,
                                      ],
                                      credit: 1,
                                  }
                                : { submittedPath: null, credit: 0 },
                        ),
                        completedAt: null,
                    },
                },
                dailyBonus: {},
            },
        };

        const { entry } = resolveDailyBorderRun(NOW, inProgressState);
        expect(entry.rounds[0]?.submittedPath).toEqual([
            challenge.rounds[0]?.originId,
            challenge.rounds[0]?.destinationId,
        ]);
        expect(countAnsweredRounds(entry)).toBe(1);
    });
});

describe("resolveDailyBorderRun with a bonus tier", () => {
    it("resolves independently from the required (medium) tier's entry", () => {
        const state = createDefaultState();
        const required = resolveDailyBorderRun(NOW, state);
        const easy = resolveDailyBorderRun(NOW, state, "easy");

        expect(required.tier).toBe("medium");
        expect(easy.tier).toBe("easy");
        expect(easy.challenge).not.toEqual(required.challenge);
    });

    it("a completed bonus entry does not affect the required tier's entry", () => {
        const state = createDefaultState();
        const { dateKey, challenge } = resolveDailyBorderRun(
            NOW,
            state,
            "easy",
        );

        const stateWithBonusDone: PersistedState = {
            ...state,
            borderRun: {
                ...state.borderRun,
                dailyBonus: {
                    [`${dateKey}:easy`]: {
                        challengeId: challenge.id,
                        generatorVersion: challenge.generatorVersion,
                        dataVersion: challenge.dataVersion,
                        tier: challenge.tier,
                        rounds: challenge.rounds.map((round) => ({
                            submittedPath: [
                                round.originId,
                                round.destinationId,
                            ],
                            credit: 1,
                        })),
                        completedAt: "2026-07-31T12:00:00.000Z",
                    },
                },
            },
        };

        const required = resolveDailyBorderRun(NOW, stateWithBonusDone);
        expect(computeBorderRunStatus(required.entry)).toBe("not-started");

        const bonus = resolveDailyBorderRun(NOW, stateWithBonusDone, "easy");
        expect(computeBorderRunStatus(bonus.entry)).toBe("completed");
    });
});

describe("computeBorderRunStatus", () => {
    it("is not-started when no round has an answer", () => {
        const { entry } = resolveDailyBorderRun(NOW, createDefaultState());
        expect(computeBorderRunStatus(entry)).toBe("not-started");
    });

    it("is in-progress once at least one round is answered but not all", () => {
        const { entry } = resolveDailyBorderRun(NOW, createDefaultState());
        entry.rounds[0] = { submittedPath: ["a", "b"], credit: 1 };
        expect(computeBorderRunStatus(entry)).toBe("in-progress");
    });

    it("is completed once completedAt is set", () => {
        const { entry } = resolveDailyBorderRun(NOW, createDefaultState());
        entry.completedAt = "2026-07-31T12:34:56.000Z";
        expect(computeBorderRunStatus(entry)).toBe("completed");
    });
});
