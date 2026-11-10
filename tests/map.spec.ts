import { expect, test } from "@playwright/test"

import { mockApis } from "./fixtures.ts"

// Headless browsers need software rendering for WebGL.
test.use({
    launchOptions: { args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] },
})

test("place names in the popup are plain text", async ({ page }) => {
    await mockApis(page, {
        override: (url, route) => {
            if (url.hostname === "nominatim.openstreetmap.org") {
                void route.fulfill({
                    status: 200,
                    contentType: "application/json",
                    headers: { "access-control-allow-origin": "*" },
                    body: JSON.stringify({ display_name: '<img src=x onerror="window.__xss=1">Evil Place' }),
                })
                return true
            }
        },
    })
    await page.goto("#/map")

    const canvas = page.locator("#map .maplibregl-canvas")
    await expect(canvas).toBeVisible()
    await page.waitForTimeout(800)
    await canvas.click({ position: { x: 200, y: 300 } })

    const popup = page.locator(".maplibregl-popup-content")
    await expect(popup.locator("a")).toContainText("Evil Place")
    await expect(popup.locator("img")).toHaveCount(0)
    expect(await page.evaluate(() => "__xss" in window)).toBe(false)
})
