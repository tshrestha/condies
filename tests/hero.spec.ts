import { expect, test } from "@playwright/test"

import { gridFixture, hourly, mockApis } from "./fixtures.ts"

const sky = ".current-conditions"

test("the sky matches the weather", async ({ page }) => {
    await mockApis(page, { hourly: hourly(14, { shortForecast: "Sunny" }) })
    await page.goto("#/")
    await expect(page.locator(sky)).toHaveClass(/sky-clear-day/)
    await expect(page.locator(".sky-snowfall")).toHaveCount(0)
})

test("clear hours at night use the night sky", async ({ page }) => {
    await mockApis(page, { hourly: hourly(14, { shortForecast: "Clear", isDaytime: false }) })
    await page.goto("#/")
    await expect(page.locator(sky)).toHaveClass(/sky-clear-night/)
})

test("snow falls while it's snowing", async ({ page }) => {
    await mockApis(page)
    await page.goto("#/")
    await expect(page.locator(sky)).toHaveClass(/sky-snow-day/)
    await expect(page.locator(".sky-snowfall")).toHaveCount(1)
})

test("falling snow respects reduced motion", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" })
    await mockApis(page)
    await page.goto("#/")
    await expect(page.locator(".sky-snowfall")).toHaveCSS("animation-name", "none")
})

test("the wind chart draws gusts over the wind line", async ({ page }) => {
    await mockApis(page)
    await page.goto("#/")
    await page.locator("label[for=forecast-wind]").click()

    await expect(page.locator(".chart-overlay")).toHaveCount(1)
    await expect(page.locator(".chart-legend")).toHaveText("gusts")
    await expect(page.locator("label[for=forecast-wind-gust]")).toHaveCount(0)
})

test("night hours are shaded", async ({ page }) => {
    const hours = hourly(14).map((h, i) => ({ ...h, isDaytime: i < 5 }))
    await mockApis(page, { hourly: hours })
    await page.goto("#/")
    await expect(page.locator(".night-bands rect")).toHaveCount(6)
})

test("the snow tab only appears when snow is expected", async ({ page }) => {
    await mockApis(page, { grid: gridFixture([{ hoursFromNow: 1, inches: 3 }]) })
    await page.goto("#/")
    await page.locator("label[for=forecast-snow]").click()

    await expect(page.locator(".chart-title")).toHaveText("HOURLY SNOW")
    await expect(page.locator(".data-point-label", { hasText: "0.5″" }).first()).toBeVisible()
})

test("there's no snow tab without snow", async ({ page }) => {
    await mockApis(page, { grid: gridFixture([]) })
    await page.goto("#/")
    await expect(page.locator(".forecast-chart svg")).toBeVisible()
    await expect(page.locator("label[for=forecast-snow]")).toHaveCount(0)
})

test("forecast labels stay clear of values at the left edge", async ({ page }) => {
    const rows = hourly(14, { shortForecast: "Sunny", probabilityOfPrecipitation: { value: 0 } })
    await mockApis(page, { hourly: rows })
    await page.goto("#/")
    await page.locator("label[for=forecast-precip]").click()
    await expect(page.locator(".chart-title")).toHaveText("HOURLY PRECIPITATION")

    const [label, value] = await page.evaluate(() => [
        document.querySelector("text.forecast-label")!.getBoundingClientRect().left,
        document.querySelector(".data-point-label-bg")!.getBoundingClientRect().right,
    ])
    expect(label).toBeGreaterThan(value)
})
