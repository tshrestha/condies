import { Show } from "solid-js"

import { type Period, type Point } from "./lib/nws.ts"
import { getSky } from "./lib/sky.ts"
import { getIcon } from "./lib/wicons.ts"

import SpotStar from "./SpotStar.tsx"

export default function CurrentConditions(props: {
    point: Point
    period: Period
    next?: Period
    powDay: boolean
    lat: string
    lon: string
}) {
    const sky = () => getSky(props.period, props.next)
    const city = () => props.point.properties.relativeLocation?.properties.city
    const wind = () => props.period.windSpeed.value ?? props.period.windSpeed.maxValue ?? 0
    const gust = () => props.period.windGust?.value ?? 0
    const feelsLike = () => Math.round(props.period.feelsLike ?? props.period.temperature)

    return (
        <div class={`sky sky-${sky().kind}-${sky().time} mt-3 mb-4 text-center current-conditions`}>
            <Show when={sky().kind === "snow" || props.powDay}>
                <span class="sky-snowfall" aria-hidden="true"></span>
            </Show>
            <Show when={city()}>
                <SpotStar lat={props.lat} lon={props.lon} name={city()!} />
            </Show>
            <div class="position-relative">
                <h1 class={"display-6"}>{city()}</h1>
                <p class={"mb-0"}>Right meow 🐱</p>
                <div class={"d-flex justify-content-center align-items-center"}>
                    <div class="col-6 text-end">
                        <img
                            src={getIcon({
                                keyword: props.period.shortForecast,
                                isDay: props.period.isDaytime,
                            })}
                            class={"img-fluid w-50"}
                            alt=""
                        />
                    </div>
                    <div class="col-6 text-start">
                        <h1 class={"display-1 align-middle fw-lighter"} style={"font-size: 4rem;"}>
                            {props.period.temperature}°
                        </h1>
                    </div>
                </div>
                <span class={"badge text-bg-secondary fs-6 p-2 fw-light"}>{props.period.shortForecast}</span>
                <div class="sky-facts">
                    <Show when={Math.abs(feelsLike() - props.period.temperature) >= 3}>
                        <span>Feels like {feelsLike()}°</span>
                    </Show>
                    <span>
                        <i class="bi bi-wind" /> {wind() ? `${props.period.windDirection} ${wind()} mph` : "Calm"}
                    </span>
                    <Show when={gust() > wind()}>
                        <span>Gusts {gust()} mph</span>
                    </Show>
                </div>
            </div>
        </div>
    )
}
