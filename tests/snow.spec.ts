import { expect, type Page, test } from "@playwright/test"

import { dateAt, gridFixture, mockApis, week } from "./fixtures.ts"

const days = (page: Page) => page.getByRole("region", { name: "This week" }).getByRole("link")
const score = (page: Page) => page.getByRole("button", { name: /^Condies score \d+ out of 100, / })

// 06:00 tomorrow in the forecast's time zone, as hours from now.
const tomorrowMorning = () => (Date.parse(`${dateAt(1)}T12:00:00-07:00`) - Date.now()) / 3_600_000

test("rows and the Snow section show real snow totals", async ({ page }) => {
    await mockApis(page, { grid: gridFixture([{ hoursFromNow: tomorrowMorning(), inches: 4.5 }]) })
    await page.goto("#/")

    await expect(days(page).nth(1)).toHaveAccessibleName(/\. 4\.5″ snow\./)
    const snow = page.getByRole("region", { name: "Snow" })
    await expect(snow.getByRole("term")).toHaveText(["Next 7 days"])
    await expect(snow.getByRole("definition")).toHaveText(["4.5″"])
})

test("POW DAY comes from measured snow, not the forecast wording", async ({ page }) => {
    const daily = week()
    daily[2] = {
        ...daily[2],
        windSpeed: { value: 8, unitCode: "wmoUnit:km_h-1" },
        probabilityOfPrecipitation: { value: 90 },
    }
    await mockApis(page, { daily, grid: gridFixture([{ hoursFromNow: tomorrowMorning(), inches: 8 }]) })
    await page.goto("#/")

    await expect(days(page).nth(1)).toHaveAccessibleName(/^Tomorrow, .*\. POW DAY\. /)
})

test("the day page says whether it's snow or rain at this elevation", async ({ page }) => {
    await mockApis(page, {
        grid: gridFixture([{ hoursFromNow: tomorrowMorning(), inches: 3 }], { elevation: 3000, snowLevel: 2400 }),
    })
    await page.goto(`#/forecast/39.1000,-106.1000/day/${dateAt(1)}`)

    const insight = page.locator(".day-insight").last()
    await expect(insight).toContainText("All snow at this elevation")
    await expect(insight).toContainText("3.0″")
    await expect(insight).toContainText("Snow level 7,900 ft, this spot is 9,800 ft")
})

test("a low spot under a high snow level reads as rain", async ({ page }) => {
    await mockApis(page, { grid: gridFixture([], { elevation: 1000, snowLevel: 2500 }) })
    await page.goto(`#/forecast/39.1000,-106.1000/day/${dateAt(1)}`)
    await expect(page.locator(".day-insight").last()).toContainText("Rain at this elevation")
})

test("each day gets a Condies score and best window", async ({ page }) => {
    await mockApis(page, { grid: gridFixture([]) })
    await page.goto("#/")

    // Home scores only the best day. Every day's own screen has its score.
    await expect(score(page)).toBeVisible()
    await days(page).nth(1).click()
    await expect(page.locator(".day-score-ring")).toHaveText(/^\d+$/)
    await expect(page.locator(".day-insight").first()).toContainText("Best window")
})

test("missing grid data leaves the rest of the forecast intact", async ({ page }) => {
    await mockApis(page)
    await page.goto("#/")

    await expect(days(page)).toHaveCount(7)
    await expect(score(page)).toHaveCount(0)
})

const saved = [
    { id: "a", properties: { full_address: "Alta, Utah", coordinates: { latitude: 40.5884, longitude: -111.6386 } } },
    {
        id: "b",
        properties: { full_address: "Vail, Colorado", coordinates: { latitude: 39.6403, longitude: -106.3742 } },
    },
]

test("My Spots ranks saved places and filters by day", async ({ page }) => {
    await page.addInitScript((s) => localStorage.setItem("nawaSavedSelections", JSON.stringify(s)), saved)
    const calm = gridFixture([])
    const windy = gridFixture([])
    windy.windGust = { values: [{ validTime: windy.windGust.values[0].validTime, value: 120 }] }
    await mockApis(page, { grid: (lat) => (lat === 40.5884 ? windy : calm) })
    await page.goto("#/")
    await page.getByRole("link", { name: "Spots" }).click()

    await expect(page).toHaveURL(/#\/spots$/)
    await expect(page.locator(".spot-row")).toHaveCount(2)
    await expect(page.locator(".spot-row .fw-medium")).toHaveText(["Vail", "Alta"])
    await expect(page.locator(".spot-score").first()).toHaveText(/^\d+$/)

    await page.locator(".spots-filter .btn").nth(2).click()
    await expect(page.locator(".spots-filter .btn-primary")).not.toHaveText("This week")
    await page.locator(".spot-row").first().click()
    await expect(page).toHaveURL(/#\/forecast\//)
})

test("My Spots explains itself when nothing is saved", async ({ page }) => {
    await mockApis(page)
    await page.goto("#/spots")
    await expect(page.locator(".alert-secondary")).toContainText("Tap the star")
})
