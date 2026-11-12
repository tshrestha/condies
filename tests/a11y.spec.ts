import { createRequire } from "node:module"

import { expect, type Page, test } from "@playwright/test"

import { dateAt, gridFixture, mockApis, stormAlerts } from "./fixtures.ts"

// Every screen and sheet, in both themes, against axe's WCAG 2.2 A and AA rules and its best practices.
// Contrast is checked too, so a temperature color whose ink stops being readable fails here.

const axePath = createRequire(import.meta.url).resolve("axe-core/axe.min.js")

// The map needs software WebGL in headless browsers.
test.use({
    launchOptions: { args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] },
})

// A level 4 rating over the default Denver location, so the avalanche row and sheet show.
const avalanche = {
    properties: {
        center: "Test Avalanche Center",
        link: "https://example.com/forecast",
        off_season: false,
        danger_level: 4,
        travel_advice: "Very dangerous avalanche conditions.",
        end_date: new Date(Date.now() + 3_600_000).toISOString().slice(0, 19),
        warning: { product: "warning" },
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
}

const snowHours = 26

const spots = [
    { lat: 39.7644, lon: -105.0196, name: "Denver" },
    { lat: 40.5, lon: -105.5, name: "Peak" },
]

async function violations(page: Page) {
    await page.addScriptTag({ path: axePath })
    return page.evaluate(async () => {
        const axe = (window as unknown as { axe: { run: (...args: unknown[]) => Promise<any> } }).axe
        const result = await axe.run(document, {
            runOnly: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"],
            resultTypes: ["violations"],
        })
        return result.violations.map(
            (v: { id: string; nodes: { target: string[] }[] }) =>
                `${v.id}: ${v.nodes
                    .slice(0, 3)
                    .map((n) => n.target.join(" "))
                    .join(", ")}`,
        )
    })
}

const screens: { name: string; path: string; ready: (page: Page) => Promise<void> }[] = [
    {
        name: "Home",
        path: "/",
        ready: (page) => expect(page.getByRole("region", { name: "Daylight" })).toBeVisible(),
    },
    {
        name: "an alert",
        path: "/",
        ready: async (page) => {
            await page.getByRole("button", { name: /Winter Storm Warning/ }).click()
            await expect(page.getByRole("dialog")).toBeVisible()
        },
    },
    {
        name: "avalanche danger",
        path: "/",
        ready: async (page) => {
            await page.getByRole("button", { name: /avalanche danger/ }).click()
            await expect(page.getByRole("dialog", { name: "Avalanche danger" })).toBeVisible()
        },
    },
    {
        name: "search",
        path: "/",
        ready: async (page) => {
            await page.getByRole("button", { name: "Search" }).click()
            await page.getByRole("combobox", { name: "Where to?" }).fill("boul")
            await expect(page.getByRole("option")).toHaveCount(2)
        },
    },
    {
        name: "a day, with its score explained and the snow chart",
        // The day the fixture's snow falls on, whatever the time now.
        path: `/forecast/39.7644,-105.0196/day/${dateAt(snowHours / 24)}`,
        ready: async (page) => {
            await page.getByRole("button", { name: /^Condies score/ }).click()
            await page.getByRole("button", { name: "Snow", exact: true }).click()
        },
    },
    {
        name: "a day with no forecast",
        path: "/forecast/39.7644,-105.0196/day/2020-01-01",
        ready: (page) => expect(page.getByRole("heading", { name: /no forecast for this day/ })).toBeVisible(),
    },
    {
        name: "My Spots",
        path: "/spots",
        ready: (page) => expect(page.getByRole("listitem")).toHaveCount(2),
    },
    {
        name: "the map, with a spot open",
        path: "/map",
        ready: async (page) => {
            await page.getByRole("button", { name: /^Denver, / }).click()
            await expect(page.locator(".maplibregl-popup")).toBeVisible()
        },
    },
]

for (const theme of ["light", "dark"]) {
    for (const { name, path, ready } of screens) {
        test(`${name} has no accessibility violations, ${theme}`, async ({ page }) => {
            await page.addInitScript(
                ([t, s]) => {
                    localStorage.setItem("condiesTheme", JSON.stringify(t))
                    localStorage.setItem("condiesSpots", JSON.stringify(s))
                },
                [theme, spots] as const,
            )
            await mockApis(page, {
                alerts: stormAlerts,
                avalanche: [avalanche],
                grid: gridFixture([{ hoursFromNow: snowHours, inches: 6 }]),
            })
            await page.goto(path)
            await ready(page)
            expect(await violations(page)).toEqual([])
        })
    }
}

test("the wide layout has no accessibility violations", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    await mockApis(page, { alerts: stormAlerts })
    await page.goto("/")
    await expect(page.getByRole("region", { name: "Right now" })).toBeVisible()
    expect(await violations(page)).toEqual([])
})
