import { For } from "solid-js"

import { numeralFit } from "../design/words.ts"

// What a section looks like while it waits: its shape on the ground in the track color. The swatch is a plain
// block the size of the real one, and each line of text is a bar at that text's height. Nothing shimmers.

const fit = numeralFit("00°")

// A bar standing in for one line of text, as wide as the text usually runs.
export const Bar = (props: { width: string; class?: string }) => (
    <i class={`sq-ph-bar ${props.class ?? ""}`} style={{ width: props.width }} />
)

// The Now swatch keeps its real lines, invisible, so the block comes out the same size.
function NowPlaceholder() {
    return (
        <div class="sq-now sq-ph-swatch">
            <div class="sq-place-row">
                <p class="sq-place">Right meow</p>
            </div>
            <p class="sq-numeral" style={{ "--em": fit.em.toFixed(3), "--lsb": fit.lsb.toFixed(3) }}>
                00°
            </p>
            <p class="sq-cond">Cloudy</p>
            <p class="sq-now-line">Feels like</p>
            <div class="sq-age">Updated</div>
        </div>
    )
}

export function HomePlaceholder() {
    return (
        <div class="sq-home" role="status">
            <p class="sq-sr">Getting the forecast.</p>
            <div class="sq-split" aria-hidden="true">
                <div class="sq-lead">
                    <NowPlaceholder />
                </div>
                <div class="sq-rest">
                    <div class="sq-ground sq-next">
                        <p class="sq-caption">
                            <Bar width="62%" />
                        </p>
                        <ol class="sq-blocks">
                            <For each={[0, 1, 2]}>
                                {() => (
                                    <li class="sq-block">
                                        <span class="sq-num">
                                            <Bar width="64%" />
                                        </span>
                                        <Bar width="80%" />
                                    </li>
                                )}
                            </For>
                        </ol>
                    </div>
                    <div class="sq-ground sq-best">
                        <p class="sq-num">
                            <Bar width="46%" />
                        </p>
                        <p class="sq-ph-score">
                            <Bar width="100%" />
                        </p>
                    </div>
                    <ol class="sq-ground sq-week sq-ph-week">
                        <For each={[0, 1, 2, 3, 4, 5, 6]}>
                            {() => (
                                <li class="sq-day">
                                    <span class="sq-day-name">
                                        <Bar width="3.2em" />
                                    </span>
                                    <span class="sq-day-low">
                                        <Bar width="1.8em" />
                                    </span>
                                    <span class="sq-range" />
                                    <span class="sq-day-high">
                                        <Bar width="1.8em" />
                                    </span>
                                    <span class="sq-day-cond">
                                        <Bar width="9em" />
                                    </span>
                                </li>
                            )}
                        </For>
                    </ol>
                </div>
            </div>
        </div>
    )
}

// Snow and Daylight, waiting: the heading in words, since it's known, and a bar for the row of facts.
export function FactsPlaceholder(props: { title: string; last?: boolean }) {
    return (
        <div class={`sq-ground ${props.last ? "sq-daylight" : "sq-facts"}`} aria-hidden="true">
            <p class="sq-strong">{props.title}</p>
            <p class="sq-num">
                <Bar width="100%" />
            </p>
        </div>
    )
}
