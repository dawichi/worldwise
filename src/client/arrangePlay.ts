import type { Collection } from "../lib/data/collections.schema";
import { getPlaceById } from "../lib/data/lookup";
import { type Locale, type TranslationKey, t } from "../lib/i18n/t";
import { scoreArrangeRound } from "../lib/modes/arrange/score";
import type {
    ArrangeChallenge,
    ArrangeRound,
} from "../lib/modes/arrange/types";
import { createArrangeListController } from "./arrangeList";
import { byId, byRole, creditKeyFor, creditLevel } from "./shared/dom";

export interface ArrangePlayOptions {
    locale: Locale;
    collection: Collection;
    challenge: ArrangeChallenge;
    startRoundIndex: number;
    onAnswer: (
        roundIndex: number,
        submittedOrder: string[],
        credit: number,
        isLastRound: boolean,
    ) => void;
    onFinish: () => void;
}

function promptKeyFor(variant: ArrangeRound["variant"]): TranslationKey {
    if (variant === "north-to-south") {
        return "arrange.promptNorthToSouth";
    }
    if (variant === "west-to-east") {
        return "arrange.promptWestToEast";
    }
    return "arrange.promptClosestToFarthest";
}

/** The Arrange interaction loop shared by Daily and Practice. */
export function mountArrangePlay(options: ArrangePlayOptions): void {
    const { locale, collection, challenge, onAnswer, onFinish } = options;
    let roundIndex = options.startRoundIndex;
    const roundCounterEl = byId("round-counter");
    const promptEl = byId("arrange-prompt");
    const listRoot = byId("arrange-list");
    const submitButton = byId("submit-answer");
    const continueButton = byId("continue-round");
    const feedbackPanel = byId("feedback-panel");
    const feedbackHeading = byRole(feedbackPanel, "feedback-heading");
    const feedbackBody = byRole(feedbackPanel, "feedback-body");

    if (
        !(submitButton instanceof HTMLButtonElement) ||
        !(continueButton instanceof HTMLButtonElement)
    ) {
        throw new Error("arrangePlay: session actions must be buttons");
    }

    const list = createArrangeListController(
        listRoot,
        (direction, name) =>
            t(
                locale,
                direction === "up" ? "arrange.moveUp" : "arrange.moveDown",
                { name },
            ),
        (correct) =>
            t(
                locale,
                correct
                    ? "arrange.positionCorrect"
                    : "arrange.positionIncorrect",
            ),
    );

    function currentRound(): ArrangeRound | undefined {
        return challenge.rounds[roundIndex];
    }

    function renderRound(): void {
        const round = currentRound();
        if (!round) {
            return;
        }
        const items = round.itemIds.map((id) => {
            const place = getPlaceById(collection, id);
            return { id, name: place.names[locale] };
        });
        list.setOrder(round.itemIds, items);
        roundCounterEl.textContent = t(locale, "arrange.roundOf", {
            current: roundIndex + 1,
            total: challenge.rounds.length,
        });

        if (round.variant === "closest-to-farthest" && round.referenceId) {
            const reference = getPlaceById(collection, round.referenceId);
            promptEl.textContent = t(
                locale,
                "arrange.promptClosestToFarthest",
                { reference: reference.names[locale] },
            );
        } else {
            promptEl.textContent = t(locale, promptKeyFor(round.variant));
        }

        feedbackPanel.classList.add("hidden");
        continueButton.classList.add("hidden");
        submitButton.classList.remove("hidden");
    }

    function submitAnswer(): void {
        const round = currentRound();
        if (!round) {
            return;
        }
        const submittedOrder = list.getOrder();
        const credit = scoreArrangeRound(round.correctOrderIds, submittedOrder);
        const isLastRound = roundIndex === challenge.rounds.length - 1;
        onAnswer(roundIndex, submittedOrder, credit, isLastRound);

        list.showResult(round.correctOrderIds);
        list.disable();
        submitButton.classList.add("hidden");
        const matches = round.correctOrderIds.filter(
            (id, index) => id === submittedOrder[index],
        ).length;
        const correctNames = round.correctOrderIds
            .map((id) => getPlaceById(collection, id).names[locale])
            .join(", ");
        feedbackHeading.textContent = t(locale, creditKeyFor(credit));
        feedbackBody.textContent = [
            t(locale, "arrange.inPlaceOf", {
                matches,
                total: round.correctOrderIds.length,
            }),
            t(locale, "arrange.correctOrderWas", { order: correctNames }),
        ].join(" ");
        feedbackPanel.dataset.credit = creditLevel(credit);
        feedbackPanel.classList.remove("hidden");
        continueButton.textContent = t(locale, "common.continue");
        continueButton.classList.remove("hidden");
        continueButton.focus();
    }

    function goToNextRoundOrResult(): void {
        if (roundIndex === challenge.rounds.length - 1) {
            onFinish();
            return;
        }
        roundIndex += 1;
        renderRound();
    }

    submitButton.addEventListener("click", submitAnswer);
    continueButton.addEventListener("click", goToNextRoundOrResult);
    renderRound();
}
