const HOUR = 3_600_000

interface GridSeries {
    values: { validTime: string; value: number | null }[]
}

export interface RawGrid {
    properties: {
        elevation: { value: number }
        snowfallAmount: GridSeries
        snowLevel: GridSeries
        quantitativePrecipitation: GridSeries
        windChill: GridSeries
        apparentTemperature: GridSeries
        windGust: GridSeries
        skyCover: GridSeries
    }
}

type HourlySeries = Map<number, number>

export interface Grid {
    elevation: number
    snowfall: HourlySeries
    precipitation: HourlySeries
    snowLevel: HourlySeries
    windChill: HourlySeries
    feelsLike: HourlySeries
    gust: HourlySeries
    sky: HourlySeries
}

export interface PrecipPhase {
    phase: "snow" | "rain" | "mix"
    snowLevelFeet: number
    elevationFeet: number
}

const toFeet = (meters: number) => Math.round((meters * 3.28084) / 100) * 100
const toFahrenheit = (celsius: number) => (celsius * 9) / 5 + 32

// NWS gives each value as a start time and a duration, like "2026-11-14T06:00:00+00:00/PT6H".
function parseValidTime(validTime: string) {
    const [start, duration] = validTime.split("/")
    const [, days, hours] = duration.match(/P(?:(\d+)D)?(?:T(\d+)H)?/)!
    return { start: Date.parse(start), hours: Number(days ?? 0) * 24 + Number(hours ?? 0) }
}

// Amounts, like snowfall, are divided across their hours. Levels, like temperature, apply to each hour.
function toHourly({ values }: GridSeries, isAmount: boolean, convert = (value: number) => value) {
    const hourly: HourlySeries = new Map()
    for (const { validTime, value } of values) {
        if (value === null) {
            continue
        }
        const { start, hours } = parseValidTime(validTime)
        for (let i = 0; i < hours; i++) {
            hourly.set(start + i * HOUR, convert(isAmount ? value / hours : value))
        }
    }
    return hourly
}

export function parseGrid({ properties: p }: RawGrid): Grid {
    return {
        elevation: p.elevation.value,
        snowfall: toHourly(p.snowfallAmount, true, (mm) => mm / 25.4),
        precipitation: toHourly(p.quantitativePrecipitation, true),
        snowLevel: toHourly(p.snowLevel, false),
        windChill: toHourly(p.windChill, false, toFahrenheit),
        feelsLike: toHourly(p.apparentTemperature, false, toFahrenheit),
        gust: toHourly(p.windGust, false, (kmh) => kmh / 1.609),
        sky: toHourly(p.skyCover, false),
    }
}

const hoursBetween = (from: number, to: number) => {
    const hours = []
    for (let hour = from; hour < to; hour += HOUR) {
        hours.push(hour)
    }
    return hours
}

export function sumBetween(series: HourlySeries, from: number, to: number) {
    return hoursBetween(from, to).reduce((total, hour) => total + (series.get(hour) ?? 0), 0)
}

// Whether precipitation falling at this location, between two times, is snow or rain.
export function getPrecipPhase(grid: Grid, from: number, to: number): PrecipPhase | undefined {
    const levels = hoursBetween(from, to)
        .filter((hour) => (grid.precipitation.get(hour) ?? 0) > 0)
        .map((hour) => grid.snowLevel.get(hour))
        .filter((level) => level !== undefined)
    if (!levels.length) {
        return undefined
    }

    const level = levels.reduce((total, l) => total + l, 0) / levels.length
    // Within about 500 feet of the location, the same storm can fall as either.
    const margin = grid.elevation - level
    return {
        phase: margin > 150 ? "snow" : margin < -150 ? "rain" : "mix",
        snowLevelFeet: toFeet(level),
        elevationFeet: toFeet(grid.elevation),
    }
}
