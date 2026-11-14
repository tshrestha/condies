import type { JSX } from "@solidjs/web"

import type { Weather } from "./words.ts"

// Two families on one 24px grid with 2px strokes and round joins. Control icons are in the ink of whatever they
// sit on, and filled means on. Weather icons stand for a forecast's condition and are in color.

// The "Right meow" cat, the app's one drawing, which also stands for Now in the dock.
export function Cat() {
    return (
        <svg class="sq-cat" viewBox="0 0 20 20" aria-hidden="true">
            <path d="M3 1l3 4h5l3-4v8l-1 2 2 6h2v-4h2v6H3l2-8-2-2z" />
        </svg>
    )
}

export function SearchIcon() {
    return (
        <svg class="sq-icon" viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="10.5" cy="10.5" r="6.5" />
            <path d="M15.5 15.5 21 21" />
        </svg>
    )
}

// The same star saves a place in the swatch and stands for My Spots in the dock.
export function StarIcon(props: { filled?: boolean }) {
    return (
        <svg class={props.filled ? "sq-icon sq-icon-filled" : "sq-icon"} viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 3l2.35 6.26 6.69.3-5.24 4.18 1.78 6.45L12 16.5l-5.58 3.69 1.78-6.45-5.24-4.18 6.69-.3z" />
        </svg>
    )
}

export function MapIcon() {
    return (
        <svg class="sq-icon" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2zM9 4v14M15 6v14" />
        </svg>
    )
}

// A radar scope: two rings and the sweep. The map's radar switch.
export function RadarIcon() {
    return (
        <svg class="sq-icon" viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="12" cy="12" r="9" />
            <circle cx="12" cy="12" r="4.5" />
            <path d="M12 12l6.4-6.4" />
        </svg>
    )
}

// Weather, in color: each part is a bright fill inside a darker edge of its own hue, so the edge reads on the
// ground in either theme. On a temperature swatch the same drawings are in ink, since the swatch's color is the
// temperature. The colors are tokens in tokens.css. More marks under a cloud means more of it: two for light,
// three, then heavy.

const Cloud = () => <path class="sq-wx-cloud" d="M7 18H17a4 4 0 0 0 1.1-7.85A5.62 5.62 0 0 0 6.9 10 4 4 0 0 0 7 18Z" />

// Higher and flatter, with room under it for what falls.
const HighCloud = () => (
    <path class="sq-wx-cloud" d="M7 13H17.5a3 3 0 1 0-.6-5.94A4.5 4.5 0 0 0 8.1 7.2 3 3 0 1 0 7 13Z" />
)

// Low on the left, in front of the sun or moon.
const LowCloud = () => (
    <path class="sq-wx-cloud" d="M6 20H13.5a3.5 3.5 0 0 0 1-6.85A4.5 4.5 0 0 0 5.5 13.04 3.5 3.5 0 0 0 6 20Z" />
)

const Flakes = (props: { at: [number, number][] }) => (
    <>
        {props.at.map(([x, y]) => (
            <circle class="sq-wx-snow" cx={x} cy={y} r="0.75" />
        ))}
    </>
)

const drawings: Record<Weather, () => JSX.Element> = {
    sun: () => (
        <>
            <circle class="sq-wx-sun" cx="12" cy="12" r="4" />
            <path
                class="sq-wx-rays"
                d="M12 2.5V4M12 20v1.5M2.5 12H4M20 12h1.5M5.28 5.28l1.06 1.06M17.66 17.66l1.06 1.06M5.28 18.72l1.06-1.06M17.66 6.34l1.06-1.06"
            />
        </>
    ),
    moon: () => <path class="sq-wx-moon" d="M19.5 13.2A7.5 7.5 0 1 1 10.8 4.5a6.5 6.5 0 0 0 8.7 8.7Z" />,
    "partly-day": () => (
        <>
            <circle class="sq-wx-sun" cx="16.5" cy="7.5" r="3" />
            <path class="sq-wx-rays" d="M16.5 1v1M23 7.5h-1M20.4 3.6l.7-.7M12.6 3.6l-.7-.7M20.4 11.4l.7.7" />
            <LowCloud />
        </>
    ),
    "partly-night": () => (
        <>
            <path class="sq-wx-moon" d="M22 7.72A4.5 4.5 0 1 1 16.78 2.5a3.9 3.9 0 0 0 5.22 5.22Z" />
            <LowCloud />
        </>
    ),
    cloud: () => <Cloud />,
    "rain-light": () => (
        <>
            <HighCloud />
            <path class="sq-wx-rain" d="M9.5 16.5l-1.5 4M15 16.5l-1.5 4" />
        </>
    ),
    rain: () => (
        <>
            <HighCloud />
            <path class="sq-wx-rain" d="M8 16.5l-1.5 4M12.5 16.5l-1.5 4M17 16.5l-1.5 4" />
        </>
    ),
    "rain-heavy": () => (
        <>
            <HighCloud />
            <path class="sq-wx-rain" d="M6.5 16l-2.2 6M10.5 16l-2.2 6M14.5 16l-2.2 6M18.5 16l-2.2 6" />
        </>
    ),
    "snow-light": () => (
        <>
            <HighCloud />
            <Flakes
                at={[
                    [9, 17.5],
                    [15, 20],
                ]}
            />
        </>
    ),
    snow: () => (
        <>
            <HighCloud />
            <Flakes
                at={[
                    [7, 17.5],
                    [12, 20.5],
                    [17, 17.5],
                ]}
            />
        </>
    ),
    "snow-heavy": () => (
        <>
            <HighCloud />
            <Flakes
                at={[
                    [6.5, 16.75],
                    [12, 16.75],
                    [17.5, 16.75],
                    [9.25, 21],
                    [14.75, 21],
                ]}
            />
        </>
    ),
    storms: () => (
        <>
            <HighCloud />
            <path class="sq-wx-bolt" d="M13 14.5L9.5 19h3L11 23l4.5-5.5h-3l1.5-3Z" />
        </>
    ),
    fog: () => (
        <>
            <HighCloud />
            <path class="sq-wx-mist" d="M4 17h16M7 21h10" />
        </>
    ),
    // Smoke, haze and dust: the sun over a thick layer.
    haze: () => (
        <>
            <circle class="sq-wx-sun" cx="12" cy="9" r="3.5" />
            <path class="sq-wx-rays" d="M12 1.5v1M5 9H4M20 9h-1M6.7 3.7l.7.7M17.3 3.7l-.7.7" />
            <path class="sq-wx-mist" d="M3 16.5h18M6 20.5h12" />
        </>
    ),
    wind: () => <path class="sq-wx-mist" d="M3 8h9.5a2.75 2.75 0 1 0-2.75-2.75M3 13h15a3 3 0 1 1-3 3M3 18h6" />,
}

// Always beside its condition in words, printed or for screen readers only, so the picture itself is hidden
// from them.
export function WeatherIcon(props: { kind: Weather }) {
    return (
        <svg class="sq-wx" viewBox="0 0 24 24" aria-hidden="true">
            {drawings[props.kind]()}
        </svg>
    )
}
