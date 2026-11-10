import "@fontsource-variable/anybody/standard.css"
import "@fontsource-variable/anybody/standard-italic.css"
import "@fontsource-variable/doto/full.css"
import "@fontsource/knewave/400.css"
import "./wicket.css"

import { createMemo, createSignal, For, Match, onSettled, Show, Switch } from "solid-js"

import { type DaySummary, formatSnow, formatTemp, formatWindRange, getDayLabel, hasSnow } from "../../lib/daily.ts"
import type { Period } from "../../lib/nws.ts"
import { formatAge, formatLocalDate } from "../../lib/util.ts"
import { type DesignProps, type LabAlert, type LabForecast, type LabSpot, rankSpots, type Screen } from "../data.ts"

import { Barcode, Cat, conditionGlyph, fitWidth, Glyph, Highlight, inkOf, letterOf, Punch } from "./parts.tsx"
import { Sky, skyDay, skyNow } from "./sky.tsx"
import { ticketCopy } from "./voice.ts"

const severityRank: Record<string, number> = { Extreme: 0, Severe: 1, Moderate: 2, Minor: 3 }
const bySeverity = (alerts: LabAlert[]) =>
    [...alerts].sort((a, b) => (severityRank[a.severity] ?? 4) - (severityRank[b.severity] ?? 4))

const reducedMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches

const printDate = (date: string) =>
    formatLocalDate(date, { weekday: "short", month: "short", day: "numeric" }).replace(",", "").toUpperCase()

const shortDate = (date: string) => formatLocalDate(date, { month: "short", day: "numeric" }).toUpperCase()

const conditionsOf = (day: DaySummary) => day.day?.shortForecast ?? day.night?.shortForecast ?? "No forecast"

function serialFor(forecast: LabForecast, date: string) {
    const lat = Math.abs(Math.round(Number(forecast.place.lat) * 100))
    return `NO ${date.slice(2).replaceAll("-", "")}-${String(lat).padStart(4, "0")}`
}

function validAt(forecast: LabForecast) {
    const { lat, lon } = forecast.place
    const north = Number(lat) >= 0 ? "N" : "S"
    const west = Number(lon) < 0 ? "W" : "E"
    return `${Math.abs(Number(lat)).toFixed(2)}${north} ${Math.abs(Number(lon)).toFixed(2)}${west}`
}

function printedAt(forecast: LabForecast) {
    return new Date(forecast.updatedAt)
        .toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: forecast.place.timeZone })
        .toUpperCase()
}

function Fit(props: { text: string; class?: string; tag?: "h1" | "h2" }) {
    let line!: HTMLSpanElement
    onSettled(() => fitWidth(line))
    return (
        <span class={`wk-fit ${props.class ?? ""}`}>
            <span ref={line} class="wk-fit-line" aria-hidden="true">
                {props.text}
            </span>
            <Show when={props.tag === "h1"} fallback={<span class="wk-hide">{props.text}</span>}>
                <h1 class="wk-hide">{props.text}</h1>
            </Show>
        </span>
    )
}

function Defs() {
    return (
        <svg class="wk-defs" aria-hidden="true">
            <filter id="wk-rough" x="-5%" y="-5%" width="110%" height="110%">
                <feTurbulence type="fractalNoise" baseFrequency="0.38" numOctaves="2" seed="11" result="n" />
                <feColorMatrix
                    in="n"
                    type="matrix"
                    values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -2 2.25"
                    result="m"
                />
                <feComposite in="SourceGraphic" in2="m" operator="in" />
            </filter>
        </svg>
    )
}

function Band(props: DesignProps & { onSearch: () => void }) {
    const nightNext = () => props.theme === "light"
    const toggle = () => props.setTheme(nightNext() ? "dark" : "light")
    return (
        <header class="wk-band">
            <a class="wk-logo" aria-label="Condies home" {...props.link({ name: "home" })}>
                <span>Condies</span>
                <span class="wk-logo-speed" aria-hidden="true" />
            </a>
            <nav class="wk-nav" aria-label="Main">
                <button type="button" class="wk-navb" onClick={props.onSearch}>
                    <Glyph name="search" />
                    <span>Find</span>
                </button>
                <a class="wk-navb" aria-label="My Spots" {...props.link({ name: "spots" })}>
                    <Glyph name="ticket" />
                    <span>Spots</span>
                </a>
                <button type="button" class="wk-navb">
                    <Glyph name="map" />
                    <span>Map</span>
                </button>
                <button type="button" class="wk-navb" aria-pressed={nightNext() ? "false" : "true"} onClick={toggle}>
                    <Glyph name={nightNext() ? "moon" : "sun"} />
                    <span>{nightNext() ? "Night" : "Day"}</span>
                </button>
            </nav>
            <span class="wk-zip" aria-hidden="true" />
        </header>
    )
}

function Tapes(props: { alerts: LabAlert[]; onOpen: (alert: LabAlert) => void }) {
    return (
        <section class="wk-tapes" aria-label="Weather alerts">
            <For each={bySeverity(props.alerts)}>
                {(alert) => (
                    <button type="button" class="wk-tape" data-sev={alert.severity} onClick={() => props.onOpen(alert)}>
                        <span class="wk-tape-plate">
                            <Glyph name="hazard" />
                            <span class="wk-tape-sev">{alert.severity === "Unknown" ? "Alert" : alert.severity}</span>
                            <span class="wk-tape-event">{alert.event}</span>
                            <Glyph name="right" />
                        </span>
                    </button>
                )}
            </For>
        </section>
    )
}

function Offline() {
    return (
        <p class="wk-off" role="status">
            <Glyph name="hazard" />
            <span>You're offline. This is the last forecast you loaded.</span>
        </p>
    )
}

function Wicket() {
    return (
        <svg class="wk-wire" viewBox="0 0 80 110" aria-hidden="true">
            <path d="M28 0h24l-3 15a5 5 0 0 1-5 4h-8a5 5 0 0 1-5-4z" fill="currentColor" />
            <circle cx="40" cy="9" r="3.4" fill="var(--page)" />
            <path
                d="M40 18c-1 10 2.5 14 0 20-1.2 3.4-2 5.4-2 7.2"
                fill="none"
                stroke="currentColor"
                stroke-width="2.5"
                stroke-linecap="round"
            />
            <path
                d="M38 45.2C21 60 18 90 40 101.5c21-12 19-41.8 2-57.3"
                fill="none"
                stroke="currentColor"
                stroke-width="2.5"
                stroke-linecap="round"
            />
            <path d="M35.5 41.5l9.5 5.5M35.5 47l9.5-5.5" stroke="currentColor" stroke-width="2.2" />
        </svg>
    )
}

function Refresh(props: { forecast: LabForecast }) {
    const [fresh, setFresh] = createSignal(false)
    const [spin, setSpin] = createSignal(0)
    const age = () => (fresh() ? "just now" : formatAge(props.forecast.now - Date.parse(props.forecast.updatedAt)))
    return (
        <button
            type="button"
            class="wk-refresh"
            onClick={() => {
                setFresh(true)
                setSpin(spin() + 1)
            }}
        >
            <span style={{ "--spin": spin() }} class="wk-refresh-g">
                <Glyph name="refresh" />
            </span>
            Updated {age()}
        </button>
    )
}

function HomeTicket(props: { forecast: LabForecast; saved: boolean; onSave: () => void; link: DesignProps["link"] }) {
    const today = () => props.forecast.days[0]
    const current = () => props.forecast.current
    const copy = createMemo(() => ticketCopy(current().shortForecast, today(), current().temperature))
    const feels = () => Math.round(current().feelsLike ?? current().temperature)
    const showFeels = () => Math.abs(feels() - current().temperature) >= 3
    const wind = () => current().windSpeed.value ?? 0
    const gust = () => current().windGust?.value ?? 0
    const place = () => `${props.forecast.place.city}, ${props.forecast.place.state}`
    return (
        <article
            class="wk-tk wk-hero"
            data-day={inkOf(today()?.date ?? "2026-11-10")}
            aria-label={`Today at ${place()}`}
        >
            <div class="wk-tk-face">
                <div class="wk-seg wk-flap">
                    <span class="wk-kind">{copy().kind}</span>
                    <button
                        type="button"
                        class="wk-star"
                        data-on={props.saved ? "1" : "0"}
                        aria-pressed={props.saved ? "true" : "false"}
                        aria-label={props.saved ? "Saved to My Spots" : "Save to My Spots"}
                        onClick={props.onSave}
                    >
                        <Glyph name="star" />
                        <span>{props.saved ? "Saved" : "Save"}</span>
                    </button>
                </div>
                <div class="wk-seg wk-field">
                    <div class="wk-field-print">
                        <span class="wk-dot">{printDate(today()?.date ?? props.forecast.hours[0].startTime)}</span>
                        <p class="wk-meow">
                            <Cat />
                            <span>Right meow</span>
                        </p>
                    </div>
                    <div class="wk-stage">
                        <Sky print={skyNow(current())} size="field" />
                        <h1 class="wk-place">
                            <Fit text={props.forecast.place.city} class="wk-city" />
                            <span class="wk-region">{props.forecast.place.state}</span>
                        </h1>
                        <p
                            class="wk-temp"
                            data-digits={String(Math.abs(current().temperature)).length}
                            aria-label={`${current().temperature} degrees`}
                        >
                            {current().temperature}°
                        </p>
                        <span class="wk-edgeprint" aria-hidden="true">
                            {copy().edge}
                        </span>
                    </div>
                    <div class="wk-condstrip">
                        <div class="wk-cond">
                            <Glyph name={conditionGlyph(current().shortForecast, current().isDaytime)} />
                            <p>{current().shortForecast}</p>
                        </div>
                        <p class="wk-feels">
                            <Show when={showFeels()}>
                                <span>Feels like {feels()}°</span>
                            </Show>
                            <span class="wk-feels-wind">
                                <Glyph name="wind" />
                                <Show when={wind() > 0} fallback={<span>Calm</span>}>
                                    <span>
                                        {current().windDirection} {wind()} mph
                                        <Show when={gust() > wind()}>
                                            <span>, gusts {gust()}</span>
                                        </Show>
                                    </span>
                                </Show>
                            </span>
                        </p>
                        <Show when={today()?.highlight}>
                            <div class="wk-slam">
                                <Highlight day={today()!} size="l" />
                            </div>
                        </Show>
                    </div>
                </div>
                <Show when={today()}>
                    <a
                        class="wk-seg wk-todayrow"
                        aria-label={dayLineLabel(today()!, 0)}
                        {...props.link({ name: "day", date: today()!.date })}
                    >
                        <StubCell day={today()!} />
                        <div class="wk-line">
                            <DayLineFields day={today()!} index={0} noMark />
                        </div>
                    </a>
                </Show>
                <Show when={props.forecast.best}>
                    <BestDay forecast={props.forecast} link={props.link} />
                </Show>
                <div class="wk-seg wk-pad">
                    <Barcode hours={props.forecast.hours} limit={24} nowFirst />
                    <Show when={props.forecast.sun}>
                        <div class="wk-facts">
                            <span class="wk-fact">
                                <Glyph name="sunrise" />
                                <span class="wk-hide">Sunrise </span>
                                <span class="wk-dot">{props.forecast.sun!.sunrise}</span>
                            </span>
                            <span class="wk-fact">
                                <Glyph name="sunset" />
                                <span class="wk-hide">Sunset </span>
                                <span class="wk-dot">{props.forecast.sun!.sunset}</span>
                            </span>
                            <Refresh forecast={props.forecast} />
                        </div>
                    </Show>
                </div>
                <div class="wk-seg wk-printblock">
                    <span class="wk-dot">VALID AT {validAt(props.forecast)}</span>
                    <Show when={props.forecast.place.elevationFeet !== undefined}>
                        <span class="wk-dot">{props.forecast.place.elevationFeet!.toLocaleString("en-US")} FT</span>
                    </Show>
                    <span class="wk-dot">
                        {serialFor(props.forecast, today()?.date ?? props.forecast.hours[0].startTime.slice(0, 10))}
                    </span>
                    <span class="wk-dot">PRINTED {printedAt(props.forecast)}</span>
                    <Show when={!props.forecast.sun}>
                        <Refresh forecast={props.forecast} />
                    </Show>
                    <p class="wk-legal">{copy().fine}</p>
                </div>
            </div>
        </article>
    )
}

function Temps(props: { day: DaySummary }) {
    return (
        <span class="wk-hilo" data-digits={String(Math.abs(props.day.high ?? 0)).length}>
            <b class="wk-hi">{formatTemp(props.day.high)}</b>
            <span class="wk-lo">
                <span class="wk-hide">, low </span>
                {formatTemp(props.day.low)}
            </span>
        </span>
    )
}

function Precip(props: { day: DaySummary }) {
    return (
        <Show
            when={hasSnow(props.day)}
            fallback={
                <span class="wk-amt">
                    <Glyph name="rain" />
                    <b>{props.day.precipChance}%</b>
                    <span class="wk-hide"> chance of {props.day.precipType}</span>
                </span>
            }
        >
            <span class="wk-amt" data-snow="1">
                <Glyph name="snow" />
                <b>{formatSnow(props.day.snow ?? 0)}</b>
                <span class="wk-hide"> snow</span>
            </span>
        </Show>
    )
}

function Wind(props: { day: DaySummary }) {
    return (
        <span class="wk-wind">
            <Glyph name="wind" />
            {formatWindRange(props.day)}
        </span>
    )
}

function dayLineLabel(day: DaySummary, index: number) {
    return `${getDayLabel(day, index, "long")}, ${formatLocalDate(day.date, { month: "long", day: "numeric" })}, full ticket`
}

function DayLineFields(props: { day: DaySummary; index: number; showDate?: boolean; noMark?: boolean }) {
    const label = () => getDayLabel(props.day, props.index, "long")
    return (
        <>
            <span class="wk-line-day">
                <b>{label()}</b>
                <Show when={props.showDate}>
                    <span class="wk-dot">{shortDate(props.day.date)}</span>
                </Show>
            </span>
            <Show when={!props.noMark}>
                <Highlight day={props.day} />
            </Show>
            <Temps day={props.day} />
            <Precip day={props.day} />
            <Punch score={props.day.condies?.score} size="m" />
            <span class="wk-line-cond">
                <span class="wk-line-text">
                    <Glyph name={conditionGlyph(conditionsOf(props.day), !!props.day.day)} />
                    <span>{conditionsOf(props.day)}</span>
                </span>
                <Wind day={props.day} />
            </span>
        </>
    )
}

// The day mark and date on the weather stub, the same on every ticket.
function StubCell(props: { day: DaySummary }) {
    return (
        <div class="wk-stub" data-day={inkOf(props.day.date)}>
            <Sky print={skyDay(props.day)} size="stub" />
            <span class="wk-mark" data-len={letterOf(props.day.date).length} aria-hidden="true">
                {letterOf(props.day.date)}
            </span>
            <span class="wk-dot wk-stub-date" aria-hidden="true">
                {shortDate(props.day.date)}
            </span>
        </div>
    )
}

const tilts = [-1.1, 0.8, -0.5, 1.2, -0.9, 0.6, -1.3]

function StackTicket(props: { day: DaySummary; index: number; link: DesignProps["link"] }) {
    return (
        <li
            class="wk-wt"
            data-day={inkOf(props.day.date)}
            style={{ "--i": props.index, "--tilt": `${tilts[props.index % tilts.length]}deg` }}
        >
            <span class="wk-wt-loop" aria-hidden="true" />
            <a
                class="wk-tk-face wk-wt-a"
                aria-label={dayLineLabel(props.day, props.index)}
                {...props.link({ name: "day", date: props.day.date })}
            >
                <div class="wk-seg wk-wt-stub">
                    <StubCell day={props.day} />
                </div>
                <div class="wk-seg wk-wt-body">
                    <div class="wk-line">
                        <DayLineFields day={props.day} index={props.index} />
                    </div>
                </div>
            </a>
        </li>
    )
}

function BestDay(props: { forecast: LabForecast; link: DesignProps["link"] }) {
    const best = () => props.forecast.best!
    return (
        <a
            class="wk-seg wk-best"
            data-day={inkOf(best().day.date)}
            {...props.link({ name: "day", date: best().day.date })}
        >
            <span class="wk-mark" data-len={letterOf(best().day.date).length} aria-hidden="true">
                {letterOf(best().day.date)}
            </span>
            <span class="wk-best-text">
                <span>Best day</span>
                <b>{getDayLabel(best().day, best().index, "long")}</b>
                <span class="wk-dot">{best().day.condies!.bestWindow}</span>
            </span>
            <Punch score={best().day.condies!.score} size="m" />
            <Glyph name="right" />
        </a>
    )
}

function WeekHead(props: { forecast: LabForecast }) {
    return (
        <Show when={props.forecast.weekSnow >= 1 || props.forecast.storm}>
            <section class="wk-tk" aria-label="The week">
                <div class="wk-tk-face">
                    <div class="wk-seg wk-pad wk-wh-top">
                        <Show when={props.forecast.weekSnow >= 1}>
                            <p class="wk-wh-snow">
                                <Glyph name="snow" />
                                <b>{formatSnow(props.forecast.weekSnow)}</b>
                                <span>this week</span>
                            </p>
                        </Show>
                        <Show when={props.forecast.storm}>
                            <p class="wk-wh-storm">{props.forecast.storm!.text}</p>
                        </Show>
                    </div>
                </div>
            </section>
        </Show>
    )
}

const dangerNames = ["Low", "Moderate", "Considerable", "High", "Extreme"]

function AvalancheTicket(props: { avalanche: NonNullable<LabForecast["avalanche"]> }) {
    const rating = () => props.avalanche.rating
    return (
        <section class="wk-tk wk-avy" aria-label="Avalanche danger">
            <div class="wk-tk-face">
                <div class="wk-seg wk-avy-row">
                    <Show when={rating()}>
                        <div class="wk-avy-left">
                            <div
                                class="wk-avy-level"
                                data-level={rating()!.level}
                                role="img"
                                aria-label={`Danger level ${rating()!.level} of 5: ${rating()!.name}`}
                            >
                                <b>{rating()!.level}</b>
                                <span>{dangerNames[rating()!.level - 1] ?? rating()!.name}</span>
                            </div>
                            <div class="wk-avy-pips" aria-hidden="true">
                                <For each={[1, 2, 3, 4, 5]}>
                                    {(n) => <i data-level={n} data-on={n === rating()!.level ? "1" : "0"} />}
                                </For>
                            </div>
                        </div>
                    </Show>
                    <div class="wk-avy-text">
                        <h2 class="wk-sec">Avalanche danger</h2>
                        <Show
                            when={rating()}
                            fallback={
                                <>
                                    <p class="wk-avy-title">No current avalanche rating</p>
                                    <p class="wk-avy-sub">That doesn't mean it's safe.</p>
                                </>
                            }
                        >
                            <Show when={rating()!.warning}>
                                <p class="wk-avy-warn">
                                    <Glyph name="hazard" />
                                    Avalanche warning in effect
                                </p>
                            </Show>
                            <p class="wk-avy-advice">{rating()!.advice}</p>
                            <p class="wk-avy-varies">Varies by slope and elevation.</p>
                        </Show>
                        <a class="wk-avy-link" href={props.avalanche.link} target="_blank" rel="noreferrer">
                            <span>{props.avalanche.center}</span>
                            <Glyph name="right" />
                        </a>
                    </div>
                </div>
            </div>
        </section>
    )
}

function DepthTicket(props: { depth: NonNullable<LabForecast["snowDepth"]>; now: number }) {
    return (
        <section class="wk-tk wk-depth" aria-label="Snow depth">
            <div class="wk-tk-face">
                <div class="wk-seg wk-pad">
                    <h2 class="wk-sec">Snow depth</h2>
                    <div class="wk-depth-row">
                        <p class="wk-depth-n">
                            <Glyph name="snow" />
                            <b>{Math.round(props.depth.depth)}″</b>
                        </p>
                        <p class="wk-depth-c">
                            <b>
                                {props.depth.change > 0 ? "+" : ""}
                                {Math.round(props.depth.change)}″
                            </b>
                            <span>24 hr</span>
                        </p>
                    </div>
                    <p class="wk-depth-st">
                        {props.depth.station.name}, {props.depth.station.miles.toFixed(1)} mi,{" "}
                        {props.depth.station.elevation.toLocaleString("en-US")} ft
                    </p>
                    <p class="wk-depth-age">Measured {formatAge(props.now - props.depth.measuredAt)}</p>
                </div>
            </div>
        </section>
    )
}

function Home(props: DesignProps & { saved: boolean; onSave: () => void }) {
    const f = () => props.forecast
    const avalancheFirst = () => (f().avalanche?.rating?.level ?? 0) >= 3
    return (
        <main class="wk-home">
            <Show when={avalancheFirst()}>
                <div class="wk-avyfirst">
                    <AvalancheTicket avalanche={f().avalanche!} />
                </div>
            </Show>
            <div class="wk-hang">
                <Wicket />
                <HomeTicket forecast={f()} saved={props.saved} onSave={props.onSave} link={props.link} />
            </div>
            <div class="wk-rest">
                <WeekHead forecast={f()} />
                <Show when={f().days.length > 1}>
                    <ol class="wk-stack" aria-label="The rest of the week">
                        <For each={f().days.slice(1)}>
                            {(day, i) => <StackTicket day={day} index={i() + 1} link={props.link} />}
                        </For>
                    </ol>
                </Show>
                <Show when={(f().avalanche && !avalancheFirst()) || f().snowDepth}>
                    <div class="wk-mtn">
                        <Show when={f().avalanche && !avalancheFirst()}>
                            <AvalancheTicket avalanche={f().avalanche!} />
                        </Show>
                        <Show when={f().snowDepth}>
                            <DepthTicket depth={f().snowDepth!} now={f().now} />
                        </Show>
                    </div>
                </Show>
            </div>
        </main>
    )
}

function DayScreen(props: DesignProps & { date: string }) {
    const f = () => props.forecast
    const index = createMemo(() => f().days.findIndex((d) => d.date === props.date))
    const day = () => f().days[index()]
    const prev = () => f().days[index() - 1]
    const next = () => f().days[index() + 1]
    const hours = createMemo<Period[]>(() => f().hours.filter((h) => h.startTime.slice(0, 10) === props.date))
    const copy = createMemo(() => ticketCopy(conditionsOf(day()), day()))
    const insight = () =>
        ({
            snow: "All snow at this elevation",
            rain: "Rain at this elevation",
            mix: "Right at the rain/snow line",
        })[day().phase!.phase]
    return (
        <Show
            when={day()}
            fallback={
                <main class="wk-state">
                    <p>There's no forecast for this day.</p>
                    <a class="wk-btn" {...props.link({ name: "home" })}>
                        Back to the forecast
                    </a>
                </main>
            }
        >
            <nav class="wk-daynav" aria-label="Days">
                <Show when={prev()}>
                    <a
                        class="wk-daynav-a"
                        data-day={inkOf(prev()!.date)}
                        {...props.link({ name: "day", date: prev()!.date })}
                    >
                        <Glyph name="left" />
                        <span>{getDayLabel(prev()!, index() - 1, "short")}</span>
                    </a>
                </Show>
                <a class="wk-daynav-home" {...props.link({ name: "home" })}>
                    Back to {f().place.city}
                </a>
                <Show when={next()}>
                    <a
                        class="wk-daynav-a"
                        data-day={inkOf(next()!.date)}
                        {...props.link({ name: "day", date: next()!.date })}
                    >
                        <span>{getDayLabel(next()!, index() + 1, "short")}</span>
                        <Glyph name="right" />
                    </a>
                </Show>
            </nav>
            <Show when={props.date} keyed>
                {(_key) => (
                    <main class="wk-dayscreen" data-day={inkOf(props.date)}>
                        <div class="wk-daymain">
                            <Wicket />
                            <article class="wk-tk wk-full">
                                <div class="wk-tk-face">
                                    <div class="wk-seg wk-flap">
                                        <span class="wk-kind">{copy().kind}</span>
                                    </div>
                                    <div class="wk-seg wk-field">
                                        <div class="wk-field-print">
                                            <span class="wk-dot">{printDate(props.date)}</span>
                                            <span class="wk-dot">{serialFor(f(), props.date)}</span>
                                        </div>
                                        <div class="wk-stage">
                                            <Sky print={skyDay(day())} size="field" />
                                            <h1 class="wk-dayname">
                                                <Fit text={getDayLabel(day(), index(), "long")} class="wk-city" />
                                            </h1>
                                            <p class="wk-dayplace">
                                                {f().place.city}, {f().place.state}
                                            </p>
                                            <p
                                                class="wk-temp"
                                                data-digits={String(Math.abs(day().high ?? day().low ?? 0)).length}
                                            >
                                                {formatTemp(day().high ?? day().low)}
                                            </p>
                                            <p class="wk-daylow">
                                                <Show when={day().high !== undefined} fallback={<span>Low</span>}>
                                                    <span>Low {formatTemp(day().low)}</span>
                                                </Show>
                                            </p>
                                            <span class="wk-edgeprint" aria-hidden="true">
                                                {copy().edge}
                                            </span>
                                        </div>
                                        <div class="wk-condstrip">
                                            <div class="wk-cond">
                                                <Glyph name={conditionGlyph(conditionsOf(day()), !!day().day)} />
                                                <p>{conditionsOf(day())}</p>
                                            </div>
                                            <Show when={day().highlight}>
                                                <div class="wk-slam">
                                                    <Highlight day={day()} size="l" />
                                                </div>
                                            </Show>
                                        </div>
                                    </div>
                                    <div class="wk-seg wk-todayrow">
                                        <StubCell day={day()} />
                                        <div class="wk-stat-score">
                                            <Punch score={day().condies?.score} size="l" />
                                            <div class="wk-stat-window">
                                                <span class="wk-sec">Condies</span>
                                                <Show
                                                    when={day().condies}
                                                    fallback={<span class="wk-stat-nw">No score for this day</span>}
                                                >
                                                    <span class="wk-stat-nw">Best window</span>
                                                    <span class="wk-dot">{day().condies!.bestWindow}</span>
                                                </Show>
                                            </div>
                                        </div>
                                    </div>
                                    <div class="wk-seg wk-pad wk-stats">
                                        <div class="wk-stat-grid">
                                            <div class="wk-stat">
                                                <span class="wk-sec">Precip</span>
                                                <p>
                                                    <Glyph name={day().precipType === "snow" ? "snow" : "rain"} />
                                                    <b>{day().precipChance}%</b> {day().precipType}
                                                </p>
                                            </div>
                                            <div class="wk-stat">
                                                <span class="wk-sec">Wind</span>
                                                <p>
                                                    <Glyph name="wind" />
                                                    <b>{formatWindRange(day())}</b>
                                                </p>
                                            </div>
                                            <Show when={day().gust !== undefined}>
                                                <div class="wk-stat">
                                                    <span class="wk-sec">Gusts</span>
                                                    <p>
                                                        <Glyph name="wind" />
                                                        <b>{day().gust} mph</b>
                                                    </p>
                                                </div>
                                            </Show>
                                            <Show when={hasSnow(day())}>
                                                <div class="wk-stat">
                                                    <span class="wk-sec">Snow total</span>
                                                    <p>
                                                        <Glyph name="snow" />
                                                        <b>{formatSnow(day().snow ?? 0)}</b>
                                                    </p>
                                                </div>
                                            </Show>
                                        </div>
                                        <Show when={day().phase}>
                                            <div class="wk-insight">
                                                <p class="wk-insight-t">{insight()}</p>
                                                <p class="wk-insight-s">
                                                    Snow level {day().phase!.snowLevelFeet.toLocaleString("en-US")} ft,
                                                    this spot is {day().phase!.elevationFeet.toLocaleString("en-US")} ft
                                                </p>
                                            </div>
                                        </Show>
                                    </div>
                                    <div class="wk-seg wk-tear-top" aria-hidden="true" />
                                </div>
                            </article>
                        </div>
                        <section class="wk-tk wk-stub-tear" aria-label="Hour by hour and detail">
                            <div class="wk-tk-face">
                                <div class="wk-seg wk-torn" aria-hidden="true" />
                                <div class="wk-seg wk-pad">
                                    <Show
                                        when={hours().length}
                                        fallback={<p class="wk-nohours">Hourly numbers aren't out for this day yet.</p>}
                                    >
                                        <Barcode hours={hours()} limit={36} />
                                    </Show>
                                </div>
                                <div class="wk-seg wk-pad">
                                    <ol class="wk-periods">
                                        <For each={day().periods}>
                                            {(p) => (
                                                <li>
                                                    <h3>
                                                        <span>{p.name}</span>
                                                        <b>{formatTemp(p.temperature)}</b>
                                                    </h3>
                                                    <p>{p.detailedForecast}</p>
                                                </li>
                                            )}
                                        </For>
                                    </ol>
                                </div>
                                <div class="wk-seg wk-legal">
                                    <p>{copy().fine}</p>
                                </div>
                            </div>
                        </section>
                    </main>
                )}
            </Show>
        </Show>
    )
}

function SpotTicket(props: { spot: LabSpot & { day?: DaySummary }; rank: number; link: DesignProps["link"] }) {
    const day = () => props.spot.day
    return (
        <li
            class="wk-wt wk-spot"
            data-day={day() ? inkOf(day()!.date) : "none"}
            style={{ "--i": props.rank, "--tilt": `${tilts[props.rank % tilts.length]}deg` }}
        >
            <span class="wk-wt-loop" aria-hidden="true" />
            <a
                class="wk-tk-face wk-wt-a"
                aria-label={`Number ${props.rank + 1}: ${props.spot.name}`}
                {...props.link({ name: "home" })}
            >
                <div class="wk-seg wk-wt-stub">
                    <Show when={day()} fallback={<div class="wk-stub" data-day="none" />}>
                        <StubCell day={day()!} />
                    </Show>
                </div>
                <div class="wk-seg wk-wt-body">
                    <div class="wk-spot-line">
                        <span class="wk-spot-rank" aria-hidden="true">
                            {props.rank + 1}
                        </span>
                        <span class="wk-spot-name">
                            <Fit text={props.spot.name} class="wk-spot-fit" />
                        </span>
                        <Punch score={day()?.condies?.score} size="m" />
                        <Show when={day()} fallback={<span class="wk-spot-when">No forecast for this day</span>}>
                            <span class="wk-spot-when">
                                <b>{formatLocalDate(day()!.date, { weekday: "long" })}</b>
                                <Show when={day()!.condies}>
                                    <span class="wk-dot">{day()!.condies!.bestWindow}</span>
                                </Show>
                            </span>
                            <Show when={hasSnow(day()!)}>
                                <span class="wk-amt" data-snow="1">
                                    <Glyph name="snow" />
                                    <b>{formatSnow(day()!.snow ?? 0)}</b>
                                </span>
                            </Show>
                            <Highlight day={day()!} />
                        </Show>
                    </div>
                </div>
            </a>
        </li>
    )
}

function SpotsScreen(props: DesignProps) {
    const [filter, setFilter] = createSignal<string>()
    const ranked = createMemo(() => rankSpots(props.spots, filter()))
    const dates = () => props.spots[0]?.days ?? []
    return (
        <main class="wk-spots">
            <header class="wk-spots-head">
                <h1 class="wk-title">My Spots</h1>
                <p class="wk-spots-sub">One zipper, every ticket, best on top.</p>
            </header>
            <Show
                when={props.spots.length}
                fallback={
                    <div class="wk-tk wk-empty">
                        <Wicket />
                        <div class="wk-tk-face">
                            <div class="wk-seg wk-flap">
                                <span class="wk-kind">No tickets yet</span>
                            </div>
                            <div class="wk-seg wk-pad">
                                <p class="wk-empty-t">Bare zipper.</p>
                                <p>Tap the star on any forecast to add it here.</p>
                            </div>
                        </div>
                    </div>
                }
            >
                <div class="wk-filter" role="group" aria-label="Filter by day">
                    <button
                        type="button"
                        aria-pressed={filter() ? "false" : "true"}
                        onClick={() => setFilter(undefined)}
                    >
                        This week
                    </button>
                    <For each={dates()}>
                        {(day, i) => (
                            <button
                                type="button"
                                data-day={inkOf(day.date)}
                                aria-pressed={filter() === day.date ? "true" : "false"}
                                onClick={() => setFilter(day.date)}
                            >
                                {getDayLabel(day, i(), "short")}
                            </button>
                        )}
                    </For>
                </div>
                <div class="wk-turkey">
                    <span class="wk-tzip" aria-hidden="true" />
                    <ol class="wk-tlist">
                        <For each={ranked()}>
                            {(spot, i) => <SpotTicket spot={spot} rank={i()} link={props.link} />}
                        </For>
                    </ol>
                </div>
            </Show>
        </main>
    )
}

function Dialog(props: { label: string; onClose: () => void; children: any }) {
    let dialog!: HTMLDialogElement
    onSettled(() => {
        dialog.showModal()
    })
    return (
        <dialog
            ref={dialog}
            class="wk-dialog"
            aria-label={props.label}
            onCancel={(event: Event) => {
                event.preventDefault()
                props.onClose()
            }}
        >
            {props.children}
        </dialog>
    )
}

function AlertSheet(props: { alert: LabAlert; onClose: () => void }) {
    return (
        <Dialog label={props.alert.event} onClose={props.onClose}>
            <div class="wk-sign" data-sev={props.alert.severity}>
                <div class="wk-sign-top">
                    <span class="wk-sign-sev">
                        <Glyph name="hazard" />
                        {props.alert.severity === "Unknown" ? "Alert" : props.alert.severity}
                    </span>
                    <button type="button" class="wk-close" aria-label="Close" onClick={props.onClose}>
                        <Glyph name="close" />
                    </button>
                </div>
                <h2 class="wk-sign-event">{props.alert.event}</h2>
                <p class="wk-sign-head">{props.alert.headline}</p>
                <dl class="wk-sign-parts">
                    <For each={props.alert.parts}>
                        {(part) => (
                            <div>
                                <Show when={part.label}>
                                    <dt>{part.label}</dt>
                                </Show>
                                <dd>{part.text}</dd>
                            </div>
                        )}
                    </For>
                </dl>
                <Show when={props.alert.instruction}>
                    <p class="wk-sign-inst">{props.alert.instruction}</p>
                </Show>
            </div>
        </Dialog>
    )
}

function SearchSheet(props: { samples: string[]; onClose: () => void }) {
    const [query, setQuery] = createSignal("")
    const results = createMemo(() => {
        const q = query().trim().toLowerCase()
        return q ? props.samples.filter((s) => s.toLowerCase().includes(q)) : props.samples
    })
    return (
        <Dialog label="Find a place" onClose={props.onClose}>
            <div class="wk-tk wk-window">
                <div class="wk-tk-face">
                    <div class="wk-seg wk-flap">
                        <span class="wk-kind">Ticket window</span>
                        <button type="button" class="wk-close" aria-label="Close" onClick={props.onClose}>
                            <Glyph name="close" />
                        </button>
                    </div>
                    <div class="wk-seg wk-pad">
                        <h2 class="wk-window-t">Where to?</h2>
                        <form
                            class="wk-window-form"
                            onSubmit={(event: Event) => {
                                event.preventDefault()
                                props.onClose()
                            }}
                        >
                            <label class="wk-hide" for="wk-q">
                                City, town or resort
                            </label>
                            <input
                                id="wk-q"
                                class="wk-input"
                                placeholder="City, town or resort"
                                autocomplete="off"
                                value={query()}
                                onInput={(event: InputEvent & { currentTarget: HTMLInputElement }) =>
                                    setQuery(event.currentTarget.value)
                                }
                            />
                            <button type="submit" class="wk-btn">
                                Go
                            </button>
                        </form>
                        <ul class="wk-window-list">
                            <For each={results()} fallback={<li class="wk-window-none">No matches at this window.</li>}>
                                {(sample) => (
                                    <li>
                                        <button type="button" onClick={props.onClose}>
                                            <span>{sample}</span>
                                            <Glyph name="right" />
                                        </button>
                                    </li>
                                )}
                            </For>
                        </ul>
                    </div>
                </div>
            </div>
        </Dialog>
    )
}

function LoadingTicket() {
    return (
        <main class="wk-state wk-loading" role="status">
            <Wicket />
            <div class="wk-tk">
                <div class="wk-tk-face">
                    <div class="wk-seg wk-flap">
                        <span class="wk-kind">Printing your ticket</span>
                    </div>
                    <div class="wk-seg wk-pad">
                        <div class="wk-print" aria-hidden="true">
                            <For each={Array.from({ length: 36 }, (_, i) => i)}>
                                {(i) => <i style={{ "--i": i, height: `${((i * 47) % 70) + 30}%` }} />}
                            </For>
                        </div>
                        <p class="wk-dot wk-print-line">FETCHING FORECAST</p>
                    </div>
                </div>
            </div>
        </main>
    )
}

function ErrorTicket(props: { link: DesignProps["link"] }) {
    return (
        <main class="wk-state">
            <div class="wk-tk">
                <div class="wk-tk-face">
                    <div class="wk-seg wk-flap">
                        <span class="wk-kind">Ticket misprint</span>
                    </div>
                    <div class="wk-seg wk-pad wk-error">
                        <span class="wk-void" aria-hidden="true">
                            VOID
                        </span>
                        <p class="wk-error-t">Couldn't load this page.</p>
                        <div class="wk-error-a">
                            <button type="button" class="wk-btn" onClick={() => location.reload()}>
                                Try again
                            </button>
                            <a class="wk-btn wk-btn-ghost" {...props.link({ name: "home" })}>
                                Go home
                            </a>
                        </div>
                    </div>
                </div>
            </div>
        </main>
    )
}

export default function WicketDesign(props: DesignProps) {
    const [searching, setSearching] = createSignal(props.open === "search")
    const ready = () => props.status === "ready"
    const firstAlert = () => (props.open === "alert" && ready() ? bySeverity(props.forecast.alerts)[0] : undefined)
    const [alert, setAlert] = createSignal<LabAlert | undefined>(firstAlert())
    const [saved, setSaved] = createSignal(false)

    let root!: HTMLDivElement

    // Foil follows the pointer. Nothing to do when someone has asked for less motion.
    onSettled(() => {
        if (reducedMotion()) {
            return
        }
        const onMove = (event: PointerEvent) => {
            root.style.setProperty("--foil", `${Math.round((event.clientX + event.clientY) * 0.9)}deg`)
        }
        window.addEventListener("pointermove", onMove, { passive: true })
        return () => window.removeEventListener("pointermove", onMove)
    })

    const dateOf = (screen: Screen) => (screen.name === "day" ? screen.date : "")

    return (
        <div ref={root} class="wk" data-theme={props.theme}>
            <Defs />
            <Band {...props} onSearch={() => setSearching(true)} />
            <Switch>
                <Match when={props.status === "loading"}>
                    <LoadingTicket />
                </Match>
                <Match when={props.status === "error"}>
                    <ErrorTicket link={props.link} />
                </Match>
                <Match when={true}>
                    <Show when={props.offline}>
                        <Offline />
                    </Show>
                    <Show when={props.screen.name === "home" && props.forecast.alerts.length}>
                        <Tapes alerts={props.forecast.alerts} onOpen={setAlert} />
                    </Show>
                    <Switch>
                        <Match when={props.screen.name === "home"}>
                            <Home {...props} saved={saved()} onSave={() => setSaved(!saved())} />
                        </Match>
                        <Match when={props.screen.name === "day"}>
                            <DayScreen {...props} date={dateOf(props.screen)} />
                        </Match>
                        <Match when={props.screen.name === "spots"}>
                            <SpotsScreen {...props} />
                        </Match>
                    </Switch>
                </Match>
            </Switch>
            <Show when={searching()}>
                <SearchSheet samples={props.searchSamples} onClose={() => setSearching(false)} />
            </Show>
            <Show when={alert()}>
                <AlertSheet alert={alert()!} onClose={() => setAlert(undefined)} />
            </Show>
        </div>
    )
}
