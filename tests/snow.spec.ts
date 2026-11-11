import { expect, type Page, test } from "@playwright/test"

import { dateAt, gridFixture, mockApis, week } from "./fixtures.ts"

const days = (page: Page) => page.getByRole("region", { name: "This week" }).getByRole("link")
// Each day's row reads as a sentence: the day and date (its link), low, high, then the conditions.
const rows = (page: Page) => page.getByRole("region", { name: "This week" }).getByRole("listitem")
const score = (page: Page) => page.getByRole("button", { name: /^Condies score \d+\/100 \w+$/ })
const details = (page: Page) => page.getByRole("region", { name: "Details" })
const snowLine = (page: Page) => page.getByRole("region", { name: "Rain and snow line" })

// 06:00 tomorrow in the forecast's time zone, as hours from now.
const tomorrowMorning = () => (Date.parse(`${dateAt(1)}T12:00:00-07:00`) - Date.now()) / 3_600_000

test("rows and the Snow section show real snow totals", async ({ page }) => {
    await mockApis(page, { grid: gridFixture([{ hoursFromNow: tomorrowMorning(), inches: 4.5 }]) })
    await page.goto("#/")

    await expect(rows(page).nth(1)).toContainText("4.5″ snow")
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

    await expect(rows(page).nth(1)).toHaveText(/^Tomorrow, .*\. POW DAY/)
})

test("the day page says whether it's snow or rain at this elevation", async ({ page }) => {
    await mockApis(page, {
        grid: gridFixture([{ hoursFromNow: tomorrowMorning(), inches: 3 }], { elevation: 3000, snowLevel: 2400 }),
    })
    await page.goto(`#/forecast/39.1000,-106.1000/day/${dateAt(1)}`)

    const line = snowLine(page)
    await expect(line.getByText("All snow at this elevation", { exact: true })).toBeVisible()
    await expect(line.getByText("Snow level 7,900 ft, this spot is 9,800 ft", { exact: true })).toBeVisible()
    await expect(details(page).getByText("3.0″ of snow", { exact: true })).toBeVisible()
})

test("a low spot under a high snow level reads as rain", async ({ page }) => {
    await mockApis(page, { grid: gridFixture([], { elevation: 1000, snowLevel: 2500 }) })
    await page.goto(`#/forecast/39.1000,-106.1000/day/${dateAt(1)}`)

    await expect(snowLine(page).getByText("Rain at this elevation", { exact: true })).toBeVisible()
    await expect(details(page).getByText(/^\d+% chance of rain$/)).toBeVisible()
})

test("each day gets a Condies score and best window", async ({ page }) => {
    await mockApis(page, { grid: gridFixture([]) })
    await page.goto("#/")

    // Home scores only the best day. Every day's own screen has its score.
    await expect(score(page)).toBeVisible()
    await days(page).nth(1).click()
    const condies = page.getByRole("region", { name: "Condies score" })
    await expect(condies.getByRole("button", { name: /^Condies score \d+\/100 \w+$/ })).toBeVisible()
    await expect(condies.getByText("Best window", { exact: true })).toBeVisible()
    await expect(condies.getByText(/^\d+ [AP]M–\d+ [AP]M$/)).toBeVisible()
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
    const rows = page.getByRole("listitem")
    await expect(rows).toHaveCount(2)
    await expect(rows.getByRole("link")).toHaveText([/^Vail/, /^Alta/])
    await expect(rows.first().getByRole("button", { name: /^Condies score \d+\/100 \w+$/ })).toBeVisible()

    const days = page.getByRole("group", { name: "Which day" }).getByRole("button")
    await expect(days.first()).toHaveText("This week")
    await expect(days.first()).toHaveAttribute("aria-pressed", "true")
    await days.nth(2).click()
    await expect(days.nth(2)).toHaveAttribute("aria-pressed", "true")
    await expect(days.first()).toHaveAttribute("aria-pressed", "false")
    await rows.first().getByRole("link").click()
    await expect(page).toHaveURL(/#\/forecast\//)
})

test("My Spots explains itself when nothing is saved", async ({ page }) => {
    await mockApis(page)
    await page.goto("#/spots")
    await expect(page.getByRole("heading", { name: "My Spots" })).toBeVisible()
    await expect(page.getByText("Tap the star on any forecast to add it here.")).toBeVisible()
})
