import { worldCollection } from "../data/generated/world";
import {
    computeBorderRunStatus,
    resolveDailyBorderRun,
    withBorderRunDailyEntry,
} from "../lib/challenge/dailyBorderRun";
import { maybeRecordDailyCompletion } from "../lib/challenge/dailyRitual";
import {
    DAILY_REQUIRED_TIER,
    parseDailyTierParam,
    withTierQuery,
} from "../lib/challenge/dailyTier";
import { loadState, saveState } from "../lib/persistence/repository";
import { mountBorderRunPlay } from "./borderRunPlay";

export function mountBorderRunSession(): void {
    const tier = parseDailyTierParam(
        new URLSearchParams(window.location.search),
    );
    const initialState = loadState(localStorage);
    const { dateKey, challenge, entry } = resolveDailyBorderRun(
        new Date(),
        initialState,
        tier,
    );

    if (computeBorderRunStatus(entry) === "completed") {
        window.location.href = withTierQuery("/result/border-run", tier);
        return;
    }

    // Save a new daily entry before the first interaction so reloads resume.
    saveState(
        withBorderRunDailyEntry(initialState, dateKey, tier, entry),
        localStorage,
    );
    const firstUnanswered = entry.rounds.findIndex(
        (round) => round.submittedPath === null,
    );

    mountBorderRunPlay({
        locale: document.documentElement.lang === "es" ? "es" : "en",
        collection: worldCollection,
        challenge,
        startRoundIndex:
            firstUnanswered === -1 ? entry.rounds.length - 1 : firstUnanswered,
        onAnswer(roundIndex, submittedPath, credit, isLastRound) {
            entry.rounds[roundIndex] = { submittedPath, credit };
            if (isLastRound) {
                entry.completedAt = new Date().toISOString();
            }

            const stateWithEntry = withBorderRunDailyEntry(
                loadState(localStorage),
                dateKey,
                tier,
                entry,
            );
            const finalState =
                isLastRound && tier === DAILY_REQUIRED_TIER
                    ? maybeRecordDailyCompletion(stateWithEntry, dateKey)
                    : stateWithEntry;
            saveState(finalState, localStorage);
        },
        onFinish() {
            window.location.href = withTierQuery("/result/border-run", tier);
        },
    });
}
