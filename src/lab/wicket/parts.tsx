import { createMemo, createSignal, For, onSettled, Show } from "solid-js"

import { formatSnow, type DaySummary } from "../../lib/daily.ts"
import type { Period } from "../../lib/nws.ts"

const WEEK = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const
// Two letters where one would be ambiguous. A lone brush "T" also reads as a 1.
const LETTERS = ["Su", "M", "Tu", "W", "Th", "F", "Sa"]

const weekdayIndex = (date: string) => new Date(`${date}T12:00:00Z`).getUTCDay()

export const inkOf = (date: string) => WEEK[weekdayIndex(date)]
export const letterOf = (date: string) => LETTERS[weekdayIndex(date)]

export type GlyphName =
    | "snow"
    | "rain"
    | "sun"
    | "moon"
    | "cloud"
    | "partly"
    | "bolt"
    | "fog"
    | "wind"
    | "star"
    | "search"
    | "ticket"
    | "map"
    | "left"
    | "right"
    | "refresh"
    | "hazard"
    | "close"
    | "sunrise"
    | "sunset"

const stroke = {
    fill: "none",
    stroke: "currentColor",
    "stroke-width": "3",
    "stroke-linecap": "butt",
    "stroke-linejoin": "miter",
} as const

const glyphs: Record<GlyphName, () => unknown> = {
    snow: () => (
        <g {...stroke} stroke-width="2.7">
            <path d="M12 2v20M3.3 7l17.4 10M3.3 17l17.4-10" />
            <path
                d="M8.6 2h6.8M8.6 22h6.8M.4 8.6l3.4-5.9M20.2 21.3l3.4-5.9M.4 15.4l3.4 5.9M20.2 2.7l3.4 5.9"
                stroke-width="2.3"
            />
        </g>
    ),
    rain: () => <path d="M12 1.5C7 8.6 4 12.4 4 16a8 8 0 0 0 16 0c0-3.6-3-7.4-8-14.5z" fill="currentColor" />,
    sun: () => (
        <g fill="currentColor">
            <circle cx="12" cy="12" r="5.6" />
            <path d="M10.8 0h2.4l-.2 4.4h-2zM10.8 24h2.4l-.2-4.4h-2zM0 10.8v2.4l4.4-.2v-2zM24 10.8v2.4l-4.4-.2v-2zM3.3 5l1.7-1.7 3 3.2-1.5 1.4zM20.7 19 19 20.7l-3-3.2 1.5-1.4zM5 20.7 3.3 19l3.2-3 1.4 1.5zM19 3.3 20.7 5l-3.2 3-1.4-1.5z" />
        </g>
    ),
    moon: () => <path d="M21.5 15.3A10 10 0 0 1 8.7 2.5 10 10 0 1 0 21.5 15.3z" fill="currentColor" />,
    cloud: () => (
        <path d="M6 20a5.5 5.5 0 0 1-1.2-10.9A7 7 0 0 1 18.2 8.4 5.8 5.8 0 0 1 18.5 20z" fill="currentColor" />
    ),
    partly: () => (
        <g fill="currentColor">
            <circle cx="9" cy="8" r="4.2" />
            <path d="M8 0h2l-.2 2.4H8.2zM0 7v2l2.4-.2V7.2zM2.3 2.7 3.7 1.3l1.7 1.8-1.3 1.3zM15.7 1.3l1.4 1.4-1.8 1.7L14 3.1z" />
            <path
                d="M8.5 21.5a4.9 4.9 0 0 1-1-9.7 6.2 6.2 0 0 1 11.7-.6 5.2 5.2 0 0 1 .3 10.3z"
                stroke="var(--g-gap, #fff)"
                stroke-width="1.6"
                paint-order="stroke"
            />
        </g>
    ),
    bolt: () => <path d="M14.5 1 4 13.8h6.2L8 23l12-13.6h-6.4z" fill="currentColor" />,
    fog: () => <path d="M2 6h16M6 12h16M2 18h16" {...stroke} />,
    wind: () => (
        <path d="M1 8h12a3.2 3.2 0 1 0-3.2-3.2M1 13h17.5a3.2 3.2 0 1 1-3.2 3.2M1 18h9" {...stroke} stroke-width="2.6" />
    ),
    star: () => (
        <path
            d="m12 1.5 3.2 7 7.6.8-5.7 5.1 1.6 7.5L12 18l-6.7 3.9 1.6-7.5L1.2 9.3l7.6-.8z"
            fill="var(--g-star, none)"
            stroke="currentColor"
            stroke-width="2"
            stroke-linejoin="miter"
        />
    ),
    search: () => <path d="M15.8 15.8 22 22M17.5 10a7.5 7.5 0 1 1-15 0 7.5 7.5 0 0 1 15 0z" {...stroke} />,
    ticket: () => (
        <path
            d="M1 5h22v5a2 2 0 0 0 0 4v5H1v-5a2 2 0 0 0 0-4zM7 8v1.8h2V8zM7 11.1v1.8h2v-1.8zM7 14.2V16h2v-1.8z"
            fill="currentColor"
            fill-rule="evenodd"
        />
    ),
    map: () => (
        <g fill="currentColor">
            <path d="M1 5.4 8 3v15.6l-7 2.4zM9.6 3l4.8 2.2v15.6L9.6 18.6zM16 5.2 23 3v15.6l-7 2.2z" />
        </g>
    ),
    left: () => <path d="m16 3-9 9 9 9" {...stroke} stroke-width="3.6" />,
    right: () => <path d="m8 3 9 9-9 9" {...stroke} stroke-width="3.6" />,
    refresh: () => (
        <g>
            <path d="M20 12a8 8 0 1 1-2.6-5.9" {...stroke} />
            <path d="M20.5 1.5v7h-7z" fill="currentColor" />
        </g>
    ),
    hazard: () => (
        <path d="M12 1.5 23.5 22H.5zM10.5 8.5v7h3v-7zM10.5 17v3h3v-3z" fill="currentColor" fill-rule="evenodd" />
    ),
    close: () => <path d="m4 4 16 16M20 4 4 20" {...stroke} stroke-width="3.6" />,
    sunrise: () => (
        <g fill="currentColor">
            <path d="M5.6 17a6.4 6.4 0 0 1 12.8 0z" />
            <path d="M1 18.8h22v2.4H1zM10.5 8.5V4H7.8L12 0l4.2 4h-2.7v4.5z" />
        </g>
    ),
    sunset: () => (
        <g fill="currentColor">
            <path d="M5.6 17a6.4 6.4 0 0 1 12.8 0z" />
            <path d="M1 18.8h22v2.4H1zM13.5 0v4.5h2.7L12 8.5 7.8 4.5h2.7V0z" />
        </g>
    ),
}

export function Glyph(props: { name: GlyphName; class?: string }) {
    return (
        <svg class={`wk-g ${props.class ?? ""}`} viewBox="0 0 24 24" aria-hidden="true">
            {glyphs[props.name]() as never}
        </svg>
    )
}

export function conditionGlyph(text: string, isDay = true): GlyphName {
    const t = text.toLowerCase()
    if (/thunder|t-?storm/.test(t)) {
        return "bolt"
    }
    if (/snow|flurr|blizzard|sleet|wintry/.test(t)) {
        return "snow"
    }
    if (/rain|shower|drizzle/.test(t)) {
        return "rain"
    }
    if (/fog|mist|haze|smoke|dust/.test(t)) {
        return "fog"
    }
    if (/partly/.test(t)) {
        return "partly"
    }
    if (/cloudy|overcast/.test(t)) {
        return "cloud"
    }
    return isDay ? "sun" : "moon"
}

// The one drawn animal in the app. Stamped in black like everything else that isn't ink.
export function Cat() {
    return (
        <svg class="wk-cat" viewBox="0 0 64 60" aria-hidden="true">
            <path
                fill="currentColor"
                d="M12 6 26 15q6-1.6 12 0L52 6l-1 18q5 6 5 13c0 13-11 21-24 21S8 50 8 37q0-7 5-13z"
            />
            <g fill="var(--g-gap, #fff)">
                <path d="M22 28q5 .5 7 5-5 2.6-8 .8-1.8-3 1-5.8zM42 28q-5 .5-7 5 5 2.6 8 .8 1.8-3-1-5.8z" />
                <path d="M28.5 41h7L32 45.2z" />
            </g>
            <g fill="currentColor">
                <path d="M24.6 29.4h1.8v5h-1.8zM37.6 29.4h1.8v5h-1.8z" />
            </g>
            <path
                d="M32 45.2v3.4M3 38h13M2 44l15-2.5M61 38H48M62 44l-15-2.5"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
            />
            <path d="M32 45.4v3" fill="none" stroke="var(--g-gap, #fff)" stroke-width="1.6" />
        </svg>
    )
}

// The score's one form. The number, and how many of the ten positions the lifty has punched out.
export function Punch(props: { score?: number; size?: "s" | "m" | "l" }) {
    const punched = () => Math.round((props.score ?? 0) / 10)
    const label = () => (props.score === undefined ? "No Condies score" : `Condies score ${props.score} out of 100`)
    return (
        <span class="wk-punch" data-size={props.size ?? "s"} role="img" aria-label={label()}>
            <b class="wk-punch-n">{props.score ?? "–"}</b>
            <span class="wk-punch-scale" aria-hidden="true">
                <For each={[1, 2, 3, 4, 5, 6, 7, 8, 9, 10]}>{(n) => <i data-on={n <= punched() ? "1" : "0"} />}</For>
            </span>
        </span>
    )
}

export function PowStamp(props: { size?: "s" | "l" }) {
    return (
        <span class="wk-pow" data-size={props.size ?? "s"}>
            POW DAY
        </span>
    )
}

export function PrimoFoil(props: { size?: "s" | "l" }) {
    return (
        <span class="wk-foil" data-size={props.size ?? "s"}>
            <b>PRIMO</b>
            <Show when={props.size === "l"}>
                <span>condies</span>
            </Show>
        </span>
    )
}

export function Highlight(props: { day: DaySummary; size?: "s" | "l" }) {
    return (
        <>
            <Show when={props.day.highlight === "pow"}>
                <PowStamp size={props.size} />
            </Show>
            <Show when={props.day.highlight === "primo"}>
                <PrimoFoil size={props.size} />
            </Show>
        </>
    )
}

export type Mode = "temp" | "precip" | "wind" | "snow"

const modeLabels: Record<Mode, string> = { temp: "Temp", precip: "Precip", wind: "Wind", snow: "Snow" }
const hourLabel = (hour: Period) => hour.hourString.replace(" AM", "a").replace(" PM", "p")

interface Reading {
    // 0 to 1, the height of the main bar and, where there's a second measurement, the thin one.
    thick: number
    thin?: number
    label: string
    read: string
    note: string
}

function readHours(hours: Period[], mode: Mode): Reading[] {
    if (mode === "precip") {
        return hours.map((h) => {
            const chance = h.probabilityOfPrecipitation.value
            return {
                thick: chance / 100,
                label: `${chance}`,
                read: `${chance}%`,
                note: h.shortForecast,
            }
        })
    }
    if (mode === "wind") {
        const speeds = hours.map((h) => h.windSpeed.value ?? 0)
        const gusts = hours.map((h) => h.windGust?.value ?? 0)
        const top = Math.max(15, ...speeds, ...gusts)
        return hours.map((h, i) => ({
            thick: speeds[i] / top,
            thin: gusts[i] > speeds[i] ? gusts[i] / top : undefined,
            label: `${speeds[i]}`,
            read: speeds[i] === 0 ? "Calm" : `${speeds[i]} mph`,
            note: gusts[i] > speeds[i] ? `${h.windDirection}, gusts ${gusts[i]} mph` : h.windDirection,
        }))
    }
    if (mode === "snow") {
        const snow = hours.map((h) => h.snowInches ?? 0)
        const top = Math.max(0.4, ...snow)
        let total = 0
        return hours.map((h, i) => {
            total += snow[i]
            return {
                thick: snow[i] / top,
                label: snow[i] >= 0.05 ? snow[i].toFixed(1) : "0",
                read: formatSnow(snow[i]),
                note: total >= 0.05 ? `${formatSnow(total)} by ${h.hourString}` : h.shortForecast,
            }
        })
    }
    const temps = hours.map((h) => h.temperature)
    const feels = hours.map((h) => Math.round(h.feelsLike ?? h.temperature))
    const low = Math.min(...temps, ...feels)
    const high = Math.max(...temps, ...feels)
    // Bars stand on 0°F, so 77° really is three quarters of 102°. Only subzero cold moves the floor.
    const floor = low < 0 ? Math.floor(low / 10) * 10 - 10 : 0
    const span = Math.max(high, floor + 10) - floor
    return hours.map((h, i) => ({
        thick: (temps[i] - floor) / span,
        thin: Math.abs(feels[i] - temps[i]) >= 3 ? (feels[i] - floor) / span : undefined,
        label: `${temps[i]}°`,
        read: `${temps[i]}°`,
        note: Math.abs(feels[i] - temps[i]) >= 3 ? `Feels ${feels[i]}°. ${h.shortForecast}` : h.shortForecast,
    }))
}

function summarize(hours: Period[], mode: Mode, reads: Reading[]) {
    const first = hours[0]
    const last = hours.at(-1)!
    const span = `${first.hourString} to ${last.hourString}`
    if (mode === "temp") {
        const temps = hours.map((h) => h.temperature)
        return `Hourly temperature from ${span}: starts at ${temps[0]} degrees, peaks at ${Math.max(...temps)}, bottoms at ${Math.min(...temps)}.`
    }
    if (mode === "precip") {
        const chances = hours.map((h) => h.probabilityOfPrecipitation.value)
        return `Hourly chance of precipitation from ${span}: highest ${Math.max(...chances)} percent.`
    }
    if (mode === "wind") {
        const speeds = hours.map((h) => h.windSpeed.value ?? 0)
        const gusts = hours.map((h) => h.windGust?.value ?? 0)
        return `Hourly wind from ${span}: up to ${Math.max(...speeds)} miles per hour, gusting to ${Math.max(...gusts, ...speeds)}.`
    }
    return `Hourly snow from ${span}: ${reads.at(-1)?.note ?? ""}.`
}

// The barcode. One bar per hour, the data in the bars. Tapping or dragging scans an hour for exact values.
export function Barcode(props: { hours: Period[]; limit?: number; nowFirst?: boolean }) {
    const hours = createMemo(() => props.hours.slice(0, props.limit ?? 24))
    const canSnow = createMemo(() => hours().some((h) => (h.snowInches ?? 0) >= 0.05))
    const [mode, setMode] = createSignal<Mode>("temp")
    const [picked, setPicked] = createSignal(0)

    const modes = (): Mode[] => (canSnow() ? ["temp", "precip", "wind", "snow"] : ["temp", "precip", "wind"])
    const reads = createMemo(() => readHours(hours(), mode()))
    const count = () => hours().length
    const [plotWidth, setPlotWidth] = createSignal(340)
    // Labels are spaced by how much room their widest value needs, so they never run together.
    const step = () => {
        const pitch = plotWidth() / count()
        const widest = Math.max(...reads().map((r) => r.label.length), 3)
        return Math.max(1, Math.ceil((widest * 9 + 7) / pitch))
    }

    const at = () => Math.min(picked(), count() - 1)
    const pickedRead = () => reads()[at()]
    const timeOf = (i: number) => (i === 0 && props.nowFirst ? "NOW" : (hours()[i]?.hourString.toUpperCase() ?? ""))

    let plot!: HTMLDivElement
    onSettled(() => {
        const observer = new ResizeObserver(([entry]) => setPlotWidth(entry.contentRect.width))
        observer.observe(plot)
        return () => observer.disconnect()
    })
    const pickFrom = (event: PointerEvent) => {
        const box = plot.getBoundingClientRect()
        const ratio = (event.clientX - box.left) / box.width
        setPicked(Math.max(0, Math.min(count() - 1, Math.floor(ratio * count()))))
    }
    const onDown = (event: PointerEvent) => {
        plot.setPointerCapture(event.pointerId)
        pickFrom(event)
    }
    const onMove = (event: PointerEvent) => {
        if (event.buttons || event.pointerType === "mouse") {
            pickFrom(event)
        }
    }
    const onKey = (event: KeyboardEvent) => {
        const delta = { ArrowLeft: -1, ArrowDown: -1, ArrowRight: 1, ArrowUp: 1 }[event.key]
        if (delta) {
            event.preventDefault()
            setPicked(Math.max(0, Math.min(count() - 1, at() + delta)))
        } else if (event.key === "Home" || event.key === "End") {
            event.preventDefault()
            setPicked(event.key === "Home" ? 0 : count() - 1)
        }
    }

    const legend = () => {
        const hasThin = reads().some((r) => r.thin !== undefined)
        if (mode() === "temp") {
            return hasThin ? "Thick bar: air. Thin bar: feels like." : ""
        }
        if (mode() === "wind") {
            return hasThin ? "Thick bar: wind. Thin bar: gusts." : "Wind in mph."
        }
        return mode() === "snow" ? "Inches of snow per hour." : "Chance of precipitation per hour."
    }

    return (
        <section class="wk-bc" aria-label="Hourly forecast">
            <div class="wk-bc-tabs" role="group" aria-label="What the barcode shows">
                <For each={modes()}>
                    {(m) => (
                        <button type="button" aria-pressed={mode() === m ? "true" : "false"} onClick={() => setMode(m)}>
                            {modeLabels[m]}
                        </button>
                    )}
                </For>
            </div>
            <p class="wk-bc-read">
                <span class="wk-dot wk-bc-time">{timeOf(at())}</span>
                <b>{pickedRead().read}</b>
                <span class="wk-bc-note">{pickedRead().note}</span>
            </p>
            <div
                ref={plot}
                class="wk-bc-plot"
                style={{ "--n": count() }}
                role="slider"
                tabindex="0"
                aria-label={summarize(hours(), mode(), reads())}
                aria-valuemin={0}
                aria-valuemax={count() - 1}
                aria-valuenow={at()}
                aria-valuetext={`${timeOf(at())}: ${pickedRead().read}, ${pickedRead().note}`}
                onPointerDown={onDown}
                onPointerMove={onMove}
                onKeyDown={onKey}
            >
                <i class="wk-bc-guard" aria-hidden="true" />
                <For each={reads()}>
                    {(reading, i) => (
                        <div
                            class="wk-bc-col"
                            data-on={i() === at() ? "1" : "0"}
                            data-tick={i() % step() === 0 ? "1" : "0"}
                        >
                            <div class="wk-bc-bars" aria-hidden="true">
                                <i class="wk-bc-hair" />
                                <i class="wk-bc-thick" style={{ height: `${Math.max(3, reading.thick * 100)}%` }} />
                                <Show when={reading.thin !== undefined}>
                                    <i
                                        class="wk-bc-thin"
                                        style={{ height: `${Math.max(3, (reading.thin ?? 0) * 100)}%` }}
                                    />
                                </Show>
                            </div>
                            <Show when={i() % step() === 0}>
                                <span class="wk-bc-v wk-dot" aria-hidden="true">
                                    {reading.label}
                                </span>
                                <span class="wk-bc-h wk-dot" aria-hidden="true">
                                    {hourLabel(hours()[i()])}
                                </span>
                            </Show>
                        </div>
                    )}
                </For>
                <i class="wk-bc-guard" aria-hidden="true" />
            </div>
            <p class="wk-bc-legend">{legend()} Slide along the bars to scan an hour.</p>
        </section>
    )
}

// Sets a line to fill its measure the way a printer would, within a width range that still looks like the
// same typeface. Below the floor the type gets smaller, then wraps, rather than being crushed.
const MIN_STRETCH = 84

export function fitWidth(element: HTMLElement) {
    const run = () => {
        const parent = element.parentElement
        if (!parent) {
            return
        }
        const space = parent.clientWidth
        const style = getComputedStyle(parent)
        const base = parseFloat(style.fontSize)
        const max = parseFloat(style.getPropertyValue("--fit-max")) || base
        element.style.whiteSpace = "nowrap"
        element.style.fontSize = `${base}px`
        let low = MIN_STRETCH
        let high = 150
        for (let i = 0; i < 7; i++) {
            const middle = (low + high) / 2
            element.style.fontStretch = `${middle}%`
            if (element.offsetWidth > space) {
                high = middle
            } else {
                low = middle
            }
        }
        element.style.fontStretch = `${low}%`
        const width = element.offsetWidth
        if (width > space) {
            const shrunk = (base * space) / width
            if (shrunk >= base * 0.74) {
                element.style.fontSize = `${shrunk}px`
            } else {
                element.style.fontSize = `${base * 0.8}px`
                element.style.whiteSpace = "normal"
                // A single long word can still be wider than the measure once the line has wrapped.
                if (element.scrollWidth > space) {
                    element.style.fontSize = `${(base * 0.8 * space) / element.scrollWidth}px`
                }
            }
        } else if (low > 148) {
            element.style.fontSize = `${Math.min(max, (base * space) / width)}px`
        }
    }
    run()
    document.fonts.ready.then(run)
    const observer = new ResizeObserver(run)
    observer.observe(element.parentElement!)
    return () => observer.disconnect()
}
