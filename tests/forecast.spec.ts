import { expect, type Page, test } from "@playwright/test"

import {
    changeURL,
    dateAt,
    hourly,
    mockApis,
    pointRequests,
    searchQuery,
    searchReply,
    stormAlerts,
} from "./fixtures.ts"

const heading = (page: Page) => page.getByRole("heading", { level: 1, name: /^Right meow in / })
const place = (city: string) => `Right meow in ${city}, CO`
const nextHours = (page: Page) => page.getByRole("region", { name: "Next 12 hours" })
const days = (page: Page) => page.getByRole("region", { name: "This week" }).getByRole("link")
const here = { latitude: 40.1234, longitude: -105.5678 }
// Hourly charts live on the Day screen. Today's is the one Home's next 12 hours open.
const today = () => `/forecast/39.7644,-105.0196/day/${dateAt(0)}`
// Today's chart is titled by whether its hours run on into tomorrow, which depends on the time of day.
const chart = (page: Page) => page.getByRole("img", { name: /^(Next 12 hours|Hour by hour)\. / })
const views = (page: Page) => page.getByRole("group", { name: "Hourly view" })

// Search lives in a sheet that the dock's Search button opens.
async function openSearch(page: Page) {
    await page.getByRole("button", { name: "Search" }).click()
    return page.getByRole("combobox", { name: "Where to?" })
}

test("shows the forecast for the user's location", async ({ page }) => {
    await mockApis(page, { location: here })
    await page.goto("/")

    await expect(heading(page)).toHaveText(place("Place 40.1234"))
    await expect(nextHours(page).getByRole("link", { name: /^Now \d+°, .*\. Open hour by hour\.$/ })).toBeVisible()
    await expect(page.getByRole("region", { name: "Daylight" })).toContainText("Sunrise 6:45 AM, sunset 4:55 PM.")
    await expect(days(page)).toHaveCount(7)
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
    await page.goto("/")

    const waiting = page.getByRole("status").filter({ hasText: "Getting the forecast." })
    await expect(page.getByRole("button", { name: "Search" })).toBeVisible()
    await expect(waiting).toBeVisible()
    await expect(heading(page)).toHaveCount(0)
    release()
    await expect(heading(page)).toBeVisible()
    await expect(waiting).toHaveCount(0)
})

test("uses Denver when location is denied", async ({ page }) => {
    await mockApis(page)
    await page.goto("/")
    await expect(heading(page)).toHaveText(place("Place 39.7644"))
})

test("doesn't fetch Denver for a returning visitor who hasn't moved", async ({ page }) => {
    await page.addInitScript(() =>
        localStorage.setItem("condiesLastLocation", JSON.stringify({ lat: "40.1234", lon: "-105.5678" })),
    )
    const requests = await mockApis(page, { location: here })
    await page.goto("/")

    await expect(heading(page)).toHaveText(place("Place 40.1234"))
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
    await page.goto("/")

    await expect(
        page.getByRole("status").filter({ hasText: /Couldn.t load the forecast for your location/ }),
    ).toBeVisible()
    await expect(heading(page)).toHaveText(place("Place 39.7644"))
})

test("a sunrise outage only hides that section", async ({ page }) => {
    await mockApis(page, {
        override: (url, route) => {
            if (url.hostname === "aa.usno.navy.mil") {
                void route.abort()
                return true
            }
        },
    })
    await page.goto("/")

    await expect(nextHours(page)).toBeVisible()
    await expect(days(page)).toHaveCount(7)
    // Its placeholder goes too, rather than waiting forever.
    await expect(page.getByText("Daylight", { exact: true })).toHaveCount(0)
    await expect(page.getByRole("region", { name: "Daylight" })).toHaveCount(0)
    await expect(page.getByRole("alert")).toHaveCount(0)
})

test("a failed daily forecast keeps the next 12 hours", async ({ page }) => {
    await mockApis(page, {
        override: (url, route) => {
            if (url.pathname.endsWith("/g/forecast")) {
                void route.fulfill({ status: 500, body: "{}" })
                return true
            }
        },
    })
    await page.goto("/")

    await expect(heading(page)).toBeVisible()
    await expect(nextHours(page)).toBeVisible()
    await expect(page.getByRole("region", { name: "This week" })).toHaveCount(0)
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
    await page.goto("/forecast/48.8500,2.3500")

    await expect(page.getByRole("alert")).toContainText(/Couldn.t load this page/)
    await page.getByRole("link", { name: "Go home" }).click()
    await expect(heading(page)).toHaveText(place("Place 39.7644"))
})

test("each alert opens its own details and closes cleanly", async ({ page }) => {
    await mockApis(page, { alerts: [...stormAlerts].reverse() })
    await page.goto("/")

    const alerts = page.getByRole("region", { name: "Alerts" }).getByRole("button")
    // Most severe first, each saying how serious it is.
    await expect(alerts).toHaveCount(2)
    await expect(alerts.first()).toHaveAccessibleName("Winter Storm Warning Severe")
    await expect(alerts.last()).toHaveAccessibleName("Frost Advisory Minor")

    await alerts.first().click()
    const storm = page.getByRole("dialog", { name: "Winter Storm Warning" })
    await expect(storm).toBeVisible()
    await expect(storm).toContainText("Storm headline")
    await expect(storm).toContainText("Heavy snow")
    await storm.getByRole("button", { name: "Close" }).click()
    await expect(page.getByRole("dialog")).toHaveCount(0)

    await alerts.last().click()
    const frost = page.getByRole("dialog", { name: "Frost Advisory" })
    await expect(frost).toContainText("Frost headline")
    await page.keyboard.press("Escape")
    await expect(page.getByRole("dialog")).toHaveCount(0)
})

test("leaving a page with an alert open doesn't lock scrolling", async ({ page }) => {
    await mockApis(page, { alerts: stormAlerts })
    await page.goto("/")

    await page.getByRole("button", { name: /^Winter Storm Warning/ }).click()
    await expect(page.getByRole("dialog", { name: "Winter Storm Warning" })).toBeVisible()
    await changeURL(page, "/forecast/38.5000,-105.5000")

    await expect(heading(page)).toHaveText(place("Place 38.5"))
    await expect(page.getByRole("dialog")).toHaveCount(0)
    await page.mouse.wheel(0, 600)
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0)
})

test("chart tabs switch the chart", async ({ page }) => {
    await mockApis(page)
    await page.goto(today())

    for (const [view, reading] of [
        ["Precip", /\. Chance of rain peaks at \d+% at \d+ [AP]M\.$/],
        ["Wind", /\. Wind up to \d+ mph, gusts to \d+ mph\.$/],
        ["Temp", /\. Warmest \d+° at \d+ [AP]M, coldest \d+° at \d+ [AP]M\.$/],
    ] as const) {
        await views(page).getByRole("button", { name: view, exact: true }).click()
        await expect(views(page).getByRole("button", { pressed: true })).toHaveText([view])
        await expect(chart(page)).toHaveAccessibleName(reading)
        await expect(chart(page)).toHaveCount(1)
    }
})

test("the chart still fits after the window narrows", async ({ page }) => {
    await page.setViewportSize({ width: 800, height: 800 })
    await mockApis(page)
    await page.goto(today())
    await expect(chart(page)).toBeVisible()

    await page.setViewportSize({ width: 375, height: 800 })
    await expect
        .poll(() => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth))
        .toBeLessThanOrEqual(0)
    await expect(chart(page)).toHaveCount(1)
    const box = (await chart(page).boundingBox())!
    expect(box.x).toBeGreaterThanOrEqual(0)
    expect(box.x + box.width).toBeLessThanOrEqual(375)
})

test("chart fill starts at the left edge", async ({ page }) => {
    // Columns grow from the baseline. Without motion they're measured where they settle.
    await page.emulateMedia({ reducedMotion: "reduce" })
    await mockApis(page, { hourly: hourly(14) })
    await page.goto(today())
    await expect(chart(page)).toBeVisible()

    // The column list draws the baseline. The bar in a column isn't in the accessibility tree, so it's found
    // by its class.
    const columns = chart(page).getByRole("list").first()
    const baseline = (await columns.boundingBox())!
    const bar = (await columns.getByRole("listitem").first().locator(".sq-bar").boundingBox())!
    expect(bar.height).toBeGreaterThan(0)
    expect(Math.abs(bar.x - baseline.x)).toBeLessThan(2)
})

test("the theme toggles and is remembered", async ({ page }) => {
    await mockApis(page)
    await page.goto("/")

    await page.getByRole("button", { name: "Dark mode" }).click()
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark")
    await page.reload()
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark")
    await expect(page.getByRole("button", { name: "Dark mode" })).toHaveAttribute("aria-pressed", "true")
})

test("search works from the keyboard", async ({ page }) => {
    await mockApis(page)
    await page.goto("/")
    const input = await openSearch(page)

    await input.fill("boul")
    await expect(page.getByRole("option")).toHaveCount(2)
    await expect(page.getByRole("option", { selected: true })).toHaveText("boul one")

    await input.press("ArrowUp")
    await expect(page.getByRole("option", { selected: true })).toHaveText("boul two")
    await input.press("ArrowDown")
    await input.press("Enter")
    await expect(page).toHaveURL(/\/forecast\/40\.015,-105\.27/)
    await expect(heading(page)).toHaveText(place("Place 40.015"))
})

test("search text reaches the server as typed", async ({ page }) => {
    await mockApis(page)
    await page.goto("/")

    const searched = page.waitForRequest((r) => searchQuery(r) === "Texas A&M #5")
    await (await openSearch(page)).fill("Texas A&M #5")
    await searched
    await expect(page.getByRole("option").first()).toHaveText("Texas A&M #5 one")
})

test("a slow older search can't replace newer results", async ({ page }) => {
    let answered = false
    await mockApis(page, {
        override: async (_, route) => {
            if (searchQuery(route.request()) === "denv") {
                await new Promise((resolve) => setTimeout(resolve, 900))
                answered = true
                await route.fulfill(
                    searchReply([
                        {
                            id: "x",
                            properties: { full_address: "STALE", coordinates: { latitude: 1, longitude: 1 } },
                        },
                    ]),
                )
                return true
            }
        },
    })
    await page.goto("/")
    const input = await openSearch(page)

    await input.fill("denv")
    await page.waitForRequest((r) => searchQuery(r) === "denv")
    await input.fill("denver")
    await expect(page.getByRole("option")).toHaveText(["denver one", "denver two"])
    await expect.poll(() => answered).toBe(true)
    await expect(page.getByText("STALE")).toHaveCount(0)
})

test("a poisoned search cache entry is ignored", async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem("boul", "undefined"))
    await mockApis(page)
    await page.goto("/")

    await (await openSearch(page)).fill("boul")
    await expect(page.getByRole("option")).toHaveCount(2)
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
    await page.goto("/")
    await expect(heading(page)).toHaveText(place("Place 39.7644"))
    await expect(days(page)).toHaveCount(7)
})

test("changing the coordinates in the URL loads the new place", async ({ page }) => {
    await mockApis(page)
    await page.goto("/forecast/39.1000,-106.1000")
    await expect(heading(page)).toHaveText(place("Place 39.1"))

    await changeURL(page, "/forecast/38.5000,-105.5000")
    await expect(heading(page)).toHaveText(place("Place 38.5"))
})
