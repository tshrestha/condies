// Weather as a flat print texture rather than an icon. Density encodes intensity.

export type TextureKind = "snow" | "rain" | "thunder" | "fog"

export interface Texture {
    kind: TextureKind
    level: 1 | 2 | 3
    image: string
    zigzag: boolean
}

const tile = (width: number, height: number, body: string) =>
    `url("data:image/svg+xml,${encodeURIComponent(
        `<svg xmlns='http://www.w3.org/2000/svg' width='${width}' height='${height}'>${body}</svg>`,
    )}")`

// A repeatable pseudo-random sequence, so a stipple never shimmers between renders.
function random(seed: number) {
    return () => {
        seed = (seed + 0x6d2b79f5) | 0
        let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }
}

// A jittered grid, which reads as hand-worked stipple without the clumps of pure randomness.
function stipple(cell: number, size: number, seed: number) {
    const span = 132
    const next = random(seed)
    let rects = ""
    for (let y = 0; y < span; y += cell) {
        for (let x = 0; x < span; x += cell) {
            const px = (x + next() * (cell - size)).toFixed(1)
            const py = (y + next() * (cell - size)).toFixed(1)
            rects += `<rect x='${px}' y='${py}' width='${size}' height='${size}'/>`
        }
    }
    return tile(span, span, `<g fill='#000' shape-rendering='crispEdges'>${rects}</g>`)
}

function hatch(gap: number) {
    const a = gap / 2
    return tile(
        gap,
        gap,
        `<path d='M-${a} ${a}L${a} -${a}M0 ${gap}L${gap} 0M${gap - a} ${gap + a}L${gap + a} ${gap - a}' stroke='#000' stroke-width='0.8'/>`,
    )
}

const lineScreen = (gap: number) =>
    tile(8, gap, `<rect x='0' y='0' width='8' height='1' fill='#000' shape-rendering='crispEdges'/>`)

const patterns: Record<TextureKind, Record<1 | 2 | 3, string>> = {
    snow: { 1: stipple(11, 2, 7), 2: stipple(7, 2, 19), 3: stipple(4.5, 2, 41) },
    rain: { 1: hatch(13), 2: hatch(9), 3: hatch(6) },
    // Thunder is rain's hatch doubled up. Its zig-zag edge is what sets it apart.
    thunder: { 1: hatch(10), 2: hatch(7), 3: hatch(4.5) },
    fog: { 1: lineScreen(9), 2: lineScreen(6), 3: lineScreen(4) },
}

export function textureFor(shortForecast: string, snowInches = 0): Texture | undefined {
    const text = shortForecast.toLowerCase()
    const tentative = /slight|chance|isolated|scattered/.test(text)
    const build = (kind: TextureKind, level: 1 | 2 | 3): Texture => ({
        kind,
        level,
        image: patterns[kind][level],
        zigzag: kind === "thunder",
    })

    if (/thunder|t-storm|tstorm/.test(text)) {
        return build("thunder", tentative ? 1 : /likely/.test(text) ? 2 : 3)
    }
    if (/snow|flurr|sleet|blizzard|wintry|ice/.test(text)) {
        const level = snowInches >= 0.6 || /heavy|blizzard/.test(text) ? 3 : snowInches >= 0.15 ? 2 : 1
        return build("snow", tentative ? 1 : level)
    }
    if (/rain|shower|drizzle/.test(text)) {
        return build("rain", tentative || /drizzle|light/.test(text) ? 1 : /likely/.test(text) ? 2 : 3)
    }
    if (/fog|haze|smoke|mist/.test(text)) {
        return build("fog", /patchy|areas/.test(text) ? 1 : /haze|mist/.test(text) ? 2 : 3)
    }
    return undefined
}
