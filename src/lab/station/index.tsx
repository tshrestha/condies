import "@fontsource/dseg7-classic/700.css"
import "@fontsource-variable/atkinson-hyperlegible-next/wght.css"
import "./station.css"

import { createMemo, createSignal, For, Match, Show, Switch } from "solid-js"
import type { ParentProps } from "solid-js"

import { type DaySummary, getDayLabel, hasSnow } from "../../lib/daily.ts"
import type { Period } from "../../lib/nws.ts"
import { formatAge, formatLocalDate } from "../../lib/util.ts"
import { type DesignProps, type LabAlert, type LabForecast, rankSpots } from "../data.ts"

import { Axis, Bars } from "./bars.tsx"
import { Cat, Chevron, Icon, glyphFor, Pointer, Star } from "./icons.tsx"
import {
    alertTier,
    avalancheColors,
    dateOf,
    dayIndexOf,
    defaultMode,
    feelsLike,
    hasSnowHours,
    type Mode,
    modeNames,
    outlook,
    sentence,
    snowNumber,
    sortAlerts,
    thousands,
    windOf,
} from "./wx.ts"

type Sheet = { kind: "alert"; alert: LabAlert } | { kind: "avalanche" } | { kind: "search" }

const highlightWord = (kind?: DaySummary["highlight"]) =>
    kind === "pow" ? "Pow day" : kind === "primo" ? "Primo condies" : undefined

// ── Small parts: every number, unit and score goes through one of these. ──

// Any measurement other than the current temperature: Atkinson figures with the unit beside them.
function Reading(props: { value: string | number | undefined; unit: string; size: "m" | "l" | "xl"; label?: string }) {
    return (
        <span class="ws-reading" data-size={props.size} aria-label={props.label}>
            {props.value === undefined ? "–" : String(props.value)}
            <Show when={props.value !== undefined}>
                <span class="ws-unit" data-word={/^[a-z]/i.test(props.unit) ? "true" : undefined}>
                    {props.unit}
                </span>
            </Show>
        </span>
    )
}

// The Condies score is one of only two things drawn in segments. Its legend is printed nearby.
function Score(props: { score?: number; size?: "m" | "l" }) {
    return (
        <Show when={props.score !== undefined} fallback={<span class="ws-word">No score</span>}>
            <span
                class="ws-score ws-seg"
                data-size={props.size ?? "m"}
                role="img"
                aria-label={`Condies score ${props.score} out of 100`}
            >
                {props.score}
            </span>
        </Show>
    )
}

// A plain-text tab: bold and underlined when selected, regular otherwise. Used for every choice.
function Tab(props: ParentProps<{ selected?: boolean; onClick?: () => void; label?: string }>) {
    return (
        <button
            type="button"
            class="ws-tab"
            aria-pressed={props.selected === undefined ? undefined : props.selected ? "true" : "false"}
            aria-label={props.label}
            onClick={() => props.onClick?.()}
        >
            {props.children}
        </button>
    )
}

function Lcd(props: ParentProps<{ class?: string; label?: string }>) {
    return (
        <div class={`ws-lcd ${props.class ?? ""}`} aria-label={props.label} role={props.label ? "group" : undefined}>
            {props.children}
        </div>
    )
}

// ── The one way of getting around: places on the left, tools on the right. ──

function Nav(props: { app: DesignProps; onFind: () => void }) {
    const screen = () => props.app.screen.name
    const dark = () => props.app.theme === "dark"
    return (
        <nav class="ws-nav" aria-label="Main">
            <div class="ws-nav-group">
                <a
                    class="ws-tab"
                    {...props.app.link({ name: "home" })}
                    aria-current={screen() === "home" ? "page" : undefined}
                >
                    Home
                </a>
                <a
                    class="ws-tab"
                    {...props.app.link({ name: "spots" })}
                    aria-current={screen() === "spots" ? "page" : undefined}
                >
                    Spots
                </a>
            </div>
            <div class="ws-nav-group">
                <Tab onClick={props.onFind}>Find</Tab>
                <Tab label="Map, coming soon">Map</Tab>
                {/* Names the switch it makes, so it never reads as a lit, current page. */}
                <Tab
                    label={dark() ? "Switch to the light theme" : "Switch to the dark theme"}
                    onClick={() => props.app.setTheme(dark() ? "light" : "dark")}
                >
                    {dark() ? "Day" : "Night"}
                </Tab>
            </div>
        </nav>
    )
}

// ── Indicator lamps: NWS alerts and avalanche danger 3 and up, one line each. ──

type Lamp = {
    tier: "extreme" | "severe" | "mid" | "low" | "avalanche"
    alert?: LabAlert
    level?: number
    name?: string
}

function Lamps(props: { forecast: LabForecast; onOpen: (sheet: Sheet) => void }) {
    const lamps = createMemo(() => {
        const list: Lamp[] = sortAlerts(props.forecast.alerts).map((alert) => ({
            tier: alertTier(alert),
            alert,
        }))
        const rating = props.forecast.avalanche?.rating
        if (rating && rating.level >= 3) {
            list.push({ tier: "avalanche", level: rating.level, name: rating.name })
        }
        return list
    })
    return (
        <Show when={lamps().length}>
            <ul class="ws-lamps" aria-label="Warnings">
                <For each={lamps()}>
                    {(lamp) => (
                        <li data-tier={lamp.tier}>
                            <Show
                                when={lamp.alert}
                                fallback={
                                    <button
                                        type="button"
                                        class="ws-lamp"
                                        data-tier="avalanche"
                                        onClick={() => props.onOpen({ kind: "avalanche" })}
                                    >
                                        <Danger level={lamp.level!} />
                                        <span class="ws-lamp-text">{lamp.name} avalanche danger</span>
                                        <Chevron />
                                    </button>
                                }
                            >
                                {(alert) => (
                                    <button
                                        type="button"
                                        class="ws-lamp"
                                        data-tier={lamp.tier}
                                        onClick={() => props.onOpen({ kind: "alert", alert: alert() })}
                                    >
                                        <span class="ws-lamp-sev">{alert().severity}</span>
                                        <span class="ws-lamp-text">{alert().event}</span>
                                        <Chevron />
                                    </button>
                                )}
                            </Show>
                        </li>
                    )}
                </For>
            </ul>
        </Show>
    )
}

// The one place the single-ink rule breaks: the North American avalanche danger scale's own colors.
function Danger(props: { level: number }) {
    return (
        <span
            class="ws-danger"
            style={{ background: avalancheColors[props.level - 1], color: props.level === 5 ? "#fff" : "#000" }}
        >
            {props.level} of 5
        </span>
    )
}

// ── Home ──

function Place(props: { app: DesignProps }) {
    const f = () => props.app.forecast
    const [saved, setSaved] = createSignal(false)
    const [fresh, setFresh] = createSignal(false)
    const age = () => (fresh() ? "just now" : formatAge(f().now - Date.parse(f().updatedAt)))
    return (
        <div class="ws-place-row">
            <h1 class="ws-place">
                {f().place.city}
                <span class="ws-nowrap">
                    <Show when={f().place.state}>, {f().place.state}</Show>
                    <button
                        type="button"
                        class="ws-star-key"
                        aria-pressed={saved() ? "true" : "false"}
                        aria-label={`Save ${f().place.city} to My Spots`}
                        onClick={() => setSaved(!saved())}
                    >
                        <Star filled={saved()} />
                    </button>
                </span>
            </h1>
            <button type="button" class="ws-updated" onClick={() => setFresh(true)}>
                Updated {age()}
                <span class="ws-hidden">. Refresh</span>
            </button>
        </div>
    )
}

// The current temperature: the station's big segment reading.
function Hero(props: { value?: number }) {
    return (
        <span
            class="ws-hero"
            aria-label={props.value === undefined ? "No reading" : `${props.value} degrees Fahrenheit`}
        >
            <span class="ws-seg">{props.value ?? "--"}</span>
            <span class="ws-unit">°F</span>
        </span>
    )
}

function Now(props: { forecast: LabForecast }) {
    const now = () => props.forecast.current
    const feels = () => feelsLike(now())
    const wind = () => windOf(now())
    const long = () => now().shortForecast.length > 16
    return (
        <section class="ws-now" aria-label="Right now">
            <Lcd class="ws-now-lcd">
                <div class="ws-now-top">
                    <Hero value={now().temperature} />
                    <p class="ws-meow">
                        <Cat />
                        Right meow
                    </p>
                    <p class="ws-now-cond">
                        {/* A long condition already names itself, and needs the icon's width to stay on two lines. */}
                        <Show when={!long()}>
                            <Icon glyph={glyphFor(now().shortForecast, now().isDaytime)} class="ws-now-icon" />
                        </Show>
                        <span class="ws-condition" data-long={long() ? "true" : undefined}>
                            {sentence(now().shortForecast)}
                        </span>
                    </p>
                </div>
                <p class="ws-now-more">
                    <Show when={feels() !== undefined}>
                        <span class="ws-pair">
                            <span class="ws-legend">Feels like</span>
                            <Reading value={feels()} unit="°" size="m" />
                        </span>
                    </Show>
                    <span class="ws-pair">
                        <span class="ws-legend">Wind</span>
                        <Show when={wind() > 0} fallback={<span class="ws-word">Calm</span>}>
                            <Reading value={wind()} unit="mph" size="m" />
                            <span class="ws-word">{now().windDirection}</span>
                        </Show>
                    </span>
                </p>
            </Lcd>
        </section>
    )
}

function Hourly(props: {
    hours: Period[]
    grid: LabForecast["grid"]
    title: string
    now?: boolean
    readout?: boolean
    highlight?: DaySummary["highlight"]
}) {
    const modes = createMemo<Mode[]>(() =>
        hasSnowHours(props.hours) ? ["temp", "precip", "wind", "snow"] : ["temp", "precip", "wind"],
    )
    const [chosen, setChosen] = createSignal<Mode | undefined>(undefined)
    const mode = () => {
        const picked = chosen()
        return picked && modes().includes(picked) ? picked : defaultMode(props.hours, props.grid)
    }
    const look = createMemo(() => outlook(props.hours, props.grid))
    // The readout's amount and the graph's total are the same number, so the graph doesn't repeat it.
    const totalShown = (m: Mode) =>
        !!props.readout && ((m === "snow" && look().kind === "snow") || (m === "precip" && look().kind === "rain"))
    return (
        <section class="ws-hourly" aria-label={props.title}>
            <div class="ws-print-row">
                <h2 class="ws-print">{props.title}</h2>
                <div class="ws-tabs" role="group" aria-label={`${props.title}: show`}>
                    <For each={modes()}>
                        {(m) => (
                            <Tab selected={mode() === m} onClick={() => setChosen(m)}>
                                {modeNames[m]}
                            </Tab>
                        )}
                    </For>
                </div>
            </div>
            <Lcd class="ws-hourly-lcd">
                <Show when={props.readout}>
                    <div class="ws-readout">
                        <Show when={look().amount} fallback={<p class="ws-word-l">{look().word}</p>}>
                            <Reading value={look().amount} unit={look().unit ?? ""} size="l" />
                            <p class="ws-readout-words">
                                <span>{look().word}</span>
                                <Show when={look().caption}>
                                    <span>{look().caption}</span>
                                </Show>
                            </p>
                        </Show>
                        <Show when={highlightWord(props.highlight)}>{(word) => <p class="ws-voice">{word()}</p>}</Show>
                    </div>
                </Show>
                <Show when={mode()} keyed>
                    {(m) => (
                        <Bars
                            hours={props.hours}
                            mode={m}
                            grid={props.grid}
                            title={`${props.title}, ${modeNames[m]}`}
                            totalShown={totalShown(m)}
                        />
                    )}
                </Show>
            </Lcd>
            <Axis hours={props.hours} now={props.now} />
        </section>
    )
}

// The best day lights up as one inverse block: why on top with its score, then which day and when.
function BestDay(props: { app: DesignProps }) {
    const best = () => props.app.forecast.best!
    const reason = () => highlightWord(best().day.highlight)
    return (
        <a class="ws-best" {...props.app.link({ name: "day", date: best().day.date })}>
            <span class="ws-best-top">
                <span>
                    Best day
                    <Show when={reason()}>
                        <span class="ws-best-why"> · {reason()}</span>
                    </Show>
                </span>
                <span class="ws-best-score">
                    <span class="ws-legend">Condies</span>
                    <Score score={best().day.condies?.score} />
                </span>
            </span>
            <span class="ws-best-day">
                {formatLocalDate(best().day.date, { weekday: "long" })}
                <Show when={best().day.condies}>, {best().day.condies!.bestWindow}</Show>
            </span>
        </a>
    )
}

function Week(props: { app: DesignProps }) {
    const f = () => props.app.forecast
    const days = () => f().days.slice(0, 7)
    const snowy = () => days().some(hasSnow)
    return (
        <section class="ws-week" aria-label="This week">
            <Lcd class="ws-week-lcd">
                <Show when={f().best}>
                    <BestDay app={props.app} />
                </Show>
                <ol class="ws-week-rows" data-snow={snowy() ? "true" : undefined}>
                    <For each={days()}>
                        {(day, i) => {
                            const period = day.day ?? day.night
                            const isBest = () => f().best?.day.date === day.date
                            return (
                                <li>
                                    <a
                                        class="ws-week-row"
                                        data-best={isBest() ? "true" : undefined}
                                        {...props.app.link({ name: "day", date: day.date })}
                                    >
                                        <span class="ws-week-day">
                                            <Show when={isBest()}>
                                                <Pointer />
                                                <span class="ws-hidden">Best day: </span>
                                            </Show>
                                            {getDayLabel(day, i(), "short")}
                                        </span>
                                        <span class="ws-week-icon">
                                            <Icon glyph={glyphFor(period?.shortForecast ?? "", !!day.day)} />
                                            <span class="ws-hidden">{period?.shortForecast}</span>
                                        </span>
                                        <span class="ws-week-high">
                                            <span class="ws-hidden">High </span>
                                            <Reading value={day.high} unit="°" size="l" />
                                        </span>
                                        <span class="ws-week-low">
                                            <span class="ws-hidden">, low </span>
                                            <Reading value={day.low} unit="°" size="m" />
                                        </span>
                                        <Show when={snowy()}>
                                            <span class="ws-week-snow">
                                                <Show when={hasSnow(day)}>
                                                    <span class="ws-hidden">, snow </span>
                                                    <Reading value={snowNumber(day.snow ?? 0)} unit="″" size="m" />
                                                </Show>
                                            </span>
                                        </Show>
                                    </a>
                                </li>
                            )
                        }}
                    </For>
                </ol>
            </Lcd>
            <WeekNotes forecast={f()} />
        </section>
    )
}

function WeekNotes(props: { forecast: LabForecast }) {
    const storm = () => props.forecast.storm
    return (
        <Show when={storm() || props.forecast.weekSnow >= 1}>
            <ul class="ws-notes">
                <Show when={storm()}>
                    {(s) => (
                        <li>
                            <Icon glyph="snow" />
                            <span>
                                <strong>{s().start <= props.forecast.now ? "Storm now" : "Next storm"}</strong>{" "}
                                {s().text}
                            </span>
                        </li>
                    )}
                </Show>
                <Show when={props.forecast.weekSnow >= 1}>
                    <li>
                        <Icon glyph="snow" />
                        <span>
                            <strong>{snowNumber(props.forecast.weekSnow)}″</strong> of snow this week
                        </span>
                    </li>
                </Show>
            </ul>
        </Show>
    )
}

function Mountain(props: { forecast: LabForecast; onOpen: (sheet: Sheet) => void }) {
    const depth = () => props.forecast.snowDepth
    const avalanche = () => props.forecast.avalanche
    // Danger of 3 and up is already lit as a lamp at the top, so it isn't repeated here.
    const showAvalanche = () => avalanche() && !(avalanche()!.rating && avalanche()!.rating!.level >= 3)
    return (
        <Show when={depth() || showAvalanche()}>
            <section class="ws-mountain" aria-label="On the mountain">
                <div class="ws-print-row">
                    <h2 class="ws-print">On the mountain</h2>
                </div>
                <Show when={depth()}>
                    {(d) => (
                        <>
                            <Lcd class="ws-depth-lcd">
                                <p class="ws-pair">
                                    <Reading value={snowNumber(d().depth)} unit="″" size="l" />
                                    <span class="ws-legend">on the ground</span>
                                </p>
                                <Show
                                    when={d().change !== 0}
                                    fallback={<p class="ws-legend">No new snow in 24 hours</p>}
                                >
                                    <p class="ws-pair">
                                        <Reading value={snowNumber(Math.abs(d().change))} unit="″" size="m" />
                                        <span class="ws-legend">{d().change > 0 ? "new" : "settled"} in 24 hours</span>
                                    </p>
                                </Show>
                            </Lcd>
                            <p class="ws-fine">
                                {d().station.name} station, {d().station.miles} mi away,{" "}
                                {thousands(d().station.elevation)} ft. Measured{" "}
                                {formatAge(props.forecast.now - d().measuredAt)}.
                            </p>
                        </>
                    )}
                </Show>
                <Show when={showAvalanche()}>
                    <button
                        type="button"
                        class="ws-lamp ws-lamp-avy"
                        data-tier="avalanche"
                        onClick={() => props.onOpen({ kind: "avalanche" })}
                    >
                        <Show when={avalanche()!.rating} fallback={<span class="ws-danger ws-danger-none">None</span>}>
                            {(r) => <Danger level={r().level} />}
                        </Show>
                        <span class="ws-lamp-text">
                            <Show when={avalanche()!.rating} fallback="No current avalanche rating">
                                {(r) => `${r().name} avalanche danger`}
                            </Show>
                        </span>
                        <Chevron />
                    </button>
                </Show>
            </section>
        </Show>
    )
}

function Home(props: { app: DesignProps; onOpen: (sheet: Sheet) => void }) {
    const f = () => props.app.forecast
    return (
        <main class="ws-home">
            <div class="ws-col-a">
                <Lamps forecast={f()} onOpen={props.onOpen} />
                <div class="ws-now-group">
                    <Place app={props.app} />
                    <Now forecast={f()} />
                </div>
                <Mountain forecast={f()} onOpen={props.onOpen} />
            </div>
            <div class="ws-col-b">
                <Hourly
                    hours={f().hours.slice(0, 12)}
                    grid={f().grid}
                    title="Next 12 hours"
                    now
                    readout
                    highlight={f().powDay ? "pow" : undefined}
                />
            </div>
            <div class="ws-col-c">
                <Week app={props.app} />
            </div>
        </main>
    )
}

// ── Day ──

function precipLine(day: DaySummary) {
    const phase = day.phase
    if (!phase) {
        return undefined
    }
    const where =
        phase.phase === "snow"
            ? "All snow at this elevation"
            : phase.phase === "rain"
              ? "Rain at this elevation"
              : "Right at the rain/snow line"
    return {
        where,
        detail: `Snow level ${thousands(phase.snowLevelFeet)} ft, this spot is ${thousands(phase.elevationFeet)} ft`,
    }
}

function DayView(props: { app: DesignProps; date: string }) {
    const f = () => props.app.forecast
    const index = () => dayIndexOf(f().days, props.date)
    const day = () => f().days[index()]
    const prev = () => f().days[index() - 1]
    const next = () => f().days[index() + 1]
    const period = () => day().day ?? day().night
    const hours = () => f().hours.filter((p) => dateOf(p) === day().date)
    const label = () => getDayLabel(day(), index(), "long")
    const line = () => precipLine(day())

    return (
        <main class="ws-day">
            <div class="ws-col-a">
                <div class="ws-day-head">
                    <div class="ws-day-title">
                        <h1 class="ws-place">{label()}</h1>
                        <p class="ws-sub">
                            {formatLocalDate(
                                day().date,
                                index() === 0
                                    ? { weekday: "long", month: "short", day: "numeric" }
                                    : { month: "short", day: "numeric" },
                            )}{" "}
                            · {f().place.city}
                        </p>
                    </div>
                    <nav class="ws-day-nav" aria-label="Other days">
                        <Show when={prev()}>
                            {(p) => (
                                <a class="ws-tab ws-step" {...props.app.link({ name: "day", date: p().date })}>
                                    <Chevron back />
                                    <span>{getDayLabel(p(), index() - 1, "short")}</span>
                                </a>
                            )}
                        </Show>
                        <Show when={next()}>
                            {(n) => (
                                <a class="ws-tab ws-step" {...props.app.link({ name: "day", date: n().date })}>
                                    <span>{getDayLabel(n(), index() + 1, "short")}</span>
                                    <Chevron />
                                </a>
                            )}
                        </Show>
                    </nav>
                </div>

                <Lcd class="ws-day-lcd">
                    <p class="ws-condition">
                        <Icon glyph={glyphFor(period()?.shortForecast ?? "", !!day().day)} class="ws-cond-icon" />
                        <span>
                            {sentence(period()?.shortForecast ?? "")}
                            <Show when={highlightWord(day().highlight)}>
                                {(word) => <span class="ws-voice"> · {word()}</span>}
                            </Show>
                        </span>
                    </p>
                    <div class="ws-day-temps">
                        <span class="ws-legend">High</span>
                        <span class="ws-legend">Low</span>
                        <Reading value={day().high} unit="°" size="xl" />
                        <Reading value={day().low} unit="°" size="l" />
                    </div>
                    <div class="ws-day-score">
                        <Score score={day().condies?.score} size="l" />
                        <span class="ws-score-text">
                            <span class="ws-legend">Condies score</span>
                            <Show when={day().condies}>
                                <span class="ws-word">Best {day().condies!.bestWindow}</span>
                            </Show>
                        </span>
                    </div>
                </Lcd>

                <Lcd class="ws-facts" label="Details">
                    <dl>
                        <div class="ws-fact">
                            <dt class="ws-legend">Precip</dt>
                            <dd>
                                <Reading value={day().precipChance} unit="%" size="m" />
                                <span class="ws-word">chance of {day().precipType}</span>
                            </dd>
                        </div>
                        <Show when={hasSnow(day())}>
                            <div class="ws-fact">
                                <dt class="ws-legend">Snow</dt>
                                <dd>
                                    <Reading value={snowNumber(day().snow ?? 0)} unit="″" size="m" />
                                </dd>
                            </div>
                        </Show>
                        <div class="ws-fact">
                            <dt class="ws-legend">Wind</dt>
                            <dd>
                                <Reading
                                    value={
                                        day().windMin === day().windMax
                                            ? day().windMax
                                            : `${day().windMin}–${day().windMax}`
                                    }
                                    unit="mph"
                                    size="m"
                                />
                            </dd>
                        </div>
                        <Show when={day().gust && day().gust! > day().windMax ? day().gust : undefined}>
                            {(g) => (
                                <div class="ws-fact">
                                    <dt class="ws-legend">Gusts</dt>
                                    <dd>
                                        <Reading value={g()} unit="mph" size="m" />
                                    </dd>
                                </div>
                            )}
                        </Show>
                        <Show when={index() === 0 && f().sun}>
                            {(sun) => (
                                <div class="ws-fact">
                                    <dt class="ws-legend">Sun</dt>
                                    <dd class="ws-word">
                                        Up {sun().sunrise}, down {sun().sunset}
                                    </dd>
                                </div>
                            )}
                        </Show>
                    </dl>
                </Lcd>
                <Show when={line()}>
                    {(l) => (
                        <p class="ws-fine">
                            <strong>{l().where}.</strong> {l().detail}.
                        </p>
                    )}
                </Show>
            </div>

            <div class="ws-col-b">
                <Show when={hours().length > 1}>
                    <Hourly
                        hours={hours()}
                        grid={f().grid}
                        title={index() === 0 ? "Rest of today" : "Hour by hour"}
                        now={index() === 0}
                    />
                </Show>
            </div>

            <div class="ws-col-c">
                <section class="ws-text" aria-label="Forecast">
                    <div class="ws-print-row">
                        <h2 class="ws-print">Forecast</h2>
                    </div>
                    <For each={day().periods}>
                        {(p) => (
                            <article class="ws-period">
                                <h3>
                                    {p.name || (p.isDaytime ? "Day" : "Night")}
                                    <span class="ws-period-temp">
                                        {p.isDaytime ? "High" : "Low"} {p.temperature}°
                                    </span>
                                </h3>
                                <p>{p.detailedForecast}</p>
                            </article>
                        )}
                    </For>
                </section>
            </div>
        </main>
    )
}

// ── My Spots ──

function Spots(props: { app: DesignProps }) {
    const [date, setDate] = createSignal<string | undefined>(undefined)
    const ranked = createMemo(() => rankSpots(props.app.spots, date()))
    const days = () => props.app.forecast.days.slice(0, 7)
    return (
        <main class="ws-spots">
            <div class="ws-col-a">
                <h1 class="ws-place">My spots</h1>
                <Show when={props.app.spots.length}>
                    <p class="ws-sub">Ranked by Condies score</p>
                    <div class="ws-filter" role="group" aria-label="Compare spots on">
                        <Tab selected={date() === undefined} onClick={() => setDate(undefined)}>
                            This week
                        </Tab>
                        <For each={days()}>
                            {(day, i) => (
                                <Tab selected={date() === day.date} onClick={() => setDate(day.date)}>
                                    {getDayLabel(day, i(), "short")}
                                </Tab>
                            )}
                        </For>
                    </div>
                </Show>
            </div>
            <div class="ws-col-wide">
                <Show
                    when={ranked().length}
                    fallback={
                        <Lcd class="ws-empty-lcd">
                            <Star filled={false} />
                            <p class="ws-word-l">Tap the star on any forecast to add it here.</p>
                        </Lcd>
                    }
                >
                    <Lcd class="ws-spots-lcd">
                        <ol class="ws-spot-rows">
                            <For each={ranked()}>
                                {(spot) => {
                                    const dayIndex = () =>
                                        spot.day ? spot.days.findIndex((d) => d.date === spot.day!.date) : -1
                                    return (
                                        <li>
                                            <a class="ws-spot" {...props.app.link({ name: "home" })}>
                                                <span class="ws-spot-score">
                                                    <Score score={spot.day?.condies?.score} size="l" />
                                                </span>
                                                <span class="ws-spot-text">
                                                    <span class="ws-spot-name">{spot.name}</span>
                                                    <span class="ws-word">
                                                        <Show when={spot.day} fallback="No forecast">
                                                            {getDayLabel(spot.day!, dayIndex(), "long")}
                                                            <Show when={spot.day!.condies}>
                                                                ,{" "}
                                                                <span class="ws-nowrap">
                                                                    {spot.day!.condies!.bestWindow}
                                                                </span>
                                                            </Show>
                                                        </Show>
                                                    </span>
                                                </span>
                                                <Show when={spot.day && hasSnow(spot.day)}>
                                                    <span class="ws-spot-snow">
                                                        <Icon glyph="snow" />
                                                        <Reading
                                                            value={snowNumber(spot.day!.snow ?? 0)}
                                                            unit="″"
                                                            size="m"
                                                        />
                                                    </span>
                                                </Show>
                                            </a>
                                        </li>
                                    )
                                }}
                            </For>
                        </ol>
                    </Lcd>
                </Show>
            </div>
        </main>
    )
}

// ── Sheets: alert detail, avalanche detail, search. ──

function SheetFrame(props: ParentProps<{ label: string; onClose: () => void }>) {
    let dialog!: HTMLDialogElement
    const open = (el: HTMLDialogElement) => {
        dialog = el
        queueMicrotask(() => el.isConnected && !el.open && el.showModal())
    }
    return (
        <dialog ref={open} class="ws-sheet" aria-label={props.label} onClose={props.onClose}>
            <div class="ws-sheet-top">
                <Tab onClick={() => dialog.close()}>Close</Tab>
            </div>
            {props.children}
        </dialog>
    )
}

function AlertSheet(props: { alert: LabAlert; onClose: () => void }) {
    const tier = () => alertTier(props.alert)
    return (
        <SheetFrame label={props.alert.event} onClose={props.onClose}>
            <div class="ws-lamp ws-sheet-lamp" data-tier={tier()} tabindex="-1" autofocus>
                <span class="ws-lamp-sev">{props.alert.severity}</span>
                <span class="ws-lamp-text">{props.alert.event}</span>
            </div>
            <p class="ws-sheet-sev">{props.alert.headline}</p>
            <dl class="ws-parts">
                <For each={props.alert.parts}>
                    {(part) => (
                        <div class="ws-part">
                            <Show when={part.label}>
                                <dt>{sentence(part.label)}</dt>
                            </Show>
                            <dd>{part.text}</dd>
                        </div>
                    )}
                </For>
            </dl>
            <Show when={props.alert.instruction}>
                <div class="ws-instruction">
                    <p class="ws-print">What to do</p>
                    <p>{props.alert.instruction}</p>
                </div>
            </Show>
        </SheetFrame>
    )
}

function AvalancheSheet(props: { forecast: LabForecast; onClose: () => void }) {
    const a = () => props.forecast.avalanche!
    return (
        <SheetFrame label="Avalanche danger" onClose={props.onClose}>
            <Show
                when={a().rating}
                fallback={
                    <div class="ws-avy">
                        <p class="ws-sheet-title" tabindex="-1" autofocus>
                            No current avalanche rating
                        </p>
                        <p>That doesn’t mean it’s safe.</p>
                    </div>
                }
            >
                {(r) => (
                    <div class="ws-avy">
                        <div class="ws-lamp ws-lamp-avy" data-tier="avalanche" tabindex="-1" autofocus>
                            <Danger level={r().level} />
                            <span class="ws-lamp-text">{r().name} avalanche danger</span>
                        </div>
                        <Show when={r().warning}>
                            <p class="ws-sheet-sev">
                                <strong>Avalanche warning in effect.</strong>
                            </p>
                        </Show>
                        <p>{r().advice}</p>
                        <p>Varies by slope and elevation.</p>
                    </div>
                )}
            </Show>
            <p>
                <a class="ws-link" href={a().link} target="_blank" rel="noopener">
                    {a().center}
                </a>
            </p>
        </SheetFrame>
    )
}

function SearchSheet(props: { samples: string[]; onClose: () => void }) {
    const [query, setQuery] = createSignal("")
    const results = () => {
        const q = query().trim().toLowerCase()
        return q ? props.samples.filter((s) => s.toLowerCase().includes(q)) : props.samples
    }
    return (
        <SheetFrame label="Find a place" onClose={props.onClose}>
            <form
                class="ws-search"
                onSubmit={(e) => {
                    e.preventDefault()
                    props.onClose()
                }}
            >
                <label class="ws-print" for="ws-search-input">
                    Find a place
                </label>
                <input
                    id="ws-search-input"
                    class="ws-input"
                    type="search"
                    placeholder="Town, mountain or zip"
                    autocomplete="off"
                    autofocus
                    value={query()}
                    onInput={(e) => setQuery(e.currentTarget.value)}
                />
            </form>
            <ul class="ws-results">
                <For each={results()} fallback={<li class="ws-fine">No places found.</li>}>
                    {(sample) => {
                        const [name, ...rest] = sample.split(", ")
                        return (
                            <li>
                                <button type="button" class="ws-result" onClick={props.onClose}>
                                    <span class="ws-result-name">{name}</span>
                                    <span class="ws-word">{rest.join(", ")}</span>
                                </button>
                            </li>
                        )
                    }}
                </For>
            </ul>
        </SheetFrame>
    )
}

// ── States ──

function Blank(props: { blink?: boolean }) {
    return (
        <div class="ws-blank" data-blink={props.blink ? "true" : undefined} aria-hidden="true">
            <Lcd class="ws-blank-lcd">
                <Hero />
            </Lcd>
            <Lcd class="ws-blank-lcd ws-blank-bars">
                <For each={Array.from({ length: 12 })}>{(_, i) => <i style={{ "--i": i() }} />}</For>
            </Lcd>
        </div>
    )
}

function LoadingState() {
    return (
        <main class="ws-state" role="status" aria-label="Loading the forecast">
            <p class="ws-place">Tuning in</p>
            <p>Getting the latest from the National Weather Service.</p>
            <Blank blink />
        </main>
    )
}

function ErrorState(props: { app: DesignProps }) {
    return (
        <main class="ws-state" role="alert">
            <p class="ws-place">Couldn’t load this page.</p>
            <div class="ws-state-actions">
                <Tab onClick={() => location.reload()}>Try again</Tab>
                <a class="ws-tab" {...props.app.link({ name: "home" })}>
                    Go home
                </a>
            </div>
            <Blank />
        </main>
    )
}

function Ready(props: { app: DesignProps }) {
    const first = (): Sheet | undefined => {
        if (props.app.open === "search") {
            return { kind: "search" }
        }
        const alert = sortAlerts(props.app.forecast.alerts)[0]
        if (props.app.open === "alert" && alert) {
            return { kind: "alert", alert }
        }
        return undefined
    }
    const [sheet, setSheet] = createSignal<Sheet | undefined>(first())
    const close = () => setSheet(undefined)
    const screen = () => props.app.screen
    return (
        <>
            <Nav app={props.app} onFind={() => setSheet({ kind: "search" })} />
            <Show when={props.app.offline}>
                <p class="ws-offline" role="status">
                    You’re offline. This is the last forecast you loaded.
                </p>
            </Show>
            <Switch>
                <Match when={screen().name === "home"}>
                    <Home app={props.app} onOpen={setSheet} />
                </Match>
                <Match when={screen().name === "day" ? (screen() as { date: string }).date : undefined}>
                    {(date) => <DayView app={props.app} date={date()} />}
                </Match>
                <Match when={screen().name === "spots"}>
                    <Spots app={props.app} />
                </Match>
            </Switch>
            <Switch>
                <Match when={sheet()?.kind === "alert" ? (sheet() as { alert: LabAlert }).alert : undefined}>
                    {(alert) => <AlertSheet alert={alert()} onClose={close} />}
                </Match>
                <Match when={sheet()?.kind === "avalanche" && props.app.forecast.avalanche}>
                    <AvalancheSheet forecast={props.app.forecast} onClose={close} />
                </Match>
                <Match when={sheet()?.kind === "search"}>
                    <SearchSheet samples={props.app.searchSamples} onClose={close} />
                </Match>
            </Switch>
        </>
    )
}

export default function Station(props: DesignProps) {
    return (
        <div class="ws-root" data-theme={props.theme}>
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
