import { query } from "@solidjs/router"
import { createMemo, Errored, Loading, Show } from "solid-js"

import { getItem, lastLocationKey, setItem } from "./lib/cache.ts"
import { denver } from "./lib/nws.ts"
import { getLocation } from "./lib/util.ts"

import Forecast, { getForecastData } from "./Forecast.tsx"
import LocationSearchForm from "./LocationSearchForm.tsx"

const getLastLocation = () => getItem(lastLocationKey) ?? denver

const getData = query(async () => {
    try {
        const {
            // @ts-ignore
            coords: { latitude, longitude },
        } = await getLocation()
        const location = { lat: latitude.toFixed(4), lon: longitude.toFixed(4) }
        setItem(lastLocationKey, location)
        return location
    } catch (e) {
        const location = getLastLocation()
        console.log("could not get location, using last known or default:", (e as GeolocationPositionError).message)
        return { lat: location.lat, lon: location.lon }
    }
}, "homeGeoLocation")

export default function Home() {
    // Shown while the browser finds the current location. Returning visitors get their last location,
    // so nothing extra is fetched unless they've moved.
    const initialPoint = getLastLocation()
    const latlon = createMemo(() => getData())
    // Keeps the initial forecast on screen until the current location's forecast has loaded.
    const forecast = createMemo(() => getForecastData(latlon().lat, latlon().lon))

    return (
        <>
            <Errored
                fallback={
                    <>
                        <div class="alert alert-warning text-center rounded-5 p-2 mt-2" role="status">
                            Couldn't load the forecast for your location, so this is Denver's.
                        </div>
                        <Forecast point={denver} />
                    </>
                }
            >
                <Loading fallback={<Forecast point={initialPoint} />}>
                    <Show when={forecast()}>
                        <Forecast point={latlon()!} />
                    </Show>
                </Loading>
            </Errored>
            <LocationSearchForm />
        </>
    )
}
