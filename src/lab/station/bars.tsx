import { createMemo, For, Show } from "solid-js"

import type { Period } from "../../lib/nws.ts"
import type { LabForecast } from "../data.ts"

import { gustOf, type Mode, rainNumber, rainOf, snowNumber, snowOf, windOf } from "./wx.ts"

// The LCD bar graph: one column of stacked blocks per hour, one series at a time, a few direct labels.
export const LEVELS = 8

interface Label {
    value: string
    unit: string
    align: "start" | "center" | "end"
    // The tallest stack the label passes over, so it never sits on a neighbor's blocks.
    top?: number
}

interface Column {
    lit: number
    // A single unlit-looking block above the stack, for gusts, like a meter's peak hold.
    peak: number
    label?: Label
}

// Rough label width in px for 16px bold figures and unit, against a window about 330px wide.
const labelColumns = (label: Label, n: number) => Math.ceil(((label.value + label.unit).length * 9.5 + 6) / (330 / n))

function clearNeighbors(columns: Column[]) {
    const n = columns.length
    columns.forEach((column, i) => {
        const label = column.label
        if (!label) {
            return
        }
        const span = labelColumns(label, n)
        const from = label.align === "start" ? i : label.align === "end" ? i - span + 1 : i - Math.floor(span / 2)
        const covered = columns.slice(Math.max(0, from), Math.min(n, from + span))
        label.top = Math.max(...covered.map((c) => Math.max(c.lit, c.peak)))
    })
}

const argmax = (values: number[]) => values.reduce((best, v, i) => (v > values[best] ? i : best), 0)
const argmin = (values: number[]) => values.reduce((best, v, i) => (v < values[best] ? i : best), 0)

// Picks up to `limit` columns to label, in priority order, never two within `gap` columns of each other
// and never the same value twice.
function pick(candidates: number[], gap: number, values: number[], limit = 3) {
    const chosen: number[] = []
    for (const i of candidates) {
        const apart = chosen.every((c) => Math.abs(c - i) >= gap && values[c] !== values[i])
        if (chosen.length < limit && apart) {
            chosen.push(i)
        }
    }
    return chosen
}

// A running total: the last column is the whole amount, so nothing needs summing in your head.
function addUp(columns: Column[], amounts: number[], floor: number, least: number) {
    let running = 0
    const totals = amounts.map((a) => (running += a))
    const scale = Math.max(running, floor)
    totals.forEach((t, i) => (columns[i].lit = t >= least ? Math.max(1, Math.round((t / scale) * LEVELS)) : 0))
    return running
}

function build(hours: Period[], mode: Mode, grid: LabForecast["grid"], totalShown = false) {
    const n = hours.length
    const gap = Math.max(3, Math.round(n / 4))
    const align = (i: number): Label["align"] => (i <= 0 ? "start" : i >= n - 1 ? "end" : "center")
    const columns: Column[] = hours.map(() => ({ lit: 0, peak: 0 }))
    let summary = ""

    if (mode === "temp") {
        const temps = hours.map((p) => p.temperature)
        const lo = Math.min(...temps)
        const span = Math.max(Math.max(...temps) - lo, 8)
        temps.forEach((t, i) => (columns[i].lit = 1 + Math.round(((t - lo) / span) * (LEVELS - 1))))
        const hi = argmax(temps)
        const low = argmin(temps)
        for (const i of pick([0, hi, low, n - 1], gap, temps)) {
            columns[i].label = { value: String(temps[i]), unit: "°", align: align(i) }
        }
        summary = `Temperature: ${temps[0]}° now, high ${temps[hi]}° at ${hours[hi].hourString}, low ${temps[low]}° at ${hours[low].hourString}.`
    } else if (mode === "precip" && rainOf(hours, grid)) {
        const total = addUp(columns, rainOf(hours, grid)!, 0.5, 0.005)
        // Where a readout above already says the total, the end label would only repeat it.
        if (!totalShown) {
            columns[n - 1].label = { value: rainNumber(total), unit: "″", align: "end" }
        }
        summary = `Rain adding up to ${rainNumber(total)} inches by ${hours[n - 1].hourString}.`
    } else if (mode === "precip") {
        const chances = hours.map((p) => p.probabilityOfPrecipitation.value ?? 0)
        chances.forEach((c, i) => (columns[i].lit = Math.round(c / (100 / LEVELS))))
        const top = argmax(chances)
        for (const i of pick(chances[top] > 0 ? [top, 0, n - 1] : [0], gap, chances, 2)) {
            columns[i].label = { value: String(chances[i]), unit: "%", align: align(i) }
        }
        summary = chances[top]
            ? `Chance of precipitation: ${chances[0]}% now, up to ${chances[top]}% at ${hours[top].hourString}.`
            : "Chance of precipitation: 0% all through."
    } else if (mode === "wind") {
        const speeds = hours.map(windOf)
        const gusts = hours.map((p) => gustOf(p) ?? 0)
        const scale = Math.max(20, ...speeds, ...gusts)
        speeds.forEach((s, i) => {
            columns[i].lit = s > 0 ? Math.max(1, Math.round((s / scale) * LEVELS)) : 0
            if (gusts[i]) {
                columns[i].peak = Math.min(
                    LEVELS,
                    Math.max(columns[i].lit + 1, Math.round((gusts[i] / scale) * LEVELS)),
                )
            }
        })
        const gustAt = argmax(gusts)
        const fastest = argmax(speeds)
        const order = gusts[gustAt] ? [gustAt, 0] : [fastest, 0]
        const shown = speeds.map((s, i) => (gusts[gustAt] && i === gustAt ? gusts[i] : s))
        for (const i of pick(order, gap, shown, 2)) {
            const isGust = gusts[gustAt] > 0 && i === gustAt
            columns[i].label = {
                value: String(isGust ? gusts[i] : speeds[i]),
                unit: isGust ? "mph gusts" : "mph",
                align: align(i),
            }
        }
        summary = `Wind: ${speeds[0]} mph now, strongest ${speeds[fastest]} mph at ${hours[fastest].hourString}${
            gusts[gustAt] ? `, gusts up to ${gusts[gustAt]} mph at ${hours[gustAt].hourString}` : ""
        }.`
    } else {
        const total = addUp(columns, hours.map(snowOf), 1, 0.05)
        if (!totalShown) {
            columns[n - 1].label = { value: snowNumber(total), unit: "″", align: "end" }
        }
        summary = `Snow adding up to ${snowNumber(total)} inches by ${hours[n - 1].hourString}.`
    }
    clearNeighbors(columns)
    return { columns, summary }
}

export function Bars(props: {
    hours: Period[]
    mode: Mode
    grid: LabForecast["grid"]
    title: string
    totalShown?: boolean
}) {
    const built = createMemo(() => build(props.hours, props.mode, props.grid, props.totalShown))
    return (
        <div
            class="ws-bars"
            data-mode={props.mode}
            data-labels={built().columns.some((c) => c.label) ? "true" : undefined}
            role="img"
            aria-label={`${props.title}. ${built().summary}`}
            style={{ "--n": props.hours.length }}
        >
            <For each={built().columns}>
                {(column, i) => (
                    <div
                        class="ws-col"
                        style={{ "--i": i(), "--top": column.label?.top ?? Math.max(column.lit, column.peak) }}
                        data-label={column.label ? column.label.align : undefined}
                    >
                        <For each={Array.from({ length: LEVELS }, (_, k) => LEVELS - k)}>
                            {(level) => (
                                <i
                                    class="ws-block"
                                    data-on={level <= column.lit ? "lit" : level === column.peak ? "peak" : undefined}
                                />
                            )}
                        </For>
                        <Show when={column.label}>
                            {(label) => (
                                <span class="ws-bar-label" data-align={label().align}>
                                    {label().value}
                                    {label().unit.startsWith("mph") ? ` ${label().unit}` : label().unit}
                                </span>
                            )}
                        </Show>
                    </div>
                )}
            </For>
        </div>
    )
}

// Printed on the face under the window, like the hour marks under a barometer's bar graph.
export function Axis(props: { hours: Period[]; now?: boolean }) {
    const every = () => (props.hours.length <= 13 ? 3 : 6)
    return (
        <div class="ws-axis" aria-hidden="true" style={{ "--n": props.hours.length }}>
            <For each={props.hours}>
                {(hour, i) => (
                    <span class="ws-tick" data-edge={i() === 0 ? "start" : undefined}>
                        {i() % every() === 0 ? (i() === 0 && props.now ? "Now" : hour.hourString) : ""}
                    </span>
                )}
            </For>
        </div>
    )
}
