import { createToggleGroupController } from "./toggleGroup";

function must<T>(value: T | null | undefined, description: string): T {
    if (value === null || value === undefined) {
        throw new Error(
            `practiceHome: missing required element "${description}"`,
        );
    }
    return value;
}

/** URL path segments differ from mode ids for the multi-word Border Run mode, matching Daily's `/play/border-run` convention. */
const MODE_PATHS: Record<string, string> = {
    compass: "compass",
    arrange: "arrange",
    borderRun: "border-run",
};

export function mountPracticeHome(): void {
    const modeRoot = must(
        document.getElementById("mode-toggle"),
        "mode-toggle",
    );
    const tierRoot = must(
        document.getElementById("tier-toggle"),
        "tier-toggle",
    );
    const startButton = must(
        document.getElementById("start-practice"),
        "start-practice",
    );

    const modeGroup = createToggleGroupController(modeRoot, () => {});
    const tierGroup = createToggleGroupController(tierRoot, () => {});

    startButton.addEventListener("click", () => {
        const mode = modeGroup.getValue();
        const tier = tierGroup.getValue();
        const path = MODE_PATHS[mode] ?? mode;
        window.location.href = `/practice/${path}?tier=${tier}`;
    });
}
