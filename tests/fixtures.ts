import type { Page, Request as PageRequest, Route } from "@playwright/test"

const OFFSET = 7 * 3_600_000

// Search calls the forwardGeocode server function, a POST to /_server/…. A call with one string argument sends the
// string as its body, and the app reads a reply marked with format 8 as JSON. Returns null for any other request.
export const searchQuery = (request: PageRequest) =>
    request.method() === "POST" && new URL(request.url()).pathname.startsWith("/_server/") ? request.postData() : null

export const searchReply = (features: object[]) => ({
    status: 200,
    contentType: "application/json",
    headers: { "x-server-function-format": "8" },
    body: JSON.stringify({ features }),
})

// Changes the page's URL without loading the page, as going back or forward does.
export const changeURL = (page: Page, path: string) =>
    page.evaluate((to) => {
        history.pushState(null, "", to)
        dispatchEvent(new PopStateEvent("popstate"))
    }, path)

export const dateAt = (days: number) => new Date(Date.now() - OFFSET + days * 86_400_000).toISOString().slice(0, 10)
export const timeAt = (hours: number) =>
    `${new Date(Date.now() - OFFSET + hours * 3_600_000).toISOString().slice(0, 19)}-07:00`

interface WindSpeed {
    value?: number
    minValue?: number
    maxValue?: number
    unitCode: string
}

// Keeps today's periods in the future, so they aren't dropped as already over.
function periodEnd(date: string, isDaytime: boolean) {
    const end = isDaytime ? `${date}T18:00:00-07:00` : `${nextDate(date)}T06:00:00-07:00`
    return Date.parse(end) < Date.now() + 3_600_000 ? timeAt(2) : end
}

const nextDate = (date: string) => new Date(Date.parse(`${date}T12:00:00Z`) + 86_400_000).toISOString().slice(0, 10)

// NWS hourly periods always start on the hour.
function hourAt(hours: number) {
    const time = new Date(Date.now() - OFFSET + hours * 3_600_000)
    time.setUTCMinutes(0, 0, 0)
    return `${time.toISOString().slice(0, 19)}-07:00`
}

export function period(name: string, date: string, isDaytime: boolean, temperature: number, extra: object = {}) {
    return {
        number: 1,
        name,
        startTime: `${date}${isDaytime ? "T06:00:00" : "T18:00:00"}-07:00`,
        endTime: periodEnd(date, isDaytime),
        isDaytime,
        temperature,
        shortForecast: isDaytime ? "Mostly Sunny" : "Mostly Clear",
        detailedForecast: `${name} detail text.`,
        windSpeed: { minValue: 8, maxValue: 24, unitCode: "wmoUnit:km_h-1" } as WindSpeed,
        windDirection: "W",
        probabilityOfPrecipitation: { value: 10 },
        ...extra,
    }
}

export function week() {
    return Array.from({ length: 7 }, (_, d) => [
        period(d ? `Day${d}` : "This Afternoon", dateAt(d), true, 40 + d * 3, {
            probabilityOfPrecipitation: { value: 20 + d * 5 },
        }),
        period(d ? `Day${d} Night` : "Tonight", dateAt(d), false, 20 + d * 2, {
            windSpeed: { value: 5, unitCode: "wmoUnit:km_h-1" },
            probabilityOfPrecipitation: { value: 60 },
        }),
    ]).flat()
}

export function hourly(count = 80, extra: object = {}) {
    return Array.from({ length: count }, (_, i) => ({
        number: i + 1,
        name: "",
        startTime: hourAt(i),
        endTime: hourAt(i + 1),
        isDaytime: true,
        temperature: 30 + (i % 20),
        shortForecast: "Snow",
        detailedForecast: "",
        windSpeed: { value: 16 + i, unitCode: "wmoUnit:km_h-1" },
        windGust: i % 2 ? { value: 40 + i, unitCode: "wmoUnit:km_h-1" } : undefined,
        windDirection: "NW",
        probabilityOfPrecipitation: { value: 10 + (i % 80) },
        ...extra,
    }))
}

export const stormAlerts = [
    {
        properties: {
            severity: "Severe",
            event: "Winter Storm Warning",
            headline: "Storm headline",
            description: "* WHAT...Heavy snow * WHERE...Front Range",
        },
    },
    {
        properties: {
            severity: "Minor",
            event: "Frost Advisory",
            headline: "Frost headline",
            description: "* WHAT...Frost expected",
        },
    },
]

interface MockOptions {
    daily?: object[]
    hourly?: object[]
    alerts?: object[]
    location?: "denied" | { latitude: number; longitude: number }
    grid?: object | ((lat: number) => object)
    avalanche?: object[]
    snowDepth?: object[]
    generatedAt?: string
    override?: (url: URL, route: Route) => boolean | void | Promise<boolean | void>
}

const cors = { "access-control-allow-origin": "*", "access-control-allow-headers": "*" }

// Serves every external API from fixtures and returns the list of requests made.
export async function mockApis(page: Page, options: MockOptions = {}) {
    const requests: string[] = []
    const location = options.location ?? "denied"

    await page.addInitScript((initial) => {
        const geolocation = {
            getCurrentPosition(ok: (p: unknown) => void, fail: (e: unknown) => void) {
                // Tests can move the user between page loads by setting this.
                const moved = sessionStorage.getItem("mockLocation")
                const loc = moved ? JSON.parse(moved) : initial
                setTimeout(() => (loc === "denied" ? fail({ code: 1, message: "denied" }) : ok({ coords: loc })), 20)
            },
        }
        Object.defineProperty(navigator, "geolocation", { value: geolocation })
    }, location)

    await page.context().route("**/*", async (route) => {
        const request = route.request()
        const url = new URL(request.url())
        const json = (body: unknown) =>
            route.fulfill({ status: 200, contentType: "application/json", headers: cors, body: JSON.stringify(body) })

        if (request.method() === "OPTIONS") {
            return route.fulfill({ status: 204, headers: { ...cors, "access-control-allow-methods": "*" } })
        }
        requests.push(url.href)
        if (await options.override?.(url, route)) {
            return
        }

        const q = searchQuery(request)
        if (q !== null) {
            return route.fulfill(
                searchReply([
                    {
                        id: "a",
                        properties: { full_address: `${q} one`, coordinates: { latitude: 40.015, longitude: -105.27 } },
                    },
                    {
                        id: "b",
                        properties: { full_address: `${q} two`, coordinates: { latitude: 35.97, longitude: -114.83 } },
                    },
                ]),
            )
        }
        if (url.hostname === "localhost") {
            return route.continue()
        }
        if (url.hostname === "api.weather.gov") {
            if (url.pathname.startsWith("/points/")) {
                const [lat, lon] = url.pathname.split("/")[2].split(",").map(Number)
                return json({
                    geometry: { coordinates: [lon, lat] },
                    properties: {
                        timeZone: "America/Denver",
                        relativeLocation: { properties: { city: `Place ${lat}`, state: "CO" } },
                        forecastGridData: options.grid ? `https://api.weather.gov/g/grid?lat=${lat}` : undefined,
                        forecast: "https://api.weather.gov/g/forecast",
                        forecastHourly: "https://api.weather.gov/g/forecast/hourly",
                    },
                })
            }
            if (url.pathname.endsWith("/g/grid")) {
                const { grid } = options
                return json({
                    properties: typeof grid === "function" ? grid(Number(url.searchParams.get("lat"))) : grid,
                })
            }
            const { generatedAt } = options
            if (url.pathname.endsWith("/forecast/hourly")) {
                return json({ properties: { generatedAt, periods: options.hourly ?? hourly() } })
            }
            if (url.pathname.endsWith("/forecast")) {
                return json({ properties: { generatedAt, periods: options.daily ?? week() } })
            }
            return json({ features: options.alerts ?? [] })
        }
        if (url.hostname === "aa.usno.navy.mil") {
            return json({
                properties: {
                    data: {
                        sundata: [
                            { phen: "Rise", time: "06:45" },
                            { phen: "Set", time: "16:55" },
                        ],
                    },
                },
            })
        }
        if (url.hostname === "api.avalanche.org" && options.avalanche) {
            return json({ features: options.avalanche })
        }
        if (url.hostname === "wcc.sc.egov.usda.gov" && options.snowDepth) {
            return json(options.snowDepth)
        }
        if (url.hostname === "opengeo.ncep.noaa.gov") {
            return route.fulfill({
                status: 200,
                contentType: "image/png",
                headers: cors,
                body: Buffer.from(
                    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
                    "base64",
                ),
            })
        }
        if (url.hostname === "tiles.openfreemap.org") {
            return json({ version: 8, sources: {}, layers: [] })
        }
        return route.abort()
    })

    return requests
}

export const pointRequests = (requests: string[]) =>
    requests.filter((u) => u.includes("/points/")).map((u) => u.split("/points/")[1])

const series = (values: { validTime: string; value: number }[]) => ({ values })

// A grid forecast with snow falling at given hours from now (inches), over 6-hour blocks.
export function gridFixture(
    snow: { hoursFromNow: number; inches: number }[],
    { elevation = 3000, snowLevel = 2000 }: { elevation?: number; snowLevel?: number } = {},
) {
    const hourStart = (hours: number) => {
        const start = new Date(Date.now() + hours * 3_600_000)
        start.setUTCMinutes(0, 0, 0)
        return start.toISOString().replace(".000Z", "+00:00")
    }
    const span = (value: number) => series([{ validTime: `${hourStart(-48)}/P20D`, value }])
    return {
        elevation: { value: elevation },
        snowfallAmount: series(
            snow.map(({ hoursFromNow, inches }) => ({
                validTime: `${hourStart(hoursFromNow)}/PT6H`,
                value: inches * 25.4,
            })),
        ),
        quantitativePrecipitation: span(1),
        snowLevel: span(snowLevel),
        windChill: span(-5),
        apparentTemperature: span(-5),
        windGust: span(16),
        skyCover: span(20),
    }
}
