import { query } from "@solidjs/router"
import type { Feature } from "geojson"
import { createMemo } from "solid-js"

import { buildForecast, type ForecastView, toAlertView } from "./lib/forecastView.ts"
import { avalancheAt, getAvalancheZones, getSnowDepth } from "./lib/mountain.ts"
import { type Alert, getAlerts, getForecast, getGridForecast, getPoint, type Point } from "./lib/nws.ts"
import { getSunTimes } from "./lib/sun.ts"

// One place's forecast for the screens: loaded once per place and shared through the router's query cache.

const timeRegex = /(\d+):(\d+)\s(AM|PM)/

export const getForecastData = query(async (lat, lon) => {
    const point: Point = await getPoint(lat, lon)
    if (!point) {
        throw new Error(`no NWS data for ${lat},${lon}`)
    }

    const [alertResults, forecast, hourlyForecastResult, grid] = await Promise.all([
        getAlerts(lat, lon),
        getForecast(point.properties.forecast),
        getForecast(point.properties.forecastHourly),
        getGridForecast(point.properties.forecastGridData),
    ])

    // NWS responses are cached for a while, so the first period can already be over.
    const now = Date.now()
    if (forecast) {
        forecast.properties.periods = forecast.properties.periods.filter((p) => new Date(p.endTime).getTime() > now)
    }

    let alerts!: Alert[]
    if (alertResults && alertResults.features && alertResults.features.length) {
        alerts = alertResults.features.map((f: Feature) => f.properties)
    }

    const allHourlyPeriods = (hourlyForecastResult?.properties.periods ?? [])
        .filter((p) => new Date(p.endTime).getTime() > now)
        .map((p) => {
            const d = new Date(p.startTime)
            const timeString = d.toLocaleTimeString("en-US", {
                hour12: true,
                timeStyle: "short",
                timeZone: point.properties.timeZone,
            })
            const match = timeString.match(timeRegex)
            const hourString = `${match![1]} ${match![3]}`
            const start = d.getTime()
            const gridGust = grid?.gust.get(start)

            return {
                ...p,
                hourString,
                snowInches: grid?.snowfall.get(start) ?? 0,
                feelsLike: grid?.feelsLike.get(start),
                // The grid has gusts for far more hours than the hourly forecast does.
                windGust:
                    p.windGust
                    ?? (gridGust === undefined ? undefined : { value: Math.round(gridGust), unitCode: "mph" }),
            }
        })

    // Also catches a forecast saved for offline use that has since run out.
    if (!forecast?.properties.periods.length && !allHourlyPeriods.length) {
        throw new Error(`no current forecast for ${lat},${lon}`)
    }

    const hourlyForecast = { periods: allHourlyPeriods.slice(0, 11) }
    const updatedAt = forecast?.properties.generatedAt ?? hourlyForecastResult?.properties.generatedAt
    return { point, forecast, hourlyForecast, allHourlyPeriods, alerts, grid, updatedAt }
}, "forecast")

// These are extras: each loads on its own after the forecast, and a failure only leaves its section off. The
// avalanche zones are fetched once and shared by every place.
const avalancheZones = query(getAvalancheZones, "avalancheZones")
const snowDepth = query(getSnowDepth, "snowDepth")
const sunTimes = query(getSunTimes, "sunriseset")

// The forecast view for one place, as Home and the Day screen show it. It's built from what the forecast
// already returned. Avalanche danger, snow depth and sun times are read lazily, so a section only waits on the
// one it shows, and a failure leaves it undefined.
export function createForecastView(lat: string, lon: string) {
    const data = createMemo(() => getForecastData(lat, lon))
    const avalanche = createMemo(() =>
        avalancheZones().then(
            (zones) => avalancheAt(zones, lat, lon, Date.now()),
            () => undefined,
        ),
    )
    const depth = createMemo(() =>
        snowDepth(lat, lon).then(
            (d) => d ?? undefined,
            () => undefined,
        ),
    )
    const sun = createMemo(() => {
        const { timeZone } = data().point.properties
        return sunTimes(lat, lon, timeZone).then(
            (s) => s ?? undefined,
            () => undefined,
        )
    })

    const view = createMemo((): ForecastView => {
        const { point, forecast, allHourlyPeriods, alerts, grid, updatedAt } = data()
        const { relativeLocation, timeZone } = point.properties
        const now = Date.now()
        const built = buildForecast({
            place: {
                city: relativeLocation?.properties.city ?? "",
                state: relativeLocation?.properties.state ?? "",
                lat,
                lon,
                timeZone,
                elevationFeet: grid ? Math.round(grid.elevation * 3.28084) : undefined,
            },
            now,
            periods: forecast?.properties.periods ?? [],
            hours: allHourlyPeriods,
            grid: grid ?? null,
            alerts: (alerts ?? []).map(toAlertView),
            updatedAt: updatedAt ?? "",
        })
        return Object.defineProperties(built, {
            avalanche: { get: avalanche, enumerable: true },
            snowDepth: { get: depth, enumerable: true },
            sun: { get: sun, enumerable: true },
        })
    })

    return view
}
