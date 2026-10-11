import { worldCollection } from "../data/generated/world";
import {
    computeCompassStatus,
    resolveDailyCompass,
    withCompassDailyEntry,
} from "../lib/challenge/dailyCompass";
import { maybeRecordDailyCompletion } from "../lib/challenge/dailyRitual";
import {
    DAILY_REQUIRED_TIER,
    parseDailyTierParam,
    withTierQuery,
} from "../lib/challenge/dailyTier";
import { loadState, saveState } from "../lib/persistence/repository";
import { mountCompassPlay } from "./compassPlay";
import { getLocale } from "./shared/dom";

export function mountCompassSession(): void {
    const tier = parseDailyTierParam(
        new URLSearchParams(window.location.search),
    );
    const initialState = loadState(localStorage);
    const { dateKey, challenge, entry } = resolveDailyCompass(
        new Date(),
        initialState,
        tier,
    );

    if (computeCompassStatus(entry) === "completed") {
        window.location.href = withTierQuery("/result/compass", tier);
        return;
    }

    // Persist a freshly-initialized entry right away so a reload mid-session resumes correctly.
    saveState(
        withCompassDailyEntry(initialState, dateKey, tier, entry),
        localStorage,
    );

    const firstUnanswered = entry.rounds.findIndex(
        (round) => round.chosenAngleDeg === null,
    );

    mountCompassPlay({
        locale: getLocale(),
        collection: worldCollection,
        challenge,
        startRoundIndex:
            firstUnanswered === -1 ? entry.rounds.length - 1 : firstUnanswered,
        onAnswer(roundIndex, chosenAngleDeg, credit, isLastRound) {
            entry.rounds[roundIndex] = { chosenAngleDeg, credit };
            if (isLastRound) {
                entry.completedAt = new Date().toISOString();
            }
            const stateWithEntry = withCompassDailyEntry(
                loadState(localStorage),
                dateKey,
                tier,
                entry,
            );
            saveState(
                isLastRound && tier === DAILY_REQUIRED_TIER
                    ? maybeRecordDailyCompletion(stateWithEntry, dateKey)
                    : stateWithEntry,
                localStorage,
            );
        },
        onFinish() {
            window.location.href = withTierQuery("/result/compass", tier);
        },
    });
}
