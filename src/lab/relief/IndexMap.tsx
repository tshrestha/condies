import { createMemo, For, Show } from "solid-js"

import type { DaySummary } from "../../lib/daily.ts"
import type { LabSpot } from "../data.ts"
import { useWidth } from "./useWidth.ts"

const HEIGHT = 240
const PAD = 26

const niceStep = (span: number) => [0.25, 0.5, 1, 2, 5, 10, 20].find((step) => span / step <= 5) ?? 20

function dm(value: number, positive: string, negative: string) {
    const absolute = Math.abs(value)
    const degrees = Math.floor(absolute)
    const minutes = Math.round((absolute - degrees) * 60)
    return `${degrees}°${minutes ? `${String(minutes).padStart(2, "0")}′` : ""}${value >= 0 ? positive : negative}`
}

const OFFSETS = [
    [0, -12],
    [0, 17],
    [13, 4],
    [-13, 4],
    [13, -9],
    [-13, -9],
]

// Numbers take the first spot around their mark that doesn't land on another mark or number.
function placed(points: { x: number; y: number; rank: number }[]) {
    const taken: { x: number; y: number }[] = []
    return points.map((point) => {
        const free =
            OFFSETS.find(([dx, dy]) => {
                const lx = point.x + dx
                const ly = point.y + dy - 4
                return (
                    !points.some((other) => other !== point && Math.hypot(other.x - lx, other.y - ly) < 11)
                    && !taken.some((t) => Math.hypot(t.x - lx, t.y - ly) < 13)
                )
            }) ?? OFFSETS[0]
        taken.push({ x: point.x + free[0], y: point.y + free[1] - 4 })
        return { ...point, dx: free[0], dy: free[1] }
    })
}

// An index to the sheets: where each spot lies, numbered to match the gazetteer.
export default function IndexMap(props: { spots: (LabSpot & { day?: DaySummary })[] }) {
    let holder!: HTMLDivElement
    const width = useWidth(() => holder)

    const plot = createMemo(() => {
        const W = width()
        const lats = props.spots.map((s) => s.lat)
        const lons = props.spots.map((s) => s.lon)
        const midLat = (Math.min(...lats) + Math.max(...lats)) / 2
        const stretch = Math.cos((midLat * Math.PI) / 180)
        const latSpan = Math.max(Math.max(...lats) - Math.min(...lats), 0.3)
        const lonSpan = Math.max(Math.max(...lons) - Math.min(...lons), 0.3 / stretch)
        const midLon = (Math.min(...lons) + Math.max(...lons)) / 2
        const perDegree = Math.min((W - PAD * 2) / (lonSpan * stretch), (HEIGHT - PAD * 2) / latSpan)
        const x = (lon: number) => W / 2 + (lon - midLon) * stretch * perDegree
        const y = (lat: number) => HEIGHT / 2 - (lat - midLat) * perDegree
        const halfLon = W / 2 / (stretch * perDegree)
        const halfLat = HEIGHT / 2 / perDegree
        const stepLon = niceStep(halfLon * 2)
        const stepLat = niceStep(halfLat * 2)
        const range = (from: number, to: number, step: number) => {
            const out: number[] = []
            for (let v = Math.ceil(from / step) * step; v <= to; v += step) {
                out.push(Math.round(v * 100) / 100)
            }
            return out
        }
        return {
            W,
            meridians: range(midLon - halfLon, midLon + halfLon, stepLon)
                .map((lon) => ({ x: x(lon), label: dm(lon, "E", "W") }))
                .filter((m) => m.x > 44 && m.x < W - 30),
            parallels: range(midLat - halfLat, midLat + halfLat, stepLat)
                .map((lat) => ({ y: y(lat), label: dm(lat, "N", "S") }))
                .filter((p) => p.y > 18 && p.y < HEIGHT - 24),
            points: placed(props.spots.map((spot, i) => ({ x: x(spot.lon), y: y(spot.lat), rank: i + 1 }))),
        }
    })

    return (
        <section class="rl-index" aria-label="Where your spots lie" ref={holder}>
            <h2 class="rl-legend-title">Index to the sheets</h2>
            <Show when={width() > 0}>
                <svg
                    width={plot().W}
                    height={HEIGHT}
                    viewBox={`0 0 ${plot().W} ${HEIGHT}`}
                    role="img"
                    aria-label={`Map of ${props.spots.length} spots, numbered as in the list.`}
                >
                    <rect class="rl-index-frame" x="0.5" y="0.5" width={plot().W - 1} height={HEIGHT - 1} />
                    <For each={plot().meridians}>
                        {(m) => (
                            <>
                                <line class="rl-index-grid" x1={m.x} x2={m.x} y1="0" y2={HEIGHT} />
                                <text class="rl-index-coord" x={m.x + 3} y={HEIGHT - 5}>
                                    {m.label}
                                </text>
                            </>
                        )}
                    </For>
                    <For each={plot().parallels}>
                        {(p) => (
                            <>
                                <line class="rl-index-grid" x1="0" x2={plot().W} y1={p.y} y2={p.y} />
                                <text class="rl-index-coord" x="4" y={p.y - 3}>
                                    {p.label}
                                </text>
                            </>
                        )}
                    </For>
                    <For each={plot().points}>
                        {(point) => (
                            <g transform={`translate(${point.x} ${point.y})`}>
                                <path class="rl-index-mark" d="M0-7L6 4H-6z" />
                                <text class="rl-index-rank" x={point.dx} y={point.dy} text-anchor="middle">
                                    {point.rank}
                                </text>
                            </g>
                        )}
                    </For>
                </svg>
            </Show>
        </section>
    )
}
