import "@fontsource-variable/overpass/wght.css"
import "@fontsource-variable/overpass/wght-italic.css"
import "@fontsource/b612-mono/latin-400.css"
import "@fontsource/b612-mono/latin-700.css"
import "./relief.css"

import { createMemo, createSignal, For, Match, onSettled, Show, Switch } from "solid-js"
import type { JSX } from "@solidjs/web"

import type { AvalancheStatus } from "../../lib/avalanche.ts"
import { type DaySummary, formatSnow, formatTemp, formatWindRange, getDayLabel, hasSnow } from "../../lib/daily.ts"
import { formatAge, formatLocalDate } from "../../lib/util.ts"
import { type DesignProps, type LabAlert, type LabForecast, rankSpots } from "../data.ts"
import {
    BackIcon,
    Benchmark,
    CatMark,
    CloseIcon,
    ForwardIcon,
    LeaveIcon,
    MapIcon,
    Num,
    RefreshIcon,
    SearchIcon,
    SkyOrWx,
    SpotsIcon,
    StarIcon,
    StationPlot,
    SunriseMark,
    ThemeIcon,
    WarningMark,
    WxMark,
} from "./glyphs.tsx"
import Profile from "./Profile.tsx"
import { buildSheet, FREEZING, type Sheet, tint } from "./terrain.ts"
import Surveying from "./Surveying.tsx"
import IndexMap from "./IndexMap.tsx"
import TerrainMap, { conditionsOf } from "./TerrainMap.tsx"
import { useWidth } from "./useWidth.ts"
import { bearingOf, isWater, skyPercent, toKnots, wxKind } from "./wx.ts"

const dangerInk: Record<number, { background: string; color: string }> = {
    1: { background: "#50b848", color: "#000" },
    2: { background: "#fff200", color: "#000" },
    3: { background: "#f7941e", color: "#000" },
    4: { background: "#ed1c24", color: "#000" },
    5: { background: "#231f20", color: "#fff" },
}

const tierOf = (severity: LabAlert["severity"]) =>
    severity === "Extreme"
        ? "extreme"
        : severity === "Severe"
          ? "severe"
          : severity === "Moderate"
            ? "moderate"
            : "minor"

const isFilled = (severity: LabAlert["severity"]) => severity === "Extreme" || severity === "Severe"

const severityRank = (severity: LabAlert["severity"]) =>
    ["Extreme", "Severe", "Moderate", "Minor", "Unknown"].indexOf(severity)

function dms(value: string, positive: string, negative: string) {
    const number = Number(value)
    const absolute = Math.abs(number)
    const degrees = Math.floor(absolute)
    const minutes = Math.round((absolute - degrees) * 60)
    return `${degrees}°${String(minutes).padStart(2, "0")}′${number >= 0 ? positive : negative}`
}

function Water(props: { text: string; class?: string }) {
    return <span class={`${props.class ?? ""} ${isWater(props.text) ? "rl-water" : ""}`}>{props.text}</span>
}

function Modal(props: { title: string; onClose: () => void; class?: string; children: JSX.Element }) {
    let dialog!: HTMLDialogElement
    onSettled(() => {
        dialog.showModal()
    })
    return (
        <dialog
            ref={dialog}
            class={`rl-modal ${props.class ?? ""}`}
            aria-label={props.title}
            onClose={props.onClose}
            onClick={(e) => e.target === dialog && dialog.close()}
        >
            <div class="rl-modal-body" tabindex="-1" autofocus>
                <button
                    type="button"
                    class="rl-icon-btn rl-modal-close"
                    aria-label="Close"
                    onClick={() => dialog.close()}
                >
                    <CloseIcon />
                </button>
                {props.children}
            </div>
        </dialog>
    )
}

function SheetCollar(props: DesignProps & { onSearch: () => void }) {
    return (
        <header class="rl-collar">
            <a class="rl-mark" {...props.link({ name: "home" })} aria-label="Condies, this forecast">
                <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
                    <path
                        d="M12 3L22 21H2z"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2.2"
                        stroke-linejoin="round"
                    />
                    <circle cx="12" cy="15" r="2.4" fill="currentColor" />
                </svg>
                <span>Condies</span>
            </a>
            <nav class="rl-tools" aria-label="Sheet tools">
                <a class="rl-icon-btn" {...props.link({ name: "spots" })} aria-label="My Spots">
                    <SpotsIcon />
                </a>
                <button type="button" class="rl-icon-btn" aria-label="Open the map">
                    <MapIcon />
                </button>
                <button type="button" class="rl-icon-btn" aria-label="Search for a place" onClick={props.onSearch}>
                    <SearchIcon />
                </button>
                <button
                    type="button"
                    class="rl-icon-btn"
                    aria-label={props.theme === "dark" ? "Switch to the day sheet" : "Switch to the night sheet"}
                    onClick={() => props.setTheme(props.theme === "dark" ? "light" : "dark")}
                >
                    <ThemeIcon />
                </button>
            </nav>
        </header>
    )
}

function TitleBlock(props: { forecast: LabForecast; age: string; onRefresh: () => void }) {
    const [saved, setSaved] = createSignal(false)
    const place = () => props.forecast.place
    return (
        <section class="rl-title" aria-label="Place">
            <div class="rl-title-row">
                <h1 class={`rl-place ${place().city.length > 12 ? "rl-place-long" : ""}`}>
                    {place().city}
                    <Show when={place().state}>, {place().state}</Show>
                </h1>
                <button
                    type="button"
                    class="rl-icon-btn rl-star"
                    aria-label="Save to My Spots"
                    aria-pressed={saved() ? "true" : "false"}
                    onClick={() => setSaved(!saved())}
                >
                    <StarIcon filled={saved()} />
                </button>
            </div>
            <div class="rl-title-meta">
                <Show when={place().elevationFeet !== undefined}>
                    <span class="rl-elevation">
                        <Num text={place().elevationFeet!.toLocaleString("en-US")} /> ft
                    </span>
                </Show>
                <button type="button" class="rl-surveyed" onClick={props.onRefresh}>
                    <RefreshIcon />
                    <span>Surveyed {props.age}</span>
                </button>
            </div>
        </section>
    )
}

function Alerts(props: { alerts: LabAlert[]; onOpen: (alert: LabAlert) => void }) {
    const sorted = () => [...props.alerts].sort((a, b) => severityRank(a.severity) - severityRank(b.severity))
    return (
        <Show when={props.alerts.length}>
            <ul class="rl-alerts" aria-label="Weather alerts">
                <For each={sorted()}>
                    {(alert) => (
                        <li>
                            <button
                                type="button"
                                class={`rl-hazard rl-hazard-${tierOf(alert.severity)}`}
                                onClick={() => props.onOpen(alert)}
                            >
                                <span class="rl-hazard-tier">
                                    <WarningMark filled={isFilled(alert.severity)} size={16} />
                                    {alert.severity}
                                </span>
                                <span class="rl-hazard-event">{alert.event}</span>
                                <ForwardIcon />
                            </button>
                        </li>
                    )}
                </For>
            </ul>
        </Show>
    )
}

function AlertDetail(props: { alert: LabAlert; onClose: () => void }) {
    return (
        <Modal
            title={props.alert.event}
            onClose={props.onClose}
            class={`rl-overprint rl-overprint-${tierOf(props.alert.severity)}`}
        >
            <div class="rl-overprint-head">
                <p class="rl-overprint-tier">
                    <WarningMark filled={isFilled(props.alert.severity)} size={18} /> {props.alert.severity}
                </p>
                <h2 class="rl-overprint-event">{props.alert.event}</h2>
            </div>
            <p class="rl-overprint-headline">{props.alert.headline}</p>
            <dl class="rl-overprint-parts">
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
                <p class="rl-overprint-instruction">{props.alert.instruction}</p>
            </Show>
        </Modal>
    )
}

function SearchSheet(props: { samples: string[]; onClose: () => void }) {
    const [query, setQuery] = createSignal("")
    const results = () => props.samples.filter((s) => s.toLowerCase().includes(query().trim().toLowerCase()))
    return (
        <Modal title="Search for a place" onClose={props.onClose} class="rl-search">
            <h2 class="rl-section-title">Find a sheet</h2>
            <label class="rl-search-field">
                <span class="rl-vh">Place name</span>
                <SearchIcon />
                <input
                    type="search"
                    placeholder="Town, peak or resort"
                    value={query()}
                    onInput={(e) => setQuery(e.currentTarget.value)}
                    autofocus
                />
            </label>
            <ul class="rl-search-results">
                <For each={results()} fallback={<li class="rl-search-none">No sheet by that name.</li>}>
                    {(result) => {
                        const [name, ...rest] = result.split(", ")
                        return (
                            <li>
                                <button type="button" onClick={props.onClose}>
                                    <span class="rl-place-name">{name}</span>
                                    <span class="rl-search-rest">{rest.join(", ")}</span>
                                </button>
                            </li>
                        )
                    }}
                </For>
            </ul>
        </Modal>
    )
}

function NowBlock(props: { forecast: LabForecast }) {
    const current = () => props.forecast.current
    const wind = () => current().windSpeed.value ?? current().windSpeed.maxValue ?? 0
    const gust = () => current().windGust?.value ?? 0
    const feels = () => Math.round(current().feelsLike ?? current().temperature)
    const kind = () => wxKind(current().shortForecast)
    return (
        <section class="rl-nowblock" aria-label="Current conditions">
            <p class="rl-meow">
                <CatMark />
                Right meow
            </p>
            <div class="rl-reading">
                <p class="rl-temp">{current().temperature}°</p>
                <StationPlot
                    percent={skyPercent(current(), props.forecast.grid)}
                    kind={kind()}
                    bearing={bearingOf(current().windDirection)}
                    knots={toKnots(wind())}
                    calm={!wind()}
                    size={108}
                />
            </div>
            <Water class="rl-sky" text={current().shortForecast} />
            <dl class="rl-facts">
                <Show when={Math.abs(feels() - current().temperature) >= 3}>
                    <div>
                        <dt>Feels like</dt>
                        <dd>{feels()}°</dd>
                    </div>
                </Show>
                <div>
                    <dt>Wind</dt>
                    <dd>{wind() ? `${current().windDirection} ${wind()} mph` : "Calm"}</dd>
                </div>
                <Show when={gust() > wind()}>
                    <div>
                        <dt>Gusts</dt>
                        <dd>{gust()} mph</dd>
                    </div>
                </Show>
            </dl>
        </section>
    )
}

function WeekNotes(props: DesignProps) {
    const f = () => props.forecast
    return (
        <section class="rl-notes" aria-label="The week ahead">
            <h2 class="rl-section-title">The week, surveyed</h2>
            <div class="rl-notes-body">
                <Show when={f().weekSnow >= 1 || f().storm}>
                    <div class="rl-notes-text">
                        <Show when={f().weekSnow >= 1}>
                            <p class="rl-note">
                                <WxMark kind="snow" size={17} />
                                <span class="rl-water">
                                    <b>
                                        <Num text={formatSnow(f().weekSnow)} />
                                    </b>{" "}
                                    this week
                                </span>
                            </p>
                        </Show>
                        <Show when={f().storm}>
                            <p class="rl-note rl-water">{f().storm!.text.replace(/\s·\s(?=\d)/, ", ")}</p>
                        </Show>
                    </div>
                </Show>
                <Show when={f().best}>
                    {(best) => (
                        <a class="rl-best-link" {...props.link({ name: "day", date: best().day.date })}>
                            <Benchmark score={best().day.condies!.score} size={42} />
                            <span>
                                Best day: <b>{getDayLabel(best().day, best().index, "long")}</b>
                                <Num class="rl-best-window" text={best().day.condies!.bestWindow} />
                            </span>
                            <ForwardIcon />
                        </a>
                    )}
                </Show>
            </div>
        </section>
    )
}

function Legend(props: { sheet: Sheet; theme: DesignProps["theme"] }) {
    let holder!: HTMLDivElement
    const width = useWidth(() => holder)
    const [open, setOpen] = createSignal(false)
    const domain = [-10, 110]
    const bands = Array.from({ length: 24 }, (_, i) => -10 + i * 5)
    const position = (value: number) =>
        `${((Math.max(domain[0], Math.min(domain[1], value)) - domain[0]) / (domain[1] - domain[0])) * 100}%`
    const hourW = () => (width() - (width() >= 720 ? 112 : width() >= 340 ? 68 : 60) - 12) / 24

    return (
        <section class={`rl-legend ${open() ? "rl-legend-open" : ""}`} aria-label="Key to the sheet" ref={holder}>
            <h2 class="rl-legend-title">Key to the sheet</h2>
            <div class="rl-legend-bar">
                <div class="rl-ramp-wrap" aria-hidden="true">
                    <div
                        class={`rl-ramp-span ${props.sheet.min > 50 ? "rl-ramp-span-end" : ""}`}
                        style={{
                            left: position(props.sheet.min),
                            width: `calc(${position(props.sheet.max)} - ${position(props.sheet.min)})`,
                        }}
                    >
                        <span>
                            This week {props.sheet.min}°–{props.sheet.max}°
                        </span>
                    </div>
                    <div class="rl-ramp">
                        <For each={bands}>
                            {(value) => <span style={{ background: tint(value + 2.5, props.theme) }} />}
                        </For>
                    </div>
                    <div class="rl-ramp-freezing" style={{ left: position(FREEZING) }}>
                        <span>
                            32°<span class="rl-freezing-word"> freezing</span>
                        </span>
                    </div>
                    <div class="rl-ramp-ticks">
                        <For each={[0, 60, 90]}>
                            {(value) => (
                                <span class={value === 60 ? "rl-ramp-tick-mid" : ""} style={{ left: position(value) }}>
                                    {value}°
                                </span>
                            )}
                        </For>
                    </div>
                </div>
                <button
                    type="button"
                    class="rl-legend-toggle"
                    aria-label="Key to the sheet"
                    aria-expanded={open() ? "true" : "false"}
                    aria-controls="rl-key-more"
                    onClick={() => setOpen(!open())}
                >
                    Key
                    <ForwardIcon />
                </button>
            </div>
            <p class="rl-vh">
                Tint runs from glacial blue at the coldest through green to ember red at the hottest. This week runs{" "}
                {props.sheet.min}° to {props.sheet.max}°.
            </p>

            <div class="rl-key-more" id="rl-key-more">
                <ul class="rl-key-list">
                    <li>
                        <svg width="14" height="14" viewBox="-7 -7 14 14" aria-hidden="true">
                            <path class="rl-key-high" d="M0-6L6 4H-6z" />
                        </svg>
                        Hottest hour
                    </li>
                    <li>
                        <svg width="14" height="14" viewBox="-7 -7 14 14" aria-hidden="true">
                            <path class="rl-key-low" d="M0 6L6-4H-6z" />
                        </svg>
                        Coldest hour
                    </li>
                    <li class="rl-water">
                        <WxMark kind="snow" size={16} />
                        Snow
                    </li>
                    <li class="rl-water">
                        <WxMark kind="rain" size={16} />
                        Rain
                    </li>
                    <li class="rl-water">
                        <WxMark kind="fog" size={16} />
                        Fog
                    </li>
                    <li class="rl-water">
                        <WxMark kind="thunder" size={16} />
                        Thunder
                    </li>
                    <li>
                        <svg width="20" height="12" viewBox="0 0 20 12" aria-hidden="true">
                            <path class="rl-best" d="M1 1V10H19V1" />
                        </svg>
                        Best window
                    </li>
                    <li>
                        <Benchmark score={72} size={24} />
                        Condies score, inked solid when it's worth going
                    </li>
                </ul>

                <div class="rl-scale" aria-hidden="true">
                    <svg width={Math.max(0, hourW() * 12 + 2)} height="14">
                        <For each={[0, 1, 2, 3]}>
                            {(i) => (
                                <rect
                                    x={1 + i * hourW() * 3}
                                    y="2"
                                    width={hourW() * 3}
                                    height="7"
                                    class={i % 2 ? "rl-scale-b" : "rl-scale-a"}
                                />
                            )}
                        </For>
                    </svg>
                    <span class="rl-num">12 hours</span>
                </div>
                <p class="rl-legend-note">
                    Contour interval {props.sheet.interval}°F. The heavy line is 32°F, the freezing level. Relief is lit
                    from the northwest, after Tanaka. Rows run down by day and hours run across, after Hovmöller.
                    Hatched ground has no forecast. The station plot by the temperature fills its circle with cloud, and
                    its barb points into the wind.
                </p>
            </div>
        </section>
    )
}

function Almanac(props: { sun: NonNullable<LabForecast["sun"]> }) {
    return (
        <section class="rl-almanac" aria-label="Sunrise and sunset">
            <p>
                <SunriseMark />
                <span>Sunrise</span>
                <b>
                    <Num text={props.sun.sunrise} />
                </b>
            </p>
            <p>
                <SunriseMark set />
                <span>Sunset</span>
                <b>
                    <Num text={props.sun.sunset} />
                </b>
            </p>
        </section>
    )
}

function Avalanche(props: { status: AvalancheStatus; raised?: boolean }) {
    return (
        <div class={`rl-avy ${props.raised ? "rl-avy-raised" : ""}`}>
            <Show
                when={props.status.rating}
                fallback={
                    <div class="rl-avy-none">
                        <p class="rl-avy-head">No current avalanche rating</p>
                        <p>That doesn't mean it's safe.</p>
                        <a class="rl-link" href={props.status.link} target="_blank" rel="noreferrer">
                            {props.status.center} <LeaveIcon />
                        </a>
                    </div>
                }
            >
                {(rating) => (
                    <>
                        <div class="rl-avy-plate" style={dangerInk[rating().level]}>
                            <span class="rl-avy-level">{rating().level}</span>
                            <span class="rl-avy-name">{rating().name}</span>
                            <span class="rl-avy-plate-label">Avalanche danger</span>
                        </div>
                        <div class="rl-avy-scale" aria-hidden="true">
                            <For each={[1, 2, 3, 4, 5]}>
                                {(level) => (
                                    <span
                                        class={level === rating().level ? "rl-avy-step-on" : ""}
                                        style={{ background: dangerInk[level].background }}
                                    />
                                )}
                            </For>
                        </div>
                        <p class="rl-avy-head">Avalanche danger: {rating().name}</p>
                        <Show when={rating().warning}>
                            <p class="rl-avy-warning">
                                <WarningMark filled size={16} /> Avalanche {rating().warning} in effect
                            </p>
                        </Show>
                        <p>{rating().advice}</p>
                        <p>Varies by slope and elevation.</p>
                        <a class="rl-link" href={props.status.link} target="_blank" rel="noreferrer">
                            {props.status.center} <LeaveIcon />
                        </a>
                    </>
                )}
            </Show>
        </div>
    )
}

function Mountain(props: { forecast: LabForecast; avalanche: boolean }) {
    const avalanche = () => (props.avalanche ? props.forecast.avalanche : undefined)
    const depth = () => props.forecast.snowDepth
    return (
        <Show when={avalanche() || depth()}>
            <section class="rl-mountain" aria-label="Mountain conditions">
                <h2 class="rl-section-title">On the mountain</h2>
                <Show when={avalanche()}>{(a) => <Avalanche status={a()} />}</Show>
                <Show when={depth()}>
                    {(d) => (
                        <div class="rl-depth">
                            <p class="rl-depth-value">
                                <b class="rl-num">{d().depth}″</b>
                                <span class="rl-water">on the ground</span>
                            </p>
                            <Show when={d().change}>
                                <p class="rl-num rl-depth-change">
                                    {d().change > 0 ? "+" : ""}
                                    {d().change}″ in 24 hours
                                </p>
                            </Show>
                            <p class="rl-depth-source">
                                <span class="rl-place-small">{d().station.name}</span>
                                <span>
                                    <Num text={d().station.miles.toFixed(1)} /> mi away
                                </span>
                                <span>
                                    <Num text={d().station.elevation.toLocaleString("en-US")} /> ft
                                </span>
                                <span>measured {formatAge(props.forecast.now - d().measuredAt)}</span>
                            </p>
                        </div>
                    )}
                </Show>
            </section>
        </Show>
    )
}

function Credit(props: { forecast: LabForecast }) {
    return (
        <footer class="rl-credit">
            <p>Forecast from the National Weather Service. Avalanche ratings from the regional centers.</p>
            <p class="rl-num">
                {dms(props.forecast.place.lat, "N", "S")} {dms(props.forecast.place.lon, "E", "W")}
            </p>
        </footer>
    )
}

function Home(props: DesignProps & { onAlert: (alert: LabAlert) => void }) {
    const f = () => props.forecast
    const sheet = createMemo(() => buildSheet(f().days, f().hours))
    const [refreshed, setRefreshed] = createSignal(false)
    const [survey, setSurvey] = createSignal(0)
    const age = () => (refreshed() ? "just now" : formatAge(f().now - Date.parse(f().updatedAt)))
    let holder!: HTMLElement
    const homeWidth = useWidth(() => holder)
    const hourCount = () => (homeWidth() >= 900 ? 24 : 14)
    const raised = () => (f().avalanche?.rating?.level ?? 0) >= 3
    const hasMountain = () => (f().avalanche && !raised()) || f().snowDepth

    return (
        <main class={`rl-home ${hasMountain() ? "" : "rl-home-calm"}`} ref={holder}>
            <div class="rl-side">
                <TitleBlock
                    forecast={f()}
                    age={age()}
                    onRefresh={() => {
                        setRefreshed(true)
                        setSurvey(survey() + 1)
                    }}
                />
                <Alerts alerts={f().alerts} onOpen={props.onAlert} />
                <Show when={raised() && f().avalanche}>
                    {(a) => (
                        <section class="rl-avy-section" aria-label="Avalanche danger">
                            <Avalanche status={a()} raised />
                        </section>
                    )}
                </Show>
                <NowBlock forecast={f()} />
                <WeekNotes {...props} />
            </div>
            <div class="rl-main">
                <TerrainMap forecast={f()} theme={props.theme} link={props.link} resurvey={survey()} sheet={sheet()} />
            </div>
            <Legend sheet={sheet()} theme={props.theme} />
            <section class="rl-hourly" aria-label="Hourly forecast">
                <h2 class="rl-section-title">Next {hourCount()} hours</h2>
                <Profile
                    hours={f().hours.slice(0, hourCount())}
                    theme={props.theme}
                    height={236}
                    showNow
                    caption={`Next ${hourCount()} hours`}
                />
                <Show when={f().sun}>{(sun) => <Almanac sun={sun()} />}</Show>
            </section>
            <Mountain forecast={f()} avalanche={!raised()} />
            <Credit forecast={f()} />
        </main>
    )
}

// Only the forecast phrase is set as water. The wind and temperature sentences after it are not.
function sentences(text: string) {
    const end = text.indexOf(". ")
    return end < 0 ? { first: text, rest: "" } : { first: text.slice(0, end + 1), rest: text.slice(end + 1) }
}

function Insight(props: { summary: DaySummary }) {
    const phase = () => props.summary.phase!
    const heading = () =>
        ({ snow: "All snow at this elevation", rain: "Rain at this elevation", mix: "Right at the rain/snow line" })[
            phase().phase
        ]
    return (
        <div class="rl-insight">
            <p class="rl-insight-head rl-water">
                {heading()}
                <Show when={hasSnow(props.summary)}>
                    <b>
                        , <Num text={formatSnow(props.summary.snow!)} />
                    </b>
                </Show>
            </p>
            <p>
                Snow level <Num text={`${phase().snowLevelFeet.toLocaleString("en-US")} ft`} />, this spot is{" "}
                <Num text={`${phase().elevationFeet.toLocaleString("en-US")} ft`} />
            </p>
        </div>
    )
}

function Day(props: DesignProps & { date: string }) {
    const f = () => props.forecast
    const index = createMemo(() => f().days.findIndex((d) => d.date === props.date))
    const summary = () => f().days[index()]
    const hours = createMemo(() => f().hours.filter((p) => p.startTime.slice(0, 10) === props.date))
    const previous = () => f().days[index() - 1]
    const next = () => f().days[index() + 1]
    const conditions = () => conditionsOf(summary())
    const isToday = () => f().hours[0]?.startTime.slice(0, 10) === props.date

    return (
        <main class="rl-day">
            <Show when={summary()} fallback={<p class="rl-empty">There's no forecast for this day.</p>}>
                <nav class="rl-adjoin" aria-label="Adjoining days">
                    <Show when={previous()} fallback={<span />}>
                        <a class="rl-adjoin-link" {...props.link({ name: "day", date: previous()!.date })}>
                            <BackIcon />
                            {getDayLabel(previous()!, index() - 1, "short")}
                        </a>
                    </Show>
                    <a class="rl-adjoin-link rl-adjoin-week" {...props.link({ name: "home" })}>
                        The week
                    </a>
                    <Show when={next()} fallback={<span />}>
                        <a class="rl-adjoin-link rl-adjoin-next" {...props.link({ name: "day", date: next()!.date })}>
                            {getDayLabel(next()!, index() + 1, "short")}
                            <ForwardIcon />
                        </a>
                    </Show>
                </nav>

                <header class="rl-day-head">
                    <h1 class="rl-day-name">{getDayLabel(summary(), index(), "long")}</h1>
                    <p class="rl-day-sub">
                        <span class="rl-num">{formatLocalDate(summary().date, { month: "long", day: "numeric" })}</span>
                        <span class="rl-place-small">{f().place.city}</span>
                    </p>
                </header>

                <Show when={summary().highlight}>
                    {(highlight) => (
                        <p class={`rl-stamp ${highlight() === "pow" ? "rl-stamp-pow" : ""}`}>
                            {highlight() === "pow" ? "POW DAY!" : "PRIMO CONDIES!"}
                        </p>
                    )}
                </Show>

                <div class="rl-day-grid">
                    <div class="rl-day-readings">
                        <div class="rl-hilo">
                            <Show when={summary().high !== undefined}>
                                <p>
                                    <span class="rl-hilo-label">
                                        <svg width="16" height="16" viewBox="-7 -7 14 14" aria-hidden="true">
                                            <path class="rl-key-high" d="M0-6L6 4H-6z" />
                                        </svg>
                                        High
                                    </span>
                                    <b>{formatTemp(summary().high)}</b>
                                </p>
                            </Show>
                            <Show when={summary().low !== undefined}>
                                <p>
                                    <span class="rl-hilo-label">
                                        <svg width="16" height="16" viewBox="-7 -7 14 14" aria-hidden="true">
                                            <path class="rl-key-low" d="M0 6L6-4H-6z" />
                                        </svg>
                                        Low overnight
                                    </span>
                                    <b>{formatTemp(summary().low)}</b>
                                </p>
                            </Show>
                        </div>
                        <p class="rl-day-sky">
                            <span class={isWater(conditions()) ? "rl-water" : ""}>
                                <SkyOrWx
                                    kind={wxKind(conditions())}
                                    percent={summary().day ? skyPercent(summary().day!, f().grid) : 50}
                                    size={26}
                                />
                            </span>
                            <Water text={conditions()} />
                        </p>
                    </div>

                    <Show when={hours().length}>
                        <div class="rl-day-chart">
                            <h2 class="rl-section-title">Hour by hour</h2>
                            <Profile
                                hours={hours()}
                                theme={props.theme}
                                height={262}
                                showNow={isToday()}
                                caption={`${getDayLabel(summary(), index(), "long")}, hour by hour`}
                            />
                        </div>
                    </Show>

                    <div class="rl-day-facts">
                        <dl class="rl-day-stats">
                            <div>
                                <dt>
                                    Chance of <span class="rl-water">{summary().precipType}</span>
                                </dt>
                                <dd>{summary().precipChance}%</dd>
                            </div>
                            <div>
                                <dt>Wind</dt>
                                <dd>{formatWindRange(summary())}</dd>
                            </div>
                            <Show when={summary().gust}>
                                <div>
                                    <dt>Gusts</dt>
                                    <dd>{summary().gust} mph</dd>
                                </div>
                            </Show>
                            <Show when={hasSnow(summary()) && !summary().phase}>
                                <div>
                                    <dt class="rl-water">Snow</dt>
                                    <dd>
                                        <Num text={formatSnow(summary().snow!)} />
                                    </dd>
                                </div>
                            </Show>
                        </dl>

                        <Show when={summary().condies}>
                            {(c) => (
                                <div class="rl-day-score">
                                    <Benchmark score={c().score} size={72} />
                                    <p>
                                        <b>Condies score</b>
                                        <span>
                                            Best window <Num text={c().bestWindow} />
                                        </span>
                                    </p>
                                </div>
                            )}
                        </Show>

                        <Show when={summary().phase}>
                            <Insight summary={summary()} />
                        </Show>
                    </div>

                    <section class="rl-periods" aria-label="Detailed forecast">
                        <h2 class="rl-section-title">Survey notes</h2>
                        <For each={summary().periods}>
                            {(period) => (
                                <article class="rl-period">
                                    <h3>
                                        <span>{period.name}</span>
                                        <b class="rl-num">{period.temperature}°</b>
                                    </h3>
                                    <p>
                                        <Water text={sentences(period.detailedForecast).first} />
                                        {sentences(period.detailedForecast).rest}
                                    </p>
                                </article>
                            )}
                        </For>
                    </section>
                </div>
            </Show>
        </main>
    )
}

function Spots(props: DesignProps) {
    const [date, setDate] = createSignal<string | undefined>(undefined)
    const ranked = createMemo(() => rankSpots(props.spots, date()))
    const days = () => props.forecast.days

    return (
        <main class="rl-spots">
            <h1 class="rl-day-name">My Spots</h1>
            <Show
                when={props.spots.length}
                fallback={
                    <div class="rl-blank" role="status">
                        <p>
                            <StarIcon filled={false} />
                            Tap the star on any forecast to add it here.
                        </p>
                    </div>
                }
            >
                <div class="rl-spots-grid">
                    <div class="rl-spots-list">
                        <div class="rl-filter" role="group" aria-label="Compare by day">
                            <button
                                type="button"
                                class="rl-tab"
                                aria-pressed={date() === undefined ? "true" : "false"}
                                onClick={() => setDate(undefined)}
                            >
                                This week
                            </button>
                            <For each={days()}>
                                {(day, i) => (
                                    <button
                                        type="button"
                                        class="rl-tab"
                                        aria-pressed={date() === day.date ? "true" : "false"}
                                        onClick={() => setDate(day.date)}
                                    >
                                        {getDayLabel(day, i(), "short")}
                                    </button>
                                )}
                            </For>
                        </div>

                        <ol class="rl-gaz">
                            <For each={ranked()}>
                                {(spot, i) => (
                                    <li>
                                        <a class="rl-gaz-row" {...props.link({ name: "home" })}>
                                            <span class="rl-gaz-rank rl-num">{i() + 1}</span>
                                            <Show
                                                when={spot.day?.condies}
                                                fallback={<span class="rl-gaz-noscore">–</span>}
                                            >
                                                {(c) => <Benchmark score={c().score} size={44} />}
                                            </Show>
                                            <span class="rl-gaz-body">
                                                <span class="rl-gaz-name">
                                                    <span class="rl-place-name">{spot.name}</span>
                                                    <span class="rl-gaz-leader" aria-hidden="true" />
                                                    <span class="rl-num rl-gaz-coord">
                                                        <Num
                                                            text={`${Math.abs(spot.lat).toFixed(1)}°${spot.lat >= 0 ? "N" : "S"}`}
                                                        />
                                                    </span>
                                                </span>
                                                <span class="rl-gaz-detail">
                                                    <Show
                                                        when={spot.day}
                                                        fallback={<span>No forecast for this day</span>}
                                                    >
                                                        {(d) => (
                                                            <>
                                                                <span>
                                                                    {formatLocalDate(d().date, { weekday: "short" })}
                                                                    <Show when={d().condies}>
                                                                        {" "}
                                                                        <Num text={d().condies!.bestWindow} />
                                                                    </Show>
                                                                </span>
                                                                <Show when={hasSnow(d())}>
                                                                    <span class="rl-water">
                                                                        <b>
                                                                            <Num text={formatSnow(d().snow!)} />
                                                                        </b>{" "}
                                                                        snow
                                                                    </span>
                                                                </Show>
                                                            </>
                                                        )}
                                                    </Show>
                                                </span>
                                            </span>
                                        </a>
                                    </li>
                                )}
                            </For>
                        </ol>
                    </div>
                    <IndexMap spots={ranked()} />
                </div>
            </Show>
        </main>
    )
}

function ErrorSheet(props: DesignProps) {
    return (
        <main class="rl-state rl-state-error">
            <div class="rl-void" aria-hidden="true" />
            <p class="rl-state-title">Couldn't load this page.</p>
            <div class="rl-state-actions">
                <button type="button" class="rl-action" onClick={() => location.reload()}>
                    Try again
                </button>
                <a class="rl-link" {...props.link({ name: "home" })}>
                    Go home
                </a>
            </div>
        </main>
    )
}

function Ready(props: DesignProps) {
    const [searching, setSearching] = createSignal(props.open === "search")
    const [alert, setAlert] = createSignal<LabAlert | undefined>(
        props.open === "alert" ? props.forecast.alerts[0] : undefined,
    )

    return (
        <>
            <SheetCollar {...props} onSearch={() => setSearching(true)} />
            <Show when={props.offline}>
                <p class="rl-offline">You're offline. This is the last forecast you loaded.</p>
            </Show>
            <Switch>
                <Match when={props.screen.name === "home"}>
                    <Home {...props} onAlert={setAlert} />
                </Match>
                <Match when={props.screen.name === "day" && props.screen}>
                    {(screen) => <Day {...props} date={(screen() as { date: string }).date} />}
                </Match>
                <Match when={props.screen.name === "spots"}>
                    <Spots {...props} />
                </Match>
            </Switch>
            <Show when={searching()}>
                <SearchSheet samples={props.searchSamples} onClose={() => setSearching(false)} />
            </Show>
            <Show when={alert()}>{(a) => <AlertDetail alert={a()} onClose={() => setAlert(undefined)} />}</Show>
        </>
    )
}

export default function Relief(props: DesignProps) {
    return (
        <div class="rl-root">
            <div class="rl-sheet">
                <Switch>
                    <Match when={props.status === "loading"}>
                        <Surveying theme={props.theme} />
                    </Match>
                    <Match when={props.status === "error"}>
                        <ErrorSheet {...props} />
                    </Match>
                    <Match when={props.status === "ready"}>
                        <Ready {...props} />
                    </Match>
                </Switch>
            </div>
        </div>
    )
}
