import { createAsync, query } from "@solidjs/router"
import type { Feature } from "geojson"
import { Show, Suspense } from "solid-js"

import sunriseIcon from "./assets/weather-icons-master/production/fill/all/sunrise.svg"
import sunsetIcon from "./assets/weather-icons-master/production/fill/all/sunset.svg"
import SunRiseSetPlaceholder from "./SunRiseSetPlaceholder.tsx"

const apiURL = `https://aa.usno.navy.mil/api/rstt/oneday`

const getData = query(async (lat: string, lon: string) => {
    const date = new Date()
    const dateQuery = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`
    const tzQuery = -(date.getTimezoneOffset() / 60)

    const response = await fetch(
        `${apiURL}?date=${dateQuery}&tz=${tzQuery}&coords=${lat},${lon}&id=ElevationCodeWorksLLC`,
    )
    if (!response.ok) {
        console.error("failed to get sun rise/set data", response.status, response.statusText)
        return null
    }

    const result: Feature = await response.json()
    const { sundata } = result.properties?.data

    const [sunriseHours, sunriseMinutes] = sundata
        .find((d: Record<string, string>) => d.phen === "Rise")
        .time.split(":")
    const [sunsetHours, sunsetMinutes] = sundata.find((d: Record<string, string>) => d.phen === "Set").time.split(":")
    const sunriseDate = new Date()
    const sunsetDate = new Date()
    sunriseDate.setHours(parseInt(sunriseHours, 10))
    sunriseDate.setMinutes(parseInt(sunriseMinutes, 10))
    sunsetDate.setHours(parseInt(sunsetHours, 10))
    sunsetDate.setMinutes(parseInt(sunsetMinutes, 10))

    return {
        sunrise: `${sunriseDate.getHours()}:${
            sunriseDate.getMinutes() < 10 ? "0" + sunriseDate.getMinutes() : sunriseDate.getMinutes()
        } AM`,
        sunset: `${sunsetDate.getHours() - 12}:${
            sunsetDate.getMinutes() < 10 ? "0" + sunsetDate.getMinutes() : sunsetDate.getMinutes()
        } PM`,
    }
}, "sunriseset")

export default function SunRiseSet({ lat, lon }: Record<string, string>) {
    const data = createAsync(() => getData(lat, lon))

    return (
        <Suspense fallback={<SunRiseSetPlaceholder />}>
            <Show when={data()}>
                <div class={"d-flex justify-content-between align-items-center w-100 fs-6 fw-light mb-2"}>
                    <div class={"d-flex justify-content-start align-items-center col-6"}>
                        <div class={"col-2"}>
                            <img
                                src={sunriseIcon}
                                alt={"sunrise icon"}
                                class={"img-fluid img-thumbnail rounded-circle"}
                            >
                            </img>
                        </div>
                        <div class={"col-auto ms-2"}>{data()!.sunrise}</div>
                    </div>
                    <div class={"d-flex justify-content-end align-items-center col-6"}>
                        <div class={"col-auto me-2"}>{data()?.sunset}</div>
                        <div class={"col-2 text-end"}>
                            <img
                                src={sunsetIcon}
                                alt={"sunset icon"}
                                class={"img-fluid img-thumbnail rounded-circle"}
                            >
                            </img>
                        </div>
                    </div>
                </div>
            </Show>
        </Suspense>
    )
}
