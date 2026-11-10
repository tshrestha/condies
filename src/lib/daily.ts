import type { Period } from "./nws.ts"
import { formatLocalDate, getPrecipType, isPowDay, isPrimo } from "./util.ts"

export interface DaySummary {
    date: string
    periods: Period[]
    day?: Period
    night?: Period
    high?: number
    low?: number
    windMin: number
    windMax: number
    gust?: number
    precipChance: number
    precipType: "snow" | "rain"
    highlight?: "primo" | "pow"
}

const isNumber = (value: unknown): value is number => typeof value === "number"

// NWS sends alternating day and night periods. Each calendar day pairs its daytime period with the
// night that follows it, so the night's temperature is that day's low.
export function groupIntoDays(periods: Period[]): DaySummary[] {
    const periodsByDate = new Map<string, Period[]>()
    for (const period of periods) {
        const date = period.startTime.slice(0, 10)
        periodsByDate.set(date, [...(periodsByDate.get(date) ?? []), period])
    }

    return [...periodsByDate].map(([date, dayPeriods]) => {
        const day = dayPeriods.find((p) => p.isDaytime)
        // Just after midnight a date can have an "Overnight" period before its own evening.
        const night = dayPeriods.findLast((p) => !p.isDaytime)

        const speeds = dayPeriods
            .flatMap(({ windSpeed }) => [windSpeed.minValue, windSpeed.maxValue, windSpeed.value])
            .filter(isNumber)
        const gusts = dayPeriods.map((p) => p.windGust?.value).filter(isNumber)

        let highlight: DaySummary["highlight"]
        if (day && isPrimo(day)) {
            highlight = "primo"
        } else if (day && isPowDay({ condies: day, periods, index: periods.indexOf(day) })) {
            highlight = "pow"
        }

        return {
            date,
            periods: dayPeriods,
            day,
            night,
            high: day?.temperature,
            low: night?.temperature,
            windMin: speeds.length ? Math.min(...speeds) : 0,
            windMax: speeds.length ? Math.max(...speeds) : 0,
            gust: gusts.length ? Math.max(...gusts) : undefined,
            precipChance: Math.max(...dayPeriods.map((p) => p.probabilityOfPrecipitation.value)),
            precipType: dayPeriods.some((p) => getPrecipType(p.detailedForecast) === "snow") ? "snow" : "rain",
            highlight,
        }
    })
}

export function getDayLabel(summary: DaySummary, index: number, weekday: "short" | "long") {
    if (index === 0) {
        return summary.day ? "Today" : "Tonight"
    }
    return formatLocalDate(summary.date, { weekday })
}

export const formatTemp = (temperature?: number) => (temperature === undefined ? "–" : `${temperature}°`)

export function formatWindRange({ windMin, windMax }: DaySummary) {
    return windMin === windMax ? `${windMax} mph` : `${windMin}–${windMax} mph`
}
