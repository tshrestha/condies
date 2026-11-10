import type { DaySummary } from "../../lib/daily.ts"
import type { Period } from "../../lib/nws.ts"
import type { LabAlert, LabForecast } from "../data.ts"

export type Mode = "temp" | "precip" | "wind" | "snow"

export const modeNames: Record<Mode, string> = { temp: "Temp", precip: "Rain", wind: "Wind", snow: "Snow" }

export const windOf = (p: Period) => p.windSpeed.value ?? p.windSpeed.maxValue ?? 0

export const gustOf = (p: Period) => {
    const gust = p.windGust?.value
    return gust !== undefined && gust > windOf(p) ? gust : undefined
}

export const snowOf = (p: Period) => p.snowInches ?? 0

export const hasSnowHours = (hours: Period[]) => hours.some((p) => snowOf(p) >= 0.05)

// Snow amounts read as tenths under ten inches and whole inches above, like formatSnow but without the unit.
export const snowNumber = (inches: number) => (inches < 10 ? inches.toFixed(1) : String(Math.round(inches)))

export const rainNumber = (inches: number) => (inches < 1 ? inches.toFixed(2).replace(/^0/, "") : inches.toFixed(1))

export const sentence = (text: string) => {
    const lower = text.toLowerCase()
    return lower.charAt(0).toUpperCase() + lower.slice(1)
}

export const dateOf = (p: Period) => p.startTime.slice(0, 10)

const severityRank: Record<LabAlert["severity"], number> = {
    Extreme: 0,
    Severe: 1,
    Moderate: 2,
    Minor: 3,
    Unknown: 4,
}

export const sortAlerts = (alerts: LabAlert[]) =>
    [...alerts].sort((a, b) => severityRank[a.severity] - severityRank[b.severity])

// Extreme is louder than Severe, which is louder than Moderate, then Minor.
export const alertTier = (alert: LabAlert): "extreme" | "severe" | "mid" | "low" =>
    alert.severity === "Extreme"
        ? "extreme"
        : alert.severity === "Severe"
          ? "severe"
          : alert.severity === "Moderate"
            ? "mid"
            : "low"

export const avalancheColors = ["#50b848", "#fff200", "#f7941e", "#ed1c24", "#231f20"]

export function feelsLike(p: Period) {
    const feels = p.feelsLike
    return feels !== undefined && Math.abs(feels - p.temperature) >= 3 ? Math.round(feels) : undefined
}

// Rain in inches for each hour, from the grid's liquid amounts. Hours with snow count as snow, not rain.
// Without a grid there are no amounts, so the rain series falls back to chance.
export const rainOf = (hours: Period[], grid: LabForecast["grid"]) =>
    grid
        ? hours.map((p) => (snowOf(p) > 0 ? 0 : (grid.precipitation.get(Date.parse(p.startTime)) ?? 0) / 25.4))
        : undefined

export const chanceOf = (hours: Period[]) => Math.max(0, ...hours.map((p) => p.probabilityOfPrecipitation.value ?? 0))

export interface Outlook {
    kind: "snow" | "rain" | "chance" | "dry"
    amount?: string
    unit?: string
    word: string
    // The chance, as a caption under the amount, so the headline and the graph show the same quantity.
    caption?: string
}

// What falls in a stretch of hours, as one answer: an amount of snow, an amount of rain, a chance, or nothing.
export function outlook(hours: Period[], grid: LabForecast["grid"]): Outlook {
    const snow = hours.reduce((total, p) => total + snowOf(p), 0)
    const storm = hours.some((p) => /thunder/i.test(p.shortForecast))
    const chance = chanceOf(hours)
    const caption = `Chance up to ${chance}%`
    if (snow >= 0.1) {
        return { kind: "snow", amount: snowNumber(snow), unit: "″", word: "of snow", caption }
    }
    const rain = (rainOf(hours, grid) ?? []).reduce((total, r) => total + r, 0)
    if (rain >= 0.01 && chance >= 30) {
        return {
            kind: "rain",
            amount: rainNumber(rain),
            unit: "″",
            word: storm ? "of rain, with storms" : "of rain",
            caption,
        }
    }
    if (chance >= 30) {
        return { kind: "chance", amount: String(chance), unit: "%", word: "chance of rain" }
    }
    return { kind: "dry", word: "No rain or snow" }
}

export function defaultMode(hours: Period[], grid: LabForecast["grid"]): Mode {
    const kind = outlook(hours, grid).kind
    if (kind === "snow" && hasSnowHours(hours)) {
        return "snow"
    }
    return kind === "dry" ? "temp" : "precip"
}

export const dayIndexOf = (days: DaySummary[], date: string) =>
    Math.max(
        0,
        days.findIndex((d) => d.date === date),
    )

export const thousands = (n: number) => n.toLocaleString("en-US")
