import { buildForecast, type ForecastView, type SpotView, toAlertView } from "../lib/forecastView.ts"
import { avalancheAt, getAvalancheZones, getSnowDepth } from "../lib/mountain.ts"
import { type Alert, getAlerts, getForecast, getGridForecast, getPoint, type Period } from "../lib/nws.ts"
import { getSunTimes } from "../lib/sun.ts"

export type Screen = { name: "home" } | { name: "day"; date: string } | { name: "spots" }

export interface DesignProps {
    // Only safe to read when status is "ready".
    forecast: ForecastView
    spots: SpotView[]
    searchSamples: string[]
    screen: Screen
    go: (screen: Screen) => void
    // Spread onto an <a> for a real link: <a {...props.link({ name: "spots" })}>
    link: (screen: Screen) => { href: string; onClick: (e: MouseEvent) => void }
    theme: "light" | "dark"
    setTheme: (theme: "light" | "dark") => void
    status: "ready" | "loading" | "error"
    offline: boolean
    // Which overlay to start with open, so that it can be reviewed from a link.
    open?: "search" | "alert"
}

const timeRegex = /(\d+):(\d+)\s(AM|PM)/

// The real National Weather Service forecast, for reviewing the design against today's actual weather.
export async function loadLive(lat: string, lon: string): Promise<ForecastView> {
    const point = await getPoint(lat, lon)
    if (!point) {
        throw new Error(`no NWS data for ${lat},${lon}`)
    }
    const { timeZone, relativeLocation, forecast, forecastHourly, forecastGridData } = point.properties
    const [alertResults, daily, hourlyResult, grid, zones, snowDepth, sun] = await Promise.all([
        getAlerts(lat, lon),
        getForecast(forecast),
        getForecast(forecastHourly),
        getGridForecast(forecastGridData),
        getAvalancheZones(),
        getSnowDepth(lat, lon),
        getSunTimes(lat, lon, timeZone).catch(() => null),
    ])
    const now = Date.now()
    const periods = (daily?.properties.periods ?? []).filter((p: Period) => new Date(p.endTime).getTime() > now)
    const hours = (hourlyResult?.properties.periods ?? [])
        .filter((p: Period) => new Date(p.endTime).getTime() > now)
        .map((p: Period) => {
            const d = new Date(p.startTime)
            const match = d
                .toLocaleTimeString("en-US", { hour12: true, timeStyle: "short", timeZone })
                .match(timeRegex)!
            const start = d.getTime()
            const gust = grid?.gust.get(start)
            return {
                ...p,
                hourString: `${match[1]} ${match[3]}`,
                snowInches: grid?.snowfall.get(start) ?? 0,
                feelsLike: grid?.feelsLike.get(start),
                windGust: p.windGust ?? (gust === undefined ? undefined : { value: Math.round(gust), unitCode: "mph" }),
            }
        })

    return buildForecast({
        place: {
            city: relativeLocation?.properties.city ?? "Somewhere",
            state: relativeLocation?.properties.state ?? "",
            lat,
            lon,
            timeZone,
            elevationFeet: grid ? Math.round(grid.elevation * 3.28084) : undefined,
        },
        now,
        periods,
        hours,
        grid,
        alerts: (alertResults?.features ?? []).map((f: { properties: Alert }) => toAlertView(f.properties)),
        sun: sun ?? undefined,
        avalanche: avalancheAt(zones, lat, lon, now),
        snowDepth: snowDepth ?? undefined,
        updatedAt: daily?.properties.generatedAt ?? new Date(now).toISOString(),
    })
}
