import { expect, type Page, test } from "@playwright/test"

import { mockApis, timeAt, week } from "./fixtures.ts"

const heading = (page: Page) => page.locator(".current-conditions h1.display-6")
const rows = (page: Page) => page.locator(".daily-row")

test("retries when NWS fails for a moment", async ({ page }) => {
    let failures = 2
    await mockApis(page, {
        override: async (url, route) => {
            if (url.pathname.endsWith("/g/forecast") && failures > 0) {
                failures--
                await route.fulfill({ status: 503, headers: { "access-control-allow-origin": "*" }, body: "busy" })
                return true
            }
        },
    })
    await page.goto("#/")

    await expect(rows(page)).toHaveCount(7)
    expect(failures).toBe(0)
})

test("doesn't retry a request NWS will never accept", async ({ page }) => {
    let attempts = 0
    await mockApis(page, {
        override: async (url, route) => {
            if (url.pathname.endsWith("/g/forecast/hourly")) {
                attempts++
                await route.fulfill({ status: 404, headers: { "access-control-allow-origin": "*" }, body: "nope" })
                return true
            }
        },
    })
    await page.goto("#/")

    await expect(rows(page)).toHaveCount(7)
    await page.waitForTimeout(800)
    expect(attempts).toBe(1)
})

test("a dropped alerts request doesn't lose the forecast", async ({ page }) => {
    await mockApis(page, {
        override: async (url, route) => {
            if (url.pathname.startsWith("/alerts")) {
                await route.abort("connectionreset")
                return true
            }
        },
    })
    await page.goto("#/")

    await expect(rows(page)).toHaveCount(7)
})

test("a dropped hourly request still shows the daily forecast", async ({ page }) => {
    await mockApis(page, {
        override: async (url, route) => {
            if (url.pathname.endsWith("/forecast/hourly")) {
                await route.abort("connectionreset")
                return true
            }
        },
    })
    await page.goto("#/")

    await expect(rows(page)).toHaveCount(7)
})

test("a place with no forecast doesn't replace the last good location", async ({ page }) => {
    await page.addInitScript(() =>
        localStorage.setItem("condiesLastLocation", JSON.stringify({ lat: "40.1234", lon: "-105.5678" })),
    )
    await mockApis(page, {
        location: { latitude: 19.5, longitude: -40.5 },
        override: async (url, route) => {
            if (url.pathname.startsWith("/points/19.5")) {
                await route.fulfill({ status: 404, headers: { "access-control-allow-origin": "*" }, body: "none" })
                return true
            }
        },
    })
    await page.goto("#/")

    await expect(page.locator(".alert-warning")).toContainText("the last place you loaded")
    await expect(heading(page)).toHaveText("Place 40.1234")
    expect(await page.evaluate(() => localStorage.getItem("condiesLastLocation"))).toContain("40.1234")
})

test("a successful load is remembered for next time", async ({ page }) => {
    await mockApis(page, { location: { latitude: 40.1234, longitude: -105.5678 } })
    await page.goto("#/")

    await expect(heading(page)).toHaveText("Place 40.1234")
    await expect.poll(() => page.evaluate(() => localStorage.getItem("condiesLastLocation"))).toContain("40.1234")
})

test("a forecast that has completely run out is an error, not a blank page", async ({ page }) => {
    const ended = week().map((p) => ({ ...p, endTime: timeAt(-1) }))
    await mockApis(page, { daily: ended, hourly: [] })
    await page.goto("#/forecast/40,-105")

    await expect(page.locator(".alert-danger")).toContainText("Couldn't load this page")
})

test.describe("last updated", () => {
    test("says how old the forecast is and can refresh it", async ({ page }) => {
        await mockApis(page, { generatedAt: new Date(Date.now() - 12 * 60_000).toISOString() })
        await page.goto("#/")

        const updated = page.locator(".last-updated")
        await expect(updated).toContainText("Updated 12 min ago")

        const reloaded = page.waitForEvent("load")
        await updated.click()
        await reloaded
        await expect(rows(page)).toHaveCount(7)
    })

    test("is left off when NWS doesn't say", async ({ page }) => {
        await mockApis(page)
        await page.goto("#/")

        await expect(rows(page)).toHaveCount(7)
        await expect(page.locator(".last-updated")).toHaveCount(0)
    })
})
