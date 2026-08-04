import { expect, test } from "@playwright/test";

test.describe("Spanish internal navigation", () => {
    test("keeps Today links inside the Spanish route tree", async ({
        page,
    }) => {
        await page.goto("/es/");

        await expect(
            page.locator("#compass-mode-card").getByRole("link"),
        ).toHaveAttribute("href", "/es/play/compass");
        await expect(
            page.getByRole("link", { name: /Práctica/ }),
        ).toHaveAttribute("href", "/es/practice");
        await expect(
            page.getByRole("link", { name: "Estadísticas" }),
        ).toHaveAttribute("href", "/es/statistics");
        await expect(
            page.getByRole("link", { name: "Cómo jugar" }),
        ).toHaveAttribute("href", "/es/how-to-play");
    });

    test("preserves Spanish when moving between guide, practice, and Today", async ({
        page,
    }) => {
        await page.goto("/es/how-to-play");
        await page.getByRole("link", { name: "Práctica" }).click();
        await expect(page).toHaveURL(/\/es\/practice\/?$/);

        await page.getByRole("link", { name: "Hoy" }).click();
        await expect(page).toHaveURL(/\/es\/?$/);
        await expect(page.locator("html")).toHaveAttribute("lang", "es");
    });
});
