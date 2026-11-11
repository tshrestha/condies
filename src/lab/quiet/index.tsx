import "@fontsource-variable/chivo/wght.css"
import "../../design/tokens.css"
import "../../design/components.css"
import "./quiet.css"
// After quiet.css, so the split's wide padding still wins over My Spots' head as it did before Home moved out.
import "../../home/home.css"

import { createMemo, createSignal, For, Match, Show, Switch } from "solid-js"

import { Dock as DesignDock, Masthead as DesignMasthead } from "../../design/nav.tsx"
import { Score, Sheet as SheetFrame } from "../../design/parts.tsx"
import { ErrorState, LoadingState, OfflineNotice } from "../../design/states.tsx"
import { type Paint, paintDay, paintTemp, paintVars } from "../../design/ramp.ts"
import { dayName, degrees, highlightWord, sentence, shortDate, snowLine, windSpeed } from "../../design/words.ts"
import { type Avalanche, type HomeCtx, HomeScreen as Home } from "../../home/sections.tsx"
import { AlertSheet, AvalancheSheet } from "../../home/sheets.tsx"
import { type DaySummary, formatSnow, formatWindRange, getDayLabel, hasSnow } from "../../lib/daily.ts"
import { type AlertView, rankSpots } from "../../lib/forecastView.ts"
import type { Period } from "../../lib/nws.ts"
import { formatAge } from "../../lib/util.ts"
import type { DesignProps } from "../data.ts"

type Sheet = { kind: "alert"; alert: AlertView } | { kind: "avalanche"; avalanche: Avalanche } | { kind: "search" }

interface Ctx {
    app: DesignProps
    open: (sheet: Sheet) => void
}

const dateOf = (p: Period) => p.startTime.slice(0, 10)

const otherTheme = (app: DesignProps) => (app.theme === "light" ? "dark" : "light")

// The shared top bar and dock, wired to the lab's own navigation.
function Masthead(props: Ctx) {
    return (
        <DesignMasthead
            theme={props.app.theme}
            onToggleTheme={() => props.app.setTheme(otherTheme(props.app))}
            home={props.app.link({ name: "home" })}
            spots={props.app.link({ name: "spots" })}
            onSearch={() => props.open({ kind: "search" })}
            map={{ href: "#", onClick: (e) => e.preventDefault() }}
        />
    )
}

function Dock(props: Ctx) {
    const screen = () => props.app.screen.name
    return (
        <DesignDock
            theme={props.app.theme}
            onToggleTheme={() => props.app.setTheme(otherTheme(props.app))}
            home={props.app.link({ name: "home" })}
            spots={props.app.link({ name: "spots" })}
            onSearch={() => props.open({ kind: "search" })}
            map={{ href: "#", onClick: (e) => e.preventDefault() }}
            current={screen() === "home" ? "home" : screen() === "spots" ? "spots" : undefined}
            now={paintTemp(props.app.forecast.current.temperature, props.app.theme)}
        />
    )
}

// Home is shared with the app. The lab wires it to its own links, a star that only remembers itself, and a
// refresh that only says it happened.
function HomeScreen(props: Ctx) {
    const f = () => props.app.forecast
    const [starred, setStarred] = createSignal(false)
    const [refreshed, setRefreshed] = createSignal(false)
    const home: HomeCtx = {
        get forecast() {
            return props.app.forecast
        },
        get theme() {
            return props.app.theme
        },
        dayLink: (date) => props.app.link({ name: "day", date }),
        openAlert: (alert) => props.open({ kind: "alert", alert }),
        openAvalanche: (avalanche) => props.open({ kind: "avalanche", avalanche }),
    }
    return (
        <Home
            {...home}
            saved={starred()}
            onToggleSave={() => setStarred(!starred())}
            updated={refreshed() ? "just now" : formatAge(f().now - Date.parse(f().updatedAt))}
            onRefresh={() => setRefreshed(true)}
        >
            <Masthead {...props} />
        </Home>
    )
}

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

function describe(hours: Period[], view: View, theme: DesignProps["theme"]): { summary: string; columns: Column[] } {
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

function Hourly(props: { app: DesignProps; hours: Period[]; title: string }) {
    const [view, setView] = createSignal<View>("temp")
    const views = () => {
        const list: View[] = ["temp", "precip", "wind"]
        if (props.hours.some((h) => (h.snowInches ?? 0) >= 0.05)) {
            list.push("snow")
        }
        return list
    }
    const chart = createMemo(() => describe(props.hours, view(), props.app.theme))
    const step = () => (props.hours.length > 14 ? 6 : 3)

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
                    <For each={chart().columns}>{(col, i) => <li>{i() % step() === 0 ? col.hour : ""}</li>}</For>
                </ol>
            </div>
        </section>
    )
}

// The neighboring days in words. Color stays for temperatures that carry the screen's meaning.
function Pager(props: Ctx & { index: number }) {
    const f = () => props.app.forecast
    const prev = () => (props.index > 0 ? f().days[props.index - 1] : undefined)
    const next = () => f().days[props.index + 1]
    return (
        <nav class="sq-ground sq-pager" aria-label="Other days">
            <Show
                when={prev()}
                fallback={
                    <a class="sq-page" {...props.app.link({ name: "home" })}>
                        <span aria-hidden="true">←</span> Now {degrees(f().current.temperature)}
                    </a>
                }
            >
                {(day) => (
                    <a
                        class="sq-page"
                        aria-label={`Previous day, ${dayName(day(), props.index - 1)}`}
                        {...props.app.link({ name: "day", date: day().date })}
                    >
                        <span aria-hidden="true">←</span> {dayName(day(), props.index - 1)}{" "}
                        {degrees(day().high ?? day().low)}
                    </a>
                )}
            </Show>
            <Show when={next()} fallback={<span class="sq-page sq-page-end">Last day of the forecast</span>}>
                {(day) => (
                    <a
                        class="sq-page sq-page-next"
                        aria-label={`Next day, ${dayName(day(), props.index + 1)}`}
                        {...props.app.link({ name: "day", date: day().date })}
                    >
                        {dayName(day(), props.index + 1)} {degrees(day().high ?? day().low)}{" "}
                        <span aria-hidden="true">→</span>
                    </a>
                )}
            </Show>
        </nav>
    )
}

function DayView(props: Ctx & { day: DaySummary; index: number }) {
    const f = () => props.app.forecast
    const name = () => dayName(props.day, props.index)
    const period = () => props.day.day ?? props.day.night
    const marker = () => highlightWord(props.day)
    const insight = () => snowLine(props.day)
    const hours = createMemo(() => {
        const own = f().hours.filter((h) => dateOf(h) === props.day.date)
        // Late in the day, today alone is only a few hours, so it runs on into the night.
        return props.index === 0 && own.length < 12 ? f().hours.slice(0, 12) : own
    })
    const hoursTitle = () =>
        props.index === 0 && hours().length && dateOf(hours().at(-1)!) !== props.day.date
            ? "Next 12 hours"
            : `Hour by hour`

    return (
        <div class="sq-dayview">
            <Masthead {...props} />
            <Pager {...props} index={props.index} />
            <div class="sq-split">
                <div class="sq-lead">
                    <section class="sq-chip sq-dayhero" style={paintVars(paintDay(props.day, props.app.theme))}>
                        <h1 class="sq-num">{name()}</h1>
                        <p>
                            {shortDate(props.day.date, true)} · {f().place.city}
                        </p>
                        <p class="sq-dayhero-temps">
                            <Show when={props.day.high !== undefined}>
                                <span>
                                    High <span class="sq-xl">{degrees(props.day.high)}</span>
                                </span>
                            </Show>
                            <Show when={props.day.low !== undefined}>
                                <span>
                                    Low <span class="sq-num sq-low">{degrees(props.day.low)}</span>
                                </span>
                            </Show>
                        </p>
                        <p>{sentence(period()?.shortForecast ?? "")}</p>
                        <Show when={marker()}>
                            <p class="sq-num sq-marker">{marker()}</p>
                        </Show>
                    </section>
                </div>
                <div class="sq-rest">
                    <Show when={props.day.condies}>
                        {(condies) => (
                            <section class="sq-ground sq-scorerow" aria-label="Condies score">
                                <p class="sq-best-head">
                                    <span class="sq-small">Best window</span>
                                    <span class="sq-num">{condies().bestWindow}</span>
                                </p>
                                <Score score={condies().score} />
                            </section>
                        )}
                    </Show>
                    <section class="sq-ground sq-stats" aria-label="Details">
                        <p>
                            <span class="sq-num">{props.day.precipChance}%</span> chance of {props.day.precipType}
                        </p>
                        <Show when={hasSnow(props.day)}>
                            <p>
                                <span class="sq-num">{formatSnow(props.day.snow ?? 0)}</span> of snow
                            </p>
                        </Show>
                        <p>
                            <span class="sq-num">{formatWindRange(props.day)}</span> wind
                            <Show when={props.day.gust !== undefined && props.day.gust > props.day.windMax}>
                                , gusts {props.day.gust} mph
                            </Show>
                        </p>
                        <Show when={props.index === 0 && f().sun}>
                            {(sun) => (
                                <p class="sq-sunline">
                                    Sunrise {sun().sunrise}, sunset {sun().sunset}
                                </p>
                            )}
                        </Show>
                    </section>
                    <Show when={insight()}>
                        {(line) => (
                            <section class="sq-ground sq-insight" aria-label="Rain and snow line">
                                <p class="sq-strong">{line().lead}</p>
                                <p>{line().detail}</p>
                            </section>
                        )}
                    </Show>
                    <Show when={hours().length}>
                        <Hourly app={props.app} hours={hours()} title={hoursTitle()} />
                    </Show>
                    <section class="sq-ground sq-periods" aria-label="Forecast text">
                        <For each={props.day.periods}>
                            {(p) => (
                                <article class="sq-period">
                                    <h2 class="sq-period-head">
                                        <span class="sq-strong">{p.name}</span>
                                        <span class="sq-num">{degrees(p.temperature)}</span>
                                    </h2>
                                    <p>{p.detailedForecast}</p>
                                </article>
                            )}
                        </For>
                    </section>
                </div>
            </div>
        </div>
    )
}

function DayScreen(props: Ctx) {
    const days = () => props.app.forecast.days
    const index = createMemo(() => {
        const screen = props.app.screen
        const found = screen.name === "day" ? days().findIndex((d) => d.date === screen.date) : 0
        return Math.max(0, found)
    })
    return <For each={[days()[index()]]}>{(day) => <DayView {...props} day={day} index={index()} />}</For>
}

// Ranked by score, so the rows sit on the ground: a color here would read as a ranking.
function SpotsScreen(props: Ctx) {
    const [date, setDate] = createSignal<string>()
    const ranked = createMemo(() => rankSpots(props.app.spots, date()))
    const filterDays = () => props.app.spots[0]?.days ?? []

    return (
        <div class="sq-spotsview">
            <Masthead {...props} />
            <div class="sq-split">
                <div class="sq-lead sq-ground sq-spots-head">
                    <h1 class="sq-num">My Spots</h1>
                    <Show when={props.app.spots.length}>
                        <div class="sq-filters" role="group" aria-label="Which day">
                            <button
                                type="button"
                                class="sq-tab"
                                aria-pressed={date() === undefined ? "true" : "false"}
                                onClick={() => setDate(undefined)}
                            >
                                This week
                            </button>
                            <For each={filterDays()}>
                                {(day, i) => (
                                    <button
                                        type="button"
                                        class="sq-tab"
                                        aria-pressed={date() === day.date ? "true" : "false"}
                                        onClick={() => setDate(day.date)}
                                    >
                                        {getDayLabel(day, i(), "short")}
                                    </button>
                                )}
                            </For>
                        </div>
                    </Show>
                </div>
                <div class="sq-rest">
                    <Show
                        when={props.app.spots.length}
                        fallback={<p class="sq-ground sq-empty">Tap the star on any forecast to add it here.</p>}
                    >
                        <ol class="sq-spots">
                            <For each={ranked()}>
                                {(spot) => {
                                    const day = () => spot.day
                                    const index = () => (spot.day ? spot.days.indexOf(spot.day) : -1)
                                    return (
                                        <li>
                                            <div class="sq-ground sq-spot">
                                                <a class="sq-spot-text" {...props.app.link({ name: "home" })}>
                                                    <span class="sq-strong">{spot.name}</span>
                                                    <Show when={day()} fallback={<span>No forecast for this day</span>}>
                                                        {(d) => (
                                                            <>
                                                                <span>
                                                                    {dayName(d(), index())}
                                                                    <Show when={d().condies}>
                                                                        , {d().condies!.bestWindow}
                                                                    </Show>
                                                                </span>
                                                                <Show when={hasSnow(d())}>
                                                                    <span>{formatSnow(d().snow!)} snow</span>
                                                                </Show>
                                                            </>
                                                        )}
                                                    </Show>
                                                </a>
                                                <Score score={day()?.condies?.score} />
                                            </div>
                                        </li>
                                    )
                                }}
                            </For>
                        </ol>
                    </Show>
                </div>
            </div>
        </div>
    )
}

function SearchSheet(props: { samples: string[]; onClose: () => void }) {
    const [query, setQuery] = createSignal("")
    const results = () => {
        const q = query().trim().toLowerCase()
        return q ? props.samples.filter((s) => s.toLowerCase().includes(q)) : props.samples
    }
    let frame!: HTMLDivElement
    const close = () => frame.closest("dialog")?.close()
    return (
        <SheetFrame label="Search for a place" onClose={props.onClose} title="Search">
            <div ref={frame} class="sq-sheet-body">
                <form
                    class="sq-search"
                    onSubmit={(e) => {
                        e.preventDefault()
                        close()
                    }}
                >
                    <label class="sq-strong" for="sq-search-input">
                        Where to?
                    </label>
                    <input
                        autofocus
                        id="sq-search-input"
                        class="sq-input"
                        type="search"
                        placeholder="A town or a mountain"
                        autocomplete="off"
                        value={query()}
                        onInput={(e) => setQuery(e.currentTarget.value)}
                    />
                </form>
                <ul class="sq-results">
                    <For each={results()} fallback={<li class="sq-result-none">No places found.</li>}>
                        {(sample) => {
                            const [name, ...rest] = sample.split(", ")
                            return (
                                <li>
                                    <button type="button" class="sq-result" onClick={close}>
                                        <span class="sq-strong">{name}</span>
                                        <span class="sq-small">{rest.join(", ")}</span>
                                    </button>
                                </li>
                            )
                        }}
                    </For>
                </ul>
            </div>
        </SheetFrame>
    )
}

function Ready(props: { app: DesignProps }) {
    const first = props.app.open === "alert" ? props.app.forecast.alerts[0] : undefined
    const [sheet, setSheet] = createSignal<Sheet | undefined>(
        props.app.open === "search" ? { kind: "search" } : first ? { kind: "alert", alert: first } : undefined,
    )
    const ctx: Ctx = {
        get app() {
            return props.app
        },
        open: setSheet,
    }
    const close = () => setSheet(undefined)

    return (
        <>
            <Show when={props.app.offline}>
                <OfflineNotice />
            </Show>
            <Switch>
                <Match when={props.app.screen.name === "home"}>
                    <HomeScreen {...ctx} />
                </Match>
                <Match when={props.app.screen.name === "day"}>
                    <DayScreen {...ctx} />
                </Match>
                <Match when={props.app.screen.name === "spots"}>
                    <SpotsScreen {...ctx} />
                </Match>
            </Switch>
            <Dock {...ctx} />
            <Switch>
                <Match when={sheet()?.kind === "alert" && sheet()}>
                    {(s) => <AlertSheet alert={(s() as { alert: AlertView }).alert} onClose={close} />}
                </Match>
                <Match when={sheet()?.kind === "avalanche" && sheet()}>
                    {(s) => <AvalancheSheet avalanche={(s() as { avalanche: Avalanche }).avalanche} onClose={close} />}
                </Match>
                <Match when={sheet()?.kind === "search"}>
                    <SearchSheet samples={props.app.searchSamples} onClose={close} />
                </Match>
            </Switch>
        </>
    )
}

export default function Quiet(props: DesignProps) {
    return (
        <div class="sq-root" data-theme={props.theme}>
            <Switch>
                <Match when={props.status === "loading"}>
                    <LoadingState theme={props.theme} />
                </Match>
                <Match when={props.status === "error"}>
                    <ErrorState home={props.link({ name: "home" })} onRetry={() => location.reload()} />
                </Match>
                <Match when={props.status === "ready"}>
                    <Ready app={props} />
                </Match>
            </Switch>
        </div>
    )
}
