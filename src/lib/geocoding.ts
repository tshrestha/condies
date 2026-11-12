import type { FeatureCollection } from "geojson"

import { forwardGeocode } from "../server/geocoding.ts"
import { getItem, setItem } from "./cache.ts"

const baseURL = "https://nominatim.openstreetmap.org"

export type GeocodingResult = Record<
    string,
    string | number | string[] | number[] | Record<string, string | number | string[] | number[]>
>

export async function geocodeSearch(query: string): Promise<Partial<FeatureCollection>> {
    try {
        return await forwardGeocode(query)
    } catch (error) {
        console.error("geocode search failed", error)
        return {}
    }
}

export async function reverse(lat: string, lon: string): Promise<GeocodingResult> {
    const reqURL = `${baseURL}/reverse?lat=${lat}&lon=${lon}&format=json&addressdetails=1`
    const cached = getItem(reqURL)

    if (cached) {
        return cached
    }

    const response = await fetch(reqURL, {
        method: "GET",
        headers: {
            "User-Agent": "Elevation Code Works LLC",
        },
    })

    if (!response.ok) {
        console.error("geocoding reverse lookup request failed")
        return {}
    }

    const result = await response.json()
    // Nominatim reports places it can't find, like open ocean, as a successful response.
    if (result.error) {
        console.error("geocoding reverse lookup failed:", result.error)
        return {}
    }
    setItem(reqURL, result)

    return result
}
