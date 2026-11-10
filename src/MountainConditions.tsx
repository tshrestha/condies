import { query } from "@solidjs/router"
import { createMemo, Loading, Show } from "solid-js"

import { type AvalancheZone, findZone, readZone } from "./lib/avalanche.ts"
import { type DepthReading, nearestStations, readDepth, type StationRow } from "./lib/snotel.ts"
import { formatAge } from "./lib/util.ts"

const DAY = 86_400_000
const avalancheURL = "https://api.avalanche.org/v2/public/products/map-layer"
const snowDataURL = "https://wcc.sc.egov.usda.gov/awdbRestApi/services/v1/data"

// The North American danger scale's standard colors, with whichever text is readable on each.
const dangerColors: Record<number, { background: string; color: string }> = {
    1: { background: "#50b848", color: "#000" },
    2: { background: "#fff200", color: "#000" },
    3: { background: "#f7941e", color: "#000" },
    4: { background: "#ed1c24", color: "#000" },
    5: { background: "#231f20", color: "#fff" },
}

// Both of these are extras, so a failure just leaves their row off the page.
const getAvalancheZones = query(async (): Promise<AvalancheZone[] | null> => {
    try {
        const response = await fetch(avalancheURL)
        return response.ok ? (await response.json()).features : null
    } catch (e) {
        console.error("failed to get avalanche forecast", e)
        return null
    }
}, "avalancheZones")

async function getAvalanche(lat: string, lon: string) {
    const zones = await getAvalancheZones()
    const zone = zones && findZone(zones, Number(lat), Number(lon))
    return zone ? readZone(zone, Date.now()) : undefined
}

const toApiDate = (time: number) => new Date(time).toISOString().slice(0, 10)

const getSnowDepth = query(async (lat: string, lon: string) => {
    try {
        const { default: rows } = await import("./assets/snotel-stations.json")
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
}, "snowDepth")

export default function MountainConditions(props: { lat: string; lon: string }) {
    const avalanche = createMemo(() => getAvalanche(props.lat, props.lon))
    const snow = createMemo(() => getSnowDepth(props.lat, props.lon))

    return (
        <div class="day-insights mountain-conditions mb-4">
            <Loading fallback={null}>
                <Show when={avalanche()}>
                    <div class="day-insight">
                        <Show
                            when={avalanche()!.rating}
                            fallback={
                                <>
                                    <span class="day-insight-icon">
                                        <i class="bi bi-question-circle" />
                                    </span>
                                    <span>
                                        <strong>No current avalanche rating</strong>
                                        <small>
                                            That doesn't mean it's safe.{" "}
                                            <a href={avalanche()!.link} target="_blank" rel="noreferrer">
                                                {avalanche()!.center}
                                            </a>
                                        </small>
                                    </span>
                                </>
                            }
                        >
                            <span class="avalanche-level" style={dangerColors[avalanche()!.rating!.level]}>
                                {avalanche()!.rating!.level}
                            </span>
                            <span>
                                <strong>Avalanche danger: {avalanche()!.rating!.name}</strong>
                                <Show when={avalanche()!.rating!.warning}>
                                    <strong class="text-danger">
                                        Avalanche {avalanche()!.rating!.warning} in effect
                                    </strong>
                                </Show>
                                <small>{avalanche()!.rating!.advice}</small>
                                <small>
                                    Varies by slope and elevation.{" "}
                                    <a href={avalanche()!.link} target="_blank" rel="noreferrer">
                                        {avalanche()!.center}
                                    </a>
                                </small>
                            </span>
                        </Show>
                    </div>
                </Show>
            </Loading>
            <Loading fallback={null}>
                <Show when={snow()}>
                    <div class="day-insight">
                        <span class="day-insight-icon snow-depth">{snow()!.depth}″</span>
                        <span>
                            <strong>
                                On the ground
                                <Show when={snow()!.change}>
                                    {` · ${snow()!.change > 0 ? "+" : ""}${snow()!.change}″ in 24 hours`}
                                </Show>
                            </strong>
                            <small>
                                {snow()!.station.name} · {snow()!.station.miles.toFixed(1)} mi away ·{" "}
                                {snow()!.station.elevation.toLocaleString("en-US")} ft · measured{" "}
                                {formatAge(Date.now() - snow()!.measuredAt)}
                            </small>
                        </span>
                    </div>
                </Show>
            </Loading>
        </div>
    )
}
