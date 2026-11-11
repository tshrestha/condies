import { For } from "solid-js"

import { Bar } from "../home/Placeholder.tsx"

// My Spots while the spots' forecasts load: the heading in words, since it's known, and a row of bars for each
// saved spot.
export function SpotsPlaceholder(props: { count: number }) {
    return (
        <div class="sq-spotsview" role="status">
            <p class="sq-sr">Getting the forecast.</p>
            <div class="sq-split" aria-hidden="true">
                <div class="sq-lead sq-ground sq-spots-head">
                    <p class="sq-num">My Spots</p>
                    <p class="sq-filters sq-ph-filters">
                        <Bar width="100%" />
                    </p>
                </div>
                <ol class="sq-rest">
                    <For each={Array.from({ length: props.count })}>
                        {() => (
                            <li class="sq-ground sq-spot">
                                <Bar width="40%" />
                                <Bar width="62%" />
                                <span class="sq-ph-score">
                                    <Bar width="100%" />
                                </span>
                            </li>
                        )}
                    </For>
                </ol>
            </div>
        </div>
    )
}
