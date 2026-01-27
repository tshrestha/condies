import { createAsync, query } from "@solidjs/router"
import { Show, Suspense } from "solid-js"

import { reverseGeocodeSearch } from "./lib/geocoding.ts"
import { type Period, type Point } from "./lib/nws.ts"
import { getTimeOfDay } from "./lib/util.ts"
import { getIcon } from "./lib/wicons.ts"

import LatestObservationsPlaceholder from "./LatestObservationsPlaceholder.tsx"

const getData = query(async (point: any) => {
    const lat = point.geometry.coordinates[1]
    const lon = point.geometry.coordinates[0]

    const [observationLocation] = await Promise.all([
        reverseGeocodeSearch(lat, lon),
    ])

    return { observationLocation }
}, "latestObservations")

export default function LatestObservations({ point, period }: { point: Point; period: Period }) {
    const timeOfDay = getTimeOfDay()
    const data = createAsync(() => getData(point))

    return (
        <Suspense fallback={<LatestObservationsPlaceholder />}>
            <Show when={data()}>
                <div class={"mt-4 mb-4 text-center latest-observations"}>
                    <h1 class={"display-6"}>{data()!.observationLocation.properties.name}</h1>
                    <p class={"mb-0"}>Right meow 🐱</p>
                    <div class={"d-flex justify-content-center align-items-center"}>
                        <div class="col-6 text-end">
                            <img
                                src={getIcon({
                                    keyword: period.shortForecast,
                                    isDay: timeOfDay !== "night",
                                    isNight: timeOfDay === "night",
                                })}
                                class={"img-fluid w-50"}
                            />
                        </div>
                        <div class="col-6 text-start">
                            <h1 class={"display-1 align-middle fw-lighter"} style={"font-size: 4rem;"}>
                                {period.temperature}º
                            </h1>
                        </div>
                    </div>
                    <span class={"badge text-bg-secondary fs-6 p-2 fw-light"}>
                        {period.shortForecast}
                    </span>
                </div>
            </Show>
        </Suspense>
    )
}
