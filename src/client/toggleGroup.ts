export interface ToggleGroupController {
    getValue: () => string;
    setValue: (value: string) => void;
}

/**
 * Wires a set of `aria-pressed` toggle buttons (rendered by
 * `ToggleGroup.astro`) into a single-select group — plain toggle buttons
 * rather than a full `role="radiogroup"` + roving-tabindex implementation,
 * since nothing else in this codebase implements that fuller APG pattern
 * either (e.g. Arrange's move-up/down buttons).
 */
export function createToggleGroupController(
    root: HTMLElement,
    onChange: (value: string) => void,
): ToggleGroupController {
    const buttons = Array.from(
        root.querySelectorAll<HTMLButtonElement>('[data-role="toggle-option"]'),
    );
    if (buttons.length === 0) {
        throw new Error("createToggleGroupController: no toggle options found");
    }

    function initialValue(): string {
        const pressed = buttons.find(
            (button) => button.getAttribute("aria-pressed") === "true",
        );
        return (pressed ?? buttons[0])?.dataset.value ?? "";
    }

    let value = initialValue();

    function render(): void {
        for (const button of buttons) {
            button.setAttribute(
                "aria-pressed",
                button.dataset.value === value ? "true" : "false",
            );
        }
    }

    for (const button of buttons) {
        button.addEventListener("click", () => {
            const next = button.dataset.value;
            if (next === undefined || next === value) {
                return;
            }
            value = next;
            render();
            onChange(value);
        });
    }

    return {
        getValue: () => value,
        setValue(next: string): void {
            value = next;
            render();
        },
    };
}
