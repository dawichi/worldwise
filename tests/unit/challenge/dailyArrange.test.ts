import { describe, expect, it } from "vitest";
import {
    computeArrangeStatus,
    countAnsweredRounds,
    resolveDailyArrange,
} from "../../../src/lib/challenge/dailyArrange";
import { ARRANGE_TIERS } from "../../../src/lib/modes/arrange/tiers";
import {
    createDefaultState,
    type PersistedState,
} from "../../../src/lib/persistence/schema";

const NOW = new Date("2026-07-31T12:00:00Z");

describe("resolveDailyArrange", () => {
    it("initializes a fresh, unanswered entry when nothing is persisted yet", () => {
        const state = createDefaultState();
        const { dateKey, challenge, entry } = resolveDailyArrange(NOW, state);

        expect(dateKey).toBe("2026-07-31");
        expect(challenge.rounds).toHaveLength(
            ARRANGE_TIERS.medium.roundsPerChallenge,
        );
        expect(entry.rounds).toHaveLength(challenge.rounds.length);
        expect(
            entry.rounds.every((round) => round.submittedOrder === null),
        ).toBe(true);
        expect(entry.completedAt).toBeNull();
        expect(entry.challengeId).toBe(challenge.id);
    });

    it("regenerates an identical challenge for the same date every time", () => {
        const state = createDefaultState();
        const a = resolveDailyArrange(NOW, state);
        const b = resolveDailyArrange(NOW, state);
        expect(a.challenge).toEqual(b.challenge);
    });

    it("returns the persisted entry (with the player's progress) when one already exists", () => {
        const state = createDefaultState();
        const { dateKey, challenge } = resolveDailyArrange(NOW, state);

        const inProgressState: PersistedState = {
            ...state,
            arrange: {
                daily: {
                    [dateKey]: {
                        challengeId: challenge.id,
                        generatorVersion: challenge.generatorVersion,
                        dataVersion: challenge.dataVersion,
                        tier: challenge.tier,
                        rounds: challenge.rounds.map((round, index) =>
                            index === 0
                                ? {
                                      submittedOrder: round.correctOrderIds,
                                      credit: 1,
                                  }
                                : { submittedOrder: null, credit: 0 },
                        ),
                        completedAt: null,
                    },
                },
            },
        };

        const { entry } = resolveDailyArrange(NOW, inProgressState);
        expect(entry.rounds[0]?.submittedOrder).toEqual(
            challenge.rounds[0]?.correctOrderIds,
        );
        expect(countAnsweredRounds(entry)).toBe(1);
    });
});

describe("computeArrangeStatus", () => {
    it("is not-started when no round has an answer", () => {
        const { entry } = resolveDailyArrange(NOW, createDefaultState());
        expect(computeArrangeStatus(entry)).toBe("not-started");
    });

    it("is in-progress once at least one round is answered but not all", () => {
        const { entry } = resolveDailyArrange(NOW, createDefaultState());
        entry.rounds[0] = { submittedOrder: ["a", "b"], credit: 1 };
        expect(computeArrangeStatus(entry)).toBe("in-progress");
    });

    it("is completed once completedAt is set", () => {
        const { entry } = resolveDailyArrange(NOW, createDefaultState());
        entry.completedAt = "2026-07-31T12:34:56.000Z";
        expect(computeArrangeStatus(entry)).toBe("completed");
    });
});
