import { expect, type Page, test } from "@playwright/test"

import { dateAt, gridFixture, hourly, mockApis, period, timeAt, week } from "./fixtures.ts"

const days = (page: Page) => page.getByRole("region", { name: "This week" }).getByRole("link")
// Each day's row reads as a sentence: the day and date (its link), low, high, then the conditions.
const rows = (page: Page) => page.getByRole("region", { name: "This week" }).getByRole("listitem")
const here = { latitude: 40.1234, longitude: -105.5678 }
// How Home writes a date, as in "Nov 10".
const short = (date: string) =>
    new Date(`${date}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })
// How the Day screen names a day after Tomorrow, as in "Thursday".
const weekday = (date: string) =>
    new Date(`${date}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" })
// How Home's week names a day after today: three letters on screen and the whole name for screen readers, so a
// row's text starts "SatSaturday, Nov 14".
const abbreviated = (date: string) =>
    new Date(`${date}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" })
const rowStart = (date: string) => `${abbreviated(date)}${weekday(date)}, ${short(date)}`
// Noon tomorrow in the forecast's time zone, as hours from now.
const tomorrowNoon = () => (Date.parse(`${dateAt(1)}T12:00:00-07:00`) - Date.now()) / 3_600_000

// The Day screen.
const dayHeading = (page: Page, name: string) => page.getByRole("heading", { level: 1, name, exact: true })
const pager = (page: Page) => page.getByRole("navigation", { name: "Other days" })
const details = (page: Page) => page.getByRole("region", { name: "Details" })
const chart = (page: Page) => page.getByRole("img", { name: /^(Next 12 hours|Hour by hour)\. / })
// The chart lists its columns, one per hour, then the hours under them.
const columns = (page: Page) => chart(page).getByRole("list").first().getByRole("listitem")
const axis = (page: Page) => chart(page).getByRole("list").last().getByRole("listitem")

test("groups the forecast into one row per day", async ({ page }) => {
    await mockApis(page)
    await page.goto("/")

    await expect(days(page)).toHaveCount(7)
    // The day's high and the night's low, in one row.
    await expect(rows(page).first()).toHaveText(`Today, ${short(dateAt(0))}, low 20°, high 40°. Sunny`)
    // The condition is a picture on screen. Its word is only for screen readers.
    await expect(rows(page).first().locator("svg.sq-wx")).toBeVisible()
    await expect(rows(page).first().getByText("Sunny")).toHaveClass("sq-sr")

    // The rain chance and wind range across both periods are on that day's own screen.
    await days(page).first().click()
    await expect(details(page).getByText("60% chance of rain", { exact: true })).toBeVisible()
    await expect(details(page).getByText("3–15 mph wind", { exact: true })).toBeVisible()
})

test("an evening load starts with Tonight and has no high", async ({ page }) => {
    await mockApis(page, { daily: week().slice(1) })
    await page.goto("/")

    await expect(rows(page).first()).toHaveText(`Tonight, ${short(dateAt(0))}, low 20°. Clear`)
})

test("a chance of snow shows its picture with the chance, and a forecast with no picture keeps its words", async ({
    page,
}) => {
    const daily = week()
    daily[0] = { ...daily[0], shortForecast: "Chance Snow Showers", probabilityOfPrecipitation: { value: 40 } }
    daily[2] = { ...daily[2], shortForecast: "Frost" }
    await mockApis(page, { daily })
    await page.goto("/")

    await expect(rows(page).first()).toHaveText(/\. Chance of snow, 40%$/)
    await expect(rows(page).first().locator("svg.sq-wx")).toBeVisible()
    await expect(rows(page).first().getByText("40%")).toBeVisible()
    await expect(rows(page).nth(1).getByText("Frost")).toBeVisible()
    await expect(rows(page).nth(1).locator("svg.sq-wx")).toHaveCount(0)
})

test("a day after today shows three letters of its name, and its link says the whole name", async ({ page }) => {
    await mockApis(page)
    await page.goto("/")

    await expect(
        days(page)
            .nth(1)
            .getByText(abbreviated(dateAt(1)), { exact: true }),
    ).toBeVisible()
    await expect(days(page).nth(1)).toHaveAccessibleName(`${weekday(dateAt(1))}, ${short(dateAt(1))}`)
    // The picture is on the name's line, between the name and the low.
    const box = async (selector: string) => (await rows(page).nth(1).locator(selector).boundingBox())!
    const [name, picture, low] = [await box(".sq-day-name"), await box("svg.sq-wx"), await box(".sq-day-low")]
    expect(picture.x).toBeGreaterThan(name.x + name.width)
    expect(picture.x + picture.width).toBeLessThan(low.x)
    expect(Math.abs(picture.y + picture.height / 2 - (name.y + name.height / 2))).toBeLessThan(6)
})

for (const width of [320, 390, 1280]) {
    test(`the week's rows are evenly spaced, each on one line with nothing cut off, ${width}px wide`, async ({
        page,
    }) => {
        await page.setViewportSize({ width, height: 800 })
        // The widest a row gets: "Tonight", a low below zero and a high over 100. Tonight has no high, and
        // tomorrow has a note under it, its chance of rain; neither may change a row's height.
        const daily = week()
            .slice(1)
            .map((p, i) => ({ ...p, temperature: i % 2 ? 104 + i : -22 + i }))
        daily[1] = { ...daily[1], shortForecast: "Chance Rain Showers", probabilityOfPrecipitation: { value: 40 } }
        await mockApis(page, { daily })
        await page.goto("/")
        await expect(days(page)).toHaveCount(7)
        await expect(rows(page).nth(1).getByText("40%")).toBeVisible()
        await page.evaluate(() => document.fonts.ready)

        const problems = await page.evaluate(() => {
            const found: string[] = []
            if (document.documentElement.scrollWidth > innerWidth) {
                found.push("the page scrolls sideways")
            }
            const week = document.querySelector(".sq-week")!
            const pad = parseFloat(getComputedStyle(week).paddingLeft)
            const { left, right } = week.getBoundingClientRect()
            const heights = [...week.querySelectorAll(".sq-day")].map((row) => row.getBoundingClientRect().height)
            if (heights.some((height) => Math.abs(height - heights[0]) > 0.5)) {
                found.push(`the rows differ in height: ${heights.join(", ")}`)
            }
            for (const row of week.querySelectorAll(".sq-day")) {
                const parts = [".sq-day-name", ".sq-day-wx", ".sq-day-low", ".sq-range", ".sq-day-high"].map((c) => {
                    const el = row.querySelector(c)!
                    return { c, el, box: el.getBoundingClientRect() }
                })
                parts.forEach(({ c, el, box }, i) => {
                    const before = parts[i - 1]?.box
                    if (before?.width && box.width && box.left < before.right) {
                        found.push(`${c} overlaps the part before it`)
                    }
                    if (box.left < left + pad - 0.5 || box.right > right - pad + 0.5) {
                        found.push(`${c} is outside the margins`)
                    }
                    // The name, the low and the high are text, each on one line of its own height.
                    const isText = c !== ".sq-day-wx" && c !== ".sq-range"
                    const line = parseFloat(getComputedStyle(el).lineHeight)
                    if (isText && (box.height > line * 1.5 || el.scrollWidth > el.clientWidth + 1)) {
                        found.push(`${c} wraps or is cut off`)
                    }
                })
                if (parts[3].box.width < 40) {
                    found.push("the range bar has no room")
                }
            }
            return found
        })
        expect(problems).toEqual([])
    })
}

test("a period that already ended is dropped", async ({ page }) => {
    const daily = week()
    daily[0] = { ...daily[0], endTime: timeAt(-2) }
    daily[1] = { ...daily[1], endTime: timeAt(-1) }
    await mockApis(page, { daily })
    await page.goto("/")

    await expect(days(page)).toHaveCount(6)
    await expect(rows(page).first()).toContainText("high 43°")
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
    await page.goto("/")

    await expect(rows(page).nth(1)).toHaveText(new RegExp(`^${rowStart(dateAt(1))}, .*\\. Sunny, POW DAY, 12″$`))
    // The morning after the storm, fresh snow under clear calm skies scores 100.
    await expect(rows(page).nth(2)).toHaveText(/^\w+, .*\. Sunny, PRIMO/)
    await expect(rows(page).nth(3)).not.toHaveText(/PRIMO|POW DAY/)
})

test("a row opens that day with its detail and hours", async ({ page }) => {
    await mockApis(page, { location: here })
    await page.goto("/")
    await days(page).nth(1).click()

    await expect(page).toHaveURL(new RegExp(`/day/${dateAt(1)}\\?from=home`))
    await expect(dayHeading(page, "Tomorrow")).toBeVisible()
    await expect(page.getByText("Low 22°", { exact: true })).toBeVisible()
    await expect(page.getByText("High 43°", { exact: true })).toBeVisible()
    await expect(page.getByRole("region", { name: "Forecast text" }).getByRole("paragraph")).toHaveText([
        "Day1 detail text.",
        "Day1 Night detail text.",
    ])
    // A day after today shows all of its hours.
    await expect(page.getByRole("region", { name: "Hour by hour" })).toBeVisible()
    await expect(columns(page)).toHaveCount(24)
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0)
})

test("today's chart starts at the current hour", async ({ page }) => {
    const hours = hourly()
    await mockApis(page, { hourly: hours })
    await page.goto(`/forecast/39.1000,-106.1000/day/${dateAt(0)}`)

    const now = new Date(hours[0].startTime)
        .toLocaleTimeString("en-US", { hour: "numeric", timeZone: "America/Denver" })
        .replace(/\s/, " ")
    await expect(axis(page).first()).toHaveText(now)
    // Late in the day it runs on into tomorrow, so there are always at least 12 hours.
    expect(await columns(page).count()).toBeGreaterThanOrEqual(12)
})

test("previous and next links move between days", async ({ page }) => {
    await mockApis(page)
    await page.goto(`/forecast/39.1000,-106.1000/day/${dateAt(1)}`)
    await expect(page.getByText("High 43°", { exact: true })).toBeVisible()

    await pager(page)
        .getByRole("link", { name: `Next day, ${weekday(dateAt(2))}` })
        .click()
    await expect(page).toHaveURL(new RegExp(`/day/${dateAt(2)}$`))
    await expect(dayHeading(page, weekday(dateAt(2)))).toBeVisible()
    await expect(page.getByText("High 46°", { exact: true })).toBeVisible()

    await pager(page).getByRole("link", { name: "Previous day, Tomorrow" }).click()
    await expect(page).toHaveURL(new RegExp(`/day/${dateAt(1)}$`))
    await expect(page.getByText("High 43°", { exact: true })).toBeVisible()
})

test("back returns to Home when opened from Home", async ({ page }) => {
    await mockApis(page)
    await page.goto("/")

    // Any day goes back by its place's name.
    await days(page).nth(1).click()
    await expect(dayHeading(page, "Tomorrow")).toBeVisible()
    await page.getByRole("link", { name: "Place 39.7644", exact: true }).click()
    await expect(page).toHaveURL("/")

    // The first day also goes back by Now.
    await days(page).first().click()
    await expect(dayHeading(page, "Today")).toBeVisible()
    await pager(page).getByRole("link", { name: "Now 30°", exact: true }).click()
    await expect(page).toHaveURL("/")
})

test("back returns to the forecast page from a deep link", async ({ page }) => {
    await mockApis(page)
    await page.goto(`/forecast/39.1000,-106.1000/day/${dateAt(1)}`)
    await expect(dayHeading(page, "Tomorrow")).toBeVisible()
    await page.getByRole("link", { name: "Place 39.1", exact: true }).click()
    await expect(page).toHaveURL(/\/forecast\/39\.1000,-106\.1000$/)

    await page.goto(`/forecast/39.1000,-106.1000/day/${dateAt(0)}`)
    await expect(dayHeading(page, "Today")).toBeVisible()
    await pager(page).getByRole("link", { name: "Now 30°", exact: true }).click()
    await expect(page).toHaveURL(/\/forecast\/39\.1000,-106\.1000$/)
})

test("an unknown date offers a way back", async ({ page }) => {
    await mockApis(page)
    await page.goto("/forecast/39.1000,-106.1000/day/2020-01-01")

    const missing = page.getByRole("status").filter({ hasText: "There’s no forecast for this day." })
    await expect(missing).toBeVisible()
    await missing.getByRole("link", { name: "Back to the forecast" }).click()
    await expect(page).toHaveURL(/\/forecast\/39\.1000,-106\.1000$/)
})

test("a deep link applies the saved theme", async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem("condiesTheme", '"dark"'))
    await mockApis(page)
    await page.goto(`/forecast/39.1000,-106.1000/day/${dateAt(1)}`)
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark")
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
        await page.goto("/")
        await expect(days(page)).toHaveCount(7)
        await expect(page.getByRole("region", { name: "Daylight" })).toBeVisible()

        const pageOverflow = () => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
        // Text on the screen that runs past its own box, leaving out text kept for screen readers. A chart's
        // hours spill over the empty hours beside them on purpose, so they're checked on their own.
        const clipped = () =>
            page.getByRole("main").evaluate((main) =>
                [...main.querySelectorAll("*")]
                    .filter((e) => !e.closest("[role=img]"))
                    .filter((e) =>
                        [...e.childNodes].some((n) => n.nodeType === Node.TEXT_NODE && n.textContent!.trim()),
                    )
                    .filter((e) => e.clientWidth > 1 && e.scrollWidth > e.clientWidth + 1)
                    .map((e) => e.textContent),
            )
        expect(await pageOverflow()).toBe(0)
        expect(await clipped()).toEqual([])

        await days(page).nth(1).click()
        await expect(dayHeading(page, "Tomorrow")).toBeVisible()
        await expect(chart(page)).toBeVisible()
        expect(await pageOverflow()).toBe(0)
        expect(await clipped()).toEqual([])

        // The hours under the chart stay inside it and clear of each other.
        const edge = (await chart(page).boundingBox())!
        const hours = await axis(page).evaluateAll((items) =>
            items
                .filter((li) => li.textContent)
                .map((li) => {
                    const text = document.createRange()
                    text.selectNodeContents(li)
                    const { left, right } = text.getBoundingClientRect()
                    return { left, right }
                }),
        )
        expect(hours.length).toBeGreaterThan(1)
        expect(hours[0].left).toBeGreaterThanOrEqual(edge.x - 1)
        expect(hours.at(-1)!.right).toBeLessThanOrEqual(edge.x + edge.width + 1)
        for (let i = 1; i < hours.length; i++) {
            expect(hours[i].left).toBeGreaterThan(hours[i - 1].right)
        }
    })
}

test("an overnight period doesn't replace the day's own low", async ({ page }) => {
    const daily = week().slice(2)
    daily.unshift(period("Overnight", dateAt(1), false, 11, { startTime: `${dateAt(1)}T01:00:00-07:00` }))
    await mockApis(page, { daily })
    await page.goto("/")

    await expect(rows(page).first()).toContainText("low 22°")
})
