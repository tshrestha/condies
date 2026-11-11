import { query } from "@solidjs/router"
import { createMemo, Loading, Show } from "solid-js"

import { avalancheAt, getAvalancheZones, getSnowDepth } from "./lib/mountain.ts"
import { formatAge } from "./lib/util.ts"

// The North American danger scale's standard colors, with whichever text is readable on each.
const dangerColors: Record<number, { background: string; color: string }> = {
    1: { background: "#50b848", color: "#000" },
    2: { background: "#fff200", color: "#000" },
    3: { background: "#f7941e", color: "#000" },
    4: { background: "#ed1c24", color: "#000" },
    5: { background: "#231f20", color: "#fff" },
}

// Both of these are extras, so a failure just leaves their row off the page. The zones are fetched once and
// shared by every place.
const avalancheZones = query(getAvalancheZones, "avalancheZones")
const snowDepth = query(getSnowDepth, "snowDepth")

const getAvalanche = async (lat: string, lon: string) => avalancheAt(await avalancheZones(), lat, lon, Date.now())

export default function MountainConditions(props: { lat: string; lon: string }) {
    const avalanche = createMemo(() => getAvalanche(props.lat, props.lon))
    const snow = createMemo(() => snowDepth(props.lat, props.lon))

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
