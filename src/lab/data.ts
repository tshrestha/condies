import type { AvalancheStatus } from "../lib/avalanche.ts"
import { findZone, readZone } from "../lib/avalanche.ts"
import { bestDay, type DaySummary, groupIntoDays } from "../lib/daily.ts"
import type { Grid } from "../lib/grid.ts"
import { type Alert, getAlerts, getForecast, getGridForecast, getPoint, type Period } from "../lib/nws.ts"
import { getSky, type Sky } from "../lib/sky.ts"
import { nearestStations, readDepth, type StationRow } from "../lib/snotel.ts"
import { describeStorm, findNextStorm, type Storm } from "../lib/storm.ts"

export interface LabAlert {
    severity: Alert["severity"]
    event: string
    headline: string
    // The description split at its "* WHAT...", "* WHERE..." markers. Label is empty for loose text.
    parts: { label: string; text: string }[]
    instruction?: string
}

export interface LabSnowDepth {
    depth: number
    change: number
    measuredAt: number
    station: { name: string; miles: number; elevation: number }
}

export interface LabForecast {
    place: { city: string; state: string; lat: string; lon: string; timeZone: string; elevationFeet?: number }
    // The moment the forecast is rendered for. Use this rather than Date.now(), since scenarios simulate a time.
    now: number
    current: Period
    next?: Period
    sky: Sky
    powDay: boolean
    // Every remaining hour, up to about 156 of them. hours[0] is the current hour.
    hours: Period[]
    days: DaySummary[]
    weekSnow: number
    storm?: Storm & { text: string }
    best?: { day: DaySummary; index: number }
    alerts: LabAlert[]
    sun?: { sunrise: string; sunset: string; sunriseHour: number; sunsetHour: number }
    avalanche?: AvalancheStatus
    snowDepth?: LabSnowDepth
    updatedAt: string
    grid: Grid | null
}

export interface LabSpot {
    name: string
    lat: number
    lon: number
    days: DaySummary[]
}

export type Screen = { name: "home" } | { name: "day"; date: string } | { name: "spots" }

export interface DesignProps {
    // Only safe to read when status is "ready".
    forecast: LabForecast
    spots: LabSpot[]
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

const precipLabels = /^(WHAT|WHERE|WHEN|IMPACTS|ADDITIONAL DETAILS)\.\.\./

export function toLabAlert(alert: Pick<Alert, "severity" | "event" | "headline" | "description" | "instruction">) {
    const parts = alert.description
        .split("*")
        .map((part) => part.replace(/\s+/g, " ").trim())
        .filter(Boolean)
        .map((part) => {
            const match = part.match(precipLabels)
            return match ? { label: match[1], text: part.replace(precipLabels, "").trim() } : { label: "", text: part }
        })
    return {
        severity: alert.severity,
        event: alert.event,
        headline: alert.headline,
        parts,
        instruction: alert.instruction,
    } satisfies LabAlert
}

// A week of bad days has no day worth pointing out.
const worthGoingScore = 60

export function buildForecast(source: {
    place: LabForecast["place"]
    now: number
    periods: Period[]
    hours: Period[]
    grid: Grid | null
    alerts: LabAlert[]
    sun?: LabForecast["sun"]
    avalanche?: AvalancheStatus
    snowDepth?: LabSnowDepth
    updatedAt: string
}): LabForecast {
    const { hours, periods, grid, place, now } = source
    const days = groupIntoDays(periods, { grid, hourly: hours })
    const stormFound = grid ? findNextStorm(grid.snowfall, now) : undefined
    const top = bestDay(days)
    const hasChoice = days.filter((d) => d.condies).length > 1

    return {
        ...source,
        current: hours[0],
        next: hours[1],
        sky: getSky(hours[0], hours[1]),
        powDay: days[0]?.highlight === "pow",
        days,
        weekSnow: days.reduce((total, day) => total + (day.snow ?? 0), 0),
        storm: stormFound && { ...stormFound, text: describeStorm(stormFound, place.timeZone, now) },
        best:
            top && hasChoice && top.condies!.score >= worthGoingScore
                ? { day: top, index: days.indexOf(top) }
                : undefined,
    }
}

// The spot's day to compare: the chosen date, or otherwise its best day this week. Highest score first.
export function rankSpots(spots: LabSpot[], date?: string) {
    return spots
        .map((spot) => ({ ...spot, day: date ? spot.days.find((d) => d.date === date) : bestDay(spot.days) }))
        .sort((a, b) => (b.day?.condies?.score ?? -1) - (a.day?.condies?.score ?? -1))
}

const timeRegex = /(\d+):(\d+)\s(AM|PM)/
const DAY = 86_400_000

async function getLiveAvalanche(lat: string, lon: string) {
    try {
        const response = await fetch("https://api.avalanche.org/v2/public/products/map-layer")
        if (!response.ok) {
            return undefined
        }
        const zone = findZone((await response.json()).features, Number(lat), Number(lon))
        return zone ? readZone(zone, Date.now()) : undefined
    } catch {
        return undefined
    }
}

async function getLiveSnowDepth(lat: string, lon: string): Promise<LabSnowDepth | undefined> {
    try {
        const { default: rows } = await import("../assets/snotel-stations.json")
        const stations = nearestStations(rows as StationRow[], Number(lat), Number(lon))
        if (!stations.length) {
            return undefined
        }
        const now = Date.now()
        const apiDate = (time: number) => new Date(time).toISOString().slice(0, 10)
        const params = new URLSearchParams({
            stationTriplets: stations.map((s) => s.triplet).join(","),
            elements: "SNWD",
            duration: "HOURLY",
            beginDate: `${apiDate(now - 3 * DAY)} 00:00`,
            endDate: `${apiDate(now + DAY)} 00:00`,
        })
        const response = await fetch(`https://wcc.sc.egov.usda.gov/awdbRestApi/services/v1/data?${params}`)
        if (!response.ok) {
            return undefined
        }
        const results: { stationTriplet: string; data: { values: { date: string; value: number | null }[] }[] }[] =
            await response.json()
        for (const station of stations) {
            const values = results.find((r) => r.stationTriplet === station.triplet)?.data[0]?.values
            const reading = values && readDepth(values, station.utcOffset, now)
            if (reading) {
                return reading.depth >= 1 ? { station, ...reading } : undefined
            }
        }
    } catch {
        // Measured snow is an extra, so failing just leaves it off.
    }
    return undefined
}

async function getLiveSun(lat: string, lon: string, timeZone: string): Promise<LabForecast["sun"]> {
    try {
        const parts = new Intl.DateTimeFormat("en-US", {
            timeZone,
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            timeZoneName: "longOffset",
        }).formatToParts(new Date())
        const part = (type: string) => parts.find((p) => p.type === type)!.value
        const [, sign, h, m] = part("timeZoneName").match(/GMT(?:([+-])(\d+):(\d+))?/)!
        const offset = (sign === "-" ? -1 : 1) * (h ? parseInt(h, 10) + parseInt(m, 10) / 60 : 0)
        const date = `${part("year")}-${part("month")}-${part("day")}`
        const response = await fetch(
            `https://aa.usno.navy.mil/api/rstt/oneday?date=${date}&tz=${offset}&coords=${lat},${lon}&id=ElevationCodeWorksLLC`,
        )
        if (!response.ok) {
            return undefined
        }
        const { sundata } = (await response.json()).properties.data
        const read = (phen: string) => {
            const [hours, minutes] = sundata.find((d: Record<string, string>) => d.phen === phen).time.split(":")
            const hour = parseInt(hours, 10)
            return {
                label: `${hour % 12 || 12}:${minutes} ${hour < 12 ? "AM" : "PM"}`,
                decimal: hour + parseInt(minutes, 10) / 60,
            }
        }
        const rise = read("Rise")
        const set = read("Set")
        return { sunrise: rise.label, sunset: set.label, sunriseHour: rise.decimal, sunsetHour: set.decimal }
    } catch {
        return undefined
    }
}

// The real National Weather Service forecast, for reviewing a design against today's actual weather.
export async function loadLive(lat: string, lon: string): Promise<LabForecast> {
    const point = await getPoint(lat, lon)
    if (!point) {
        throw new Error(`no NWS data for ${lat},${lon}`)
    }
    const { timeZone, relativeLocation, forecast, forecastHourly, forecastGridData } = point.properties
    const [alertResults, daily, hourlyResult, grid, avalanche, snowDepth, sun] = await Promise.all([
        getAlerts(lat, lon),
        getForecast(forecast),
        getForecast(forecastHourly),
        getGridForecast(forecastGridData),
        getLiveAvalanche(lat, lon),
        getLiveSnowDepth(lat, lon),
        getLiveSun(lat, lon, timeZone),
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
        alerts: (alertResults?.features ?? []).map((f: { properties: Alert }) => toLabAlert(f.properties)),
        sun,
        avalanche,
        snowDepth,
        updatedAt: daily?.properties.generatedAt ?? new Date(now).toISOString(),
    })
}
