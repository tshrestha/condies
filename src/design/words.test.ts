import { describe, expect, test } from "vitest"

import type { DaySummary } from "../lib/daily.ts"
import type { ForecastView } from "../lib/forecastView.ts"
import type { Period } from "../lib/nws.ts"
import { degrees, grade, highlightWord, nextHours } from "./words.ts"

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
        expect(next.blocks.map((b) => b.precip)).toEqual(["Dry", "Dry", "Dry"])
    })

    test("rain without amounts gives its chance and its span", () => {
        const wet = hours((i) => (i >= 2 && i < 6 ? { probabilityOfPrecipitation: { unitCode: "", value: 80 } } : {}))
        expect(nextHours(forecast(wet)).caption).toBe("Rain 4 PM to 8 PM, 80% chance")
    })
})
