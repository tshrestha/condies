import { describe, expect, test } from "vitest"

import type { DaySummary } from "./daily.ts"
import { rankSpots, type SpotView, toAlertView } from "./forecastView.ts"

describe("alerts", () => {
    test("the description splits into its labeled parts", () => {
        const alert = toAlertView({
            severity: "Severe",
            event: "Winter Storm Warning",
            headline: "headline",
            description: "* WHAT...Heavy snow.\n\n* WHERE...Wasatch\nMountains.\n\n* WHEN...Until 5 AM.",
            instruction: "Stay home.",
        })
        expect(alert.parts).toEqual([
            { label: "WHAT", text: "Heavy snow." },
            { label: "WHERE", text: "Wasatch Mountains." },
            { label: "WHEN", text: "Until 5 AM." },
        ])
    })

    test("text without markers stays as one unlabeled part", () => {
        const alert = toAlertView({
            severity: "Minor",
            event: "Frost Advisory",
            headline: "",
            description: "Frost expected tonight.",
            instruction: "",
        })
        expect(alert.parts).toEqual([{ label: "", text: "Frost expected tonight." }])
    })
})

describe("ranking spots", () => {
    const day = (date: string, score?: number) =>
        ({
            date,
            periods: [],
            condies: score === undefined ? undefined : { score, bestWindow: "" },
        }) as unknown as DaySummary
    const spot = (name: string, scores: (number | undefined)[]): SpotView => ({
        name,
        lat: 0,
        lon: 0,
        days: scores.map((s, i) => day(`2026-11-1${i}`, s)),
    })
    const spots = [spot("A", [40, 90]), spot("B", [80, 50]), spot("C", [undefined, undefined])]

    test("by each spot's best day this week, highest first, unscored last", () => {
        const ranked = rankSpots(spots)
        expect(ranked.map((s) => [s.name, s.day?.condies?.score])).toEqual([
            ["A", 90],
            ["B", 80],
            ["C", undefined],
        ])
    })

    test("a spot with no scores still shows its first day, so its row doesn't say there's no forecast", () => {
        expect(rankSpots(spots).at(-1)!.day?.date).toBe("2026-11-10")
        expect(rankSpots([{ ...spots[2], days: [] }])[0].day).toBeUndefined()
    })

    test("by a chosen date", () => {
        expect(rankSpots(spots, "2026-11-10").map((s) => s.name)).toEqual(["B", "A", "C"])
    })
})
