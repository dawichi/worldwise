import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test.describe("Compass daily mode-challenge", () => {
    test("completes a full mode-challenge via pointer (tap-to-jump on the dial)", async ({
        page,
    }) => {
        await page.goto("/");
        await page.getByRole("link", { name: "Start" }).click();
        await expect(page).toHaveURL(/\/play\/compass/);

        for (let round = 0; round < 3; round++) {
            const dial = page.getByRole("slider");
            const box = await dial.boundingBox();
            if (!box) {
                throw new Error("compass dial has no bounding box");
            }
            const centerX = box.x + box.width / 2;
            const centerY = box.y + box.height / 2;

            // Tap toward the dial's east edge — any position is a valid
            // answer for a continuous control, this just needs to move the
            // needle off its default value.
            await page.mouse.click(centerX + box.width * 0.4, centerY);
            await expect(dial).toHaveAttribute("aria-valuenow", "90");

            await page.getByRole("button", { name: "Submit answer" }).click();
            await expect(page.locator("#feedback-panel")).toBeVisible();

            await page.getByRole("button", { name: "Continue" }).click();
        }

        await expect(page).toHaveURL(/\/result\/compass/);
        await expect(page.locator("#result-heading")).toContainText("Compass");
        await expect(page.locator("#result-score")).toContainText("/ 3");
        await expect(page.locator("#result-rounds li")).toHaveCount(3);
    });

    test("completes a full mode-challenge via keyboard only (no pointer events)", async ({
        page,
    }) => {
        await page.goto("/play/compass");

        for (let round = 0; round < 3; round++) {
            const dial = page.getByRole("slider");
            await dial.focus();
            await expect(dial).toBeFocused();

            for (let i = 0; i < 6; i++) {
                await page.keyboard.press("Shift+ArrowRight");
            }
            await expect(dial).toHaveAttribute("aria-valuenow", "90");
            const valueText = await dial.getAttribute("aria-valuetext");
            expect(valueText).toBeTruthy();

            // WebKit (unlike Chromium/Firefox) doesn't Tab-focus buttons by
            // default without "Full Keyboard Access" enabled at the OS level
            // — a platform quirk, not something this app controls. Focus
            // the button directly so the test still exercises real keyboard
            // activation (Enter) across every engine.
            const submitButton = page.getByRole("button", {
                name: "Submit answer",
            });
            await submitButton.focus();
            await page.keyboard.press("Enter");

            await expect(page.locator("#feedback-panel")).toBeVisible();
            await expect(
                page.getByRole("button", { name: "Continue" }),
            ).toBeFocused();
            await page.keyboard.press("Enter");
        }

        await expect(page).toHaveURL(/\/result\/compass/);
    });

    test("Home and Compass session pages have no automatically detectable accessibility violations", async ({
        page,
    }) => {
        await page.goto("/");
        const homeResults = await new AxeBuilder({ page }).analyze();
        expect(homeResults.violations).toEqual([]);

        await page.goto("/play/compass");
        const sessionResults = await new AxeBuilder({ page }).analyze();
        expect(sessionResults.violations).toEqual([]);
    });
});
