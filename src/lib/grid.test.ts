import { describe, expect, it } from "vitest"

import { getPrecipPhase, parseGrid, type RawGrid, sumBetween } from "./grid.ts"

const HOUR = 3_600_000
const start = Date.parse("2026-11-14T06:00:00Z")
const validTime = "2026-11-14T06:00:00+00:00/PT6H"

function grid(overrides: Partial<RawGrid["properties"]> = {}) {
    const empty = { values: [] }
    return parseGrid({
        properties: {
            elevation: { value: 3000 },
            snowfallAmount: empty,
            snowLevel: empty,
            quantitativePrecipitation: empty,
            windChill: empty,
            apparentTemperature: empty,
            windGust: empty,
            skyCover: empty,
            ...overrides,
        },
    })
}

const raining = { values: [{ validTime, value: 6 }] }
const levelAt = (value: number) => ({ values: [{ validTime, value }] })

describe("parseGrid", () => {
    it("spreads amounts across their hours and converts to inches", () => {
        const { snowfall } = grid({ snowfallAmount: { values: [{ validTime, value: 25.4 * 6 }] } })
        expect(snowfall.get(start)).toBeCloseTo(1)
        expect(snowfall.get(start + 5 * HOUR)).toBeCloseTo(1)
        expect(snowfall.has(start + 6 * HOUR)).toBe(false)
    })

    it("converts the feels-like temperature to Fahrenheit", () => {
        const { feelsLike } = grid({ apparentTemperature: { values: [{ validTime, value: -10 }] } })
        expect(feelsLike.get(start)).toBeCloseTo(14)
    })

    it("repeats levels for each hour and converts units", () => {
        const { windChill, gust } = grid({
            windChill: { values: [{ validTime, value: 0 }] },
            windGust: { values: [{ validTime, value: 16.09 }] },
        })
        expect(windChill.get(start + 3 * HOUR)).toBe(32)
        expect(gust.get(start)).toBeCloseTo(10)
    })

    it("understands durations of several days and skips missing values", () => {
        const { sky } = grid({
            skyCover: {
                values: [
                    { validTime: "2026-11-14T06:00:00+00:00/P1DT2H", value: 40 },
                    { validTime: "2026-11-20T06:00:00+00:00/PT1H", value: null },
                ],
            },
        })
        expect(sky.size).toBe(26)
    })
})

describe("sumBetween", () => {
    it("only adds hours inside the range", () => {
        const { snowfall } = grid({ snowfallAmount: { values: [{ validTime, value: 25.4 * 6 }] } })
        expect(sumBetween(snowfall, start, start + 3 * HOUR)).toBeCloseTo(3)
    })
})

describe("getPrecipPhase", () => {
    const end = start + 6 * HOUR
    it.each([
        [2000, "snow"],
        [2950, "mix"],
        [3050, "mix"],
        [3600, "rain"],
    ])("snow level %i m at a 3000 m spot is %s", (level, phase) => {
        expect(
            getPrecipPhase(grid({ quantitativePrecipitation: raining, snowLevel: levelAt(level) }), start, end)?.phase,
        ).toBe(phase)
    })

    it("reports nothing when no precipitation is expected", () => {
        expect(getPrecipPhase(grid({ snowLevel: levelAt(2000) }), start, end)).toBeUndefined()
    })

    it("reports heights in feet, to the nearest hundred", () => {
        const phase = getPrecipPhase(grid({ quantitativePrecipitation: raining, snowLevel: levelAt(2400) }), start, end)
        expect(phase?.snowLevelFeet).toBe(7900)
        expect(phase?.elevationFeet).toBe(9800)
    })
})
