import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test.describe("Compass daily mode-challenge", () => {
    test("completes a full mode-challenge via pointer (tap-to-jump on the dial)", async ({
        page,
    }) => {
        await page.goto("/");
        await page
            .locator("#compass-mode-card")
            .getByRole("link", { name: "Start" })
            .click();
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

test.describe("Arrange daily mode-challenge", () => {
    test("completes a full mode-challenge with the reorder buttons", async ({
        page,
    }) => {
        await page.goto("/play/arrange");

        for (let round = 0; round < 3; round++) {
            const moveDown = page.getByRole("button", {
                name: /Move .+ down/,
            });
            await moveDown.nth(0).focus();
            await page.keyboard.press("Enter");

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

        await expect(page).toHaveURL(/\/result\/arrange/);
        await expect(page.locator("#result-heading")).toContainText("Arrange");
        await expect(page.locator("#result-score")).toContainText("/ 3");
        await expect(page.locator("#result-rounds li")).toHaveCount(3);
    });

    test("Home and Arrange session pages have no automatically detectable accessibility violations", async ({
        page,
    }) => {
        await page.goto("/");
        const homeResults = await new AxeBuilder({ page }).analyze();
        expect(homeResults.violations).toEqual([]);

        await page.goto("/play/arrange");
        const sessionResults = await new AxeBuilder({ page }).analyze();
        expect(sessionResults.violations).toEqual([]);
    });
});

test.describe("Daily ritual (ADR-0002: streak requires every enabled mode)", () => {
    test("the streak only advances once both Compass and Arrange are completed the same day", async ({
        page,
    }) => {
        await page.goto("/");
        await expect(page.locator("#streak-chip")).toBeHidden();
        await expect(page.locator("#ritual-progress-label")).toHaveText(
            "0 of 2",
        );

        await page
            .locator("#compass-mode-card")
            .getByRole("link", { name: "Start" })
            .click();
        await expect(page).toHaveURL(/\/play\/compass/);
        for (let round = 0; round < 3; round++) {
            const dial = page.getByRole("slider");
            const box = await dial.boundingBox();
            if (!box) {
                throw new Error("compass dial has no bounding box");
            }
            await page.mouse.click(
                box.x + box.width * 0.9,
                box.y + box.height / 2,
            );
            await page.getByRole("button", { name: "Submit answer" }).click();
            await page.getByRole("button", { name: "Continue" }).click();
        }
        await expect(page).toHaveURL(/\/result\/compass/);

        await page.goto("/");
        await expect(page.locator("#streak-chip")).toBeHidden();
        await expect(page.locator("#ritual-progress-label")).toHaveText(
            "1 of 2",
        );

        await page
            .locator("#arrange-mode-card")
            .getByRole("link", { name: "Start" })
            .click();
        await expect(page).toHaveURL(/\/play\/arrange/);
        for (let round = 0; round < 3; round++) {
            await page
                .getByRole("button", { name: /Move .+ down/ })
                .first()
                .click();
            await page.getByRole("button", { name: "Submit answer" }).click();
            await page.getByRole("button", { name: "Continue" }).click();
        }
        await expect(page).toHaveURL(/\/result\/arrange/);

        await page.goto("/");
        await expect(page.locator("#streak-chip")).toBeVisible();
        await expect(page.locator("#ritual-progress-label")).toHaveText(
            "2 of 2",
        );
    });
});
