import { createSignal, onCleanup } from "solid-js"

import { formatAge } from "./lib/util.ts"

// An installed app has no browser reload button, so this is also how to get a new forecast.
export default function LastUpdated(props: { time: string }) {
    const [now, setNow] = createSignal(Date.now())
    const timer = setInterval(() => setNow(Date.now()), 60_000)
    onCleanup(() => clearInterval(timer))

    return (
        <button type="button" class="last-updated" onClick={() => location.reload()}>
            <i class="bi bi-arrow-clockwise" /> Updated {formatAge(now() - Date.parse(props.time))}
            <span class="visually-hidden">. Refresh the forecast.</span>
        </button>
    )
}
