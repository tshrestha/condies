import { For, Show } from "solid-js"

import { formatSnow } from "../../lib/daily.ts"
import type { Period } from "../../lib/nws.ts"

import { deg, speedOf, type View } from "./wx.ts"

interface Mark {
    i: number
    y: number
    text: string
    below?: boolean
}

// Every chart in the app has exactly this title, so a reader always knows what the marks measure.
export const chartTitle: Record<View, string> = {
    temp: "Temperature",
    precip: "Precip chance",
    wind: "Wind and gusts",
    snow: "Snow each hour",
}

const gustOf = (p: Period) => Math.max(p.windGust?.value ?? 0, speedOf(p))

function valuesFor(view: View, hours: Period[]) {
    switch (view) {
        case "temp":
            return hours.map((p) => p.temperature)
        case "precip":
            return hours.map((p) => p.probabilityOfPrecipitation.value)
        case "wind":
            return hours.map(speedOf)
        case "snow":
            return hours.map((p) => p.snowInches ?? 0)
    }
}

// Hourly snow is a rate, so its label says so and can't be mistaken for a total.
const valueLabel = (view: View, value: number) =>
    view === "temp"
        ? deg(value)
        : view === "precip"
          ? `${value}%`
          : view === "wind"
            ? `${value} mph`
            : `${formatSnow(value)} an hour`

// Keeps labelled points apart so no two labels collide.
function spaced(indexes: number[], gap: number) {
    const kept: number[] = []
    for (const i of indexes) {
        if (kept.every((k) => Math.abs(k - i) >= gap)) {
            kept.push(i)
        }
    }
    return kept
}

export function summary(view: View, hours: Period[], span: string) {
    const values = valuesFor(view, hours)
    const max = Math.max(...values)
    const at = hours[values.indexOf(max)]?.hourString
    switch (view) {
        case "temp": {
            const min = Math.min(...values)
            return `Temperature ${span}: ${deg(values[0])} at first, high ${deg(max)} at ${at}, low ${deg(min)} at ${hours[values.indexOf(min)].hourString}.`
        }
        case "precip":
            return `Chance of rain or snow ${span}: highest ${max}% at ${at}.`
        case "wind":
            return `Wind ${span}: strongest ${max} mph at ${at}, gusts up to ${Math.max(...hours.map(gustOf))} mph.`
        case "snow":
            return `Snow each hour ${span}: at most ${formatSnow(max)} an hour, at ${at}; ${formatSnow(values.reduce((t, v) => t + v, 0))} in all.`
    }
}

// The one chart: a title, one series in white on the panel, a baseline, and direct labels. A narrow chart (the
// twelve-hour sign on Home) is shorter and keeps only its end ticks, but is otherwise the same.
export function HourChart(props: { hours: Period[]; view: View; span: string; nowLabel?: boolean; narrow?: boolean }) {
    const isLine = () => props.view === "temp"
    const top = 24
    const plot = () => (props.narrow ? (isLine() ? 50 : 34) : 72)
    const base = () => top + plot()
    const n = () => props.hours.length
    const values = () => valuesFor(props.view, props.hours)

    const scale = () => {
        const v = values()
        if (isLine()) {
            const min = Math.min(...v)
            const span = Math.max(Math.max(...v) - min, 6)
            // Leaves room under the line for a label that goes below it.
            return (value: number) => top + 2 + (1 - (value - min) / span) * (plot() - 28)
        }
        const ceiling =
            props.view === "precip"
                ? 100
                : props.view === "wind"
                  ? Math.max(20, ...props.hours.map(gustOf))
                  : Math.max(0.5, ...v)
        return (value: number) => base() - (value / ceiling) * plot()
    }

    const x = (i: number) => ((i + 0.5) / n()) * 100

    const marks = (): Mark[] => {
        const v = values()
        const y = scale()
        if (isLine()) {
            const max = v.indexOf(Math.max(...v))
            const min = v.indexOf(Math.min(...v))
            const gap = props.narrow ? Math.ceil(n() / 2.2) : Math.max(2, Math.round(n() / 5))
            // A label goes on the side the line doesn't, so it never covers the line it names.
            const lineAbove = (i: number) => {
                const near = [v[i - 1], v[i + 1]].filter((value) => value !== undefined)
                return near.reduce((t, value) => t + value, 0) / near.length > v[i]
            }
            return spaced([0, max, min, n() - 1], gap).map((i) => ({
                i,
                y: y(v[i]),
                text: valueLabel("temp", v[i]),
                below: i !== max && (i === min || lineAbove(i)),
            }))
        }
        const peak = Math.max(...v)
        if (peak <= 0) {
            return []
        }
        const i = v.indexOf(peak)
        const gust = gustOf(props.hours[i])
        const windy = props.view === "wind" && gust > peak
        return [
            {
                i,
                y: windy ? y(gust) : y(peak),
                text: windy ? `${peak}, gusts ${gust} mph` : valueLabel(props.view, peak),
            },
        ]
    }

    const ticks = () => {
        const all = props.hours.map((p, i) => ({ i, p }))
        if (props.narrow) {
            return [all[0], all[n() - 1]]
        }
        const step = n() <= 13 ? 3 : 6
        return all.filter(({ i }) => i % step === 0)
    }

    const linePath = () => {
        const y = scale()
        return values()
            .map((v, i) => `${i ? "L" : "M"}${(i + 0.5) * 10} ${y(v)}`)
            .join("")
    }

    const align = (i: number) => (x(i) < 15 ? "start" : x(i) > 85 ? "end" : "mid")

    return (
        <figure
            class="mm-chart"
            data-narrow={props.narrow ? "" : undefined}
            role="img"
            aria-label={summary(props.view, props.hours, props.span)}
        >
            <figcaption class="mm-chart-title" aria-hidden="true">
                {chartTitle[props.view]}
            </figcaption>
            <div class="mm-chart-plot" style={{ height: `${base()}px` }}>
                <svg
                    class="mm-chart-svg"
                    viewBox={`0 0 ${n() * 10} ${base()}`}
                    preserveAspectRatio="none"
                    aria-hidden="true"
                    style={{ height: `${base()}px` }}
                >
                    <Show
                        when={isLine()}
                        fallback={
                            <For each={values()}>
                                {(v, i) => {
                                    const y = () => scale()(v)
                                    const gustY = () => scale()(gustOf(props.hours[i()]))
                                    return (
                                        <>
                                            <Show when={props.view === "wind" && gustOf(props.hours[i()]) > v}>
                                                <rect
                                                    class="mm-chart-gust"
                                                    x={i() * 10 + 1.8}
                                                    y={gustY()}
                                                    width="6.4"
                                                    height={Math.max(0, y() - gustY())}
                                                />
                                            </Show>
                                            <rect
                                                class="mm-chart-bar"
                                                x={i() * 10 + 1.5}
                                                y={y()}
                                                width="7"
                                                height={Math.max(v > 0 ? 1.5 : 0, base() - y())}
                                            />
                                        </>
                                    )
                                }}
                            </For>
                        }
                    >
                        <path class="mm-chart-line" d={linePath()} />
                    </Show>
                    <path class="mm-chart-base" d={`M0 ${base()}H${n() * 10}`} />
                </svg>
                <Show when={isLine()}>
                    <For each={marks()}>
                        {(m) => <i class="mm-chart-dot" style={{ left: `${x(m.i)}%`, top: `${m.y}px` }} />}
                    </For>
                </Show>
                <For each={marks()}>
                    {(m) => (
                        <span
                            class="mm-chart-val"
                            data-align={align(m.i)}
                            data-below={m.below ? "" : undefined}
                            style={{ left: `${x(m.i)}%`, top: `${m.y}px` }}
                        >
                            {m.text}
                        </span>
                    )}
                </For>
            </div>
            <div class="mm-chart-ticks" aria-hidden="true">
                <For each={ticks()}>
                    {(t) => (
                        <span data-align={align(t.i)} style={{ left: `${x(t.i)}%` }}>
                            {t.i === 0 && props.nowLabel ? "Now" : t.p.hourString}
                        </span>
                    )}
                </For>
            </div>
        </figure>
    )
}
