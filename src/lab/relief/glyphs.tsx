import { For, Show } from "solid-js"
import type { JSX } from "@solidjs/web"

import { barbPath, glyph, type WxKind } from "./wx.ts"

function Line(props: { size?: number; label?: string; children: JSX.Element; class?: string }) {
    return (
        <svg
            class={`rl-icon ${props.class ?? ""}`}
            width={props.size ?? 22}
            height={props.size ?? 22}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.7"
            stroke-linecap="round"
            stroke-linejoin="round"
            role={props.label ? "img" : undefined}
            aria-label={props.label}
            aria-hidden={props.label ? undefined : "true"}
        >
            {props.children}
        </svg>
    )
}

export const StarIcon = (props: { filled: boolean }) => (
    <Line>
        <path
            d="M12 3.4l2.65 5.5 6 .85-4.35 4.25 1.04 6-5.34-2.86L6.66 20l1.04-6L3.35 9.75l6-.85z"
            fill={props.filled ? "currentColor" : "none"}
        />
    </Line>
)

export const SearchIcon = () => (
    <Line>
        <circle cx="10.5" cy="10.5" r="6.5" />
        <path d="M15.4 15.4L21 21M10.5 7.5v6M7.5 10.5h6" />
    </Line>
)

// A quadrangle sheet with its graticule.
export const MapIcon = () => (
    <Line>
        <path d="M3.5 5.5h17v13h-17zM3.5 12h17M12 5.5v13M7.75 5.5v1.6M16.25 5.5v1.6M7.75 16.9v1.6M16.25 16.9v1.6" />
    </Line>
)

// A gazetteer entry: a triangulation mark and its line of type.
export const SpotsIcon = () => (
    <Line>
        <path d="M6.5 4.5l3 5.2h-6zM13 7h8M3.5 13.5h17M3.5 19h17" />
    </Line>
)

export const ThemeIcon = () => (
    <Line>
        <circle cx="12" cy="12" r="8.2" />
        <path d="M12 3.8a8.2 8.2 0 010 16.4z" fill="currentColor" />
    </Line>
)

export const RefreshIcon = () => (
    <Line size={16}>
        <path d="M19.5 12a7.5 7.5 0 11-2.4-5.5M19.5 3v4.4h-4.4" />
    </Line>
)

export const BackIcon = () => (
    <Line size={18}>
        <path d="M14.5 5l-7 7 7 7" />
    </Line>
)

export const ForwardIcon = () => (
    <Line size={18}>
        <path d="M9.5 5l7 7-7 7" />
    </Line>
)

export const LeaveIcon = () => (
    <Line size={14}>
        <path d="M7 17L18 6M9 6h9v9" />
    </Line>
)

export const CloseIcon = () => (
    <Line>
        <path d="M5.5 5.5l13 13M18.5 5.5l-13 13" />
    </Line>
)

// The cat, as it would be drawn on a survey: a point symbol with a pair of summits for ears.
export const CatMark = () => (
    <Line size={24} class="rl-cat">
        <path d="M5 21V9.2L7.6 3.8l3.3 3.7h2.2l3.3-3.7L19 9.2V21" />
        <path d="M9.1 12.6v.01M14.9 12.6v.01" stroke-width="2.6" />
        <path d="M12 15.1l-.9 1h1.8zM3 14.8l5.3 1.1M3 18.4l5.3-.9M21 14.8l-5.3 1.1M21 18.4l-5.3-.9" />
    </Line>
)

export const SunriseMark = (props: { set?: boolean }) => (
    <Line size={22}>
        <path d="M3 18h18M7 18a5 5 0 0110 0" />
        <path d={props.set ? "M12 4v6M9.5 7.8L12 10.2l2.5-2.4" : "M12 10V4M9.5 6.2L12 3.8l2.5 2.4"} />
    </Line>
)

export const WarningMark = (props: { filled?: boolean; size?: number }) => (
    <svg class="rl-icon" width={props.size ?? 20} height={props.size ?? 20} viewBox="0 0 24 24" aria-hidden="true">
        <path
            d="M12 3.2L22 20.5H2z"
            fill={props.filled ? "currentColor" : "none"}
            stroke="currentColor"
            stroke-width="2"
            stroke-linejoin="round"
        />
        <path
            d="M12 9.6v5M12 17.4v.2"
            fill="none"
            stroke={props.filled ? "var(--rl-warn-cut, var(--rl-hazard-on))" : "currentColor"}
            stroke-width="2.4"
            stroke-linecap="round"
        />
    </svg>
)

// The station-model circle. Blacked in by oktas, the way a synoptic plot records sky cover.
export function SkyCircle(props: { percent: number; size?: number }) {
    const quarters = () => Math.round((props.percent / 100) * 4)
    const wedge = () => {
        const q = quarters()
        if (q === 0) {
            return undefined
        }
        if (q === 4) {
            return "M12 3a9 9 0 110 18 9 9 0 010-18z"
        }
        const angle = (q / 4) * 2 * Math.PI
        const x = 12 + 9 * Math.sin(angle)
        const y = 12 - 9 * Math.cos(angle)
        return `M12 12V3A9 9 0 ${q > 2 ? 1 : 0} 1 ${x} ${y}Z`
    }
    return (
        <svg class="rl-icon" width={props.size ?? 20} height={props.size ?? 20} viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="1.8" />
            <Show when={wedge()}>{(d) => <path d={d()} fill="currentColor" />}</Show>
        </svg>
    )
}

export function WxMark(props: { kind: WxKind; size?: number; label?: string }) {
    const paths = () => glyph(props.kind, 12, 12, 7)
    return (
        <svg
            class="rl-icon"
            width={props.size ?? 20}
            height={props.size ?? 20}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-linecap="round"
            stroke-linejoin="round"
            role={props.label ? "img" : undefined}
            aria-label={props.label}
            aria-hidden={props.label ? undefined : "true"}
        >
            <path d={paths().lines} stroke-width="1.7" />
            <path d={paths().dots} stroke-width="5" />
        </svg>
    )
}

export function SkyOrWx(props: { kind: WxKind; percent: number; size?: number }) {
    return (
        <Show when={props.kind !== "none"} fallback={<SkyCircle percent={props.percent} size={props.size} />}>
            <WxMark kind={props.kind} size={props.size} />
        </Show>
    )
}

// The single treatment of the Condies score: a benchmark disc, inked solid when it's worth going.
export function Benchmark(props: { score: number; size?: number; solid?: boolean }) {
    const solid = () => props.solid ?? props.score >= 60
    return (
        <span
            class={`rl-bm ${solid() ? "rl-bm-solid" : ""}`}
            style={{ width: `${props.size ?? 36}px`, height: `${props.size ?? 36}px` }}
            role="img"
            aria-label={`Condies score ${props.score}`}
        >
            <svg viewBox="0 0 44 44" width="100%" height="100%" aria-hidden="true">
                <circle class="rl-bm-rim" cx="22" cy="23.2" r="19.2" />
                <circle class="rl-bm-ring" cx="22" cy="23.2" r="15.8" />
                <path class="rl-bm-mark" d="M22 .8l4.6 8h-9.2z" />
                <text
                    class="rl-bm-num"
                    x="22"
                    y={props.score > 99 ? 28.4 : 29.2}
                    style={{ "font-size": props.score > 99 ? "14.5px" : "17.5px" }}
                    text-anchor="middle"
                >
                    {props.score}
                </text>
            </svg>
        </span>
    )
}

// A surface observation as a meteorologist plots it: sky circle, weather to its left, wind on a staff.
export function StationPlot(props: {
    percent: number
    kind: WxKind
    bearing: number
    knots: number
    calm: boolean
    size?: number
}) {
    const quarters = () => Math.round((props.percent / 100) * 4)
    const barb = () => barbPath(60, 60, props.bearing, props.knots, 44)
    const wedge = () => {
        const q = quarters()
        if (q === 0 || q === 4) {
            return undefined
        }
        const angle = (q / 4) * 2 * Math.PI
        const x = 60 + 14 * Math.sin(angle)
        const y = 60 - 14 * Math.cos(angle)
        return `M60 60V46A14 14 0 ${q > 2 ? 1 : 0} 1 ${x} ${y}Z`
    }
    const present = () => glyph(props.kind, 26, 60, 9)
    return (
        <svg
            class="rl-station"
            width={props.size ?? 120}
            height={props.size ?? 120}
            viewBox="0 0 120 120"
            fill="none"
            stroke="currentColor"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
        >
            <Show when={!props.calm}>
                <path d={barb().lines} stroke-width="2.4" />
                <path d={barb().pennants} fill="currentColor" stroke="none" />
            </Show>
            <circle cx="60" cy="60" r="14" fill="var(--rl-ground)" stroke-width="2.4" />
            <Show when={props.calm}>
                <circle cx="60" cy="60" r="20" stroke-width="1.6" />
            </Show>
            <Show when={quarters() === 4}>
                <circle cx="60" cy="60" r="14" fill="currentColor" stroke="none" />
            </Show>
            <Show when={wedge()}>{(d) => <path d={d()} fill="currentColor" stroke="none" />}</Show>
            <path d={present().lines} stroke-width="2.2" />
            <path d={present().dots} stroke-width="6.5" />
        </svg>
    )
}

// B612 Mono gives punctuation a full cell, which pulls "6.4" and "7:18" apart without this.
const pinch: Record<string, string> = { ".": "rl-tight-dot", ":": "rl-tight-colon", ",": "rl-tight-comma" }

export function Num(props: { text: string; class?: string }) {
    const parts = () => props.text.split(/([.:,])/).filter(Boolean)
    return (
        <span class={`rl-num ${props.class ?? ""}`}>
            <For each={parts()}>{(part) => (pinch[part] ? <span class={pinch[part]}>{part}</span> : part)}</For>
        </span>
    )
}

export function TightSvg(props: { text: string }) {
    const parts = () => props.text.split(/([.:,])/).filter(Boolean)
    return (
        <For each={parts()}>
            {(part, i) => <tspan dx={i() > 0 && pinch[parts()[i() - 1]] ? "-0.24em" : undefined}>{part}</tspan>}
        </For>
    )
}
