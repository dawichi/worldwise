import type { Place } from "../lib/data/places.schema";
import type { Locale } from "../lib/i18n/t";

export interface BorderRunPathController {
    getPath: () => string[];
    /** Resets the path to a fresh round, starting at `originId`. */
    setRound: (
        originId: string,
        destinationId: string,
        hopBudget: number,
    ) => void;
    /** Colors the trail by score and disables further edits. */
    showResult: (credit: number) => void;
    disable: () => void;
    enable: () => void;
}

/**
 * TypeScript's control-flow narrowing doesn't persist into nested function
 * declarations defined later in the same scope, so returning an
 * already-non-nullable type from this helper sidesteps that instead of
 * reaching for non-null assertions (same pattern as arrangeSession.ts).
 */
function must<T>(value: T | null | undefined, description: string): T {
    if (value === null || value === undefined) {
        throw new Error(
            `createBorderRunPathController: malformed root markup, missing "${description}"`,
        );
    }
    return value;
}

/**
 * Grows a route one hop at a time by choosing among the *actual*
 * land-border neighbors (`Place.landBorders`) of the last place in the
 * path — a guided, map-free, keyboard-and-pointer-friendly alternative to a
 * full country picker or drag-and-drop map interaction. The trail and
 * candidate list are fully dynamic (unlike Arrange's fixed-row list), since
 * both path length and neighbor count vary per round, so this controller
 * creates/removes DOM nodes directly instead of rendering into a fixed
 * shape.
 */
export function createBorderRunPathController(
    root: HTMLElement,
    places: Place[],
    locale: Locale,
    formatAddHopLabel: (name: string) => string,
): BorderRunPathController {
    const trail = must(
        root.querySelector<HTMLOListElement>('[data-role="path-trail"]'),
        "path-trail",
    );
    const candidatesRoot = must(
        root.querySelector<HTMLDivElement>('[data-role="hop-candidates"]'),
        "hop-candidates",
    );
    const undoButton = must(
        root.querySelector<HTMLButtonElement>('[data-role="undo-hop"]'),
        "undo-hop",
    );

    const placesById = new Map(places.map((place) => [place.id, place]));
    let path: string[] = [];
    let destinationId = "";
    let hopBudget = 0;
    let disabled = false;

    function nameOf(id: string): string {
        const place = placesById.get(id);
        if (!place) {
            throw new Error(
                `createBorderRunPathController: unknown place id "${id}"`,
            );
        }
        return place.names[locale];
    }

    function neighborsOf(id: string): string[] {
        return placesById.get(id)?.landBorders ?? [];
    }

    function render(): void {
        trail.innerHTML = "";
        const lastId = path[path.length - 1];

        path.forEach((id, index) => {
            const li = document.createElement("li");
            li.className =
                "flex items-center gap-1 rounded-pill border border-border bg-chip px-3 py-1.5 text-sm font-bold text-text";
            li.dataset.placeId = id;
            if (id === destinationId && id === lastId) {
                li.dataset.reached = "true";
            }
            if (index > 0) {
                const arrow = document.createElement("span");
                arrow.setAttribute("aria-hidden", "true");
                arrow.textContent = "→";
                li.append(arrow);
            }
            const label = document.createElement("span");
            label.textContent = nameOf(id);
            li.append(label);
            trail.append(li);
        });

        candidatesRoot.innerHTML = "";
        const alreadyReachedDestination = lastId === destinationId;
        const usedHops = Math.max(path.length - 1, 0);
        if (
            !disabled &&
            lastId !== undefined &&
            !alreadyReachedDestination &&
            usedHops < hopBudget
        ) {
            const usedIds = new Set(path);
            for (const neighborId of neighborsOf(lastId)) {
                if (usedIds.has(neighborId)) {
                    continue;
                }
                const name = nameOf(neighborId);
                const button = document.createElement("button");
                button.type = "button";
                button.className =
                    "rounded-pill border border-border bg-surface px-3 py-1.5 text-sm font-bold text-text";
                button.textContent = name;
                button.setAttribute("aria-label", formatAddHopLabel(name));
                button.addEventListener("click", () => {
                    if (disabled) {
                        return;
                    }
                    path.push(neighborId);
                    render();
                });
                candidatesRoot.append(button);
            }
        }

        const hopStatus = root.querySelector<HTMLElement>(
            '[data-role="hop-status"]',
        );
        if (hopStatus) {
            hopStatus.dataset.exhausted = String(
                !alreadyReachedDestination && usedHops >= hopBudget,
            );
            hopStatus.textContent = `${usedHops} / ${hopBudget}`;
        }
        undoButton.disabled = disabled || path.length <= 1;
    }

    undoButton.addEventListener("click", () => {
        if (disabled || path.length <= 1) {
            return;
        }
        path.pop();
        render();
    });

    return {
        getPath: () => [...path],
        setRound(
            originId: string,
            newDestinationId: string,
            newHopBudget: number,
        ): void {
            path = [originId];
            destinationId = newDestinationId;
            hopBudget = newHopBudget;
            disabled = false;
            trail.removeAttribute("data-credit");
            render();
        },
        showResult(credit: number): void {
            disabled = true;
            trail.dataset.credit =
                credit === 1 ? "full" : credit > 0 ? "partial" : "none";
            candidatesRoot.innerHTML = "";
            undoButton.disabled = true;
        },
        disable(): void {
            disabled = true;
            undoButton.disabled = true;
            candidatesRoot.innerHTML = "";
        },
        enable(): void {
            disabled = false;
            render();
        },
    };
}
