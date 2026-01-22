import { createAsync, query } from "@solidjs/router"
import { Show, Suspense } from "solid-js"

import { reverseGeocodeSearch } from "./lib/geocoding.ts"
import { getClosestStation, getLatestObservations, toF } from "./lib/nws.ts"
import { getTimeOfDay } from "./lib/util.ts"
import { getIcon } from "./lib/wicons.ts"

import LatestObservationsPlaceholder from "./LatestObservationsPlaceholder.tsx"

const getData = query(async (point: any) => {
    const lat = point.geometry.coordinates[1]
    const lon = point.geometry.coordinates[0]

    const [observationLocation, latestObservations] = await Promise.all([
        reverseGeocodeSearch(lat, lon),
        getClosestStation(point.properties.observationStations).then((s) =>
            getLatestObservations(s!.properties.stationIdentifier)
        ),
    ])

    return { observationLocation, latestObservations }
}, "latestObservations")

export default function LatestObservations({ point }: any) {
    const timeOfDay = getTimeOfDay()
    const data = createAsync(() => getData(point))

    return (
        <Suspense fallback={<LatestObservationsPlaceholder />}>
            <Show when={data()}>
                <div class={"mt-4 mb-4 text-center latest-observations"}>
                    <h1 class={"display-6"}>{data()!.observationLocation.properties.name}</h1>
                    <p class={"mb-0"}>Right meow 🐱</p>
                    <div class={"d-flex justify-content-center align-items-center"}>
                        <div class="col text-end">
                            <img
                                src={getIcon({
                                    keyword: data()!.latestObservations.properties.textDescription,
                                    isDay: timeOfDay !== "night",
                                    isNight: timeOfDay === "night",
                                })}
                                class={"img-fluid w-50"}
                            />
                        </div>
                        <div class="col text-start">
                            <h1 class={"display-1 align-middle"}>
                                {toF(data()!.latestObservations.properties.temperature.value)}º
                            </h1>
                        </div>
                    </div>
                    <span class={"badge text-bg-secondary fs-6 p-2 fw-light"}>
                        {data()!.latestObservations.properties.textDescription}
                    </span>
                </div>
            </Show>
        </Suspense>
    )
}
