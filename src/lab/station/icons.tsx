import { Match, Switch } from "solid-js"

// One set of segment pictograms on a 32-unit grid, in one ink. Where two shapes overlap, the front one
// is cut out of the back one with the local ground color (--ws-gap), the way LCD segments never touch.

export type Glyph = "sun" | "moon" | "partly-sun" | "partly-moon" | "cloud" | "rain" | "snow" | "storm" | "fog" | "haze"

export function glyphFor(forecast: string, isDaytime = true): Glyph {
    const text = forecast.toLowerCase()
    if (/thunder|t-?storm/.test(text)) {
        return "storm"
    }
    if (/snow|sleet|flurries|blizzard|wintry|ice/.test(text)) {
        return "snow"
    }
    if (/rain|shower|drizzle/.test(text)) {
        return "rain"
    }
    if (/haze|smoke|dust/.test(text)) {
        return "haze"
    }
    if (/fog|mist/.test(text)) {
        return "fog"
    }
    if (/partly|mostly sunny|mostly clear/.test(text)) {
        return isDaytime ? "partly-sun" : "partly-moon"
    }
    if (/cloudy|overcast/.test(text)) {
        return "cloud"
    }
    return isDaytime ? "sun" : "moon"
}

const rays = [0, 45, 90, 135, 180, 225, 270, 315]

function Sun(props: { cx: number; cy: number; r: number; ray: [number, number]; skip?: number[] }) {
    return (
        <g>
            <circle cx={props.cx} cy={props.cy} r={props.r} />
            {rays
                .filter((a) => !props.skip?.includes(a))
                .map((a) => (
                    <rect
                        x={props.cx - 1.3}
                        y={props.cy - props.ray[1]}
                        width="2.6"
                        height={props.ray[1] - props.ray[0]}
                        rx="1"
                        transform={`rotate(${a} ${props.cx} ${props.cy})`}
                    />
                ))}
        </g>
    )
}

// Circles of the crescent: outer (16,16) r11, inner (22,11) r9, meeting at the two points below.
const moonPath = "M15.27 5.03A11 11 0 1 0 26.66 18.7A9 9 0 0 1 15.27 5.03Z"

function Cloud(props: { y: number; x?: number; scale?: number }) {
    const parts = () => {
        const s = props.scale ?? 1
        const x = props.x ?? 0
        const y = props.y
        return [
            { cx: x + 11 * s, cy: y + 10 * s, r: 5 * s },
            { cx: x + 17.5 * s, cy: y + 6 * s, r: 6.5 * s },
            { cx: x + 24 * s, cy: y + 10 * s, r: 5 * s },
        ]
    }
    const base = () => {
        const s = props.scale ?? 1
        const x = props.x ?? 0
        return { x: x + 11 * s, y: props.y + 10 * s, width: 13 * s, height: 5 * s }
    }
    return (
        <g>
            <g class="ws-gap">
                {parts().map((c) => (
                    <circle cx={c.cx} cy={c.cy} r={c.r} />
                ))}
                <rect {...base()} />
            </g>
            {parts().map((c) => (
                <circle cx={c.cx} cy={c.cy} r={c.r} />
            ))}
            <rect {...base()} />
        </g>
    )
}

function Flake(props: { x: number; y: number; r: number }) {
    return (
        <g class="ws-stroke" stroke-width="2">
            {[0, 60, 120].map((a) => (
                <line
                    x1={props.x}
                    y1={props.y - props.r}
                    x2={props.x}
                    y2={props.y + props.r}
                    transform={`rotate(${a} ${props.x} ${props.y})`}
                />
            ))}
        </g>
    )
}

export function Icon(props: { glyph: Glyph; class?: string }) {
    return (
        <svg class={`ws-icon ${props.class ?? ""}`} viewBox="0 0 32 32" aria-hidden="true">
            <Switch>
                <Match when={props.glyph === "sun"}>
                    <Sun cx={16} cy={16} r={6} ray={[9.5, 14.5]} />
                </Match>
                <Match when={props.glyph === "moon"}>
                    <path d={moonPath} />
                </Match>
                <Match when={props.glyph === "partly-sun"}>
                    <Sun cx={11.5} cy={11.5} r={4.6} ray={[7.2, 10.6]} skip={[135, 90, 180]} />
                    <Cloud y={12} x={1} />
                </Match>
                <Match when={props.glyph === "partly-moon"}>
                    <path d={moonPath} transform="translate(0.5 0.5) scale(0.62)" />
                    <Cloud y={12} x={1} />
                </Match>
                <Match when={props.glyph === "cloud"}>
                    <Cloud y={8} />
                </Match>
                <Match when={props.glyph === "rain"}>
                    <Cloud y={3} />
                    <g class="ws-stroke" stroke-width="2.6">
                        <line x1="11.5" y1="22" x2="9.5" y2="28" />
                        <line x1="18" y1="22" x2="16" y2="28" />
                        <line x1="24.5" y1="22" x2="22.5" y2="28" />
                    </g>
                </Match>
                <Match when={props.glyph === "snow"}>
                    <Cloud y={2} />
                    <Flake x={11} y={26} r={4.2} />
                    <Flake x={23.5} y={26} r={4.2} />
                </Match>
                <Match when={props.glyph === "storm"}>
                    <Cloud y={3} />
                    <path d="M18.6 20.5 12.6 27.4H16.6L14.2 31.6 21.4 24.2H17.4L19.8 20.5Z" />
                </Match>
                <Match when={props.glyph === "fog"}>
                    <rect x="4" y="9" width="22" height="2.8" rx="1.4" />
                    <rect x="7" y="15" width="22" height="2.8" rx="1.4" />
                    <rect x="4" y="21" width="22" height="2.8" rx="1.4" />
                </Match>
                <Match when={props.glyph === "haze"}>
                    <Sun cx={16} cy={13} r={5} ray={[8, 11.5]} skip={[90, 135, 180, 225, 270]} />
                    <rect x="4" y="21" width="24" height="2.8" rx="1.4" />
                    <rect x="8" y="26.5" width="20" height="2.8" rx="1.4" />
                </Match>
            </Switch>
        </svg>
    )
}

export function Cat() {
    return (
        <svg class="ws-icon ws-cat" viewBox="0 0 32 32" aria-hidden="true">
            <path d="M5 15 6.5 3.5 13.5 9.5H18.5L25.5 3.5 27 15C27 23 22 27.5 16 27.5S5 23 5 15Z" />
            <g class="ws-gap-fill">
                <rect x="10.4" y="15" width="2.6" height="4.4" rx="1.3" />
                <rect x="19" y="15" width="2.6" height="4.4" rx="1.3" />
                <path d="M14.4 21.6H17.6L16 23.4Z" />
            </g>
        </svg>
    )
}

const starPath = "M16 3.5 19.6 11.3 28 12.2 21.7 17.9 23.5 26.2 16 21.9 8.5 26.2 10.3 17.9 4 12.2 12.4 11.3Z"

export function Star(props: { filled: boolean }) {
    return (
        <svg class="ws-icon ws-star" viewBox="0 0 32 32" aria-hidden="true">
            <path d={starPath} class={props.filled ? undefined : "ws-outline"} />
        </svg>
    )
}

// The LCD's own pointer: the small triangle a display lights beside the selected line.
export function Pointer() {
    return (
        <svg class="ws-icon ws-pointer" viewBox="0 0 32 32" aria-hidden="true">
            <path d="M8 5 26 16 8 27Z" />
        </svg>
    )
}

export function Chevron(props: { back?: boolean }) {
    return (
        <svg class="ws-icon ws-chev" viewBox="0 0 32 32" aria-hidden="true">
            <path d={props.back ? "M20 6 10 16 20 26" : "M12 6 22 16 12 26"} class="ws-outline" />
        </svg>
    )
}
