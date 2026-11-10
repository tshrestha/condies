import { describe, expect, it } from "vitest"

import { type AvalancheZone, findZone, readZone } from "./avalanche.ts"

const now = Date.parse("2026-11-10T12:00:00Z")

const box = (west: number, south: number, east: number, north: number) => [
    [west, south],
    [east, south],
    [east, north],
    [west, north],
    [west, south],
]

function zone(properties: Partial<AvalancheZone["properties"]> = {}, geometry?: AvalancheZone["geometry"]) {
    return {
        properties: {
            center: "Test Center",
            link: "https://example.com/forecast",
            off_season: false,
            danger_level: 3,
            travel_advice: "Be careful.",
            end_date: "2026-11-10T23:30:00",
            ...properties,
        },
        geometry: geometry ?? { type: "Polygon", coordinates: [box(-107, 39, -105, 40)] },
    } as AvalancheZone
}

describe("findZone", () => {
    it("finds a point inside a polygon", () => {
        const inside = zone()
        expect(findZone([inside], 39.5, -106)).toBe(inside)
    })

    it("is undefined outside every zone", () => {
        expect(findZone([zone()], 41, -106)).toBeUndefined()
    })

    it("checks every part of a multipolygon", () => {
        const split = zone(
            {},
            { type: "MultiPolygon", coordinates: [[box(-110, 45, -109, 46)], [box(-107, 39, -105, 40)]] },
        )
        expect(findZone([split], 39.5, -106)).toBe(split)
    })

    it("doesn't count a hole in the zone", () => {
        const ring = zone(
            {},
            { type: "Polygon", coordinates: [box(-107, 39, -105, 40), box(-106.5, 39.25, -105.5, 39.75)] },
        )
        expect(findZone([ring], 39.5, -106)).toBeUndefined()
        expect(findZone([ring], 39.1, -106)).toBe(ring)
    })

    it("picks the more dangerous of two overlapping zones", () => {
        const low = zone({ danger_level: 1 })
        const high = zone({ danger_level: 4 })
        expect(findZone([low, high], 39.5, -106)).toBe(high)
    })
})

describe("readZone", () => {
    it("reads a current rating", () => {
        expect(readZone(zone(), now)).toEqual({
            center: "Test Center",
            link: "https://example.com/forecast",
            rating: { level: 3, name: "Considerable", advice: "Be careful.", warning: undefined },
        })
    })

    it("includes a warning when one is in effect", () => {
        expect(readZone(zone({ warning: { product: "warning" } }), now)?.rating?.warning).toBe("warning")
    })

    it("drops a rating that has run out", () => {
        const status = readZone(zone({ end_date: "2026-11-10T11:00:00" }), now)
        expect(status?.center).toBe("Test Center")
        expect(status?.rating).toBeUndefined()
    })

    it("treats the end time as UTC", () => {
        expect(readZone(zone({ end_date: "2026-11-10T12:30:00" }), now)?.rating).toBeDefined()
    })

    it("won't show a rating it can't tell is current", () => {
        expect(readZone(zone({ end_date: null }), now)?.rating).toBeUndefined()
    })

    it("has no rating when the center hasn't issued one", () => {
        expect(readZone(zone({ danger_level: -1 }), now)?.rating).toBeUndefined()
    })

    it("hides zones that are out of season", () => {
        expect(readZone(zone({ off_season: true }), now)).toBeUndefined()
    })

    it("never links to anything but a web page", () => {
        const status = readZone(zone({ link: "javascript:alert(1)", center_link: "https://center.example/" }), now)
        expect(status?.link).toBe("https://center.example/")
        expect(readZone(zone({ link: "javascript:alert(1)" }), now)?.link).toBe("https://avalanche.org/")
    })
})
