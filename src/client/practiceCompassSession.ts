import { getPracticeCollection } from "../lib/data/collections";
import { type Locale, t } from "../lib/i18n/t";
import { generateCompassChallenge } from "../lib/modes/compass/generate";
import { DATA_VERSION, GENERATOR_VERSION } from "../lib/versions";
import { mountCompassPlay } from "./compassPlay";
import { byId, getLocale } from "./shared/dom";
import {
    fingerprintOfRounds,
    generatePracticeChallenge,
    parsePracticeSelection,
    savePracticeCompletion,
} from "./shared/practice";

export function mountPracticeCompassSession(): void {
    const locale: Locale = getLocale();
    const selection = parsePracticeSelection(window.location.search);
    const { tier, collectionId } = selection;
    const collection = getPracticeCollection(collectionId);

    const { challenge, fingerprint } = generatePracticeChallenge(
        collectionId,
        "compass",
        (seed) =>
            generateCompassChallenge({
                seed,
                challengeId: seed,
                generatorVersion: GENERATOR_VERSION,
                dataVersion: DATA_VERSION,
                collectionId,
                tier,
                places: collection.places,
            }),
        (generated) => fingerprintOfRounds(generated.rounds),
    );

    byId("tier-label").textContent = t(locale, "compass.tierLabel", {
        tier: t(locale, `tiers.${tier}`),
    });

    const roundCredits: number[] = [];
    mountCompassPlay({
        locale,
        collection,
        challenge,
        startRoundIndex: 0,
        onAnswer(_roundIndex, _chosenAngleDeg, credit, isLastRound) {
            roundCredits.push(credit);
            if (isLastRound) {
                savePracticeCompletion(
                    selection,
                    "compass",
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
