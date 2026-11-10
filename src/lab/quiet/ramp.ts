// Color means temperature. Every chromatic color on screen comes from this table or the avalanche scale.
// Designed as OKLCH stops and fixed to sRGB, so that contrast is exact and every screen agrees.

export type Theme = "light" | "dark"

export interface Paint {
    bg: string
    ink: string
}

interface Step {
    from: number
    light: string
    dark: string
}

// One color per 5°F, absolute: the same temperature is the same color on every screen, every day. These are
// paint-chip tints that carry dark ink from −10°F to 105°F. Cold runs violet, ice and glacier into teal; warm
// runs citron, apricot and coral into rose. Lightness rises and falls by step so that neighbors stay distinct.
// The dark column keeps each hue at lower lightness, still with dark ink, so it is calm in a dark room.
const ramp: Step[] = [
    { from: -Infinity, light: "#53347e", dark: "#472c6c" },
    { from: -15, light: "#724ea0", dark: "#5f4087" },
    { from: -10, light: "#9274c3", dark: "#9076bd" },
    { from: -5, light: "#a091dd", dark: "#8478ba" },
    { from: 0, light: "#a7aaec", dark: "#7e80b9" },
    { from: 5, light: "#b0c2f9", dark: "#8190bf" },
    { from: 10, light: "#88b0e7", dark: "#6385b3" },
    { from: 15, light: "#99cbf1", dark: "#6a95b5" },
    { from: 20, light: "#79bfe0", dark: "#528fac" },
    { from: 25, light: "#99daeb", dark: "#679fae" },
    { from: 30, light: "#74cbd4", dark: "#4a979f" },
    { from: 35, light: "#93e5e4", dark: "#62aaa9" },
    { from: 40, light: "#71d2c2", dark: "#479d90" },
    { from: 45, light: "#6dc1a2", dark: "#469176" },
    { from: 50, light: "#86db9d", dark: "#559f6b" },
    { from: 55, light: "#a9e686", dark: "#72a654" },
    { from: 60, light: "#d1ed6a", dark: "#93ab34" },
    { from: 65, light: "#f4ea68", dark: "#b2a932" },
    { from: 70, light: "#faca4b", dark: "#be951a" },
    { from: 75, light: "#fcaf41", dark: "#c48218" },
    { from: 80, light: "#fa9947", dark: "#c87429" },
    { from: 85, light: "#f8834a", dark: "#ce6836" },
    { from: 90, light: "#f26c52", dark: "#d56049" },
    { from: 95, light: "#ec5b5c", dark: "#d65656" },
    { from: 100, light: "#e3496f", dark: "#d8506e" },
    { from: 105, light: "#db509c", dark: "#ce5294" },
    { from: 110, light: "#a02d47", dark: "#8d293e" },
    { from: 115, light: "#67282d", dark: "#5b2428" },
]

const INK = "#111111"

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

// Dark ink wherever it passes AA, which is everywhere but the two deepest steps at each end.
export const inkOn = (hex: string) => (contrast(hex, INK) >= 4.5 ? INK : "#ffffff")

const stepFor = (t: number) => ramp.reduce((found, s) => (t >= s.from ? s : found), ramp[0])

export function paintTemp(t: number, theme: Theme): Paint {
    const step = stepFor(t)
    const bg = theme === "dark" ? step.dark : step.light
    return { bg, ink: inkOn(bg) }
}

// Spans of time with no temperature of their own borrow the nearest one.
export const paintDay = (day: { high?: number; low?: number }, theme: Theme) =>
    paintTemp(day.high ?? day.low ?? 50, theme)

// The ramp's own 5° steps between two temperatures, as hard segments for a range bar.
export function rampSteps(low: number, high: number, theme: Theme) {
    const steps: { from: number; to: number; bg: string }[] = []
    for (let t = low; t < high;) {
        const next = Math.min(high, Math.floor(t / 5) * 5 + 5)
        steps.push({ from: t, to: next, bg: paintTemp(t, theme).bg })
        t = next
    }
    return steps
}

// The North American avalanche danger scale. A safety standard: never retune these.
export const avalancheScale: Record<number, Paint> = {
    1: { bg: "#50b848", ink: "#000" },
    2: { bg: "#fff200", ink: "#000" },
    3: { bg: "#f7941e", ink: "#000" },
    4: { bg: "#ed1c24", ink: "#000" },
    5: { bg: "#231f20", ink: "#fff" },
}

export const paintVars = (paint: Paint) => ({ "--b": paint.bg, "--k": paint.ink })

// Loading has no temperature yet, so it walks the ramp from cold to hot.
export const rampWalk = (theme: Theme) => [10, 25, 40, 55, 70, 85].map((t) => paintTemp(t, theme).bg)
