import { expect, type Locator, type Page, test } from "@playwright/test"

import { dateAt, mockApis } from "./fixtures.ts"

test.describe("theme", () => {
    test("follows a dark system setting when nothing is saved", async ({ page }) => {
        await page.emulateMedia({ colorScheme: "dark" })
        await mockApis(page)
        await page.goto("/")

        await expect(page.locator("html")).toHaveAttribute("data-theme", "dark")
        await expect(page.getByRole("button", { name: "Dark mode" })).toHaveAttribute("aria-pressed", "true")
    })

    test("a saved choice beats the system setting", async ({ page }) => {
        await page.emulateMedia({ colorScheme: "dark" })
        await page.addInitScript(() => localStorage.setItem("condiesTheme", '"light"'))
        await mockApis(page)
        await page.goto("/")

        await expect(page.locator("html")).toHaveAttribute("data-theme", "light")
    })

    test("changes with the system until the user chooses", async ({ page }) => {
        await mockApis(page)
        await page.goto("/")
        await expect(page.locator("html")).toHaveAttribute("data-theme", "light")

        await page.emulateMedia({ colorScheme: "dark" })
        await expect(page.locator("html")).toHaveAttribute("data-theme", "dark")
        await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute("content", "#0d0d0d")

        // Choosing light while the system is dark.
        await page.getByRole("button", { name: "Dark mode" }).click()
        await page.emulateMedia({ colorScheme: "light" })
        await page.emulateMedia({ colorScheme: "dark" })
        await expect(page.locator("html")).toHaveAttribute("data-theme", "light")
    })

    test("is applied before any app code runs", async ({ page }) => {
        await page.emulateMedia({ colorScheme: "dark" })
        await page.route("**/assets/*.js", (route) => route.abort())
        await page.goto("/")

        await expect(page.locator("html")).toHaveAttribute("data-theme", "dark")
        // The browser's bars and the page behind everything are already the dark ground.
        await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute("content", "#0d0d0d")
        await expect(page.locator("html")).toHaveCSS("background-color", "rgb(13, 13, 13)")
    })
})

// An iPhone with a Dynamic Island: iOS draws the status bar over the top 59px and blurs what's under it, and keeps
// the bottom 34px for the home indicator.
const statusBar = 59
const homeIndicator = 34

async function emulateIPhoneInsets(page: Page) {
    const cdp = await page.context().newCDPSession(page)
    await cdp.send(
        "Emulation.setSafeAreaInsetsOverride" as never,
        {
            insets: { top: statusBar, bottom: homeIndicator, left: 0, right: 0 },
        } as never,
    )
}

const top = async (locator: Locator) => (await locator.boundingBox())!.y

test.describe("on an iPhone", () => {
    test("Home and the Day screen start below it", async ({ page }) => {
        await mockApis(page)
        await emulateIPhoneInsets(page)
        await page.goto("/")
        expect(await top(page.getByRole("region", { name: "Right now" }))).toBeGreaterThanOrEqual(statusBar + 8)

        await page.getByRole("region", { name: "This week" }).getByRole("link").nth(1).click()
        expect(await top(page.getByRole("navigation", { name: "Other days" }))).toBeGreaterThanOrEqual(statusBar + 8)
    })

    test("a sheet's bar starts below it", async ({ page }) => {
        await mockApis(page)
        await emulateIPhoneInsets(page)
        await page.goto("/")
        await page.getByRole("button", { name: "Search" }).click()
        expect(await top(page.getByRole("button", { name: "Close" }))).toBeGreaterThanOrEqual(statusBar)
    })

    test("the dock sits just above the home indicator, and the page ends above the dock", async ({ page }) => {
        await mockApis(page)
        await emulateIPhoneInsets(page)
        await page.goto("/")
        const dock = (await page.locator(".sq-dock").boundingBox())!
        const viewport = page.viewportSize()!
        expect(viewport.height - (dock.y + dock.height)).toBe(homeIndicator - 12)

        await page.mouse.wheel(0, 10_000)
        const daylight = page.getByRole("region", { name: "Daylight" })
        await expect(daylight).toBeVisible()
        await expect
            .poll(async () => (await daylight.boundingBox())!.y + (await daylight.boundingBox())!.height)
            .toBeLessThanOrEqual(dock.y)
    })

    test("the map runs under the status bar, with its own controls below it", async ({ page }) => {
        await mockApis(page)
        await emulateIPhoneInsets(page)
        await page.goto("/map")
        await expect(page.locator(".maplibregl-canvas")).toBeVisible()
        expect(await top(page.locator("#map"))).toBe(0)
        expect(await top(page.getByRole("button", { name: "Radar" }))).toBeGreaterThanOrEqual(statusBar)
    })
})

// The tab for the screen you're on is the one link marked as the current page: not the other tabs, and not the
// links on the page. The router marks every link to the location, so the nav marks its own (see ariaCurrent in nav.tsx).
test.describe("the current page", () => {
    const marked = (page: Page) => page.locator('a[aria-current="page"]:visible')
    const settled = (page: Page) =>
        expect(page.getByRole("region", { name: "This week" }).getByRole("link").first()).toBeVisible()

    test("is marked in the dock and nowhere else", async ({ page }) => {
        await mockApis(page)
        await page.goto("/")
        await settled(page)
        await expect(marked(page)).toHaveText(["Now"])

        await page.getByRole("link", { name: "Spots", exact: true }).click()
        await expect(marked(page)).toHaveText(["Spots"])

        await page.getByRole("link", { name: "Open the map" }).click()
        await expect(marked(page)).toHaveText(["Map"])

        await page.getByRole("link", { name: "Now", exact: true }).click()
        await settled(page)
        await expect(marked(page)).toHaveText(["Now"])
    })

    test("is marked in the top bar on a wide screen and nowhere else", async ({ page }) => {
        await page.setViewportSize({ width: 1200, height: 900 })
        await mockApis(page)
        await page.goto("/")
        await settled(page)
        await expect(marked(page)).toHaveCount(0)

        await page.getByRole("link", { name: "Spots", exact: true }).click()
        await expect(marked(page)).toHaveText(["Spots"])

        await page.getByRole("link", { name: "Open the map" }).click()
        await expect(marked(page)).toHaveText(["Map"])

        await page.getByRole("link", { name: "Condies" }).click()
        await settled(page)
        await expect(marked(page)).toHaveCount(0)
    })
})

test("the app can be installed", async ({ page, request }) => {
    await page.goto("/")
    const href = await page.locator('link[rel="manifest"]').getAttribute("href")
    expect(href).toBe("/manifest.webmanifest")

    const manifest = await (await request.get(href!)).json()
    expect(manifest.display).toBe("standalone")
    expect(manifest.start_url).toBe("/")

    for (const icon of manifest.icons) {
        const response = await request.get(`/${icon.src}`)
        expect(response.ok(), icon.src).toBe(true)
        expect(response.headers()["content-type"]).toContain("image/png")
    }
})

test.describe("a link from when pages lived in the URL's hash", () => {
    test("opens the page it names", async ({ page }) => {
        await mockApis(page)
        await page.goto(`/#/forecast/39.1000,-106.1000/day/${dateAt(1)}?from=home`)

        await expect(page).toHaveURL(`/forecast/39.1000,-106.1000/day/${dateAt(1)}?from=home`)
        await expect(page.getByRole("heading", { level: 1, name: "Tomorrow", exact: true })).toBeVisible()
        // The query came along too: opened from Home, the day goes back to Home.
        await expect(page.getByRole("link", { name: "Place 39.1", exact: true })).toHaveAttribute("href", "/")
    })

    test("isn't followed off the site", async ({ page }) => {
        await mockApis(page)
        await page.goto("/#//example.com/forecast/1,1")

        await expect(page.getByRole("heading", { level: 1, name: /^Right meow in / })).toBeVisible()
        expect(new URL(page.url()).origin).toBe("http://localhost:4173")
    })
})

test.describe("offline", () => {
    test.use({ serviceWorkers: "allow" })

    const heading = (page: Page) => page.getByRole("heading", { level: 1, name: /^Right meow in / })

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
        await page.goto("/")
        await expect(heading(page)).toHaveText("Right meow in Place 39.7644, CO")

        // The first visit installs the worker, so this load is the one it can save for later.
        await page.evaluate(() => navigator.serviceWorker.ready)
        await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true)
        await page.reload()
        await expect(heading(page)).toHaveText("Right meow in Place 39.7644, CO")
        await page.waitForTimeout(300)

        offline = true
        await context.setOffline(true)
        await page.reload()

        await expect(heading(page)).toHaveText("Right meow in Place 39.7644, CO")
        await expect(page.getByText(/You.re offline/)).toBeVisible()
    })

    // Loads twice so the worker has saved the forecast, as it would have for a returning visitor.
    async function loadUntilSaved(page: Page, city: string) {
        await page.goto("/")
        await expect(heading(page)).toHaveText(`Right meow in ${city}, CO`)
        await page.evaluate(() => navigator.serviceWorker.ready)
        await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true)
        await page.reload()
        await expect(heading(page)).toHaveText(`Right meow in ${city}, CO`)
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

        await expect(page.getByRole("status").filter({ hasText: "the last place you loaded" })).toBeVisible()
        await expect(heading(page)).toHaveText("Right meow in Place 40.1234, CO")
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

        await expect(heading(page)).toHaveText("Right meow in Place 39.7644, CO", { timeout: 15_000 })
        await expect(page.getByRole("region", { name: "This week" }).getByRole("link").first()).toBeVisible()
    })

    test("opens a page it has never shown with no signal", async ({ page, context }) => {
        await mockApis(page)
        await loadUntilSaved(page, "Place 39.7644")

        await context.setOffline(true)
        await page.goto("/spots")

        await expect(page.getByRole("heading", { name: "My Spots" })).toBeVisible()
        await expect(page.getByText(/You.re offline/)).toBeVisible()
    })
})
