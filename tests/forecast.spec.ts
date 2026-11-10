import { expect, type Page, test } from "@playwright/test"

import { hourly, mockApis, pointRequests, stormAlerts } from "./fixtures.ts"

const heading = (page: Page) => page.locator(".current-conditions h1.display-6")
const chart = (page: Page) => page.locator(".forecast-chart svg")
const here = { latitude: 40.1234, longitude: -105.5678 }

test("shows the forecast for the user's location", async ({ page }) => {
    await mockApis(page, { location: here })
    await page.goto("#/")

    await expect(heading(page)).toHaveText("Place 40.1234")
    await expect(chart(page)).toBeVisible()
    await expect(page.getByText("6:45 AM")).toBeVisible()
    await expect(page.locator(".daily-row")).toHaveCount(7)
})

test("shows placeholders and search while the forecast loads", async ({ page }) => {
    let release = () => {}
    const blocked = new Promise<void>((resolve) => (release = resolve))
    await mockApis(page, {
        override: async (url) => {
            if (url.pathname.startsWith("/points/")) {
                await blocked
            }
        },
    })
    await page.goto("#/")

    await expect(page.locator("#geocodingSearch")).toBeVisible()
    await expect(page.locator("h1.display-5")).toHaveCount(0)
    await expect(heading(page)).toHaveCount(0)
    release()
    await expect(heading(page)).toBeVisible()
})

test("uses Denver when location is denied", async ({ page }) => {
    await mockApis(page)
    await page.goto("#/")
    await expect(heading(page)).toHaveText("Place 39.7644")
})

test("doesn't fetch Denver for a returning visitor who hasn't moved", async ({ page }) => {
    await page.addInitScript(() =>
        localStorage.setItem("condiesLastLocation", JSON.stringify({ lat: "40.1234", lon: "-105.5678" })),
    )
    const requests = await mockApis(page, { location: here })
    await page.goto("#/")

    await expect(heading(page)).toHaveText("Place 40.1234")
    expect(pointRequests(requests)).toEqual(["40.1234,-105.5678"])
})

test("says so and shows Denver when the real location has no forecast", async ({ page }) => {
    await mockApis(page, {
        location: here,
        override: (url, route) => {
            if (url.pathname.startsWith("/points/40.12")) {
                void route.fulfill({ status: 404, body: "{}" })
                return true
            }
        },
    })
    await page.goto("#/")

    await expect(page.locator(".alert-warning")).toContainText("Couldn't load the forecast for your location")
    await expect(heading(page)).toHaveText("Place 39.7644")
})

test("a sunrise outage only hides that row", async ({ page }) => {
    await mockApis(page, {
        override: (url, route) => {
            if (url.hostname === "aa.usno.navy.mil") {
                void route.abort()
                return true
            }
        },
    })
    await page.goto("#/")

    await expect(chart(page)).toBeVisible()
    await expect(page.getByText("6:45 AM")).toHaveCount(0)
    await expect(page.locator(".alert-danger")).toHaveCount(0)
})

test("a failed daily forecast keeps the hourly chart", async ({ page }) => {
    await mockApis(page, {
        override: (url, route) => {
            if (url.pathname.endsWith("/g/forecast")) {
                void route.fulfill({ status: 500, body: "{}" })
                return true
            }
        },
    })
    await page.goto("#/")

    await expect(chart(page)).toBeVisible()
    await expect(page.locator(".daily-row")).toHaveCount(0)
})

test("an uncovered location shows an error with a way home", async ({ page }) => {
    await mockApis(page, {
        override: (url, route) => {
            if (url.pathname.startsWith("/points/48.85")) {
                void route.fulfill({ status: 404, body: "{}" })
                return true
            }
        },
    })
    await page.goto("#/forecast/48.8500,2.3500")

    await expect(page.locator(".alert-danger")).toContainText("Couldn't load this page")
    await page.getByRole("link", { name: "go home" }).click()
    await expect(heading(page)).toHaveText("Place 39.7644")
})

test("each alert opens its own details and closes cleanly", async ({ page }) => {
    await mockApis(page, { alerts: stormAlerts })
    await page.goto("#/")

    await page.locator(".alert-danger").click()
    await expect(page.locator(".modal.show .modal-title")).toHaveText("Storm headline")
    await page.locator(".modal.show .modal-footer button").click()
    await expect(page.locator(".modal-backdrop")).toHaveCount(0)

    await page.locator(".alert-info").click()
    await expect(page.locator(".modal.show .modal-title")).toHaveText("Frost headline")
    await page.keyboard.press("Escape")
    await expect(page.locator(".modal-backdrop")).toHaveCount(0)
})

test("leaving a page with an alert open doesn't lock scrolling", async ({ page }) => {
    await mockApis(page, { alerts: stormAlerts })
    await page.goto("#/")

    await page.locator(".alert-danger").click()
    await expect(page.locator(".modal.show")).toBeVisible()
    await page.evaluate(() => (location.hash = "#/forecast/38.5000,-105.5000"))

    await expect(heading(page)).toHaveText("Place 38.5")
    await expect(page.locator("body")).not.toHaveClass(/modal-open/)
})

test("chart tabs switch the chart", async ({ page }) => {
    await mockApis(page)
    await page.goto("#/")

    for (const [id, title] of [
        ["forecast-precip", "HOURLY PRECIPITATION"],
        ["forecast-wind", "HOURLY WIND"],
        ["forecast-temp", "HOURLY TEMPS"],
    ]) {
        await page.locator(`label[for=${id}]`).click()
        await expect(page.locator(".chart-title")).toHaveText(title)
        await expect(chart(page)).toHaveCount(1)
    }
})

test("the chart redraws when the window narrows", async ({ page }) => {
    await page.setViewportSize({ width: 800, height: 800 })
    await mockApis(page)
    await page.goto("#/")
    await expect(chart(page)).toBeVisible()

    await page.setViewportSize({ width: 375, height: 800 })
    await expect
        .poll(() => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth))
        .toBeLessThanOrEqual(0)
    await expect(chart(page)).toHaveCount(1)
})

test("chart fill starts at the left edge", async ({ page }) => {
    await mockApis(page, { hourly: hourly(14) })
    await page.goto("#/")
    await expect(chart(page)).toBeVisible()

    const left = await page.evaluate(
        () => document.querySelector(".forecast-chart svg path")!.getBoundingClientRect().left,
    )
    const axis = await page.evaluate(() => document.querySelector(".axis-line")!.getBoundingClientRect().left)
    expect(Math.abs(left - axis)).toBeLessThan(2)
})

test("the theme toggles and is remembered", async ({ page }) => {
    await mockApis(page)
    await page.goto("#/")

    await page.locator("label[for=condies-theme-dark]").click()
    await expect(page.locator("body")).toHaveAttribute("data-bs-theme", "dark")
    await page.reload()
    await expect(page.locator("body")).toHaveAttribute("data-bs-theme", "dark")
})

test("search works from the keyboard", async ({ page }) => {
    await mockApis(page)
    await page.goto("#/")
    const input = page.locator("#geocodingSearch")

    await input.fill("boul")
    await expect(page.locator("a.search-result")).toHaveCount(2)
    await expect(page.locator("a.search-result.active")).toHaveText("boul one")

    await input.press("ArrowUp")
    await expect(page.locator("a.search-result.active")).toHaveText("boul two")
    await input.press("ArrowDown")
    await input.press("Enter")
    await expect(page).toHaveURL(/#\/forecast\/40\.015,-105\.27/)
    await expect(heading(page)).toHaveText("Place 40.015")
})

test("search text is URL-encoded", async ({ page }) => {
    const requests = await mockApis(page)
    await page.goto("#/")

    await page.locator("#geocodingSearch").fill("Texas A&M #5")
    await expect(page.locator("a.search-result").first()).toBeVisible()
    expect(new URL(requests.find((u) => u.includes("forward"))!).searchParams.get("q")).toBe("Texas A&M #5")
})

test("a slow older search can't replace newer results", async ({ page }) => {
    let answered = false
    await mockApis(page, {
        override: async (url, route) => {
            if (url.searchParams.get("q") === "denv") {
                await new Promise((resolve) => setTimeout(resolve, 900))
                answered = true
                await route.fulfill({
                    status: 200,
                    contentType: "application/json",
                    headers: { "access-control-allow-origin": "*" },
                    body: JSON.stringify({
                        features: [
                            {
                                id: "x",
                                properties: { full_address: "STALE", coordinates: { latitude: 1, longitude: 1 } },
                            },
                        ],
                    }),
                })
                return true
            }
        },
    })
    await page.goto("#/")
    const input = page.locator("#geocodingSearch")

    await input.fill("denv")
    await page.waitForRequest((r) => r.url().includes("q=denv"))
    await input.fill("denver")
    await expect(page.locator("a.search-result").first()).toHaveText("denver two")
    await expect.poll(() => answered).toBe(true)
    await expect(page.getByText("STALE")).toHaveCount(0)
})

test("a poisoned search cache entry is ignored", async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem("boul", "undefined"))
    await mockApis(page)
    await page.goto("#/")

    await page.locator("#geocodingSearch").fill("boul")
    await expect(page.locator("a.search-result")).toHaveCount(2)
})

test("the app works with storage blocked", async ({ page }) => {
    await page.addInitScript(() =>
        Object.defineProperty(window, "localStorage", {
            get() {
                throw new DOMException("denied", "SecurityError")
            },
        }),
    )
    await mockApis(page)
    await page.goto("#/")
    await expect(chart(page)).toBeVisible()
})

test("changing the coordinates in the URL loads the new place", async ({ page }) => {
    await mockApis(page)
    await page.goto("#/forecast/39.1000,-106.1000")
    await expect(heading(page)).toHaveText("Place 39.1")

    await page.evaluate(() => (location.hash = "#/forecast/38.5000,-105.5000"))
    await expect(heading(page)).toHaveText("Place 38.5")
})
