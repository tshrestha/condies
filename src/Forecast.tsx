import { query, useLocation, useParams } from "@solidjs/router"
import type { Feature } from "geojson"
import { createMemo, Errored, Loading, Show, untrack } from "solid-js"

import { groupIntoDays } from "./lib/daily.ts"
import { type Alert, getAlerts, getForecast, getGridForecast, getPoint, type Point } from "./lib/nws.ts"

import Alerts from "./Alerts.tsx"
import DailyForecast from "./DailyForecast.tsx"
import ForecastPlaceholder from "./ForecastPlaceholder.tsx"
import HomeButton from "./HomeButton.tsx"
import HourlyForecast from "./HourlyForecast"
import CurrentConditions from "./CurrentConditions.tsx"
import CurrentConditionsPlaceholder from "./CurrentConditionsPlaceholder.tsx"
import LastUpdated from "./LastUpdated.tsx"
import MountainConditions from "./MountainConditions.tsx"
import SunRiseSet from "./SunRiseSet.tsx"
import ThemeToggle from "./ThemeToggle.tsx"

export interface ForecastProps {
    point: {
        lat: string
        lon: string
    }
}

const timeRegex = /(\d+):(\d+)\s(AM|PM)/

export const getForecastData = query(async (lat, lon) => {
    const point: Point = await getPoint(lat, lon)
    if (!point) {
        throw new Error(`no NWS data for ${lat},${lon}`)
    }

    const [alertResults, forecast, hourlyForecastResult, grid] = await Promise.all([
        getAlerts(lat, lon),
        getForecast(point.properties.forecast),
        getForecast(point.properties.forecastHourly),
        getGridForecast(point.properties.forecastGridData),
    ])

    // NWS responses are cached for a while, so the first period can already be over.
    const now = Date.now()
    if (forecast) {
        forecast.properties.periods = forecast.properties.periods.filter((p) => new Date(p.endTime).getTime() > now)
    }

    let alerts!: Alert[]
    if (alertResults && alertResults.features && alertResults.features.length) {
        alerts = alertResults.features.map((f: Feature) => f.properties)
    }

    const allHourlyPeriods = (hourlyForecastResult?.properties.periods ?? [])
        .filter((p) => new Date(p.endTime).getTime() > now)
        .map((p) => {
            const d = new Date(p.startTime)
            const timeString = d.toLocaleTimeString("en-US", {
                hour12: true,
                timeStyle: "short",
                timeZone: point.properties.timeZone,
            })
            const match = timeString.match(timeRegex)
            const hourString = `${match![1]} ${match![3]}`
            const start = d.getTime()
            const gridGust = grid?.gust.get(start)

            return {
                ...p,
                hourString,
                snowInches: grid?.snowfall.get(start) ?? 0,
                feelsLike: grid?.feelsLike.get(start),
                // The grid has gusts for far more hours than the hourly forecast does.
                windGust:
                    p.windGust
                    ?? (gridGust === undefined ? undefined : { value: Math.round(gridGust), unitCode: "mph" }),
            }
        })

    // Also catches a forecast saved for offline use that has since run out.
    if (!forecast?.properties.periods.length && !allHourlyPeriods.length) {
        throw new Error(`no current forecast for ${lat},${lon}`)
    }

    const hourlyForecast = { periods: allHourlyPeriods.slice(0, 11) }
    const updatedAt = forecast?.properties.generatedAt ?? hourlyForecastResult?.properties.generatedAt
    return { point, forecast, hourlyForecast, allHourlyPeriods, alerts, grid, updatedAt }
}, "forecast")

// The router reuses a route's component when only its params change, so key on the location to remount.
export function ForecastRoute() {
    const params = useParams()

    return (
        <Show when={params.point} keyed>
            {(point) => {
                const [lat, lon] = point.split(",")
                return <Forecast point={{ lat, lon }} />
            }}
        </Show>
    )
}

export default function Forecast(props: ForecastProps) {
    const location = useLocation()
    // Each mount shows one location, so the coordinates are read once.
    const { lat, lon } = untrack(() => props.point)

    const data = createMemo(() => getForecastData(lat, lon))
    const powDay = createMemo(
        () =>
            groupIntoDays(data().forecast?.properties.periods ?? [], {
                grid: data().grid,
                hourly: data().allHourlyPeriods,
            })[0]?.highlight === "pow",
    )

    return (
        <>
            <div class="d-flex justify-content-between align-items-center">
                <Show when={location.pathname === "/"}>
                    <a href="#/spots" class="btn btn-sm btn-light rounded-pill">
                        <i class="bi bi-star-fill text-warning" /> My Spots
                    </a>
                </Show>
                <div class="ms-auto">
                    <ThemeToggle />
                </div>
            </div>
            <Loading fallback={<CurrentConditionsPlaceholder />}>
                <Show when={data()!.hourlyForecast.periods.length}>
                    <CurrentConditions
                        point={data()!.point}
                        period={data()!.hourlyForecast.periods[0]}
                        next={data()!.hourlyForecast.periods[1]}
                        powDay={powDay()}
                        lat={lat}
                        lon={lon}
                    />
                </Show>
                <Show when={data()!.updatedAt}>
                    <LastUpdated time={data()!.updatedAt!} />
                </Show>
            </Loading>
            <Loading fallback={null}>
                <Show when={data() && data()!.alerts}>
                    <Alerts alerts={data()!.alerts} />
                </Show>
            </Loading>
            {/* Sunrise times are optional, so a failed lookup only hides this row. */}
            <Errored fallback={null}>
                <SunRiseSet lat={lat} lon={lon} timeZone={data()!.point.properties.timeZone} />
            </Errored>
            <Loading fallback={<ForecastPlaceholder />}>
                <Show when={data()!.hourlyForecast.periods.length}>
                    <HourlyForecast periods={data()!.hourlyForecast.periods} />
                </Show>
                <MountainConditions lat={lat} lon={lon} />
                <Show when={data()!.forecast}>
                    <DailyForecast
                        periods={data()!.forecast!.properties.periods}
                        grid={data()!.grid}
                        hourly={data()!.allHourlyPeriods}
                        lat={lat}
                        lon={lon}
                        fromHome={location.pathname === "/"}
                        timeZone={data()!.point.properties.timeZone}
                    />
                </Show>
            </Loading>
            <Show when={location.pathname !== "/"}>
                <div class={"position-fixed bottom-0 pb-4 z-3"}>
                    <HomeButton />
                </div>
            </Show>
        </>
    )
}
