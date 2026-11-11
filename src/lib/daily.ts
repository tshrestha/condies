import { getPrecipPhase, type Grid, type PrecipPhase, sumBetween } from "./grid.ts"
import type { Period } from "./nws.ts"
import { type DayScore, scoreDay } from "./score.ts"
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
    snow?: number
    phase?: PrecipPhase
    condies?: DayScore
}

interface DayExtras {
    grid?: Grid | null
    hourly?: Period[]
}

const isNumber = (value: unknown): value is number => typeof value === "number"

// NWS sends alternating day and night periods. Each calendar day pairs its daytime period with the
// night that follows it, so the night's temperature is that day's low.
export function groupIntoDays(periods: Period[], { grid, hourly = [] }: DayExtras = {}): DaySummary[] {
    const periodsByDate = new Map<string, Period[]>()
    for (const period of periods) {
        const date = period.startTime.slice(0, 10)
        periodsByDate.set(date, [...(periodsByDate.get(date) ?? []), period])
    }

    const snowDuring = (list: Period[]) =>
        grid
            ? list.reduce((t, p) => t + sumBetween(grid.snowfall, Date.parse(p.startTime), Date.parse(p.endTime)), 0)
            : undefined

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
        } else if (day) {
            const index = periods.indexOf(day)
            const snowInches = snowDuring(periods.slice(Math.max(0, index - 2), index + 1))
            if (isPowDay({ condies: day, periods, index, snowInches })) {
                highlight = "pow"
            }
        }

        const phase = grid
            ? getPrecipPhase(grid, Date.parse(dayPeriods[0].startTime), Date.parse(dayPeriods.at(-1)!.endTime))
            : undefined
        const textSaysSnow = dayPeriods.some((p) => getPrecipType(p.detailedForecast) === "snow")

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
            precipType: (phase ? phase.phase !== "rain" : textSaysSnow) ? "snow" : "rain",
            highlight,
            snow: snowDuring(dayPeriods),
            phase,
            condies: grid ? scoreDay(date, hourly, grid) : undefined,
        }
    })
}

export function getDayLabel(summary: DaySummary, index: number, weekday: "short" | "long") {
    if (index === 0) {
        return summary.day ? "Today" : "Tonight"
    }
    return formatLocalDate(summary.date, { weekday })
}

export function formatWindRange({ windMin, windMax }: DaySummary) {
    return windMin === windMax ? `${windMax} mph` : `${windMin}–${windMax} mph`
}

export const formatSnow = (inches: number) => `${inches < 10 ? inches.toFixed(1) : Math.round(inches)}″`

// Half a point is less than any real difference in score, so a POW or PRIMO day only wins ties.
const rank = (day?: DaySummary) => (day?.condies?.score ?? -1) + (day?.highlight ? 0.5 : 0)

export const bestDay = (days: DaySummary[]) =>
    days.reduce<DaySummary | undefined>((best, day) => (rank(day) > rank(best) ? day : best), undefined)

export const hasSnow = (summary: DaySummary) => (summary.snow ?? 0) >= 0.1
