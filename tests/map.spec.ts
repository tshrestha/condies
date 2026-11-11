import { expect, test } from "@playwright/test"

import { gridFixture, mockApis } from "./fixtures.ts"

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

test("radar loads and can be turned off", async ({ page }) => {
    await mockApis(page)
    const radarTile = page.waitForRequest(/conus_bref_qcd/)
    await page.goto("#/map")

    await expect(page.locator("#map .maplibregl-canvas")).toBeVisible()
    await radarTile

    const toggle = page.getByRole("button", { name: "Radar" })
    await expect(toggle).toHaveAttribute("aria-pressed", "true")
    await toggle.click()
    await expect(toggle).toHaveAttribute("aria-pressed", "false")
})

test("saved spots appear as pins that open their forecast", async ({ page }) => {
    await page.addInitScript(() =>
        localStorage.setItem(
            "nawaSavedSelections",
            JSON.stringify([
                {
                    id: "a",
                    properties: { full_address: "Here, CO", coordinates: { latitude: 39.76, longitude: -105.02 } },
                },
            ]),
        ),
    )
    await mockApis(page, { grid: gridFixture([]) })
    await page.goto("#/map")

    // The pin prints the spot's temperature and opens its row, which links to its forecast.
    const pin = page.getByRole("button", { name: /^Here, (high|low) \d+°$/ })
    await expect(pin).toHaveText(/^\d+°$/)
    await pin.click()
    const popup = page.locator(".maplibregl-popup-content")
    await expect(popup.getByRole("button", { name: /^Condies score \d+\/100 \w+$/ })).toBeVisible()
    await popup.getByRole("link", { name: /^Here/ }).click()
    await expect(page).toHaveURL(/#\/forecast\/39\.76,-105\.02$/)
})

test("the base map follows the theme, and radar comes back after it changes", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    await mockApis(page)
    const light = page.waitForRequest(/openfreemap\.org\/styles\/positron/)
    const firstRadar = page.waitForRequest(/conus_bref_qcd/)
    await page.goto("#/map")
    await light
    await firstRadar

    const dark = page.waitForRequest(/openfreemap\.org\/styles\/dark/)
    const radarAgain = page.waitForRequest(/conus_bref_qcd/)
    await page.getByRole("button", { name: "Dark mode" }).click()
    await dark
    await radarAgain
    await expect(page.getByRole("button", { name: "Radar" })).toHaveAttribute("aria-pressed", "true")
})
