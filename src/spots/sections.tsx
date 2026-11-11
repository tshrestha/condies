import { createMemo, createSignal, For, type ParentProps, Show } from "solid-js"

import type { LinkProps } from "../design/nav.tsx"
import { Score } from "../design/parts.tsx"
import { dayName } from "../design/words.ts"
import { formatSnow, getDayLabel, hasSnow } from "../lib/daily.ts"
import { rankSpots, type SpotView } from "../lib/forecastView.ts"

// My Spots, shared by the app and the lab. It takes the spots and a link for each, so each can wire its own
// navigation. A spot whose forecast didn't load has no days and says so in its row.

export type RankedSpot = ReturnType<typeof rankSpots>[number]

export interface SpotsCtx {
    spots: SpotView[]
    spotLink: (spot: SpotView) => LinkProps
}

// One spot on the ground: its name, the day being compared with its best window and snow, then the score
// line. My Spots lists them; the map shows one when a pin is tapped.
export function SpotRow(props: { spot: RankedSpot; link: LinkProps }) {
    const day = () => props.spot.day
    const index = () => (props.spot.day ? props.spot.days.indexOf(props.spot.day) : -1)
    return (
        <div class="sq-ground sq-spot">
            <a class="sq-spot-text" {...props.link}>
                <span class="sq-strong">{props.spot.name}</span>
                <Show
                    when={day()}
                    fallback={
                        <span>
                            {props.spot.days.length ? "No forecast for this day" : "Couldn’t load its forecast"}
                        </span>
                    }
                >
                    {(d) => (
                        <>
                            <span>
                                {dayName(d(), index())}
                                <Show when={d().condies}>, {d().condies!.bestWindow}</Show>
                            </span>
                            <Show when={hasSnow(d())}>
                                <span>{formatSnow(d().snow!)} snow</span>
                            </Show>
                        </>
                    )}
                </Show>
            </a>
            <Score score={day()?.condies?.score} />
        </div>
    )
}

// Ranked by score, so the rows sit on the ground: a color here would read as a ranking. The lab passes its own
// top bar as children.
export function SpotsView(props: ParentProps<SpotsCtx>) {
    const [date, setDate] = createSignal<string>()
    const ranked = createMemo(() => rankSpots(props.spots, date()))
    const filterDays = () => props.spots.find((spot) => spot.days.length)?.days ?? []

    return (
        <div class="sq-spotsview">
            {props.children}
            <div class="sq-split">
                <div class="sq-lead sq-ground sq-spots-head">
                    <h1 class="sq-num">My Spots</h1>
                    <Show when={props.spots.length}>
                        <div class="sq-filters" role="group" aria-label="Which day">
                            <button
                                type="button"
                                class="sq-tab"
                                aria-pressed={date() === undefined ? "true" : "false"}
                                onClick={() => setDate(undefined)}
                            >
                                This week
                            </button>
                            <For each={filterDays()}>
                                {(day, i) => (
                                    <button
                                        type="button"
                                        class="sq-tab"
                                        aria-pressed={date() === day.date ? "true" : "false"}
                                        onClick={() => setDate(day.date)}
                                    >
                                        {getDayLabel(day, i(), "short")}
                                    </button>
                                )}
                            </For>
                        </div>
                    </Show>
                </div>
                <div class="sq-rest">
                    <Show
                        when={props.spots.length}
                        fallback={<p class="sq-ground sq-empty">Tap the star on any forecast to add it here.</p>}
                    >
                        <ol class="sq-spots">
                            <For each={ranked()}>
                                {(spot) => (
                                    <li>
                                        <SpotRow spot={spot} link={props.spotLink(spot)} />
                                    </li>
                                )}
                            </For>
                        </ol>
                    </Show>
                </div>
            </div>
        </div>
    )
}
