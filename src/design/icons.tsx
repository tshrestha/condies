// Icons are only for controls. Weather is always told in words. One drawing style: 24px, 2px strokes, round
// joins, in the ink of whatever they sit on. Filled means on.

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
