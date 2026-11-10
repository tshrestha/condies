import { createMemo, For, Show } from "solid-js"

import raindropIcon from "./assets/weather-icons-master/production/fill/all/raindrop.svg"
import snowflakeIcon from "./assets/weather-icons-master/production/fill/all/snowflake.svg"
import {
    bestDay,
    type DaySummary,
    formatSnow,
    formatTemp,
    formatWindRange,
    getDayLabel,
    groupIntoDays,
    hasSnow,
} from "./lib/daily.ts"
import type { Grid } from "./lib/grid.ts"
import type { Period } from "./lib/nws.ts"
import { scoreColor } from "./lib/score.ts"
import { describeStorm, findNextStorm } from "./lib/storm.ts"
import { tempGradient } from "./lib/tempColors.ts"
import { formatLocalDate } from "./lib/util.ts"
import { getIcon } from "./lib/wicons.ts"

export const getPrecipIcon = (summary: DaySummary) => (summary.precipType === "snow" ? snowflakeIcon : raindropIcon)

export const getSummaryIcon = (summary: DaySummary) => {
    const period = (summary.day ?? summary.night)!
    return getIcon({ keyword: period.shortForecast, isDay: period.isDaytime })
}

function DayRow(props: { summary: DaySummary; index: number; min: number; max: number; href: string }) {
    // Every bar shares one scale, so the row positions show how the week warms and cools.
    const range = () => {
        const { low, high } = props.summary
        const from = Math.min((low ?? high)!, (high ?? low)!)
        const to = Math.max((low ?? high)!, (high ?? low)!)
        const span = props.max - props.min || 1
        return { start: ((from - props.min) / span) * 100, width: ((to - from) / span) * 100 }
    }

    return (
        <a
            href={props.href}
            class={`list-group-item list-group-item-action daily-row ${
                props.summary.highlight ? `daily-row-${props.summary.highlight}` : ""
            }`}
            style={{ "--row": props.index }}
        >
            <span class="daily-day">
                <span class="fw-medium">{getDayLabel(props.summary, props.index, "short")}</span>
                <Show
                    when={props.summary.highlight}
                    fallback={
                        <small class="text-body-secondary">
                            {formatLocalDate(props.summary.date, { month: "short", day: "numeric" })}
                        </small>
                    }
                >
                    <span
                        class={`badge rounded-pill fw-bolder daily-chip ${
                            props.summary.highlight === "pow" ? "text-bg-primary" : "text-bg-warning"
                        }`}
                    >
                        {props.summary.highlight === "pow" ? "POW DAY" : "PRIMO"}
                    </span>
                </Show>
            </span>
            <span class="daily-icon">
                <img
                    src={getSummaryIcon(props.summary)}
                    alt={(props.summary.day ?? props.summary.night)!.shortForecast}
                />
                <Show when={props.summary.condies}>
                    <span
                        class="daily-score"
                        title="Condies score"
                        style={{ background: scoreColor(props.summary.condies!.score) }}
                    >
                        {props.summary.condies!.score}
                    </span>
                </Show>
            </span>
            <span class="daily-temps">
                <span class="daily-low">{formatTemp(props.summary.low)}</span>
                <span class="daily-track">
                    <span
                        class="daily-range"
                        style={{
                            left: `min(${range().start}%, calc(100% - 0.5rem))`,
                            width: `${range().width}%`,
                            background: tempGradient(props.summary.low, props.summary.high),
                        }}
                    ></span>
                </span>
                <span class="daily-high">{formatTemp(props.summary.high)}</span>
            </span>
            <span class="daily-meta">
                <span>
                    <img src={getPrecipIcon(props.summary)} alt={`chance of ${props.summary.precipType}`} />
                    {hasSnow(props.summary) ? formatSnow(props.summary.snow!) : `${props.summary.precipChance}%`}
                </span>
                <span>
                    <i class="bi bi-wind" />
                    {formatWindRange(props.summary)}
                </span>
            </span>
            <i class="bi bi-chevron-right daily-chevron" />
        </a>
    )
}

// A week of bad days has no day worth pointing out.
const worthGoingScore = 60

export default function DailyForecast(props: {
    periods: Period[]
    grid: Grid | null
    hourly: Period[]
    lat: string
    lon: string
    fromHome: boolean
    timeZone: string
}) {
    const days = createMemo(() => groupIntoDays(props.periods, { grid: props.grid, hourly: props.hourly }))
    const weekSnow = createMemo(() => days().reduce((total, day) => total + (day.snow ?? 0), 0))
    const storm = createMemo(() => (props.grid ? findNextStorm(props.grid.snowfall, Date.now()) : undefined))
    const best = createMemo(() => {
        const day = bestDay(days())
        const hasChoice = days().filter((d) => d.condies).length > 1
        return hasChoice && day!.condies!.score >= worthGoingScore ? day : undefined
    })
    const dayHref = (date: string) =>
        `#/forecast/${props.lat},${props.lon}/day/${date}${props.fromHome ? "?from=home" : ""}`
    const temperatures = createMemo(() =>
        days()
            .flatMap(({ low, high }) => [low, high])
            .filter((t) => t !== undefined),
    )

    return (
        <div class="card rounded-4 shadow-sm mb-4">
            <div class="card-header d-flex justify-content-between align-items-center">
                <span>7-DAY FORECAST</span>
                <Show when={weekSnow() >= 1}>
                    <span class="fw-medium">
                        <i class="bi bi-snow2" /> {formatSnow(weekSnow())} this week
                    </span>
                </Show>
            </div>
            <div class="list-group list-group-flush rounded-bottom-4">
                <Show when={storm()}>
                    <div class="list-group-item daily-outlook">
                        <span class="daily-outlook-mark">
                            <i class="bi bi-snow2" />
                        </span>
                        <span class="fw-medium">{describeStorm(storm()!, props.timeZone, Date.now())}</span>
                    </div>
                </Show>
                <Show when={best()}>
                    <a class="list-group-item list-group-item-action daily-outlook" href={dayHref(best()!.date)}>
                        <span
                            class="daily-outlook-mark daily-outlook-score"
                            style={{ background: scoreColor(best()!.condies!.score) }}
                        >
                            {best()!.condies!.score}
                        </span>
                        <span class="fw-medium">
                            Best day: {getDayLabel(best()!, days().indexOf(best()!), "long")},{" "}
                            {best()!.condies!.bestWindow}
                        </span>
                        <i class="bi bi-chevron-right daily-chevron ms-auto" />
                    </a>
                </Show>
                <For each={days()}>
                    {(summary, i) => (
                        <DayRow
                            summary={summary}
                            index={i()}
                            min={Math.min(...temperatures())}
                            max={Math.max(...temperatures())}
                            href={dayHref(summary.date)}
                        />
                    )}
                </For>
            </div>
        </div>
    )
}
