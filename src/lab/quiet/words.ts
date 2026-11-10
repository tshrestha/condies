import { type DaySummary, getDayLabel } from "../../lib/daily.ts"
import type { Period } from "../../lib/nws.ts"
import type { LabAlert, LabForecast } from "../data.ts"

export const sentence = (text: string) => {
    const lower = text.toLowerCase()
    return lower.charAt(0).toUpperCase() + lower.slice(1)
}

// A real minus sign, so a negative reads as one at a glance.
export const degrees = (t?: number) => (t === undefined ? "–" : `${t < 0 ? "−" : ""}${Math.abs(t)}°`)

export const windSpeed = (p: Period) => p.windSpeed.value ?? p.windSpeed.maxValue ?? 0

export function feelsLike(p: Period) {
    return p.feelsLike !== undefined && Math.abs(p.feelsLike - p.temperature) >= 3 ? p.feelsLike : undefined
}

// Gusts live on the Day screen, so Home keeps to one line of wind.
export const windLine = (p: Period) => (windSpeed(p) ? `Wind ${windSpeed(p)} mph ${p.windDirection}` : "Calm")

// Tomorrow is named, because "what's tomorrow like" is the question people actually ask.
export const dayName = (day: DaySummary, index: number) => (index === 1 ? "Tomorrow" : getDayLabel(day, index, "long"))

export const shortDate = (date: string, withWeekday = false) =>
    new Date(`${date}T12:00:00Z`).toLocaleDateString("en-US", {
        weekday: withWeekday ? "short" : undefined,
        month: "short",
        day: "numeric",
        timeZone: "UTC",
    })

interface Condition {
    test: RegExp
    word: string
    chance?: string
    rank: number
}

// The worst part of a forecast like "Chance Snow Showers then Light Snow" names the day.
const conditions: Condition[] = [
    { test: /thunder|t-?storm/, word: "Storms", chance: "Chance of storms", rank: 9 },
    { test: /heavy snow|blizzard/, word: "Heavy snow", rank: 8 },
    { test: /heavy rain/, word: "Heavy rain", rank: 8 },
    { test: /snow|sleet|wintry|freezing/, word: "Snow", chance: "Chance of snow", rank: 7 },
    { test: /rain|shower|drizzle/, word: "Rain", chance: "Chance of rain", rank: 6 },
    { test: /fog|mist/, word: "Fog", rank: 3 },
    { test: /smoke/, word: "Smoke", rank: 3 },
    { test: /haze|dust/, word: "Haze", rank: 2 },
    { test: /partly sunny/, word: "Partly sunny", rank: 1 },
    { test: /partly cloudy/, word: "Partly cloudy", rank: 1 },
    { test: /cloudy|overcast/, word: "Cloudy", rank: 2 },
    { test: /sunny/, word: "Sunny", rank: 0 },
    { test: /clear/, word: "Clear", rank: 0 },
    { test: /wind|breez|blustery/, word: "Windy", rank: 1 },
]

function readPart(part: string) {
    const text = part.toLowerCase()
    const found = conditions.find((c) => c.test.test(text))
    if (!found) {
        return { word: sentence(part.trim()), rank: -1 }
    }
    if (found.chance && /chance/.test(text)) {
        return { word: found.chance, rank: found.rank - 3 }
    }
    if (text.trim().startsWith("light ") && found.word === "Snow") {
        return { word: "Light snow", rank: found.rank - 1 }
    }
    if (text.trim().startsWith("light ") && found.word === "Rain") {
        return { word: "Light rain", rank: found.rank - 1 }
    }
    return { word: found.word, rank: found.rank }
}

export function conditionWord(forecast: string) {
    if (!forecast) {
        return ""
    }
    return forecast
        .split(/\bthen\b/i)
        .map(readPart)
        .reduce((worst, part) => (part.rank > worst.rank ? part : worst)).word
}

// PRIMO means one thing: a perfect Condies score, the same word the score's grade uses. A day never says PRIMO
// beside a lesser grade. POW DAY is about snow, so it stands on its own and wins when both apply.
export const highlightWord = (day: DaySummary) =>
    day.highlight === "pow" ? "POW DAY" : day.condies?.score === 100 ? "PRIMO" : undefined

const kindOf = (p: Period): "snow" | "storms" | "rain" => {
    const text = p.shortForecast.toLowerCase()
    if ((p.snowInches ?? 0) >= 0.02 || /snow|sleet|flurr/.test(text)) {
        return "snow"
    }
    return /thunder/.test(text) ? "storms" : "rain"
}

const sum = (values: number[]) => values.reduce((a, b) => a + b, 0)

const rainInches = (f: LabForecast, hours: Period[]) =>
    f.grid ? sum(hours.map((h) => f.grid!.precipitation.get(Date.parse(h.startTime)) ?? 0)) / 25.4 : undefined

const formatRain = (inches: number) => (inches < 0.1 ? "under 0.1″" : `${inches.toFixed(1)}″`)

export interface Block {
    label: string
    temperature: number
    precip: string
    // The snow this block prints, rounded the way it prints, so the caption's total is the blocks' sum.
    snow: number
}

const isWet = (p: Period) => (p.snowInches ?? 0) >= 0.02 || p.probabilityOfPrecipitation.value >= 50

// The next 12 hours from now, as one caption and three spans of four hours. The caption and the blocks read
// the same hours, so their numbers always agree, and the caption names when the span ends.
export function nextHours(f: LabForecast) {
    const hours = f.hours.slice(0, 12)
    const blocks: Block[] = [0, 1, 2]
        .map((k) => hours.slice(k * 4, k * 4 + 4))
        .filter((span) => span.length)
        .map((span, k) => {
            const snow = Math.round(sum(span.map((h) => h.snowInches ?? 0)) * 10) / 10
            const wettest = span.reduce((a, b) =>
                b.probabilityOfPrecipitation.value > a.probabilityOfPrecipitation.value ? b : a,
            )
            const chance = wettest.probabilityOfPrecipitation.value
            const kind = kindOf(wettest)
            let precip = "Dry"
            if (snow >= 0.1) {
                precip = `${snow.toFixed(1)}″ snow`
            } else if (chance >= 60) {
                precip = sentence(kind)
            } else if (chance >= 20) {
                precip = `${chance}% ${kind}`
            }
            return {
                label: k === 0 ? "Now" : span[0].hourString,
                temperature: span[0].temperature,
                precip,
                snow: snow >= 0.1 ? snow : 0,
            }
        })

    const windowEnd = hours.length ? Date.parse(hours.at(-1)!.endTime) : f.now
    // A snow storm that runs past these hours, or starts after them, gets its own line with its own span.
    const later = f.storm && f.storm.end > windowEnd ? f.storm.text : undefined
    return { blocks, caption: caption(f, hours, blocks), later }
}

function caption(f: LabForecast, hours: Period[], blocks: Block[]) {
    if (!hours.length) {
        return "No hourly forecast right now"
    }
    const wet = hours.map(isWet)
    const first = wet.indexOf(true)
    if (first < 0) {
        const wettest = hours.reduce((a, b) =>
            b.probabilityOfPrecipitation.value > a.probabilityOfPrecipitation.value ? b : a,
        )
        const chance = wettest.probabilityOfPrecipitation.value
        return chance >= 20 ? `Mostly dry, ${chance}% chance of ${kindOf(wettest)}` : "Dry for the next 12 hours"
    }
    const last = wet.lastIndexOf(true)
    const endsAt = f.hours[last + 1]?.hourString ?? "later"
    const when =
        first === 0 && last === hours.length - 1
            ? "for the next 12 hours"
            : first === 0
              ? `until ${endsAt}`
              : last === hours.length - 1
                ? `from ${hours[first].hourString}`
                : `${hours[first].hourString} to ${endsAt}`

    const snow = sum(blocks.map((b) => b.snow))
    if (snow >= 0.1) {
        return `Snow ${when}, ${snow.toFixed(1)}″`
    }
    const span = hours.slice(first, last + 1)
    const kind = span.some((h) => kindOf(h) === "storms") ? "Storms" : "Rain"
    const rain = rainInches(f, span)
    const chance = Math.max(...span.map((h) => h.probabilityOfPrecipitation.value))
    const amount =
        rain === undefined ? `${chance}% chance` : `${formatRain(rain)}${kind === "Storms" ? " of rain" : ""}`
    return `${kind} ${when}, ${amount}`
}

export const severityRank: Record<LabAlert["severity"], number> = {
    Extreme: 0,
    Severe: 1,
    Moderate: 2,
    Minor: 3,
    Unknown: 4,
}

export const isLoud = (alert: LabAlert) => severityRank[alert.severity] <= severityRank.Severe

export function snowLine(day: DaySummary) {
    if (!day.phase) {
        return undefined
    }
    const { phase, snowLevelFeet, elevationFeet } = day.phase
    return {
        lead:
            phase === "snow"
                ? "All snow at this elevation"
                : phase === "rain"
                  ? "Rain at this elevation"
                  : "Right at the rain/snow line",
        detail: `Snow level ${snowLevelFeet.toLocaleString()} ft, this spot is ${elevationFeet.toLocaleString()} ft`,
    }
}

// Chivo's tabular figures in thousandths of an em: advance, left and right side bearing. With them the numeral
// is sized to its swatch in CSS (100cqi / em) so that its ink spans the width, with no measuring at runtime.
const figures: Record<string, [number, number, number]> = {
    "0": [615, 69, 70],
    "1": [615, 89, 65],
    "2": [615, 65, 69],
    "3": [615, 59, 62],
    "4": [615, 49, 55],
    "5": [615, 71, 66],
    "6": [615, 76, 63],
    "7": [615, 71, 61],
    "8": [615, 66, 66],
    "9": [615, 72, 67],
    "°": [381, 40, 40],
    "−": [615, 52, 52],
    "–": [500, 0, 0],
}

// Must match the numeral's letter-spacing in quiet.css.
const TRACKING = -0.04

export function numeralFit(text: string) {
    const chars = [...text]
    const of = (c?: string) => (c && figures[c]) || [615, 60, 60]
    const advance = sum(chars.map((c) => of(c)[0])) / 1000 + TRACKING * (chars.length - 1)
    const width = advance - of(chars[0])[1] / 1000 - of(chars.at(-1))[2] / 1000
    return { em: width, lsb: of(chars[0])[1] / 1000 }
}

// Plain words for the Condies score, so a newcomer knows what a number means without being told.
export function grade(score: number) {
    if (score >= 100) {
        return "PRIMO"
    }
    if (score >= 90) {
        return "Epic"
    }
    if (score >= 75) {
        return "Great"
    }
    if (score >= 60) {
        return "Good"
    }
    return score >= 40 ? "Fair" : "Poor"
}

// What `scoreDay` in lib/score.ts measures, in one sentence.
export const scoreHelp =
    "How good the best few hours of the day are for being outside, from 0 to 100. Fresh snow and sun raise it; cold, heat, wind and rain lower it."
