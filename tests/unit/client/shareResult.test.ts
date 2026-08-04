import { describe, expect, it } from "vitest";
import { buildSpoilerFreeResultText } from "../../../src/client/shareResult";

describe("buildSpoilerFreeResultText", () => {
    it("shares score patterns without revealing places or answers", () => {
        const text = buildSpoilerFreeResultText({
            appName: "Worldwise",
            modeName: "Compass",
            tierName: "Medium",
            dateKey: "2026-08-04",
            scoreLabel: "Score",
            score: "2.5",
            total: 3,
            credits: [1, 0.5, 0],
            url: "https://worldwise.example",
        });

        expect(text).toBe(
            "Worldwise · Compass · Medium\n2026-08-04\n🟩🟨🟧\nScore: 2.5 / 3\nhttps://worldwise.example",
        );
        expect(text).not.toContain("Portugal");
        expect(text).not.toContain("Spain");
    });
});
