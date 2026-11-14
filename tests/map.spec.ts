import { expect, type Page, test } from "@playwright/test"

import { gridFixture, mockApis, radarTimes, scanTimes } from "./fixtures.ts"

// Headless browsers need software rendering for WebGL.
test.use({
    launchOptions: { args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] },
})

test("place names in the popup are plain text", async ({ page }) => {
    await mockApis(page, {
        override: (url, route) => {
            if (url.hostname === "nominatim.openstreetmap.org") {
                void route.fulfill({
                    status: 200,
                    contentType: "application/json",
                    headers: { "access-control-allow-origin": "*" },
                    body: JSON.stringify({ display_name: '<img src=x onerror="window.__xss=1">Evil Place' }),
                })
                return true
            }
        },
    })
    await page.goto("/map")

    const canvas = page.locator("#map .maplibregl-canvas")
    await expect(canvas).toBeVisible()
    await page.waitForTimeout(800)
    await canvas.click({ position: { x: 200, y: 300 } })

    const popup = page.locator(".maplibregl-popup-content")
    await expect(popup.locator("a")).toContainText("Evil Place")
    await expect(popup.locator("img")).toHaveCount(0)
    expect(await page.evaluate(() => "__xss" in window)).toBe(false)
})

// "1:48 PM", as the tape writes a scan's time. The tests run on Denver time.
const clock = (time: string) =>
    new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/Denver" })
        .format(Date.parse(time))
        .replace(/\s+/g, " ")

const capabilityRequests = (requests: string[]) => requests.filter((u) => u.includes("REQUEST=GetCapabilities"))
const tileRequests = (requests: string[]) => requests.filter((u) => u.includes("REQUEST=GetMap"))

// Two hours of scans, the latest 2 minutes ago. The loop is the 31 from the last hour: times[29] to times[59].
const twoHours = () => scanTimes(60, 2)
const lastHour = (times: string[]) => times.slice(29)

// Checks for new scans this often, instead of every 2 minutes.
const refreshEvery = (page: Page, ms: number) =>
    page.addInitScript(
        (every) => ((globalThis as { condiesRadarRefreshMs?: number }).condiesRadarRefreshMs = every),
        ms,
    )

// Keeps every value the tape has shown since the call, so a test can tell the loop went through every frame.
const watchTape = (page: Page) =>
    page.evaluate(() => {
        const w = window as unknown as { seen: Set<string>; tapeWatch?: MutationObserver }
        w.seen = new Set()
        w.tapeWatch?.disconnect()
        const slider = document.querySelector('[role="slider"]')!
        w.tapeWatch = new MutationObserver(() => w.seen.add(slider.getAttribute("aria-valuenow")!))
        w.tapeWatch.observe(slider, { attributes: true, attributeFilter: ["aria-valuenow"] })
    })
const seenOnTape = (page: Page) => page.evaluate(() => (window as unknown as { seen: Set<string> }).seen.size)

const setHidden = (page: Page, hidden: boolean) =>
    page.evaluate((h) => {
        Object.defineProperty(document, "hidden", { configurable: true, get: () => h })
        Object.defineProperty(document, "visibilityState", {
            configurable: true,
            get: () => (h ? "hidden" : "visible"),
        })
        document.dispatchEvent(new Event("visibilitychange"))
    }, hidden)

async function openMap(page: Page, options: Parameters<typeof mockApis>[1] = {}) {
    const requests = await mockApis(page, options)
    await page.goto("/map")
    await expect(page.locator("#map .maplibregl-canvas")).toBeVisible()
    return requests
}

test("the map opens on the latest radar scan, still, and asks for nothing older", async ({ page }) => {
    const times = twoHours()
    const requests = await openMap(page, { scans: () => times })

    const tape = page.getByRole("slider", { name: "Radar time" })
    await expect(tape).toHaveAttribute("aria-valuemax", "30")
    await expect(tape).toHaveAttribute("aria-valuenow", "30")
    await expect(tape).toHaveAttribute("aria-valuetext", `${clock(times[59])}, latest`)
    await expect(page.locator(".sq-tape-time")).toHaveText(`${clock(times[59])}, latest`)
    await expect(page.getByRole("button", { name: "Play" })).toBeEnabled()
    await expect(page.getByRole("button", { name: "Radar" })).toHaveAttribute("aria-pressed", "true")

    await page.waitForTimeout(1000)
    expect(radarTimes(requests)).toEqual([times[59]])
})

test("zooming in on a town asks for no more radar", async ({ page }) => {
    const requests = await openMap(page)
    await expect.poll(() => tileRequests(requests).length).toBeGreaterThan(0)
    await page.waitForTimeout(1000)
    const before = tileRequests(requests).length

    for (let i = 0; i < 3; i++) {
        await page.getByRole("button", { name: "Zoom in" }).click()
        await page.waitForTimeout(400)
    }
    await page.waitForTimeout(800)
    expect(tileRequests(requests).length).toBe(before)
})

test("a newer scan replaces the latest while paused on it", async ({ page }) => {
    await refreshEvery(page, 500)
    const times = scanTimes(61, 2)
    let checks = 0
    // The first check is a scan behind; later ones bring the newest.
    const requests = await openMap(page, { scans: () => (checks++ ? times.slice(1) : times.slice(0, 60)) })

    await expect.poll(() => radarTimes(requests)).toContain(times[60])
    await expect(page.locator(".sq-tape-time")).toHaveText(`${clock(times[60])}, latest`)
    await expect(page.getByRole("slider", { name: "Radar time" })).toHaveAttribute("aria-valuenow", "30")
})

test("a hidden page stops checking and playing, and catches up when it's back", async ({ page }) => {
    await refreshEvery(page, 2000)
    const requests = await openMap(page, { scans: twoHours })
    await page.getByRole("button", { name: "Play" }).click()
    await expect(page.getByRole("button", { name: "Pause" })).toBeVisible()

    await setHidden(page, true)
    const checks = capabilityRequests(requests).length
    await page.waitForTimeout(2500)
    expect(capabilityRequests(requests).length).toBe(checks)

    // Back, it checks at once rather than at the next 2 seconds, and keeps playing.
    await setHidden(page, false)
    await expect.poll(() => capabilityRequests(requests).length, { timeout: 1000 }).toBe(checks + 1)
    await expect(page.getByRole("button", { name: "Pause" })).toBeVisible()
})

test("without NOAA's list of scans, the latest radar still shows and the loop waits", async ({ page }) => {
    await refreshEvery(page, 500)
    const requests = await openMap(page, { scans: "fail" })

    await expect.poll(() => radarTimes(requests)).toEqual([""])
    await expect(page.getByRole("button", { name: "Play" })).toBeDisabled()
    await expect(page.locator(".sq-tape-time")).toHaveText("Latest scan")
    // And it tries again.
    await expect.poll(() => capabilityRequests(requests).length).toBeGreaterThan(1)
})

test("play loads the last hour, then loops through every frame of it", async ({ page }) => {
    const times = twoHours()
    const requests = await openMap(page, { scans: () => times })
    await expect(page.getByRole("button", { name: "Play" })).toBeEnabled()
    await watchTape(page)
    await page.getByRole("button", { name: "Play" }).click()

    await expect.poll(() => radarTimes(requests).sort()).toEqual(lastHour(times).sort())
    await expect.poll(() => seenOnTape(page), { timeout: 15_000 }).toBe(31)
    expect(radarTimes(requests).every((t) => lastHour(times).includes(t))).toBe(true)
})

test("panning holds the latest scan, then the loop picks up again", async ({ page }) => {
    await openMap(page, { scans: twoHours })
    const tape = page.getByRole("slider", { name: "Radar time" })
    await page.getByRole("button", { name: "Play" }).click()
    await expect.poll(async () => tape.getAttribute("aria-valuenow"), { timeout: 10_000 }).not.toBe("30")

    const canvas = page.locator("#map .maplibregl-canvas")
    const box = (await canvas.boundingBox())!
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    await page.mouse.down()
    await page.mouse.move(box.x + box.width / 2 - 150, box.y + box.height / 2 - 100, { steps: 8 })
    await expect(tape).toHaveAttribute("aria-valuenow", "30")
    await watchTape(page)
    await page.mouse.up()

    await expect.poll(() => seenOnTape(page), { timeout: 15_000 }).toBeGreaterThan(20)
    await expect(page.getByRole("button", { name: "Pause" })).toBeVisible()
})

test("the keyboard steps through the hour, pausing on each frame", async ({ page }) => {
    const times = twoHours()
    await openMap(page, { scans: () => times })
    const tape = page.getByRole("slider", { name: "Radar time" })
    await expect(page.getByRole("button", { name: "Play" })).toBeEnabled()

    await tape.focus()
    await page.keyboard.press("ArrowLeft")
    await expect(tape).toHaveAttribute("aria-valuenow", "29")
    await expect(page.locator(".sq-tape-time")).toHaveText(new RegExp(`^${clock(times[58])}, [3-5] min ago$`))
    await expect(tape).toHaveAttribute("aria-valuetext", new RegExp(`^${clock(times[58])}, [3-5] minutes ago$`))
    await expect(page.getByRole("button", { name: "Play" })).toBeVisible()

    // Quick presses add up, even while frames are loading.
    await page.keyboard.press("ArrowLeft")
    await page.keyboard.press("ArrowLeft")
    await page.keyboard.press("ArrowLeft")
    await expect(tape).toHaveAttribute("aria-valuenow", "26")

    await page.keyboard.press("Home")
    await expect(tape).toHaveAttribute("aria-valuenow", "0")
    await expect(page.locator(".sq-tape-time")).toHaveText(new RegExp(`^${clock(times[29])}, (1 hr|6[0-2] min) ago$`))
    await page.keyboard.press("End")
    await expect(tape).toHaveAttribute("aria-valuenow", "30")
    await expect(page.locator(".sq-tape-time")).toHaveText(`${clock(times[59])}, latest`)
})

test("dragging along the tape pauses the loop on the frame under the finger", async ({ page }) => {
    await openMap(page, { scans: twoHours })
    const tape = page.getByRole("slider", { name: "Radar time" })
    await page.getByRole("button", { name: "Play" }).click()
    await expect(page.getByRole("button", { name: "Pause" })).toBeVisible()

    const box = (await page.locator(".sq-tape-segments").boundingBox())!
    await page.mouse.move(box.x + box.width - 2, box.y + box.height / 2)
    await page.mouse.down()
    await page.mouse.move(box.x + 2, box.y + box.height / 2, { steps: 10 })
    await page.mouse.up()

    await expect(page.getByRole("button", { name: "Play" })).toBeVisible()
    await expect(tape).toHaveAttribute("aria-valuenow", "0")
})

test("radar turned off asks for nothing, and comes back paused on the latest", async ({ page }) => {
    const requests = await openMap(page, { scans: twoHours })
    const toggle = page.getByRole("button", { name: "Radar" })
    await page.getByRole("button", { name: "Play" }).click()
    await expect(page.getByRole("button", { name: "Pause" })).toBeVisible()

    await toggle.click()
    await expect(toggle).toHaveAttribute("aria-pressed", "false")
    await expect(page.getByRole("slider", { name: "Radar time" })).toHaveCount(0)
    await page.waitForTimeout(500)
    const before = requests.filter((u) => u.includes("conus_bref_qcd")).length
    await page.getByRole("button", { name: "Zoom out" }).click()
    await page.getByRole("button", { name: "Zoom out" }).click()
    await page.waitForTimeout(1500)
    expect(requests.filter((u) => u.includes("conus_bref_qcd")).length).toBe(before)

    await toggle.click()
    await expect(toggle).toHaveAttribute("aria-pressed", "true")
    await expect(page.getByRole("slider", { name: "Radar time" })).toHaveAttribute("aria-valuenow", "30")
    await expect(page.getByRole("button", { name: "Play" })).toBeVisible()
})

test("saved spots appear as pins that open their forecast", async ({ page }) => {
    await page.addInitScript(() =>
        localStorage.setItem(
            "nawaSavedSelections",
            JSON.stringify([
                {
                    id: "a",
                    properties: { full_address: "Here, CO", coordinates: { latitude: 39.76, longitude: -105.02 } },
                },
            ]),
        ),
    )
    await mockApis(page, { grid: gridFixture([]) })
    await page.goto("/map")

    // The pin prints the spot's temperature and opens its row, which links to its forecast.
    const pin = page.getByRole("button", { name: /^Here, (high|low) \d+°$/ })
    await expect(pin).toHaveText(/^\d+°$/)
    await pin.click()
    const popup = page.locator(".maplibregl-popup-content")
    await expect(popup.getByRole("button", { name: /^Condies score \d+\/100 \w+$/ })).toBeVisible()
    await popup.getByRole("link", { name: /^Here/ }).click()
    await expect(page).toHaveURL(/\/forecast\/39\.76,-105\.02$/)
})

test("the base map follows the theme, and radar comes back after it changes", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    await mockApis(page)
    const light = page.waitForRequest(/openfreemap\.org\/styles\/positron/)
    const firstRadar = page.waitForRequest(/conus_bref_qcd/)
    await page.goto("/map")
    await light
    await firstRadar

    const dark = page.waitForRequest(/openfreemap\.org\/styles\/dark/)
    const radarAgain = page.waitForRequest(/REQUEST=GetMap/)
    await page.getByRole("button", { name: "Dark mode" }).click()
    await dark
    await radarAgain
    await expect(page.getByRole("button", { name: "Radar" })).toHaveAttribute("aria-pressed", "true")
})

test("the loop keeps playing when the theme changes", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    await openMap(page, { scans: twoHours })
    await page.getByRole("button", { name: "Play" }).click()
    await expect(page.getByRole("button", { name: "Pause" })).toBeVisible()

    await page.getByRole("button", { name: "Dark mode" }).click()
    await watchTape(page)
    await expect(page.getByRole("button", { name: "Pause" })).toBeVisible()
    await expect.poll(() => seenOnTape(page), { timeout: 15_000 }).toBeGreaterThan(20)
})
