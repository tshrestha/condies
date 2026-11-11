import { createSignal, For, type ParentProps, Show } from "solid-js"

import { type Paint, paintTemp, paintVars, rampSteps, type Theme } from "./ramp.ts"
import { grade, scoreHelp } from "./words.ts"

// The one treatment of the Condies score, the same on Best day, the Day screen and My Spots. It is labeled,
// out of 100, graded in a word and drawn as an ink meter, so it can never be read as a temperature. Tapping it
// explains it. It is one line: label, meter, value.
export function Score(props: { score?: number }) {
    const [open, setOpen] = createSignal(false)
    return (
        <Show when={props.score !== undefined}>
            <button
                type="button"
                class="sq-score"
                aria-expanded={open() ? "true" : "false"}
                onClick={() => setOpen(!open())}
            >
                {/* The spaces between the parts are for the button's name, which is its visible text. The grid
                    doesn't lay them out. */}
                <span class="sq-score-label">Condies score</span>{" "}
                <span class="sq-meter" aria-hidden="true">
                    <i style={{ width: `${props.score}%` }} />
                </span>{" "}
                <span class="sq-score-value">
                    <strong>{props.score}</strong>/100 <strong>{grade(props.score!)}</strong>
                </span>
            </button>
            <Show when={open()}>
                <p class="sq-score-help">{scoreHelp}</p>
            </Show>
        </Show>
    )
}

export type Tone = "extreme" | "severe" | "avalanche" | "quiet"

// One component for every warning, set like a printed notice rather than a banner: framed plates inside the
// margins. Extreme has the heaviest frame and the largest type, Severe a lighter frame, avalanche danger
// carries its standard color as a chip, and Moderate and Minor are plain rows. All say how serious in words.
// A framed plate reads as a button on its own; a plain row gets an arrow so it does too.
export function AlertRow(props: { tone: Tone; title: string; note: string; chip?: Paint; onOpen: () => void }) {
    return (
        <button type="button" class="sq-alert" data-tone={props.tone} onClick={() => props.onOpen()}>
            <span class="sq-alert-title">
                <Show when={props.chip}>
                    {(chip) => <i class="sq-avy-chip" style={{ background: chip().bg }} aria-hidden="true" />}
                </Show>
                {props.title}
            </span>
            <span class="sq-alert-note">
                {props.note}
                <Show when={props.tone === "quiet"}>
                    <span aria-hidden="true">→</span>
                </Show>
            </span>
        </button>
    )
}

// Low on the left, high on the right, on one scale shared by the whole week, so warm days sit to the right.
// The bar is made of the ramp's own 5° steps, so its color comes from the data. A day missing one end shows a
// short mark at the end it has.
export function RangeBar(props: { low?: number; high?: number; min: number; max: number; theme: Theme }) {
    const span = () => props.max - props.min || 1
    const at = (t: number) => `${((t - props.min) / span()) * 100}%`
    const segments = () => {
        const low = props.low ?? props.high!
        const high = props.high ?? props.low!
        return low < high ? rampSteps(low, high, props.theme) : []
    }
    const only = () => (props.low === undefined || props.high === undefined ? (props.high ?? props.low) : undefined)
    return (
        <span class="sq-range" aria-hidden="true">
            <For each={segments()}>
                {(s) => (
                    <i style={{ left: at(s.from), width: `calc(${at(s.to)} - ${at(s.from)})`, background: s.bg }} />
                )}
            </For>
            <Show when={only() !== undefined}>
                <i
                    class="sq-range-tick"
                    style={{ left: at(only()!), background: paintTemp(only()!, props.theme).bg }}
                />
            </Show>
        </span>
    )
}

// A full-screen sheet: a modal <dialog> that opens as soon as it's on the page. Closing it, by the button, Esc
// or the platform's back gesture, calls onClose so the owner can take it off the page.
export function Sheet(props: ParentProps<{ label: string; onClose: () => void; paint?: Paint; title?: string }>) {
    let dialog!: HTMLDialogElement
    const mount = (el: HTMLDialogElement) => {
        dialog = el
        queueMicrotask(() => {
            if (el.isConnected && !el.open) {
                el.showModal()
            }
        })
    }
    return (
        <dialog ref={mount} class="sq-sheet" aria-label={props.label} onClose={props.onClose}>
            <div class="sq-sheet-bar" style={props.paint ? paintVars(props.paint) : undefined}>
                <span class="sq-strong">{props.title}</span>
                <button type="button" class="sq-close" onClick={() => dialog.close()}>
                    Close
                </button>
            </div>
            {props.children}
        </dialog>
    )
}
