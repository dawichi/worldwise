import { getPracticeCollection } from "../lib/data/collections";
import { type Locale, t } from "../lib/i18n/t";
import { generateArrangeChallenge } from "../lib/modes/arrange/generate";
import type { ArrangeChallenge } from "../lib/modes/arrange/types";
import { DATA_VERSION, GENERATOR_VERSION } from "../lib/versions";
import { mountArrangePlay } from "./arrangePlay";
import { byId, getLocale } from "./shared/dom";
import {
    generatePracticeChallenge,
    parsePracticeSelection,
    savePracticeCompletion,
} from "./shared/practice";

function fingerprintOf(challenge: ArrangeChallenge): string {
    return challenge.rounds
        .flatMap((round) => round.itemIds)
        .sort()
        .join(",");
}

export function mountPracticeArrangeSession(): void {
    const locale: Locale = getLocale();
    const selection = parsePracticeSelection(window.location.search);
    const { collectionId, tier } = selection;
    const collection = getPracticeCollection(collectionId);
    const { challenge, fingerprint } = generatePracticeChallenge(
        collectionId,
        "arrange",
        (seed) =>
            generateArrangeChallenge({
                seed,
                challengeId: seed,
                generatorVersion: GENERATOR_VERSION,
                dataVersion: DATA_VERSION,
                collectionId,
                tier,
                places: collection.places,
            }),
        fingerprintOf,
    );
    byId("tier-label").textContent = t(locale, "arrange.tierLabel", {
        tier: t(locale, `tiers.${tier}`),
    });

    const roundCredits: number[] = [];
    mountArrangePlay({
        locale,
        collection,
        challenge,
        startRoundIndex: 0,
        onAnswer(_roundIndex, _submittedOrder, credit, isLastRound) {
            roundCredits.push(credit);
            if (isLastRound) {
                savePracticeCompletion(
                    selection,
                    "arrange",
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
