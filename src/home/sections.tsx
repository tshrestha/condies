import { createMemo, createSignal, flush, For, Loading, onSettled, Show } from "solid-js"

import { Cat, StarIcon } from "../design/icons.tsx"
import type { LinkProps } from "../design/nav.tsx"
import { AlertRow, RangeBar, Score } from "../design/parts.tsx"
import { avalancheScale, paintTemp, paintVars, type Theme } from "../design/ramp.ts"
import {
    conditionWord,
    dayName,
    degrees,
    feelsLike,
    highlightWord,
    isLoud,
    nextHours,
    numeralFit,
    severityRank,
    shortDate,
    windLine,
} from "../design/words.ts"
import { type DaySummary, formatSnow, hasSnow } from "../lib/daily.ts"
import type { AlertView, ForecastView } from "../lib/forecastView.ts"
import { formatAge } from "../lib/util.ts"
import { FactsPlaceholder } from "./Placeholder.tsx"

// Home's sections. They take the forecast and plain callbacks, and know nothing of the router or the data's
// source. Avalanche danger, snow depth and sun times arrive after the forecast: reading them can suspend, so each
// section that reads one waits behind its own Loading boundary.

export type Avalanche = NonNullable<ForecastView["avalanche"]>

export interface HomeCtx {
    forecast: ForecastView
    theme: Theme
    dayLink: (date: string) => LinkProps
    openAlert: (alert: AlertView) => void
    openAvalanche: (avalanche: Avalanche) => void
}

export interface NowProps {
    saved: boolean
    onToggleSave: () => void
    // How long ago the forecast was made, as in "Updated 5 min ago". Empty when NWS doesn't say.
    updated: string
    onRefresh: () => void
}

function AvalancheRow(props: HomeCtx & { avalanche: Avalanche }) {
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
                    onOpen={() => props.openAvalanche(props.avalanche)}
                />
            )}
        </Show>
    )
}

// Danger of 3 or higher is a go or no-go fact, so it joins the warnings at the top.
const risenAvalanche = (f: ForecastView) => ((f.avalanche?.rating?.level ?? 0) >= 3 ? f.avalanche : undefined)

function AlertList(props: HomeCtx & { avalanche?: Avalanche }) {
    const sorted = () => [...props.forecast.alerts].sort((a, b) => severityRank[a.severity] - severityRank[b.severity])
    const row = (alert: AlertView) => (
        <AlertRow
            tone={alert.severity === "Extreme" ? "extreme" : isLoud(alert) ? "severe" : "quiet"}
            title={alert.event}
            note={alert.severity}
            onOpen={() => props.openAlert(alert)}
        />
    )
    return (
        <Show when={sorted().length || props.avalanche}>
            <section class="sq-ground sq-alerts" aria-label="Alerts">
                <For each={sorted().filter(isLoud)}>{row}</For>
                <Show when={props.avalanche}>{(a) => <AvalancheRow {...props} avalanche={a()} />}</Show>
                <For each={sorted().filter((a) => !isLoud(a))}>{row}</For>
            </section>
        </Show>
    )
}

// The weather alerts don't wait for avalanche danger: until it arrives they show on their own.
export function Alerts(props: HomeCtx) {
    return (
        <Loading fallback={<AlertList {...props} />}>
            <AlertList {...props} avalanche={risenAvalanche(props.forecast)} />
        </Loading>
    )
}

// Now is a paint chip: the current temperature's own color as a swatch inside the margins, with dark ink.
export function Now(props: HomeCtx & NowProps & { fit?: number; numeral: (el: HTMLElement) => void }) {
    const f = () => props.forecast
    const paint = () => paintTemp(f().current.temperature, props.theme)
    const text = () => degrees(f().current.temperature)
    const fit = () => numeralFit(text())
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
                    aria-pressed={props.saved ? "true" : "false"}
                    aria-label={`Save ${f().place.city} to My Spots`}
                    onClick={() => props.onToggleSave()}
                >
                    <StarIcon filled={props.saved} />
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
            <Show when={props.updated}>
                <div class="sq-age">
                    {/* An installed app has no reload button, so this is also how to get a new forecast. */}
                    <button
                        type="button"
                        class="sq-link"
                        aria-label={`Updated ${props.updated}. Refresh the forecast.`}
                        onClick={() => props.onRefresh()}
                    >
                        Updated {props.updated}
                    </button>
                </div>
            </Show>
        </section>
    )
}

export function NextHours(props: HomeCtx) {
    const f = () => props.forecast
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
                {...props.dayLink(f().days[0]?.date ?? "")}
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

export function Best(props: HomeCtx) {
    const f = () => props.forecast
    return (
        <Show when={f().best} fallback={<p class="sq-ground sq-caption sq-strong">No standout day this week</p>}>
            {(best) => (
                <section class="sq-ground sq-best" aria-label="Best day">
                    <a class="sq-best-head" {...props.dayLink(best().day.date)}>
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

function DayRow(
    props: HomeCtx & { day: DaySummary; index: number; min: number; max: number; anchor?: (el: HTMLElement) => void },
) {
    const name = () => dayName(props.day, props.index)
    const period = () => props.day.day ?? props.day.night
    const marker = () => highlightWord(props.day)
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
            <a class="sq-day" aria-label={label()} {...props.dayLink(props.day.date)}>
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
                    theme={props.theme}
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

export function Week(props: HomeCtx & { anchor: (el: HTMLElement) => void }) {
    const f = () => props.forecast
    const anchorIndex = () => Math.min(1, f().days.length - 1)
    const temps = () =>
        f()
            .days.flatMap((d) => [d.low, d.high])
            .filter((t): t is number => t !== undefined)
    const min = () => Math.min(...temps())
    const max = () => Math.max(...temps())
    return (
        <Show when={f().days.length}>
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
        </Show>
    )
}

// Snow in time order: what fell, what's there now, what's coming. Laid out on the same three columns as the
// next 12 hours, so the two read as one system.
function Snow(props: HomeCtx) {
    const f = () => props.forecast
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
function Daylight(props: HomeCtx) {
    const f = () => props.forecast
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

// Snow depth, avalanche danger and sun times each arrive on their own. Snow shows its shape while it waits only
// when the week's forecast already says there will be a Snow section; there's always daylight.
function Mountain(props: HomeCtx) {
    const f = () => props.forecast
    const calmAvalanche = () => (risenAvalanche(f()) ? undefined : f().avalanche)
    return (
        <>
            <Loading
                fallback={
                    <Show when={f().weekSnow >= 1}>
                        <FactsPlaceholder title="Snow" />
                    </Show>
                }
            >
                <Snow {...props} />
            </Loading>
            <Loading fallback={null}>
                <Show when={calmAvalanche()}>
                    {(avalanche) => (
                        <Show when={avalanche().rating} fallback={<AvalancheRow {...props} avalanche={avalanche()} />}>
                            <div class="sq-ground sq-alerts sq-alerts-calm">
                                <AvalancheRow {...props} avalanche={avalanche()} />
                            </div>
                        </Show>
                    )}
                </Show>
            </Loading>
            <Loading fallback={<FactsPlaceholder title="Daylight" last />}>
                <Daylight {...props} />
            </Loading>
        </>
    )
}

// Tomorrow's high must clear the bottom of the first screen by this much.
const PEEK = 8
const MIN_NUMERAL = 84

// CSS sizes the numeral to the swatch's width and about a fifth of the screen's height. On a busy day with
// several warnings it shrinks further, so that tomorrow's high still makes the first screen. It fits again when
// the screen changes size, the connection drops or returns (the offline notice sits above), or anything
// watched changes size, such as the alerts when avalanche danger joins them.
function useNumeralFit() {
    const [size, setSize] = createSignal<number>()
    let numeral: HTMLElement | undefined
    let anchor: HTMLElement | undefined
    const watched: HTMLElement[] = []
    onSettled(() => {
        const fit = () => {
            if (!numeral?.isConnected || !anchor?.isConnected) {
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
        // Fitting settles on one size, so a refit it causes itself changes nothing and stops there.
        const observer = new ResizeObserver(fit)
        watched.forEach((el) => observer.observe(el))
        document.fonts.ready.then(fit)
        addEventListener("resize", fit)
        addEventListener("online", fit)
        addEventListener("offline", fit)
        return () => {
            observer.disconnect()
            removeEventListener("resize", fit)
            removeEventListener("online", fit)
            removeEventListener("offline", fit)
        }
    })
    return {
        size,
        numeral: (el: HTMLElement) => (numeral = el),
        anchor: (el: HTMLElement) => (anchor = el),
        watch: (el: HTMLElement) => watched.push(el),
    }
}

// The whole Home screen below the top bar.
export function HomeScreen(props: HomeCtx & NowProps & { notice?: string }) {
    const fit = useNumeralFit()
    return (
        <div class="sq-home">
            <div ref={fit.watch}>
                <Show when={props.notice}>
                    <p class="sq-ground sq-notice" role="status">
                        {props.notice}
                    </p>
                </Show>
                <Alerts {...props} />
            </div>
            <div class="sq-split">
                <div class="sq-lead">
                    <Show when={props.forecast.current}>
                        <Now {...props} fit={fit.size()} numeral={fit.numeral} />
                    </Show>
                </div>
                <div class="sq-rest">
                    <Show when={props.forecast.current}>
                        <NextHours {...props} />
                    </Show>
                    <Best {...props} />
                    <Week {...props} anchor={fit.anchor} />
                    <Mountain {...props} />
                </div>
            </div>
        </div>
    )
}
