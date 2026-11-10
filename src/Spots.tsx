import { createMemo, createSignal, For, Loading, Show } from "solid-js"

import { getForecastData } from "./Forecast.tsx"
import ForecastPlaceholder from "./ForecastPlaceholder.tsx"
import HomeButton from "./HomeButton.tsx"
import { bestDay, formatSnow, getDayLabel, groupIntoDays, hasSnow } from "./lib/daily.ts"
import { scoreColor } from "./lib/score.ts"
import { getSpots, type Spot } from "./lib/spots.ts"
import ThemeToggle from "./ThemeToggle.tsx"

export async function loadSpot({ lat, lon, name }: Spot) {
    try {
        const data = await getForecastData(String(lat), String(lon))
        return {
            lat,
            lon,
            href: `#/forecast/${lat},${lon}`,
            name,
            days: groupIntoDays(data.forecast?.properties.periods ?? [], {
                grid: data.grid,
                hourly: data.allHourlyPeriods,
            }),
        }
    } catch (e) {
        // One place failing shouldn't hide the others.
        console.error("failed to load spot", name, e)
        return null
    }
}

export default function Spots() {
    const saved = getSpots()
    const [selectedDate, setSelectedDate] = createSignal<string>()

    const spots = createMemo(() =>
        Promise.all(saved.map(loadSpot)).then((results) => results.filter((spot) => spot !== null)),
    )
    const dates = createMemo(() => spots()[0]?.days ?? [])

    // Each spot's day to compare: the chosen date, or otherwise its best day this week.
    const ranked = createMemo(() =>
        spots()
            .map((spot) => {
                const date = selectedDate()
                return { ...spot, day: date ? spot.days.find((d) => d.date === date) : bestDay(spot.days) }
            })
            .sort((a, b) => (b.day?.condies?.score ?? -1) - (a.day?.condies?.score ?? -1)),
    )

    return (
        <>
            <ThemeToggle />
            <h1 class="display-6 text-center mt-3 mb-3">My Spots</h1>
            <Show
                when={saved.length}
                fallback={
                    <div class="alert alert-secondary text-center rounded-5" role="status">
                        Tap the star on any forecast to add it here.
                    </div>
                }
            >
                <Loading fallback={<ForecastPlaceholder />}>
                    <div class="spots-filter mb-3">
                        <button
                            type="button"
                            class={`btn btn-sm rounded-pill ${selectedDate() ? "btn-light" : "btn-primary"}`}
                            onClick={() => setSelectedDate(undefined)}
                        >
                            This week
                        </button>
                        <For each={dates()}>
                            {(day, i) => (
                                <button
                                    type="button"
                                    class={`btn btn-sm rounded-pill ${
                                        selectedDate() === day.date ? "btn-primary" : "btn-light"
                                    }`}
                                    onClick={() => setSelectedDate(day.date)}
                                >
                                    {getDayLabel(day, i(), "short")}
                                </button>
                            )}
                        </For>
                    </div>

                    <div class="card rounded-4 shadow-sm mb-4">
                        <div class="list-group list-group-flush rounded-4">
                            <For each={ranked()}>
                                {(spot) => (
                                    <a href={spot.href} class="list-group-item list-group-item-action spot-row">
                                        <span
                                            class="spot-score"
                                            style={{
                                                background:
                                                    spot.day?.condies !== undefined
                                                        ? scoreColor(spot.day.condies.score)
                                                        : "var(--bs-secondary-bg)",
                                            }}
                                        >
                                            {spot.day?.condies?.score ?? "–"}
                                        </span>
                                        <span class="spot-name">
                                            <span class="fw-medium">{spot.name}</span>
                                            <small class="text-body-secondary">
                                                <Show when={spot.day} fallback="No forecast">
                                                    {getDayLabel(spot.day!, spot.days.indexOf(spot.day!), "short")}
                                                    <Show when={spot.day!.condies}>
                                                        {` · ${spot.day!.condies!.bestWindow}`}
                                                    </Show>
                                                </Show>
                                            </small>
                                        </span>
                                        <Show when={spot.day && hasSnow(spot.day)}>
                                            <span class="spot-snow">
                                                <i class="bi bi-snow2" /> {formatSnow(spot.day!.snow!)}
                                            </span>
                                        </Show>
                                        <i class="bi bi-chevron-right daily-chevron" />
                                    </a>
                                )}
                            </For>
                        </div>
                    </div>
                </Loading>
            </Show>
            <div class="position-fixed bottom-0 pb-4 z-3">
                <HomeButton />
            </div>
        </>
    )
}
