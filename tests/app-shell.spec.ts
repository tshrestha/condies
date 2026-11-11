import { expect, type Page, test } from "@playwright/test"

import { mockApis } from "./fixtures.ts"

test.describe("theme", () => {
    test("follows a dark system setting when nothing is saved", async ({ page }) => {
        await page.emulateMedia({ colorScheme: "dark" })
        await mockApis(page)
        await page.goto("#/")

        await expect(page.locator("html")).toHaveAttribute("data-theme", "dark")
        await expect(page.getByRole("button", { name: "Dark mode" })).toHaveAttribute("aria-pressed", "true")
    })

    test("a saved choice beats the system setting", async ({ page }) => {
        await page.emulateMedia({ colorScheme: "dark" })
        await page.addInitScript(() => localStorage.setItem("condiesTheme", '"light"'))
        await mockApis(page)
        await page.goto("#/")

        await expect(page.locator("html")).toHaveAttribute("data-theme", "light")
    })

    test("changes with the system until the user chooses", async ({ page }) => {
        await mockApis(page)
        await page.goto("#/")
        await expect(page.locator("html")).toHaveAttribute("data-theme", "light")

        await page.emulateMedia({ colorScheme: "dark" })
        await expect(page.locator("html")).toHaveAttribute("data-theme", "dark")
        await expect(page.locator("body")).toHaveClass(/dark-bg/)

        // Choosing light while the system is dark.
        await page.getByRole("button", { name: "Dark mode" }).click()
        await page.emulateMedia({ colorScheme: "light" })
        await page.emulateMedia({ colorScheme: "dark" })
        await expect(page.locator("html")).toHaveAttribute("data-theme", "light")
    })

    test("is applied before any app code runs", async ({ page }) => {
        await page.emulateMedia({ colorScheme: "dark" })
        await page.route("**/assets/*.js", (route) => route.abort())
        await page.goto("#/")

        await expect(page.locator("html")).toHaveAttribute("data-theme", "dark")
        await expect(page.locator("body")).toHaveClass(/dark-bg/)
    })
})

test("the app can be installed", async ({ page, request }) => {
    await page.goto("#/")
    const href = await page.locator('link[rel="manifest"]').getAttribute("href")
    expect(href).toBe("/condies/manifest.webmanifest")

    const manifest = await (await request.get(href!)).json()
    expect(manifest.display).toBe("standalone")
    expect(manifest.start_url).toBe("/condies/")

    for (const icon of manifest.icons) {
        const response = await request.get(`/condies/${icon.src}`)
        expect(response.ok(), icon.src).toBe(true)
        expect(response.headers()["content-type"]).toContain("image/png")
    }
})

test.describe("offline", () => {
    test.use({ serviceWorkers: "allow" })

    test("shows the last forecast with no signal", async ({ page, context }) => {
        let offline = false
        await mockApis(page, {
            override: (url, route) => {
                if (offline && url.hostname !== "localhost") {
                    void route.abort("internetdisconnected")
                    return true
                }
            },
        })
        await page.goto("#/")
        await expect(page.locator(".current-conditions h1.display-6")).toHaveText("Place 39.7644")

        // The first visit installs the worker, so this load is the one it can save for later.
        await page.evaluate(() => navigator.serviceWorker.ready)
        await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true)
        await page.reload()
        await expect(page.locator(".current-conditions h1.display-6")).toHaveText("Place 39.7644")
        await page.waitForTimeout(300)

        offline = true
        await context.setOffline(true)
        await page.reload()

        await expect(page.locator(".current-conditions h1.display-6")).toHaveText("Place 39.7644")
        await expect(page.getByText(/You.re offline/)).toBeVisible()
    })

    const heading = (page: Page) => page.locator(".current-conditions h1.display-6")

    // Loads twice so the worker has saved the forecast, as it would have for a returning visitor.
    async function loadUntilSaved(page: Page, city: string) {
        await page.goto("#/")
        await expect(heading(page)).toHaveText(city)
        await page.evaluate(() => navigator.serviceWorker.ready)
        await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true)
        await page.reload()
        await expect(heading(page)).toHaveText(city)
        await page.waitForTimeout(300)
    }

    test("shows the last place when the user has moved and there's no signal", async ({ page, context }) => {
        let offline = false
        await mockApis(page, {
            location: { latitude: 40.1234, longitude: -105.5678 },
            override: (url, route) => {
                if (offline && url.hostname !== "localhost") {
                    void route.abort("internetdisconnected")
                    return true
                }
            },
        })
        await loadUntilSaved(page, "Place 40.1234")

        offline = true
        await context.setOffline(true)
        await page.evaluate(() => sessionStorage.setItem("mockLocation", '{"latitude":41.5,"longitude":-106.5}'))
        await page.reload()

        await expect(page.locator(".alert-warning")).toContainText("the last place you loaded")
        await expect(heading(page)).toHaveText("Place 40.1234")
        expect(await page.evaluate(() => localStorage.getItem("condiesLastLocation"))).toContain("40.1234")
    })

    test("stops waiting for a weak signal and shows the saved forecast", async ({ page }) => {
        let hanging = false
        await mockApis(page, {
            override: (url) => {
                // Never answering is what a request does on one bar of signal.
                return hanging && url.hostname === "api.weather.gov"
            },
        })
        await loadUntilSaved(page, "Place 39.7644")

        hanging = true
        await page.reload()

        await expect(heading(page)).toHaveText("Place 39.7644", { timeout: 15_000 })
        await expect(page.locator(".daily-row").first()).toBeVisible()
    })
})
