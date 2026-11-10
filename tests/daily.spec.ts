import { expect, type Page, test } from "@playwright/test"

import { dateAt, gridFixture, mockApis, period, timeAt, week } from "./fixtures.ts"

const rows = (page: Page) => page.locator(".daily-row")
const here = { latitude: 40.1234, longitude: -105.5678 }

test("groups the forecast into one row per day", async ({ page }) => {
    await mockApis(page)
    await page.goto("#/")

    await expect(rows(page)).toHaveCount(7)
    const first = rows(page).first()
    await expect(first.locator(".daily-day .fw-medium")).toHaveText("Today")
    await expect(first.locator(".daily-low")).toHaveText("20°")
    await expect(first.locator(".daily-high")).toHaveText("40°")
    await expect(first.locator(".daily-meta")).toContainText("60%")
    await expect(first.locator(".daily-meta")).toContainText("3–15 mph")
})

test("an evening load starts with Tonight and has no high", async ({ page }) => {
    await mockApis(page, { daily: week().slice(1) })
    await page.goto("#/")

    const first = rows(page).first()
    await expect(first.locator(".daily-day .fw-medium")).toHaveText("Tonight")
    await expect(first.locator(".daily-high")).toHaveText("–")
})

test("a period that already ended is dropped", async ({ page }) => {
    const daily = week()
    daily[0] = { ...daily[0], endTime: timeAt(-2) }
    daily[1] = { ...daily[1], endTime: timeAt(-1) }
    await mockApis(page, { daily })
    await page.goto("#/")

    await expect(rows(page)).toHaveCount(6)
    await expect(rows(page).first().locator(".daily-high")).toHaveText("43°")
})

test("POW DAY and PRIMO rows are highlighted", async ({ page }) => {
    const daily = week()
    daily[2] = {
        ...daily[2],
        shortForecast: "Heavy Snow",
        detailedForecast: "Snow. New snow accumulation of 8 to 12 inches possible.",
        windSpeed: { value: 8, unitCode: "wmoUnit:km_h-1" },
        probabilityOfPrecipitation: { value: 90 },
    }
    daily[4] = {
        ...daily[4],
        shortForecast: "Sunny",
        temperature: 65,
        windSpeed: { value: 8, unitCode: "wmoUnit:km_h-1" },
        probabilityOfPrecipitation: { value: 0 },
    }
    await mockApis(page, { daily })
    await page.goto("#/")

    await expect(rows(page).nth(1).locator(".daily-chip")).toHaveText("POW DAY")
    await expect(rows(page).nth(2).locator(".daily-chip")).toHaveText("PRIMO")
    await expect(rows(page).nth(3).locator(".daily-chip")).toHaveCount(0)
})

test("a row opens that day with its detail and hours", async ({ page }) => {
    await mockApis(page, { location: here })
    await page.goto("#/")
    await rows(page).nth(1).click()

    await expect(page).toHaveURL(new RegExp(`/day/${dateAt(1)}\\?from=home`))
    await expect(page.locator(".day-hero-low")).toHaveText("22°")
    await expect(page.locator(".day-hero-high")).toHaveText("43°")
    await expect(page.locator(".list-group-item p")).toHaveText(["Day1 detail text.", "Day1 Night detail text."])
    await expect(page.locator(".time-label")).toHaveCount(24)
    await expect(page.locator(".time-label", { hasText: "NOW" })).toHaveCount(0)
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0)
})

test("today's page marks the current hour", async ({ page }) => {
    await mockApis(page)
    await page.goto(`#/forecast/39.1000,-106.1000/day/${dateAt(0)}`)
    await expect(page.locator(".time-label").first()).toHaveText("NOW")
})

test("previous and next links move between days", async ({ page }) => {
    await mockApis(page)
    await page.goto(`#/forecast/39.1000,-106.1000/day/${dateAt(1)}`)
    await expect(page.locator(".day-hero-high")).toHaveText("43°")

    await page.locator("a.day-nav-link").last().click()
    await expect(page.locator(".day-hero-high")).toHaveText("46°")
    await expect(page).toHaveURL(new RegExp(`/day/${dateAt(2)}`))
})

test("back returns to Home when opened from Home", async ({ page }) => {
    await mockApis(page)
    await page.goto("#/")
    await rows(page).nth(1).click()
    await expect(page.locator(".day-hero")).toBeVisible()

    await page.locator(".bi-arrow-left").click()
    await expect(page).toHaveURL(/#\/$/)
})

test("back returns to the forecast page from a deep link", async ({ page }) => {
    await mockApis(page)
    await page.goto(`#/forecast/39.1000,-106.1000/day/${dateAt(1)}`)
    await expect(page.locator(".day-hero")).toBeVisible()

    await page.locator(".bi-arrow-left").click()
    await expect(page).toHaveURL(/#\/forecast\/39\.1000,-106\.1000$/)
})

test("an unknown date offers a way back", async ({ page }) => {
    await mockApis(page)
    await page.goto("#/forecast/39.1000,-106.1000/day/2020-01-01")
    await expect(page.locator(".alert-secondary")).toContainText("no forecast for this day")
})

test("a deep link applies the saved theme", async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem("condiesTheme", '"dark"'))
    await mockApis(page)
    await page.goto(`#/forecast/39.1000,-106.1000/day/${dateAt(1)}`)
    await expect(page.locator("body")).toHaveAttribute("data-bs-theme", "dark")
})

for (const width of [320, 390]) {
    test(`everything fits at ${width}px`, async ({ page }) => {
        await page.setViewportSize({ width, height: 800 })
        const daily = week().map((p) => ({
            ...p,
            temperature: p.temperature + 70,
            windSpeed: { minValue: 19, maxValue: 56, unitCode: "wmoUnit:km_h-1" },
        }))
        const snowTomorrow = (Date.parse(`${dateAt(1)}T12:00:00-07:00`) - Date.now()) / 3_600_000
        await mockApis(page, { daily, grid: gridFixture([{ hoursFromNow: snowTomorrow, inches: 14 }]) })
        await page.goto("#/")
        await expect(rows(page)).toHaveCount(7)

        const overflow = () =>
            page.evaluate(() => ({
                page: document.documentElement.scrollWidth - window.innerWidth,
                clipped: [
                    ...document.querySelectorAll(
                        ".daily-meta, .daily-day, .daily-temps, .day-stat, .day-insight, .card-header",
                    ),
                ].filter((e) => e.scrollWidth > e.clientWidth + 1).length,
            }))
        expect(await overflow()).toEqual({ page: 0, clipped: 0 })

        await rows(page).nth(1).click()
        await expect(page.locator(".day-hero")).toBeVisible()
        expect(await overflow()).toEqual({ page: 0, clipped: 0 })
    })
}

test("an overnight period doesn't replace the day's own low", async ({ page }) => {
    const daily = week().slice(2)
    daily.unshift(period("Overnight", dateAt(1), false, 11, { startTime: `${dateAt(1)}T01:00:00-07:00` }))
    await mockApis(page, { daily })
    await page.goto("#/")

    await expect(rows(page).first().locator(".daily-low")).toHaveText("22°")
})
