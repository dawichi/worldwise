export interface ArrangeListItem {
    id: string;
    name: string;
}

export interface ArrangeListController {
    getOrder: () => string[];
    /** Resets the list to a new round's presented order and place names. */
    setOrder: (itemIds: string[], items: ArrangeListItem[]) => void;
    /** Colors each row by whether its current position matches `correctOrderIds`, and disables further reordering. */
    showResult: (correctOrderIds: string[]) => void;
    disable: () => void;
    enable: () => void;
}

interface RowRefs {
    li: HTMLElement;
    nameEl: HTMLElement;
    indicatorEl: HTMLElement;
    upButton: HTMLButtonElement;
    downButton: HTMLButtonElement;
}

function collectRows(root: HTMLElement): RowRefs[] {
    return Array.from(root.querySelectorAll<HTMLElement>(".arrange-row")).map(
        (li) => {
            const nameEl = li.querySelector<HTMLElement>(
                '[data-role="place-name"]',
            );
            const indicatorEl = li.querySelector<HTMLElement>(
                '[data-role="position-indicator"]',
            );
            const upButton = li.querySelector<HTMLButtonElement>(
                '[data-role="move-up"]',
            );
            const downButton = li.querySelector<HTMLButtonElement>(
                '[data-role="move-down"]',
            );
            if (!nameEl || !indicatorEl || !upButton || !downButton) {
                throw new Error(
                    "createArrangeListController: malformed row markup",
                );
            }
            return { li, nameEl, indicatorEl, upButton, downButton };
        },
    );
}

/**
 * Wires up/down reorder buttons onto the fixed-length row markup rendered
 * by `ArrangeList.astro`. Rows stay in fixed DOM order (position badges
 * never move); only which place is displayed in each row changes, avoiding
 * any need to physically reorder DOM nodes. After a move, focus follows
 * the same logical item to its new row so repeated keyboard presses keep
 * moving it.
 */
export function createArrangeListController(
    root: HTMLElement,
    formatMoveLabel: (direction: "up" | "down", name: string) => string,
    formatPositionLabel: (correct: boolean) => string,
): ArrangeListController {
    const rows = collectRows(root);
    let order: string[] = [];
    let itemsById = new Map<string, ArrangeListItem>();
    let disabled = false;

    function getItem(id: string): ArrangeListItem {
        const item = itemsById.get(id);
        if (!item) {
            throw new Error(
                `createArrangeListController: unknown place id "${id}"`,
            );
        }
        return item;
    }

    function render(): void {
        rows.forEach((row, index) => {
            const placeId = order[index];
            if (placeId === undefined) {
                throw new Error(
                    "createArrangeListController: order/rows length mismatch",
                );
            }
            const item = getItem(placeId);
            row.li.dataset.placeId = placeId;
            row.nameEl.textContent = item.name;
            row.indicatorEl.classList.add("hidden");
            row.indicatorEl.textContent = "";
            row.li.removeAttribute("data-credit");
            row.upButton.disabled = disabled || index === 0;
            row.downButton.disabled = disabled || index === rows.length - 1;
            row.upButton.setAttribute(
                "aria-label",
                formatMoveLabel("up", item.name),
            );
            row.downButton.setAttribute(
                "aria-label",
                formatMoveLabel("down", item.name),
            );
        });
    }

    function swap(indexA: number, indexB: number): void {
        const a = order[indexA];
        const b = order[indexB];
        if (a === undefined || b === undefined) {
            return;
        }
        order[indexA] = b;
        order[indexB] = a;
    }

    function moveUp(index: number): void {
        if (disabled || index <= 0) {
            return;
        }
        swap(index, index - 1);
        render();
        rows[index - 1]?.upButton.focus();
    }

    function moveDown(index: number): void {
        if (disabled || index >= rows.length - 1) {
            return;
        }
        swap(index, index + 1);
        render();
        rows[index + 1]?.downButton.focus();
    }

    rows.forEach((row, index) => {
        row.upButton.addEventListener("click", () => moveUp(index));
        row.downButton.addEventListener("click", () => moveDown(index));
    });

    return {
        getOrder: () => [...order],
        setOrder(itemIds: string[], items: ArrangeListItem[]): void {
            order = [...itemIds];
            itemsById = new Map(items.map((item) => [item.id, item]));
            disabled = false;
            render();
        },
        showResult(correctOrderIds: string[]): void {
            rows.forEach((row, index) => {
                const placeId = order[index];
                const isCorrect =
                    placeId !== undefined && correctOrderIds[index] === placeId;
                row.li.dataset.credit = isCorrect ? "full" : "none";
                row.indicatorEl.textContent = formatPositionLabel(isCorrect);
                row.indicatorEl.classList.remove("hidden");
            });
        },
        disable(): void {
            disabled = true;
            for (const row of rows) {
                row.upButton.disabled = true;
                row.downButton.disabled = true;
            }
        },
        enable(): void {
            disabled = false;
            render();
        },
    };
}
