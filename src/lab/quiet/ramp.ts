// Color means temperature. Every chromatic color on screen comes from this table or the avalanche scale.
// The steps are Strata's hand-tuned ramp: OKLCH stops fixed to sRGB so that contrast is exact.

export type Theme = "light" | "dark"

export interface Paint {
    bg: string
    ink: "#000" | "#fff"
}

interface Step {
    from: number
    light: string
    dark: string
}

// One color per 5°F, absolute: the same temperature is the same color on every screen, every day. The dark
// column keeps each hue and lowers its lightness, so a full-width band is comfortable in a dark room.
const ramp: Step[] = [
    { from: -Infinity, light: "#1d0736", dark: "#18042f" },
    { from: -15, light: "#2e0056", dark: "#27004a" },
    { from: -10, light: "#3d0070", dark: "#340061" },
    { from: -5, light: "#4e00a5", dark: "#43008f" },
    { from: 0, light: "#3300a7", dark: "#2b0091" },
    { from: 5, light: "#1701ce", dark: "#1300b3" },
    { from: 10, light: "#0046c9", dark: "#00277d" },
    { from: 15, light: "#0268d0", dark: "#003e81" },
    { from: 20, light: "#048ed8", dark: "#005686" },
    { from: 25, light: "#1bb1de", dark: "#036d8a" },
    { from: 30, light: "#70dae9", dark: "#338894" },
    { from: 35, light: "#87f7ea", dark: "#429b92" },
    { from: 40, light: "#03ccbe", dark: "#057d74" },
    { from: 45, light: "#08745d", dark: "#004636" },
    { from: 50, light: "#08a467", dark: "#02643d" },
    { from: 55, light: "#6bd330", dark: "#398400" },
    { from: 60, light: "#baee0b", dark: "#729302" },
    { from: 65, light: "#faec25", dark: "#b4a903" },
    { from: 70, light: "#ffc41d", dark: "#b78c07" },
    { from: 75, light: "#fea408", dark: "#b77400" },
    { from: 80, light: "#fb7c05", dark: "#b45700" },
    { from: 85, light: "#f64f04", dark: "#992d00" },
    { from: 90, light: "#ee1401", dark: "#940500" },
    { from: 95, light: "#dd0029", dark: "#880015" },
    { from: 100, light: "#c30353", dark: "#780030" },
    { from: 105, light: "#c90084", dark: "#7b004f" },
    { from: 110, light: "#75051f", dark: "#670018" },
    { from: 115, light: "#3a0a10", dark: "#32060c" },
]

function luminance(hex: string) {
    const channel = (start: number) => {
        const v = parseInt(hex.slice(start, start + 2), 16) / 255
        return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
    }
    return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5)
}

const contrast = (a: number, b: number) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)

// Black or white, whichever reads better. Every step passes 4.5:1 this way.
export function inkOn(hex: string): Paint["ink"] {
    const y = luminance(hex)
    return contrast(y, 0) >= contrast(y, 1) ? "#000" : "#fff"
}

export function paintTemp(t: number, theme: Theme): Paint {
    const step = ramp.reduce((found, s) => (t >= s.from ? s : found), ramp[0])
    const bg = theme === "dark" ? step.dark : step.light
    return { bg, ink: inkOn(bg) }
}

// Spans of time with no temperature of their own borrow the nearest one.
export const paintDay = (day: { high?: number; low?: number }, theme: Theme) =>
    paintTemp(day.high ?? day.low ?? 50, theme)

// Extreme and Severe warnings, in both themes. No temperature is ever pure black, so a warning stands out on
// any day's color. CSS frames it in white so it also stands out on the dark theme's black ground.
export const alertBand: Paint = { bg: "#000", ink: "#fff" }

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
