import { expect, test } from "@playwright/test"

import { dateAt, gridFixture, hourly, mockApis } from "./fixtures.ts"

// Hourly charts live on the Day screen. Today's is the one Home's next 12 hours open.
const today = () => `#/forecast/39.7644,-105.0196/day/${dateAt(0)}`
// Today's screen shows only the hours left today, so expectations count those.
const isToday = (hour: { startTime: string }) => hour.startTime.startsWith(dateAt(0))

test("Now shows the temperature, the conditions, the feels-like and the wind", async ({ page }) => {
    await mockApis(page, {
        grid: gridFixture([]),
        hourly: hourly(80, { temperature: 30, windSpeed: { value: 16, unitCode: "wmoUnit:km_h-1" } }),
    })
    await page.goto("#/")

    const now = page.getByRole("region", { name: "Right now" })
    await expect(now.getByText("30°", { exact: true })).toBeVisible()
    await expect(now.getByText("Snow", { exact: true })).toBeVisible()
    await expect(now.getByText("Feels like 23° · Wind 10 mph NW", { exact: true })).toBeVisible()
})

test("the wind chart draws gusts over the wind line", async ({ page }) => {
    await mockApis(page, { hourly: hourly(80, { windGust: { value: 48, unitCode: "wmoUnit:km_h-1" } }) })
    await page.goto(today())
    await page.locator("label[for=forecast-wind]").click()

    await expect(page.locator(".chart-overlay")).toHaveCount(1)
    await expect(page.locator(".chart-legend")).toHaveText("gusts")
    await expect(page.locator("label[for=forecast-wind-gust]")).toHaveCount(0)
})

test("night hours are shaded", async ({ page }) => {
    // Some daylight and some dark in what's left of today, however late it is.
    const left = hourly(14).filter(isToday).length
    const hours = hourly(14).map((h, i) => ({ ...h, isDaytime: i < Math.min(5, left - 1) }))
    await mockApis(page, { hourly: hours })
    await page.goto(today())

    await expect(page.locator(".forecast-chart svg")).toBeVisible()
    await expect(page.locator(".night-bands rect")).toHaveCount(hours.filter((h) => isToday(h) && !h.isDaytime).length)
})

test("the snow tab only appears when snow is expected", async ({ page }) => {
    await mockApis(page, { grid: gridFixture([{ hoursFromNow: 0, inches: 3 }]) })
    await page.goto(today())
    await page.locator("label[for=forecast-snow]").click()

    await expect(page.locator(".chart-title")).toHaveText("HOURLY SNOW")
    await expect(page.locator(".data-point-label", { hasText: "0.5″" }).first()).toBeVisible()
})

test("there's no snow tab without snow", async ({ page }) => {
    await mockApis(page, { grid: gridFixture([]) })
    await page.goto(today())
    await expect(page.locator(".forecast-chart svg")).toBeVisible()
    await expect(page.locator("label[for=forecast-snow]")).toHaveCount(0)
})

test("forecast labels stay clear of values at the left edge", async ({ page }) => {
    const rows = hourly(14, { shortForecast: "Sunny", probabilityOfPrecipitation: { value: 0 } })
    await mockApis(page, { hourly: rows })
    await page.goto(today())
    await page.locator("label[for=forecast-precip]").click()
    await expect(page.locator(".chart-title")).toHaveText("HOURLY PRECIPITATION")

    const [label, value] = await page.evaluate(() => [
        document.querySelector("text.forecast-label")!.getBoundingClientRect().left,
        document.querySelector(".data-point-label-bg")!.getBoundingClientRect().right,
    ])
    expect(label).toBeGreaterThan(value)
})
