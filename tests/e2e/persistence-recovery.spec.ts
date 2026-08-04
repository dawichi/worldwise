import { expect, test } from "@playwright/test";

test.describe("Persistence and recovery", () => {
    test("resumes an interrupted Compass session after a reload", async ({
        page,
    }) => {
        await page.goto("/play/compass");
        const dial = page.getByRole("slider");
        await expect(dial).toHaveAttribute("aria-valuetext", /.+/);

        const box = await dial.boundingBox();
        if (!box) {
            throw new Error("compass dial has no bounding box");
        }
        await page.mouse.click(box.x + box.width * 0.9, box.y + box.height / 2);
        await page.getByRole("button", { name: "Submit answer" }).click();
        await expect(page.locator("#feedback-panel")).toBeVisible();

        await page.reload();
        await expect(page.locator("#round-counter")).toHaveText("Round 2 of 3");
        await expect(page.getByRole("slider")).toBeVisible();
    });

    test("resumes an interrupted Arrange session after a reload", async ({
        page,
    }) => {
        await page.goto("/play/arrange");
        await page
            .getByRole("button", { name: /Move .+ down/ })
            .first()
            .click();
        await page.getByRole("button", { name: "Submit answer" }).click();
        await expect(page.locator("#feedback-panel")).toBeVisible();

        await page.reload();
        await expect(page.locator("#round-counter")).toHaveText("Round 2 of 3");
        await expect(
            page.getByRole("button", { name: "Submit answer" }),
        ).toBeVisible();
    });

    test("resumes an interrupted Border Run session after a reload", async ({
        page,
    }) => {
        await page.goto("/play/border-run");
        await page
            .locator('[data-role="hop-candidates"] button')
            .first()
            .click();
        await page.getByRole("button", { name: "Submit answer" }).click();
        await expect(page.locator("#feedback-panel")).toBeVisible();

        await page.reload();
        await expect(page.locator("#round-counter")).toHaveText("Round 2 of 3");
        await expect(
            page.getByRole("button", { name: "Submit answer" }),
        ).toBeVisible();
    });

    test("recovers to a fresh daily state when stored JSON is corrupt", async ({
        page,
    }) => {
        await page.goto("/");
        await page.evaluate(() => {
            localStorage.setItem("worldwise:state", "{not valid json");
        });
        await page.reload();

        await expect(page.locator("#ritual-progress-label")).toHaveText(
            "0 of 3",
        );
        await expect(page.locator("#compass-mode-card")).toHaveAttribute(
            "data-status",
            "not-started",
        );
    });

    test("announces invalid Settings imports without changing progress", async ({
        page,
    }) => {
        await page.goto("/settings");
        await page.locator("#import-file").setInputFiles({
            name: "broken-worldwise-export.json",
            mimeType: "application/json",
            buffer: Buffer.from("not a Worldwise export"),
        });

        await expect(page.locator("#settings-status")).toHaveText(
            "That file is not a valid Worldwise export.",
        );
        await expect(page.locator("#import-file")).toHaveValue("");
    });
});
