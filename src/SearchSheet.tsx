import { debounce } from "@solid-primitives/scheduled"
import { useNavigate } from "@solidjs/router"
import type { Feature } from "geojson"
import { createSignal, For, Show } from "solid-js"

import { Sheet } from "./design/parts.tsx"
import { addItem, getItem, savedSelectionsCollectionKey, setItem } from "./lib/cache.ts"
import { geocodeSearch } from "./lib/geocoding.ts"

interface Place {
    feature: Feature
    name: string
    detail: string
    lat: number
    lon: number
}

function toPlace(feature: Feature): Place {
    const address = String(feature.properties?.full_address ?? "")
    const comma = address.indexOf(",")
    return {
        feature,
        name: comma < 0 ? address : address.slice(0, comma),
        detail: comma < 0 ? "" : address.slice(comma + 1).trim(),
        lat: feature.properties?.coordinates.latitude,
        lon: feature.properties?.coordinates.longitude,
    }
}

// Places searched before, most recent first. Storage can hold anything, so only a list counts.
function recentPlaces() {
    const saved = getItem(savedSelectionsCollectionKey)
    return Array.isArray(saved) ? [...saved].reverse() : []
}

// Search as a sheet. Before typing it lists recent places. Arrow keys move through the results, Enter opens the
// chosen one, and choosing a place saves it to the recent list.
export default function SearchSheet(props: { onClose: () => void }) {
    const navigate = useNavigate()
    const [results, setResults] = createSignal<Place[]>(recentPlaces().map(toPlace))
    const [active, setActive] = createSignal(0)
    let latestQuery = ""

    const show = (features: Feature[]) => {
        setResults(features.map(toPlace))
        setActive(0)
    }

    const search = debounce((query: string) => {
        geocodeSearch(query).then(({ features }) => {
            if (features) {
                setItem(query, features)
            }
            // A slow response must not replace the results of a newer search.
            if (query === latestQuery) {
                show(features ?? [])
            }
        })
    }, 300)

    const onInput = (event: InputEvent) => {
        const query = (event.currentTarget as HTMLInputElement).value
        latestQuery = query
        search.clear()
        if (query.length > 2) {
            const cached = getItem(query)
            if (Array.isArray(cached)) {
                show(cached)
            } else {
                search(query)
            }
        } else {
            show(query ? [] : recentPlaces())
        }
    }

    const choose = (place: Place) => {
        addItem(savedSelectionsCollectionKey, place.feature)
        props.onClose()
        navigate(`/forecast/${place.lat},${place.lon}`)
    }

    const onKeyDown = (event: KeyboardEvent) => {
        const count = results().length
        if (!count) {
            return
        }
        if (event.key === "ArrowDown") {
            event.preventDefault()
            setActive((active() + 1) % count)
        } else if (event.key === "ArrowUp") {
            event.preventDefault()
            setActive((active() - 1 + count) % count)
        } else if (event.key === "Enter") {
            event.preventDefault()
            choose(results()[active()])
        }
    }

    return (
        <Sheet label="Search" title="Search" onClose={props.onClose}>
            <div class="sq-sheet-body">
                <div class="sq-search">
                    <label class="sq-strong" for="sq-search-input">
                        Where to?
                    </label>
                    <input
                        id="sq-search-input"
                        class="sq-input"
                        type="search"
                        role="combobox"
                        autocomplete="off"
                        autofocus
                        placeholder="A town or a mountain"
                        aria-autocomplete="list"
                        aria-controls="sq-search-results"
                        aria-expanded={results().length ? "true" : "false"}
                        aria-activedescendant={results().length ? `sq-search-result-${active()}` : undefined}
                        onInput={onInput}
                        onKeyDown={onKeyDown}
                    />
                </div>
                <ul id="sq-search-results" class="sq-results" role="listbox" aria-label="Places">
                    <For each={results()}>
                        {(place, i) => (
                            <li
                                id={`sq-search-result-${i()}`}
                                class="sq-result"
                                role="option"
                                aria-selected={i() === active() ? "true" : "false"}
                                onClick={() => choose(place)}
                            >
                                <span class="sq-strong">{place.name}</span>
                                <Show when={place.detail}>
                                    <span class="sq-small">{place.detail}</span>
                                </Show>
                            </li>
                        )}
                    </For>
                </ul>
            </div>
        </Sheet>
    )
}
