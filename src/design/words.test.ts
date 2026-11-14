import { describe, expect, test } from "vitest"

import type { DaySummary } from "../lib/daily.ts"
import type { ForecastView } from "../lib/forecastView.ts"
import type { Period } from "../lib/nws.ts"
import { condition, degrees, grade, highlightWord, nextHours } from "./words.ts"

describe("Condies score grades", () => {
    test.each([
        [100, "PRIMO"],
        [99, "Epic"],
        [90, "Epic"],
        [89, "Great"],
        [75, "Great"],
        [74, "Good"],
        [60, "Good"],
        [59, "Fair"],
        [40, "Fair"],
        [39, "Poor"],
        [0, "Poor"],
    ])("%i is %s", (score, word) => {
        expect(grade(score)).toBe(word)
    })
})

describe("day markers", () => {
    const day = (extra: Partial<DaySummary>) => ({ date: "2026-11-10", periods: [], ...extra }) as DaySummary

    test("PRIMO only for a perfect score, so it never sits beside a lesser grade", () => {
        expect(highlightWord(day({ condies: { score: 100, bestWindow: "" } }))).toBe("PRIMO")
        expect(highlightWord(day({ highlight: "primo", condies: { score: 86, bestWindow: "" } }))).toBeUndefined()
    })

    test("POW DAY wins over a perfect score", () => {
        expect(highlightWord(day({ highlight: "pow", condies: { score: 100, bestWindow: "" } }))).toBe("POW DAY")
    })
})

test("temperatures use a real minus sign", () => {
    expect(degrees(-3)).toBe("−3°")
    expect(degrees(25)).toBe("25°")
    expect(degrees(undefined)).toBe("–")
})

describe("a condition's word and picture", () => {
    test.each([
        ["Mostly Sunny", "Sunny", "sun"],
        ["Partly Sunny", "Partly sunny", "partly-day"],
        ["Mostly Cloudy", "Cloudy", "cloud"],
        ["Light Snow", "Light snow", "snow-light"],
        ["Heavy Snow", "Heavy snow", "snow-heavy"],
        ["Rain Showers Likely", "Rain", "rain"],
        ["Showers And Thunderstorms", "Storms", "storms"],
        ["Patchy Fog", "Fog", "fog"],
        ["Areas Of Smoke", "Smoke", "haze"],
        ["Breezy", "Windy", "wind"],
    ] as const)("%s is %s", (forecast, word, icon) => {
        expect(condition(forecast)).toEqual({ word, icon, chance: false })
    })

    test("the worst part of the forecast names it", () => {
        expect(condition("Chance Snow Showers then Light Snow").icon).toBe("snow-light")
        expect(condition("Patchy Fog then Sunny").icon).toBe("fog")
    })

    test("a chance says so, for its percentage to be shown", () => {
        expect(condition("Chance Rain Showers")).toEqual({ word: "Chance of rain", icon: "rain", chance: true })
    })

    test("after dark the sun is the moon", () => {
        expect(condition("Mostly Clear", false).icon).toBe("moon")
        expect(condition("Partly Cloudy", false).icon).toBe("partly-night")
        expect(condition("Mostly Cloudy", false).icon).toBe("cloud")
        expect(condition("Clear").icon).toBe("sun")
    })

    test("a forecast it doesn't know has no picture and keeps its words", () => {
        expect(condition("Frost")).toEqual({ word: "Frost", chance: false })
        expect(condition("")).toEqual({ word: "", chance: false })
    })
})

describe("next 12 hours", () => {
    const start = Date.parse("2026-11-10T14:00:00-07:00")
    const label = (i: number) => {
        const h = (14 + i) % 24
        return `${h % 12 || 12} ${h < 12 ? "AM" : "PM"}`
    }
    const hours = (each: (i: number) => Partial<Period>) =>
        Array.from(
            { length: 14 },
            (_, i) =>
                ({
                    startTime: new Date(start + i * 3_600_000).toISOString(),
                    endTime: new Date(start + (i + 1) * 3_600_000).toISOString(),
                    temperature: 25 - i,
                    probabilityOfPrecipitation: { unitCode: "wmoUnit:percent", value: 0 },
                    shortForecast: "Cloudy",
                    hourString: label(i),
                    snowInches: 0,
                    ...each(i),
                }) as Period,
        )
    const forecast = (list: Period[]) => ({ hours: list, now: start, grid: null }) as unknown as ForecastView

    test("the caption's snow total is the blocks' sum, and names when the snow stops", () => {
        const snowy = hours((i) =>
            i < 8 ? { snowInches: 0.9, probabilityOfPrecipitation: { unitCode: "", value: 100 } } : {},
        )
        const next = nextHours(forecast(snowy))
        expect(next.blocks.map((b) => b.snow)).toEqual([3.6, 3.6, 0])
        expect(next.caption).toBe("Snow until 10 PM, 7.2″")
    })

    test("a dry stretch says so", () => {
        const next = nextHours(forecast(hours(() => ({}))))
        expect(next.caption).toBe("Dry for the next 12 hours")
        // A dry block shows the sky at its first hour.
        expect(next.blocks.map((b) => [b.icon, b.word, b.shown])).toEqual(Array(3).fill(["cloud", "Cloudy", ""]))
    })

    test("a block's picture is what falls in it, with the amount or the chance beside it", () => {
        const mixed = hours((i) =>
            i < 4
                ? {
                      snowInches: 0.5,
                      shortForecast: "Heavy Snow",
                      probabilityOfPrecipitation: { unitCode: "", value: 90 },
                  }
                : i < 8
                  ? { shortForecast: "Chance Rain Showers", probabilityOfPrecipitation: { unitCode: "", value: 40 } }
                  : { shortForecast: "Slight Chance Snow Showers", isDaytime: false },
        )
        expect(nextHours(forecast(mixed)).blocks.map((b) => [b.icon, b.word, b.shown])).toEqual([
            ["snow-heavy", "Snow", "2.0″"],
            ["rain", "Rain", "40%"],
            // Too unlikely to count, so the block is dry and its sky is a cloud.
            ["cloud", "Cloudy", ""],
        ])
    })

    test("rain or snow at 60% or more is likely enough to drop its chance", () => {
        const wet = hours(() => ({ probabilityOfPrecipitation: { unitCode: "", value: 80 } }))
        expect(nextHours(forecast(wet)).blocks.map((b) => [b.icon, b.word, b.shown])).toEqual(
            Array(3).fill(["rain", "Rain", ""]),
        )
    })

    test("a dry block whose forecast has no picture says Dry", () => {
        const next = nextHours(forecast(hours(() => ({ shortForecast: "Frost" }))))
        expect(next.blocks.map((b) => [b.icon, b.word])).toEqual(Array(3).fill([undefined, "Dry"]))
    })

    test("rain without amounts gives its chance and its span", () => {
        const wet = hours((i) => (i >= 2 && i < 6 ? { probabilityOfPrecipitation: { unitCode: "", value: 80 } } : {}))
        expect(nextHours(forecast(wet)).caption).toBe("Rain 4 PM to 8 PM, 80% chance")
    })
})
