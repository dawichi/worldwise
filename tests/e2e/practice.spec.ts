import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test.describe("Practice selector", () => {
    test("choosing a mode and tier starts the matching practice session", async ({
        page,
    }) => {
        await page.goto("/practice");

        await page.getByRole("button", { name: "Arrange" }).click();
        await page.getByRole("button", { name: "Hard" }).click();
        await page.getByRole("button", { name: "Start practice" }).click();

        await expect(page).toHaveURL(/\/practice\/arrange\?tier=hard/);
    });

    test("defaults to Compass/Medium when nothing is changed", async ({
        page,
    }) => {
        await page.goto("/practice");
        await page.getByRole("button", { name: "Start practice" }).click();
        await expect(page).toHaveURL(/\/practice\/compass\?tier=medium/);
    });
});

test.describe("Practice sessions", () => {
    test("completes a Compass practice challenge and can play again", async ({
        page,
    }) => {
        await page.goto("/practice/compass?tier=easy");

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
            await expect(page.locator("#feedback-panel")).toBeVisible();
            await page.getByRole("button", { name: "Continue" }).click();
        }

        await expect(page).toHaveURL(/\/practice\/result/);
        await expect(page.locator("#result-heading")).toContainText("Compass");
        await expect(page.locator("#result-score")).toContainText("/ 3");
        await expect(page.locator("#result-rounds li")).toHaveCount(3);

        await page.getByRole("button", { name: "Practice again" }).click();
        await expect(page).toHaveURL(/\/practice\/compass\?tier=easy/);
    });

    test("completes an Arrange practice challenge with the reorder buttons", async ({
        page,
    }) => {
        await page.goto("/practice/arrange?tier=medium");

        for (let round = 0; round < 3; round++) {
            await page
                .getByRole("button", { name: /Move .+ down/ })
                .first()
                .click();
            await page.getByRole("button", { name: "Submit answer" }).click();
            await expect(page.locator("#feedback-panel")).toBeVisible();
            await page.getByRole("button", { name: "Continue" }).click();
        }

        await expect(page).toHaveURL(/\/practice\/result/);
        await expect(page.locator("#result-heading")).toContainText("Arrange");
    });

    test("completes a Border Run practice challenge with the hop builder", async ({
        page,
    }) => {
        await page.goto("/practice/border-run?tier=medium");

        for (let round = 0; round < 3; round++) {
            await page
                .locator('[data-role="hop-candidates"] button')
                .first()
                .click();
            await page.getByRole("button", { name: "Submit answer" }).click();
            await expect(page.locator("#feedback-panel")).toBeVisible();
            await page.getByRole("button", { name: "Continue" }).click();
        }

        await expect(page).toHaveURL(/\/practice\/result/);
        await expect(page.locator("#result-heading")).toContainText(
            "Border Run",
        );
    });

    test("does not move the daily ritual progress on Today", async ({
        page,
    }) => {
        await page.goto("/");
        await expect(page.locator("#ritual-progress-label")).toHaveText(
            "0 of 3",
        );

        await page.goto("/practice/compass?tier=easy");
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
        await expect(page).toHaveURL(/\/practice\/result/);

        await page.goto("/");
        await expect(page.locator("#streak-chip")).toBeHidden();
        await expect(page.locator("#ritual-progress-label")).toHaveText(
            "0 of 3",
        );
    });
});

test.describe("Arrange practice row count (ArrangeList dynamic-sizing regression)", () => {
    test("renders exactly the tier's item count, hiding the rest", async ({
        page,
    }) => {
        await page.goto("/practice/arrange?tier=hard");
        await expect(page.locator(".arrange-row:not(.hidden)")).toHaveCount(5);

        await page.goto("/practice/arrange?tier=easy");
        await expect(page.locator(".arrange-row:not(.hidden)")).toHaveCount(3);
    });
});

test.describe("Practice accessibility", () => {
    test("Practice selector and a session page have no automatically detectable accessibility violations", async ({
        page,
    }) => {
        await page.goto("/practice");
        const selectorResults = await new AxeBuilder({ page }).analyze();
        expect(selectorResults.violations).toEqual([]);

        await page.goto("/practice/compass");
        const sessionResults = await new AxeBuilder({ page }).analyze();
        expect(sessionResults.violations).toEqual([]);
    });
});
