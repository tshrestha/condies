import { query } from "@solidjs/router"
import type { Feature } from "geojson"
import { createMemo, Loading, Show } from "solid-js"

import sunriseIcon from "./assets/weather-icons-master/production/fill/all/sunrise.svg"
import sunsetIcon from "./assets/weather-icons-master/production/fill/all/sunset.svg"
import SunRiseSetPlaceholder from "./SunRiseSetPlaceholder.tsx"

const apiURL = `https://aa.usno.navy.mil/api/rstt/oneday`

// Today's date and UTC offset at the forecast location, which can differ from the viewer's.
function getLocalDateAndOffset(timeZone: string) {
    const parts = new Intl.DateTimeFormat("en-US", {
        timeZone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        timeZoneName: "longOffset",
    }).formatToParts(new Date())
    const part = (type: string) => parts.find((p) => p.type === type)!.value

    const [, sign, hours, minutes] = part("timeZoneName").match(/GMT(?:([+-])(\d+):(\d+))?/)!
    const offset = hours ? parseInt(hours, 10) + parseInt(minutes, 10) / 60 : 0

    return { date: `${part("year")}-${part("month")}-${part("day")}`, offset: sign === "-" ? -offset : offset }
}

function formatTime(time: string) {
    const [hours, minutes] = time.split(":")
    const hour = parseInt(hours, 10)
    return `${hour % 12 || 12}:${minutes} ${hour < 12 ? "AM" : "PM"}`
}

const getData = query(async (lat: string, lon: string, timeZone: string) => {
    const { date, offset } = getLocalDateAndOffset(timeZone)

    const response = await fetch(`${apiURL}?date=${date}&tz=${offset}&coords=${lat},${lon}&id=ElevationCodeWorksLLC`)
    if (!response.ok) {
        console.error("failed to get sun rise/set data", response.status, response.statusText)
        return null
    }

    const result: Feature = await response.json()
    const { sundata } = result.properties!.data

    return {
        sunrise: formatTime(sundata.find((d: Record<string, string>) => d.phen === "Rise").time),
        sunset: formatTime(sundata.find((d: Record<string, string>) => d.phen === "Set").time),
    }
}, "sunriseset")

export default function SunRiseSet(props: Record<string, string>) {
    const data = createMemo(() => getData(props.lat, props.lon, props.timeZone))

    return (
        <Loading fallback={<SunRiseSetPlaceholder />}>
            <Show when={data()}>
                <div class={"d-flex justify-content-between align-items-center w-100 fs-6 fw-light mb-2"}>
                    <div class={"d-flex justify-content-start align-items-center col-6"}>
                        <div class={"col-2"}>
                            <img
                                src={sunriseIcon}
                                alt={"sunrise icon"}
                                class={"img-fluid img-thumbnail rounded-circle"}
                            ></img>
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
                            ></img>
                        </div>
                    </div>
                </div>
            </Show>
        </Loading>
    )
}
