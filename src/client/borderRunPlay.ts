import type { Collection } from "../lib/data/collections.schema";
import { getPlaceById } from "../lib/data/lookup";
import { shortestPath } from "../lib/geo/graph";
import { type Locale, t } from "../lib/i18n/t";
import { assessBorderRunRoute } from "../lib/modes/borderRun/score";
import { BORDER_RUN_TIERS } from "../lib/modes/borderRun/tiers";
import type {
    BorderRunChallenge,
    BorderRunRound,
} from "../lib/modes/borderRun/types";
import { createBorderRunPathController } from "./borderRunPath";
import { createBorderRunScene } from "./maps/borderRunScene";
import { createRouteMap } from "./maps/routeMap";
import { byId, byRole, creditKeyFor, creditLevel } from "./shared/dom";

export interface BorderRunPlayOptions {
    locale: Locale;
    collection: Collection;
    challenge: BorderRunChallenge;
    startRoundIndex: number;
    onAnswer: (
        roundIndex: number,
        submittedPath: string[],
        credit: number,
        isLastRound: boolean,
    ) => void;
    onFinish: () => void;
}

/** The Border Run route builder and reveal shared by Daily and Practice. */
export function mountBorderRunPlay(options: BorderRunPlayOptions): void {
    const { locale, collection, challenge, onAnswer, onFinish } = options;
    const tierConfig = BORDER_RUN_TIERS[challenge.tier];
    let roundIndex = options.startRoundIndex;

    const roundCounterEl = byId("round-counter");
    const promptEl = byId("border-run-prompt");
    const routeRoot = byId("route-builder");
    const submitButton = byId("submit-answer");
    const continueButton = byId("continue-round");
    const feedbackPanel = byId("feedback-panel");
    const feedbackHeading = byRole(feedbackPanel, "feedback-heading");
    const feedbackBody = byRole(feedbackPanel, "feedback-body");
    if (
        !(submitButton instanceof HTMLButtonElement) ||
        !(continueButton instanceof HTMLButtonElement)
    ) {
        throw new Error("borderRunPlay: session actions must be buttons");
    }
    const path = createBorderRunPathController(
        routeRoot,
        collection.places,
        locale,
        (name) => t(locale, "borderRun.addHop", { name }),
    );
    const routeMap = createRouteMap(byId("border-run-map"));

    function currentRound(): BorderRunRound | undefined {
        return challenge.rounds[roundIndex];
    }

    function renderRound(): void {
        const round = currentRound();
        if (!round) {
            return;
        }
        const origin = getPlaceById(collection, round.originId);
        const destination = getPlaceById(collection, round.destinationId);
        const shortestHops = Math.max(
            (shortestPath(
                collection.places,
                round.originId,
                round.destinationId,
            )?.length ?? 1) - 1,
            0,
        );

        path.setRound(
            round.originId,
            round.destinationId,
            shortestHops + tierConfig.maxExtraHops,
        );
        roundCounterEl.textContent = t(locale, "borderRun.roundOf", {
            current: roundIndex + 1,
            total: challenge.rounds.length,
        });
        promptEl.textContent = t(locale, "borderRun.prompt", {
            origin: origin.names[locale],
            destination: destination.names[locale],
        });
        feedbackPanel.classList.add("hidden");
        routeMap.hide();
        continueButton.classList.add("hidden");
        submitButton.classList.remove("hidden");
    }

    function submitAnswer(): void {
        const round = currentRound();
        if (!round) {
            return;
        }
        const submittedPath = path.getPath();
        const assessment = assessBorderRunRoute(
            collection.places,
            round,
            submittedPath,
            tierConfig.maxExtraHops,
        );
        const credit = assessment.credit;
        const isLastRound = roundIndex === challenge.rounds.length - 1;
        onAnswer(roundIndex, submittedPath, credit, isLastRound);

        path.showResult(credit);
        submitButton.classList.add("hidden");
        const routeNames = submittedPath
            .map((id) => getPlaceById(collection, id).names[locale])
            .join(" → ");
        const destinationName = getPlaceById(collection, round.destinationId)
            .names[locale];
        feedbackHeading.textContent = t(locale, creditKeyFor(credit));
        const messages = [
            t(locale, "borderRun.routeHops", {
                shortest: assessment.shortestHops,
                used: assessment.submittedHops,
                budget: assessment.hopBudget,
            }),
            t(
                locale,
                credit === 1
                    ? "borderRun.routeOptimal"
                    : assessment.isValid
                      ? "borderRun.routeEfficient"
                      : "borderRun.routeInvalid",
                {
                    route: routeNames,
                    destination: destinationName,
                    shortest: assessment.shortestHops,
                    used: assessment.submittedHops,
                },
            ),
        ];
        feedbackBody.replaceChildren(
            ...messages.map((message) => {
                const paragraph = document.createElement("p");
                paragraph.textContent = message;
                return paragraph;
            }),
        );
        feedbackPanel.dataset.credit = creditLevel(credit);
        feedbackPanel.classList.remove("hidden");
        void routeMap.show(
            createBorderRunScene(collection.places, round, submittedPath),
        );
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
