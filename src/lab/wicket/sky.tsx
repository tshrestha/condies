import type { DaySummary } from "../../lib/daily.ts"
import type { Period } from "../../lib/nws.ts"

export type SkyKind = "clear" | "night" | "partly" | "cloud" | "rain" | "snow" | "storm" | "fog" | "heat"

// What gets printed on a ticket: the kind of sky and how much of it, 0 to 1.
export interface SkyPrint {
    kind: SkyKind
    level: number
}

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max)

// A forecast like "Partly Sunny then Chance Showers" prints its worst weather.
function classify(
    text: string,
    isDay: boolean,
    temperature: number | undefined,
    chance: number,
    snow: number,
): SkyPrint {
    const t = text.toLowerCase()
    const first = t.split(" then ")[0]
    if (/thunder|t-?storm/.test(t)) {
        return { kind: "storm", level: clamp(chance / 100, 0.4, 1) }
    }
    if (/snow|flurr|blizzard|sleet|wintry/.test(t)) {
        const worded = /heavy|blizzard/.test(t) ? 1 : /light|flurr|chance/.test(t) ? 0.35 : 0.6
        return { kind: "snow", level: clamp(Math.max(worded, snow / 8), 0.2, 1) }
    }
    if (/rain|shower|drizzle/.test(t)) {
        const worded = /heavy/.test(t)
            ? 1
            : /light|drizzle|slight/.test(t)
              ? 0.35
              : /chance|likely/.test(t)
                ? 0.55
                : 0.75
        return { kind: "rain", level: clamp(Math.max(worded, chance >= 95 ? 0.8 : 0), 0.25, 1) }
    }
    if (/fog|mist|smoke/.test(t)) {
        return { kind: "fog", level: 0.8 }
    }
    if ((temperature ?? 0) >= 90) {
        return { kind: "heat", level: clamp(((temperature ?? 90) - 88) / 20, 0.35, 1) }
    }
    if (/haze|dust/.test(t)) {
        return { kind: "fog", level: 0.45 }
    }
    if (/partly/.test(first)) {
        return { kind: "partly", level: 0.6 }
    }
    if (/mostly cloudy/.test(first)) {
        return { kind: "cloud", level: 0.65 }
    }
    if (/cloudy|overcast/.test(first)) {
        return { kind: "cloud", level: 1 }
    }
    if (!isDay) {
        return { kind: "night", level: 1 }
    }
    return { kind: "clear", level: /mostly/.test(first) ? 0.7 : 1 }
}

// Inches per hour are scaled up to read against the same range as a day's total.
export const skyNow = (period: Period) =>
    classify(
        period.shortForecast,
        period.isDaytime,
        period.temperature,
        period.probabilityOfPrecipitation.value,
        (period.snowInches ?? 0) * 6,
    )

export const skyDay = (day: DaySummary) =>
    classify(
        day.day?.shortForecast ?? day.night?.shortForecast ?? "",
        !!day.day,
        day.high ?? day.low,
        day.precipChance,
        day.snow ?? 0,
    )

const INK = "var(--ink)"
const STOCK = "var(--stock)"
const n = (value: number) => value.toFixed(1)
const flood = (w: number, h: number, fill: string) => `<rect width="${w}" height="${h}" fill="${fill}"/>`

function halftone(w: number, h: number, level: number, pitch: number) {
    const rowHeight = pitch * 0.866
    let d = ""
    let row = 0
    for (let y = rowHeight / 2; y < h + rowHeight; y += rowHeight, row++) {
        // Dots grow toward the bottom of the ticket, the way snow piles up.
        const r = pitch * (0.08 + level * 0.46 * (0.2 + 0.8 * (y / h)))
        for (let x = row % 2 ? pitch / 2 : 0; x <= w + pitch; x += pitch) {
            d += `M${n(x - r)} ${n(y)}a${n(r)} ${n(r)} 0 1 0 ${n(2 * r)} 0a${n(r)} ${n(r)} 0 1 0 ${n(-2 * r)} 0z`
        }
    }
    return `<path d="${d}" fill="${INK}"/>`
}

function slashes(w: number, h: number, level: number, pitch: number, fill: string) {
    const length = pitch * (1.3 + level * 1.2)
    const thick = pitch * (0.18 + level * 0.16)
    const lean = length * 0.36
    let d = ""
    let row = 0
    for (let y = -length; y < h + length; y += length * 1.28, row++) {
        for (let x = (row % 2 ? pitch / 2 : 0) - lean; x < w + pitch + lean; x += pitch) {
            d += `M${n(x)} ${n(y)}h${n(thick)}l${n(-lean)} ${n(length)}h${n(-thick)}z`
        }
    }
    return `<path d="${d}" fill="${fill}"/>`
}

function sun(cx: number, cy: number, r: number, count: number, spread: number, reach: number) {
    let d = ""
    const half = (Math.PI / count) * spread
    for (let i = 0; i < count; i++) {
        const angle = (i / count) * 2 * Math.PI + 0.13
        d += `M${n(cx)} ${n(cy)}L${n(cx + reach * Math.cos(angle - half))} ${n(cy + reach * Math.sin(angle - half))}L${n(cx + reach * Math.cos(angle + half))} ${n(cy + reach * Math.sin(angle + half))}z`
    }
    return `<path d="${d}" fill="${INK}"/><circle cx="${n(cx)}" cy="${n(cy)}" r="${n(r * 1.28)}" fill="${STOCK}"/><circle cx="${n(cx)}" cy="${n(cy)}" r="${n(r)}" fill="${INK}"/>`
}

function cloud(x: number, y: number, size: number) {
    const shapes = (fill: string, grow: number) =>
        `<rect x="${n(x - grow)}" y="${n(y - size * 0.34 - grow)}" width="${n(size * 1.9 + 2 * grow)}" height="${n(size * 0.34 + 2 * grow)}" rx="${n(size * 0.17)}" fill="${fill}"/>`
        + [
            [0.42, -0.5, 0.34],
            [0.95, -0.62, 0.48],
            [1.46, -0.42, 0.3],
        ]
            .map(
                ([cx, cy, r]) =>
                    `<circle cx="${n(x + cx * size)}" cy="${n(y + cy * size)}" r="${n(r * size + grow)}" fill="${fill}"/>`,
            )
            .join("")
    return shapes(STOCK, size * 0.08) + shapes(INK, 0)
}

function deck(w: number, h: number, level: number) {
    const rows = level > 0.8 ? 4 : 3
    const lobe = w / (rows === 4 ? 7 : 6)
    let markup = ""
    for (let row = 0; row < rows; row++) {
        const y = h * (0.1 + (row / rows) * 0.92)
        const lobes = Array.from({ length: Math.ceil(w / lobe) + 2 }, (_, i) => {
            const x = (i - 0.5) * lobe + (row % 2 ? lobe / 2 : 0)
            const r = lobe * (0.62 + 0.14 * Math.sin(i * 2.4 + row))
            return [x, r] as const
        })
        const shape = (fill: string, grow: number) =>
            `<rect x="-2" y="${n(y)}" width="${w + 4}" height="${n(h - y + 2)}" fill="${fill}"/>`
            + lobes.map(([x, r]) => `<circle cx="${n(x)}" cy="${n(y)}" r="${n(r + grow)}" fill="${fill}"/>`).join("")
        markup += shape(STOCK, lobe * 0.08) + shape(INK, 0)
    }
    return markup
}

function bolts(w: number, h: number) {
    const scale = Math.min(w / 400, h / 200)
    const bolt = (x: number, size: number) =>
        `<path transform="translate(${n(x)} ${n(-4 * scale)}) scale(${n(size)})" d="M56 -8 2 92h44L16 208 128 70H78L116 -8z" fill="${STOCK}"/>`
    // Kept to the right of the ticket, where the big number doesn't cover them.
    return bolt(w > 100 ? w * 0.58 : w * 0.04, scale * (w > 100 ? 1.05 : 1.2))
}

function fog(w: number, h: number, level: number, pitch: number) {
    let seed = 17
    const random = () => (seed = (seed * 9301 + 49297) % 233280) / 233280
    let d = ""
    for (let y = pitch * 0.5; y < h; y += pitch) {
        const thick = pitch * (0.14 + 0.56 * level * (y / h))
        // Each bank breaks in its own places, so the gaps never line up into a column.
        let x = -random() * w * 0.3
        while (x < w) {
            const length = w * (0.22 + random() * 0.5)
            d += `M${n(x)} ${n(y)}h${n(length)}v${n(thick)}h${n(-length)}z`
            x += length + pitch * (0.8 + random() * 1.6)
        }
    }
    return `<path d="${d}" fill="${INK}"/>`
}

function waves(w: number, h: number, level: number, pitch: number) {
    const bands = Math.round(2 + level * 3)
    let markup = ""
    for (let band = bands; band >= 0; band--) {
        const baseline = h - band * pitch * 0.72
        const amplitude = pitch * 0.2
        const wavelength = pitch * 2.6
        let d = `M-2 ${n(h + 2)}L-2 ${n(baseline)}`
        for (let x = -2; x <= w + 6; x += 4) {
            d += `L${x} ${n(baseline + amplitude * Math.sin((x / wavelength) * 2 * Math.PI + band))}`
        }
        d += `L${w + 6} ${n(h + 2)}z`
        markup += `<path d="${d}" fill="${band % 2 ? STOCK : INK}"/>`
    }
    return markup
}

function stars(w: number, h: number, pitch: number) {
    let seed = 41
    const random = () => (seed = (seed * 9301 + 49297) % 233280) / 233280
    let d = ""
    const count = Math.round((w * h) / (pitch * pitch * 3.2))
    for (let i = 0; i < count; i++) {
        const x = random() * w
        const y = random() * h
        const size = pitch * (0.12 + random() * 0.3)
        d += `M${n(x)} ${n(y - size)}L${n(x + size * 0.28)} ${n(y - size * 0.28)}L${n(x + size)} ${n(y)}L${n(x + size * 0.28)} ${n(y + size * 0.28)}L${n(x)} ${n(y + size)}L${n(x - size * 0.28)} ${n(y + size * 0.28)}L${n(x - size)} ${n(y)}L${n(x - size * 0.28)} ${n(y - size * 0.28)}z`
    }
    const r = Math.min(w, h) * 0.26
    return `<path d="${d}" fill="${STOCK}"/><circle cx="${n(w * 0.74)}" cy="${n(h * 0.34)}" r="${n(r)}" fill="${STOCK}"/><circle cx="${n(w * 0.74 + r * 0.42)}" cy="${n(h * 0.34 - r * 0.2)}" r="${n(r * 0.86)}" fill="${INK}"/>`
}

function draw({ kind, level }: SkyPrint, w: number, h: number) {
    const unit = Math.min(w, h)
    const pitch = unit * (w > 100 ? 0.09 : 0.2)
    const reach = Math.hypot(w, h)
    switch (kind) {
        case "snow":
            return halftone(w, h, level, pitch)
        case "rain":
            return slashes(w, h, level, pitch, INK)
        case "storm":
            return flood(w, h, INK) + slashes(w, h, Math.min(level, 0.7), pitch * 1.2, STOCK) + bolts(w, h)
        case "fog":
            return fog(w, h, level, pitch * 1.25)
        case "heat":
            return sun(w * 0.74, h * 0.38, unit * 0.27, 16, 0.5, reach) + waves(w, h, level, pitch * 1.25)
        case "night":
            return flood(w, h, INK) + stars(w, h, pitch)
        case "partly":
            return (
                sun(w * 0.76, h * 0.3, unit * 0.2, 14, 0.5, reach)
                + cloud(w > 100 ? w * 0.42 : w * 0.02, h * 0.98, unit * 0.46)
            )
        case "cloud":
            return deck(w, h, level)
        default:
            return (
                sun(w * 0.7, h * 0.45, unit * 0.24, level > 0.8 ? 14 : 12, level > 0.8 ? 0.56 : 0.42, reach)
                + (level > 0.8 ? "" : cloud(w > 100 ? w * 0.44 : w * 0.02, h * 1.02, unit * 0.4))
            )
    }
}

// The weather, printed in the ticket's ink. Field for the big ticket face, stub for the small one.
export function Sky(props: { print: SkyPrint; size: "field" | "stub" }) {
    const w = () => (props.size === "field" ? 400 : 60)
    const h = () => (props.size === "field" ? 220 : 110)
    return (
        <svg
            class="wk-sky"
            viewBox={`0 0 ${w()} ${h()}`}
            preserveAspectRatio="xMidYMid slice"
            aria-hidden="true"
            innerHTML={draw(props.print, w(), h())}
        />
    )
}
