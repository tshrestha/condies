import { createSignal, For, onCleanup } from "solid-js"

import { PauseIcon, PlayIcon } from "../design/icons.tsx"
import { readout, spokenReadout } from "./radar.ts"
import type { RadarState } from "./radarFrames.ts"

// The radar loop's control, under the Radar switch: a play/pause disc and a tape of hard ink segments, one per
// frame. A bare segment hasn't loaded, a faint one has, the solid one is on screen, and a gap is a frame NOAA
// couldn't send. Under the tape, the frame's time and age. The tape is a slider: tap or drag it, or step it with
// the arrow keys, to pause on a frame.
export function RadarTape(props: {
    state: RadarState
    onPlay: () => void
    onPause: () => void
    onSeek: (index: number) => void
}) {
    // Ages tick over while the tape sits still.
    const [now, setNow] = createSignal(Date.now())
    const timer = setInterval(() => setNow(Date.now()), 30_000)
    onCleanup(() => clearInterval(timer))

    const scan = () => props.state.scans[props.state.index]
    const last = () => props.state.scans.length - 1
    const isLatest = () => props.state.index === last()
    const text = () => {
        const s = scan()
        return s ? readout(s, isLatest(), now()) : "Latest scan"
    }
    const spoken = () => {
        const s = scan()
        return s ? spokenReadout(s, isLatest(), now()) : "Latest scan"
    }

    let tape!: HTMLDivElement
    const indexAt = (x: number) => {
        const box = tape.getBoundingClientRect()
        return Math.max(0, Math.min(last(), Math.floor(((x - box.left) / box.width) * (last() + 1))))
    }

    const onKeyDown = (e: KeyboardEvent) => {
        // From the frame asked for, so quick presses add up while frames are still loading.
        const from = props.state.selected
        const to = {
            ArrowLeft: from - 1,
            ArrowDown: from - 1,
            ArrowRight: from + 1,
            ArrowUp: from + 1,
            Home: 0,
            End: last(),
        }[e.key]
        if (to !== undefined && props.state.available) {
            e.preventDefault()
            props.onSeek(Math.max(0, Math.min(last(), to)))
        }
    }

    const onPointerDown = (e: PointerEvent) => {
        if (!props.state.available) {
            return
        }
        ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
        props.onSeek(indexAt(e.clientX))
    }

    const onPointerMove = (e: PointerEvent) => {
        if ((e.currentTarget as HTMLElement).hasPointerCapture(e.pointerId)) {
            const to = indexAt(e.clientX)
            if (to !== props.state.selected) {
                props.onSeek(to)
            }
        }
    }

    return (
        <div class="sq-glass sq-tape">
            <button
                type="button"
                class="sq-tape-play"
                aria-label={props.state.playing ? "Pause" : "Play"}
                disabled={!props.state.available}
                onClick={() => (props.state.playing ? props.onPause() : props.onPlay())}
            >
                {props.state.playing ? <PauseIcon /> : <PlayIcon />}
            </button>
            <div
                class="sq-tape-track"
                role="slider"
                tabindex={props.state.available ? 0 : -1}
                aria-label="Radar time"
                aria-valuemin={0}
                aria-valuemax={last()}
                aria-valuenow={props.state.index}
                aria-valuetext={spoken()}
                aria-disabled={props.state.available ? undefined : "true"}
                onKeyDown={onKeyDown}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
            >
                <div class="sq-tape-segments" ref={tape}>
                    <For each={props.state.segments}>
                        {(segment, i) => (
                            <span
                                class="sq-tape-segment"
                                data-state={segment}
                                data-current={i() === props.state.index ? "" : undefined}
                            />
                        )}
                    </For>
                </div>
                <span class="sq-small sq-tape-time">{text()}</span>
            </div>
        </div>
    )
}
