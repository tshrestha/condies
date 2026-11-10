import { blur2, contours, interpolateLab, scaleLinear } from "d3"

import type { DaySummary } from "../../lib/daily.ts"
import type { Period } from "../../lib/nws.ts"

export type Theme = "light" | "dark"

// One set of printed inks. Stops are degrees F, so a temperature is the same color on every sheet.
const stops = [-20, -5, 10, 20, 28, 32, 38, 44, 50, 56, 62, 68, 74, 82, 90, 98, 106, 115]

const inks: Record<Theme, { tints: string[]; lit: string; shade: string; cast: string; index: string; glow: number }> =
    {
        light: {
            tints: [
                "#33478f",
                "#3f66ad",
                "#5a8ec9",
                "#7fb2d7",
                "#a8d0e3",
                "#cde6e8",
                "#b4d6cc",
                "#84c2b6",
                "#5fa98f",
                "#79ab78",
                "#9fb96f",
                "#c5c574",
                "#dfc469",
                "#dfa251",
                "#d47b41",
                "#bd5633",
                "#97372c",
                "#6c2327",
            ],
            lit: "#ffffff",
            shade: "#0a2a33",
            cast: "rgba(8, 36, 60, 0.34)",
            index: "#0b2a52",
            glow: 0,
        },
        dark: {
            tints: [
                "#121b45",
                "#162a5a",
                "#1a3d70",
                "#205581",
                "#29698a",
                "#37808f",
                "#2b7972",
                "#22695a",
                "#1d5945",
                "#2b5f3b",
                "#4b6b34",
                "#6b7232",
                "#886f2b",
                "#965929",
                "#954329",
                "#892f2a",
                "#6d2026",
                "#4e1620",
            ],
            lit: "#d8fff1",
            shade: "#000d0c",
            cast: "rgba(0, 8, 8, 0.55)",
            index: "#f2fbff",
            glow: 0.22,
        },
    }

const scales: Partial<Record<Theme, (value: number) => string>> = {}

export function tint(value: number, theme: Theme) {
    const scale = (scales[theme] ??= scaleLinear<string>()
        .domain(stops)
        .range(inks[theme].tints)
        .interpolate(interpolateLab)
        .clamp(true))
    return scale(value)
}

export const FREEZING = 32
const HOURS = 24

export interface Spot {
    hour: number
    value: number
}

export interface SheetRow {
    date: string
    cells: (Period | undefined)[]
    high?: Spot
    low?: Spot
}

export interface Sheet {
    rows: SheetRow[]
    field: number[][]
    min: number
    max: number
    interval: number
    levels: number[]
}

const localHour = (period: Period) => Number(period.startTime.slice(11, 13))
const localDate = (period: Period) => period.startTime.slice(0, 10)

// A plateau of equal readings is marked at its middle, which is where a surveyor would put the number.
function extreme(cells: (Period | undefined)[], better: (a: number, b: number) => boolean): Spot | undefined {
    let best: number | undefined
    let run: number[] = []
    cells.forEach((cell, hour) => {
        if (!cell) {
            return
        }
        if (best === undefined || better(cell.temperature, best)) {
            best = cell.temperature
            run = [hour]
        } else if (cell.temperature === best) {
            run.push(hour)
        }
    })
    return best === undefined ? undefined : { hour: run[Math.floor(run.length / 2)], value: best }
}

function spotsFor(cells: (Period | undefined)[]) {
    const known = cells.flatMap((cell, hour) => (cell ? [hour] : []))
    if (known.length < 6) {
        return {}
    }
    const high = extreme(cells, (a, b) => a > b)
    const low = extreme(cells, (a, b) => a < b)
    const lastKnown = known[known.length - 1]
    // A partial row still falling at its end hasn't reached its low yet. That low is on the next row.
    const lowIsReal = known.length === HOURS || low!.hour < lastKnown - 1
    return { high, low: low!.value !== high!.value && lowIsReal ? low : undefined }
}

// The range sets the interval so a dull week still has terrain to draw.
function intervalFor(range: number) {
    return range >= 38 ? 5 : range >= 18 ? 2 : 1
}

function levelsFor(min: number, max: number, interval: number) {
    const levels: number[] = []
    for (let level = Math.ceil(min / interval) * interval; level <= max; level += interval) {
        levels.push(level)
    }
    if (min < FREEZING && max > FREEZING && !levels.includes(FREEZING)) {
        levels.push(FREEZING)
        levels.sort((a, b) => a - b)
    }
    return levels
}

export function buildSheet(days: DaySummary[], hours: Period[]): Sheet {
    const rows = days.map(({ date }) => {
        const cells = Array.from<Period | undefined>({ length: HOURS })
        for (const period of hours) {
            if (localDate(period) === date) {
                cells[localHour(period)] = period
            }
        }
        return { date, cells, ...spotsFor(cells) }
    })

    const raw = rows.map(({ cells }) => cells.map((cell) => cell?.temperature ?? Number.NaN))

    // Gaps borrow the shape of the nearest surveyed row, level with this row. The hatch covers them.
    const field = raw.map((row, r) => {
        const donor = [...raw.keys()]
            .sort((a, b) => Math.abs(a - r) - Math.abs(b - r))
            .find(
                (other) =>
                    other !== r
                    && raw[other].some((value, hour) => Number.isFinite(value) && !Number.isFinite(row[hour])),
            )
        const shared =
            donor === undefined
                ? []
                : row.flatMap((value, hour) =>
                      Number.isFinite(value) && Number.isFinite(raw[donor][hour]) ? [value - raw[donor][hour]] : [],
                  )
        const offset = shared.length ? shared.reduce((total, value) => total + value, 0) / shared.length : 0
        return row.map((value, hour) =>
            Number.isFinite(value) ? value : donor === undefined ? Number.NaN : raw[donor][hour] + offset,
        )
    })

    const known = raw.flat().filter(Number.isFinite)
    const fallback = known.length ? known.reduce((total, value) => total + value, 0) / known.length : 40
    const complete = field.map((row) => row.map((value) => (Number.isFinite(value) ? value : fallback)))

    const min = known.length ? Math.min(...known) : fallback
    const max = known.length ? Math.max(...known) : fallback
    const interval = intervalFor(max - min)
    return { rows, field: complete, min, max, interval, levels: levelsFor(min, max, interval) }
}

const cubic = (p0: number, p1: number, p2: number, p3: number, t: number) =>
    0.5 * (2 * p1 + (p2 - p0) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (3 * p1 - p0 - 3 * p2 + p3) * t * t * t)

const clampIndex = (value: number, size: number) => Math.max(0, Math.min(size - 1, value))

// Hourly readings are whole degrees, which reads as stair-stepping once contoured.
function soften(field: number[][]) {
    const rows = field.length
    return field.map((row, r) =>
        row.map((_, h) => {
            const across =
                (field[r][clampIndex(h - 1, HOURS)] + 2 * field[r][h] + field[r][clampIndex(h + 1, HOURS)]) / 4
            const up = field[clampIndex(r - 1, rows)][h]
            const down = field[clampIndex(r + 1, rows)][h]
            return across * 0.76 + (up + down) * 0.12
        }),
    )
}

// Overscan keeps d3's ring closures off the sheet, so no false contour runs along the neatline.
const OVERSCAN = 3

function upsample(field: number[][], width: number, height: number) {
    const rows = field.length
    const grid = soften(field)
    const at = (r: number, h: number) => grid[clampIndex(r, rows)][clampIndex(h, HOURS)]
    const totalW = width + OVERSCAN * 2
    const totalH = height + OVERSCAN * 2
    const data = new Float64Array(totalW * totalH)

    for (let j = 0; j < totalH; j++) {
        const y = ((j - OVERSCAN + 0.5) / height) * rows - 0.5
        const r0 = Math.floor(y)
        const fy = y - r0
        for (let i = 0; i < totalW; i++) {
            const x = ((i - OVERSCAN + 0.5) / width) * HOURS - 0.5
            const h0 = Math.floor(x)
            const fx = x - h0
            const column = [-1, 0, 1, 2].map((dr) =>
                cubic(at(r0 + dr, h0 - 1), at(r0 + dr, h0), at(r0 + dr, h0 + 1), at(r0 + dr, h0 + 2), fx),
            )
            data[j * totalW + i] = cubic(column[0], column[1], column[2], column[3], fy)
        }
    }

    blur2({ data, width: totalW, height: totalH }, (width / HOURS) * 0.28, (height / rows) * 0.05)
    return { data, totalW, totalH }
}

export interface Stroke {
    path: Path2D
    width: number
    color: string
    lit: boolean
}

export interface Layer {
    level: number
    color: string
    fill: Path2D
    strokes: Stroke[]
    rings: [number, number][][]
}

export interface Relief {
    base: string
    layers: Layer[]
    index?: Path2D
}

const BUCKETS = 11
// The direction the light comes from, in screen coordinates: up and to the left.
const LIGHT = [-Math.SQRT1_2, -Math.SQRT1_2]

function signedArea(ring: number[][]) {
    let area = 0
    for (let i = 1; i < ring.length; i++) {
        area += ring[i - 1][0] * ring[i][1] - ring[i][0] * ring[i - 1][1]
    }
    return area
}

// Each segment is shaded by how squarely its slope faces the light (Tanaka, 1950).
export function buildRelief(sheet: Sheet, width: number, height: number, theme: Theme): Relief {
    const cols = Math.round(width / 2.4)
    const lines = Math.round(height / 2.4)
    const { data, totalW, totalH } = upsample(sheet.field, cols, lines)
    const sx = width / cols
    const sy = height / lines
    const toX = (x: number) => (x - OVERSCAN) * sx
    const toY = (y: number) => (y - OVERSCAN) * sy

    const palette = inks[theme]
    const contour = contours().size([totalW, totalH]).smooth(true)
    const levels = sheet.levels
    const bandMiddle = (i: number) => {
        const level = levels[i]
        const next = levels[i + 1] ?? level + sheet.interval
        return (level + next) / 2
    }

    let index: Path2D | undefined
    const layers = levels.map((level, i) => {
        const shape = contour.contour(data as unknown as number[], level)
        const color = tint(bandMiddle(i), theme)
        const fill = new Path2D()
        const rings: [number, number][][] = []
        const paths = Array.from({ length: BUCKETS }, () => new Path2D())
        const ends = Array.from({ length: BUCKETS }, () => [Number.NaN, Number.NaN])
        const isIndex = level === FREEZING
        const major = level % 10 === 0
        if (isIndex) {
            index = new Path2D()
        }

        for (const polygon of shape.coordinates) {
            polygon.forEach((ring, ringIndex) => {
                const inside = signedArea(ring) > 0 ? 1 : -1
                const uphill = ringIndex === 0 ? inside : -inside
                const points = ring.map(([x, y]) => [toX(x), toY(y)] as [number, number])
                rings.push(points)
                fill.moveTo(points[0][0], points[0][1])
                index?.moveTo(points[0][0], points[0][1])

                for (let k = 1; k < points.length; k++) {
                    const [ax, ay] = points[k - 1]
                    const [bx, by] = points[k]
                    fill.lineTo(bx, by)
                    if (isIndex) {
                        index!.lineTo(bx, by)
                    }
                    const dx = bx - ax
                    const dy = by - ay
                    const length = Math.hypot(dx, dy)
                    if (!length) {
                        continue
                    }
                    const downhillX = (dy / length) * uphill
                    const downhillY = (-dx / length) * uphill
                    const facing = downhillX * LIGHT[0] + downhillY * LIGHT[1]
                    const bucket = Math.max(0, Math.min(BUCKETS - 1, Math.round(((facing + 1) / 2) * (BUCKETS - 1))))
                    const end = ends[bucket]
                    if (end[0] !== ax || end[1] !== ay) {
                        paths[bucket].moveTo(ax, ay)
                    }
                    paths[bucket].lineTo(bx, by)
                    ends[bucket] = [bx, by]
                }
                fill.closePath()
            })
        }

        const strokes: Stroke[] = paths.map((path, bucket) => {
            const facing = (bucket / (BUCKETS - 1)) * 2 - 1
            const amount = Math.abs(facing)
            const lit = facing > 0
            return {
                path,
                lit,
                width: (0.3 + (lit ? 1.5 : 1.35) * amount) * (major ? 1.3 : 1),
                color: interpolateLab(
                    color,
                    lit ? palette.lit : palette.shade,
                )(lit ? 0.3 + amount * 0.7 : 0.25 + amount * 0.65),
            }
        })

        return { level, color, fill, strokes, rings }
    })

    return {
        base: tint(levels.length ? levels[0] - sheet.interval / 2 : sheet.min, theme),
        layers,
        index,
    }
}

export interface Painter {
    ctx: CanvasRenderingContext2D
    scale: number
    theme: Theme
}

export function paintLayer({ ctx, scale, theme }: Painter, layer: Layer, alpha = 1) {
    const palette = inks[theme]
    ctx.save()
    ctx.globalAlpha = alpha
    ctx.shadowColor = palette.cast
    ctx.shadowBlur = 4 * scale
    ctx.shadowOffsetX = 1.6 * scale
    ctx.shadowOffsetY = 2.2 * scale
    ctx.fillStyle = layer.color
    ctx.fill(layer.fill, "evenodd")
    ctx.restore()

    ctx.save()
    ctx.globalAlpha = alpha
    ctx.lineCap = "round"
    ctx.lineJoin = "round"
    if (palette.glow) {
        ctx.globalAlpha = alpha * palette.glow
        for (const stroke of layer.strokes) {
            if (stroke.lit && stroke.width > 1.1) {
                ctx.strokeStyle = stroke.color
                ctx.lineWidth = stroke.width * 3.2
                ctx.stroke(stroke.path)
            }
        }
        ctx.globalAlpha = alpha
    }
    for (const stroke of layer.strokes) {
        ctx.strokeStyle = stroke.color
        ctx.lineWidth = stroke.width
        ctx.stroke(stroke.path)
    }
    ctx.restore()
}

export function paintIndex({ ctx, theme }: Painter, relief: Relief, alpha = 1) {
    if (!relief.index) {
        return
    }
    ctx.save()
    ctx.globalAlpha = alpha
    ctx.lineCap = "round"
    ctx.lineJoin = "round"
    ctx.strokeStyle = inks[theme].index
    ctx.lineWidth = 2.25
    ctx.stroke(relief.index)
    ctx.restore()
}

export function paintBase({ ctx }: Painter, relief: Relief, width: number, height: number) {
    ctx.fillStyle = relief.base
    ctx.fillRect(0, 0, width, height)
}

export interface ContourLabel {
    x: number
    y: number
    angle: number
    value: number
    index: boolean
}

interface Box {
    x: number
    y: number
    w: number
    h: number
}

const hits = (box: Box, x: number, y: number, pad: number) =>
    x > box.x - pad && x < box.x + box.w + pad && y > box.y - pad && y < box.y + box.h + pad

// Labels sit in the line, read uphill-agnostic, and stay upright as a map's contour figures do.
export function placeLabels(
    relief: Relief,
    width: number,
    height: number,
    avoid: Box[],
    labelEvery: number,
): ContourLabel[] {
    const placed: ContourLabel[] = []
    const margin = 16

    for (const layer of relief.layers) {
        const isIndex = layer.level === FREEZING
        if (!isIndex && layer.level % labelEvery !== 0) {
            continue
        }
        const spacing = isIndex ? 230 : 320
        let last: { x: number; y: number } | undefined

        for (const ring of layer.rings) {
            let travelled = 0
            let sinceLabel = spacing * 0.35
            for (let k = 3; k < ring.length - 3; k++) {
                const [x, y] = ring[k]
                const [px, py] = ring[k - 1]
                const step = Math.hypot(x - px, y - py)
                travelled += step
                sinceLabel += step
                if (sinceLabel < spacing || travelled < 18) {
                    continue
                }
                if (x < margin || x > width - margin || y < margin || y > height - margin) {
                    continue
                }
                const [ax, ay] = ring[k - 3]
                const [bx, by] = ring[k + 3]
                const span = Math.hypot(bx - ax, by - ay)
                const straight = span / Math.max(0.01, Math.hypot(ax - px, ay - py) + Math.hypot(bx - px, by - py))
                if (straight < 0.86) {
                    continue
                }
                if (avoid.some((box) => hits(box, x, y, 10))) {
                    continue
                }
                if (last && Math.hypot(x - last.x, y - last.y) < spacing * 0.7) {
                    continue
                }
                if (placed.some((other) => Math.hypot(x - other.x, y - other.y) < 30)) {
                    continue
                }
                let angle = (Math.atan2(by - ay, bx - ax) * 180) / Math.PI
                if (angle > 90) {
                    angle -= 180
                } else if (angle < -90) {
                    angle += 180
                }
                placed.push({ x, y, angle, value: layer.level, index: isIndex })
                last = { x, y }
                sinceLabel = 0
            }
        }
    }
    return placed
}

// Invented ground for the loading sheet, so there's terrain to survey before any forecast has arrived.
export function surveySheet(): Sheet {
    const field = Array.from({ length: 7 }, (_, r) =>
        Array.from(
            { length: HOURS },
            (_, h) =>
                42 + 22 * Math.cos(((h - 15) / HOURS) * 2 * Math.PI) + 11 * Math.sin(r * 1.05 + h * 0.08) - r * 1.5,
        ),
    )
    const flat = field.flat()
    const min = Math.min(...flat)
    const max = Math.max(...flat)
    return { rows: [], field, min, max, interval: 5, levels: levelsFor(min, max, 5) }
}
