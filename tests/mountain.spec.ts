import { expect, type Page, test } from "@playwright/test"

import { gridFixture, hourly, mockApis } from "./fixtures.ts"

const conditions = (page: Page) => page.locator(".mountain-conditions")
const rows = (page: Page) => page.locator(".daily-row")

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
    test("shows the rating for the zone", async ({ page }) => {
        await mockApis(page, { avalanche: [zone({})] })
        await page.goto("#/")

        await expect(conditions(page)).toContainText("Avalanche danger: Considerable")
        await expect(conditions(page)).toContainText("Dangerous avalanche conditions.")
        const link = conditions(page).getByRole("link", { name: "Test Avalanche Center" })
        await expect(link).toHaveAttribute("href", "https://example.com/forecast")
    })

    test("calls out a warning", async ({ page }) => {
        await mockApis(page, { avalanche: [zone({ warning: { product: "warning" } })] })
        await page.goto("#/")

        await expect(conditions(page)).toContainText("Avalanche warning in effect")
    })

    test("never treats a missing rating as safe", async ({ page }) => {
        await mockApis(page, { avalanche: [zone({ danger_level: -1, end_date: null })] })
        await page.goto("#/")

        await expect(conditions(page)).toContainText("No current avalanche rating")
        await expect(conditions(page)).toContainText("That doesn't mean it's safe")
    })

    test("doesn't show a rating that has run out", async ({ page }) => {
        const end_date = new Date(Date.now() - 3_600_000).toISOString().slice(0, 19)
        await mockApis(page, { avalanche: [zone({ end_date })] })
        await page.goto("#/")

        await expect(conditions(page)).toContainText("No current avalanche rating")
        await expect(conditions(page)).not.toContainText("Considerable")
    })

    test("stays out of the way out of season", async ({ page }) => {
        await mockApis(page, { avalanche: [zone({ off_season: true })] })
        await page.goto("#/")

        await expect(rows(page)).toHaveCount(7)
        await expect(conditions(page)).toBeHidden()
    })

    test("the forecast still loads when the avalanche service is down", async ({ page }) => {
        await mockApis(page)
        await page.goto("#/")

        await expect(rows(page)).toHaveCount(7)
        await expect(conditions(page)).toBeHidden()
    })
})

test.describe("measured snow", () => {
    // Berthoud Summit, a real SNOTEL station from the bundled list.
    const nearStation = "#/forecast/39.8,-105.78"
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

        await expect(conditions(page).locator(".snow-depth")).toHaveText("38″")
        await expect(conditions(page)).toContainText("+8″ in 24 hours")
        await expect(conditions(page)).toContainText("Berthoud Summit")
        await expect(conditions(page)).toContainText("measured just now")
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

        await expect(conditions(page).locator(".snow-depth")).toHaveText("14″")
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

        await expect(rows(page)).toHaveCount(7)
        await page.waitForTimeout(300)
        await expect(conditions(page)).toBeHidden()
    })

    test("looks up nothing far from any station", async ({ page }) => {
        const requests = await mockApis(page, { snowDepth: [] })
        await page.goto("#/forecast/30.3,-97.7")

        await expect(rows(page)).toHaveCount(7)
        expect(requests.some((u) => u.includes("egov.usda.gov"))).toBe(false)
    })
})

test.describe("hero facts", () => {
    const facts = (page: Page) => page.locator(".sky-facts")

    test("shows wind, gusts and the feels-like temperature", async ({ page }) => {
        await mockApis(page, {
            grid: gridFixture([]),
            hourly: hourly(80, {
                temperature: 30,
                windSpeed: { value: 16, unitCode: "wmoUnit:km_h-1" },
                windGust: { value: 48, unitCode: "wmoUnit:km_h-1" },
            }),
        })
        await page.goto("#/")

        await expect(facts(page)).toContainText("Feels like 23°")
        await expect(facts(page)).toContainText("NW 10 mph")
        await expect(facts(page)).toContainText("Gusts 30 mph")
    })

    test("leaves out a feels-like that matches the temperature", async ({ page }) => {
        const grid = gridFixture([])
        grid.apparentTemperature = { values: [{ validTime: grid.windChill.values[0].validTime, value: -1 }] }
        await mockApis(page, { grid, hourly: hourly(80, { temperature: 30 }) })
        await page.goto("#/")

        await expect(facts(page)).toContainText("mph")
        await expect(facts(page)).not.toContainText("Feels like")
    })

    test("says calm when there's no wind", async ({ page }) => {
        await mockApis(page, { hourly: hourly(80, { windSpeed: { value: 0, unitCode: "wmoUnit:km_h-1" } }) })
        await page.goto("#/")

        await expect(facts(page)).toContainText("Calm")
    })
})

test.describe("week outlook", () => {
    test("names the next storm", async ({ page }) => {
        await mockApis(page, { grid: gridFixture([{ hoursFromNow: 26, inches: 6 }]) })
        await page.goto("#/")

        await expect(page.locator(".daily-outlook").first()).toContainText(/Snow .*6\.0″/)
    })

    test("doesn't mention a storm when none is coming", async ({ page }) => {
        await mockApis(page, { grid: gridFixture([]) })
        await page.goto("#/")

        await expect(rows(page)).toHaveCount(7)
        await expect(page.locator(".daily-outlook")).not.toContainText("Snow")
    })

    test("points at the best day and opens it", async ({ page }) => {
        await mockApis(page, { grid: gridFixture([]) })
        await page.goto("#/")

        const best = page.locator("a.daily-outlook")
        await expect(best).toContainText("Best day:")
        await best.click()
        await expect(page).toHaveURL(/\/day\//)
    })

    test("doesn't pick a best day without scores", async ({ page }) => {
        await mockApis(page)
        await page.goto("#/")

        await expect(rows(page)).toHaveCount(7)
        await expect(page.locator(".daily-outlook")).toHaveCount(0)
    })
})

test("charts describe themselves to screen readers", async ({ page }) => {
    await mockApis(page)
    await page.goto("#/")

    await expect(page.locator(".forecast-chart svg")).toHaveAttribute("aria-label", /^HOURLY TEMPS: .*Snow/)
})

test("icon-only links have names", async ({ page }) => {
    await mockApis(page)
    await page.goto("#/")
    await expect(page.getByRole("link", { name: "Map" })).toBeVisible()

    await page.goto("#/spots")
    await expect(page.getByRole("link", { name: "Now" })).toBeVisible()
    await expect(page.getByRole("button", { name: "Dark mode" })).toBeVisible()
})
