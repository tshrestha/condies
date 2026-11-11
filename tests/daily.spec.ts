import { expect, type Page, test } from "@playwright/test"

import { dateAt, gridFixture, hourly, mockApis, period, timeAt, week } from "./fixtures.ts"

const days = (page: Page) => page.getByRole("region", { name: "This week" }).getByRole("link")
const here = { latitude: 40.1234, longitude: -105.5678 }
// How Home writes a date, as in "Nov 10".
const short = (date: string) =>
    new Date(`${date}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })
// Noon tomorrow in the forecast's time zone, as hours from now.
const tomorrowNoon = () => (Date.parse(`${dateAt(1)}T12:00:00-07:00`) - Date.now()) / 3_600_000

test("groups the forecast into one row per day", async ({ page }) => {
    await mockApis(page)
    await page.goto("#/")

    await expect(days(page)).toHaveCount(7)
    // The day's high and the night's low, in one row.
    await expect(days(page).first()).toHaveAccessibleName(`Today, ${short(dateAt(0))}. Sunny. low 20°. high 40°`)

    // The rain chance and wind range across both periods are on that day's own screen.
    await days(page).first().click()
    await expect(page.locator(".day-stat", { hasText: "Chance of" })).toContainText("60%")
    await expect(page.locator(".day-stat", { hasText: "Wind" })).toContainText("3–15 mph")
})

test("an evening load starts with Tonight and has no high", async ({ page }) => {
    await mockApis(page, { daily: week().slice(1) })
    await page.goto("#/")

    await expect(days(page).first()).toHaveAccessibleName(`Tonight, ${short(dateAt(0))}. Clear. low 20°`)
})

test("a period that already ended is dropped", async ({ page }) => {
    const daily = week()
    daily[0] = { ...daily[0], endTime: timeAt(-2) }
    daily[1] = { ...daily[1], endTime: timeAt(-1) }
    await mockApis(page, { daily })
    await page.goto("#/")

    await expect(days(page)).toHaveCount(6)
    await expect(days(page).first()).toHaveAccessibleName(/high 43°$/)
})

test("POW DAY and PRIMO days are marked", async ({ page }) => {
    const calm = { value: 8, unitCode: "wmoUnit:km_h-1" }
    const daily = week()
    // Tomorrow a foot of snow falls.
    daily[2] = { ...daily[2], windSpeed: calm, probabilityOfPrecipitation: { value: 90 } }
    // Sunny, mild and calm used to be enough for PRIMO. Now only a perfect score is.
    daily[6] = {
        ...daily[6],
        shortForecast: "Sunny",
        temperature: 65,
        windSpeed: calm,
        probabilityOfPrecipitation: { value: 0 },
    }
    await mockApis(page, {
        daily,
        hourly: hourly(80, { windSpeed: calm }),
        grid: gridFixture([{ hoursFromNow: tomorrowNoon(), inches: 12 }]),
    })
    await page.goto("#/")

    await expect(days(page).nth(1)).toHaveAccessibleName(/^Tomorrow, .*\. POW DAY\. 12″\./)
    // The morning after the storm, fresh snow under clear calm skies scores 100.
    await expect(days(page).nth(2)).toHaveAccessibleName(/^\w+, .*\. PRIMO\./)
    await expect(days(page).nth(3)).not.toHaveAccessibleName(/PRIMO|POW DAY/)
})

test("a row opens that day with its detail and hours", async ({ page }) => {
    await mockApis(page, { location: here })
    await page.goto("#/")
    await days(page).nth(1).click()

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
    await days(page).nth(1).click()
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
        await mockApis(page, { daily, grid: gridFixture([{ hoursFromNow: tomorrowNoon(), inches: 14 }]) })
        await page.goto("#/")
        await expect(days(page)).toHaveCount(7)
        await expect(page.getByRole("region", { name: "Daylight" })).toBeVisible()

        const pageOverflow = () => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
        // Text on Home that runs past its own box, leaving out text kept for screen readers.
        const clippedOnHome = () =>
            page.getByRole("main").evaluate((main) =>
                [...main.querySelectorAll("*")]
                    .filter((e) =>
                        [...e.childNodes].some((n) => n.nodeType === Node.TEXT_NODE && n.textContent!.trim()),
                    )
                    .filter((e) => e.clientWidth > 1 && e.scrollWidth > e.clientWidth + 1)
                    .map((e) => e.textContent),
            )
        expect(await pageOverflow()).toBe(0)
        expect(await clippedOnHome()).toEqual([])

        await days(page).nth(1).click()
        await expect(page.locator(".day-hero")).toBeVisible()
        const clippedOnDay = () =>
            page.evaluate(
                () =>
                    [...document.querySelectorAll(".day-stat, .day-insight, .card-header")].filter(
                        (e) => e.scrollWidth > e.clientWidth + 1,
                    ).length,
            )
        expect(await pageOverflow()).toBe(0)
        expect(await clippedOnDay()).toBe(0)
    })
}

test("an overnight period doesn't replace the day's own low", async ({ page }) => {
    const daily = week().slice(2)
    daily.unshift(period("Overnight", dateAt(1), false, 11, { startTime: `${dateAt(1)}T01:00:00-07:00` }))
    await mockApis(page, { daily })
    await page.goto("#/")

    await expect(days(page).first()).toHaveAccessibleName(/low 22°/)
})
