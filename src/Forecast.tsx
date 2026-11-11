import { useLocation, useParams } from "@solidjs/router"
import { createEffect, createSignal, Loading, Match, onCleanup, Show, Switch, untrack } from "solid-js"

import { createForecastView } from "./forecastData.ts"
import { type Avalanche, type HomeCtx, HomeScreen } from "./home/sections.tsx"
import { HomePlaceholder } from "./home/Placeholder.tsx"
import { AlertSheet, AvalancheSheet } from "./home/sheets.tsx"
import type { AlertView, ForecastView } from "./lib/forecastView.ts"
import { isSpot, toggleSpot } from "./lib/spots.ts"
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

    const view = createForecastView(lat, lon)

    // Home.tsx renders this inside its own Loading and Errored fallbacks. In production builds of Solid 2 RC, a
    // fallback that is itself a boundary with no element around it hangs the page, so this div has to stay. The
    // location fallback tests in forecast.spec.ts and reliability.spec.ts catch it.
    return (
        <div>
            <Loading fallback={<HomePlaceholder />}>
                <Ready forecast={view()} lat={lat} lon={lon} notice={props.notice} fromHome={fromHome} />
            </Loading>
        </div>
    )
}
