import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
    testDir: "./tests/e2e",
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 2 : 0,
    reporter: "html",
    use: {
        baseURL: "http://localhost:4321",
        trace: "on-first-retry",
    },
    webServer: {
        command: "bun run preview",
        url: "http://localhost:4321",
        reuseExistingServer: !process.env.CI,
    },
    projects: [
        {
            name: "mobile-chromium",
            use: { ...devices["Pixel 7"] },
        },
        {
            name: "desktop-chromium",
            use: { ...devices["Desktop Chrome"] },
        },
        {
            name: "mobile-webkit",
            use: { ...devices["iPhone 14"] },
        },
    ],
});
