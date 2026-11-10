import { createMemo, For, Show } from "solid-js"

import raindropIcon from "./assets/weather-icons-master/production/fill/all/raindrop.svg"
import snowflakeIcon from "./assets/weather-icons-master/production/fill/all/snowflake.svg"
import { type DaySummary, formatTemp, formatWindRange, getDayLabel, groupIntoDays } from "./lib/daily.ts"
import type { Period } from "./lib/nws.ts"
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
            <img
                class="daily-icon"
                src={getSummaryIcon(props.summary)}
                alt={(props.summary.day ?? props.summary.night)!.shortForecast}
            />
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
                    {props.summary.precipChance}%
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

export default function DailyForecast(props: { periods: Period[]; lat: string; lon: string; fromHome: boolean }) {
    const days = createMemo(() => groupIntoDays(props.periods))
    const temperatures = createMemo(() =>
        days()
            .flatMap(({ low, high }) => [low, high])
            .filter((t) => t !== undefined),
    )

    return (
        <div class="card rounded-4 shadow-sm mb-4">
            <div class="card-header">7-DAY FORECAST</div>
            <div class="list-group list-group-flush rounded-bottom-4">
                <For each={days()}>
                    {(summary, i) => (
                        <DayRow
                            summary={summary}
                            index={i()}
                            min={Math.min(...temperatures())}
                            max={Math.max(...temperatures())}
                            href={`#/forecast/${props.lat},${props.lon}/day/${summary.date}${
                                props.fromHome ? "?from=home" : ""
                            }`}
                        />
                    )}
                </For>
            </div>
        </div>
    )
}
