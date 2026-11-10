import "@fontsource-variable/league-gothic/standard.css"
import "@fontsource-variable/chivo/wght.css"
import "./strata.css"

import { createMemo, createSignal, flush, For, Match, Show, Switch } from "solid-js"
import type { ParentProps } from "solid-js"

import { type DaySummary, formatSnow, formatTemp, formatWindRange, getDayLabel, hasSnow } from "../../lib/daily.ts"
import type { Period } from "../../lib/nws.ts"
import { formatAge, formatLocalDate, getPrecipType } from "../../lib/util.ts"
import { type DesignProps, type LabAlert, type LabForecast, rankSpots, type Screen } from "../data.ts"

import { fit } from "./fit.ts"
import {
    avalancheScale,
    type Paint,
    paintPrecip,
    paintSnow,
    paintTemp,
    paintVars,
    paintWind,
    stippleColor,
    temperatureRamp,
} from "./ramp.ts"
import { type Texture, textureFor } from "./texture.ts"

type View = "temp" | "precip" | "wind" | "snow"

const hourOf = (p: Period) => Number(p.startTime.slice(11, 13))
const dateOf = (p: Period) => p.startTime.slice(0, 10)

const sentence = (text: string) => {
    const lower = text.toLowerCase()
    return lower.charAt(0).toUpperCase() + lower.slice(1)
}

const numeral = (temperature?: number) => formatTemp(temperature).replace("-", "−")

const windSpeed = (p: Period) => p.windSpeed.value ?? p.windSpeed.maxValue ?? 0

const conditionSize = (text: string) =>
    text.length <= 14 ? "xl" : text.length <= 26 ? "l" : text.length <= 48 ? "m" : "s"

function Cat() {
    return (
        <svg class="st-cat" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M5 1l4 4h6l4-4v9l-2 3 2 7h2v-5h2v7H4l3-9-2-3Z" />
        </svg>
    )
}

function Tile(props: { score?: number; size?: "m" | "l" }) {
    return (
        <Show when={props.score !== undefined}>
            <span
                class="st-tile"
                data-size={props.size ?? "m"}
                role="img"
                aria-label={`Condies score ${props.score} out of 100`}
            >
                <span class="st-tile-label">Condies</span>
                <span class="st-tile-num">{props.score}</span>
            </span>
        </Show>
    )
}

function Marker(props: { highlight?: DaySummary["highlight"] }) {
    return (
        <Show when={props.highlight}>
            {(kind) => <span class="st-mark">{kind() === "pow" ? "POW DAY" : "PRIMO"}</span>}
        </Show>
    )
}

// Texture always goes in a zone of its own. No text sits on it.
function Tex(props: { texture?: Texture; paint: Paint; neutral?: boolean }) {
    return (
        <Show when={props.texture}>
            {(texture) => (
                <i
                    class="st-tex"
                    aria-hidden="true"
                    style={{
                        "--tex": texture().image,
                        "--tc":
                            texture().kind === "snow" && !props.neutral ? stippleColor(props.paint) : props.paint.ink,
                    }}
                />
            )}
        </Show>
    )
}

function Masthead(props: { app: DesignProps; paint?: Paint; onSearch: () => void }) {
    const toggleTheme = () => props.app.setTheme(props.app.theme === "light" ? "dark" : "light")
    return (
        <header class="st-mast" style={props.paint ? paintVars(props.paint) : undefined}>
            <a class="st-mast-mark" {...props.app.link({ name: "home" })}>
                Condies
            </a>
            <nav class="st-mast-nav" aria-label="Main">
                <button type="button" onClick={props.onSearch}>
                    Search
                </button>
                <button type="button" aria-label="Open the map">
                    Map
                </button>
                <a {...props.app.link({ name: "spots" })}>Spots</a>
                <button
                    type="button"
                    aria-label={`Switch to ${props.app.theme === "light" ? "dark" : "light"} theme`}
                    onClick={toggleTheme}
                >
                    {props.app.theme === "light" ? "Dark" : "Light"}
                </button>
            </nav>
        </header>
    )
}

function Now(props: { app: DesignProps; compact: boolean; onSearch: () => void }) {
    const f = () => props.app.forecast
    const paint = () => paintTemp(f().current.temperature, props.app.theme)
    const texture = () => textureFor(f().current.shortForecast, f().current.snowInches)
    const [starred, setStarred] = createSignal(false)
    const [refreshed, setRefreshed] = createSignal(false)

    const feels = () => {
        const { feelsLike, temperature } = f().current
        return feelsLike !== undefined && Math.abs(feelsLike - temperature) >= 3 ? feelsLike : undefined
    }
    const wind = () => {
        const speed = windSpeed(f().current)
        if (!speed) {
            return "Calm."
        }
        const gust = f().current.windGust?.value
        return `${f().current.windDirection} wind ${speed} mph${gust !== undefined && gust > speed ? `, gusts ${gust}` : ""}.`
    }
    const age = () => (refreshed() ? "just now" : formatAge(f().now - Date.parse(f().updatedAt)))
    const condition = () => `${sentence(f().current.shortForecast)}.`
    const place = () => `${f().place.city}, ${f().place.state}`

    return (
        <section
            class="st-now st-lay"
            style={{ ...paintVars(paint()), "--i": 0 }}
            data-compact={props.compact ? "" : undefined}
            data-zig={texture()?.zigzag ? "" : undefined}
        >
            <Show when={!props.compact}>
                <Masthead app={props.app} paint={paint()} onSearch={props.onSearch} />
            </Show>
            <div class="st-cityrow">
                <h1 class="st-city" style={fit(place())}>
                    {place()}
                </h1>
            </div>
            <div class="st-sky">
                <Tex texture={texture()} paint={paint()} />
            </div>
            <div class="st-body">
                <div class="st-meow-row">
                    <p class="st-meow">
                        <Cat />
                        Right meow
                    </p>
                    <button
                        type="button"
                        class="st-star"
                        aria-pressed={starred() ? "true" : "false"}
                        aria-label={starred() ? "Remove from My Spots" : "Star this place"}
                        onClick={() => setStarred(!starred())}
                    >
                        {starred() ? "Starred" : "Star"}
                    </button>
                </div>
                <div class="st-reading">
                    <div class="st-figure">
                        <p class="st-numeral" style={fit(numeral(f().current.temperature))}>
                            {numeral(f().current.temperature)}
                        </p>
                    </div>
                    <div class="st-reading-text">
                        <p class="st-condition" data-size={conditionSize(condition())}>
                            {condition()}
                        </p>
                        <p class="st-now-meta">
                            <Show when={feels() !== undefined}>
                                <span>Feels like {numeral(feels())}.</span>{" "}
                            </Show>
                            <span>{wind()}</span>
                        </p>
                    </div>
                </div>
                <button type="button" class="st-updated" onClick={() => setRefreshed(true)}>
                    Updated {age()}
                </button>
            </div>
        </section>
    )
}

const severityRank: Record<LabAlert["severity"], number> = { Extreme: 0, Severe: 1, Moderate: 2, Minor: 3, Unknown: 4 }

// Extreme and Severe come before the numeral. The masthead prints on the same black band.
function Hazards(props: {
    app: DesignProps
    alerts: LabAlert[]
    onOpen: (alert: LabAlert) => void
    onSearch: () => void
}) {
    return (
        <section class="st-hazards" aria-label="Severe weather alerts">
            <Masthead app={props.app} paint={{ bg: "#000", ink: "#fff" }} onSearch={props.onSearch} />
            <For each={props.alerts}>
                {(alert, i) => (
                    <button
                        type="button"
                        class="st-alert st-lay"
                        style={{ "--i": i() }}
                        data-severity={alert.severity}
                        onClick={() => props.onOpen(alert)}
                    >
                        <span class="st-alert-top">
                            <span class="st-alert-sev">{alert.severity}</span>
                            <span class="st-alert-more">Read</span>
                        </span>
                        <span class="st-alert-fit">
                            <span class="st-alert-event" style={fit(alert.event)}>
                                {alert.event}
                            </span>
                        </span>
                    </button>
                )}
            </For>
        </section>
    )
}

function Advisories(props: { alerts: LabAlert[]; onOpen: (alert: LabAlert) => void }) {
    return (
        <Show when={props.alerts.length}>
            <section class="st-advisories" aria-label="Weather advisories">
                <For each={props.alerts}>
                    {(alert) => (
                        <button
                            type="button"
                            class="st-advisory"
                            data-severity={alert.severity}
                            onClick={() => props.onOpen(alert)}
                        >
                            <span class="st-advisory-sev">{alert.severity}</span>
                            <span class="st-advisory-event">{alert.event}</span>
                            <span class="st-alert-more">Read</span>
                        </button>
                    )}
                </For>
            </section>
        </Show>
    )
}

interface Cell {
    paint: Paint
    word: string
    value: string
    gust?: string
    gustPaint?: Paint
}

function describe(hour: Period, view: View, theme: "light" | "dark"): Cell {
    switch (view) {
        case "precip": {
            const chance = hour.probabilityOfPrecipitation.value
            return {
                paint: paintPrecip(chance, theme),
                word: chance >= 10 ? sentence(getPrecipType(hour.shortForecast)) : "Dry",
                value: `${chance}%`,
            }
        }
        case "wind": {
            const speed = windSpeed(hour)
            const gust = hour.windGust?.value
            return {
                paint: paintWind(speed, theme),
                word: speed ? hour.windDirection : "",
                value: speed ? `${speed}` : "Calm",
                gust: gust !== undefined && gust > speed ? `${gust}` : undefined,
                gustPaint: gust !== undefined ? paintWind(gust, theme) : undefined,
            }
        }
        case "snow": {
            const inches = hour.snowInches ?? 0
            return {
                paint: paintSnow(inches, theme),
                word: inches >= 0.05 ? sentence(hour.shortForecast) : "No snow",
                value: inches >= 0.05 ? formatSnow(inches) : "0″",
            }
        }
        default:
            return {
                paint: paintTemp(hour.temperature, theme),
                word: sentence(hour.shortForecast),
                value: numeral(hour.temperature),
            }
    }
}

function HourBand(props: { app: DesignProps; hour: Period; view: View; index: number; showDay: boolean }) {
    const cell = createMemo(() => describe(props.hour, props.view, props.app.theme))
    // Wind and snow have their own densities, where a weather texture would only add noise.
    const texture = () =>
        props.view === "temp" || (props.view === "precip" && props.hour.probabilityOfPrecipitation.value >= 50)
            ? textureFor(props.hour.shortForecast, props.hour.snowInches)
            : undefined
    return (
        <li
            class="st-h st-band st-lay"
            style={{ ...paintVars(cell().paint), "--i": props.index }}
            data-zig={texture()?.zigzag ? "" : undefined}
        >
            <span class="st-h-t">
                <span class="st-h-clock">
                    <span>{props.hour.hourString.split(" ")[0]}</span>{" "}
                    <span>{props.hour.hourString.split(" ")[1]}</span>
                </span>
            </span>
            <span class="st-h-w">
                <Show when={props.showDay}>
                    <strong>{formatLocalDate(props.hour.startTime, { weekday: "short" })}.</strong>{" "}
                </Show>
                {cell().word}
            </span>
            <span class="st-h-x">
                <Tex texture={texture()} paint={cell().paint} neutral={props.view !== "temp"} />
            </span>
            <span class="st-h-v">
                {cell().value}
                <Show when={props.view === "wind" && cell().value !== "Calm"}>
                    <small class="st-h-unit">mph</small>
                </Show>
                <Show when={cell().gust}>
                    <span class="st-h-g" style={cell().gustPaint ? paintVars(cell().gustPaint!) : undefined}>
                        gust {cell().gust}
                    </span>
                </Show>
            </span>
        </li>
    )
}

const viewLabels: Record<View, string> = { temp: "Temp", precip: "Precip", wind: "Wind", snow: "Snow" }

const reducedMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches

// The stack repaints behind a copy of itself, so each new band wipes in over the old one like a shutter.
function shutter(stack: HTMLElement, update: () => void) {
    if (reducedMotion()) {
        update()
        return
    }
    const ghost = stack.cloneNode(true) as HTMLElement
    ghost.classList.add("st-ghost")
    ghost.setAttribute("aria-hidden", "true")
    stack.after(ghost)
    update()
    flush()
    const horizontal = matchMedia("(min-width: 1024px)").matches
    const from = horizontal ? "inset(0 0 100% 0)" : "inset(0 100% 0 0)"
    const bands = [...stack.children] as HTMLElement[]
    Promise.all(
        bands.map(
            (band, i) =>
                band.animate([{ clipPath: from }, { clipPath: "inset(0 0 0 0)" }], {
                    duration: 300,
                    delay: Math.min(i, 13) * 24,
                    easing: "cubic-bezier(.76,0,.24,1)",
                    fill: "backwards",
                }).finished,
        ),
    ).finally(() => ghost.remove())
}

function HourStack(props: { app: DesignProps; hours: Period[]; name: string; home?: boolean }) {
    const [view, setView] = createSignal<View>("temp")
    const views = () => {
        const list: View[] = ["temp", "precip", "wind"]
        if (props.hours.some((h) => (h.snowInches ?? 0) >= 0.05)) {
            list.push("snow")
        }
        return list
    }
    const summary = createMemo(() => {
        const hours = props.hours
        if (!hours.length) {
            return "No hourly data."
        }
        const temps = hours.map((h) => h.temperature)
        const maxChance = Math.max(...hours.map((h) => h.probabilityOfPrecipitation.value))
        const maxWind = Math.max(...hours.map(windSpeed))
        return `${hours.length} hours from ${hours[0].hourString}. Temperature ${Math.min(...temps)}° to ${Math.max(...temps)}°. Precipitation chance up to ${maxChance}%. Wind up to ${maxWind} mph.`
    })

    let stack!: HTMLOListElement
    const choose = (next: View) => {
        if (next !== view()) {
            shutter(stack, () => setView(next))
        }
    }

    return (
        <section class="st-hours" aria-label={props.name}>
            <div class="st-tabs" role="group" aria-label="Hourly view">
                <For each={views()}>
                    {(name) => (
                        <button
                            type="button"
                            class="st-tab"
                            aria-pressed={view() === name ? "true" : "false"}
                            onClick={() => choose(name)}
                        >
                            {viewLabels[name]}
                        </button>
                    )}
                </For>
            </div>
            <p class="st-vh">{summary()}</p>
            <div class="st-stack-wrap">
                <ol ref={stack} class={`st-stack ${props.home ? "st-stack-home" : ""}`}>
                    <For each={props.hours}>
                        {(hour, i) => (
                            <HourBand
                                app={props.app}
                                hour={hour}
                                view={view()}
                                index={i()}
                                showDay={i() > 0 && hourOf(hour) === 0}
                            />
                        )}
                    </For>
                </ol>
            </div>
        </section>
    )
}

function hourCells(hours: Period[], theme: "light" | "dark") {
    const cells: (Paint | undefined)[] = Array.from({ length: 24 })
    for (const h of hours) {
        cells[hourOf(h)] = paintTemp(h.temperature, theme)
    }
    return cells
}

function stripLabel(hours: Period[]) {
    if (!hours.length) {
        return "No hourly data for this day."
    }
    const warmest = hours.reduce((a, b) => (b.temperature > a.temperature ? b : a))
    return `Hourly temperature from ${Math.min(...hours.map((h) => h.temperature))}° to ${warmest.temperature}°, warmest at ${warmest.hourString}.`
}

function dayFacts(day: DaySummary) {
    const weather = hasSnow(day) ? `${formatSnow(day.snow!)} snow` : `${day.precipChance}% ${day.precipType}`
    return `${weather}. Wind ${formatWindRange(day)}.`
}

function Strips(props: { app: DesignProps; hours: Period[] }) {
    return (
        <div class="st-strips" role="img" aria-label={stripLabel(props.hours)}>
            <For each={hourCells(props.hours, props.app.theme)}>
                {(cell) => <i style={cell ? { background: cell.bg } : undefined} />}
            </For>
        </div>
    )
}

function DayBand(props: { app: DesignProps; day: DaySummary; index: number; hours: Period[] }) {
    const high = () => paintTemp(props.day.high ?? props.day.low ?? 50, props.app.theme)
    const low = () => (props.day.low !== undefined ? paintTemp(props.day.low, props.app.theme) : undefined)
    const label = () => getDayLabel(props.day, props.index, "long")
    const conditions = () => props.day.day?.shortForecast ?? props.day.night?.shortForecast ?? ""

    return (
        <a
            class="st-day st-lay"
            style={{ ...paintVars(high()), "--i": props.index + 4 }}
            data-scored={props.day.condies ? "" : undefined}
            aria-label={`${label()}, ${formatLocalDate(props.day.date, { month: "short", day: "numeric" })}. High ${props.day.high ?? "not available"}, low ${props.day.low ?? "not available"}. ${sentence(conditions())}. ${dayFacts(props.day)}${props.day.condies ? ` Condies score ${props.day.condies.score}.` : ""}${props.day.highlight ? ` ${props.day.highlight === "pow" ? "Pow day" : "Primo"}.` : ""}`}
            {...props.app.link({ name: "day", date: props.day.date })}
        >
            <Strips app={props.app} hours={props.hours} />
            <div class="st-day-mark">
                <Marker highlight={props.day.highlight} />
            </div>
            <div class="st-day-tile">
                <Tile score={props.day.condies?.score} />
            </div>
            <div class="st-day-name">
                <span class="st-day-label" style={fit(label())}>
                    {label()}
                </span>
                <span class="st-day-date">{formatLocalDate(props.day.date, { month: "short", day: "numeric" })}</span>
            </div>
            <div class="st-day-temps">
                <span class="st-temp-high">{numeral(props.day.high)}</span>
                <span class="st-temp-low" style={low() ? paintVars(low()!) : undefined}>
                    {numeral(props.day.low)}
                </span>
            </div>
            <div class="st-day-info">
                <p class="st-day-cond">{sentence(conditions())}</p>
                <p class="st-day-facts">{dayFacts(props.day)}</p>
            </div>
        </a>
    )
}

function Week(props: { app: DesignProps }) {
    const f = () => props.app.forecast
    const hoursFor = (date: string) => f().hours.filter((h) => dateOf(h) === date)
    return (
        <section class="st-week" aria-label="7-day forecast">
            <div class="st-section-head">
                <h2 class="st-section-title">The week</h2>
                <div class="st-week-notes">
                    <Show when={f().weekSnow >= 1}>
                        <p class="st-note">
                            <strong>{formatSnow(f().weekSnow)}</strong> of snow this week.
                        </p>
                    </Show>
                </div>
            </div>
            <div class="st-days">
                <For each={f().days}>
                    {(day, i) => <DayBand app={props.app} day={day} index={i()} hours={hoursFor(day.date)} />}
                </For>
            </div>
        </section>
    )
}

type Avalanche = NonNullable<LabForecast["avalanche"]>

function AvalancheBands(props: { avalanche: Avalanche }) {
    return (
        <div class="st-av">
            <Show
                when={props.avalanche.rating}
                fallback={
                    <div class="st-av-none">
                        <p class="st-av-title">No current avalanche rating</p>
                        <p class="st-av-sub">That doesn’t mean it’s safe.</p>
                        <a class="st-av-link" href={props.avalanche.link} target="_blank" rel="noreferrer">
                            {props.avalanche.center}
                        </a>
                    </div>
                }
            >
                {(rating) => (
                    <For each={[5, 4, 3, 2, 1]}>
                        {(level) => (
                            <Show
                                when={level === rating().level}
                                fallback={<i class="st-av-step" style={{ background: avalancheScale[level].bg }} />}
                            >
                                <div class="st-av-band" style={paintVars(avalancheScale[level])}>
                                    <p class="st-av-label">Avalanche danger</p>
                                    <p class="st-av-level">
                                        <span class="st-av-num">{level}</span>
                                        <span class="st-av-name">{rating().name}</span>
                                    </p>
                                    <Show when={rating().warning}>
                                        <p class="st-av-warning">Avalanche {rating().warning} in effect</p>
                                    </Show>
                                    <p class="st-av-advice">{rating().advice}</p>
                                    <p class="st-av-foot">
                                        Varies by slope and elevation.{" "}
                                        <a href={props.avalanche.link} target="_blank" rel="noreferrer">
                                            {props.avalanche.center}
                                        </a>
                                    </p>
                                </div>
                            </Show>
                        )}
                    </For>
                )}
            </Show>
        </div>
    )
}

// Danger of 3 or higher is a go or no-go fact, so it leaves the mountain section and follows the numeral.
const risenAvalanche = (forecast: LabForecast) =>
    (forecast.avalanche?.rating?.level ?? 0) >= 3 ? forecast.avalanche : undefined

function Go(props: { app: DesignProps }) {
    const f = () => props.app.forecast
    return (
        <Show when={f().best || f().storm}>
            <section class="st-go" aria-label="Should you go">
                <Show when={f().best}>
                    {(best) => (
                        <a
                            class="st-best st-lay"
                            style={{ ...paintVars(paintTemp(best().day.high ?? 50, props.app.theme)), "--i": 2 }}
                            {...props.app.link({ name: "day", date: best().day.date })}
                        >
                            <span class="st-best-text">
                                <span class="st-best-kicker">Best day</span>
                                <span class="st-best-day">{getDayLabel(best().day, best().index, "long")}</span>
                                <span class="st-best-window">{best().day.condies!.bestWindow}</span>
                            </span>
                            <Tile score={best().day.condies!.score} />
                        </a>
                    )}
                </Show>
                <Show when={f().storm}>{(storm) => <p class="st-go-storm">{storm().text}</p>}</Show>
            </section>
        </Show>
    )
}

function Mountain(props: { app: DesignProps }) {
    const f = () => props.app.forecast
    const calmAvalanche = () => (risenAvalanche(f()) ? undefined : f().avalanche)
    return (
        <Show when={calmAvalanche() || f().snowDepth}>
            <section class="st-mountain" aria-label="Mountain conditions">
                <Show when={calmAvalanche()}>{(avalanche) => <AvalancheBands avalanche={avalanche()} />}</Show>
                <Show when={f().snowDepth}>
                    {(depth) => (
                        <div class="st-depth">
                            <div class="st-depth-cell">
                                <span class="st-depth-num">{depth().depth}″</span>
                                <span class="st-depth-cap">Snow on the ground</span>
                            </div>
                            <div class="st-depth-cell">
                                <span class="st-depth-num">
                                    {depth().change > 0 ? "+" : ""}
                                    {depth().change}″
                                </span>
                                <span class="st-depth-cap">In 24 hours</span>
                            </div>
                            <p class="st-depth-station">
                                {depth().station.name}, {depth().station.miles} mi,{" "}
                                {depth().station.elevation.toLocaleString()} ft. Measured{" "}
                                {formatAge(f().now - depth().measuredAt)}.
                            </p>
                        </div>
                    )}
                </Show>
            </section>
        </Show>
    )
}

function Sun(props: { forecast: LabForecast }) {
    return (
        <Show when={props.forecast.sun}>
            {(sun) => (
                <section class="st-sun" aria-label="Sunrise and sunset">
                    <p class="st-sun-cell">
                        <span class="st-sun-label">Sunrise</span>
                        <span class="st-sun-time">{sun().sunrise}</span>
                    </p>
                    <p class="st-sun-cell">
                        <span class="st-sun-label">Sunset</span>
                        <span class="st-sun-time">{sun().sunset}</span>
                    </p>
                </section>
            )}
        </Show>
    )
}

function Legend(props: { app: DesignProps }) {
    const ticks = [0, 32, 50, 70, 90]
    const position = (t: number) => `${((t + 20) / 140) * 100}%`
    return (
        <footer class="st-legend" aria-label="Temperature color key">
            <div class="st-legend-strip" aria-hidden="true">
                <For each={temperatureRamp}>
                    {(step) => <i style={{ background: props.app.theme === "dark" ? step.dark : step.light }} />}
                </For>
            </div>
            <div class="st-legend-ticks" aria-hidden="true">
                <For each={ticks}>{(t) => <span style={{ left: position(t) }}>{t}°</span>}</For>
            </div>
            <p class="st-legend-note">Each 5° is one color, everywhere, every day.</p>
        </footer>
    )
}

function HomeScreen(props: { app: DesignProps; onAlert: (alert: LabAlert) => void; onSearch: () => void }) {
    const f = () => props.app.forecast
    const sorted = () => [...f().alerts].sort((a, b) => severityRank[a.severity] - severityRank[b.severity])
    const severe = () => sorted().filter((a) => severityRank[a.severity] <= severityRank.Severe)
    const advisories = () => sorted().filter((a) => severityRank[a.severity] > severityRank.Severe)
    return (
        <>
            <div class="st-top">
                <Show when={severe().length}>
                    <Hazards app={props.app} alerts={severe()} onOpen={props.onAlert} onSearch={props.onSearch} />
                </Show>
                <Now app={props.app} compact={severe().length > 0} onSearch={props.onSearch} />
                <div class="st-after">
                    <Show when={risenAvalanche(f())}>{(avalanche) => <AvalancheBands avalanche={avalanche()} />}</Show>
                    <Go app={props.app} />
                    <Advisories alerts={advisories()} onOpen={props.onAlert} />
                </div>
                <HourStack app={props.app} hours={f().hours.slice(0, 24)} name="Next 24 hours" home />
            </div>
            <Sun forecast={f()} />
            <Mountain app={props.app} />
            <Week app={props.app} />
            <Legend app={props.app} />
        </>
    )
}

function Peek(props: {
    app: DesignProps
    edge: "top" | "bottom"
    target?: Screen
    paint?: Paint
    label: string
    value?: string
    srLabel: string
}) {
    return (
        <Show
            when={props.target}
            fallback={
                <div class="st-peek st-peek-end" data-edge={props.edge}>
                    <span class="st-peek-label">{props.label}</span>
                </div>
            }
        >
            {(target) => (
                <a
                    class="st-peek"
                    data-edge={props.edge}
                    style={props.paint ? paintVars(props.paint) : undefined}
                    aria-label={props.srLabel}
                    {...props.app.link(target())}
                >
                    <span class="st-peek-label">{props.label}</span>
                    <Show when={props.value}>
                        <span class="st-peek-value">{props.value}</span>
                    </Show>
                </a>
            )}
        </Show>
    )
}

function snowLineInsight(day: DaySummary) {
    if (!day.phase) {
        return undefined
    }
    const { phase, snowLevelFeet, elevationFeet } = day.phase
    const lead =
        phase === "snow"
            ? "All snow at this elevation"
            : phase === "rain"
              ? "Rain at this elevation"
              : "Right at the rain/snow line"
    return {
        lead,
        detail: `Snow level ${snowLevelFeet.toLocaleString()} ft, this spot is ${elevationFeet.toLocaleString()} ft`,
    }
}

function DayView(props: { app: DesignProps; day: DaySummary; index: number; onSearch: () => void }) {
    const f = () => props.app.forecast
    const hours = createMemo(() => f().hours.filter((h) => dateOf(h) === props.day.date))
    const label = () => getDayLabel(props.day, props.index, "long")
    const dateLabel = () => formatLocalDate(props.day.date, { weekday: "short", month: "short", day: "numeric" })
    const conditions = () => props.day.day?.shortForecast ?? props.day.night?.shortForecast ?? ""
    const prev = () => (props.index > 0 ? f().days[props.index - 1] : undefined)
    const next = () => f().days[props.index + 1]
    const insight = () => snowLineInsight(props.day)
    const stripes = () => hours().map((h) => paintTemp(h.temperature, props.app.theme))
    const highPaint = () => paintTemp(props.day.high ?? props.day.low ?? 50, props.app.theme)
    const lowPaint = () => (props.day.low !== undefined ? paintTemp(props.day.low, props.app.theme) : undefined)
    const hasTotal = () => hasSnow(props.day)

    return (
        <>
            <Masthead app={props.app} onSearch={props.onSearch} />
            <Show
                when={prev()}
                fallback={
                    <Peek
                        app={props.app}
                        edge="top"
                        target={{ name: "home" }}
                        paint={paintTemp(f().current.temperature, props.app.theme)}
                        label="Right meow"
                        value={numeral(f().current.temperature)}
                        srLabel="Back to right meow"
                    />
                }
            >
                {(day) => (
                    <Peek
                        app={props.app}
                        edge="top"
                        target={{ name: "day", date: day().date }}
                        paint={paintTemp(day().high ?? day().low ?? 50, props.app.theme)}
                        label={getDayLabel(day(), props.index - 1, "long")}
                        value={numeral(day().high)}
                        srLabel={`Previous day, ${getDayLabel(day(), props.index - 1, "long")}`}
                    />
                )}
            </Show>
            <section class="st-poster" aria-label="Day summary">
                <div class="st-poster-bands" role="img" aria-label={stripLabel(hours())}>
                    <For each={stripes()}>
                        {(paint, i) => <i class="st-lay" style={{ background: paint.bg, "--i": i() }} />}
                    </For>
                </div>
                <div class="st-poster-facts">
                    <h1 class="st-poster-name st-lay" style={{ "--i": 4 }}>
                        <span style={fit(label())}>{label()}</span>
                    </h1>
                    <p class="st-poster-where st-lay" style={{ "--i": 6 }}>
                        {dateLabel()}. {f().place.city}.
                    </p>
                    <p class="st-poster-high st-lay" style={{ ...paintVars(highPaint()), "--i": 8 }}>
                        <span style={fit(numeral(props.day.high))}>{numeral(props.day.high)}</span>
                    </p>
                    <p class="st-poster-low st-lay" style={{ ...(lowPaint() ? paintVars(lowPaint()!) : {}), "--i": 9 }}>
                        <span style={fit(numeral(props.day.low))}>{numeral(props.day.low)}</span>
                    </p>
                    <p class="st-poster-cond st-lay" style={{ "--i": 10 }} data-size={conditionSize(conditions())}>
                        {sentence(conditions())}
                    </p>
                    <Show when={props.day.condies}>
                        {(condies) => (
                            <div class="st-poster-score st-lay" style={{ ...paintVars(highPaint()), "--i": 11 }}>
                                <Tile score={condies().score} size="l" />
                                <p class="st-poster-window">
                                    Best window <strong>{condies().bestWindow}</strong>
                                </p>
                            </div>
                        )}
                    </Show>
                    <Show when={props.day.highlight}>
                        <div class="st-poster-stamp st-lay" style={{ "--i": 8 }}>
                            <Marker highlight={props.day.highlight} />
                        </div>
                    </Show>
                </div>
            </section>

            <section class="st-facts" aria-label="Details">
                <div class="st-fact st-lay" style={{ "--i": 1 }}>
                    <span class="st-fact-label">{sentence(props.day.precipType)} chance</span>
                    <span class="st-fact-value">{props.day.precipChance}%</span>
                </div>
                <div class="st-fact st-lay" style={{ "--i": 2 }}>
                    <span class="st-fact-label">Wind</span>
                    <span class="st-fact-value">{formatWindRange(props.day)}</span>
                </div>
                <Show when={props.day.gust !== undefined}>
                    <div class="st-fact st-lay" style={{ "--i": 3 }}>
                        <span class="st-fact-label">Gusts</span>
                        <span class="st-fact-value">{props.day.gust} mph</span>
                    </div>
                </Show>
                <Show when={hasTotal()}>
                    <div class="st-fact st-lay" style={{ "--i": 4 }}>
                        <span class="st-fact-label">Snow total</span>
                        <span class="st-fact-value">{formatSnow(props.day.snow ?? 0)}</span>
                    </div>
                </Show>
                <Show when={insight()}>
                    {(line) => (
                        <div class="st-insight st-lay" style={{ "--i": 5 }}>
                            <p class="st-insight-lead">{line().lead}</p>
                            <p class="st-insight-detail">{line().detail}</p>
                        </div>
                    )}
                </Show>
            </section>

            <Show when={hours().length}>
                <HourStack app={props.app} hours={hours()} name={`Hours for ${label()}`} />
            </Show>

            <section class="st-periods" aria-label="Detailed forecast">
                <For each={props.day.periods}>
                    {(period) => (
                        <article class="st-period" style={paintVars(paintTemp(period.temperature, props.app.theme))}>
                            <div class="st-period-head">
                                <h2 class="st-period-name">{period.name}</h2>
                                <span class="st-period-temp">{numeral(period.temperature)}</span>
                            </div>
                            <p class="st-period-text">{period.detailedForecast}</p>
                        </article>
                    )}
                </For>
            </section>

            <Show
                when={next()}
                fallback={
                    <Peek app={props.app} edge="bottom" label="End of the forecast" srLabel="End of the forecast" />
                }
            >
                {(day) => (
                    <Peek
                        app={props.app}
                        edge="bottom"
                        target={{ name: "day", date: day().date }}
                        paint={paintTemp(day().high ?? day().low ?? 50, props.app.theme)}
                        label={getDayLabel(day(), props.index + 1, "long")}
                        value={numeral(day().high)}
                        srLabel={`Next day, ${getDayLabel(day(), props.index + 1, "long")}`}
                    />
                )}
            </Show>
        </>
    )
}

function DayScreen(props: { app: DesignProps; onSearch: () => void }) {
    const days = () => props.app.forecast.days
    const index = createMemo(() => {
        const screen = props.app.screen
        if (screen.name !== "day") {
            return 0
        }
        const found = days().findIndex((d) => d.date === screen.date)
        return found < 0 ? 0 : found
    })
    // A list of one, so that moving to another day lays the whole screen down again.
    return (
        <For each={[days()[index()]]}>
            {(day) => <DayView app={props.app} day={day} index={index()} onSearch={props.onSearch} />}
        </For>
    )
}

function SpotsScreen(props: { app: DesignProps; onSearch: () => void }) {
    const [date, setDate] = createSignal<string>()
    const ranked = createMemo(() => rankSpots(props.app.spots, date()))
    const filterDays = () => props.app.spots[0]?.days ?? []

    return (
        <>
            <Masthead app={props.app} onSearch={props.onSearch} />
            <h1 class="st-spots-title" style={fit("My Spots")}>
                My Spots
            </h1>
            <Show
                when={props.app.spots.length}
                fallback={<p class="st-empty">Tap the star on any forecast to add it here.</p>}
            >
                <div class="st-filters" role="group" aria-label="Filter by day">
                    <button
                        type="button"
                        class="st-tab"
                        aria-pressed={date() === undefined ? "true" : "false"}
                        onClick={() => setDate(undefined)}
                    >
                        This week
                    </button>
                    <For each={filterDays()}>
                        {(day, i) => (
                            <button
                                type="button"
                                class="st-tab"
                                aria-pressed={date() === day.date ? "true" : "false"}
                                onClick={() => setDate(day.date)}
                            >
                                {getDayLabel(day, i(), "short")}
                            </button>
                        )}
                    </For>
                </div>
                <ol class="st-spots">
                    <For each={ranked()}>
                        {(spot, i) => {
                            const paint = () => paintTemp(spot.day?.high ?? spot.day?.low ?? 50, props.app.theme)
                            const score = () => spot.day?.condies?.score
                            const dayIndex = () => (spot.day ? spot.days.indexOf(spot.day) : -1)
                            const texture = () => {
                                const period = spot.day?.day ?? spot.day?.night
                                return period ? textureFor(period.shortForecast, (spot.day?.snow ?? 0) / 8) : undefined
                            }
                            return (
                                <li>
                                    <a
                                        class="st-spot st-lay"
                                        style={{
                                            ...paintVars(paint()),
                                            "--i": i(),
                                            "--h": `${Math.round((score() ?? 0) * 2.6)}px`,
                                        }}
                                        {...props.app.link({ name: "home" })}
                                    >
                                        <span class="st-spot-tile">
                                            <Tile score={score()} />
                                        </span>
                                        <span class="st-spot-name" style={fit(spot.name)}>
                                            {spot.name}
                                        </span>
                                        <span class="st-spot-sky">
                                            <Tex texture={texture()} paint={paint()} />
                                        </span>
                                        <Show when={spot.day}>
                                            <span class="st-spot-detail">
                                                {getDayLabel(spot.day!, dayIndex(), "long")}
                                                <Show when={spot.day!.condies}>, {spot.day!.condies!.bestWindow}</Show>
                                                <Show when={hasSnow(spot.day!)}>
                                                    . {formatSnow(spot.day!.snow ?? 0)} snow
                                                </Show>
                                                .
                                            </span>
                                        </Show>
                                    </a>
                                </li>
                            )
                        }}
                    </For>
                </ol>
            </Show>
        </>
    )
}

function Sheet(props: ParentProps<{ label: string; onClose: () => void; tone?: "black" }>) {
    let dialog!: HTMLDialogElement
    const [more, setMore] = createSignal(false)
    const measure = () => setMore(dialog.scrollHeight - dialog.scrollTop - dialog.clientHeight > 12)
    const open = (el: HTMLDialogElement) => {
        dialog = el
        queueMicrotask(() => {
            if (el.isConnected) {
                el.showModal()
                requestAnimationFrame(measure)
            }
        })
    }
    const scrollOn = () =>
        dialog.scrollBy({ top: dialog.clientHeight * 0.75, behavior: reducedMotion() ? "auto" : "smooth" })
    return (
        <dialog
            ref={open}
            class="st-sheet"
            data-tone={props.tone}
            aria-label={props.label}
            onClose={props.onClose}
            onScroll={measure}
        >
            <div class="st-sheet-bar">
                <button type="button" class="st-sheet-close" onClick={() => dialog.close()}>
                    Close
                </button>
            </div>
            {props.children}
            <Show when={more()}>
                <button type="button" class="st-sheet-more" onClick={scrollOn}>
                    Continues below
                </button>
            </Show>
        </dialog>
    )
}

function AlertSheet(props: { alert: LabAlert; onClose: () => void }) {
    return (
        <Sheet label={props.alert.event} tone="black" onClose={props.onClose}>
            <div class="st-sheet-body">
                <p class="st-sheet-sev">{props.alert.severity}</p>
                <h2 class="st-sheet-title" style={fit(props.alert.event)}>
                    {props.alert.event}
                </h2>
                <p class="st-sheet-headline">{props.alert.headline}</p>
                <dl class="st-sheet-parts">
                    <For each={props.alert.parts}>
                        {(part) => (
                            <div class="st-sheet-part">
                                <Show when={part.label}>
                                    <dt>{part.label}</dt>
                                </Show>
                                <dd>{part.text}</dd>
                            </div>
                        )}
                    </For>
                </dl>
                <Show when={props.alert.instruction}>
                    <p class="st-sheet-instruction">{props.alert.instruction}</p>
                </Show>
            </div>
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
                class="st-search"
                onSubmit={(e) => {
                    e.preventDefault()
                    props.onClose()
                }}
            >
                <label class="st-search-label" for="st-search-input">
                    Where to?
                </label>
                <input
                    autofocus
                    id="st-search-input"
                    class="st-search-input"
                    type="search"
                    placeholder="Type a town or mountain"
                    autocomplete="off"
                    value={query()}
                    onInput={(e) => setQuery(e.currentTarget.value)}
                />
            </form>
            <ul class="st-results">
                <For each={results()} fallback={<li class="st-result-empty">No places found.</li>}>
                    {(sample) => {
                        const [name, ...rest] = sample.split(", ")
                        return (
                            <li>
                                <button type="button" class="st-result" onClick={props.onClose}>
                                    <span class="st-result-name">{name}</span>
                                    <span class="st-result-rest">{rest.join(", ")}</span>
                                </button>
                            </li>
                        )
                    }}
                </For>
            </ul>
        </Sheet>
    )
}

function Ready(props: { app: DesignProps }) {
    const [searching, setSearching] = createSignal(props.app.open === "search")
    const [alert, setAlert] = createSignal<LabAlert | undefined>(
        props.app.open === "alert" ? props.app.forecast.alerts[0] : undefined,
    )
    const onSearch = () => setSearching(true)

    return (
        <>
            <Show when={props.app.offline}>
                <p class="st-offline" role="status">
                    You’re offline. This is the last forecast you loaded.
                </p>
            </Show>
            <Switch>
                <Match when={props.app.screen.name === "home"}>
                    <HomeScreen app={props.app} onAlert={setAlert} onSearch={onSearch} />
                </Match>
                <Match when={props.app.screen.name === "day"}>
                    <DayScreen app={props.app} onSearch={onSearch} />
                </Match>
                <Match when={props.app.screen.name === "spots"}>
                    <SpotsScreen app={props.app} onSearch={onSearch} />
                </Match>
            </Switch>
            <Show when={alert()}>{(a) => <AlertSheet alert={a()} onClose={() => setAlert(undefined)} />}</Show>
            <Show when={searching()}>
                <SearchSheet samples={props.app.searchSamples} onClose={() => setSearching(false)} />
            </Show>
        </>
    )
}

function LoadingState() {
    return (
        <div class="st-loading" role="status" aria-label="Loading the forecast">
            <div class="st-loading-bands" aria-hidden="true">
                <For each={temperatureRamp}>{(step, i) => <i style={{ background: step.light, "--i": i() }} />}</For>
            </div>
            <p class="st-loading-text">Laying down the forecast.</p>
        </div>
    )
}

function ErrorState(props: { app: DesignProps }) {
    return (
        <div class="st-error" role="alert">
            <p class="st-error-text">Couldn’t load this page.</p>
            <div class="st-error-actions">
                <button type="button" onClick={() => location.reload()}>
                    Try again
                </button>
                <a {...props.app.link({ name: "home" })}>Go home</a>
            </div>
        </div>
    )
}

export default function Strata(props: DesignProps) {
    return (
        <div class="st-root" data-theme={props.theme}>
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
