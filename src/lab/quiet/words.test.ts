import { describe, expect, test } from "vitest"

import type { DaySummary } from "../../lib/daily.ts"
import { loadScenario, scenarios } from "../scenarios.ts"
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
    test.each(scenarios.map((s) => s.id))("%s: the caption's snow total is the blocks' sum", (id) => {
        const { forecast } = loadScenario(id, 14)
        const next = nextHours(forecast)
        const total = next.blocks.reduce((sum, block) => sum + block.snow, 0)
        if (total > 0) {
            expect(next.caption).toContain(`${total.toFixed(1)}″`)
        }
        expect(next.blocks.length).toBe(3)
    })
})
