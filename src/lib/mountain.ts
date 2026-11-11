import { type AvalancheZone, findZone, readZone } from "./avalanche.ts"
import { type DepthReading, nearestStations, readDepth, type Station, type StationRow } from "./snotel.ts"

const DAY = 86_400_000
const avalancheURL = "https://api.avalanche.org/v2/public/products/map-layer"
const snowDataURL = "https://wcc.sc.egov.usda.gov/awdbRestApi/services/v1/data"

export interface SnowDepth {
    depth: number
    change: number
    measuredAt: number
    station: Pick<Station, "name" | "miles" | "elevation">
}

// Avalanche danger and measured snow are extras, so a failure gives null and just leaves them off the page.

// Every forecast zone in the country, fetched once and searched for each place.
export async function getAvalancheZones(): Promise<AvalancheZone[] | null> {
    try {
        const response = await fetch(avalancheURL)
        return response.ok ? (await response.json()).features : null
    } catch (e) {
        console.error("failed to get avalanche forecast", e)
        return null
    }
}

export function avalancheAt(zones: AvalancheZone[] | null, lat: string, lon: string, now: number) {
    const zone = zones && findZone(zones, Number(lat), Number(lon))
    return zone ? readZone(zone, now) : undefined
}

const toApiDate = (time: number) => new Date(time).toISOString().slice(0, 10)

export async function getSnowDepth(lat: string, lon: string): Promise<SnowDepth | null> {
    try {
        const { default: rows } = await import("../assets/snotel-stations.json")
        const stations = nearestStations(rows as StationRow[], Number(lat), Number(lon))
        if (!stations.length) {
            return null
        }

        const now = Date.now()
        const params = new URLSearchParams({
            stationTriplets: stations.map((s) => s.triplet).join(","),
            elements: "SNWD",
            duration: "HOURLY",
            beginDate: `${toApiDate(now - 3 * DAY)} 00:00`,
            endDate: `${toApiDate(now + DAY)} 00:00`,
        })
        const response = await fetch(`${snowDataURL}?${params}`)
        if (!response.ok) {
            return null
        }

        const results: { stationTriplet: string; data: { values: DepthReading[] }[] }[] = await response.json()
        for (const station of stations) {
            const values = results.find((r) => r.stationTriplet === station.triplet)?.data[0]?.values
            const reading = values && readDepth(values, station.utcOffset, now)
            // Stopping at the closest reading, even a bare one, avoids hunting for a station that has snow.
            if (reading) {
                return reading.depth >= 1 ? { station, ...reading } : null
            }
        }
        return null
    } catch (e) {
        console.error("failed to get snow depth", e)
        return null
    }
}
