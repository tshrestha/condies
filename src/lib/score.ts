import { type Grid, sumBetween } from "./grid.ts"
import type { Period } from "./nws.ts"

const HOUR = 3_600_000
const WINDOW_HOURS = 4

interface HourConditions {
    feelsLike: number
    wind: number
    gust: number
    sky: number
    rainChance: number
    freshSnow: number
}

export interface DayScore {
    score: number
    bestWindow: string
}

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max)

// 0 to 100 for how good an hour is to be out in. Fresh snow and clear skies help, while bitter cold,
// heat, wind and rain hurt.
export function scoreHour({ feelsLike, wind, gust, sky, rainChance, freshSnow }: HourConditions) {
    const snowBonus = Math.min(freshSnow * 4, 30)
    const sunBonus = ((100 - sky) / 100) * 15
    const coldPenalty = clamp(10 - feelsLike, 0, 25)
    const heatPenalty = clamp((feelsLike - 80) * 1.5, 0, 30)
    const windPenalty = clamp((wind - 10) * 1.5, 0, 30)
    const gustPenalty = clamp((gust - 25) * 0.8, 0, 20)
    const rainPenalty = rainChance * 0.5

    const score = 70 + snowBonus + sunBonus - coldPenalty - heatPenalty - windPenalty - gustPenalty - rainPenalty
    return Math.round(clamp(score, 0, 100))
}

function conditionsAt(period: Period, grid: Grid): HourConditions {
    const start = Date.parse(period.startTime)
    const level = grid.snowLevel.get(start)
    const isRain = level === undefined || level > grid.elevation

    return {
        feelsLike: grid.windChill.get(start) ?? period.temperature,
        wind: period.windSpeed.value ?? period.windSpeed.maxValue ?? 0,
        gust: grid.gust.get(start) ?? period.windGust?.value ?? 0,
        sky: grid.sky.get(start) ?? 50,
        rainChance: isRain ? period.probabilityOfPrecipitation.value : 0,
        freshSnow: sumBetween(grid.snowfall, start - 24 * HOUR, start + HOUR),
    }
}

// The best stretch of daylight on a date. The day's score is how good that stretch is.
export function scoreDay(date: string, hourly: Period[], grid: Grid): DayScore | undefined {
    const hours = hourly.filter((p) => p.startTime.slice(0, 10) === date && p.isDaytime)
    if (!hours.length) {
        return undefined
    }

    const scores = hours.map((p) => scoreHour(conditionsAt(p, grid)))
    const size = Math.min(WINDOW_HOURS, hours.length)
    let bestStart = 0
    let bestAverage = -1
    for (let start = 0; start + size <= hours.length; start++) {
        const average = scores.slice(start, start + size).reduce((total, s) => total + s, 0) / size
        if (average > bestAverage) {
            bestAverage = average
            bestStart = start
        }
    }

    const last = hours[bestStart + size - 1]
    const after = hourly[hourly.indexOf(last) + 1]
    return {
        score: Math.round(bestAverage),
        bestWindow: `${hours[bestStart].hourString}–${(after ?? last).hourString}`,
    }
}
