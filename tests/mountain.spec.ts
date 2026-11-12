import { expect, type Page, test } from "@playwright/test"

import { dateAt, gridFixture, hourly, mockApis, week } from "./fixtures.ts"

const days = (page: Page) => page.getByRole("region", { name: "This week" }).getByRole("link")
const snow = (page: Page) => page.getByRole("region", { name: "Snow" })
const now = (page: Page) => page.getByRole("region", { name: "Right now" })
const nextHours = (page: Page) => page.getByRole("region", { name: "Next 12 hours" })

// Covers the default Denver location that tests load when geolocation is denied.
const zone = (properties: object) => ({
    properties: {
        center: "Test Avalanche Center",
        link: "https://example.com/forecast",
        off_season: false,
        danger_level: 3,
        travel_advice: "Dangerous avalanche conditions.",
        end_date: new Date(Date.now() + 3_600_000).toISOString().slice(0, 19),
        warning: { product: null },
        ...properties,
    },
    geometry: {
        type: "Polygon",
        coordinates: [
            [
                [-106, 39],
                [-104, 39],
                [-104, 40],
                [-106, 40],
                [-106, 39],
            ],
        ],
    },
})

// Stations report in local standard time, as UTC-7 here.
const readingAt = (hoursAgo: number, value: number) => ({
    date: new Date(Date.now() - hoursAgo * 3_600_000 - 7 * 3_600_000).toISOString().slice(0, 16).replace("T", " "),
    value,
})

test.describe("avalanche danger", () => {
    const avalancheDialog = (page: Page) => page.getByRole("dialog", { name: "Avalanche danger" })
    const noRating = (page: Page) => page.getByRole("region", { name: "Avalanche danger" })

    test("shows the rating for the zone", async ({ page }) => {
        await mockApis(page, { avalanche: [zone({})] })
        await page.goto("/")

        // Considerable or worse is a go or no-go fact, so it joins the alerts.
        const rating = page.getByRole("region", { name: "Alerts" }).getByRole("button")
        await expect(rating).toHaveAccessibleName("Considerable avalanche danger 3 of 5")
        await rating.click()

        await expect(avalancheDialog(page)).toContainText("Level 3 of 5.")
        await expect(avalancheDialog(page)).toContainText("Dangerous avalanche conditions.")
        const link = avalancheDialog(page).getByRole("link", { name: "Test Avalanche Center" })
        await expect(link).toHaveAttribute("href", "https://example.com/forecast")
    })

    test("a low rating stays out of the alerts", async ({ page }) => {
        await mockApis(page, { avalanche: [zone({ danger_level: 2, travel_advice: "Heightened conditions." })] })
        await page.goto("/")

        await page.getByRole("button", { name: "Moderate avalanche danger 2 of 5" }).click()
        await expect(avalancheDialog(page)).toContainText("Level 2 of 5.")
        await expect(page.getByRole("region", { name: "Alerts" })).toHaveCount(0)
    })

    test("calls out a warning", async ({ page }) => {
        await mockApis(page, { avalanche: [zone({ warning: { product: "warning" } })] })
        await page.goto("/")

        await page.getByRole("button", { name: /avalanche danger/ }).click()
        await expect(avalancheDialog(page)).toContainText("Avalanche warning in effect.")
    })

    test("never treats a missing rating as safe", async ({ page }) => {
        await mockApis(page, { avalanche: [zone({ danger_level: -1, end_date: null })] })
        await page.goto("/")

        await expect(noRating(page)).toContainText("No current avalanche rating")
        await expect(noRating(page)).toContainText(/That doesn.t mean it.s safe/)
        const link = noRating(page).getByRole("link", { name: "Test Avalanche Center" })
        await expect(link).toHaveAttribute("href", "https://example.com/forecast")
    })

    test("doesn't show a rating that has run out", async ({ page }) => {
        const end_date = new Date(Date.now() - 3_600_000).toISOString().slice(0, 19)
        await mockApis(page, { avalanche: [zone({ end_date })] })
        await page.goto("/")

        await expect(noRating(page)).toContainText("No current avalanche rating")
        await expect(page.getByText(/Considerable/)).toHaveCount(0)
    })

    test("stays out of the way out of season", async ({ page }) => {
        await mockApis(page, { avalanche: [zone({ off_season: true })] })
        const answered = page.waitForResponse((r) => r.url().includes("api.avalanche.org"))
        await page.goto("/")

        await expect(days(page)).toHaveCount(7)
        await answered
        await page.waitForTimeout(300)
        await expect(page.getByText(/avalanche/i)).toHaveCount(0)
    })

    test("the forecast still loads when the avalanche service is down", async ({ page }) => {
        await mockApis(page)
        const failed = page.waitForEvent("requestfailed", (r) => r.url().includes("api.avalanche.org"))
        await page.goto("/")

        await expect(days(page)).toHaveCount(7)
        await failed
        await page.waitForTimeout(300)
        await expect(page.getByText(/avalanche/i)).toHaveCount(0)
    })
})

test.describe("measured snow", () => {
    // Berthoud Summit, a real SNOTEL station from the bundled list.
    const nearStation = "/forecast/39.8,-105.78"
    const triplet = "335:CO:SNTL"

    test("shows depth and new snow from the closest station", async ({ page }) => {
        await mockApis(page, {
            snowDepth: [
                {
                    stationTriplet: triplet,
                    data: [
                        {
                            values: [
                                readingAt(25, 30),
                                readingAt(24, 30),
                                readingAt(2, 38),
                                readingAt(1, 38),
                                readingAt(0, 38),
                            ],
                        },
                    ],
                },
            ],
        })
        await page.goto(nearStation)

        await expect(snow(page).getByRole("term")).toHaveText(["Last 24 hours", "On the ground"])
        await expect(snow(page).getByRole("definition")).toHaveText(["+8″", "38″"])
        await expect(snow(page)).toContainText(/Measured at Berthoud Summit, [\d.]+ mi away at [\d,]+ ft, just now\./)
    })

    test("falls back to the next station when the closest has no depth sensor", async ({ page }) => {
        const requests = await mockApis(page, {
            override: async (url, route) => {
                if (url.hostname !== "wcc.sc.egov.usda.gov") {
                    return
                }
                const triplets = url.searchParams.get("stationTriplets")!.split(",")
                expect(triplets.length).toBeGreaterThan(1)
                await route.fulfill({
                    json: [
                        { stationTriplet: triplets[0], data: [] },
                        { stationTriplet: triplets[1], data: [{ values: [readingAt(0, 14)] }] },
                    ],
                    headers: { "access-control-allow-origin": "*" },
                })
                return true
            },
        })
        await page.goto(nearStation)

        await expect(snow(page).getByRole("term")).toHaveText(["Last 24 hours", "On the ground"])
        await expect(snow(page).getByRole("definition").nth(1)).toHaveText("14″")
        await expect(snow(page)).not.toContainText("Berthoud Summit")
        expect(requests.some((u) => u.includes("elements=SNWD"))).toBe(true)
    })

    test("doesn't go looking for snow when the closest station is bare", async ({ page }) => {
        await mockApis(page, {
            override: async (url, route) => {
                if (url.hostname !== "wcc.sc.egov.usda.gov") {
                    return
                }
                const triplets = url.searchParams.get("stationTriplets")!.split(",")
                await route.fulfill({
                    json: [
                        { stationTriplet: triplets[0], data: [{ values: [readingAt(0, 0)] }] },
                        { stationTriplet: triplets[1], data: [{ values: [readingAt(0, 22)] }] },
                    ],
                    headers: { "access-control-allow-origin": "*" },
                })
                return true
            },
        })
        await page.goto(nearStation)

        await expect(days(page)).toHaveCount(7)
        await page.waitForTimeout(300)
        await expect(snow(page)).toHaveCount(0)
    })

    test("looks up nothing far from any station", async ({ page }) => {
        const requests = await mockApis(page, { snowDepth: [] })
        await page.goto("/forecast/30.3,-97.7")

        await expect(days(page)).toHaveCount(7)
        expect(requests.some((u) => u.includes("egov.usda.gov"))).toBe(false)
    })
})

test.describe("right now", () => {
    test("shows the wind and feels-like, and gusts on the day's own screen", async ({ page }) => {
        const gust = { value: 48, unitCode: "wmoUnit:km_h-1" }
        await mockApis(page, {
            grid: gridFixture([]),
            daily: week().map((p) => ({ ...p, windGust: gust })),
            hourly: hourly(80, {
                temperature: 30,
                windSpeed: { value: 16, unitCode: "wmoUnit:km_h-1" },
                windGust: gust,
            }),
        })
        await page.goto("/")

        await expect(now(page).getByText("Feels like 23° · Wind 10 mph NW", { exact: true })).toBeVisible()
        await expect(now(page)).not.toContainText(/gust/i)

        await nextHours(page)
            .getByRole("link", { name: /Open hour by hour\.$/ })
            .click()
        await expect(page).toHaveURL(new RegExp(`/day/${dateAt(0)}\\?from=home$`))
        await expect(page.getByRole("region", { name: "Details" }).getByText(/ wind, gusts 30 mph$/)).toBeVisible()
    })

    test("leaves out a feels-like that matches the temperature", async ({ page }) => {
        const grid = gridFixture([])
        grid.apparentTemperature = { values: [{ validTime: grid.windChill.values[0].validTime, value: -1 }] }
        await mockApis(page, { grid, hourly: hourly(80, { temperature: 30 }) })
        await page.goto("/")

        await expect(now(page).getByText("Wind 10 mph NW", { exact: true })).toBeVisible()
        await expect(now(page)).not.toContainText("Feels like")
    })

    test("says calm when there's no wind", async ({ page }) => {
        await mockApis(page, { hourly: hourly(80, { windSpeed: { value: 0, unitCode: "wmoUnit:km_h-1" } }) })
        await page.goto("/")

        await expect(now(page).getByText("Calm", { exact: true })).toBeVisible()
    })
})

test.describe("week outlook", () => {
    test("names the next storm", async ({ page }) => {
        await mockApis(page, { grid: gridFixture([{ hoursFromNow: 26, inches: 6 }]) })
        await page.goto("/")

        await expect(nextHours(page).getByText(/^Snow .*6\.0″$/)).toBeVisible()
    })

    test("doesn't mention a storm when none is coming", async ({ page }) => {
        await mockApis(page, { grid: gridFixture([]) })
        await page.goto("/")

        await expect(days(page)).toHaveCount(7)
        await expect(nextHours(page)).toBeVisible()
        await expect(nextHours(page).getByText(/^Snow .*″$/)).toHaveCount(0)
    })

    test("points at the best day and opens it", async ({ page }) => {
        await mockApis(page, { grid: gridFixture([]) })
        await page.goto("/")

        const best = page.getByRole("region", { name: "Best day" })
        await expect(best.getByRole("button", { name: /^Condies score \d+\/100 \w+$/ })).toBeVisible()
        await best.getByRole("link", { name: /^Best day / }).click()
        await expect(page).toHaveURL(/\/day\//)
    })

    test("doesn't pick a best day without scores", async ({ page }) => {
        await mockApis(page)
        await page.goto("/")

        await expect(days(page)).toHaveCount(7)
        await expect(page.getByText("No standout day this week")).toBeVisible()
        await expect(page.getByRole("region", { name: "Best day" })).toHaveCount(0)
    })
})

test("charts describe themselves to screen readers", async ({ page }) => {
    await mockApis(page)
    await page.goto(`/forecast/39.7644,-105.0196/day/${dateAt(0)}`)

    // Today's chart is titled by whether its hours run on into tomorrow, which depends on the time of day.
    const hours = page.getByRole("region", { name: /^(Next 12 hours|Hour by hour)$/ })
    const reading = hours.getByText(/^Warmest \d+° at \d+ [AP]M, coldest \d+° at \d+ [AP]M\.$/)
    await expect(reading).toBeVisible()
    // The chart is named by its title and the sentence it shows above it.
    const title = await hours.getByRole("heading", { level: 2 }).textContent()
    await expect(hours.getByRole("img")).toHaveAccessibleName(`${title}. ${await reading.textContent()}`)
})

test("icon-only links have names", async ({ page }) => {
    await mockApis(page)
    await page.goto("/")
    await expect(page.getByRole("link", { name: "Map" })).toBeVisible()

    await page.goto("/spots")
    await expect(page.getByRole("link", { name: "Now" })).toBeVisible()
    await expect(page.getByRole("button", { name: "Dark mode" })).toBeVisible()
})
