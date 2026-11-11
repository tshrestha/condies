import { expect, type Page, test } from "@playwright/test"

import { mockApis } from "./fixtures.ts"

const star = (page: Page) => page.getByRole("button", { name: "Save to My Spots" })

test("a forecast can be starred and unstarred", async ({ page }) => {
    await mockApis(page)
    await page.goto("#/forecast/40.5,-105.5")

    await expect(star(page)).toHaveAttribute("aria-pressed", "false")
    await star(page).click()
    await expect(star(page)).toHaveAttribute("aria-pressed", "true")

    await page.goto("#/spots")
    await expect(page.locator(".spot-row .fw-medium")).toHaveText(["Place 40.5"])

    await page.locator(".spot-row").click()
    await expect(star(page)).toHaveAttribute("aria-pressed", "true")
    await star(page).click()
    await expect(star(page)).toHaveAttribute("aria-pressed", "false")

    await page.goto("#/spots")
    await expect(page.locator(".alert-secondary")).toContainText("Tap the star")
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
    await expect(page.locator(".spot-row .fw-medium")).toHaveText(["Arapahoe Basin"])
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
    await expect(page.locator(".alert-secondary")).toContainText("Tap the star")
})

test("starred places appear on the map", async ({ page }) => {
    await mockApis(page)
    await page.goto("#/forecast/39.76,-105.02")
    await star(page).click()

    await page.goto("#/map")
    await expect(page.locator(".spot-pin")).toHaveAttribute("title", "Place 39.76")
})
