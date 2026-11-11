import { expect, type Page, test } from "@playwright/test"

import { mockApis } from "./fixtures.ts"

const star = (page: Page) => page.getByRole("button", { name: /^Save .+ to My Spots$/ })
const spotLinks = (page: Page) => page.getByRole("listitem").getByRole("link")
const empty = (page: Page) => page.getByText("Tap the star on any forecast to add it here.")

test("a forecast can be starred and unstarred", async ({ page }) => {
    await mockApis(page)
    await page.goto("#/forecast/40.5,-105.5")

    await expect(star(page)).toHaveAttribute("aria-pressed", "false")
    await star(page).click()
    await expect(star(page)).toHaveAttribute("aria-pressed", "true")

    await page.goto("#/spots")
    await expect(spotLinks(page)).toHaveText([/^Place 40\.5/])

    await spotLinks(page).click()
    await expect(star(page)).toHaveAttribute("aria-pressed", "true")
    await star(page).click()
    await expect(star(page)).toHaveAttribute("aria-pressed", "false")

    await page.goto("#/spots")
    await expect(empty(page)).toBeVisible()
})

test("a star survives a reload", async ({ page }) => {
    await mockApis(page)
    await page.goto("#/forecast/40.5,-105.5")
    await star(page).click()

    await page.reload()
    await expect(star(page)).toHaveAttribute("aria-pressed", "true")
})

test("a starred place keeps the name it was searched by", async ({ page }) => {
    await page.addInitScript(() =>
        localStorage.setItem(
            "nawaSavedSelections",
            JSON.stringify([
                {
                    id: "a",
                    properties: {
                        full_address: "Arapahoe Basin, Colorado",
                        coordinates: { latitude: 39.6425, longitude: -105.8719 },
                    },
                },
            ]),
        ),
    )
    await page.addInitScript(() => localStorage.setItem("condiesSpots", "[]"))
    await mockApis(page)
    await page.goto("#/forecast/39.6425,-105.8719")
    await star(page).click()

    await page.goto("#/spots")
    await expect(spotLinks(page)).toHaveText([/^Arapahoe Basin/])
})

test("searching for a place doesn't add it once spots are in use", async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem("condiesSpots", "[]"))
    await mockApis(page)
    await page.goto("#/")

    await page.getByRole("button", { name: "Search" }).click()
    await page.getByRole("combobox", { name: "Where to?" }).fill("Boulder")
    await page.getByRole("option").first().click()
    await expect(page).toHaveURL(/#\/forecast\//)

    await page.goto("#/spots")
    await expect(empty(page)).toBeVisible()
})

test("a spot whose forecast fails keeps its row and says so", async ({ page }) => {
    await page.addInitScript(() =>
        localStorage.setItem(
            "condiesSpots",
            JSON.stringify([
                { lat: 39.76, lon: -105.02, name: "Denver" },
                { lat: 25.5, lon: -80.5, name: "Nowhere" },
            ]),
        ),
    )
    await mockApis(page, {
        override: async (url, route) => {
            if (url.pathname.startsWith("/points/25.5")) {
                await route.fulfill({ status: 404, body: "" })
                return true
            }
        },
    })
    await page.goto("#/spots")

    await expect(spotLinks(page)).toHaveText([/^Denver/, /^Nowhere/])
    await expect(page.getByRole("listitem").last()).toContainText("Couldn’t load its forecast")
})

test("starred places appear on the map", async ({ page }) => {
    await mockApis(page)
    await page.goto("#/forecast/39.76,-105.02")
    await star(page).click()

    await page.goto("#/map")
    await expect(page.locator(".spot-pin")).toHaveAttribute("title", "Place 39.76")
})
