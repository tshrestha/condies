import { createEffect, createMemo, For, onCleanup, Show } from "solid-js"

import { type DaySummary, formatSnow, formatWindRange, getDayLabel, hasSnow } from "../../lib/daily.ts"
import { formatLocalDate } from "../../lib/util.ts"
import type { DesignProps, LabForecast } from "../data.ts"
import { Benchmark, Num } from "./glyphs.tsx"
import {
    buildRelief,
    FREEZING,
    paintBase,
    paintIndex,
    paintLayer,
    placeLabels,
    type Painter,
    type Sheet,
    type Theme,
} from "./terrain.ts"
import { prefersCalm, useWidth } from "./useWidth.ts"
import { barbPath, bearingOf, glyph, type GlyphPaths, intensity, isWater, mergeGlyphs, toKnots, wxKind } from "./wx.ts"

const ZEBRA = 6
const AXIS = 44
const TIDE_MS = 1200
// Where things sit within a row: the caption strip on top, then the now marker, then spot heights.
const CAPTION = 23
const NOW_AT = 0.36
const SPOT_AT = 0.62
const HOURS = 24

// The tide only rises the first time a sheet is opened, not on every trip back to it.
let risen = false

export function conditionsOf(summary: DaySummary) {
    return (summary.day ?? summary.night)?.shortForecast ?? "No forecast"
}

// A row caption has about twenty characters, so it keeps the first half of the day's forecast.
export function compactForecast(text: string) {
    return text
        .split(" then ")[0]
        .replace(/Showers And Thunderstorms/i, "T-storms")
        .replace(/Thunderstorms/i, "T-storms")
        .replace(/Rain Showers/i, "Showers")
}

export function daySentence(summary: DaySummary, index: number) {
    const parts = [
        `${getDayLabel(summary, index, "long")}, ${formatLocalDate(summary.date, { month: "long", day: "numeric" })}.`,
        `${conditionsOf(summary)}.`,
    ]
    if (summary.high !== undefined) {
        parts.push(`High ${summary.high}°.`)
    }
    if (summary.low !== undefined) {
        parts.push(`Low ${summary.low}°.`)
    }
    parts.push(
        hasSnow(summary)
            ? `${formatSnow(summary.snow!)} of snow.`
            : `${summary.precipChance}% chance of ${summary.precipType}.`,
    )
    parts.push(`Wind ${formatWindRange(summary)}.`)
    if (summary.condies) {
        parts.push(`Condies score ${summary.condies.score}.`)
    }
    if (summary.highlight) {
        parts.push(summary.highlight === "pow" ? "Pow day." : "Primo conditions.")
    }
    return parts.join(" ")
}

const parseWindowHour = (label: string) => {
    const match = label.match(/(\d+)\s*(AM|PM)/)
    return match ? (Number(match[1]) % 12) + (match[2] === "PM" ? 12 : 0) : undefined
}

function hourLabel(hour: number) {
    if (hour === 0 || hour === 24) {
        return "12 AM"
    }
    return hour === 12 ? "Noon" : `${hour % 12} ${hour < 12 ? "AM" : "PM"}`
}

export default function TerrainMap(props: {
    forecast: LabForecast
    theme: Theme
    link: DesignProps["link"]
    resurvey: number
    sheet: Sheet
}) {
    let frame!: HTMLElement
    let canvas!: HTMLCanvasElement
    const width = useWidth(() => frame)

    const sheet = () => props.sheet

    const layout = createMemo(() => {
        const full = width()
        const collar = full >= 720 ? 112 : full >= 340 ? 68 : 60
        const plotW = Math.max(120, full - collar - ZEBRA * 2)
        const rowH = Math.round(Math.max(82, Math.min(100, plotW * 0.31)))
        const rows = sheet().rows.length
        return {
            full,
            collar,
            plotX: collar + ZEBRA,
            plotY: AXIS + ZEBRA,
            plotW,
            plotH: rowH * rows,
            rowH,
            hourW: plotW / HOURS,
            total: AXIS + ZEBRA * 2 + rowH * rows,
        }
    })

    const relief = createMemo(() => {
        const { full, plotW, plotH } = layout()
        return full ? buildRelief(sheet(), plotW, plotH, props.theme) : undefined
    })

    const gaps = createMemo(() => {
        const { rowH, hourW } = layout()
        return sheet().rows.flatMap((row, r) => {
            const runs: { x: number; y: number; w: number; h: number; hours: number }[] = []
            let start = -1
            for (let h = 0; h <= HOURS; h++) {
                const missing = h < HOURS && !row.cells[h]
                if (missing && start < 0) {
                    start = h
                }
                if (!missing && start >= 0) {
                    runs.push({ x: start * hourW, y: r * rowH, w: (h - start) * hourW, h: rowH, hours: h - start })
                    start = -1
                }
            }
            return runs
        })
    })

    const marks = createMemo(() => {
        const { rowH, hourW, plotW } = layout()
        return sheet().rows.flatMap((row, r) => {
            const y = r * rowH + rowH * SPOT_AT
            const make = (spot: typeof row.high, kind: "high" | "low", forceFlip = false) => {
                if (!spot) {
                    return []
                }
                const x = (spot.hour + 0.5) * hourW
                const text = `${spot.value}°`
                const textW = text.length * 8 + 2
                const flip = forceFlip || x + 9 + textW > plotW - 2
                return [
                    {
                        x,
                        y,
                        kind,
                        text,
                        flip,
                        box: { x: flip ? x - 9 - textW : x - 6, y: y - 10, w: textW + 15, h: 20 },
                    },
                ]
            }
            const pair = [...make(row.high, "high"), ...make(row.low, "low")].sort((a, b) => a.x - b.x)
            const crowded = pair.length === 2 && pair[0].box.x + pair[0].box.w > pair[1].box.x
            if (!crowded) {
                return pair
            }
            // Two readings close together on a narrow sheet: the earlier one takes its label to the left.
            const earlier = pair[0].kind === "high" ? row.high : row.low
            return [...make(earlier, pair[0].kind, true), pair[1]]
        })
    })

    const now = createMemo(() => {
        const { forecast } = props
        const first = forecast.hours[0]
        const { rowH, hourW } = layout()
        if (!first) {
            return undefined
        }
        const r = sheet().rows.findIndex((row) => row.date === first.startTime.slice(0, 10))
        if (r < 0) {
            return undefined
        }
        const hour = Number(first.startTime.slice(11, 13))
        const fraction = Math.max(0, Math.min(1, (forecast.now - Date.parse(first.startTime)) / 3_600_000))
        return { x: (hour + fraction) * hourW, y: r * rowH + rowH * NOW_AT, label: first.hourString }
    })

    const bestBracket = createMemo(() => {
        const best = props.forecast.best
        if (!best?.day.condies) {
            return undefined
        }
        const [from, to] = best.day.condies.bestWindow.split("–").map(parseWindowHour)
        const r = sheet().rows.findIndex((row) => row.date === best.day.date)
        if (from === undefined || to === undefined || r < 0) {
            return undefined
        }
        const { rowH, hourW } = layout()
        return { x0: from * hourW, x1: (to || HOURS) * hourW, y: (r + 1) * rowH - 5 }
    })

    const labels = createMemo(() => {
        const r = relief()
        const { plotW, plotH } = layout()
        if (!r) {
            return []
        }
        const captions = sheet().rows.map((_, i) => ({ x: 0, y: i * layout().rowH, w: plotW, h: CAPTION + 2 }))
        const cross = now()
        const marker = cross ? [{ x: cross.x - 16, y: cross.y - 16, w: 32, h: 32 }] : []
        return placeLabels(r, plotW, plotH, [...gaps(), ...marks().map((m) => m.box), ...captions, ...marker], 20)
    })

    const weather = createMemo(() => {
        const { rowH, hourW } = layout()
        const top = CAPTION + 2
        const boxes: { x: number; y: number; w: number; h: number }[] = marks().map((m) => m.box)
        const best = bestBracket()
        if (best) {
            boxes.push({ x: best.x0, y: best.y - 20, w: best.x1 - best.x0, h: 24 })
        }
        const cross = now()
        if (cross) {
            boxes.push({ x: cross.x - 16, y: cross.y - 12, w: 32, h: 24 })
        }
        for (const label of labels()) {
            boxes.push({ x: label.x - 11, y: label.y - 11, w: 22, h: 22 })
        }
        const collected: GlyphPaths[] = []
        const barbs: { lines: string; pennants: string }[] = []
        const denser = hourW >= 22

        // Barbs are placed first, so weather symbols step around them rather than through them.
        sheet().rows.forEach((row, r) => {
            row.cells.forEach((cell, h) => {
                const speed = cell?.windSpeed.value ?? cell?.windSpeed.maxValue ?? 0
                const gust = cell?.windGust?.value ?? 0
                if (!cell || h % 6 !== 3 || (speed < 15 && gust < 28)) {
                    return
                }
                const bx = (h + 0.5) * hourW
                const by = r * rowH + rowH * SPOT_AT
                // The staff reaches 18px upwind, so both of its ends have to land on open ground.
                const radians = (bearingOf(cell.windDirection) * Math.PI) / 180
                const ends = [
                    [bx, by],
                    [bx + Math.sin(radians) * 18, by - Math.cos(radians) * 18],
                ]
                const blocked = (b: { x: number; y: number; w: number; h: number }) =>
                    ends.some(([ex, ey]) => ex > b.x - 7 && ex < b.x + b.w + 7 && ey > b.y - 7 && ey < b.y + b.h + 7)
                if (!boxes.some(blocked)) {
                    barbs.push(barbPath(bx, by, bearingOf(cell.windDirection), toKnots(speed), 18))
                    boxes.push({ x: bx - 14, y: by - 16, w: 28, h: 28 })
                }
            })
        })

        sheet().rows.forEach((row, r) => {
            const usable = rowH - top - 5
            const slot = usable / 4
            row.cells.forEach((cell, h) => {
                if (!cell) {
                    return
                }
                const kind = wxKind(cell.shortForecast)
                const count = intensity(cell, kind)
                const x = (h + 0.5) * hourW
                const stagger = h % 2 ? slot / 2 : 0
                const add = (g: GlyphPaths, gx: number, gy: number) => {
                    if (!boxes.some((b) => gx > b.x - 3 && gx < b.x + b.w + 3 && gy > b.y - 4 && gy < b.y + b.h + 4)) {
                        collected.push(g)
                    }
                }

                if (count) {
                    const offsets = (
                        count === 1 ? [1.5] : count === 2 ? [0.5, 2.5] : count === 3 ? [0, 1.5, 3] : [0, 1, 2, 3]
                    ).map((o) => o * slot + slot / 2)
                    const columns = denser ? [-hourW / 4, hourW / 4] : [0]
                    columns.forEach((dx, column) => {
                        offsets.forEach((offset, slotIndex) => {
                            const gx = x + dx
                            const gy = r * rowH + top + ((offset + stagger + (column ? slot / 2 : 0)) % usable)
                            if (kind === "thunder") {
                                const storm = r * rowH + top + 8 + (offset % 18)
                                if (h % 2) {
                                    add(glyph("rain", gx, gy), gx, gy)
                                } else if (slotIndex === 0) {
                                    add(glyph("thunder", gx, storm, 3.8), gx, storm)
                                }
                            } else if (kind === "fog") {
                                if (h % 2 === 0) {
                                    add(glyph("fog", gx, gy, 3.2), gx, gy)
                                }
                            } else {
                                add(glyph(kind, gx, gy, 3.1), gx, gy)
                            }
                        })
                    })
                }
            })
        })
        return {
            ...mergeGlyphs(collected),
            barbLines: barbs.map((b) => b.lines).join(""),
            barbPennants: barbs.map((b) => b.pennants).join(""),
        }
    })

    const hourTicks = createMemo(() => {
        const { hourW } = layout()
        const labelled = hourW >= 22 ? [0, 3, 6, 9, 12, 15, 18, 21] : [0, 6, 12, 18]
        const cross = now()
        return labelled
            .map((hour) => ({ hour, x: (hour + 0.5) * hourW, label: hourLabel(hour) }))
            .filter((tick) => !cross || Math.abs(tick.x - cross.x) > tick.label.length * 3.4 + 4)
    })

    const sunTicks = createMemo(() => {
        const sun = props.forecast.sun
        const { hourW } = layout()
        return sun
            ? [
                  { x: sun.sunriseHour * hourW, up: true },
                  { x: sun.sunsetHour * hourW, up: false },
              ]
            : []
    })

    let raf = 0
    let lastSurvey = 0

    createEffect(
        () => ({ r: relief(), l: layout(), theme: props.theme, again: props.resurvey }),
        ({ r, l, theme, again }) => {
            if (!r || !canvas) {
                return
            }
            const scale = Math.min(window.devicePixelRatio || 1, 2.5)
            const pixelW = Math.round(l.plotW * scale)
            const pixelH = Math.round(l.plotH * scale)
            if (canvas.width !== pixelW || canvas.height !== pixelH) {
                canvas.width = pixelW
                canvas.height = pixelH
            }
            const ctx = canvas.getContext("2d")!
            ctx.setTransform(scale, 0, 0, scale, 0, 0)
            const painter: Painter = { ctx, scale, theme }

            const finish = () => {
                paintBase(painter, r, l.plotW, l.plotH)
                r.layers.forEach((layer) => paintLayer(painter, layer))
                paintIndex(painter, r)
                frame.dataset.state = "settled"
            }

            cancelAnimationFrame(raf)
            const shouldRise = (!risen || again !== lastSurvey) && !prefersCalm()
            lastSurvey = again
            if (!shouldRise) {
                finish()
                return
            }
            risen = true
            frame.dataset.state = "rising"

            // Finished bands are kept on a back sheet, so each frame only draws the one coming up.
            const back = document.createElement("canvas")
            back.width = pixelW
            back.height = pixelH
            const backCtx = back.getContext("2d")!
            backCtx.setTransform(scale, 0, 0, scale, 0, 0)
            const backPainter: Painter = { ctx: backCtx, scale, theme }
            paintBase(backPainter, r, l.plotW, l.plotH)
            let settled = 0
            const start = performance.now()

            const tick = (time: number) => {
                const t = Math.max(0, Math.min(1, (time - start) / TIDE_MS))
                const eased = t * t * (3 - 2 * t)
                const position = eased * r.layers.length
                while (settled < Math.floor(position) && settled < r.layers.length) {
                    paintLayer(backPainter, r.layers[settled])
                    settled++
                }
                ctx.setTransform(1, 0, 0, 1, 0, 0)
                ctx.drawImage(back, 0, 0)
                ctx.setTransform(scale, 0, 0, scale, 0, 0)
                if (settled < r.layers.length) {
                    paintLayer(painter, r.layers[settled], position - settled)
                }
                if (t < 1) {
                    raf = requestAnimationFrame(tick)
                } else {
                    finish()
                }
            }
            raf = requestAnimationFrame(tick)
        },
    )

    onCleanup(() => cancelAnimationFrame(raf))

    const summary = () => {
        const { min, max, levels } = sheet()
        const freezes = min < FREEZING && max > FREEZING
        return `Temperature map of the week by hour and day, ${min}° to ${max}°. ${
            freezes
                ? "The freezing line crosses the week."
                : max <= FREEZING
                  ? "The whole week stays below freezing."
                  : "The whole week stays above freezing."
        } Contours every ${sheet().interval} degrees, ${levels.length} in all. Each day below is a link with its full summary.`
    }

    return (
        <figure class="rl-map" ref={frame} style={{ height: `${layout().total}px` }} data-state="rising">
            <figcaption class="rl-vh">{summary()}</figcaption>
            <canvas
                ref={canvas}
                class="rl-map-canvas"
                aria-hidden="true"
                style={{
                    left: `${layout().plotX}px`,
                    top: `${layout().plotY}px`,
                    width: `${layout().plotW}px`,
                    height: `${layout().plotH}px`,
                }}
            />
            <Show when={layout().full}>
                <svg
                    class="rl-map-overlay"
                    width={layout().full}
                    height={layout().total}
                    viewBox={`0 0 ${layout().full} ${layout().total}`}
                    aria-hidden="true"
                >
                    <defs>
                        <pattern
                            id="rl-hatch"
                            width="7"
                            height="7"
                            patternUnits="userSpaceOnUse"
                            patternTransform="rotate(45)"
                        >
                            <rect width="7" height="7" class="rl-hatch-ground" />
                            <line x1="0" y1="0" x2="0" y2="7" class="rl-hatch-line" />
                        </pattern>
                    </defs>

                    <g class="rl-zebra">
                        <For each={Array.from({ length: HOURS }, (_, i) => i)}>
                            {(i) => (
                                <>
                                    <rect
                                        x={layout().plotX + i * layout().hourW}
                                        y={AXIS}
                                        width={layout().hourW}
                                        height={ZEBRA}
                                        class={Math.floor(i / 3) % 2 ? "rl-zebra-b" : "rl-zebra-a"}
                                    />
                                    <rect
                                        x={layout().plotX + i * layout().hourW}
                                        y={layout().plotY + layout().plotH}
                                        width={layout().hourW}
                                        height={ZEBRA}
                                        class={Math.floor(i / 3) % 2 ? "rl-zebra-b" : "rl-zebra-a"}
                                    />
                                </>
                            )}
                        </For>
                        <For each={sheet().rows}>
                            {(_, r) => (
                                <>
                                    <rect
                                        x={layout().collar}
                                        y={layout().plotY + r() * layout().rowH}
                                        width={ZEBRA}
                                        height={layout().rowH}
                                        class={r() % 2 ? "rl-zebra-b" : "rl-zebra-a"}
                                    />
                                    <rect
                                        x={layout().plotX + layout().plotW}
                                        y={layout().plotY + r() * layout().rowH}
                                        width={ZEBRA}
                                        height={layout().rowH}
                                        class={r() % 2 ? "rl-zebra-b" : "rl-zebra-a"}
                                    />
                                </>
                            )}
                        </For>
                        <rect
                            x={layout().collar}
                            y={AXIS}
                            width={layout().plotW + ZEBRA * 2}
                            height={layout().plotH + ZEBRA * 2}
                            class="rl-neatline"
                        />
                        <rect
                            x={layout().plotX}
                            y={layout().plotY}
                            width={layout().plotW}
                            height={layout().plotH}
                            class="rl-neatline-in"
                        />
                    </g>

                    <g class="rl-axis">
                        <For each={hourTicks()}>
                            {(tick) => (
                                <text
                                    x={layout().plotX + tick.x}
                                    y={AXIS - 15}
                                    class="rl-axis-label"
                                    text-anchor="middle"
                                >
                                    {tick.label}
                                </text>
                            )}
                        </For>
                        <For each={sunTicks()}>
                            {(tick) => (
                                <path
                                    class="rl-sun-tick"
                                    d={
                                        tick.up
                                            ? `M${layout().plotX + tick.x - 4} ${AXIS - 3}h8l-4-5z`
                                            : `M${layout().plotX + tick.x - 4} ${AXIS - 8}h8l-4 5z`
                                    }
                                />
                            )}
                        </For>
                    </g>

                    <g transform={`translate(${layout().plotX} ${layout().plotY})`}>
                        <g class="rl-paper">
                            <For each={gaps()}>
                                {(gap) => (
                                    <>
                                        <rect x={gap.x} y={gap.y} width={gap.w} height={gap.h} fill="url(#rl-hatch)" />
                                        <line
                                            x1={gap.x + gap.w}
                                            y1={gap.y}
                                            x2={gap.x + gap.w}
                                            y2={gap.y + gap.h}
                                            class="rl-limit"
                                        />
                                        <line x1={gap.x} y1={gap.y} x2={gap.x} y2={gap.y + gap.h} class="rl-limit" />
                                    </>
                                )}
                            </For>
                            <For each={gaps().filter((g) => g.w >= 104 && g.hours >= 5)}>
                                {(gap) => (
                                    <text
                                        x={gap.x + gap.w / 2}
                                        y={gap.y + gap.h * SPOT_AT}
                                        class="rl-unsurveyed"
                                        text-anchor="middle"
                                    >
                                        Unsurveyed
                                    </text>
                                )}
                            </For>
                            <For each={sheet().rows.slice(1)}>
                                {(_, r) => (
                                    <>
                                        <line
                                            class="rl-row-rule-collar"
                                            x1={-layout().plotX}
                                            x2={-ZEBRA}
                                            y1={(r() + 1) * layout().rowH}
                                            y2={(r() + 1) * layout().rowH}
                                        />
                                        <line
                                            class="rl-row-rule"
                                            x1="0"
                                            x2={layout().plotW}
                                            y1={(r() + 1) * layout().rowH}
                                            y2={(r() + 1) * layout().rowH}
                                        />
                                    </>
                                )}
                            </For>
                            <For each={sheet().rows.slice(1)}>
                                {(_, r) => (
                                    <For each={[0, 6, 12, 18]}>
                                        {(hour) => (
                                            <path
                                                class="rl-graticule"
                                                d={`M${(hour + 0.5) * layout().hourW - 4} ${(r() + 1) * layout().rowH}h8M${(hour + 0.5) * layout().hourW} ${(r() + 1) * layout().rowH - 4}v8`}
                                            />
                                        )}
                                    </For>
                                )}
                            </For>
                        </g>

                        <g class="rl-ink">
                            <For each={labels()}>
                                {(label) => (
                                    <text
                                        class={label.index ? "rl-contour-index" : "rl-contour"}
                                        transform={`translate(${label.x} ${label.y}) rotate(${label.angle})`}
                                        text-anchor="middle"
                                        dy="0.34em"
                                    >
                                        {label.value}°
                                    </text>
                                )}
                            </For>

                            <path class="rl-wx-halo rl-wx-halo-line" d={weather().lines} />
                            <path class="rl-wx-halo rl-wx-halo-dot" d={weather().dots} />
                            <path class="rl-wx-line" d={weather().lines} />
                            <path class="rl-wx-dot" d={weather().dots} />

                            <path class="rl-barb-halo" d={weather().barbLines} />
                            <path class="rl-barb" d={weather().barbLines} />
                            <path class="rl-barb-pennant" d={weather().barbPennants} />

                            <Show when={bestBracket()}>
                                {(bracket) => (
                                    <>
                                        <path
                                            class="rl-best"
                                            d={`M${bracket().x0} ${bracket().y - 5}v5H${bracket().x1}v-5`}
                                        />
                                        <text
                                            class="rl-best-label"
                                            x={(bracket().x0 + bracket().x1) / 2}
                                            y={bracket().y - 8}
                                            text-anchor="middle"
                                        >
                                            Best
                                        </text>
                                    </>
                                )}
                            </Show>

                            <For each={marks()}>
                                {(mark) => (
                                    <g transform={`translate(${mark.x} ${mark.y})`}>
                                        <path
                                            class={mark.kind === "high" ? "rl-spot-high" : "rl-spot-low"}
                                            d={mark.kind === "high" ? "M0-5.5L5 3.2H-5z" : "M0 5.5L5-3.2H-5z"}
                                        />
                                        <text
                                            class="rl-spot-text"
                                            x={mark.flip ? -9 : 9}
                                            y="0"
                                            dy="0.36em"
                                            text-anchor={mark.flip ? "end" : "start"}
                                        >
                                            {mark.text}
                                        </text>
                                    </g>
                                )}
                            </For>
                        </g>

                        <Show when={now()}>
                            {(cross) => (
                                <g class="rl-now" transform={`translate(${cross().x} ${cross().y})`}>
                                    <line
                                        class="rl-now-hair"
                                        x1="0"
                                        y1={-cross().y - ZEBRA - 22}
                                        x2="0"
                                        y2={-cross().y}
                                        pathLength="1"
                                    />
                                    <line
                                        class="rl-now-hair"
                                        x1="0"
                                        y1={-cross().y + CAPTION}
                                        x2="0"
                                        y2="-7"
                                        pathLength="1"
                                    />
                                    <path class="rl-now-hair" d="M-15 0H-7M7 0H15M0 7V14" pathLength="1" />
                                    <circle class="rl-now-ring" r="7" />
                                    <circle class="rl-now-dot" r="2.2" />
                                </g>
                            )}
                        </Show>
                    </g>

                    <Show when={now()}>
                        {(cross) => (
                            <text
                                class="rl-now-flag"
                                x={layout().plotX + cross().x + (cross().x > layout().plotW - 74 ? -5 : 5)}
                                y="12"
                                text-anchor={cross().x > layout().plotW - 74 ? "end" : "start"}
                            >
                                Now {cross().label}
                            </text>
                        )}
                    </Show>
                </svg>
            </Show>

            <ol
                class={`rl-rows ${layout().collar > 100 ? "rl-rows-wide" : layout().collar < 64 ? "rl-rows-tight" : ""}`}
                aria-label="Days of the week"
                style={{ top: `${layout().plotY}px`, "--rl-collar": `${layout().plotX}px` }}
            >
                <For each={props.forecast.days}>
                    {(summary, i) => (
                        <li style={{ height: `${layout().rowH}px` }}>
                            <a
                                class="rl-row"
                                {...props.link({ name: "day", date: summary.date })}
                                aria-label={daySentence(summary, i())}
                            >
                                <span class="rl-row-collar">
                                    <span class="rl-row-day">{getDayLabel(summary, i(), "short")}</span>
                                    <span class="rl-row-date">
                                        {formatLocalDate(summary.date, { month: "short", day: "numeric" })}
                                    </span>
                                    <Show when={summary.condies}>
                                        {(c) => <Benchmark score={c().score} size={layout().collar > 100 ? 40 : 32} />}
                                    </Show>
                                </span>
                                <span class="rl-row-caption">
                                    <Show when={summary.highlight}>
                                        {(h) => (
                                            <span class={`rl-plate ${h() === "pow" ? "rl-plate-pow" : ""}`}>
                                                {h() === "pow" ? (layout().collar < 64 ? "POW" : "POW DAY") : "PRIMO"}
                                            </span>
                                        )}
                                    </Show>
                                    <span
                                        class={`rl-row-cond ${isWater(compactForecast(conditionsOf(summary))) ? "rl-water" : ""}`}
                                    >
                                        {compactForecast(conditionsOf(summary))}
                                    </span>
                                    <span class="rl-row-data">
                                        <span class={hasSnow(summary) ? "rl-row-amount" : ""}>
                                            <Num
                                                text={
                                                    hasSnow(summary)
                                                        ? formatSnow(summary.snow!)
                                                        : `${summary.precipChance}%`
                                                }
                                            />
                                        </span>
                                        <span>{formatWindRange(summary)}</span>
                                    </span>
                                </span>
                            </a>
                        </li>
                    )}
                </For>
            </ol>
        </figure>
    )
}
