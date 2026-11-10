import { describe, expect, it } from "vitest"

import type { Period } from "./nws.ts"
import { formatAge, formatLocalDate, getPrecipType, getTotalSnowAccumulation, isPowDay, isPrimo } from "./util.ts"

const text = (detailedForecast: string) => ({ detailedForecast }) as Period
const total = (...texts: string[]) => getTotalSnowAccumulation({ periods: texts.map(text), index: texts.length - 1 })

describe("getTotalSnowAccumulation", () => {
    it.each([
        ["New snow accumulation of around 8 inches possible.", 8],
        ["New snow accumulation of 3 to 5 inches possible.", 4],
        ["New snow accumulation of 4 to 8 inches possible.", 6],
        ["New snow accumulation of less than one inch possible.", 0],
        ["Little or no snow accumulation expected.", 0],
        ["Rain and snow. New rainfall amounts between 1 and 2 inches possible.", 0],
    ])("%s", (forecast, inches) => {
        expect(total(forecast)).toBe(inches)
    })

    it("is stable across repeated calls", () => {
        const forecast = "Light snow. New snow accumulation of 2 to 3 inches."
        expect([total(forecast), total(forecast), total(forecast), total(forecast)]).toEqual([2.5, 2.5, 2.5, 2.5])
    })

    it("only counts the last three periods", () => {
        expect(total("snow accumulation of 20 inches", "x", "y", "snow accumulation of 2 to 4 inches")).toBe(3)
    })
})

describe("isPowDay", () => {
    const period = (detailedForecast: string, extra: Partial<Period> = {}) =>
        ({
            detailedForecast,
            isDaytime: true,
            temperature: 25,
            windSpeed: { value: 5, unitCode: "mph" },
            probabilityOfPrecipitation: { value: 80 },
            ...extra,
        }) as Period
    const check = (p: Period) => isPowDay({ condies: p, periods: [p], index: 0 })
    const deep = "New snow accumulation of around 8 inches possible."

    it("needs enough snow", () => {
        expect(check(period(deep))).toBe(true)
        expect(check(period("New snow accumulation of 2 to 4 inches possible."))).toBe(false)
    })

    it("needs daytime, a high chance of precipitation, and calm wind", () => {
        expect(check(period(deep, { isDaytime: false }))).toBe(false)
        expect(check(period(deep, { probabilityOfPrecipitation: { value: 40, unitCode: "" } }))).toBe(false)
        expect(check(period(deep, { windSpeed: { value: 30, unitCode: "mph" } }))).toBe(false)
    })
})

describe("isPrimo", () => {
    const period = (shortForecast: string, extra: Partial<Period> = {}) =>
        ({
            shortForecast,
            isDaytime: true,
            temperature: 65,
            windSpeed: { value: 5, unitCode: "mph" },
            probabilityOfPrecipitation: { value: 0 },
            ...extra,
        }) as Period

    it.each([
        ["Sunny", true],
        ["Mostly Sunny", true],
        ["Partly Sunny", false],
        ["Patchy Fog then Sunny", false],
    ])("%s", (forecast, expected) => {
        expect(isPrimo(period(forecast))).toBe(expected)
    })

    it("allows light gusts but not strong ones", () => {
        expect(isPrimo(period("Sunny", { windGust: { value: 10, unitCode: "mph" } }))).toBe(true)
        expect(isPrimo(period("Sunny", { windGust: { value: 11, unitCode: "mph" } }))).toBe(false)
    })
})

describe("getPrecipType", () => {
    it.each([
        ["A chance of snow. Mostly cloudy.", "snow"],
        ["Snow showers likely", "snow"],
        ["Rain likely. Windy.", "rain"],
    ])("%s", (forecast, expected) => {
        expect(getPrecipType(forecast)).toBe(expected)
    })
})

describe("formatAge", () => {
    const MINUTE = 60_000

    it.each([
        [-5 * MINUTE, "just now"],
        [30_000, "just now"],
        [12 * MINUTE, "12 min ago"],
        [59 * MINUTE, "59 min ago"],
        [60 * MINUTE, "1 hr ago"],
        [23 * 60 * MINUTE, "23 hr ago"],
        [24 * 60 * MINUTE, "1 day ago"],
        [72 * 60 * MINUTE, "3 days ago"],
    ])("%d ms is %s", (ms, text) => {
        expect(formatAge(ms)).toBe(text)
    })
})

describe("formatLocalDate", () => {
    it("uses the date written in the timestamp, not the viewer's time zone", () => {
        expect(formatLocalDate("2026-11-12T06:00:00+10:00", { weekday: "short" })).toBe("Thu")
        expect(formatLocalDate("2026-11-09T23:00:00-10:00", { weekday: "short" })).toBe("Mon")
    })
})
