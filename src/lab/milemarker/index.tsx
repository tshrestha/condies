import "@fontsource-variable/overpass/wght.css"
import "./milemarker.css"

import { createMemo, createSignal, For, Match, Show, Switch } from "solid-js"
import type { ParentProps } from "solid-js"

import type { AvalancheStatus } from "../../lib/avalanche.ts"
import { type DaySummary, formatSnow, formatWindRange, getDayLabel } from "../../lib/daily.ts"
import { formatAge, formatLocalDate } from "../../lib/util.ts"
import { type DesignProps, type LabAlert, type LabForecast, type LabSnowDepth, rankSpots } from "../data.ts"

import { HourChart } from "./Chart.tsx"
import { Arrow, Cat, Diamond, Icon, Plate, Sign, Star, Sym } from "./parts.tsx"
import {
    alertColor,
    dateOf,
    deg,
    feelsLike,
    hasSnowHours,
    isProminent,
    outlook,
    snowWord,
    sentenceCase,
    snowLine,
    sortAlerts,
    stormBeyond,
    symbolFor,
    type View,
    windText,
    windowText,
    clock,
} from "./wx.ts"

type App = DesignProps
type Open = { kind: "alert"; alert: LabAlert } | { kind: "avalanche" } | { kind: "search" } | undefined

const dangerColors = ["#50b848", "#fff200", "#f7941e", "#ed1c24", "#231f20"]
const dangerInk = ["#000", "#000", "#000", "#000", "#fff"]

const daySymbol = (day: DaySummary) => symbolFor((day.day ?? day.night)?.shortForecast ?? "", !!day.day || !day.night)

const dayCondition = (day: DaySummary) => sentenceCase((day.day ?? day.night)?.shortForecast ?? "")

const shortDate = (day: DaySummary) => formatLocalDate(day.date, { month: "short", day: "numeric" })

function Bar(props: { app: App; onSearch: () => void }) {
    const next = () => (props.app.theme === "light" ? "dark" : "light")
    return (
        <header class="mm-bar">
            <a class="mm-brand" {...props.app.link({ name: "home" })}>
                Condies
            </a>
            <nav class="mm-bar-nav" aria-label="Main">
                <button type="button" class="mm-iconbtn" aria-label="Search for a place" onClick={props.onSearch}>
                    <Icon name="search" />
                </button>
                <button type="button" class="mm-iconbtn" aria-label="Map">
                    <Icon name="map" />
                </button>
                <a
                    class="mm-spotslink"
                    aria-current={props.app.screen.name === "spots" ? "page" : undefined}
                    {...props.app.link({ name: "spots" })}
                >
                    <Star filled />
                    <span>My Spots</span>
                </a>
                <button
                    type="button"
                    class="mm-iconbtn"
                    aria-label={`Switch to ${next()} theme`}
                    onClick={() => props.app.setTheme(next())}
                >
                    <Icon name="theme" />
                </button>
            </nav>
        </header>
    )
}

function NowSign(props: { app: App }) {
    const f = () => props.app.forecast
    const [starred, setStarred] = createSignal(false)
    const [refreshed, setRefreshed] = createSignal(false)
    const age = () => (refreshed() ? "just now" : formatAge(f().now - Date.parse(f().updatedAt)))
    const place = () => `${f().place.city}, ${f().place.state}`
    const feels = () => feelsLike(f().current)

    return (
        <section class="mm-now mm-tabbed" aria-label="Right now">
            <div class="mm-tabrow">
                <span class="mm-tab">
                    <Cat />
                    Right meow
                </span>
                <button type="button" class="mm-updated" onClick={() => setRefreshed(true)}>
                    <Icon name="refresh" />
                    <span>
                        <span class="mm-updated-word">Updated </span>
                        {age()}
                    </span>
                </button>
            </div>
            <Sign tone="guide" class="mm-now-sign">
                <div class="mm-now-place">
                    <h1 class="mm-t2">{place()}</h1>
                    <button
                        type="button"
                        class="mm-star"
                        aria-pressed={starred() ? "true" : "false"}
                        aria-label={
                            starred() ? `Remove ${f().place.city} from My Spots` : `Add ${f().place.city} to My Spots`
                        }
                        onClick={() => setStarred(!starred())}
                    >
                        <Star filled={starred()} />
                    </button>
                </div>
                <div class="mm-now-read">
                    <p class="mm-now-temp">{deg(f().current.temperature)}</p>
                    <div class="mm-now-text">
                        <p class="mm-now-cond">{sentenceCase(f().current.shortForecast)}</p>
                        <Show when={feels() !== undefined}>
                            <p>Feels like {deg(feels())}</p>
                        </Show>
                        <p>
                            {windText(f().current).wind}
                            <Show when={windText(f().current).gust}>
                                , <span class="mm-nowrap">{windText(f().current).gust}</span>
                            </Show>
                        </p>
                    </div>
                </div>
            </Sign>
        </section>
    )
}

function AlertLine(props: { alert: LabAlert; onOpen: () => void }) {
    const a = () => props.alert
    return (
        <button
            type="button"
            class="mm-sign mm-alert"
            data-tone={alertColor(a())}
            data-tier={a().severity === "Extreme" ? "extreme" : isProminent(a()) ? "high" : "low"}
            aria-label={`${a().severity} alert: ${a().event}. Open details.`}
            onClick={props.onOpen}
        >
            <Show when={isProminent(a())}>
                <Diamond />
            </Show>
            <span class="mm-alert-event">{a().event}</span>
            <span class="mm-alert-sev">{a().severity}</span>
            <Arrow dir="right" class="mm-alert-go" />
        </button>
    )
}

function DangerChip(props: { level: number }) {
    return (
        <span
            class="mm-chip"
            style={{ background: dangerColors[props.level - 1], color: dangerInk[props.level - 1] }}
            aria-hidden="true"
        >
            {props.level}
        </span>
    )
}

function AvalancheLine(props: { avalanche: AvalancheStatus; onOpen: () => void }) {
    return (
        <Show
            when={props.avalanche.rating}
            fallback={
                <Sign tone="reg" class="mm-norating">
                    <p class="mm-strong">No current avalanche rating</p>
                    <p>That doesn’t mean it’s safe.</p>
                    <a class="mm-link" href={props.avalanche.link} target="_blank" rel="noreferrer">
                        {props.avalanche.center}
                    </a>
                </Sign>
            }
        >
            {(rating) => (
                <button
                    type="button"
                    class="mm-sign mm-alert mm-aval"
                    data-tone={rating().level >= 3 ? "warn" : "reg"}
                    data-tier={rating().level >= 3 ? "high" : "low"}
                    aria-label={`Avalanche danger: ${rating().name}, ${rating().level} of 5. Open details.`}
                    onClick={props.onOpen}
                >
                    <DangerChip level={rating().level} />
                    <span class="mm-alert-event">Avalanche danger</span>
                    <span class="mm-alert-sev">
                        {rating().name}, {rating().level} of 5
                    </span>
                    <Arrow dir="right" class="mm-alert-go" />
                </button>
            )}
        </Show>
    )
}

function Alerts(props: { f: LabForecast; onOpen: (o: Open) => void }) {
    const danger = () => props.f.avalanche?.rating && props.f.avalanche.rating.level >= 3
    const sorted = () => sortAlerts(props.f.alerts)
    const line = (a: LabAlert) => <AlertLine alert={a} onOpen={() => props.onOpen({ kind: "alert", alert: a })} />
    // Considerable or higher avalanche danger ranks with the warnings, above Moderate and Minor alerts.
    return (
        <Show when={props.f.alerts.length || danger()}>
            <section class="mm-alerts" aria-label="Alerts">
                <For each={sorted().filter(isProminent)}>{line}</For>
                <Show when={danger()}>
                    <AvalancheLine avalanche={props.f.avalanche!} onOpen={() => props.onOpen({ kind: "avalanche" })} />
                </Show>
                <For each={sorted().filter((a) => !isProminent(a))}>{line}</For>
            </section>
        </Show>
    )
}

function OutlookSign(props: { app: App }) {
    const f = () => props.app.forecast
    const o = createMemo(() => outlook(f()))
    const hours = () => f().hours.slice(0, 12)
    return (
        <a
            class="mm-sign mm-outlook mm-signlink"
            data-tone="guide"
            {...props.app.link({ name: "day", date: f().days[0]?.date })}
        >
            <span class="mm-outlook-text">
                <span class="mm-t2 mm-strong">{o().headline}</span>
                <span class="mm-t1">{o().detail}</span>
            </span>
            <HourChart hours={hours()} view={o().view} span="over the next 12 hours" nowLabel narrow />
        </a>
    )
}

function BestDaySign(props: { app: App }) {
    const f = () => props.app.forecast
    return (
        <Show
            when={f().best}
            fallback={
                <Show when={f().days.some((d) => d.condies)}>
                    <Sign tone="guide" class="mm-best mm-best-none">
                        <p class="mm-t1">Best day</p>
                        <p class="mm-t2">No standout day this week</p>
                    </Sign>
                </Show>
            }
        >
            {(best) => (
                <div class="mm-best-wrap">
                    <Show when={best().day.highlight}>{(h) => <Tab kind={h()} />}</Show>
                    <a
                        class="mm-sign mm-best mm-signlink"
                        data-tone="guide"
                        data-tabbed={best().day.highlight ? "" : undefined}
                        {...props.app.link({ name: "day", date: best().day.date })}
                    >
                        <span class="mm-best-text">
                            <span class="mm-t1">Best day</span>
                            <span class="mm-t2 mm-strong">{getDayLabel(best().day, best().index, "long")}</span>
                            <span class="mm-t1">{windowText(best().day.condies!.bestWindow)}</span>
                        </span>
                        <Plate score={best().day.condies!.score} />
                    </a>
                </div>
            )}
        </Show>
    )
}

function Tab(props: { kind: "pow" | "primo" }) {
    return <span class="mm-tab">{props.kind === "pow" ? "POW DAY" : "PRIMO"}</span>
}

function StormSign(props: { f: LabForecast }) {
    return (
        <Show when={stormBeyond(props.f)}>
            <Sign tone="guide" class="mm-storm">
                <Sym kind="snow" class="mm-storm-sym" />
                <span>
                    <span class="mm-t1">Next storm</span>
                    <span class="mm-t2 mm-strong">{props.f.storm!.text.split(" · ")[1]}</span>
                    <span class="mm-t1">{props.f.storm!.text.split(" · ")[0]}</span>
                </span>
            </Sign>
        </Show>
    )
}

// The whole week is one distance sign: names on the left, numbers lined up on the right.
function Week(props: { app: App }) {
    const f = () => props.app.forecast
    return (
        <section class="mm-week" aria-labelledby="mm-week-title">
            <h2 id="mm-week-title" class="mm-sr">
                This week
            </h2>
            <StormSign f={f()} />
            <ul class="mm-sign mm-distance" data-tone="guide">
                <For each={f().days}>
                    {(day, i) => {
                        const index = i()
                        return (
                            <li>
                                <a
                                    class="mm-row"
                                    {...props.app.link({ name: "day", date: day.date })}
                                    aria-label={[
                                        `${getDayLabel(day, index, "long")}: ${dayCondition(day)}`,
                                        day.high !== undefined && `high ${deg(day.high)}`,
                                        day.low !== undefined && `low ${deg(day.low)}`,
                                        snowWord(day) && `${snowWord(day)} of snow`,
                                    ]
                                        .filter(Boolean)
                                        .join(", ")}
                                >
                                    <span class="mm-row-day">{getDayLabel(day, index, "short")}</span>
                                    <Sym kind={daySymbol(day)} class="mm-row-sym" />
                                    <span class="mm-row-extra">{snowWord(day)}</span>
                                    <span class="mm-row-hi">{day.high === undefined ? "" : deg(day.high)}</span>
                                    <span class="mm-row-lo">{day.low === undefined ? "" : deg(day.low)}</span>
                                </a>
                            </li>
                        )
                    }}
                </For>
            </ul>
            <Show when={f().weekSnow >= 1}>
                <p class="mm-caption">{formatSnow(f().weekSnow)} of snow this week</p>
            </Show>
        </section>
    )
}

function SnowDepth(props: { depth: LabSnowDepth; now: number }) {
    const d = () => props.depth
    return (
        <div class="mm-depth">
            <Sign tone="reg" class="mm-depth-sign">
                <span class="mm-legend-caps">Snow depth</span>
                <span class="mm-t3">{Math.round(d().depth)}″</span>
                <span class="mm-t1">
                    {d().change > 0
                        ? `+${Math.round(d().change)}″`
                        : d().change < 0
                          ? `−${Math.abs(Math.round(d().change))}″`
                          : "No change"}{" "}
                    in 24 hours
                </span>
            </Sign>
            <p class="mm-caption">
                Measured at {d().station.name}, {d().station.miles} mi away at{" "}
                {d().station.elevation.toLocaleString("en-US")} ft, {formatAge(props.now - d().measuredAt)}.
            </p>
        </div>
    )
}

function Mountain(props: { f: LabForecast; onOpen: (o: Open) => void }) {
    const lowDanger = () => props.f.avalanche && !(props.f.avalanche.rating && props.f.avalanche.rating.level >= 3)
    return (
        <Show when={lowDanger() || props.f.snowDepth}>
            <section class="mm-mountain" aria-labelledby="mm-mtn-title">
                <h2 id="mm-mtn-title" class="mm-t2 mm-strong">
                    On the mountain
                </h2>
                <Show when={lowDanger()}>
                    <AvalancheLine avalanche={props.f.avalanche!} onOpen={() => props.onOpen({ kind: "avalanche" })} />
                </Show>
                <Show when={props.f.snowDepth}>{(d) => <SnowDepth depth={d()} now={props.f.now} />}</Show>
            </section>
        </Show>
    )
}

function Home(props: { app: App; onOpen: (o: Open) => void }) {
    const f = () => props.app.forecast
    return (
        <main class="mm-home">
            <div class="mm-col mm-g-now">
                <NowSign app={props.app} />
                <Alerts f={f()} onOpen={props.onOpen} />
            </div>
            <div class="mm-col mm-g-ahead">
                <OutlookSign app={props.app} />
                <BestDaySign app={props.app} />
            </div>
            <div class="mm-col mm-g-week">
                <Week app={props.app} />
            </div>
            <div class="mm-col mm-g-mtn">
                <Mountain f={f()} onOpen={props.onOpen} />
            </div>
        </main>
    )
}

function Views(props: { views: View[]; view: View; onView: (v: View) => void }) {
    const names: Record<View, string> = { temp: "Temp", precip: "Precip", wind: "Wind", snow: "Snow" }
    return (
        <div class="mm-views" role="group" aria-label="Hourly view">
            <For each={props.views}>
                {(v) => (
                    <button
                        type="button"
                        aria-pressed={props.view === v ? "true" : "false"}
                        onClick={() => props.onView(v)}
                    >
                        {names[v]}
                    </button>
                )}
            </For>
        </div>
    )
}

function DayScreen(props: { app: App; date: string }) {
    const f = () => props.app.forecast
    const index = () =>
        Math.max(
            0,
            f().days.findIndex((d) => d.date === props.date),
        )
    const day = () => f().days[index()]
    const prev = () => f().days[index() - 1]
    const next = () => f().days[index() + 1]
    const hours = () => (index() === 0 ? f().hours.slice(0, 24) : f().hours.filter((p) => dateOf(p) === day().date))
    const views = (): View[] => ["temp", "precip", "wind", ...(hasSnowHours(hours()) ? ["snow" as View] : [])]
    const [chosen, setChosen] = createSignal<View>()
    const view = () => {
        const c = chosen()
        return c && views().includes(c) ? c : hasSnowHours(hours()) ? "snow" : "temp"
    }
    const line = () => snowLine(day())
    const label = (d: DaySummary, i: number) => getDayLabel(d, i, "long")
    // Everything measured about the day, in one sign.
    const facts = () => {
        const d = day()
        const sun = index() === 0 ? f().sun : undefined
        const level = line()
        return [
            { label: d.precipType === "snow" ? "Snow chance" : "Rain chance", value: `${d.precipChance}%` },
            ...(snowWord(d) ? [{ label: "Snow total", value: snowWord(d) }] : []),
            { label: "Wind", value: formatWindRange(d) },
            ...(d.gust && d.gust > d.windMax ? [{ label: "Gusts", value: `${d.gust} mph` }] : []),
            ...(level ? [{ label: "Snow level", value: level.level, note: level.headline }] : []),
            ...(sun
                ? [
                      { label: "Sunrise", value: clock(sun.sunrise) },
                      { label: "Sunset", value: clock(sun.sunset) },
                  ]
                : []),
        ]
    }

    return (
        <main class="mm-day">
            <nav class="mm-daynav" aria-label="Days">
                <Show when={prev()} fallback={<span />}>
                    {(p) => (
                        <a class="mm-daystep" {...props.app.link({ name: "day", date: p().date })}>
                            <span class="mm-daystep-dir">Previous</span>
                            <span class="mm-strong">{getDayLabel(p(), index() - 1, "short")}</span>
                        </a>
                    )}
                </Show>
                <a class="mm-daystep mm-homelink" {...props.app.link({ name: "home" })}>
                    <span class="mm-daystep-dir">Back to</span>
                    <span class="mm-strong">{f().place.city.length > 12 ? "Home" : f().place.city}</span>
                </a>
                <Show when={next()} fallback={<span />}>
                    {(n) => (
                        <a class="mm-daystep" data-next="" {...props.app.link({ name: "day", date: n().date })}>
                            <span class="mm-daystep-dir">Next</span>
                            <span class="mm-strong">{getDayLabel(n(), index() + 1, "short")}</span>
                        </a>
                    )}
                </Show>
            </nav>
            <div class="mm-day-grid">
                <div class="mm-col mm-col-a">
                    <div class="mm-best-wrap">
                        <Show when={day().highlight}>{(h) => <Tab kind={h()} />}</Show>
                        <Sign tone="guide" class="mm-dayhead">
                            <h1 class="mm-dayhead-title">
                                <span class="mm-t2 mm-strong">{label(day(), index())}</span>
                                <span class="mm-t1">
                                    {shortDate(day())}, {f().place.city}
                                </span>
                            </h1>
                            <div class="mm-dayhead-read">
                                <p class="mm-now-temp">{deg(day().high ?? day().low)}</p>
                                <Show
                                    when={day().high !== undefined && day().low !== undefined}
                                    fallback={
                                        <p class="mm-dayhead-lo">
                                            <span class="mm-t1">{day().high === undefined ? "Low" : "High"}</span>
                                        </p>
                                    }
                                >
                                    <p class="mm-dayhead-lo">
                                        <span class="mm-t1">Low</span>
                                        <span class="mm-t3">{deg(day().low)}</span>
                                    </p>
                                </Show>
                            </div>
                            <p class="mm-t2 mm-strong mm-dayhead-cond">
                                <Sym kind={daySymbol(day())} class="mm-dayhead-sym" />
                                <span>{dayCondition(day())}</span>
                            </p>
                        </Sign>
                    </div>
                    <Show when={day().condies}>
                        {(c) => (
                            <Sign tone="guide" class="mm-window">
                                <span class="mm-best-text">
                                    <span class="mm-t1">Best window</span>
                                    <span class="mm-t2 mm-strong">{windowText(c().bestWindow)}</span>
                                </span>
                                <Plate score={c().score} />
                            </Sign>
                        )}
                    </Show>
                    <dl class="mm-sign mm-distance mm-facts" data-tone="guide">
                        <For each={facts()}>
                            {(fact) => (
                                <div class="mm-row">
                                    <dt>{fact.label}</dt>
                                    <dd>{fact.value}</dd>
                                    <Show when={"note" in fact && fact.note}>
                                        <dd class="mm-facts-note">{"note" in fact ? fact.note : ""}</dd>
                                    </Show>
                                </div>
                            )}
                        </For>
                    </dl>
                </div>
                <div class="mm-col mm-col-b">
                    <Show when={hours().length > 1}>
                        <section class="mm-hours" aria-label="Hour by hour">
                            <Sign tone="guide" class="mm-hours-sign">
                                <HourChart
                                    hours={hours()}
                                    view={view()}
                                    span={index() === 0 ? "over the next 24 hours" : `on ${label(day(), index())}`}
                                    nowLabel={index() === 0}
                                />
                            </Sign>
                            <Views views={views()} view={view()} onView={setChosen} />
                        </section>
                    </Show>
                    <section class="mm-periods" aria-label="Forecast text">
                        <For each={day().periods}>
                            {(p) => (
                                <article class="mm-period">
                                    <h2>
                                        <span>{p.name}</span>
                                        <span>{deg(p.temperature)}</span>
                                    </h2>
                                    <p>{p.detailedForecast}</p>
                                </article>
                            )}
                        </For>
                    </section>
                </div>
            </div>
        </main>
    )
}

function SpotsScreen(props: { app: App }) {
    const dates = () => props.app.spots[0]?.days.map((d) => d.date) ?? props.app.forecast.days.map((d) => d.date)
    const [date, setDate] = createSignal<string>()
    const ranked = () => rankSpots(props.app.spots, date())
    const dayIndex = (spot: { days: DaySummary[]; day?: DaySummary }) => spot.days.indexOf(spot.day!)

    return (
        <main class="mm-spots">
            <h1 class="mm-t3 mm-spots-title">My Spots</h1>
            <Show
                when={props.app.spots.length}
                fallback={
                    <Sign tone="rec" class="mm-spots-empty">
                        <Star filled={false} />
                        <p class="mm-t2 mm-strong">No spots yet</p>
                        <p class="mm-t1">Tap the star on any forecast to add it here.</p>
                    </Sign>
                }
            >
                <div class="mm-filter" role="group" aria-label="Compare on">
                    <button
                        type="button"
                        aria-pressed={date() === undefined ? "true" : "false"}
                        onClick={() => setDate(undefined)}
                    >
                        This week
                    </button>
                    <For each={dates()}>
                        {(d, i) => (
                            <button
                                type="button"
                                aria-pressed={date() === d ? "true" : "false"}
                                onClick={() => setDate(d)}
                            >
                                {i() === 0 ? "Today" : formatLocalDate(d, { weekday: "short" })}
                            </button>
                        )}
                    </For>
                </div>
                <ol class="mm-spotlist">
                    <For each={ranked()}>
                        {(spot) => (
                            <li>
                                <a
                                    class="mm-sign mm-spot mm-signlink"
                                    data-tone="rec"
                                    {...props.app.link({ name: "home" })}
                                >
                                    <span class="mm-spot-text">
                                        <span class="mm-t2 mm-strong">{spot.name}</span>
                                        <Show
                                            when={spot.day}
                                            fallback={<span class="mm-t1">No forecast for this day</span>}
                                        >
                                            {(d) => (
                                                <span class="mm-t1">
                                                    {getDayLabel(d(), dayIndex(spot), "short")}
                                                    <Show when={d().condies}>
                                                        , {windowText(d().condies!.bestWindow)}
                                                    </Show>
                                                    <Show when={snowWord(d())}>
                                                        {" "}
                                                        <span class="mm-nowrap">{`· ${snowWord(d())} of snow`}</span>
                                                    </Show>
                                                </span>
                                            )}
                                        </Show>
                                    </span>
                                    <Plate score={spot.day?.condies?.score} />
                                </a>
                            </li>
                        )}
                    </For>
                </ol>
            </Show>
        </main>
    )
}

function Sheet(props: ParentProps<{ label: string; onClose: () => void }>) {
    let dialog!: HTMLDialogElement
    const mount = (el: HTMLDialogElement) => {
        dialog = el
        queueMicrotask(() => el.isConnected && !el.open && el.showModal())
    }
    return (
        <dialog
            ref={mount}
            class="mm-sheet"
            aria-label={props.label}
            onClose={props.onClose}
            onClick={(e) => e.target === dialog && dialog.close()}
        >
            <div class="mm-sheet-body">
                <div class="mm-sheet-bar">
                    <button type="button" class="mm-iconbtn mm-close" aria-label="Close" onClick={() => dialog.close()}>
                        <Icon name="close" />
                    </button>
                </div>
                {props.children}
            </div>
        </dialog>
    )
}

function AlertSheet(props: { alert: LabAlert; onClose: () => void }) {
    const a = () => props.alert
    return (
        <Sheet label={a().event} onClose={props.onClose}>
            <Sign tone={alertColor(a())} class="mm-sheet-sign">
                <Show when={isProminent(a())}>
                    <Diamond />
                </Show>
                <span>
                    <span class="mm-t2 mm-strong">{a().event}</span>
                    <span class="mm-t1">Severity: {a().severity}</span>
                </span>
            </Sign>
            <p class="mm-sheet-headline">{a().headline}</p>
            <dl class="mm-sheet-parts">
                <For each={a().parts}>
                    {(part) => (
                        <div>
                            <Show when={part.label}>
                                <dt>{sentenceCase(part.label)}</dt>
                            </Show>
                            <dd>{part.text}</dd>
                        </div>
                    )}
                </For>
            </dl>
            <Show when={a().instruction}>
                <div class="mm-sheet-do">
                    <h3>What to do</h3>
                    <p>{a().instruction}</p>
                </div>
            </Show>
        </Sheet>
    )
}

function AvalancheSheet(props: { avalanche: AvalancheStatus; onClose: () => void }) {
    const r = () => props.avalanche.rating!
    return (
        <Sheet label="Avalanche danger" onClose={props.onClose}>
            <Sign tone={r().level >= 3 ? "warn" : "reg"} class="mm-sheet-sign">
                <DangerChip level={r().level} />
                <span>
                    <span class="mm-t2 mm-strong">Avalanche danger</span>
                    <span class="mm-t1">
                        {r().name}, {r().level} of 5
                    </span>
                </span>
            </Sign>
            <Show when={r().warning}>
                <p class="mm-sheet-headline">Avalanche {r().warning} in effect.</p>
            </Show>
            <p class="mm-sheet-text">{r().advice}</p>
            <p class="mm-sheet-text">Varies by slope and elevation.</p>
            <a class="mm-link mm-sheet-text" href={props.avalanche.link} target="_blank" rel="noreferrer">
                {props.avalanche.center}
            </a>
        </Sheet>
    )
}

function SearchSheet(props: { samples: string[]; onClose: () => void }) {
    const [query, setQuery] = createSignal("")
    const results = () => {
        const q = query().trim().toLowerCase()
        return q ? props.samples.filter((s) => s.toLowerCase().includes(q)) : props.samples
    }
    return (
        <Sheet label="Search for a place" onClose={props.onClose}>
            <form
                class="mm-search"
                onSubmit={(e) => {
                    e.preventDefault()
                    props.onClose()
                }}
            >
                <label class="mm-t2 mm-strong" for="mm-search-input">
                    Where to?
                </label>
                <input
                    autofocus
                    id="mm-search-input"
                    class="mm-input"
                    type="search"
                    placeholder="Town, mountain or zip"
                    autocomplete="off"
                    value={query()}
                    onInput={(e) => setQuery(e.currentTarget.value)}
                />
            </form>
            <Show when={results().length} fallback={<p class="mm-sheet-text">No places found.</p>}>
                <ul class="mm-sign mm-distance mm-results" data-tone="guide">
                    <For each={results()}>
                        {(sample) => {
                            const [name, ...rest] = sample.split(", ")
                            return (
                                <li>
                                    <button type="button" class="mm-row mm-result" onClick={props.onClose}>
                                        <span class="mm-result-text">
                                            <span class="mm-t2 mm-strong">{name}</span>
                                            <span class="mm-t1">{rest.join(", ")}</span>
                                        </span>
                                    </button>
                                </li>
                            )
                        }}
                    </For>
                </ul>
            </Show>
        </Sheet>
    )
}

function Ready(props: { app: App }) {
    const [open, setOpen] = createSignal<Open>(
        props.app.open === "search"
            ? { kind: "search" }
            : props.app.open === "alert"
              ? props.app.forecast.alerts.length
                  ? { kind: "alert", alert: sortAlerts(props.app.forecast.alerts)[0] }
                  : undefined
              : undefined,
    )
    const close = () => setOpen(undefined)
    const screen = () => props.app.screen
    return (
        <>
            <Bar app={props.app} onSearch={() => setOpen({ kind: "search" })} />
            <Show when={props.app.offline}>
                <Sign tone="reg" class="mm-offline">
                    <p role="status">You’re offline. This is the last forecast you loaded.</p>
                </Sign>
            </Show>
            <Switch>
                <Match when={screen().name === "home"}>
                    <Home app={props.app} onOpen={setOpen} />
                </Match>
                <Match when={screen().name === "day" && screen()}>
                    {(s) => <DayScreen app={props.app} date={(s() as { date: string }).date} />}
                </Match>
                <Match when={screen().name === "spots"}>
                    <SpotsScreen app={props.app} />
                </Match>
            </Switch>
            <Switch>
                <Match when={open()?.kind === "alert" && open()}>
                    {(o) => <AlertSheet alert={(o() as { alert: LabAlert }).alert} onClose={close} />}
                </Match>
                <Match when={open()?.kind === "avalanche" && props.app.forecast.avalanche?.rating}>
                    <AvalancheSheet avalanche={props.app.forecast.avalanche!} onClose={close} />
                </Match>
                <Match when={open()?.kind === "search"}>
                    <SearchSheet samples={props.app.searchSamples} onClose={close} />
                </Match>
            </Switch>
        </>
    )
}

function LoadingState() {
    return (
        <div class="mm-loading" role="status">
            <p class="mm-t2 mm-strong">Forecast ahead</p>
            <div class="mm-blank-group">
                <div class="mm-blank mm-blank-tab" />
                <div class="mm-blank mm-blank-now" />
            </div>
            <div class="mm-blank mm-blank-mid" />
            <div class="mm-blank mm-blank-low" />
            <span class="mm-sr">Loading the forecast</span>
        </div>
    )
}

function ErrorState(props: { app: App }) {
    return (
        <main class="mm-error">
            <Sign tone="temp" class="mm-error-sign">
                <p class="mm-t2 mm-strong" role="alert">
                    Couldn’t load this page.
                </p>
            </Sign>
            <div class="mm-error-actions">
                <button type="button" class="mm-sign mm-signlink" data-tone="guide" onClick={() => location.reload()}>
                    <Icon name="refresh" />
                    Try again
                </button>
                <a class="mm-sign mm-signlink" data-tone="guide" {...props.app.link({ name: "home" })}>
                    Go home
                </a>
            </div>
        </main>
    )
}

export default function MileMarker(props: DesignProps) {
    return (
        <div class="mm-root" data-theme={props.theme}>
            <Switch>
                <Match when={props.status === "loading"}>
                    <LoadingState />
                </Match>
                <Match when={props.status === "error"}>
                    <ErrorState app={props} />
                </Match>
                <Match when={props.status === "ready"}>
                    <Ready app={props} />
                </Match>
            </Switch>
        </div>
    )
}
