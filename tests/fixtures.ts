import type { Page, Route } from "@playwright/test"

const OFFSET = 7 * 3_600_000

export const dateAt = (days: number) => new Date(Date.now() - OFFSET + days * 86_400_000).toISOString().slice(0, 10)
export const timeAt = (hours: number) =>
    `${new Date(Date.now() - OFFSET + hours * 3_600_000).toISOString().slice(0, 19)}-07:00`

interface WindSpeed {
    value?: number
    minValue?: number
    maxValue?: number
    unitCode: string
}

export function period(name: string, date: string, isDaytime: boolean, temperature: number, extra: object = {}) {
    return {
        number: 1,
        name,
        startTime: `${date}${isDaytime ? "T06:00:00" : "T18:00:00"}-07:00`,
        endTime: timeAt(240),
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
        startTime: timeAt(i),
        endTime: timeAt(i + 1),
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
    override?: (url: URL, route: Route) => boolean | void | Promise<boolean | void>
}

const cors = { "access-control-allow-origin": "*", "access-control-allow-headers": "*" }

// Serves every external API from fixtures and returns the list of requests made.
export async function mockApis(page: Page, options: MockOptions = {}) {
    const requests: string[] = []
    const location = options.location ?? "denied"

    await page.addInitScript((loc) => {
        const geolocation = {
            getCurrentPosition(ok: (p: unknown) => void, fail: (e: unknown) => void) {
                setTimeout(() => (loc === "denied" ? fail({ code: 1, message: "denied" }) : ok({ coords: loc })), 20)
            },
        }
        Object.defineProperty(navigator, "geolocation", { value: geolocation })
    }, location)

    await page.route("**/*", async (route) => {
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

        if (url.pathname.includes("/geocoding/forward")) {
            const q = url.searchParams.get("q")
            return json({
                features: [
                    {
                        id: "a",
                        properties: { full_address: `${q} one`, coordinates: { latitude: 40.015, longitude: -105.27 } },
                    },
                    {
                        id: "b",
                        properties: { full_address: `${q} two`, coordinates: { latitude: 35.97, longitude: -114.83 } },
                    },
                ],
            })
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
                        forecast: "https://api.weather.gov/g/forecast",
                        forecastHourly: "https://api.weather.gov/g/forecast/hourly",
                    },
                })
            }
            if (url.pathname.endsWith("/forecast/hourly")) {
                return json({ properties: { periods: options.hourly ?? hourly() } })
            }
            if (url.pathname.endsWith("/forecast")) {
                return json({ properties: { periods: options.daily ?? week() } })
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
        if (url.hostname === "tiles.openfreemap.org") {
            return json({ version: 8, sources: {}, layers: [] })
        }
        return route.abort()
    })

    return requests
}

export const pointRequests = (requests: string[]) =>
    requests.filter((u) => u.includes("/points/")).map((u) => u.split("/points/")[1])
