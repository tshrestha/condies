import { describe, expect, it } from "vitest"

import { getIcon } from "./wicons.ts"

const icon = (keyword: string, isDay: boolean) => getIcon({ keyword, isDay }).split("/").pop()

describe("getIcon", () => {
    it.each([
        ["Sunny", "clear-day.svg", "clear-night.svg"],
        ["Mostly Clear", "clear-day.svg", "clear-night.svg"],
        ["Partly Sunny", "partly-cloudy-day.svg", "partly-cloudy-night.svg"],
        ["Mostly Cloudy", "partly-cloudy-day.svg", "partly-cloudy-night.svg"],
        ["Cloudy", "cloudy.svg", "cloudy.svg"],
        ["Slight Chance Rain Showers", "rain.svg", "rain.svg"],
        ["Chance Rain Showers", "rain.svg", "rain.svg"],
        ["Light Rain Likely", "partly-cloudy-day-rain.svg", "partly-cloudy-night-rain.svg"],
        ["Drizzle", "drizzle.svg", "drizzle.svg"],
        ["Snow", "snow.svg", "snow.svg"],
        ["Blizzard", "snow.svg", "snow.svg"],
        ["Chance Light Snow", "partly-cloudy-day-snow.svg", "partly-cloudy-night-snow.svg"],
        ["Rain And Snow Likely", "sleet.svg", "sleet.svg"],
        ["Freezing Rain Likely", "sleet.svg", "sleet.svg"],
        ["Patchy Fog", "fog-day.svg", "fog-night.svg"],
        ["Mist", "mist.svg", "mist.svg"],
        ["Smoke", "smoke.svg", "smoke.svg"],
        ["Haze", "haze-day.svg", "haze-night.svg"],
        ["Blowing Dust", "dust-day.svg", "dust-night.svg"],
        ["Showers And Thunderstorms", "thunderstorms-day-rain.svg", "thunderstorms-night-rain.svg"],
        ["Thunderstorms", "thunderstorms-day.svg", "thunderstorms-night.svg"],
    ])("%s", (keyword, day, night) => {
        expect(icon(keyword, true)).toBe(day)
        expect(icon(keyword, false)).toBe(night)
    })

    it("prefers precipitation when a forecast has several conditions", () => {
        expect(icon("Mostly Sunny then Slight Chance Rain Showers", true)).toBe("rain.svg")
        expect(icon("Patchy Fog then Sunny", true)).toBe("fog-day.svg")
    })

    it("falls back to clear for conditions with no icon, respecting night", () => {
        expect(icon("Widespread Frost", true)).toBe("clear-day.svg")
        expect(icon("Widespread Frost", false)).toBe("clear-night.svg")
    })
})
