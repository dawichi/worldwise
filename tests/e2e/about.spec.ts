import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test.describe("About and data", () => {
    test("explains the geographic sources and privacy model", async ({
        page,
    }) => {
        await page.goto("/about");

        await expect(
            page.getByRole("heading", { name: "About & data" }),
        ).toBeVisible();
        await expect(page.getByText("Geographic data")).toBeVisible();
        await expect(
            page.getByRole("link", { name: /Natural Earth data source/ }),
        ).toHaveAttribute("href", "https://www.naturalearthdata.com/");
        await expect(
            page.getByText("There is no account, analytics, or server sync."),
        ).toBeVisible();
        await expect(page.getByText("Made with Natural Earth.")).toBeVisible();
    });

    test("renders the Spanish localized route", async ({ page }) => {
        await page.goto("/es/about");

        await expect(page.locator("html")).toHaveAttribute("lang", "es");
        await expect(
            page.getByRole("heading", { name: "Acerca y datos" }),
        ).toBeVisible();
        await expect(page.getByText("Datos geográficos")).toBeVisible();
    });

    test("has no automatically detectable accessibility violations", async ({
        page,
    }) => {
        await page.goto("/about");
        const results = await new AxeBuilder({ page }).analyze();
        expect(results.violations).toEqual([]);
    });
});
