import { describe, expect, it } from "vitest";
import {
    computeCompassStatus,
    countAnsweredRounds,
    resolveDailyCompass,
} from "../../../src/lib/challenge/dailyCompass";
import {
    createDefaultState,
    type PersistedState,
} from "../../../src/lib/persistence/schema";

const NOW = new Date("2026-07-31T12:00:00Z");

describe("resolveDailyCompass", () => {
    it("initializes a fresh, unanswered entry when nothing is persisted yet", () => {
        const state = createDefaultState();
        const { dateKey, challenge, entry } = resolveDailyCompass(NOW, state);

        expect(dateKey).toBe("2026-07-31");
        expect(challenge.rounds).toHaveLength(3);
        expect(entry.rounds).toHaveLength(challenge.rounds.length);
        expect(
            entry.rounds.every((round) => round.chosenAngleDeg === null),
        ).toBe(true);
        expect(entry.completedAt).toBeNull();
        expect(entry.challengeId).toBe(challenge.id);
    });

    it("regenerates an identical challenge for the same date every time", () => {
        const state = createDefaultState();
        const a = resolveDailyCompass(NOW, state);
        const b = resolveDailyCompass(NOW, state);
        expect(a.challenge).toEqual(b.challenge);
    });

    it("returns the persisted entry (with the player's progress) when one already exists", () => {
        const state = createDefaultState();
        const { dateKey, challenge } = resolveDailyCompass(NOW, state);

        const inProgressState: PersistedState = {
            ...state,
            compass: {
                daily: {
                    [dateKey]: {
                        challengeId: challenge.id,
                        generatorVersion: challenge.generatorVersion,
                        dataVersion: challenge.dataVersion,
                        tier: challenge.tier,
                        rounds: [
                            { chosenAngleDeg: 90, credit: 1 },
                            { chosenAngleDeg: null, credit: 0 },
                            { chosenAngleDeg: null, credit: 0 },
                        ],
                        completedAt: null,
                    },
                },
                dailyBonus: {},
            },
        };

        const { entry } = resolveDailyCompass(NOW, inProgressState);
        expect(entry.rounds[0]?.chosenAngleDeg).toBe(90);
        expect(countAnsweredRounds(entry)).toBe(1);
    });
});

describe("resolveDailyCompass with a bonus tier", () => {
    it("resolves independently from the required (medium) tier's entry", () => {
        const state = createDefaultState();
        const required = resolveDailyCompass(NOW, state);
        const easy = resolveDailyCompass(NOW, state, "easy");

        expect(required.tier).toBe("medium");
        expect(easy.tier).toBe("easy");
        expect(easy.challenge).not.toEqual(required.challenge);
    });

    it("a completed bonus entry does not affect the required tier's entry", () => {
        const state = createDefaultState();
        const { dateKey, challenge } = resolveDailyCompass(NOW, state, "easy");

        const stateWithBonusDone: PersistedState = {
            ...state,
            compass: {
                ...state.compass,
                dailyBonus: {
                    [`${dateKey}:easy`]: {
                        challengeId: challenge.id,
                        generatorVersion: challenge.generatorVersion,
                        dataVersion: challenge.dataVersion,
                        tier: challenge.tier,
                        rounds: challenge.rounds.map(() => ({
                            chosenAngleDeg: 0,
                            credit: 1,
                        })),
                        completedAt: "2026-07-31T12:00:00.000Z",
                    },
                },
            },
        };

        const required = resolveDailyCompass(NOW, stateWithBonusDone);
        expect(computeCompassStatus(required.entry)).toBe("not-started");

        const bonus = resolveDailyCompass(NOW, stateWithBonusDone, "easy");
        expect(computeCompassStatus(bonus.entry)).toBe("completed");
    });
});

describe("computeCompassStatus", () => {
    it("is not-started when no round has an answer", () => {
        const { entry } = resolveDailyCompass(NOW, createDefaultState());
        expect(computeCompassStatus(entry)).toBe("not-started");
    });

    it("is in-progress once at least one round is answered but not all", () => {
        const { entry } = resolveDailyCompass(NOW, createDefaultState());
        entry.rounds[0] = { chosenAngleDeg: 45, credit: 1 };
        expect(computeCompassStatus(entry)).toBe("in-progress");
    });

    it("is completed once completedAt is set", () => {
        const { entry } = resolveDailyCompass(NOW, createDefaultState());
        entry.completedAt = "2026-07-31T12:34:56.000Z";
        expect(computeCompassStatus(entry)).toBe("completed");
    });
});
