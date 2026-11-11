import { expect, test } from "vitest"

import { getLocalDateAndOffset, readSunTime } from "./sun.ts"

test("sun times read as 12-hour clock labels and fractional hours", () => {
    expect(readSunTime("07:18")).toEqual({ label: "7:18 AM", hour: 7 + 18 / 60 })
    expect(readSunTime("17:12")).toEqual({ label: "5:12 PM", hour: 17 + 12 / 60 })
    expect(readSunTime("00:05").label).toBe("12:05 AM")
    expect(readSunTime("12:30").label).toBe("12:30 PM")
})

test("the date and offset are the forecast location's, not the viewer's", () => {
    const now = new Date("2026-11-11T05:30:00Z")
    expect(getLocalDateAndOffset("America/Denver", now)).toEqual({ date: "2026-11-10", offset: -7 })
    expect(getLocalDateAndOffset("Asia/Kolkata", now)).toEqual({ date: "2026-11-11", offset: 5.5 })
})
