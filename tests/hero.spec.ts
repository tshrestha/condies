import { expect, type Page, test } from "@playwright/test"

import { dateAt, gridFixture, hourly, mockApis } from "./fixtures.ts"

// Hourly charts live on the Day screen. Today's is the one Home's next 12 hours open.
const today = () => `/forecast/39.7644,-105.0196/day/${dateAt(0)}`
// Today's chart is titled by whether its hours run on into tomorrow, which depends on the time of day.
const chart = (page: Page) => page.getByRole("img", { name: /^(Next 12 hours|Hour by hour)\. / })
const views = (page: Page) => page.getByRole("group", { name: "Hourly view" })
// The chart lists its columns, one per hour, then the hours under them.
const columns = (page: Page) => chart(page).getByRole("list").first().getByRole("listitem")

test("Now shows the temperature, the conditions, the feels-like and the wind", async ({ page }) => {
    await mockApis(page, {
        grid: gridFixture([]),
        hourly: hourly(80, { temperature: 30, windSpeed: { value: 16, unitCode: "wmoUnit:km_h-1" } }),
    })
    await page.goto("/")

    const now = page.getByRole("region", { name: "Right now" })
    await expect(now.getByText("30°", { exact: true })).toBeVisible()
    await expect(now.getByText("Snow", { exact: true })).toBeVisible()
    await expect(now.getByText("Feels like 23° · Wind 10 mph NW", { exact: true })).toBeVisible()
})

test("the wind chart draws gusts over the wind line", async ({ page }) => {
    // Columns grow from the baseline. Without motion they're measured where they settle.
    await page.emulateMedia({ reducedMotion: "reduce" })
    await mockApis(page, { hourly: hourly(80, { windGust: { value: 48, unitCode: "wmoUnit:km_h-1" } }) })
    await page.goto(today())
    await views(page).getByRole("button", { name: "Wind", exact: true }).click()

    await expect(chart(page)).toHaveAccessibleName(/\. Wind up to \d+ mph, gusts to 30 mph\.$/)
    // The gusts carry words of their own on the chart, so there's no key and no separate gust toggle.
    await expect(chart(page).getByText(/gusts 30$/)).toBeVisible()
    await expect(views(page).getByRole("button")).toHaveText(["Temp", "Precip", "Wind"])

    // Every hour's gust mark sits above its wind bar. Neither mark is in the accessibility tree, so they're
    // found by class.
    const above = await columns(page).evaluateAll((cols) =>
        cols.map((col) => {
            const bar = col.querySelector(".sq-bar")!.getBoundingClientRect()
            const gust = col.querySelector(".sq-gust")?.getBoundingClientRect()
            return gust !== undefined && gust.height > 0 && gust.bottom <= bar.top + 0.5
        }),
    )
    expect(above.length).toBeGreaterThanOrEqual(12)
    expect(above).not.toContain(false)
})

test("the snow tab only appears when snow is expected", async ({ page }) => {
    await mockApis(page, { grid: gridFixture([{ hoursFromNow: 0, inches: 3 }]) })
    await page.goto(today())
    await views(page).getByRole("button", { name: "Snow", exact: true }).click()

    await expect(views(page).getByRole("button", { name: "Snow", exact: true })).toHaveAttribute("aria-pressed", "true")
    await expect(chart(page)).toHaveAccessibleName(/\. 3\.0″ of snow, heaviest at \d+ [AP]M\.$/)
    await expect(chart(page).getByText("0.5″ an hour", { exact: true })).toBeVisible()
})

test("there's no snow tab without snow", async ({ page }) => {
    await mockApis(page, { grid: gridFixture([]) })
    await page.goto(today())
    await expect(chart(page)).toBeVisible()
    await expect(views(page).getByRole("button")).toHaveText(["Temp", "Precip", "Wind"])
})

test("chart labels stay clear of the bars and of each other", async ({ page }) => {
    // Columns grow from the baseline. Without motion they're measured where they settle.
    await page.emulateMedia({ reducedMotion: "reduce" })
    // The first hour is the coldest, so its label sits at the left edge beside taller bars.
    await mockApis(page, { hourly: hourly(14) })
    await page.goto(today())
    await expect(chart(page).getByText("30°", { exact: true })).toBeVisible()

    for (const view of ["Temp", "Precip", "Wind"]) {
        await views(page).getByRole("button", { name: view, exact: true }).click()
        await expect(views(page).getByRole("button", { pressed: true })).toHaveText([view])
        // Labels, bars and gust marks have no place in the accessibility tree, so they're found by class.
        const crossings = await chart(page).evaluate((chart) => {
            const box = (e: Element) => e.getBoundingClientRect()
            const cross = (a: DOMRect, b: DOMRect) =>
                a.left < b.right - 0.5 && b.left < a.right - 0.5 && a.top < b.bottom - 0.5 && b.top < a.bottom - 0.5
            const edge = box(chart)
            const labels = [...chart.querySelectorAll(".sq-col-label")]
            const marks = [...chart.querySelectorAll(".sq-bar, .sq-gust"), ...labels]
            return labels.flatMap((label) => {
                const own = box(label)
                const hits = marks
                    .filter((mark) => mark !== label && cross(own, box(mark)))
                    .map((mark) => `${label.textContent} over ${mark.textContent || mark.className}`)
                return own.left < edge.left - 0.5 || own.right > edge.right + 0.5
                    ? [...hits, `${label.textContent} past the edge`]
                    : hits
            })
        })
        expect(crossings, view).toEqual([])
    }
})
