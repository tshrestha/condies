import { defineConfig } from "@playwright/test"

export default defineConfig({
    testDir: "tests",
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 1 : 0,
    reporter: process.env.CI ? "github" : "list",
    use: {
        baseURL: "http://localhost:4173/",
        viewport: { width: 390, height: 844 },
        timezoneId: "America/Denver",
        // The offline test turns this back on. Elsewhere it would bypass the API mocks.
        serviceWorkers: "block",
    },
    webServer: {
        command: "npx vite preview --port 4173 --strictPort",
        url: "http://localhost:4173/",
        reuseExistingServer: !process.env.CI,
    },
})
