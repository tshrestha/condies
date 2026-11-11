import { useParams, useSearchParams } from "@solidjs/router"
import { createMemo, Loading, Show, untrack } from "solid-js"

import { DayPlaceholder } from "./day/Placeholder.tsx"
import { DayView } from "./day/sections.tsx"
import { createForecastView } from "./forecastData.ts"
import { theme } from "./theme.ts"

// The router reuses a route's component when only its params change, so key on them to remount.
export function ForecastDayRoute() {
    const params = useParams()

    return (
        <Show when={`${params.point}/${params.date}`} keyed>
            {(_key) => <ForecastDay point={params.point!} date={params.date!} />}
        </Show>
    )
}

function ForecastDay(props: { point: string; date: string }) {
    const [searchParams] = useSearchParams()
    // Each mount shows one day, so the route values are read once. A day opened from Home goes back there;
    // one opened from a place's forecast goes back to that.
    const { lat, lon, date, query, back } = untrack(() => {
        const [lat, lon] = props.point.split(",")
        const fromHome = searchParams.from === "home"
        return {
            lat,
            lon,
            date: props.date,
            query: fromHome ? "?from=home" : "",
            back: fromHome ? "#/" : `#/forecast/${lat},${lon}`,
        }
    })

    const view = createForecastView(lat, lon)
    const index = createMemo(() => view().days.findIndex((d) => d.date === date))

    return (
        <Loading fallback={<DayPlaceholder />}>
            <Show
                when={index() >= 0}
                fallback={
                    // An old link, or a day that has since passed.
                    <div class="sq-ground sq-error" role="status">
                        <h1 class="sq-num">There’s no forecast for this day.</h1>
                        <div class="sq-error-actions">
                            <a class="sq-link" href={back}>
                                Back to the forecast
                            </a>
                        </div>
                    </div>
                }
            >
                <DayView
                    forecast={view()}
                    theme={theme()}
                    dayLink={(day) => ({ href: `#/forecast/${lat},${lon}/day/${day}${query}` })}
                    now={{ href: back }}
                    day={view().days[index()]}
                    index={index()}
                />
            </Show>
        </Loading>
    )
}
