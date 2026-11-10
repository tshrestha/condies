import { describe, expect, it } from "vitest"

import { nearestStations, readDepth, type StationRow } from "./snotel.ts"

const rows: StationRow[] = [
    ["far:CO:SNTL", "Far", 41, -106, 10000, -8],
    ["near:CO:SNTL", "Near", 39.51, -106, 11000, -8],
    ["nearest:CO:SNTL", "Nearest", 39.5, -106.01, 9000, -8],
    ["middle:CO:SNTL", "Middle", 39.6, -106, 10500, -8],
    ["last:CO:SNTL", "Last", 39.65, -106, 10500, -8],
]

describe("nearestStations", () => {
    it("returns the closest few within range, closest first", () => {
        expect(nearestStations(rows, 39.5, -106).map((s) => s.name)).toEqual(["Nearest", "Near", "Middle"])
    })

    it("measures the distance in miles", () => {
        expect(nearestStations(rows, 39.5, -106)[1].miles).toBeCloseTo(0.69, 1)
    })

    it("ignores stations too far away to represent the place", () => {
        expect(nearestStations(rows, 45, -100)).toEqual([])
    })
})

describe("readDepth", () => {
    const HOUR = 3_600_000
    // Stations report in local standard time, so these are UTC-8.
    const utcOffset = -8
    const now = Date.parse("2026-11-10T20:00:00Z")

    function hoursAgo(hours: number, value: number | null) {
        const local = new Date(now - hours * HOUR + utcOffset * HOUR).toISOString().slice(0, 16).replace("T", " ")
        return { date: local, value }
    }

    it("reads the depth and the 24-hour change", () => {
        const values = [
            hoursAgo(25, 6),
            hoursAgo(24, 6),
            hoursAgo(23, 6),
            hoursAgo(2, 12),
            hoursAgo(1, 12),
            hoursAgo(0, 12),
        ]
        expect(readDepth(values, utcOffset, now)).toEqual({ depth: 12, change: 6, measuredAt: now })
    })

    it("isn't fooled by one bad reading", () => {
        const values = [hoursAgo(2, 12), hoursAgo(1, 80), hoursAgo(0, 12)]
        expect(readDepth(values, utcOffset, now)?.depth).toBe(12)
    })

    it("treats a change of an inch as sensor noise", () => {
        const values = [hoursAgo(24, 11), hoursAgo(1, 12), hoursAgo(0, 12)]
        expect(readDepth(values, utcOffset, now)?.change).toBe(0)
    })

    it("reports settling as a negative change", () => {
        const values = [hoursAgo(24, 20), hoursAgo(1, 15), hoursAgo(0, 15)]
        expect(readDepth(values, utcOffset, now)?.change).toBe(-5)
    })

    it("shows no change when there's no reading from a day ago", () => {
        expect(readDepth([hoursAgo(1, 12), hoursAgo(0, 12)], utcOffset, now)?.change).toBe(0)
    })

    it("skips missing readings", () => {
        expect(readDepth([hoursAgo(1, 9), hoursAgo(0, null)], utcOffset, now)?.measuredAt).toBe(now - HOUR)
    })

    it("won't report a reading from a station that has stopped", () => {
        expect(readDepth([hoursAgo(13, 30)], utcOffset, now)).toBeUndefined()
    })

    it("counts bare ground as a real reading", () => {
        expect(readDepth([hoursAgo(1, 0), hoursAgo(0, 0)], utcOffset, now)?.depth).toBe(0)
    })

    it("handles a station with no depth readings", () => {
        expect(readDepth([], utcOffset, now)).toBeUndefined()
    })
})
