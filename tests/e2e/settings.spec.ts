import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test.describe("Settings", () => {
    test("changes language, motion preference, exports, and resets local data", async ({
        page,
    }) => {
        await page.goto("/settings");
        await expect(
            page.getByRole("heading", { name: "Settings" }),
        ).toBeVisible();

        await page.locator("#language-select").selectOption("es");
        await expect(page).toHaveURL(/\/es\/settings\/?$/);
        await expect(
            page.getByRole("heading", { name: "Ajustes" }),
        ).toBeVisible();

        await page.locator("#reduced-motion").check();
        await expect(page.locator("html")).toHaveClass(/reduce-motion/);

        const download = page.waitForEvent("download");
        await page.getByRole("button", { name: "Exportar progreso" }).click();
        expect((await download).suggestedFilename()).toBe(
            "worldwise-progress.json",
        );

        page.once("dialog", (dialog) => dialog.accept());
        await page
            .getByRole("button", { name: "Restablecer todos los datos" })
            .click();
        await expect(page).toHaveURL(/\/$/);
    });

    test("has no automatically detectable accessibility violations", async ({
        page,
    }) => {
        await page.goto("/settings");
        const results = await new AxeBuilder({ page }).analyze();
        expect(results.violations).toEqual([]);
    });
});
