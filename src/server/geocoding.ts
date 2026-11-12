"use server"

// Place search, run on the server so the Mapbox access token never reaches the browser. Every export is a server
// function: the app calls it like a local async function, and the call travels to the server over the same origin.

import { getRequestEvent } from "@solidjs/web"
import type { FeatureCollection } from "geojson"

import { clientKey } from "./clientKey.ts"
import { searchMapbox } from "./mapbox.ts"
import { countRequest, getCached, setCached } from "./redis.ts"

// The app debounces searches, so this leaves room for several people sharing one address.
const rateLimitRequests = 60
const rateLimitWindowSeconds = 60
// The most Mapbox takes.
const maxQueryLength = 256

// Places in the US that match the query.
export async function forwardGeocode(query: string): Promise<FeatureCollection> {
    await limitRate()
    if (typeof query !== "string" || !query.trim() || query.length > maxQueryLength) {
        fail(400)
    }
    return await search(`forward:${query}`, "/forward", { q: query })
}

// Places at a point in the US. Nothing calls this yet: the map looks up the place at a point with Nominatim.
export async function reverseGeocode(lat: string, lon: string): Promise<FeatureCollection> {
    await limitRate()
    if (!isCoordinate(lat, 90) || !isCoordinate(lon, 180)) {
        fail(400)
    }
    return await search(`reverse:${lat},${lon}`, "/reverse", { latitude: lat, longitude: lon })
}

// Answers the call with an HTTP status. The app's call rejects, with the status on the error.
function fail(status: number, headers?: HeadersInit): never {
    throw new Response(null, { status, headers })
}

const decimal = /^-?\d{1,3}(\.\d{1,10})?$/

function isCoordinate(value: unknown, limit: number) {
    return typeof value === "string" && decimal.test(value) && Math.abs(Number(value)) <= limit
}

// Counts the call against the caller's fixed window, and refuses it once the window is full.
async function limitRate() {
    const address = getRequestEvent()?.request.headers.get("x-nf-client-connection-ip")
    const client = clientKey(address)
    // Netlify sets the header on every request. Locally there's none, and every call shares one window.
    if (!client && !import.meta.env.DEV) {
        console.warn("geocoding call has no usable client address")
    }

    const now = Math.floor(Date.now() / 1000)
    const key = `ratelimit:geocoding:${client ?? "unknown"}:${Math.floor(now / rateLimitWindowSeconds)}`
    let count: number
    try {
        count = await countRequest(key, 2 * rateLimitWindowSeconds)
    } catch (error) {
        // Allowing the call here would let a flood that overwhelms Redis reach Mapbox with no limit at all.
        console.error("failed to check rate limit", error)
        fail(503)
    }
    if (count > rateLimitRequests) {
        fail(429, { "Retry-After": String(rateLimitWindowSeconds - (now % rateLimitWindowSeconds)) })
    }
}

// Answers from the cache when it can. A cache that can't be reached only costs a Mapbox request. Keys carry the
// endpoint, so a query can't reach a rate-limit counter or the other endpoint's results.
async function search(
    key: string,
    endpoint: "/forward" | "/reverse",
    params: Record<string, string>,
): Promise<FeatureCollection> {
    const cached = await getCached(key).catch((error: unknown) => {
        console.warn("failed to read cached geocoding result", { key }, error)
        return undefined
    })
    if (cached) {
        try {
            return JSON.parse(cached)
        } catch {
            console.warn("ignored a cached geocoding result that isn't JSON", { key })
        }
    }

    let body: string
    let result: FeatureCollection
    try {
        body = await searchMapbox(endpoint, params)
        result = JSON.parse(body)
    } catch (error) {
        console.error("geocoding request failed", error)
        fail(502)
    }
    await setCached(key, body).catch((error: unknown) => {
        console.error("failed to cache geocoding result", { key }, error)
    })
    return result
}
