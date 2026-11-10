import { Match, Show, Switch } from "solid-js"
import type { ParentProps } from "solid-js"

import type { Symbol } from "./wx.ts"
import { symbolWord } from "./wx.ts"

export type Tone = "guide" | "warn" | "temp" | "reg" | "rec" | "svc"

// One panel: flat, rounded, with the inset border line that real signs carry.
export function Sign(props: ParentProps<{ tone: Tone; class?: string; label?: string }>) {
    return (
        <div class={`mm-sign ${props.class ?? ""}`} data-tone={props.tone} aria-label={props.label}>
            {props.children}
        </div>
    )
}

// The standard guide-sign arrow: a broad head on a shaft a third its width. Drawn pointing up, then turned.
export function Arrow(props: { dir: "up" | "upright" | "right" | "left" | "down"; class?: string }) {
    const turn = { up: 0, upright: 45, right: 90, down: 180, left: 270 }
    return (
        <svg class={`mm-arrow ${props.class ?? ""}`} viewBox="0 0 24 24" aria-hidden="true">
            <path
                transform={`rotate(${turn[props.dir]} 12 12)`}
                d="M12 1.5 22.5 12H15.6V22.5H8.4V12H1.5Z"
                fill="currentColor"
            />
        </svg>
    )
}

// The Condies score, always as this one plate: a regulatory panel that names its number.
export function Plate(props: { score?: number; size?: "m" | "s" }) {
    return (
        <Show when={props.score !== undefined}>
            <span
                class="mm-plate"
                data-size={props.size ?? "m"}
                role="img"
                aria-label={`Condies score ${props.score} out of 100`}
            >
                <span class="mm-plate-label" aria-hidden="true">
                    Condies
                </span>
                <span class="mm-plate-read" aria-hidden="true">
                    <span class="mm-plate-num">{props.score}</span>
                    <span class="mm-plate-of">of 100</span>
                </span>
            </span>
        </Show>
    )
}

const cloud = "M6.5 19.5a4.5 4.5 0 0 1-.6-9 6.2 6.2 0 0 1 11.9 1.6A3.75 3.75 0 0 1 17.6 19.5Z"
const smallCloud = "M6.8 14.5a3.9 3.9 0 0 1-.5-7.8 5.4 5.4 0 0 1 10.3 1.4A3.2 3.2 0 0 1 16.4 14.5Z"

// Weather symbols in the manner of sign symbols: solid, heavy, no outlines thinner than a stroke of legend.
export function Sym(props: { kind: Symbol; class?: string; label?: boolean }) {
    return (
        <svg
            class={`mm-sym ${props.class ?? ""}`}
            viewBox="0 0 24 24"
            role={props.label ? "img" : undefined}
            aria-label={props.label ? symbolWord[props.kind] : undefined}
            aria-hidden={props.label ? undefined : "true"}
        >
            <Switch>
                <Match when={props.kind === "sun"}>
                    <circle cx="12" cy="12" r="5" fill="currentColor" />
                    <g stroke="currentColor" stroke-width="2.4" stroke-linecap="round">
                        <path d="M12 1.8v2.6M12 19.6v2.6M1.8 12h2.6M19.6 12h2.6M4.8 4.8l1.8 1.8M17.4 17.4l1.8 1.8M4.8 19.2l1.8-1.8M17.4 6.6l1.8-1.8" />
                    </g>
                </Match>
                <Match when={props.kind === "moon"}>
                    <path d="M15.5 2.5A9.8 9.8 0 1 0 21.5 17 8 8 0 0 1 15.5 2.5Z" fill="currentColor" />
                </Match>
                <Match when={props.kind === "partly"}>
                    <circle cx="8.5" cy="8.5" r="4" fill="currentColor" />
                    <g stroke="currentColor" stroke-width="2.2" stroke-linecap="round">
                        <path d="M8.5 0.9v1.6M0.9 8.5h1.6M3.1 3.1l1.2 1.2M13.9 3.1l-1.2 1.2M3.1 13.9l1.2-1.2" />
                    </g>
                    <path
                        d="M9.5 21.5a4.2 4.2 0 0 1-.5-8.4 5.6 5.6 0 0 1 10.7 1.5A3.5 3.5 0 0 1 19.4 21.5Z"
                        fill="currentColor"
                        stroke="var(--mm-panel)"
                        stroke-width="2"
                        paint-order="stroke"
                    />
                </Match>
                <Match when={props.kind === "cloud"}>
                    <path d={cloud} fill="currentColor" />
                </Match>
                <Match when={props.kind === "rain"}>
                    <path d={smallCloud} fill="currentColor" />
                    <g stroke="currentColor" stroke-width="2.4" stroke-linecap="round">
                        <path d="M8 17.5l-1.2 4M12.5 17.5l-1.2 4M17 17.5l-1.2 4" />
                    </g>
                </Match>
                <Match when={props.kind === "snow"}>
                    <g stroke="currentColor" stroke-width="2.3" stroke-linecap="round" fill="none">
                        <path d="M12 1.5v21M2.9 6.75l18.2 10.5M2.9 17.25l18.2-10.5" />
                        <path d="M9 3.2 12 6l3-2.8M9 20.8 12 18l3 2.8M3.2 10.2 7 9 6.2 5M20.8 13.8 17 15l.8 4M3.2 13.8 7 15l-.8 4M20.8 10.2 17 9l.8-4" />
                    </g>
                </Match>
                <Match when={props.kind === "storm"}>
                    <path d={smallCloud} fill="currentColor" />
                    <path
                        d="M13.6 12.2 9.4 18.2h3.2l-1.4 5.3 5.4-7.3h-3.3l1.5-4Z"
                        fill="currentColor"
                        stroke="var(--mm-panel)"
                        stroke-width="1.6"
                        paint-order="stroke"
                        stroke-linejoin="round"
                    />
                </Match>
                <Match when={props.kind === "fog"}>
                    <path d="M7.2 11a3.6 3.6 0 0 1-.4-7.2 4.9 4.9 0 0 1 9.4 1.3A3 3 0 0 1 16 11Z" fill="currentColor" />
                    <g stroke="currentColor" stroke-width="2.3" stroke-linecap="round" fill="none">
                        <path d="M2.5 15.5c1.6-1.4 3.2-1.4 4.8 0s3.2 1.4 4.8 0 3.2-1.4 4.8 0 3.2 1.4 4.6 0" />
                        <path d="M4.5 20.5c1.6-1.4 3.2-1.4 4.8 0s3.2 1.4 4.8 0 3.2-1.4 4.8 0" />
                    </g>
                </Match>
                <Match when={props.kind === "haze"}>
                    <path d="M6.5 11.5a5.5 5.5 0 0 1 11 0Z" fill="currentColor" />
                    <g stroke="currentColor" stroke-width="2.3" stroke-linecap="round" fill="none">
                        <path d="M12 1.6v2.2M4.2 4.4l1.5 1.5M19.8 4.4l-1.5 1.5" />
                        <path d="M2.5 15.5c1.6-1.4 3.2-1.4 4.8 0s3.2 1.4 4.8 0 3.2-1.4 4.8 0 3.2 1.4 4.6 0" />
                        <path d="M4.5 20.5c1.6-1.4 3.2-1.4 4.8 0s3.2 1.4 4.8 0 3.2-1.4 4.8 0" />
                    </g>
                </Match>
            </Switch>
        </svg>
    )
}

// A sitting cat, drawn as a solid silhouette like the animals on crossing signs.
export function Cat(props: { class?: string }) {
    return (
        <svg class={`mm-cat ${props.class ?? ""}`} viewBox="0 0 24 24" aria-hidden="true">
            <g fill="currentColor">
                <path d="M11.2 6.4 11.6 1l3.1 2.9h1.6L19.4 1l.4 5.4A4.4 4.4 0 1 1 11.2 6.4Z" />
                <path d="M9.6 10.4c3.2-.9 6.6-.2 8.1 2.6 1.6 3 1.3 6.8.2 9.5H6.6c-.9-4.4-.1-10.5 3-12.1Z" />
            </g>
            <path
                d="M7.4 22.5H4.6a2.6 2.6 0 0 1-.4-5.2"
                fill="none"
                stroke="currentColor"
                stroke-width="2.2"
                stroke-linecap="round"
            />
        </svg>
    )
}

export function Star(props: { filled: boolean }) {
    return (
        <svg class="mm-icon" viewBox="0 0 24 24" aria-hidden="true">
            <path
                d="M12 2.2 14.9 8.6l7 .8-5.2 4.7 1.5 6.9L12 17.5 5.8 21l1.5-6.9L2.1 9.4l7-.8Z"
                fill={props.filled ? "currentColor" : "none"}
                stroke="currentColor"
                stroke-width="2.2"
                stroke-linejoin="round"
            />
        </svg>
    )
}

export function Icon(props: { name: "search" | "map" | "theme" | "refresh" | "close" }) {
    return (
        <svg class="mm-icon" viewBox="0 0 24 24" aria-hidden="true">
            <Switch>
                <Match when={props.name === "search"}>
                    <circle cx="10" cy="10" r="6.5" fill="none" stroke="currentColor" stroke-width="2.6" />
                    <path d="m15 15 6.5 6.5" stroke="currentColor" stroke-width="3" stroke-linecap="round" />
                </Match>
                <Match when={props.name === "map"}>
                    <path
                        d="M2.5 5.5 8.5 3l7 2.5 6-2.5v15.5l-6 2.5-7-2.5-6 2.5Z"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2.2"
                        stroke-linejoin="round"
                    />
                    <path d="M8.5 3v15.5M15.5 5.5V21" stroke="currentColor" stroke-width="2.2" />
                </Match>
                <Match when={props.name === "theme"}>
                    <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2.4" />
                    <path d="M12 3a9 9 0 0 1 0 18Z" fill="currentColor" />
                </Match>
                <Match when={props.name === "refresh"}>
                    <path
                        d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2.6"
                        stroke-linecap="round"
                    />
                    <path d="M20.8 2.8v6.6h-6.6Z" fill="currentColor" />
                </Match>
                <Match when={props.name === "close"}>
                    <path d="m5 5 14 14M19 5 5 19" stroke="currentColor" stroke-width="3" stroke-linecap="round" />
                </Match>
            </Switch>
        </svg>
    )
}

// The warning symbol used on the most severe alerts: a diamond warning sign in miniature.
export function Diamond() {
    return (
        <svg class="mm-diamond" viewBox="0 0 32 32" aria-hidden="true">
            <path d="M16 1.5 30.5 16 16 30.5 1.5 16Z" fill="currentColor" />
            <path d="M16 4.6 27.4 16 16 27.4 4.6 16Z" fill="var(--mm-panel)" />
            <path
                d="M14.3 8.8h3.4l-.6 9.6h-2.2ZM16 20.4a1.9 1.9 0 1 1 0 3.8 1.9 1.9 0 0 1 0-3.8Z"
                fill="currentColor"
            />
        </svg>
    )
}
