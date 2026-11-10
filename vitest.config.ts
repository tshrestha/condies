import { defineConfig } from "vitest/config"

export default defineConfig({
    // Keeps asset imports as file paths, so tests can tell which icon was chosen.
    build: { assetsInlineLimit: 0 },
    test: {
        include: ["src/**/*.test.ts"],
    },
})
