import { createMemo, For, Loading, Show } from "solid-js"

import type { LinkProps } from "../design/nav.tsx"
import { Score } from "../design/parts.tsx"
import { paintDay, paintVars, type Theme } from "../design/ramp.ts"
import { dayName, degrees, highlightWord, sentence, shortDate, snowLine } from "../design/words.ts"
import { type DaySummary, formatSnow, formatWindRange, hasSnow } from "../lib/daily.ts"
import type { ForecastView } from "../lib/forecastView.ts"
import type { Period } from "../lib/nws.ts"
import { Hourly } from "./chart.tsx"

// The Day screen. Like Home's sections it takes the forecast and plain links. Sun times can arrive after the forecast, so the line that reads them waits
// behind its own Loading boundary.

export interface DayCtx {
    forecast: ForecastView
    theme: Theme
    dayLink: (date: string) => LinkProps
    // The place's own Now: Home, or the forecast page the day was opened from.
    now: LinkProps
}

const dateOf = (p: Period) => p.startTime.slice(0, 10)

// The neighboring days in words. Color stays for temperatures that carry the screen's meaning.
function Pager(props: DayCtx & { index: number }) {
    const f = () => props.forecast
    const prev = () => (props.index > 0 ? f().days[props.index - 1] : undefined)
    const next = () => f().days[props.index + 1]
    return (
        <nav class="sq-ground sq-pager" aria-label="Other days">
            <Show
                when={prev()}
                fallback={
                    <a class="sq-page" {...props.now}>
                        <span aria-hidden="true">←</span> Now {degrees(f().current?.temperature)}
                    </a>
                }
            >
                {(day) => (
                    <a
                        class="sq-page"
                        aria-label={`Previous day, ${dayName(day(), props.index - 1)} ${degrees(day().high ?? day().low)}`}
                        {...props.dayLink(day().date)}
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
                        aria-label={`Next day, ${dayName(day(), props.index + 1)} ${degrees(day().high ?? day().low)}`}
                        {...props.dayLink(day().date)}
                    >
                        {dayName(day(), props.index + 1)} {degrees(day().high ?? day().low)}{" "}
                        <span aria-hidden="true">→</span>
                    </a>
                )}
            </Show>
        </nav>
    )
}

// One day of the forecast.
export function DayView(props: DayCtx & { day: DaySummary; index: number }) {
    const f = () => props.forecast
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
            <Pager {...props} index={props.index} />
            <div class="sq-split">
                <div class="sq-lead">
                    <section class="sq-chip sq-dayhero" style={paintVars(paintDay(props.day, props.theme))}>
                        <h1 class="sq-num">{name()}</h1>
                        {/* The pager only reaches Now from the first day, so the place is the way back from any of them. */}
                        <p>
                            {shortDate(props.day.date, true)} ·{" "}
                            <a class="sq-link" {...props.now}>
                                {f().place.city}
                            </a>
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
                        <Loading fallback={null}>
                            <Show when={props.index === 0 && f().sun}>
                                {(sun) => (
                                    <p class="sq-sunline">
                                        Sunrise {sun().sunrise}, sunset {sun().sunset}
                                    </p>
                                )}
                            </Show>
                        </Loading>
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
                        <Hourly hours={hours()} title={hoursTitle()} theme={props.theme} />
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
