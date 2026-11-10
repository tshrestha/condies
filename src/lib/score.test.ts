import { describe, expect, it } from "vitest"

import { parseGrid, type RawGrid } from "./grid.ts"
import type { Period } from "./nws.ts"
import { scoreDay, scoreHour } from "./score.ts"

const calm = { feelsLike: 30, wind: 5, gust: 10, sky: 0, rainChance: 0, freshSnow: 0 }

describe("scoreHour", () => {
    it("rewards a clear calm hour", () => {
        expect(scoreHour(calm)).toBe(85)
    })

    it("tops out on a bluebird powder day", () => {
        expect(scoreHour({ ...calm, freshSnow: 10 })).toBe(100)
    })

    it.each([
        ["bitter cold", { feelsLike: -20 }],
        ["heat", { feelsLike: 100 }],
        ["strong wind", { wind: 30 }],
        ["strong gusts", { gust: 50 }],
        ["rain", { rainChance: 80 }],
    ])("marks down %s", (_, change) => {
        expect(scoreHour({ ...calm, ...change })).toBeLessThan(scoreHour(calm))
    })

    it("never leaves 0 to 100", () => {
        expect(scoreHour({ feelsLike: -40, wind: 60, gust: 90, sky: 100, rainChance: 100, freshSnow: 0 })).toBe(0)
    })
})

describe("scoreDay", () => {
    const empty = { values: [] }
    const grid = parseGrid({
        properties: {
            elevation: { value: 3000 },
            snowfallAmount: empty,
            snowLevel: { values: [{ validTime: "2026-11-14T00:00:00+00:00/P2D", value: 2000 }] },
            quantitativePrecipitation: empty,
            windChill: empty,
            apparentTemperature: empty,
            windGust: empty,
            skyCover: { values: [{ validTime: "2026-11-14T00:00:00+00:00/P2D", value: 0 }] },
        },
    } as RawGrid)

    const hour = (h: number, wind: number, isDaytime = true) =>
        ({
            startTime: `2026-11-14T${String(h).padStart(2, "0")}:00:00+00:00`,
            isDaytime,
            temperature: 30,
            windSpeed: { value: wind, unitCode: "mph" },
            probabilityOfPrecipitation: { value: 0 },
            hourString: `${h}:00`,
        }) as Period

    it("finds the calmest four-hour stretch", () => {
        const hours = [8, 9, 10, 11, 12, 13, 14, 15, 16].map((h) => hour(h, h >= 11 && h <= 14 ? 5 : 40))
        const result = scoreDay("2026-11-14", hours, grid)
        expect(result).toEqual({ score: 85, bestWindow: "11:00–15:00" })
    })

    it("ignores darkness and other dates", () => {
        expect(scoreDay("2026-11-14", [hour(2, 5, false)], grid)).toBeUndefined()
        expect(scoreDay("2026-11-15", [hour(9, 5)], grid)).toBeUndefined()
    })
})
