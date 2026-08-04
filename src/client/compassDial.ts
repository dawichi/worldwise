import { bearingFromOffset } from "../lib/geo/angle";

export interface CompassDialController {
    getValue: () => number;
    setValue: (deg: number) => void;
    disable: () => void;
    /** Re-enables the dial and resets it to the initial value, for moving on to the next round. */
    reset: () => void;
    onChange: (callback: (deg: number) => void) => void;
    revealAnswer: (trueBearingDeg: number, credit: number) => void;
}

const KEYBOARD_STEP_DEG = 1;
const KEYBOARD_LARGE_STEP_DEG = 15;
const INITIAL_VALUE_DEG = 0;

function normalizeDeg(deg: number): number {
    return ((deg % 360) + 360) % 360;
}

/**
 * Wires pointer (tap-to-jump + drag), touch, and keyboard (arrow keys,
 * Shift+arrow for a larger step) interaction onto the markup rendered by
 * `CompassDial.astro`. `formatValueText` supplies the human-readable
 * `aria-valuetext` and on-screen readout (e.g. "128° · Southeast").
 */
export function createCompassDialController(
    root: HTMLElement,
    formatValueText: (deg: number) => string,
): CompassDialController {
    const needle = root.querySelector<SVGGraphicsElement>(
        '[data-role="needle"]',
    );
    const readout = root.parentElement?.querySelector<HTMLElement>(
        '[data-role="value-readout"]',
    );
    const perfectNeedle = root.querySelector<SVGGraphicsElement>(
        '[data-role="perfect-needle"]',
    );
    const changeCallbacks: Array<(deg: number) => void> = [];
    let value = INITIAL_VALUE_DEG;
    let disabled = false;

    function render(deg: number): void {
        needle?.setAttribute("transform", `rotate(${deg} 100 80)`);
        const text = formatValueText(deg);
        root.setAttribute("aria-valuenow", String(Math.round(deg)));
        root.setAttribute("aria-valuetext", text);
        if (readout) {
            readout.textContent = text;
        }
    }

    function revealAnswer(trueBearingDeg: number, credit: number): void {
        perfectNeedle?.setAttribute(
            "transform",
            `rotate(${trueBearingDeg} 100 80)`,
        );
        perfectNeedle?.classList.remove("hidden");
        const hue = Math.round(12 + Math.min(credit, 1) * 128);
        root.style.setProperty("--needle-color", `hsl(${hue} 78% 43%)`);
        root.dataset.revealed = "true";
    }

    function setValue(deg: number): void {
        if (disabled) {
            return;
        }
        value = normalizeDeg(deg);
        render(value);
        for (const callback of changeCallbacks) {
            callback(value);
        }
    }

    function angleFromPointerEvent(event: PointerEvent): number {
        const rect = root.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        return bearingFromOffset(
            event.clientX - centerX,
            event.clientY - centerY,
        );
    }

    function handlePointerDown(event: PointerEvent): void {
        if (disabled) {
            return;
        }
        root.setPointerCapture(event.pointerId);
        setValue(angleFromPointerEvent(event));
    }

    function handlePointerMove(event: PointerEvent): void {
        if (disabled || !root.hasPointerCapture(event.pointerId)) {
            return;
        }
        setValue(angleFromPointerEvent(event));
    }

    function handleKeyDown(event: KeyboardEvent): void {
        if (disabled) {
            return;
        }
        const step = event.shiftKey
            ? KEYBOARD_LARGE_STEP_DEG
            : KEYBOARD_STEP_DEG;
        if (event.key === "ArrowUp" || event.key === "ArrowRight") {
            event.preventDefault();
            setValue(value + step);
        } else if (event.key === "ArrowDown" || event.key === "ArrowLeft") {
            event.preventDefault();
            setValue(value - step);
        }
    }

    root.addEventListener("pointerdown", handlePointerDown);
    root.addEventListener("pointermove", handlePointerMove);
    root.addEventListener("keydown", handleKeyDown);

    render(value);

    return {
        getValue: () => value,
        setValue,
        disable(): void {
            disabled = true;
            root.setAttribute("aria-disabled", "true");
            root.tabIndex = -1;
        },
        reset(): void {
            disabled = false;
            root.removeAttribute("aria-disabled");
            root.tabIndex = 0;
            root.removeAttribute("data-revealed");
            perfectNeedle?.classList.add("hidden");
            root.style.removeProperty("--needle-color");
            setValue(INITIAL_VALUE_DEG);
        },
        onChange(callback: (deg: number) => void): void {
            changeCallbacks.push(callback);
        },
        revealAnswer,
    };
}
