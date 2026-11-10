import type { FeatureCollection } from "geojson"
import { getItem, setItem } from "./cache.ts"

const baseURL = "https://nominatim.openstreetmap.org"
const geocodeURL = `${import.meta.env.VITE_GEOCODE_URL}/.netlify/functions/geocoding/forward`

export type GeocodingResult = Record<
    string,
    string | number | string[] | number[] | Record<string, string | number | string[] | number[]>
>

export async function geocodeSearch(query: string): Promise<Partial<FeatureCollection>> {
    const response = await fetch(`${geocodeURL}?q=${encodeURIComponent(query)}`, {
        method: "GET",
        headers: {
            "X-Nawa-Token": import.meta.env.VITE_NAWA_TOKEN,
        },
    })
    if (!response.ok) {
        console.error("geocode search failed")
        return {}
    }
    return await response.json()
}

export async function geocodingSearch(query: string) {
    const reqURL = `${baseURL}/search?q=${query}&format=json&addressdetails=1&countrycodes=us`
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
        console.error("geocoding search request failed")
        return []
    }

    const result = await response.json()
    setItem(reqURL, result)

    return result
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
