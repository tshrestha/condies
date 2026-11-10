import { debounce } from "@solid-primitives/scheduled"
import { useNavigate } from "@solidjs/router"
import type { Feature } from "geojson"
import { createSignal, For } from "solid-js"

import { addItem, getItem, savedSelectionsCollectionKey, setItem } from "./lib/cache.ts"
import { geocodeSearch } from "./lib/geocoding.ts"

export default function LocationSearchForm() {
    const navigate = useNavigate()
    const [searchResults, setSearchResults] = createSignal<Feature[]>()
    const [searchResultsVisible, setSearchResultsVisible] = createSignal(false)
    let searchInputRef!: HTMLInputElement

    // Resets to the last result whenever the results change.
    const [resultNav, setResultNav] = createSignal(() => {
        const lastOffset = (searchResults()?.length ?? 0) - 1
        return { maxOffset: lastOffset, selectionOffset: lastOffset }
    })

    const saveSelection = (selection: any) => {
        addItem(savedSelectionsCollectionKey, selection)
    }

    const loadSavedSelections = () => {
        const savedSelections = getItem(savedSelectionsCollectionKey)
        if (savedSelections) {
            setSearchResults(savedSelections)
        }
    }

    const onFocus = () => {
        loadSavedSelections()
        setSearchResultsVisible(true)
    }

    const onBlur = (e: FocusEvent) => {
        if (!(e.relatedTarget as HTMLElement)?.classList.contains("search-result")) {
            setSearchResultsVisible(false)
        }
    }

    let latestQuery = ""

    const debouncedSearch = debounce((query: string) => {
        geocodeSearch(query).then(({ features }) => {
            if (features) {
                setItem(query, features)
            }
            // A slow response must not replace the results of a newer search.
            if (query === latestQuery) {
                setSearchResults(features?.reverse())
            }
        })
    }, 300)

    const onInput = () => {
        if (searchInputRef?.isConnected) {
            const query = searchInputRef.value
            latestQuery = query
            debouncedSearch.clear()
            if (query && query.length > 2) {
                const cached = getItem(query)
                if (cached) {
                    setSearchResults(cached.reverse())
                } else {
                    debouncedSearch(query)
                }
            } else {
                setSearchResults([])
            }
        }
    }

    const onKeyDown = (e: KeyboardEvent) => {
        if (searchResults() && searchResults()!.length) {
            if (e.key === "Enter") {
                const {
                    properties: {
                        // @ts-ignore
                        coordinates: { latitude, longitude },
                    },
                } = searchResults()![resultNav().selectionOffset]
                saveSelection(searchResults()![resultNav().selectionOffset])
                navigate(`/forecast/${latitude},${longitude}`)
            } else if (e.key === "ArrowDown") {
                setResultNav({
                    ...resultNav(),
                    selectionOffset:
                        resultNav().selectionOffset < resultNav().maxOffset ? resultNav().selectionOffset + 1 : 0,
                })
            } else if (e.key === "ArrowUp") {
                setResultNav({
                    ...resultNav(),
                    selectionOffset:
                        resultNav().selectionOffset > 0 ? resultNav().selectionOffset - 1 : resultNav().maxOffset,
                })
            } else if (e.key === "Tab") {
                e.preventDefault()
                setResultNav({
                    ...resultNav(),
                    selectionOffset:
                        resultNav().selectionOffset < resultNav().maxOffset ? resultNav().selectionOffset + 1 : 0,
                })
            }
        }
    }

    return (
        <div class={"container position-fixed bottom-0 start-50 pb-4 z-3 translate-middle-x"}>
            <div
                id="suggestions"
                class={`list-group list-group-flush rounded rounded-3 position-absolute start-0 bottom-100 pb-1 w-100 shadow-sm ${
                    searchResults()?.length && searchResultsVisible() ? "" : "d-none"
                }`}
                style={{ "z-index": 1000 }}
            >
                <For each={searchResults()}>
                    {(feature, i) => (
                        <a
                            class={`list-group-item list-group-item-action search-result ${
                                i() === resultNav().selectionOffset ? "active" : ""
                            }`}
                            href={`#/forecast/${feature.properties?.coordinates.latitude},${feature.properties?.coordinates.longitude}`}
                            onClick={() => saveSelection(feature)}
                            tabindex={0}
                        >
                            {feature.properties?.full_address}
                        </a>
                    )}
                </For>
            </div>
            <div class={"d-flex justify-content-between align-items-center position-relative"}>
                <div class={"col-10 pe-2"}>
                    <input
                        autocomplete={"off"}
                        ref={searchInputRef}
                        id={"geocodingSearch"}
                        type="search"
                        name={"search"}
                        class="form-control form-control-lg rounded-pill border-4 shadow-sm"
                        placeholder="Search for a city or place"
                        aria-label="Location"
                        aria-describedby="search"
                        onInput={onInput}
                        onKeyDown={onKeyDown}
                        onFocus={onFocus}
                        onBlur={onBlur}
                    />
                </div>
                <div class="col-2">
                    <a href={"#/map"} class={"btn btn-light btn-lg rounded-pill border-4 shadow-sm"} aria-label="Map">
                        <i class={"bi bi-map"}></i>
                    </a>
                </div>
            </div>
        </div>
    )
}
