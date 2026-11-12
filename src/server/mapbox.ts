/// <reference types="node" />

import "server-only"

const searchURL = "https://api.mapbox.com/search/geocode/v6"
const timeoutMs = 10_000

// Mapbox checks these against the access token's URL restrictions.
const tokenHeaders = { Origin: "https://condies.fyi", Referer: "https://condies.fyi" }

// Searches Mapbox's geocoding API for places in the US, and returns the response body. Throws if Mapbox doesn't answer
// with a 200.
export async function searchMapbox(endpoint: "/forward" | "/reverse", params: Record<string, string>): Promise<string> {
    const token = process.env.mapbox_access_token
    if (!token) {
        throw new Error("mapbox_access_token is not set")
    }

    // encodeURIComponent writes a space as "%20". Mapbox would read a "+" as a literal plus.
    const query = Object.entries({ ...params, country: "us", access_token: token })
        .map(([name, value]) => `${name}=${encodeURIComponent(value)}`)
        .join("&")
    const url = `${searchURL}${endpoint}?${query}`

    let status: number
    try {
        const response = await fetch(url, { headers: tokenHeaders, signal: AbortSignal.timeout(timeoutMs) })
        if (response.status === 200) {
            return await response.text()
        }
        status = response.status
        await response.body?.cancel()
    } catch (error) {
        // Rethrown without the error itself in case it names the URL, which holds the access token.
        throw new Error(`mapbox ${endpoint} request failed: ${describe(error)}`)
    }
    throw new Error(`mapbox ${endpoint} answered with status ${status}`)
}

function describe(error: unknown): string {
    if (!(error instanceof Error)) {
        return "unknown error"
    }
    const cause = error.cause as { code?: unknown } | undefined
    return typeof cause?.code === "string" ? `${error.name} (${cause.code})` : error.name
}
