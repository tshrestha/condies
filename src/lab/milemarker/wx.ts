import type { DaySummary } from "../../lib/daily.ts"
import { formatSnow } from "../../lib/daily.ts"
import type { Period } from "../../lib/nws.ts"
import type { LabAlert, LabForecast } from "../data.ts"

export type Symbol = "sun" | "moon" | "partly" | "cloud" | "rain" | "snow" | "storm" | "fog" | "haze"
export type View = "temp" | "precip" | "wind" | "snow"

const HOUR = 3_600_000

export const speedOf = (p: Period) => p.windSpeed.value ?? p.windSpeed.maxValue ?? 0
export const hourOf = (p: Period) => Number(p.startTime.slice(11, 13))
export const dateOf = (p: Period) => p.startTime.slice(0, 10)

// Signs use a true minus, which is wider and easier to see than a hyphen.
export const deg = (t?: number) => (t === undefined ? "–" : `${t < 0 ? "−" : ""}${Math.abs(t)}°`)

export const sentenceCase = (text: string) => {
    const lower = text.toLowerCase()
    return lower.charAt(0).toUpperCase() + lower.slice(1)
}

export function symbolFor(text: string, isDay = true): Symbol {
    const t = text.toLowerCase()
    if (/thunder|t-?storm/.test(t)) {
        return "storm"
    }
    if (/snow|sleet|flurries|blizzard|wintry/.test(t)) {
        return "snow"
    }
    if (/rain|shower|drizzle/.test(t)) {
        return "rain"
    }
    if (/haze|smoke|dust/.test(t)) {
        return "haze"
    }
    if (/fog|mist/.test(t)) {
        return "fog"
    }
    if (/partly|mostly cloudy/.test(t)) {
        return "partly"
    }
    if (/cloudy|overcast/.test(t)) {
        return "cloud"
    }
    return isDay ? "sun" : "moon"
}

// A short word for the symbol, used as its text alternative.
export const symbolWord: Record<Symbol, string> = {
    sun: "Sunny",
    moon: "Clear",
    partly: "Some clouds",
    cloud: "Cloudy",
    rain: "Rain",
    snow: "Snow",
    storm: "Thunderstorms",
    fog: "Fog",
    haze: "Haze",
}

export function windText(p: Period) {
    const speed = speedOf(p)
    const gust = p.windGust?.value
    return {
        wind: speed ? `Wind ${p.windDirection} ${speed} mph` : "Calm",
        gust: speed && gust !== undefined && gust > speed ? `gusts ${gust} mph` : "",
    }
}

export function feelsLike(p: Period) {
    return p.feelsLike !== undefined && Math.abs(p.feelsLike - p.temperature) >= 3 ? p.feelsLike : undefined
}

const rainInchesAt = (f: LabForecast, p: Period) =>
    (p.snowInches ?? 0) >= 0.01 ? 0 : (f.grid?.precipitation.get(Date.parse(p.startTime)) ?? 0) / 25.4

const formatRain = (inches: number) => `${inches.toFixed(1)}″`

// A time never breaks from its AM or PM.
export const clock = (text: string) => text.replace(/ (AM|PM)/g, " $1")

// "4 PM" and "11 PM" read as "4–11 PM", the way a time window is said aloud.
export function span(from: string, to: string) {
    const [a, am] = from.split(" ")
    const [, bm] = to.split(" ")
    // "12–7 AM" could be read as starting at noon, so a window from midnight keeps both halves.
    return clock(am === bm && from !== "12 AM" ? `${a}–${to}` : `${from}–${to}`)
}

// The score's best window, "1 PM–5 PM", as "1–5 PM".
export function windowText(window: string) {
    const [from, to] = window.split("–")
    return to ? span(from, to) : clock(window)
}

const endLabel = (hours: Period[], i: number) => hours[i + 1]?.hourString ?? hours[i].hourString

// What the next twelve hours hold, as a sign legend: a headline that answers "rain or snow, and how much".
export function outlook(f: LabForecast, count = 12) {
    const hours = f.hours.slice(0, count)
    const snow = hours.reduce((t, p) => t + (p.snowInches ?? 0), 0)
    const rain = hours.reduce((t, p) => t + rainInchesAt(f, p), 0)
    const chance = Math.max(...hours.map((p) => p.probabilityOfPrecipitation.value))
    const thunder = hours.some((p) => /thunder/i.test(p.shortForecast))
    const wet = (p: Period) => (p.snowInches ?? 0) >= 0.01 || p.probabilityOfPrecipitation.value >= 50

    const first = hours.findIndex(wet)
    const last = hours.findLastIndex(wet)
    const timing = () => {
        const ends = last < hours.length - 1
        if (first > 0) {
            return ends
                ? span(hours[first].hourString, endLabel(hours, last))
                : `From ${clock(hours[first].hourString)}`
        }
        return ends ? `Until ${clock(endLabel(hours, last))}` : "All 12 hours"
    }

    if (snow >= 0.1) {
        return { headline: `${formatSnow(snow)} of snow`, detail: timing(), view: "snow" as View }
    }
    if (chance >= 50) {
        const when = timing()
        return {
            headline: rain >= 0.1 ? `${formatRain(rain)} of rain` : thunder ? "Storms likely" : "Rain likely",
            detail: thunder && rain >= 0.1 ? `Storms ${when.charAt(0).toLowerCase()}${when.slice(1)}` : when,
            view: "precip" as View,
        }
    }
    if (chance >= 20) {
        const snowy = hours.some((p) => /snow/i.test(p.shortForecast))
        const peak = hours.find((p) => p.probabilityOfPrecipitation.value === chance)!
        return {
            headline: `${chance}% chance of ${thunder ? "storms" : snowy ? "snow" : "rain"}`,
            detail: `Most likely at ${clock(peak.hourString)}`,
            view: "precip" as View,
        }
    }
    const temps = hours.map((p) => p.temperature)
    const rising = hours.at(-1)!.temperature > hours[0].temperature
    const extreme = rising ? Math.max(...temps) : Math.min(...temps)
    const at = hours[temps.indexOf(extreme)]
    return {
        headline: "Stays dry",
        detail: `${rising ? "Up" : "Down"} to ${deg(extreme)} by ${clock(at.hourString)}`,
        view: "temp" as View,
    }
}

export const hasSnowHours = (hours: Period[]) => hours.some((p) => (p.snowInches ?? 0) >= 0.05)

// Color follows the NWS severity, so a more serious alert always looks more serious: Extreme and Severe are
// yellow warning signs, Moderate is orange, Minor is a plain white sign.
export const alertColor = (a: LabAlert) =>
    a.severity === "Extreme" || a.severity === "Severe" ? "warn" : a.severity === "Moderate" ? "temp" : "reg"
export const isProminent = (a: LabAlert) => a.severity === "Extreme" || a.severity === "Severe"
const severityRank = { Extreme: 0, Severe: 1, Moderate: 2, Minor: 3, Unknown: 4 }
export const sortAlerts = (alerts: LabAlert[]) =>
    [...alerts].sort((a, b) => severityRank[a.severity] - severityRank[b.severity])

// The storm is only worth its own sign when the next-twelve-hours sign doesn't already cover it.
export function stormBeyond(f: LabForecast) {
    const storm = f.storm
    if (!storm) {
        return undefined
    }
    return storm.end > f.now + 12 * HOUR ? storm : undefined
}

export const snowWord = (day: DaySummary) => ((day.snow ?? 0) >= 0.1 ? formatSnow(day.snow!) : "")

export function snowLine(day: DaySummary) {
    const phase = day.phase
    if (!phase || day.precipChance < 20) {
        return undefined
    }
    const headline =
        phase.phase === "snow"
            ? "All snow at this elevation"
            : phase.phase === "rain"
              ? "Rain at this elevation"
              : "Right at the rain/snow line"
    return {
        level: `${phase.snowLevelFeet.toLocaleString("en-US")} ft`,
        headline: `${headline}, ${phase.elevationFeet.toLocaleString("en-US")} ft`,
    }
}

// The WHEN part of an alert, if it's short enough to sit on one line.
export function alertWhen(a: LabAlert) {
    const when = a.parts.find((p) => p.label === "WHEN")?.text.replace(/\.$/, "")
    return when && when.length <= 32 ? when : undefined
}
