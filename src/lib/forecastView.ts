import type { AvalancheStatus } from "./avalanche.ts"
import { bestDay, type DaySummary, groupIntoDays } from "./daily.ts"
import type { Grid } from "./grid.ts"
import type { SnowDepth } from "./mountain.ts"
import type { Alert, Period } from "./nws.ts"
import { describeStorm, findNextStorm, type Storm } from "./storm.ts"
import type { SunTimes } from "./sun.ts"

// One place's forecast, shaped for the screens: everything they show, worked out once.

export interface AlertView {
    severity: Alert["severity"]
    event: string
    headline: string
    // The description split at its "* WHAT...", "* WHERE..." markers. Label is empty for loose text.
    parts: { label: string; text: string }[]
    instruction?: string
}

export interface ForecastView {
    place: { city: string; state: string; lat: string; lon: string; timeZone: string; elevationFeet?: number }
    // The moment the forecast is shown for. Screens use this rather than Date.now(), so tests can fix it.
    now: number
    current: Period
    // Every remaining hour, up to about 156 of them. hours[0] is the current hour.
    hours: Period[]
    days: DaySummary[]
    weekSnow: number
    storm?: Storm & { text: string }
    best?: { day: DaySummary; index: number }
    alerts: AlertView[]
    sun?: SunTimes
    avalanche?: AvalancheStatus
    snowDepth?: SnowDepth
    updatedAt: string
    grid: Grid | null
}

export interface SpotView {
    name: string
    lat: number
    lon: number
    days: DaySummary[]
}

const partLabels = /^(WHAT|WHERE|WHEN|IMPACTS|ADDITIONAL DETAILS)\.\.\./

export function toAlertView(
    alert: Pick<Alert, "severity" | "event" | "headline" | "description" | "instruction">,
): AlertView {
    const parts = alert.description
        .split("*")
        .map((part) => part.replace(/\s+/g, " ").trim())
        .filter(Boolean)
        .map((part) => {
            const match = part.match(partLabels)
            return match ? { label: match[1], text: part.replace(partLabels, "").trim() } : { label: "", text: part }
        })
    return {
        severity: alert.severity,
        event: alert.event,
        headline: alert.headline,
        parts,
        instruction: alert.instruction,
    }
}

// A week of bad days has no day worth pointing out.
const worthGoingScore = 60

export function buildForecast(source: {
    place: ForecastView["place"]
    now: number
    periods: Period[]
    hours: Period[]
    grid: Grid | null
    alerts: AlertView[]
    sun?: SunTimes
    avalanche?: AvalancheStatus
    snowDepth?: SnowDepth
    updatedAt: string
}): ForecastView {
    const { hours, periods, grid, place, now } = source
    const days = groupIntoDays(periods, { grid, hourly: hours })
    const stormFound = grid ? findNextStorm(grid.snowfall, now) : undefined
    const top = bestDay(days)
    const hasChoice = days.filter((d) => d.condies).length > 1

    return {
        ...source,
        current: hours[0],
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
export function rankSpots(spots: SpotView[], date?: string) {
    return spots
        .map((spot) => ({ ...spot, day: date ? spot.days.find((d) => d.date === date) : bestDay(spot.days) }))
        .sort((a, b) => (b.day?.condies?.score ?? -1) - (a.day?.condies?.score ?? -1))
}
