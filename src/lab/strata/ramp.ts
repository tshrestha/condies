// The ramp is the brand. Every color in the interface that is not the ground comes from these tables.
// Designed as OKLCH stops, then fixed to sRGB by hand so that contrast is exact and every screen agrees.

export type Theme = "light" | "dark"

export interface Paint {
    bg: string
    ink: "#000" | "#fff"
}

interface Step {
    from: number
    name: string
    light: string
    dark: string
}

// Hard steps every 5°F. Absolute: the same temperature is the same color on every screen, every day.
// Lightness makes a second hump around 35° and falls fast through 45° so a dull 44–52° week still changes.
// The dark column is the same hue printed about 30% darker, comfortable as a full-screen flood at night.
export const temperatureRamp: Step[] = [
    { from: -Infinity, name: "Abyss", light: "#1d0736", dark: "#18042f" },
    { from: -15, name: "Aubergine", light: "#2e0056", dark: "#27004a" },
    { from: -10, name: "Tyrian", light: "#3d0070", dark: "#340061" },
    { from: -5, name: "Violet", light: "#4e00a5", dark: "#43008f" },
    { from: 0, name: "Indigo", light: "#3300a7", dark: "#2b0091" },
    { from: 5, name: "Ultramarine", light: "#1701ce", dark: "#1300b3" },
    { from: 10, name: "Smalt", light: "#0046c9", dark: "#00277d" },
    { from: 15, name: "Cobalt", light: "#0268d0", dark: "#003e81" },
    { from: 20, name: "Cerulean", light: "#048ed8", dark: "#005686" },
    { from: 25, name: "Azure", light: "#1bb1de", dark: "#036d8a" },
    { from: 30, name: "Glacier", light: "#70dae9", dark: "#338894" },
    { from: 35, name: "Meltwater", light: "#87f7ea", dark: "#429b92" },
    { from: 40, name: "Lagoon", light: "#03ccbe", dark: "#057d74" },
    { from: 45, name: "Spruce", light: "#08745d", dark: "#004636" },
    { from: 50, name: "Jade", light: "#08a467", dark: "#02643d" },
    { from: 55, name: "Fern", light: "#6bd330", dark: "#398400" },
    { from: 60, name: "Chartreuse", light: "#baee0b", dark: "#729302" },
    { from: 65, name: "Citron", light: "#faec25", dark: "#b4a903" },
    { from: 70, name: "Saffron", light: "#ffc41d", dark: "#b78c07" },
    { from: 75, name: "Marigold", light: "#fea408", dark: "#b77400" },
    { from: 80, name: "Tangerine", light: "#fb7c05", dark: "#b45700" },
    { from: 85, name: "Persimmon", light: "#f64f04", dark: "#992d00" },
    { from: 90, name: "Vermilion", light: "#ee1401", dark: "#940500" },
    { from: 95, name: "Scarlet", light: "#dd0029", dark: "#880015" },
    { from: 100, name: "Crimson", light: "#c30353", dark: "#780030" },
    { from: 105, name: "Magenta", light: "#c90084", dark: "#7b004f" },
    { from: 110, name: "Oxblood", light: "#75051f", dark: "#670018" },
    { from: 115, name: "Char", light: "#3a0a10", dark: "#32060c" },
]

// Color means temperature and nothing else. Every other value prints in neutral graphite, one ink at several
// densities, so it can never be read against the ramp. Index 0 is the least ink.
const graphiteOnPaper = ["#f2f2f2", "#dedede", "#c2c2c2", "#9e9e9e", "#6f6f6f", "#404040", "#1a1a1a"]
const graphiteOnBlack = ["#161616", "#242424", "#343434", "#4a4a4a", "#6a6a6a", "#8a8a8a", "#a8a8a8"]

interface Plate {
    from: number
    density: number
}

const precipPlate: Plate[] = [
    { from: 0, density: 0 },
    { from: 10, density: 1 },
    { from: 30, density: 2 },
    { from: 50, density: 3 },
    { from: 70, density: 5 },
    { from: 90, density: 6 },
]

// In mph.
const windPlate: Plate[] = [
    { from: 0, density: 0 },
    { from: 5, density: 1 },
    { from: 10, density: 2 },
    { from: 15, density: 3 },
    { from: 20, density: 4 },
    { from: 30, density: 5 },
    { from: 40, density: 6 },
]

// In inches per hour.
const snowPlate: Plate[] = [
    { from: 0, density: 0 },
    { from: 0.05, density: 1 },
    { from: 0.2, density: 2 },
    { from: 0.5, density: 3 },
    { from: 1, density: 5 },
    { from: 2, density: 6 },
]

function luminance(hex: string) {
    const channel = (start: number) => {
        const v = parseInt(hex.slice(start, start + 2), 16) / 255
        return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
    }
    return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5)
}

const contrast = (a: number, b: number) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)

const inkCache = new Map<string, Paint["ink"]>()

// Black or white, whichever reads better. Every step passes 4.5:1 this way, so no text needs rescuing.
export function inkOn(hex: string): Paint["ink"] {
    let ink = inkCache.get(hex)
    if (!ink) {
        const y = luminance(hex)
        ink = contrast(y, 0) >= contrast(y, 1) ? "#000" : "#fff"
        inkCache.set(hex, ink)
    }
    return ink
}

const stepFor = (t: number) =>
    temperatureRamp.reduce((found, step) => (t >= step.from ? step : found), temperatureRamp[0])

export function paintTemp(t: number, theme: Theme): Paint {
    const step = stepFor(t)
    const bg = theme === "dark" ? step.dark : step.light
    return { bg, ink: inkOn(bg) }
}

const densityOf = (plate: Plate[], value: number) =>
    plate.reduce((found, s) => (value >= s.from ? s : found), plate[0]).density

function graphite(density: number, theme: Theme): Paint {
    const bg = (theme === "dark" ? graphiteOnBlack : graphiteOnPaper)[density]
    return { bg, ink: inkOn(bg) }
}

export const paintPrecip = (chance: number, theme: Theme) => graphite(densityOf(precipPlate, chance), theme)
export const paintWind = (mph: number, theme: Theme) => graphite(densityOf(windPlate, mph), theme)

// Reversed on paper: more snow clears toward white. On black, more snow is simply lighter.
export function paintSnow(inchesPerHour: number, theme: Theme) {
    const density = densityOf(snowPlate, inchesPerHour)
    return graphite(theme === "dark" ? density : 6 - density, theme)
}

export const paintVars = (paint: Paint) => ({ "--b": paint.bg, "--k": paint.ink })

// The white of snow only reads on a darker band. Pale bands print it in blue, since black looks like soot.
export const stippleColor = (paint: Paint) => (luminance(paint.bg) < 0.52 ? "#fff" : "#0b4fbe")

// The North American avalanche danger scale. These are a safety standard and must not be retuned.
export const avalancheScale: Record<number, Paint> = {
    1: { bg: "#50b848", ink: "#000" },
    2: { bg: "#fff200", ink: "#000" },
    3: { bg: "#f7941e", ink: "#000" },
    4: { bg: "#ed1c24", ink: "#000" },
    5: { bg: "#231f20", ink: "#fff" },
}
