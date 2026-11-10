import { describe, expect, it } from "vitest"

import { formatTemp, formatWindRange, getDayLabel, groupIntoDays } from "./daily.ts"
import type { Period } from "./nws.ts"

const period = (startTime: string, isDaytime: boolean, temperature: number, extra: Partial<Period> = {}) =>
    ({
        startTime,
        isDaytime,
        temperature,
        shortForecast: "Mostly Cloudy",
        detailedForecast: "Cloudy.",
        windSpeed: { value: 5, unitCode: "mph" },
        probabilityOfPrecipitation: { value: 10, unitCode: "" },
        ...extra,
    }) as Period

const day = (date: string, high: number, low: number, extra: Partial<Period> = {}) => [
    period(`${date}T06:00:00-07:00`, true, high, extra),
    period(`${date}T18:00:00-07:00`, false, low),
]

describe("groupIntoDays", () => {
    it("pairs each day with the night that follows", () => {
        const [first, second] = groupIntoDays([...day("2026-11-10", 45, 20), ...day("2026-11-11", 50, 25)])
        expect([first.date, first.high, first.low]).toEqual(["2026-11-10", 45, 20])
        expect([second.date, second.high, second.low]).toEqual(["2026-11-11", 50, 25])
    })

    it("handles a day that only has its night left", () => {
        const [first] = groupIntoDays([period("2026-11-10T18:00:00-07:00", false, 20)])
        expect(first.high).toBeUndefined()
        expect(first.low).toBe(20)
    })

    it("uses the evening low when a date also has an Overnight period", () => {
        const [first] = groupIntoDays([period("2026-11-10T01:00:00-07:00", false, 11), ...day("2026-11-10", 45, 22)])
        expect(first.low).toBe(22)
        expect(first.periods).toHaveLength(3)
    })

    it("combines wind into one range across single values and ranges", () => {
        const [first] = groupIntoDays(
            day("2026-11-10", 45, 20, { windSpeed: { minValue: 8, maxValue: 24, unitCode: "mph" } }),
        )
        expect([first.windMin, first.windMax]).toEqual([5, 24])
        expect(formatWindRange(first)).toBe("5–24 mph")
    })

    it("shows one number when the wind doesn't vary", () => {
        const [first] = groupIntoDays(day("2026-11-10", 45, 20))
        expect(formatWindRange(first)).toBe("5 mph")
    })

    it("uses the higher precipitation chance and notices snow in either period", () => {
        const periods = [
            period("2026-11-10T06:00:00-07:00", true, 45, { probabilityOfPrecipitation: { value: 30, unitCode: "" } }),
            period("2026-11-10T18:00:00-07:00", false, 20, {
                probabilityOfPrecipitation: { value: 70, unitCode: "" },
                detailedForecast: "A chance of snow.",
            }),
        ]
        const [first] = groupIntoDays(periods)
        expect(first.precipChance).toBe(70)
        expect(first.precipType).toBe("snow")
    })
})

describe("labels", () => {
    it("names the first day after what's left of it", () => {
        const [full] = groupIntoDays(day("2026-11-10", 45, 20))
        const [night] = groupIntoDays([period("2026-11-10T18:00:00-07:00", false, 20)])
        expect(getDayLabel(full, 0, "short")).toBe("Today")
        expect(getDayLabel(night, 0, "short")).toBe("Tonight")
        expect(getDayLabel(full, 1, "long")).toBe("Tuesday")
    })

    it("shows a dash for a missing temperature", () => {
        expect(formatTemp(undefined)).toBe("–")
        expect(formatTemp(0)).toBe("0°")
    })
})
