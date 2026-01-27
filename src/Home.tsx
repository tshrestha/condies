import { createAsync, query } from "@solidjs/router"

import { denver } from "./lib/nws.ts"
import { getLocation } from "./lib/util.ts"

import Forecast from "./Forecast.tsx"
import LocationSearchForm from "./LocationSearchForm.tsx"

const getData = query(async () => {
    try {
        const {
            // @ts-ignore
            coords: { latitude, longitude },
        } = await getLocation()
        return { lat: latitude.toFixed(4), lon: longitude.toFixed(4) }
    } catch (e) {
        console.log("location not allowed, using default location", denver)
        return { lat: denver.lat, lon: denver.lon }
    }
}, "homeGeoLocation")

export default function Home() {
    const latlon = createAsync(() => getData(), {
        initialValue: { lat: denver.lat, lon: denver.lon },
    })

    return (
        <>
            <Forecast point={{ lat: latlon().lat, lon: latlon().lon }} />
            <LocationSearchForm />
        </>
    )
}
