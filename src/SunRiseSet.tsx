import { query } from "@solidjs/router"
import { createMemo, Loading, Show } from "solid-js"

import sunriseIcon from "./assets/weather-icons-master/production/fill/all/sunrise.svg"
import sunsetIcon from "./assets/weather-icons-master/production/fill/all/sunset.svg"
import { getSunTimes } from "./lib/sun.ts"
import SunRiseSetPlaceholder from "./SunRiseSetPlaceholder.tsx"

const getData = query(getSunTimes, "sunriseset")

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
