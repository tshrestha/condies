import { describe, expect, it } from "vitest"

import { describeStorm, findNextStorm } from "./storm.ts"

const HOUR = 3_600_000
const denver = "America/Denver"
// A Wednesday, 10 AM in Denver.
const now = Date.parse("2026-11-11T17:00:00Z")

const snowAt = (...hours: [number, number][]) => new Map(hours.map(([h, inches]) => [now + h * HOUR, inches]))

describe("findNextStorm", () => {
    it("adds up a run of snowy hours", () => {
        const storm = findNextStorm(snowAt([10, 1], [11, 1], [12, 1]), now)
        expect(storm).toEqual({ start: now + 10 * HOUR, end: now + 13 * HOUR, inches: 3 })
    })

    it("treats a short pause as the same storm", () => {
        expect(findNextStorm(snowAt([10, 1], [15, 1]), now)?.inches).toBe(2)
    })

    it("treats a long pause as a new storm", () => {
        expect(findNextStorm(snowAt([10, 1], [17, 5]), now)?.inches).toBe(1)
    })

    it("skips flurries too small to count", () => {
        const storm = findNextStorm(snowAt([2, 0.2], [30, 4]), now)
        expect(storm?.start).toBe(now + 30 * HOUR)
    })

    it("counts only what's still to come", () => {
        expect(findNextStorm(snowAt([-5, 8], [-1, 8], [0, 2]), now)?.inches).toBe(2)
    })

    it("is undefined with no snow ahead", () => {
        expect(findNextStorm(snowAt([-3, 9], [4, 0]), now)).toBeUndefined()
    })
})

describe("describeStorm", () => {
    const storm = (start: string, end: string, inches: number) => ({
        start: Date.parse(start),
        end: Date.parse(end),
        inches,
    })

    it("names the day and part of day at the location", () => {
        expect(describeStorm(storm("2026-11-13T02:00:00Z", "2026-11-13T16:00:00Z", 6), denver, now)).toBe(
            "Snow from Thu night to Fri morning · 6.0″",
        )
    })

    it("says one thing when the storm fits in one part of the day", () => {
        expect(describeStorm(storm("2026-11-12T01:00:00Z", "2026-11-12T05:00:00Z", 2), denver, now)).toBe(
            "Snow tonight · 2.0″",
        )
    })

    it("counts the small hours as the night before", () => {
        expect(describeStorm(storm("2026-11-12T08:00:00Z", "2026-11-12T11:00:00Z", 1.5), denver, now)).toBe(
            "Snow tonight · 1.5″",
        )
    })

    it("uses the part of the day the storm ends in, not the hour after", () => {
        expect(describeStorm(storm("2026-11-12T19:00:00Z", "2026-11-13T00:00:00Z", 12), denver, now)).toBe(
            "Snow Thu afternoon · 12″",
        )
    })

    it("words a storm that's already started differently", () => {
        expect(describeStorm(storm("2026-11-11T17:00:00Z", "2026-11-12T03:00:00Z", 3), denver, now)).toBe(
            "Snow through tonight · 3.0″ more",
        )
    })
})
