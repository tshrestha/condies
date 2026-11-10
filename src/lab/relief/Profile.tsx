import { area, curveMonotoneX, line } from "d3"
import { createMemo, createSignal, createUniqueId, For, Show } from "solid-js"

import type { Period } from "../../lib/nws.ts"
import { TightSvg } from "./glyphs.tsx"
import { FREEZING, type Theme, tint } from "./terrain.ts"
import { useWidth } from "./useWidth.ts"
import { barbPath, bearingOf, glyph, type GlyphPaths, intensity, mergeGlyphs, toKnots, wxKind } from "./wx.ts"

type View = "temp" | "precip" | "wind" | "snow"

const viewNames: Record<View, string> = { temp: "Temperature", precip: "Precip", wind: "Wind", snow: "Snow" }

const speedOf = (period: Period) => period.windSpeed.value ?? period.windSpeed.maxValue ?? 0

function reader(view: View): (period: Period) => number {
    if (view === "temp") {
        return (p) => p.temperature
    }
    if (view === "precip") {
        return (p) => p.probabilityOfPrecipitation.value
    }
    return view === "wind" ? speedOf : (p) => p.snowInches ?? 0
}

const unit = (view: View, value: number) =>
    view === "temp"
        ? `${value}°`
        : view === "precip"
          ? `${value}%`
          : view === "wind"
            ? `${value}`
            : value < 0.05
              ? ""
              : `${value.toFixed(1)}″`

// Every view reads off the one set of inks: cold water for what falls, spruce to ember for wind.
function colorOf(view: View, value: number, theme: Theme) {
    if (view === "temp") {
        return tint(value, theme)
    }
    if (view === "precip") {
        return tint(32 - value * 0.5, theme)
    }
    return view === "wind" ? tint(46 + value * 1.25, theme) : tint(28 - value * 32, theme)
}

function bandSize(view: View, max: number, min: number) {
    if (view === "temp") {
        const range = max - min
        return range >= 18 ? 5 : range >= 8 ? 2 : 1
    }
    if (view === "precip") {
        return 20
    }
    return view === "wind" ? (max > 40 ? 10 : 5) : max > 1 ? 0.25 : 0.1
}

// Narrow charts keep every third hour by shortening "3 PM" to "3p", as a timetable would.
const hourLabel = (label: string, hourW: number) => {
    const clean = label.replace(":00", "")
    return hourW < 20 ? clean.replace(" AM", "a").replace(" PM", "p") : clean
}

const SKY = 58
const CLEAR = 30
const BOTTOM = 24

export default function Profile(props: {
    hours: Period[]
    theme: Theme
    height: number
    showNow: boolean
    caption: string
}) {
    let holder!: HTMLDivElement
    const width = useWidth(() => holder)
    const [chosen, setChosen] = createSignal<View>("temp")
    const clipId = createUniqueId()
    const gradientId = createUniqueId()

    const canSnow = () => props.hours.some((p) => (p.snowInches ?? 0) >= 0.05)
    const views = (): View[] => (canSnow() ? ["temp", "precip", "wind", "snow"] : ["temp", "precip", "wind"])
    const view = () => (views().includes(chosen()) ? chosen() : "temp")

    const chart = createMemo(() => {
        const W = width()
        const H = props.height
        const v = view()
        const read = reader(v)
        const hours = props.hours
        const values = hours.map(read)
        const n = hours.length || 1
        const hourW = W / n
        const gusts = hours.map((p) => p.windGust?.value ?? speedOf(p))
        const peak = v === "wind" ? Math.max(...gusts, ...values) : Math.max(...values)
        const floorValue = Math.min(...values)
        const range = peak - floorValue

        let low = 0
        let high = peak
        if (v === "temp") {
            low = floorValue - Math.max(3, range * 0.45)
            high = peak + Math.max(1, range * 0.08)
        } else if (v === "precip") {
            high = 100
        } else if (v === "wind") {
            high = Math.max(peak, 14) * 1.05
        } else {
            high = Math.max(peak, 0.4) * 1.1
        }

        const showsWeather = v !== "wind" && hours.some((p) => intensity(p) > 0)
        const TOP = showsWeather || v === "wind" ? SKY : CLEAR
        const plotBottom = H - BOTTOM
        const y = (value: number) => plotBottom - ((value - low) / (high - low || 1)) * (plotBottom - TOP)
        const x = (i: number) => (i + 0.5) * hourW

        const edged = [
            [0, values[0] ?? 0] as [number, number],
            ...values.map((value, i) => [x(i), value] as [number, number]),
            [W, values.at(-1) ?? 0] as [number, number],
        ]
        const fillPath = area<[number, number]>()
            .x((d) => d[0])
            .y0(plotBottom)
            .y1((d) => y(d[1]))
            .curve(curveMonotoneX)(edged)!
        const ridgePath = line<[number, number]>()
            .x((d) => d[0])
            .y((d) => y(d[1]))
            .curve(curveMonotoneX)(edged)!

        const size = bandSize(v, peak, floorValue)
        const firstBand = Math.floor(low / size) * size
        const levels: number[] = []
        for (let level = firstBand; level <= high + size; level += size) {
            levels.push(level)
        }
        const stops = levels.slice(0, -1).flatMap((level, i) => {
            const top = levels[i + 1]
            const color = colorOf(v, (level + top) / 2, props.theme)
            return [
                { offset: y(level), color },
                { offset: y(top), color },
            ]
        })
        const contours = levels
            .filter((level) => level > low && level < high)
            .map((level) => ({
                y: y(level),
                index: v === "temp" && level === FREEZING,
                major: v === "temp" ? level % 10 === 0 : level % (size * 2) === 0,
            }))

        const every = n >= 18 || hourW < 26 ? 3 : 2
        const labels = hours.flatMap((_, i) => {
            const value = values[i]
            if (i % every !== 0) {
                return []
            }
            return [
                {
                    x: x(i) + (i === 0 && props.showNow ? 12 : 0),
                    y: y(value) - 9,
                    text: v === "snow" && value < 0.05 ? "" : unit(v, value),
                },
            ]
        })

        const peakIndex = values.indexOf(Math.max(...values))
        const lowIndex = values.indexOf(Math.min(...values))
        const spots =
            v === "temp"
                ? [
                      { i: peakIndex, kind: "high" as const },
                      ...(lowIndex !== peakIndex ? [{ i: lowIndex, kind: "low" as const }] : []),
                  ].map(({ i, kind }) => ({
                      kind,
                      x: x(i),
                      y: y(values[i]),
                      text: unit(v, values[i]),
                      flip: x(i) > W - 44,
                  }))
                : []

        const printed = [
            ...labels.map((l) => ({ x: l.x, y: l.y - 5 })),
            ...spots.map((s) => ({ x: s.x + 18, y: s.y - 13 })),
        ]
        const falling: GlyphPaths[] = []
        if (v !== "wind") {
            hours.forEach((p, i) => {
                const kind = wxKind(p.shortForecast)
                const count = intensity(p, kind)
                if (!count) {
                    return
                }
                const cx = x(i)
                const ground = y(values[i])
                const spacing = [0, 34, 25, 18, 14][count]
                let row = 0
                // Symbols fall from the top of the plot and stop just above the ridge, as they would on the ground.
                for (let gy = ground - 28 - (i % 2 ? spacing / 2 : 0); gy > 6; gy -= spacing, row++) {
                    const drift = row % 2 ? -hourW * 0.16 : hourW * 0.16
                    if (printed.some((p) => Math.abs(p.x - cx - drift) < 24 && Math.abs(p.y - gy) < 13)) {
                        continue
                    }
                    falling.push(
                        glyph(
                            kind === "thunder" && row > 0 ? "rain" : kind,
                            cx + drift,
                            gy,
                            kind === "thunder" ? 3.6 : 3.2,
                        ),
                    )
                }
            })
        }

        const barbs =
            v === "wind"
                ? hours.flatMap((p, i) =>
                      i % every === 0
                          ? [barbPath(Math.max(x(i), 18), 26, bearingOf(p.windDirection), toKnots(speedOf(p)), 15)]
                          : [],
                  )
                : []
        const gustLine =
            v === "wind"
                ? line<number>()
                      .x((_, i) => x(i))
                      .y((d) => y(d))
                      .curve(curveMonotoneX)(gusts)
                : undefined
        const gustLabels =
            v === "wind"
                ? hours.flatMap((p, i) =>
                      i % every === 0 && p.windGust ? [{ x: x(i), y: y(gusts[i]) - 7, text: `${gusts[i]}` }] : [],
                  )
                : []

        const ticks = hours.flatMap((p, i) =>
            i % every === 0
                ? [
                      {
                          x: x(i),
                          label: hourLabel(p.hourString, hourW),
                          anchor: x(i) < 22 ? ("start" as const) : ("middle" as const),
                      },
                  ]
                : [],
        )

        return {
            W,
            H,
            plotBottom,
            fillPath,
            ridgePath,
            stops,
            contours,
            labels,
            spots,
            glyphs: mergeGlyphs(falling),
            barbs,
            gustLine,
            gustLabels,
            ticks,
            nowY: y(values[0] ?? 0),
            nowX: x(0),
            TOP,
        }
    })

    const summary = () => {
        const v = view()
        const read = reader(v)
        const text = props.hours.map((p) => `${p.hourString} ${unit(v, read(p)) || "none"}`).join(", ")
        return `${props.caption}. ${viewNames[v]}: ${text}.`
    }

    return (
        <div class="rl-prof">
            <div class="rl-tabs" role="group" aria-label="What the profile plots">
                <For each={views()}>
                    {(v) => (
                        <button
                            type="button"
                            class="rl-tab"
                            aria-pressed={view() === v ? "true" : "false"}
                            onClick={() => setChosen(v)}
                        >
                            {viewNames[v]}
                        </button>
                    )}
                </For>
            </div>
            <div class="rl-prof-plot" ref={holder} role="img" aria-label={summary()}>
                <Show when={width() > 0}>
                    <svg
                        width={chart().W}
                        height={chart().H}
                        viewBox={`0 0 ${chart().W} ${chart().H}`}
                        aria-hidden="true"
                    >
                        <defs>
                            <linearGradient
                                id={gradientId}
                                gradientUnits="userSpaceOnUse"
                                x1="0"
                                x2="0"
                                y1={chart().plotBottom}
                                y2={chart().TOP}
                            >
                                <For each={chart().stops}>
                                    {(stop) => (
                                        <stop
                                            offset={`${((chart().plotBottom - stop.offset) / (chart().plotBottom - chart().TOP)) * 100}%`}
                                            stop-color={stop.color}
                                        />
                                    )}
                                </For>
                            </linearGradient>
                            <clipPath id={clipId}>
                                <path d={chart().fillPath} />
                            </clipPath>
                        </defs>

                        <path d={chart().fillPath} fill={`url(#${gradientId})`} />
                        <g clip-path={`url(#${clipId})`}>
                            <For each={chart().contours}>
                                {(c) => (
                                    <>
                                        <line
                                            class={
                                                c.index
                                                    ? "rl-prof-index"
                                                    : c.major
                                                      ? "rl-prof-contour-lit rl-prof-contour-major"
                                                      : "rl-prof-contour-lit"
                                            }
                                            x1="0"
                                            x2={chart().W}
                                            y1={c.y}
                                            y2={c.y}
                                        />
                                    </>
                                )}
                            </For>
                        </g>
                        <path class="rl-prof-ridge-lit" d={chart().ridgePath} transform="translate(0.8 -1.4)" />
                        <path class="rl-prof-ridge" d={chart().ridgePath} />
                        <line
                            class="rl-prof-base"
                            x1="0"
                            x2={chart().W}
                            y1={chart().plotBottom}
                            y2={chart().plotBottom}
                        />

                        <Show when={chart().gustLine}>{(d) => <path class="rl-prof-gust" d={d()} />}</Show>
                        <For each={chart().gustLabels}>
                            {(label) => (
                                <text class="rl-prof-gust-label" x={label.x} y={label.y} text-anchor="middle">
                                    {label.text}
                                </text>
                            )}
                        </For>

                        <path class="rl-wx-line" d={chart().glyphs.lines} />
                        <path class="rl-wx-dot" d={chart().glyphs.dots} />
                        <For each={chart().barbs}>
                            {(barb) => (
                                <>
                                    <path class="rl-barb" d={barb.lines} />
                                    <path class="rl-barb-pennant" d={barb.pennants} />
                                </>
                            )}
                        </For>

                        <For
                            each={chart().labels.filter(
                                (label) =>
                                    !chart().spots.some((spot) => label.x > spot.x - 30 && label.x < spot.x + 50),
                            )}
                        >
                            {(label) => (
                                <text class="rl-prof-label" x={label.x} y={label.y} text-anchor="middle">
                                    <TightSvg text={label.text} />
                                </text>
                            )}
                        </For>
                        <For each={chart().spots}>
                            {(spot) => (
                                <g transform={`translate(${spot.x} ${spot.y})`}>
                                    <path
                                        class={spot.kind === "high" ? "rl-spot-high" : "rl-spot-low"}
                                        d={spot.kind === "high" ? "M0-5.5L5 3.2H-5z" : "M0 5.5L5-3.2H-5z"}
                                    />
                                    <text
                                        class="rl-prof-label"
                                        x={spot.flip ? -8 : 8}
                                        y={spot.kind === "high" ? -8 : -7}
                                        text-anchor={spot.flip ? "end" : "start"}
                                    >
                                        {spot.text}
                                    </text>
                                </g>
                            )}
                        </For>

                        <For each={chart().ticks}>
                            {(tick) => (
                                <>
                                    <line
                                        class="rl-prof-tick"
                                        x1={tick.x}
                                        x2={tick.x}
                                        y1={chart().plotBottom}
                                        y2={chart().plotBottom + 4}
                                    />
                                    <text
                                        class="rl-prof-hour"
                                        x={tick.anchor === "start" ? 0 : tick.x}
                                        y={chart().H - 6}
                                        text-anchor={tick.anchor}
                                    >
                                        {tick.label}
                                    </text>
                                </>
                            )}
                        </For>

                        <Show when={props.showNow}>
                            <g class="rl-now">
                                <line
                                    class="rl-now-hair"
                                    x1={chart().nowX}
                                    x2={chart().nowX}
                                    y1={chart().TOP - 10}
                                    y2={chart().plotBottom}
                                    pathLength="1"
                                />
                                <circle class="rl-now-ring" cx={chart().nowX} cy={chart().nowY} r="6" />
                                <circle class="rl-now-dot" cx={chart().nowX} cy={chart().nowY} r="2" />
                            </g>
                        </Show>
                    </svg>
                </Show>
            </div>
            <Show when={view() === "wind"}>
                <p class="rl-prof-note">Sustained wind and, dashed, gusts, in mph. Barbs show direction and force.</p>
            </Show>
        </div>
    )
}
