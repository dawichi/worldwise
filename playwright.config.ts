import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
    testDir: "./tests/e2e",
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 2 : 0,
    reporter: "html",
    use: {
        baseURL: "http://localhost:4173",
        trace: "on-first-retry",
    },
    webServer: {
        // Explicit port: Astro's default 4321 collides with an unrelated
        // long-running system process on some machines (e.g. rwhois).
        command: "bun run preview -- --port 4173",
        url: "http://localhost:4173",
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
