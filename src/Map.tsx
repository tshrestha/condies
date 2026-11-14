import "maplibre-gl/dist/maplibre-gl.css"
import "./map/map.css"

import { query } from "@solidjs/router"
import { render } from "@solidjs/web"
import * as maplibregl from "maplibre-gl"
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url"
import { createEffect, createMemo, createSignal, Show } from "solid-js"

import { RadarIcon } from "./design/icons.tsx"
import { paintTemp, type Theme } from "./design/ramp.ts"
import { degrees } from "./design/words.ts"
import { rankSpots } from "./lib/forecastView.ts"
import { type GeocodingResult, reverse } from "./lib/geocoding.ts"
import { denver } from "./lib/nws.ts"
import { getSpots } from "./lib/spots.ts"
import { getLocation } from "./lib/util.ts"
import { RadarFrames, type RadarState } from "./map/radarFrames.ts"
import { RadarTape } from "./map/RadarTape.tsx"
import { SpotRow } from "./spots/sections.tsx"
import { loadSpot } from "./Spots.tsx"
import { theme } from "./theme.ts"

// MapLibre can't find its worker inside a bundle, so Vite builds it and passes on where it ended up.
maplibregl.setWorkerUrl(workerUrl)

// A quiet base map, so the only color on it is data.
const baseStyle = (t: Theme) => `https://tiles.openfreemap.org/styles/${t === "dark" ? "dark" : "positron"}`

type LoadedSpot = NonNullable<Awaited<ReturnType<typeof loadSpot>>>

// A saved spot is a square paint chip in the color of its high today, or its low once only tonight is left,
// printing that temperature in the chip's own ink. Tapping it opens the spot's row from My Spots.
function spotPin(spot: LoadedSpot) {
    const today = spot.days[0]
    const t = today?.high ?? today?.low
    const pin = document.createElement("button")
    pin.type = "button"
    pin.className = "sq-pin"
    pin.setAttribute(
        "aria-label",
        t === undefined ? spot.name : `${spot.name}, ${today!.high === undefined ? "low" : "high"} ${degrees(t)}`,
    )
    const chip = document.createElement("span")
    chip.className = "sq-chip sq-pin-chip"
    chip.textContent = degrees(t)
    pin.append(chip)
    const paint = (to: Theme) => {
        if (t !== undefined) {
            const { bg, ink } = paintTemp(t, to)
            chip.style.setProperty("--b", bg)
            chip.style.setProperty("--k", ink)
        }
    }
    return { pin, paint }
}

// A town and state is what tells one forecast from another; a street address doesn't. Without them, the full
// name the geocoder gave.
function placeName(result?: GeocodingResult) {
    const address = (result?.address ?? {}) as Record<string, string | undefined>
    const local = address.city ?? address.town ?? address.village ?? address.hamlet ?? address.county
    return [local, address.state].filter(Boolean).join(", ") || (result?.display_name as string | undefined)
}

// Place names are third-party text, so they're only ever set as text, never parsed as HTML.
function placePopup(name: string | undefined, href: string) {
    const box = document.createElement("div")
    box.className = "sq-popup-place"
    const label = document.createElement("span")
    label.className = "sq-small"
    label.textContent = "Forecast for"
    const link = document.createElement("a")
    link.className = "sq-link"
    link.href = href
    link.textContent = name ?? "this place"
    box.append(label, link)
    return box
}

const getData = query(async () => {
    try {
        const {
            // @ts-ignore
            coords: { latitude, longitude },
        } = await getLocation()
        return { lat: latitude.toFixed(4), lon: longitude.toFixed(4) }
    } catch (e) {
        console.error((e as Error).message)
        return { lat: denver.lat, lon: denver.lon }
    }
}, "mapGeoLocation")

export default function Map() {
    let mapContainerRef!: HTMLDivElement
    let mapRef: maplibregl.Map | undefined
    // NOAA radar, which covers the contiguous US, like the rest of the app's NWS data.
    let radar: RadarFrames | undefined
    let style = ""
    const paints: ((to: Theme) => void)[] = []

    const latlon = createMemo(() => getData())
    const [radarOn, setRadarOn] = createSignal(true)
    const [radarState, setRadarState] = createSignal<RadarState>()

    createEffect(latlon, (coords) => {
        if (!mapContainerRef.isConnected || !coords) {
            return
        }
        style = baseStyle(theme())
        const map = new maplibregl.Map({
            container: mapContainerRef,
            style,
            center: [Number(coords.lon), Number(coords.lat)],
            zoom: 9,
            attributionControl: false,
        })
        mapRef = map
        radar = new RadarFrames(map, setRadarState)
        radar.setOn(radarOn())

        map.addControl(new maplibregl.AttributionControl({ compact: true }), "top-left")
        map.addControl(new maplibregl.NavigationControl({ showCompass: true }), "bottom-right")
        map.addControl(
            new maplibregl.GeolocateControl({
                positionOptions: { enableHighAccuracy: true },
                showAccuracyCircle: true,
            }),
            "bottom-right",
        )
        for (const group of mapContainerRef.querySelectorAll(".maplibregl-ctrl-group")) {
            group.classList.add("sq-glass")
        }

        const handleClick = (e: maplibregl.MapMouseEvent) => {
            // Pins sit inside the map's click area, and open their own popups.
            if ((e.originalEvent.target as Element).closest(".sq-pin")) {
                return
            }
            const { lat, lng } = e.lngLat
            const href = `/forecast/${lat.toFixed(4)},${lng.toFixed(4)}`
            reverse(lat.toFixed(6), lng.toFixed(6))
                .catch(() => undefined)
                .then((result) => {
                    new maplibregl.Popup({ offset: 12, maxWidth: "320px", className: "sq-popup" })
                        .setLngLat(e.lngLat)
                        .setDOMContent(placePopup(placeName(result), href))
                        .addTo(map)
                })
        }
        map.on("click", handleClick)
        // MapLibre opens the compact attribution when its text arrives and closes it on the first drag. It starts
        // closed here, as the ⓘ, so it never covers the radar switch.
        map.once("load", () => {
            mapContainerRef.querySelector(".maplibregl-compact-show")?.classList.remove("maplibregl-compact-show")
        })

        let removed = false
        const disposers: (() => void)[] = []
        Promise.all(getSpots().map(loadSpot)).then((spots) => {
            if (removed) {
                return
            }
            for (const spot of spots) {
                if (!spot) {
                    continue
                }
                const { pin, paint } = spotPin(spot)
                paint(theme())
                paints.push(paint)
                const box = document.createElement("div")
                disposers.push(render(() => <SpotRow spot={rankSpots([spot])[0]} link={{ href: spot.href }} />, box))
                const popup = new maplibregl.Popup({ offset: 24, maxWidth: "none", className: "sq-popup" })
                // Opened from the keyboard, focus moves into the popup. Tapped, it stays put, so no focus ring
                // appears around the spot.
                pin.addEventListener("pointerdown", () => (popup.options.focusAfterOpen = false))
                pin.addEventListener("keydown", () => (popup.options.focusAfterOpen = true))
                new maplibregl.Marker({ element: pin })
                    .setLngLat([spot.lon, spot.lat])
                    .setPopup(popup.setDOMContent(box))
                    .addTo(map)
            }
        })

        return () => {
            removed = true
            disposers.forEach((dispose) => dispose())
            paints.length = 0
            radar?.destroy()
            radar = undefined
            map.off("click", handleClick)
            map.remove()
            mapRef = undefined
        }
    })

    createEffect(theme, (to) => {
        paints.forEach((paint) => paint(to))
        if (mapRef && baseStyle(to) !== style) {
            style = baseStyle(to)
            mapRef.setStyle(style)
        }
    })

    createEffect(radarOn, (on) => radar?.setOn(on))

    return (
        <div class="sq-map">
            <div id="map" class="sq-map-canvas" ref={mapContainerRef} />
            <button
                type="button"
                class="sq-glass sq-radar"
                aria-pressed={radarOn() ? "true" : "false"}
                onClick={() => setRadarOn((on) => !on)}
            >
                <RadarIcon />
                Radar
            </button>
            <Show when={radarOn() && radarState()}>
                {(state) => (
                    <RadarTape
                        state={state()}
                        onPlay={() => radar?.play()}
                        onPause={() => radar?.pause()}
                        onSeek={(index) => radar?.seek(index)}
                    />
                )}
            </Show>
        </div>
    )
}
