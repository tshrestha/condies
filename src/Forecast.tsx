import { query, useLocation, useParams } from "@solidjs/router"
import type { Feature } from "geojson"
import { createMemo, Errored, Loading, Show, untrack } from "solid-js"

import { type Alert, getAlerts, getForecast, getPoint, type Point } from "./lib/nws.ts"

import Alerts from "./Alerts.tsx"
import DetailedForecast from "./DetailedForecaset.tsx"
import ForecastPlaceholder from "./ForecastPlaceholder.tsx"
import HomeButton from "./HomeButton.tsx"
import HourlyForecast from "./HourlyForecast"
import LatestObservations from "./LatestObservations.tsx"
import LatestObservationsPlaceholder from "./LatestObservationsPlaceholder.tsx"
import ShortForecast from "./ShortForecast.tsx"
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

    const [alertResults, forecast, hourlyForecastResult] = await Promise.all([
        getAlerts(lat, lon),
        getForecast(point.properties.forecast),
        getForecast(point.properties.forecastHourly),
    ])

    if (!forecast && !hourlyForecastResult) {
        throw new Error(`no forecast available for ${lat},${lon}`)
    }

    // NWS responses are cached for a while, so the first period can already be over.
    if (forecast) {
        const now = Date.now()
        forecast.properties.periods = forecast.properties.periods.filter((p) => new Date(p.endTime).getTime() > now)
    }

    let alerts!: Alert[]
    if (alertResults && alertResults.features && alertResults.features.length) {
        alerts = alertResults.features.map((f: Feature) => f.properties)
    }

    let currentHourExpired = false
    const periods = (hourlyForecastResult?.properties.periods ?? [])
        .filter((p) => {
            if (p.number === 1) {
                const currentDate = new Date()
                const endTime = new Date(p.endTime)
                currentHourExpired = currentDate.getTime() > endTime.getTime()
                return !currentHourExpired
            }
            return currentHourExpired ? p.number < 13 : p.number < 12
        })
        .map((p) => {
            const d = new Date(p.startTime)
            const timeString = d.toLocaleTimeString("en-US", {
                hour12: true,
                timeStyle: "short",
                timeZone: point.properties.timeZone,
            })
            const match = timeString.match(timeRegex)
            p.hourString = `${match![1]} ${match![3]}`
            return { ...p, hourString: `${match![1]} ${match![3]}` }
        })

    const hourlyForecast = { periods }
    return { point, forecast, hourlyForecast, alerts }
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

    return (
        <>
            <ThemeToggle />
            <Loading fallback={<LatestObservationsPlaceholder />}>
                <Show when={data()!.hourlyForecast.periods.length}>
                    <LatestObservations point={data()!.point} period={data()!.hourlyForecast.periods[0]} />
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
                <Show when={data()!.forecast}>
                    <ShortForecast periods={data()!.forecast!.properties.periods} />
                    <DetailedForecast periods={data()!.forecast!.properties.periods} />
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
