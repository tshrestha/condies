import { describe, expect, test } from "vitest"

import { avalancheScale, inkOn, paintTemp, rampSteps } from "./ramp.ts"

function luminance(hex: string) {
    const channel = (start: number) => {
        const v = parseInt(hex.slice(start, start + 2), 16) / 255
        return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
    }
    return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5)
}

const contrast = (a: string, b: string) => {
    const [x, y] = [luminance(a), luminance(b)]
    return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)
}

const temperatures = Array.from({ length: 33 }, (_, i) => -30 + i * 5)

describe("temperature colors", () => {
    test.each(["light", "dark"] as const)("every step's ink passes AA in the %s theme", (theme) => {
        for (const t of temperatures) {
            const { bg, ink } = paintTemp(t, theme)
            expect(contrast(bg, ink), `${t}°F`).toBeGreaterThanOrEqual(4.5)
        }
    })

    test.each(["light", "dark"] as const)("dark ink from −10°F to 105°F in the %s theme", (theme) => {
        for (let t = -10; t <= 105; t += 5) {
            expect(paintTemp(t, theme).ink, `${t}°F`).toBe("#111111")
        }
    })

    test("each 5° step is one hard color, never interpolated", () => {
        expect(paintTemp(21, "light").bg).toBe(paintTemp(24, "light").bg)
        expect(paintTemp(24, "light").bg).not.toBe(paintTemp(25, "light").bg)
    })

    // Below −15°F and from 115°F up, one color covers everything, so only the steps between are checked.
    test("neighboring steps stay distinct", () => {
        for (let t = -10; t <= 115; t += 5) {
            expect(paintTemp(t, "light").bg, `${t}°F`).not.toBe(paintTemp(t - 5, "light").bg)
        }
    })

    test("inkOn picks white only where dark ink fails", () => {
        expect(inkOn("#ffffff")).toBe("#111111")
        expect(inkOn("#53347e")).toBe("#ffffff")
    })
})

describe("range bar steps", () => {
    test("cover low to high with no gaps, breaking on 5° boundaries", () => {
        const steps = rampSteps(12, 31, "light")
        expect(steps[0].from).toBe(12)
        expect(steps.at(-1)!.to).toBe(31)
        for (const [i, step] of steps.entries()) {
            if (i > 0) {
                expect(step.from).toBe(steps[i - 1].to)
            }
            if (i < steps.length - 1) {
                expect(step.to % 5).toBe(0)
            }
        }
    })

    test("a day with no range has no steps", () => {
        expect(rampSteps(20, 20, "light")).toEqual([])
    })
})

test("avalanche danger keeps the North American scale's colors exactly", () => {
    expect(avalancheScale).toEqual({
        1: { bg: "#50b848", ink: "#000" },
        2: { bg: "#fff200", ink: "#000" },
        3: { bg: "#f7941e", ink: "#000" },
        4: { bg: "#ed1c24", ink: "#000" },
        5: { bg: "#231f20", ink: "#fff" },
    })
})
