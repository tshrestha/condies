import { createSignal, untrack } from "solid-js"

import { isSpot, toggleSpot } from "./lib/spots.ts"

export default function SpotStar(props: { lat: string; lon: string; name: string }) {
    // Each mount shows one location, so the place is read once.
    const place = untrack(() => ({ lat: Number(props.lat), lon: Number(props.lon), name: props.name }))
    const [saved, setSaved] = createSignal(isSpot(place))

    return (
        <button
            type="button"
            class="sky-star"
            aria-label="Save to My Spots"
            aria-pressed={saved() ? "true" : "false"}
            onClick={() => setSaved(toggleSpot(place))}
        >
            <i class={saved() ? "bi bi-star-fill" : "bi bi-star"} />
        </button>
    )
}
