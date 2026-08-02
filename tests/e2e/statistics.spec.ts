import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test.describe("Statistics (fresh state)", () => {
    test("shows the empty state for streaks and every mode", async ({
        page,
    }) => {
        await page.goto("/statistics");

        await expect(page.locator("#streak-current")).toContainText("0");
        await expect(page.locator("#streak-longest")).toContainText("0");
        await expect(page.locator("#daily-history li")).toHaveCount(14);
        await expect(page.locator("#daily-history li").last()).toHaveAttribute(
            "data-status",
            "none",
        );
        // World has daily + practice rows; Europe has practice only.
        await expect(page.getByText("No data yet")).toHaveCount(9);
    });

    test("has no automatically detectable accessibility violations", async ({
        page,
    }) => {
        await page.goto("/statistics");
        const results = await new AxeBuilder({ page }).analyze();
        expect(results.violations).toEqual([]);
    });
});

test.describe("Statistics (after activity)", () => {
    test("reflects a completed daily ritual and a practice session", async ({
        page,
    }) => {
        await page.goto("/");

        await page
            .locator("#compass-mode-card")
            .getByRole("link", { name: "Start" })
            .click();
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

        await page.goto("/play/arrange");
        for (let round = 0; round < 3; round++) {
            await page
                .getByRole("button", { name: /Move .+ down/ })
                .first()
                .click();
            await page.getByRole("button", { name: "Submit answer" }).click();
            await page.getByRole("button", { name: "Continue" }).click();
        }
        await expect(page).toHaveURL(/\/result\/arrange/);

        await page.goto("/play/border-run");
        for (let round = 0; round < 3; round++) {
            await page
                .locator('[data-role="hop-candidates"] button')
                .first()
                .click();
            await page.getByRole("button", { name: "Submit answer" }).click();
            await page.getByRole("button", { name: "Continue" }).click();
        }
        await expect(page).toHaveURL(/\/result\/border-run/);

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

        await page.goto("/statistics");
        await expect(page.locator("#streak-current")).toContainText("1");
        await expect(page.locator("#daily-history li").last()).toHaveAttribute(
            "data-status",
            "full",
        );
        // World Daily is full and World Compass practice has data; the two
        // remaining World practice rows plus all three Europe rows are empty.
        await expect(page.getByText("No data yet")).toHaveCount(5);
    });
});
