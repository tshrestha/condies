import "@fontsource-variable/chivo/wght.css"
import "./quiet.css"

import { createMemo, createSignal, flush, For, Match, onSettled, Show, Switch } from "solid-js"
import type { ParentProps } from "solid-js"

import { type DaySummary, formatSnow, formatWindRange, getDayLabel, hasSnow } from "../../lib/daily.ts"
import type { Period } from "../../lib/nws.ts"
import { formatAge } from "../../lib/util.ts"
import { type DesignProps, type LabAlert, type LabForecast, rankSpots } from "../data.ts"

import { avalancheScale, glassPaint, type Paint, paintDay, paintTemp, paintVars, rampSteps, rampWalk } from "./ramp.ts"
import {
    conditionWord,
    dayName,
    degrees,
    feelsLike,
    grade,
    highlightWord,
    isLoud,
    nextHours,
    numeralFit,
    scoreHelp,
    sentence,
    severityRank,
    shortDate,
    snowLine,
    windLine,
    windSpeed,
} from "./words.ts"

type Avalanche = NonNullable<LabForecast["avalanche"]>
type Sheet = { kind: "alert"; alert: LabAlert } | { kind: "avalanche"; avalanche: Avalanche } | { kind: "search" }

interface Ctx {
    app: DesignProps
    open: (sheet: Sheet) => void
}

const dateOf = (p: Period) => p.startTime.slice(0, 10)

function Cat() {
    return (
        <svg class="sq-cat" viewBox="0 0 20 20" aria-hidden="true">
            <path d="M3 1l3 4h5l3-4v8l-1 2 2 6h2v-4h2v6H3l2-8-2-2z" />
        </svg>
    )
}

// The one treatment of the Condies score, the same on Best day, the Day screen and My Spots. It is labeled,
// out of 100, graded in a word and drawn as an ink meter, so it can never be read as a temperature. Tapping it
// explains it. It is one line: label, meter, value.
function Score(props: { score?: number }) {
    const [open, setOpen] = createSignal(false)
    return (
        <Show when={props.score !== undefined}>
            <button
                type="button"
                class="sq-score"
                aria-expanded={open() ? "true" : "false"}
                aria-label={`Condies score ${props.score} out of 100, ${grade(props.score!)}. What this means`}
                onClick={() => setOpen(!open())}
            >
                <span class="sq-score-label">Condies score</span>
                <span class="sq-meter" aria-hidden="true">
                    <i style={{ width: `${props.score}%` }} />
                </span>
                <span class="sq-score-value">
                    <strong>{props.score}</strong>/100 <strong>{grade(props.score!)}</strong>
                </span>
            </button>
            <Show when={open()}>
                <p class="sq-score-help">{scoreHelp}</p>
            </Show>
        </Show>
    )
}

// Icons are only for controls. Weather is always told in words. One drawing style: 24px, 2px strokes, round
// joins, in the ink of whatever they sit on.
function SearchIcon() {
    return (
        <svg class="sq-icon" viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="10.5" cy="10.5" r="6.5" />
            <path d="M15.5 15.5 21 21" />
        </svg>
    )
}

// The same star saves a place in the swatch and stands for My Spots in the dock.
function StarIcon(props: { filled?: boolean }) {
    return (
        <svg class={props.filled ? "sq-icon sq-icon-filled" : "sq-icon"} viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 3l2.35 6.26 6.69.3-5.24 4.18 1.78 6.45L12 16.5l-5.58 3.69 1.78-6.45-5.24-4.18 6.69-.3z" />
        </svg>
    )
}

function MapIcon() {
    return (
        <svg class="sq-icon" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2zM9 4v14M15 6v14" />
        </svg>
    )
}

let horizonCount = 0

// The theme switch is a horizon. In light mode the sun is up. Switching sets the sun and raises a crescent moon,
// with two stars coming out; switching back is a sunrise. It shows the current theme, like a light switch.
function ThemeToggle(props: { app: DesignProps; class?: string }) {
    const id = `sq-horizon-${++horizonCount}`
    const dark = () => props.app.theme === "dark"
    return (
        <button
            type="button"
            class={`sq-theme ${props.class ?? ""}`}
            aria-label="Dark mode"
            aria-pressed={dark() ? "true" : "false"}
            onClick={() => props.app.setTheme(dark() ? "light" : "dark")}
        >
            <svg class={dark() ? "sq-horizon sq-horizon-dark" : "sq-horizon"} viewBox="0 0 28 28" aria-hidden="true">
                <defs>
                    <clipPath id={`${id}-sky`}>
                        <rect width="28" height="19" />
                    </clipPath>
                    <mask id={`${id}-cut`}>
                        <rect width="28" height="28" fill="#fff" />
                        <circle cx="17.5" cy="10.5" r="4.6" fill="#000" />
                    </mask>
                </defs>
                <g clip-path={`url(#${id}-sky)`}>
                    <g class="sq-horizon-sun">
                        <circle cx="14" cy="14.5" r="4.5" />
                        <path d="M14 6.5V8M8.34 8.84l1.06 1.06M19.66 8.84l-1.06 1.06M6 14.5h1.5M20.5 14.5H22" />
                    </g>
                    <g class="sq-horizon-moon">
                        <circle cx="14" cy="12.5" r="5.5" mask={`url(#${id}-cut)`} />
                    </g>
                </g>
                <path class="sq-horizon-line" d="M3.5 20h21" />
                <g class="sq-horizon-stars">
                    <circle cx="6.5" cy="6.5" r="1.1" />
                    <circle cx="22.5" cy="5" r="1" />
                </g>
            </svg>
        </button>
    )
}

// On a wide screen the controls sit in this top bar. On a phone the dock takes them, and this bar is hidden.
function Masthead(props: Ctx) {
    return (
        <header class="sq-ground sq-mast">
            <a class="sq-brand" {...props.app.link({ name: "home" })}>
                Condies
            </a>
            <nav class="sq-nav" aria-label="Main">
                <button type="button" onClick={() => props.open({ kind: "search" })}>
                    Search
                </button>
                <a {...props.app.link({ name: "spots" })}>Spots</a>
                <button type="button" aria-label="Open the map">
                    Map
                </button>
                <ThemeToggle app={props.app} />
            </nav>
        </header>
    )
}

// The phone's controls, within thumb reach. Glass in this app's own material: tinted with the temperature right
// now, milk glass by day and smoked glass by night, so a little of the present follows you to every screen. The
// page shows through, softened. It floats, so it's rounded, unlike the printed, square things on the page.
function Dock(props: Ctx) {
    const paint = () => glassPaint(props.app.forecast.current.temperature, props.app.theme)
    const current = (name: string) => (props.app.screen.name === name ? "page" : undefined)
    return (
        <div class="sq-dock" style={paintVars(paint())}>
            <nav class="sq-dock-nav sq-glass" aria-label="Main">
                <a class="sq-dock-item" aria-current={current("home")} {...props.app.link({ name: "home" })}>
                    <Cat />
                    <span>Now</span>
                </a>
                <button type="button" class="sq-dock-item" onClick={() => props.open({ kind: "search" })}>
                    <SearchIcon />
                    <span>Search</span>
                </button>
                <a class="sq-dock-item" aria-current={current("spots")} {...props.app.link({ name: "spots" })}>
                    <StarIcon filled={props.app.screen.name === "spots"} />
                    <span>Spots</span>
                </a>
                <button type="button" class="sq-dock-item" aria-label="Open the map">
                    <MapIcon />
                    <span>Map</span>
                </button>
            </nav>
            <ThemeToggle app={props.app} class="sq-glass sq-dock-theme" />
        </div>
    )
}

type Tone = "extreme" | "severe" | "avalanche" | "quiet"

// One component for every warning, set like a printed notice rather than a banner: framed plates inside the
// margins. Extreme has the heaviest frame and the largest type, Severe a lighter frame, avalanche danger
// carries its standard color as a chip, and Moderate and Minor are plain rows. All say how serious in words.
// A framed plate reads as a button on its own; a plain row gets an arrow so it does too.
function AlertRow(props: { tone: Tone; title: string; note: string; chip?: Paint; onOpen: () => void }) {
    return (
        <button type="button" class="sq-alert" data-tone={props.tone} onClick={() => props.onOpen()}>
            <span class="sq-alert-title">
                <Show when={props.chip}>
                    {(chip) => <i class="sq-avy-chip" style={{ background: chip().bg }} aria-hidden="true" />}
                </Show>
                {props.title}
            </span>
            <span class="sq-alert-note">
                {props.note}
                <Show when={props.tone === "quiet"}>
                    <span aria-hidden="true">→</span>
                </Show>
            </span>
        </button>
    )
}

function AvalancheRow(props: Ctx & { avalanche: Avalanche }) {
    return (
        <Show
            when={props.avalanche.rating}
            fallback={
                <section class="sq-ground sq-avy-none" aria-label="Avalanche danger">
                    <p class="sq-strong">No current avalanche rating</p>
                    <p>That doesn’t mean it’s safe.</p>
                    <a class="sq-link" href={props.avalanche.link} target="_blank" rel="noreferrer">
                        {props.avalanche.center}
                    </a>
                </section>
            }
        >
            {(rating) => (
                <AlertRow
                    tone="avalanche"
                    title={`${rating().name} avalanche danger`}
                    note={`${rating().level} of 5`}
                    chip={avalancheScale[rating().level]}
                    onOpen={() => props.open({ kind: "avalanche", avalanche: props.avalanche })}
                />
            )}
        </Show>
    )
}

// Danger of 3 or higher is a go or no-go fact, so it joins the warnings at the top.
const risenAvalanche = (f: LabForecast) => ((f.avalanche?.rating?.level ?? 0) >= 3 ? f.avalanche : undefined)

function Alerts(props: Ctx) {
    const f = () => props.app.forecast
    const sorted = () => [...f().alerts].sort((a, b) => severityRank[a.severity] - severityRank[b.severity])
    const row = (alert: LabAlert) => (
        <AlertRow
            tone={alert.severity === "Extreme" ? "extreme" : isLoud(alert) ? "severe" : "quiet"}
            title={alert.event}
            note={alert.severity}
            onOpen={() => props.open({ kind: "alert", alert })}
        />
    )
    return (
        <Show when={sorted().length || risenAvalanche(f())}>
            <section class="sq-ground sq-alerts" aria-label="Alerts">
                <For each={sorted().filter(isLoud)}>{row}</For>
                <Show when={risenAvalanche(f())}>{(a) => <AvalancheRow {...props} avalanche={a()} />}</Show>
                <For each={sorted().filter((a) => !isLoud(a))}>{row}</For>
            </section>
        </Show>
    )
}

// Now is a paint chip: the current temperature's own color as a swatch inside the margins, with dark ink.
function Now(props: Ctx & { fit?: number; numeral: (el: HTMLElement) => void }) {
    const f = () => props.app.forecast
    const paint = () => paintTemp(f().current.temperature, props.app.theme)
    const text = () => degrees(f().current.temperature)
    const fit = () => numeralFit(text())
    const [starred, setStarred] = createSignal(false)
    const [refreshed, setRefreshed] = createSignal(false)
    const age = () => (refreshed() ? "just now" : formatAge(f().now - Date.parse(f().updatedAt)))
    const place = () => [f().place.city, f().place.state].filter(Boolean).join(", ")
    const details = () =>
        [
            feelsLike(f().current) !== undefined ? `Feels like ${degrees(feelsLike(f().current))}` : "",
            windLine(f().current),
        ]
            .filter(Boolean)
            .join(" · ")

    return (
        <section class="sq-chip sq-now" style={paintVars(paint())} aria-label="Right now">
            <div class="sq-place-row">
                <h1 class="sq-place">
                    <Cat />
                    <span>Right meow in {place()}</span>
                </h1>
                <button
                    type="button"
                    class="sq-star"
                    aria-pressed={starred() ? "true" : "false"}
                    aria-label={`Save ${f().place.city} to My Spots`}
                    onClick={() => setStarred(!starred())}
                >
                    <StarIcon filled={starred()} />
                </button>
            </div>
            <p
                ref={props.numeral}
                class="sq-numeral"
                style={{
                    "--em": fit().em.toFixed(3),
                    "--lsb": fit().lsb.toFixed(3),
                    "--fit": props.fit ? `${props.fit}px` : undefined,
                }}
            >
                {text()}
            </p>
            <p class="sq-cond">{conditionWord(f().current.shortForecast)}</p>
            <p class="sq-now-line">{details()}</p>
            <div class="sq-age">
                <button type="button" class="sq-link" onClick={() => setRefreshed(true)}>
                    Updated {age()}
                </button>
            </div>
        </section>
    )
}

function NextHours(props: Ctx) {
    const f = () => props.app.forecast
    const next = createMemo(() => nextHours(f()))
    const summary = () =>
        next()
            .blocks.map((b) => `${b.label}, ${degrees(b.temperature)}, ${b.precip}`)
            .join(". ")
    return (
        <section class="sq-ground sq-next" aria-label="Next 12 hours">
            <p class="sq-caption sq-strong">{next().caption}</p>
            <Show when={next().later}>{(storm) => <p class="sq-caption sq-later">{storm()}</p>}</Show>
            <a
                class="sq-blocks-link"
                aria-label={`Next 12 hours: ${summary()}. Open hour by hour.`}
                {...props.app.link({ name: "day", date: f().days[0]?.date ?? "" })}
            >
                <ol class="sq-blocks" aria-hidden="true">
                    <For each={next().blocks}>
                        {(block) => (
                            <li class="sq-block">
                                <span class="sq-block-head">
                                    <span class="sq-small">{block.label}</span>
                                    <span class="sq-num">{degrees(block.temperature)}</span>
                                </span>
                                <span>{block.precip}</span>
                            </li>
                        )}
                    </For>
                </ol>
            </a>
        </section>
    )
}

function Best(props: Ctx) {
    const f = () => props.app.forecast
    return (
        <Show when={f().best} fallback={<p class="sq-ground sq-caption sq-strong">No standout day this week</p>}>
            {(best) => (
                <section class="sq-ground sq-best" aria-label="Best day">
                    <a class="sq-best-head" {...props.app.link({ name: "day", date: best().day.date })}>
                        <span class="sq-small">Best day</span>
                        <span class="sq-num">{dayName(best().day, best().index)}</span>
                        <span>{best().day.condies!.bestWindow}</span>
                    </a>
                    <Score score={best().day.condies!.score} />
                </section>
            )}
        </Show>
    )
}

// Low on the left, high on the right, on one scale shared by the whole week, so warm days sit to the right.
// The bar is made of the ramp's own 5° steps, so its color comes from the data. A day missing one end shows a
// short mark at the end it has.
function RangeBar(props: { low?: number; high?: number; min: number; max: number; theme: DesignProps["theme"] }) {
    const span = () => props.max - props.min || 1
    const at = (t: number) => `${((t - props.min) / span()) * 100}%`
    const segments = () => {
        const low = props.low ?? props.high!
        const high = props.high ?? props.low!
        return low < high ? rampSteps(low, high, props.theme) : []
    }
    const only = () => (props.low === undefined || props.high === undefined ? (props.high ?? props.low) : undefined)
    return (
        <span class="sq-range" aria-hidden="true">
            <For each={segments()}>
                {(s) => (
                    <i style={{ left: at(s.from), width: `calc(${at(s.to)} - ${at(s.from)})`, background: s.bg }} />
                )}
            </For>
            <Show when={only() !== undefined}>
                <i
                    class="sq-range-tick"
                    style={{ left: at(only()!), background: paintTemp(only()!, props.theme).bg }}
                />
            </Show>
        </span>
    )
}

function DayRow(
    props: Ctx & { day: DaySummary; index: number; min: number; max: number; anchor?: (el: HTMLElement) => void },
) {
    const name = () => dayName(props.day, props.index)
    const period = () => props.day.day ?? props.day.night
    const marker = () => highlightWord(props.day.highlight)
    const condition = () => marker() ?? conditionWord(period()?.shortForecast ?? "")
    // "Light snow · 6.4″ snow" says snow twice, so the amount drops the word when the condition has it.
    const snow = () =>
        hasSnow(props.day) ? `${formatSnow(props.day.snow!)}${/snow|pow/i.test(condition()) ? "" : " snow"}` : undefined
    const label = () =>
        [
            `${name()}, ${shortDate(props.day.date)}`,
            condition(),
            snow(),
            props.day.low !== undefined ? `low ${props.day.low}°` : undefined,
            props.day.high !== undefined ? `high ${props.day.high}°` : undefined,
        ]
            .filter(Boolean)
            .join(". ")
    return (
        <li>
            <a class="sq-day" aria-label={label()} {...props.app.link({ name: "day", date: props.day.date })}>
                <span class="sq-day-name sq-strong" aria-hidden="true">
                    {name()}
                </span>
                <span class="sq-day-low" aria-hidden="true">
                    {props.day.low === undefined ? "" : degrees(props.day.low)}
                </span>
                <RangeBar
                    low={props.day.low}
                    high={props.day.high}
                    min={props.min}
                    max={props.max}
                    theme={props.app.theme}
                />
                <span ref={(el: HTMLElement) => props.anchor?.(el)} class="sq-day-high" aria-hidden="true">
                    {props.day.high === undefined ? "" : degrees(props.day.high)}
                </span>
                <span class="sq-day-cond" aria-hidden="true">
                    <span class={marker() ? "sq-strong" : undefined}>{condition()}</span>
                    <Show when={snow()}>, {snow()}</Show>
                </span>
            </a>
        </li>
    )
}

function Week(props: Ctx & { anchor: (el: HTMLElement) => void }) {
    const f = () => props.app.forecast
    const anchorIndex = () => Math.min(1, f().days.length - 1)
    const temps = () =>
        f()
            .days.flatMap((d) => [d.low, d.high])
            .filter((t): t is number => t !== undefined)
    const min = () => Math.min(...temps())
    const max = () => Math.max(...temps())
    return (
        <section class="sq-ground sq-week" aria-label="This week">
            <div class="sq-week-head" aria-hidden="true">
                <span class="sq-strong">This week</span>
                <span class="sq-day-low sq-small">Low</span>
                <span />
                <span class="sq-day-high sq-small">High</span>
            </div>
            <ol class="sq-days">
                <For each={f().days}>
                    {(day, i) => (
                        <DayRow
                            {...props}
                            day={day}
                            index={i()}
                            min={min()}
                            max={max()}
                            anchor={i() === anchorIndex() ? props.anchor : undefined}
                        />
                    )}
                </For>
            </ol>
        </section>
    )
}

// Snow in time order: what fell, what's there now, what's coming. Laid out on the same three columns as the
// next 12 hours, so the two read as one system.
function Snow(props: Ctx) {
    const f = () => props.app.forecast
    const depth = () => f().snowDepth
    const coming = () => (f().weekSnow >= 1 ? f().weekSnow : undefined)
    const signed = (inches: number) => `${inches > 0 ? "+" : inches < 0 ? "−" : ""}${Math.abs(inches)}″`
    return (
        <Show when={depth() || coming()}>
            <section class="sq-ground sq-facts" aria-labelledby="sq-snow-title">
                <h2 id="sq-snow-title" class="sq-strong">
                    Snow
                </h2>
                <dl class="sq-facts-grid">
                    <Show when={depth()}>
                        {(d) => (
                            <>
                                <div>
                                    <dt class="sq-small">Last 24 hours</dt>
                                    <dd class="sq-num">{signed(d().change)}</dd>
                                </div>
                                <div>
                                    <dt class="sq-small">On the ground</dt>
                                    <dd class="sq-num">{d().depth}″</dd>
                                </div>
                            </>
                        )}
                    </Show>
                    <Show when={coming()}>
                        {(inches) => (
                            <div>
                                <dt class="sq-small">Next 7 days</dt>
                                <dd class="sq-num">{formatSnow(inches())}</dd>
                            </div>
                        )}
                    </Show>
                </dl>
                <Show when={depth()}>
                    {(d) => (
                        <p class="sq-small sq-facts-source">
                            Measured at {d().station.name}, {Number(d().station.miles.toFixed(1))} mi away at{" "}
                            {d().station.elevation.toLocaleString()} ft, {formatAge(f().now - d().measuredAt)}.
                        </p>
                    )}
                </Show>
            </section>
        </Show>
    )
}

const duration = (hours: number) => {
    const minutes = Math.round(hours * 60)
    const h = Math.floor(minutes / 60)
    return h ? `${h} hr ${minutes % 60} min` : `${minutes} min`
}

function localHour(time: number, timeZone: string) {
    const parts = new Intl.DateTimeFormat("en-US", {
        timeZone,
        hour: "numeric",
        minute: "numeric",
        hourCycle: "h23",
    }).formatToParts(time)
    const part = (type: string) => Number(parts.find((p) => p.type === type)!.value)
    return part("hour") + part("minute") / 60
}

// Today's light, drawn like a week row: sunrise on the left, sunset on the right, and the daylight between them
// on a 24-hour track. The part already behind us is dimmed, so the bar shows how much light is left.
function Daylight(props: Ctx) {
    const f = () => props.app.forecast
    return (
        <Show when={f().sun}>
            {(sun) => {
                const now = () => localHour(f().now, f().place.timeZone)
                const rise = () => sun().sunriseHour
                const set = () => sun().sunsetHour
                const passed = () => Math.min(Math.max(now(), rise()), set())
                const at = (hour: number) => `${(hour / 24) * 100}%`
                const status = () =>
                    now() < rise()
                        ? `Sunrise in ${duration(rise() - now())}`
                        : now() < set()
                          ? `${duration(set() - now())} left`
                          : `${duration(set() - rise())} total`
                return (
                    <section class="sq-ground sq-daylight" aria-labelledby="sq-daylight-title">
                        <h2 id="sq-daylight-title" class="sq-strong">
                            Daylight
                        </h2>
                        <p class="sq-sr">
                            Sunrise {sun().sunrise}, sunset {sun().sunset}. {status()}.
                        </p>
                        <div class="sq-sunrow" aria-hidden="true">
                            <span class="sq-strong">{sun().sunrise}</span>
                            <span class="sq-sunbar">
                                <i class="sq-sunbar-past" style={{ left: at(rise()), width: at(passed() - rise()) }} />
                                <i class="sq-sunbar-left" style={{ left: at(passed()), width: at(set() - passed()) }} />
                            </span>
                            <span class="sq-strong">{sun().sunset}</span>
                            <span class="sq-small">Sunrise</span>
                            <span class="sq-small sq-sunrow-status">{status()}</span>
                            <span class="sq-small sq-sunrow-end">Sunset</span>
                        </div>
                    </section>
                )
            }}
        </Show>
    )
}

function Mountain(props: Ctx) {
    const f = () => props.app.forecast
    const calmAvalanche = () => (risenAvalanche(f()) ? undefined : f().avalanche)
    return (
        <>
            <Snow {...props} />
            <Show when={calmAvalanche()}>
                {(avalanche) => (
                    <div class="sq-ground sq-alerts sq-alerts-calm">
                        <AvalancheRow {...props} avalanche={avalanche()} />
                    </div>
                )}
            </Show>
            <Daylight {...props} />
        </>
    )
}

// Tomorrow's high must clear the bottom of the first screen by this much.
const PEEK = 8
const MIN_NUMERAL = 84

function HomeScreen(props: Ctx) {
    // CSS sizes the numeral to the swatch's width and about a fifth of the screen's height. On a busy day with
    // several warnings it shrinks further, so that tomorrow's high still makes the first screen.
    const [size, setSize] = createSignal<number>()
    let numeral: HTMLElement | undefined
    let anchor: HTMLElement | undefined
    onSettled(() => {
        const fit = () => {
            if (!numeral || !anchor) {
                return
            }
            setSize(undefined)
            flush()
            if (innerWidth >= 1024) {
                return
            }
            const current = parseFloat(getComputedStyle(numeral).fontSize)
            const ratio = numeral.getBoundingClientRect().height / current
            // On a phone the dock covers the bottom of the screen, so tomorrow has to clear the dock instead.
            const dock = document.querySelector<HTMLElement>(".sq-dock")
            const bottom =
                dock && getComputedStyle(dock).display !== "none" ? dock.getBoundingClientRect().top : innerHeight
            const slack = bottom - PEEK - (anchor.getBoundingClientRect().bottom + scrollY)
            if (slack < 0) {
                setSize(Math.floor(Math.max(MIN_NUMERAL, current + slack / ratio)))
            }
        }
        document.fonts.ready.then(fit)
        addEventListener("resize", fit)
        return () => removeEventListener("resize", fit)
    })

    return (
        <div class="sq-home">
            <Masthead {...props} />
            <Alerts {...props} />
            <div class="sq-split">
                <div class="sq-lead">
                    <Now {...props} fit={size()} numeral={(el) => (numeral = el)} />
                </div>
                <div class="sq-rest">
                    <NextHours {...props} />
                    <Best {...props} />
                    <Week {...props} anchor={(el) => (anchor = el)} />
                    <Mountain {...props} />
                </div>
            </div>
        </div>
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
    const marker = () => highlightWord(props.day.highlight)
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

function SheetFrame(props: ParentProps<{ label: string; onClose: () => void; paint?: Paint; title?: string }>) {
    let dialog!: HTMLDialogElement
    const mount = (el: HTMLDialogElement) => {
        dialog = el
        queueMicrotask(() => {
            if (el.isConnected && !el.open) {
                el.showModal()
            }
        })
    }
    return (
        <dialog ref={mount} class="sq-sheet" aria-label={props.label} onClose={props.onClose}>
            <div class="sq-sheet-bar" style={props.paint ? paintVars(props.paint) : undefined}>
                <span class="sq-strong">{props.title}</span>
                <button type="button" class="sq-close" onClick={() => dialog.close()}>
                    Close
                </button>
            </div>
            {props.children}
        </dialog>
    )
}

function AlertSheet(props: { alert: LabAlert; onClose: () => void }) {
    // The detail reads like the notice it opened from: framed, heavier for Extreme, plain for the quieter ones.
    const tone = () => (props.alert.severity === "Extreme" ? "extreme" : isLoud(props.alert) ? "severe" : "quiet")
    return (
        <SheetFrame label={props.alert.event} onClose={props.onClose} title={props.alert.severity}>
            <div class="sq-sheet-head" data-tone={tone()}>
                <h2 class="sq-num">{props.alert.event}</h2>
                <p>{props.alert.headline}</p>
            </div>
            <div class="sq-sheet-body">
                <dl class="sq-parts">
                    <For each={props.alert.parts}>
                        {(part) => (
                            <div>
                                <Show when={part.label}>
                                    <dt class="sq-strong">{sentence(part.label)}</dt>
                                </Show>
                                <dd>{part.text}</dd>
                            </div>
                        )}
                    </For>
                </dl>
                <Show when={props.alert.instruction}>
                    <p class="sq-strong">{props.alert.instruction}</p>
                </Show>
            </div>
        </SheetFrame>
    )
}

function AvalancheSheet(props: { avalanche: Avalanche; onClose: () => void }) {
    const rating = () => props.avalanche.rating!
    const paint = () => avalancheScale[rating().level]
    return (
        <SheetFrame label="Avalanche danger" onClose={props.onClose} paint={paint()} title="Avalanche danger">
            <div class="sq-sheet-head" style={paintVars(paint())}>
                <h2 class="sq-num">{rating().name}</h2>
                <p>
                    Level {rating().level} of 5.
                    {rating().warning ? ` Avalanche ${rating().warning} in effect.` : ""}
                </p>
            </div>
            <div class="sq-sheet-body">
                <p>{rating().advice}</p>
                <p>Varies by slope and elevation.</p>
                <a class="sq-link" href={props.avalanche.link} target="_blank" rel="noreferrer">
                    {props.avalanche.center}
                </a>
            </div>
        </SheetFrame>
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
                <p class="sq-ground sq-offline" role="status">
                    You’re offline. This is the last forecast you loaded.
                </p>
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
                    {(s) => <AlertSheet alert={(s() as { alert: LabAlert }).alert} onClose={close} />}
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

function LoadingState(props: { theme: DesignProps["theme"] }) {
    const walk = () => rampWalk(props.theme)
    return (
        <div class="sq-loading" role="status">
            <div
                class="sq-loading-band"
                aria-hidden="true"
                style={Object.fromEntries(walk().map((c, i) => [`--c${i}`, c]))}
            />
            <p class="sq-ground sq-loading-text">Getting the forecast.</p>
        </div>
    )
}

function ErrorState(props: { app: DesignProps }) {
    return (
        <div class="sq-ground sq-error" role="alert">
            <p class="sq-num">Couldn’t load this page.</p>
            <div class="sq-error-actions">
                <button type="button" class="sq-link" onClick={() => location.reload()}>
                    Try again
                </button>
                <a class="sq-link" {...props.app.link({ name: "home" })}>
                    Go home
                </a>
            </div>
        </div>
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
                    <ErrorState app={props} />
                </Match>
                <Match when={props.status === "ready"}>
                    <Ready app={props} />
                </Match>
            </Switch>
        </div>
    )
}
