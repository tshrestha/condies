import type { Grid } from "../../lib/grid.ts"
import type { Period } from "../../lib/nws.ts"

export type WxKind = "thunder" | "snow" | "mix" | "rain" | "drizzle" | "shower" | "fog" | "haze" | "none"

export function wxKind(text: string): WxKind {
    const t = text.toLowerCase()
    if (/thunder|t-?storm/.test(t)) {
        return "thunder"
    }
    if (/sleet|freezing|wintry|mix/.test(t)) {
        return "mix"
    }
    if (/snow|flurr|blizzard/.test(t)) {
        return "snow"
    }
    if (/drizzle/.test(t)) {
        return "drizzle"
    }
    if (/shower/.test(t)) {
        return "shower"
    }
    if (/rain/.test(t)) {
        return "rain"
    }
    if (/fog|mist/.test(t)) {
        return "fog"
    }
    return /haze|smoke|dust/.test(t) ? "haze" : "none"
}

// The cartographer's rule: anything that falls from the sky is set in italic, as water is on a map.
export const isWater = (text: string) => !["none", "haze"].includes(wxKind(text))

// WMO present-weather figures step from one symbol to four as intensity climbs.
export function intensity(period: Period, kind = wxKind(period.shortForecast)) {
    if (kind === "none" || kind === "haze") {
        return 0
    }
    if (kind === "fog") {
        return 2
    }
    if (period.probabilityOfPrecipitation.value < 25) {
        return 0
    }
    const inches = period.snowInches ?? 0
    if (kind === "snow" && inches > 0) {
        return inches >= 1 ? 4 : inches >= 0.5 ? 3 : inches >= 0.15 ? 2 : 1
    }
    const text = period.shortForecast
    if (/heavy/i.test(text)) {
        return 4
    }
    if (/light|slight|chance/i.test(text)) {
        return 1
    }
    return /likely/i.test(text) ? 2 : 3
}

export function skyPercent(period: Period, grid?: Grid | null) {
    const measured = grid?.sky.get(Date.parse(period.startTime))
    if (measured !== undefined) {
        return measured
    }
    const text = period.shortForecast
    if (/mostly (sunny|clear)/i.test(text)) {
        return 25
    }
    if (/partly/i.test(text)) {
        return 50
    }
    if (/mostly cloudy/i.test(text)) {
        return 75
    }
    if (/sunny|clear/i.test(text)) {
        return 0
    }
    return 100
}

const bearings: Record<string, number> = {
    N: 0,
    NNE: 22.5,
    NE: 45,
    ENE: 67.5,
    E: 90,
    ESE: 112.5,
    SE: 135,
    SSE: 157.5,
    S: 180,
    SSW: 202.5,
    SW: 225,
    WSW: 247.5,
    W: 270,
    WNW: 292.5,
    NW: 315,
    NNW: 337.5,
}

export const bearingOf = (direction: string) => bearings[direction] ?? 0

export const toKnots = (mph: number) => mph * 0.868976

const round = (value: number) => Math.round(value * 100) / 100

// A real barb: the staff points into the wind, a half feather is 5 kt, a full 10, a pennant 50.
export function barbPath(x: number, y: number, bearing: number, knots: number, length = 18) {
    const radians = (bearing * Math.PI) / 180
    const ux = Math.sin(radians)
    const uy = -Math.cos(radians)
    // Feathers sit on the right of the staff looking out along it, the low-pressure side in the north.
    const rx = -uy
    const ry = ux
    const tipX = x + ux * length
    const tipY = y + uy * length
    let lines = `M${round(x)} ${round(y)}L${round(tipX)} ${round(tipY)}`
    let pennants = ""

    let remaining = Math.round(knots / 5) * 5
    let distance = 0
    const gap = length * 0.17
    const feather = length * 0.42
    const slant = feather * 0.32

    while (remaining >= 50) {
        const ax = tipX - ux * distance
        const ay = tipY - uy * distance
        const bx = ax - ux * gap * 1.4
        const by = ay - uy * gap * 1.4
        pennants += `M${round(ax)} ${round(ay)}L${round(ax + rx * feather + ux * slant)} ${round(ay + ry * feather + uy * slant)}L${round(bx)} ${round(by)}Z`
        distance += gap * 1.8
        remaining -= 50
    }
    while (remaining >= 10) {
        const ax = tipX - ux * distance
        const ay = tipY - uy * distance
        lines += `M${round(ax)} ${round(ay)}L${round(ax + rx * feather + ux * slant)} ${round(ay + ry * feather + uy * slant)}`
        distance += gap
        remaining -= 10
    }
    if (remaining >= 5) {
        // A lone half feather stands a little in from the tip, so it isn't mistaken for a full one.
        const at = distance === 0 ? gap : distance
        const ax = tipX - ux * at
        const ay = tipY - uy * at
        lines += `M${round(ax)} ${round(ay)}L${round(ax + rx * feather * 0.5 + ux * slant * 0.5)} ${round(ay + ry * feather * 0.5 + uy * slant * 0.5)}`
    }
    return { lines, pennants }
}

export interface GlyphPaths {
    lines: string
    dots: string
}

const push = (paths: GlyphPaths, more: Partial<GlyphPaths>) => {
    paths.lines += more.lines ?? ""
    paths.dots += more.dots ?? ""
}

const sixty = Math.sin(Math.PI / 3)

export function glyph(kind: WxKind, x: number, y: number, r = 3.6): GlyphPaths {
    const out: GlyphPaths = { lines: "", dots: "" }
    const dot = (cx: number, cy: number) => `M${round(cx)} ${round(cy)}h.01`
    const star = (cx: number, cy: number, s: number) =>
        `M${round(cx - s)} ${round(cy)}H${round(cx + s)}M${round(cx - s / 2)} ${round(cy - s * sixty)}L${round(cx + s / 2)} ${round(cy + s * sixty)}M${round(cx + s / 2)} ${round(cy - s * sixty)}L${round(cx - s / 2)} ${round(cy + s * sixty)}`

    switch (kind) {
        case "snow":
            push(out, { lines: star(x, y, r) })
            break
        case "rain":
            push(out, { dots: dot(x, y) })
            break
        case "drizzle":
            push(out, { lines: `M${round(x + 0.6)} ${round(y - 1.6)}q1.5 1.8-1.6 3.6`, dots: dot(x, y - 1.6) })
            break
        case "mix":
            push(out, { lines: star(x, y - r * 0.9, r * 0.82), dots: dot(x, y + r * 1.15) })
            break
        case "shower":
            push(out, {
                lines: `M${round(x - r)} ${round(y - 0.4)}H${round(x + r)}L${round(x)} ${round(y + r * 1.55)}Z`,
                dots: dot(x, y - r * 1.1),
            })
            break
        case "fog": {
            const w = r * 1.35
            push(out, {
                lines: `M${round(x - w)} ${round(y - r * 0.72)}h${round(w * 2)}M${round(x - w)} ${round(y)}h${round(w * 2)}M${round(x - w)} ${round(y + r * 0.72)}h${round(w * 2)}`,
            })
            break
        }
        case "haze":
            push(out, {
                lines: `M${round(x - r)} ${round(y)}q${round(r / 2)} ${round(-r)} ${round(r)} 0t${round(r)} 0`,
            })
            break
        case "thunder":
            push(out, {
                lines: `M${round(x - r)} ${round(y + r * 1.5)}V${round(y - r * 1.4)}H${round(x + r)}L${round(x - r * 0.1)} ${round(y)}H${round(x + r * 1.1)}L${round(x - r * 0.4)} ${round(y + r * 1.6)}m.3-2.4-.3 2.4 2.3-.8`,
            })
            break
        default:
            break
    }
    return out
}

export function mergeGlyphs(list: GlyphPaths[]): GlyphPaths {
    return { lines: list.map((g) => g.lines).join(""), dots: list.map((g) => g.dots).join("") }
}
