import { For, Show } from "solid-js"

import { Sheet } from "../design/parts.tsx"
import { avalancheScale, paintVars } from "../design/ramp.ts"
import { isLoud, sentence } from "../design/words.ts"
import type { AlertView } from "../lib/forecastView.ts"
import type { Avalanche } from "./sections.tsx"

export function AlertSheet(props: { alert: AlertView; onClose: () => void }) {
    // The detail reads like the notice it opened from: framed, heavier for Extreme, plain for the quieter ones.
    const tone = () => (props.alert.severity === "Extreme" ? "extreme" : isLoud(props.alert) ? "severe" : "quiet")
    return (
        <Sheet label={props.alert.event} onClose={props.onClose} title={props.alert.severity}>
            <div class="sq-sheet-head" data-tone={tone()}>
                <h2 class="sq-num">{props.alert.event}</h2>
                <p>{props.alert.headline}</p>
            </div>
            <div class="sq-sheet-body">
                <dl class="sq-parts">
                    <For each={props.alert.parts}>
                        {(part) => (
                            <div>
                                <Show when={part.label}>
                                    <dt class="sq-strong">{sentence(part.label)}</dt>
                                </Show>
                                <dd>{part.text}</dd>
                            </div>
                        )}
                    </For>
                </dl>
                <Show when={props.alert.instruction}>
                    <p class="sq-strong">{props.alert.instruction}</p>
                </Show>
            </div>
        </Sheet>
    )
}

export function AvalancheSheet(props: { avalanche: Avalanche; onClose: () => void }) {
    const rating = () => props.avalanche.rating!
    const paint = () => avalancheScale[rating().level]
    return (
        <Sheet label="Avalanche danger" onClose={props.onClose} paint={paint()} title="Avalanche danger">
            <div class="sq-sheet-head" style={paintVars(paint())}>
                <h2 class="sq-num">{rating().name}</h2>
                <p>
                    Level {rating().level} of 5.
                    {rating().warning ? ` Avalanche ${rating().warning} in effect.` : ""}
                </p>
            </div>
            <div class="sq-sheet-body">
                <p>{rating().advice}</p>
                <p>Varies by slope and elevation.</p>
                <a class="sq-link" href={props.avalanche.link} target="_blank" rel="noreferrer">
                    {props.avalanche.center}
                </a>
            </div>
        </Sheet>
    )
}
