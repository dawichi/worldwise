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
            // Wait for the client controller to mount before sending a
            // pointer event; the static HTML initially has an empty readout.
            await expect(dial).toHaveAttribute("aria-valuetext", /.+/);
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
            await expect(dial).not.toHaveAttribute("aria-valuenow", "0");

            await page.getByRole("button", { name: "Submit answer" }).click();
            await expect(page.locator("#feedback-panel")).toBeVisible();
            await expect(dial).toHaveAttribute("data-revealed", "true");
            await expect(
                dial.locator('[data-role="perfect-needle"]'),
            ).not.toHaveClass(/hidden/);
            await expect(dial).toHaveAttribute("style", /--needle-color/);

            await page.getByRole("button", { name: "Continue" }).click();
        }

        await expect(page).toHaveURL(/\/result\/compass/);
        await expect(page.locator("#result-heading")).toContainText("Compass");
        await expect(page.locator("#result-score")).toContainText("/ 3");
        await expect(page.locator("#result-rounds li")).toHaveCount(3);
        await expect(
            page.getByRole("button", { name: "Share result" }),
        ).toBeVisible();
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
        await expect(
            page.getByRole("button", { name: "Share result" }),
        ).toBeVisible();
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

test.describe("Border Run daily mode-challenge", () => {
    test("completes a full mode-challenge with the guided hop builder", async ({
        page,
    }) => {
        await page.goto("/play/border-run");

        // Exercise add-hop then undo first, to prove the accessible undo
        // control actually reverts the trail (medium's hop range means the
        // origin is never directly adjacent to the destination, so the
        // first candidate is never a same-round dead end).
        const firstCandidate = page
            .locator('[data-role="hop-candidates"] button')
            .first();
        await firstCandidate.waitFor();
        await firstCandidate.click();
        await expect(page.locator('[data-role="path-trail"] li')).toHaveCount(
            2,
        );

        await page.getByRole("button", { name: "Undo last hop" }).click();
        await expect(page.locator('[data-role="path-trail"] li')).toHaveCount(
            1,
        );

        for (let round = 0; round < 3; round++) {
            await page
                .locator('[data-role="hop-candidates"] button')
                .first()
                .click();

            await page.getByRole("button", { name: "Submit answer" }).click();
            await expect(page.locator("#feedback-panel")).toBeVisible();

            await page.getByRole("button", { name: "Continue" }).click();
        }

        await expect(page).toHaveURL(/\/result\/border-run/);
        await expect(page.locator("#result-heading")).toContainText(
            "Border Run",
        );
        await expect(page.locator("#result-score")).toContainText("/ 3");
        await expect(page.locator("#result-rounds li")).toHaveCount(3);
        await expect(
            page.getByRole("button", { name: "Share result" }),
        ).toBeVisible();
    });

    test("Home and Border Run session pages have no automatically detectable accessibility violations", async ({
        page,
    }) => {
        await page.goto("/");
        const homeResults = await new AxeBuilder({ page }).analyze();
        expect(homeResults.violations).toEqual([]);

        await page.goto("/play/border-run");
        const sessionResults = await new AxeBuilder({ page }).analyze();
        expect(sessionResults.violations).toEqual([]);
    });
});

test.describe("Daily ritual (ADR-0002: streak requires every enabled mode)", () => {
    test("the streak only advances once every enabled mode is completed the same day", async ({
        page,
    }) => {
        await page.goto("/");
        await expect(page.locator("#streak-chip")).toBeHidden();
        await expect(page.locator("#ritual-progress-label")).toHaveText(
            "0 of 3",
        );

        await page
            .locator("#compass-mode-card")
            .getByRole("link", { name: "Start" })
            .click();
        await expect(page).toHaveURL(/\/play\/compass/);
        for (let round = 0; round < 3; round++) {
            const dial = page.getByRole("slider");
            await expect(dial).toHaveAttribute("aria-valuetext", /.+/);
            const box = await dial.boundingBox();
            if (!box) {
                throw new Error("compass dial has no bounding box");
            }
            await page.mouse.click(
                box.x + box.width * 0.9,
                box.y + box.height / 2,
            );
            await page.getByRole("button", { name: "Submit answer" }).click();
            await expect(page.locator("#feedback-panel")).toBeVisible();
            await page.getByRole("button", { name: "Continue" }).click();
        }
        await expect(page).toHaveURL(/\/result\/compass/);

        await page.goto("/");
        await expect(page.locator("#streak-chip")).toBeHidden();
        await expect(page.locator("#ritual-progress-label")).toHaveText(
            "1 of 3",
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
        await expect(page.locator("#streak-chip")).toBeHidden();
        await expect(page.locator("#ritual-progress-label")).toHaveText(
            "2 of 3",
        );

        await page
            .locator("#borderRun-mode-card")
            .getByRole("link", { name: "Start" })
            .click();
        await expect(page).toHaveURL(/\/play\/border-run/);
        for (let round = 0; round < 3; round++) {
            await page
                .locator('[data-role="hop-candidates"] button')
                .first()
                .click();
            await page.getByRole("button", { name: "Submit answer" }).click();
            await page.getByRole("button", { name: "Continue" }).click();
        }
        await expect(page).toHaveURL(/\/result\/border-run/);

        await page.goto("/");
        await expect(page.locator("#streak-chip")).toBeVisible();
        await expect(page.locator("#ritual-progress-label")).toHaveText(
            "3 of 3",
        );
    });
});

test.describe("Daily bonus tiers (ADR-0003: optional, don't affect the streak)", () => {
    test("completing a bonus-tier mode-challenge doesn't affect the ritual or streak, and shows as completed on Home", async ({
        page,
    }) => {
        await page.goto("/");
        await expect(page.locator("#ritual-progress-label")).toHaveText(
            "0 of 3",
        );

        await page
            .locator("#arrange-bonus-row")
            .getByRole("link", { name: "Easy" })
            .click();
        await expect(page).toHaveURL(/\/play\/arrange\?tier=easy/);

        for (let round = 0; round < 3; round++) {
            await page
                .getByRole("button", { name: /Move .+ down/ })
                .first()
                .click();
            await page.getByRole("button", { name: "Submit answer" }).click();
            await page.getByRole("button", { name: "Continue" }).click();
        }

        await expect(page).toHaveURL(/\/result\/arrange\?tier=easy/);
        await expect(page.locator("#result-heading")).toContainText("Easy");

        await page.goto("/");
        await expect(page.locator("#streak-chip")).toBeHidden();
        await expect(page.locator("#ritual-progress-label")).toHaveText(
            "0 of 3",
        );
        await expect(
            page.locator('#arrange-bonus-row [data-tier="easy"]'),
        ).toHaveAttribute("data-status", "completed");
        await expect(
            page.locator('#arrange-bonus-row [data-tier="hard"]'),
        ).toHaveAttribute("data-status", "not-started");
        await expect(
            page.locator('#compass-bonus-row [data-tier="easy"]'),
        ).toHaveAttribute("data-status", "not-started");

        // Required (medium) Arrange is still untouched by the bonus attempt.
        await expect(
            page
                .locator("#arrange-mode-card")
                .getByRole("link", { name: "Start" }),
        ).toBeVisible();
    });
});
