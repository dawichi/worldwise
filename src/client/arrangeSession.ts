import { worldCollection } from "../data/generated/world";
import {
    computeArrangeStatus,
    resolveDailyArrange,
    withArrangeDailyEntry,
} from "../lib/challenge/dailyArrange";
import { maybeRecordDailyCompletion } from "../lib/challenge/dailyRitual";
import {
    DAILY_REQUIRED_TIER,
    parseDailyTierParam,
    withTierQuery,
} from "../lib/challenge/dailyTier";
import { loadState, saveState } from "../lib/persistence/repository";
import { mountArrangePlay } from "./arrangePlay";
import { getLocale } from "./shared/dom";

export function mountArrangeSession(): void {
    const tier = parseDailyTierParam(
        new URLSearchParams(window.location.search),
    );
    const initialState = loadState(localStorage);
    const { dateKey, challenge, entry } = resolveDailyArrange(
        new Date(),
        initialState,
        tier,
    );
    if (computeArrangeStatus(entry) === "completed") {
        window.location.href = withTierQuery("/result/arrange", tier);
        return;
    }

    saveState(
        withArrangeDailyEntry(initialState, dateKey, tier, entry),
        localStorage,
    );
    const firstUnanswered = entry.rounds.findIndex(
        (round) => round.submittedOrder === null,
    );
    mountArrangePlay({
        locale: getLocale(),
        collection: worldCollection,
        challenge,
        startRoundIndex:
            firstUnanswered === -1 ? entry.rounds.length - 1 : firstUnanswered,
        onAnswer(roundIndex, submittedOrder, credit, isLastRound) {
            entry.rounds[roundIndex] = { submittedOrder, credit };
            if (isLastRound) {
                entry.completedAt = new Date().toISOString();
            }
            const stateWithEntry = withArrangeDailyEntry(
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
            window.location.href = withTierQuery("/result/arrange", tier);
        },
    });
}
