import { query, useLocation, useParams } from "@solidjs/router"
import type { Feature } from "geojson"
import { createEffect, createMemo, createSignal, Loading, Match, onCleanup, Show, Switch, untrack } from "solid-js"

import { type Avalanche, type HomeCtx, HomeScreen } from "./home/sections.tsx"
import { HomePlaceholder } from "./home/Placeholder.tsx"
import { AlertSheet, AvalancheSheet } from "./home/sheets.tsx"
import { type AlertView, buildForecast, type ForecastView, toAlertView } from "./lib/forecastView.ts"
import { avalancheAt, getAvalancheZones, getSnowDepth } from "./lib/mountain.ts"
import { type Alert, getAlerts, getForecast, getGridForecast, getPoint, type Point } from "./lib/nws.ts"
import { isSpot, toggleSpot } from "./lib/spots.ts"
import { getSunTimes } from "./lib/sun.ts"
import { formatAge } from "./lib/util.ts"
import { setPresentTemperature } from "./present.ts"
import { theme } from "./theme.ts"

export interface ForecastProps {
    point: {
        lat: string
        lon: string
    }
    // Said above the forecast, such as why it isn't for where you are.
    notice?: string
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

// These are extras: each loads on its own after the forecast, and a failure only leaves its section off. The
// avalanche zones are fetched once and shared by every place.
const avalancheZones = query(getAvalancheZones, "avalancheZones")
const snowDepth = query(getSnowDepth, "snowDepth")
const sunTimes = query(getSunTimes, "sunriseset")

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

type Open = { kind: "alert"; alert: AlertView } | { kind: "avalanche"; avalanche: Avalanche }

// Home with its forecast. This is made while the forecast may still be loading, so its body reads only plain
// props; the forecast is read in the markup, where the Loading boundary catches the wait.
function Ready(props: { forecast: ForecastView; lat: string; lon: string; notice?: string; fromHome: boolean }) {
    const { lat, lon, fromHome } = untrack(() => ({ lat: props.lat, lon: props.lon, fromHome: props.fromHome }))
    const place = { lat: Number(lat), lon: Number(lon) }
    const [saved, setSaved] = createSignal(isSpot(place))
    const [open, setOpen] = createSignal<Open>()
    const [clock, setClock] = createSignal(Date.now())
    const timer = setInterval(() => setClock(Date.now()), 60_000)
    onCleanup(() => clearInterval(timer))

    createEffect(
        () => props.forecast.current?.temperature,
        (t) => {
            if (t !== undefined) {
                setPresentTemperature(t)
            }
        },
    )

    const home: HomeCtx = {
        get forecast() {
            return props.forecast
        },
        get theme() {
            return theme()
        },
        dayLink: (date) => ({
            href: `#/forecast/${lat},${lon}/day/${date}${fromHome ? "?from=home" : ""}`,
        }),
        openAlert: (alert) => setOpen({ kind: "alert", alert }),
        openAvalanche: (avalanche) => setOpen({ kind: "avalanche", avalanche }),
    }
    const close = () => setOpen(undefined)

    return (
        <>
            <HomeScreen
                {...home}
                notice={props.notice}
                saved={saved()}
                onToggleSave={() =>
                    setSaved(toggleSpot({ ...place, name: props.forecast.place.city || `${lat}, ${lon}` }))
                }
                updated={props.forecast.updatedAt ? formatAge(clock() - Date.parse(props.forecast.updatedAt)) : ""}
                onRefresh={() => location.reload()}
            />
            <Switch>
                <Match when={open()?.kind === "alert" && open()}>
                    {(o) => <AlertSheet alert={(o() as { alert: AlertView }).alert} onClose={close} />}
                </Match>
                <Match when={open()?.kind === "avalanche" && open()}>
                    {(o) => <AvalancheSheet avalanche={(o() as { avalanche: Avalanche }).avalanche} onClose={close} />}
                </Match>
            </Switch>
        </>
    )
}

export default function Forecast(props: ForecastProps) {
    const location = useLocation()
    // Each mount shows one location, so the coordinates are read once.
    const { lat, lon } = untrack(() => props.point)
    const fromHome = untrack(() => location.pathname === "/")

    const data = createMemo(() => getForecastData(lat, lon))
    const avalanche = createMemo(() =>
        avalancheZones().then(
            (zones) => avalancheAt(zones, lat, lon, Date.now()),
            () => undefined,
        ),
    )
    const depth = createMemo(() =>
        snowDepth(lat, lon).then(
            (d) => d ?? undefined,
            () => undefined,
        ),
    )
    const sun = createMemo(() => {
        const { timeZone } = data().point.properties
        return sunTimes(lat, lon, timeZone).then(
            (s) => s ?? undefined,
            () => undefined,
        )
    })

    // Built from what the forecast already returned. The extras are read lazily, so a section only waits on the
    // one it shows.
    const view = createMemo((): ForecastView => {
        const { point, forecast, allHourlyPeriods, alerts, grid, updatedAt } = data()
        const { relativeLocation, timeZone } = point.properties
        const now = Date.now()
        const built = buildForecast({
            place: {
                city: relativeLocation?.properties.city ?? "",
                state: relativeLocation?.properties.state ?? "",
                lat,
                lon,
                timeZone,
                elevationFeet: grid ? Math.round(grid.elevation * 3.28084) : undefined,
            },
            now,
            periods: forecast?.properties.periods ?? [],
            hours: allHourlyPeriods,
            grid: grid ?? null,
            alerts: (alerts ?? []).map(toAlertView),
            updatedAt: updatedAt ?? "",
        })
        return Object.defineProperties(built, {
            avalanche: { get: avalanche, enumerable: true },
            snowDepth: { get: depth, enumerable: true },
            sun: { get: sun, enumerable: true },
        })
    })

    return (
        <div class="sq-root" data-theme={theme()}>
            <Loading fallback={<HomePlaceholder />}>
                <Ready forecast={view()} lat={lat} lon={lon} notice={props.notice} fromHome={fromHome} />
            </Loading>
        </div>
    )
}
