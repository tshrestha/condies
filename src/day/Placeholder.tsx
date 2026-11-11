import { For } from "solid-js"

import { Bar } from "../home/Placeholder.tsx"

// The Day screen while its forecast loads: the pager and facts as bars, and the day's swatch as a plain block
// that keeps its real lines, invisible, so it comes out the same size.
export function DayPlaceholder() {
    return (
        <div class="sq-dayview" role="status">
            <p class="sq-sr">Getting the forecast.</p>
            <div aria-hidden="true">
                <div class="sq-ground sq-pager">
                    <span class="sq-page">
                        <Bar width="6em" />
                    </span>
                    <span class="sq-page sq-page-next">
                        <Bar width="6em" />
                    </span>
                </div>
                <div class="sq-split">
                    <div class="sq-lead">
                        <div class="sq-dayhero sq-ph-swatch">
                            <p class="sq-num">Today</p>
                            <p>Wed, Nov 11</p>
                            <p class="sq-dayhero-temps">
                                <span>
                                    High <span class="sq-xl">00°</span>
                                </span>
                            </p>
                            <p>Sunny.</p>
                        </div>
                    </div>
                    <div class="sq-rest">
                        <div class="sq-ground sq-stats">
                            <For each={["40%", "55%", "50%"]}>
                                {(width) => (
                                    <p class="sq-num">
                                        <Bar width={width} />
                                    </p>
                                )}
                            </For>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
