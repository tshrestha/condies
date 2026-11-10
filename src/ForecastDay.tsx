import { useParams, useSearchParams } from "@solidjs/router"
import { createMemo, For, Loading, Match, Show, Switch, untrack } from "solid-js"

import {
    type DaySummary,
    formatSnow,
    formatTemp,
    formatWindRange,
    getDayLabel,
    groupIntoDays,
    hasSnow,
} from "./lib/daily.ts"
import { scoreColor } from "./lib/score.ts"
import { tempGradient } from "./lib/tempColors.ts"
import { formatLocalDate } from "./lib/util.ts"
import { getIcon } from "./lib/wicons.ts"

import { getPrecipIcon, getSummaryIcon } from "./DailyForecast.tsx"
import { getForecastData } from "./Forecast.tsx"
import ForecastPlaceholder from "./ForecastPlaceholder.tsx"
import HomeButton from "./HomeButton.tsx"
import HourlyForecast from "./HourlyForecast.tsx"
import ThemeToggle from "./ThemeToggle.tsx"

// The router reuses a route's component when only its params change, so key on them to remount.
export function ForecastDayRoute() {
    const params = useParams()

    return (
        <Show when={`${params.point}/${params.date}`} keyed>
            {(_key) => <ForecastDay point={params.point!} date={params.date!} />}
        </Show>
    )
}

function DayHighlight(props: { highlight: DaySummary["highlight"] }) {
    return (
        <Switch>
            <Match when={props.highlight === "primo"}>
                <span class="badge rounded-pill text-bg-warning fw-bolder py-2 px-3">
                    <i>PRIMO CONDIES!</i>
                </span>
            </Match>
            <Match when={props.highlight === "pow"}>
                <span class="d-inline-flex align-items-center gap-2">
                    <span class="fs-4">🏂</span>
                    <span class="badge rounded-pill text-bg-primary fw-bolder py-2 px-3">
                        <i>POW DAY!</i>
                    </span>
                    <span class="fs-4">⛷️</span>
                </span>
            </Match>
        </Switch>
    )
}

function ForecastDay(props: { point: string; date: string }) {
    const [searchParams] = useSearchParams()
    // Each mount shows one day, so the route values are read once.
    const { lat, lon, date, query, backHref } = untrack(() => {
        const [lat, lon] = props.point.split(",")
        const fromHome = searchParams.from === "home"
        return {
            lat,
            lon,
            date: props.date,
            query: fromHome ? "?from=home" : "",
            backHref: fromHome ? "#/" : `#/forecast/${lat},${lon}`,
        }
    })

    const data = createMemo(() => getForecastData(lat, lon))
    const days = createMemo(() =>
        groupIntoDays(data().forecast?.properties.periods ?? [], {
            grid: data().grid,
            hourly: data().allHourlyPeriods,
        }),
    )
    const index = createMemo(() => days().findIndex((d) => d.date === date))
    const summary = createMemo(() => days()[index()])
    const hours = createMemo(() => data().allHourlyPeriods.filter((p) => p.startTime.slice(0, 10) === date))

    const dayLink = (offset: number) => {
        const target = days()[index() + offset]
        return target && { href: `#/forecast/${lat},${lon}/day/${target.date}${query}`, label: target }
    }
    const previous = () => dayLink(-1)
    const next = () => dayLink(1)

    return (
        <>
            <ThemeToggle />
            <Loading fallback={<ForecastPlaceholder />}>
                <Show
                    when={summary()}
                    fallback={
                        <div class="alert alert-secondary text-center rounded-5 mt-4" role="status">
                            There's no forecast for this day.{" "}
                            <a href={backHref} class="alert-link">
                                Back to the forecast
                            </a>
                        </div>
                    }
                >
                    <section class="day-hero text-center mt-3 mb-4">
                        <div class="d-flex justify-content-between align-items-start">
                            <Show when={previous()} fallback={<span class="day-nav-link"></span>}>
                                <a class="day-nav-link text-start" href={previous()!.href}>
                                    <i class="bi bi-chevron-left" />{" "}
                                    {getDayLabel(previous()!.label, index() - 1, "short")}
                                </a>
                            </Show>
                            <div>
                                <h1 class="display-6 mb-0">{getDayLabel(summary()!, index(), "long")}</h1>
                                <div class="text-body-secondary">
                                    {formatLocalDate(date, { month: "long", day: "numeric" })}
                                    <Show when={data().point.properties.relativeLocation}>
                                        {" · "}
                                        {data().point.properties.relativeLocation!.properties.city}
                                    </Show>
                                </div>
                            </div>
                            <Show when={next()} fallback={<span class="day-nav-link"></span>}>
                                <a class="day-nav-link text-end" href={next()!.href}>
                                    {getDayLabel(next()!.label, index() + 1, "short")} <i class="bi bi-chevron-right" />
                                </a>
                            </Show>
                        </div>

                        <img
                            class="day-hero-icon"
                            src={getSummaryIcon(summary()!)}
                            alt={(summary()!.day ?? summary()!.night)!.shortForecast}
                        />

                        <div class="day-hero-temps">
                            <span class="day-hero-low">{formatTemp(summary()!.low)}</span>
                            <span
                                class="day-hero-range"
                                style={{ background: tempGradient(summary()!.low, summary()!.high) }}
                            ></span>
                            <span class="day-hero-high">{formatTemp(summary()!.high)}</span>
                        </div>

                        <span class="badge text-bg-secondary fs-6 p-2 fw-light">
                            {(summary()!.day ?? summary()!.night)!.shortForecast}
                        </span>

                        <Show when={summary()!.highlight}>
                            <div class="mt-3">
                                <DayHighlight highlight={summary()!.highlight} />
                            </div>
                        </Show>

                        <div class="day-stats mt-4">
                            <div class="day-stat">
                                <img src={getPrecipIcon(summary()!)} alt="" />
                                <strong>{summary()!.precipChance}%</strong>
                                <small>Chance of {summary()!.precipType}</small>
                            </div>
                            <div class="day-stat">
                                <i class="bi bi-wind" />
                                <strong>{formatWindRange(summary()!)}</strong>
                                <small>Wind</small>
                            </div>
                            <Show when={summary()!.gust}>
                                <div class="day-stat">
                                    <i class="bi bi-wind" />
                                    <strong>{summary()!.gust} mph</strong>
                                    <small>Gusts</small>
                                </div>
                            </Show>
                        </div>
                        <Show when={summary()!.condies || summary()!.phase}>
                            <div class="day-insights mt-3 text-start">
                                <Show when={summary()!.condies}>
                                    <div class="day-insight">
                                        <span
                                            class="day-score-ring"
                                            style={{
                                                "--score": summary()!.condies!.score,
                                                "--score-color": scoreColor(summary()!.condies!.score),
                                            }}
                                        >
                                            {summary()!.condies!.score}
                                        </span>
                                        <span>
                                            <strong>Condies score</strong>
                                            <small>Best window {summary()!.condies!.bestWindow}</small>
                                        </span>
                                    </div>
                                </Show>
                                <Show when={summary()!.phase}>
                                    <div class="day-insight">
                                        <span class="day-insight-icon">
                                            <i
                                                class={
                                                    summary()!.phase!.phase === "rain"
                                                        ? "bi bi-droplet-fill"
                                                        : "bi bi-snow2"
                                                }
                                            />
                                        </span>
                                        <span>
                                            <strong>
                                                {
                                                    {
                                                        snow: "All snow at this elevation",
                                                        rain: "Rain at this elevation",
                                                        mix: "Right at the rain/snow line",
                                                    }[summary()!.phase!.phase]
                                                }
                                                <Show when={hasSnow(summary()!)}>
                                                    {` · ${formatSnow(summary()!.snow!)}`}
                                                </Show>
                                            </strong>
                                            <small>
                                                Snow level {summary()!.phase!.snowLevelFeet.toLocaleString("en-US")} ft,
                                                this spot is {summary()!.phase!.elevationFeet.toLocaleString("en-US")}{" "}
                                                ft
                                            </small>
                                        </span>
                                    </div>
                                </Show>
                            </div>
                        </Show>
                    </section>

                    <div class="card rounded-4 shadow-sm mb-4">
                        <div class="card-header">DETAILED FORECAST</div>
                        <div class="list-group list-group-flush rounded-bottom-4">
                            <For each={summary()!.periods}>
                                {(period) => (
                                    <div class="list-group-item">
                                        <div class="d-flex align-items-center gap-2 mb-1">
                                            <img
                                                class="day-period-icon"
                                                src={getIcon({
                                                    keyword: period.shortForecast,
                                                    isDay: period.isDaytime,
                                                })}
                                                alt={period.shortForecast}
                                            />
                                            <span class="fw-medium">{period.name}</span>
                                            <span class="ms-auto fw-medium">{period.temperature}°</span>
                                        </div>
                                        <p class="mb-1">{period.detailedForecast}</p>
                                    </div>
                                )}
                            </For>
                        </div>
                    </div>

                    <Show when={hours().length}>
                        <HourlyForecast periods={hours()} />
                    </Show>
                </Show>
            </Loading>
            <div class="position-fixed bottom-0 pb-4 z-3">
                <HomeButton href={backHref} />
            </div>
        </>
    )
}
