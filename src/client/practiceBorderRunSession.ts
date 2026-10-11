import { getPracticeCollection } from "../lib/data/collections";
import { type Locale, t } from "../lib/i18n/t";
import { generateBorderRunChallenge } from "../lib/modes/borderRun/generate";
import { DATA_VERSION, GENERATOR_VERSION } from "../lib/versions";
import { mountBorderRunPlay } from "./borderRunPlay";
import { byId, getLocale } from "./shared/dom";
import {
    fingerprintOfRounds,
    generatePracticeChallenge,
    parsePracticeSelection,
    savePracticeCompletion,
} from "./shared/practice";

export function mountPracticeBorderRunSession(): void {
    const locale: Locale = getLocale();
    const selection = parsePracticeSelection(window.location.search);
    const { collectionId, tier } = selection;
    const collection = getPracticeCollection(collectionId);
    const { challenge, fingerprint } = generatePracticeChallenge(
        collectionId,
        "borderRun",
        (seed) =>
            generateBorderRunChallenge({
                seed,
                challengeId: seed,
                generatorVersion: GENERATOR_VERSION,
                dataVersion: DATA_VERSION,
                collectionId,
                tier,
                places: collection.places,
            }),
        (value) =>
            fingerprintOfRounds(
                value.rounds.map(({ originId, destinationId }) => ({
                    originId,
                    destinationId,
                })),
            ),
    );
    byId("tier-label").textContent = t(locale, "borderRun.tierLabel", {
        tier: t(locale, `tiers.${tier}`),
    });

    const roundCredits: number[] = [];
    mountBorderRunPlay({
        locale,
        collection,
        challenge,
        startRoundIndex: 0,
        onAnswer(_roundIndex, _submittedPath, credit, isLastRound) {
            roundCredits.push(credit);
            if (isLastRound) {
                savePracticeCompletion(
                    selection,
                    "borderRun",
                    fingerprint,
                    roundCredits,
                );
            }
        },
        onFinish() {
            window.location.href = "/practice/result";
        },
    });
}
