import { describe, expect, it } from "vitest"

import type { Period } from "./nws.ts"
import { getSky } from "./sky.ts"

const period = (shortForecast: string, isDaytime = true) => ({ shortForecast, isDaytime }) as Period

describe("getSky", () => {
    it.each([
        ["Sunny", "clear"],
        ["Partly Cloudy", "clear"],
        ["Mostly Cloudy", "cloudy"],
        ["Overcast", "cloudy"],
        ["Chance Rain Showers", "rain"],
        ["Light Snow Likely", "snow"],
        ["Rain And Snow", "snow"],
        ["Patchy Fog", "fog"],
        ["Showers And Thunderstorms", "storm"],
    ])("%s is %s", (forecast, kind) => {
        expect(getSky(period(forecast)).kind).toBe(kind)
    })

    it("follows day and night", () => {
        expect(getSky(period("Clear", false)).time).toBe("night")
        expect(getSky(period("Sunny", true)).time).toBe("day")
    })

    it("shows sunrise and sunset colours in the hour the sun changes", () => {
        expect(getSky(period("Sunny", true), period("Clear", false)).time).toBe("dusk")
        expect(getSky(period("Clear", false), period("Sunny", true)).time).toBe("dawn")
    })

    it("only shows sunrise and sunset under clear skies", () => {
        expect(getSky(period("Snow", true), period("Snow", false)).time).toBe("day")
    })
})
