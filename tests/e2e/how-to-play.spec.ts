import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test.describe("How to Play", () => {
    test("is reachable from Today and explains the core loop", async ({
        page,
    }) => {
        await page.goto("/");
        await page.getByRole("link", { name: "How to play" }).click();
        await expect(page).toHaveURL(/\/how-to-play/);
        await expect(
            page.getByRole("heading", { name: "How to play" }),
        ).toBeVisible();
        await expect(
            page.getByRole("heading", { name: "The daily ritual" }),
        ).toBeVisible();
        await expect(
            page.getByRole("heading", { name: "Compass" }),
        ).toBeVisible();
        await expect(
            page.getByRole("heading", { name: "Arrange" }),
        ).toBeVisible();
        await expect(
            page.getByRole("heading", { name: "Border Run" }),
        ).toBeVisible();
        await expect(
            page.getByRole("link", { name: "Practice" }),
        ).toHaveAttribute("href", "/practice");
    });

    test("has no automatically detectable accessibility violations", async ({
        page,
    }) => {
        await page.goto("/how-to-play");
        const results = await new AxeBuilder({ page }).analyze();
        expect(results.violations).toEqual([]);
    });
});
