import { createMemo, createSignal, For, Show } from "solid-js"

import { type Paint, paintTemp, type Theme } from "../design/ramp.ts"
import { degrees, windSpeed } from "../design/words.ts"
import { formatSnow } from "../lib/daily.ts"
import type { Period } from "../lib/nws.ts"

// The Day screen's hourly chart: one series at a time, one column per hour on a baseline, labels only at the
// ends and the extremes. A sentence above states the reading and is the chart's text alternative.

type View = "temp" | "precip" | "wind" | "snow"

interface Column {
    hour: string
    height: number
    paint?: Paint
    gust?: number
    label?: string
    // Where a label sits: above the tallest bar it spans, so it never overlaps a neighbor.
    top?: number
    align?: "start" | "center" | "end"
}

const viewNames: Record<View, string> = { temp: "Temp", precip: "Precip", wind: "Wind", snow: "Snow" }

// A few labels are enough: the ends and the extremes, never two crowding each other.
function pick(indexes: number[], count: number) {
    const chosen: number[] = []
    for (const i of indexes) {
        if (i >= 0 && i < count && chosen.every((c) => Math.abs(c - i) >= 3)) {
            chosen.push(i)
        }
    }
    return chosen
}

const argmax = (values: number[]) => values.indexOf(Math.max(...values))
const argmin = (values: number[]) => values.indexOf(Math.min(...values))

function place(columns: Column[], labels: Map<number, string>) {
    const n = columns.length
    for (const [i, label] of labels) {
        const align = i <= 1 ? "start" : i >= n - 2 ? "end" : "center"
        const span = align === "start" ? [i, i + 1, i + 2] : align === "end" ? [i - 2, i - 1, i] : [i - 1, i, i + 1]
        const top = Math.max(
            ...span.filter((j) => j >= 0 && j < n).map((j) => Math.max(columns[j].height, columns[j].gust ?? 0)),
        )
        columns[i] = { ...columns[i], label, top, align }
    }
    return columns
}

function describe(hours: Period[], view: View, theme: Theme): { summary: string; columns: Column[] } {
    const at = (i: number) => hours[i].hourString
    const n = hours.length
    const labels = new Map<number, string>()
    if (view === "temp") {
        const t = hours.map((h) => h.temperature)
        const max = Math.max(...t)
        const min = Math.min(...t)
        const floor = min - Math.max(6, (max - min) * 0.7)
        for (const i of pick([argmax(t), argmin(t), 0, n - 1], n)) {
            labels.set(i, degrees(t[i]))
        }
        const columns = hours.map((h) => ({
            hour: h.hourString,
            height: (h.temperature - floor) / (max - floor || 1),
            paint: paintTemp(h.temperature, theme),
        }))
        return {
            summary:
                max === min
                    ? `Steady at ${degrees(max)}.`
                    : `Warmest ${degrees(max)} at ${at(argmax(t))}, coldest ${degrees(min)} at ${at(argmin(t))}.`,
            columns: place(columns, labels),
        }
    }
    if (view === "precip") {
        const c = hours.map((h) => h.probabilityOfPrecipitation.value)
        const top = argmax(c)
        const kind = hours.some((h) => (h.snowInches ?? 0) >= 0.02) ? "snow" : "rain"
        if (c[top] > 0) {
            labels.set(top, `${c[top]}%`)
        }
        const columns = hours.map((h, i) => ({ hour: h.hourString, height: c[i] / 100 }))
        return {
            summary: c[top] > 0 ? `Chance of ${kind} peaks at ${c[top]}% at ${at(top)}.` : "No rain or snow.",
            columns: place(columns, labels),
        }
    }
    if (view === "wind") {
        const w = hours.map(windSpeed)
        const g = hours.map((h) => Math.max(h.windGust?.value ?? 0, windSpeed(h)))
        const scale = Math.max(20, ...g)
        const top = argmax(w)
        const gustTop = argmax(g)
        const gusty = g[gustTop] > w[top]
        // The gust marks get words of their own, so the chart needs no key.
        if (gusty && Math.abs(gustTop - top) < 3) {
            labels.set(gustTop, `${w[top]} mph, gusts ${g[gustTop]}`)
        } else {
            labels.set(top, `${w[top]} mph`)
            if (gusty) {
                labels.set(gustTop, `gusts ${g[gustTop]}`)
            }
        }
        const columns = hours.map((h, i) => ({
            hour: h.hourString,
            height: w[i] / scale,
            gust: g[i] > w[i] ? g[i] / scale : undefined,
        }))
        return {
            summary: `Wind up to ${w[top]} mph${gusty ? `, gusts to ${g[gustTop]} mph` : ""}.`,
            columns: place(columns, labels),
        }
    }
    const s = hours.map((h) => h.snowInches ?? 0)
    const top = argmax(s)
    const total = s.reduce((a, b) => a + b, 0)
    const scale = Math.max(0.5, s[top])
    if (s[top] >= 0.05) {
        labels.set(top, `${formatSnow(s[top])} an hour`)
    }
    const columns = hours.map((h, i) => ({ hour: h.hourString, height: s[i] / scale }))
    return {
        summary: `${formatSnow(total)} of snow, heaviest at ${at(top)}.`,
        columns: place(columns, labels),
    }
}

export function Hourly(props: { hours: Period[]; title: string; theme: Theme }) {
    const [view, setView] = createSignal<View>("temp")
    const views = () => {
        const list: View[] = ["temp", "precip", "wind"]
        if (props.hours.some((h) => (h.snowInches ?? 0) >= 0.05)) {
            list.push("snow")
        }
        return list
    }
    const chart = createMemo(() => describe(props.hours, view(), props.theme))
    const step = () => (props.hours.length > 14 ? 6 : 3)
    // An hour's label is wider than its column, so none starts within two columns of the end, where it would run
    // past the chart's edge.
    const axisLabel = (i: number) => i % step() === 0 && i <= props.hours.length - 3

    return (
        <section class="sq-hourly" aria-label={props.title}>
            <div class="sq-hourly-head">
                <h2 class="sq-strong">{props.title}</h2>
                <div class="sq-tabs" role="group" aria-label="Hourly view">
                    <For each={views()}>
                        {(name) => (
                            <button
                                type="button"
                                class="sq-tab"
                                aria-pressed={view() === name ? "true" : "false"}
                                onClick={() => setView(name)}
                            >
                                {viewNames[name]}
                            </button>
                        )}
                    </For>
                </div>
            </div>
            <p class="sq-chart-summary" aria-live="polite">
                {chart().summary}
            </p>
            <div class="sq-chart" role="img" aria-label={`${props.title}. ${chart().summary}`} data-view={view()}>
                <ol class="sq-cols">
                    <For each={chart().columns}>
                        {(col) => (
                            <li
                                class="sq-col"
                                data-align={col.align}
                                style={{ "--h": col.height.toFixed(3), "--t": (col.top ?? col.height).toFixed(3) }}
                            >
                                <i class="sq-bar" style={col.paint ? { background: col.paint.bg } : undefined} />
                                <Show when={col.gust}>
                                    <i class="sq-gust" style={{ "--g": col.gust!.toFixed(3) }} />
                                </Show>
                                <Show when={col.label}>
                                    <span class="sq-col-label">{col.label}</span>
                                </Show>
                            </li>
                        )}
                    </For>
                </ol>
                <ol class="sq-axis">
                    <For each={chart().columns}>{(col, i) => <li>{axisLabel(i()) ? col.hour : ""}</li>}</For>
                </ol>
            </div>
        </section>
    )
}
