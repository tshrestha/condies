import "maplibre-gl/dist/maplibre-gl.css"

import { query } from "@solidjs/router"
import maplibregl from "maplibre-gl"
import { createEffect, createMemo, createSignal } from "solid-js"

import { reverse } from "./lib/geocoding.ts"
import { denver } from "./lib/nws.ts"
import { scoreColor } from "./lib/score.ts"
import { getSpots } from "./lib/spots.ts"
import { getLocation } from "./lib/util.ts"

import { loadSpot } from "./Spots.tsx"

const radarLayer = "radar"
// NOAA's current radar mosaic. It covers the contiguous US, like the rest of the app's NWS data.
const radarTiles =
    "https://opengeo.ncep.noaa.gov/geoserver/conus/conus_bref_qcd/ows?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetMap"
    + "&FORMAT=image/png&TRANSPARENT=true&LAYERS=conus_bref_qcd&CRS=EPSG:3857&WIDTH=256&HEIGHT=256&BBOX={bbox-epsg-3857}"

function spotPin(spot: NonNullable<Awaited<ReturnType<typeof loadSpot>>>) {
    const today = spot.days[0]
    const pin = document.createElement("a")
    pin.className = "spot-pin"
    pin.href = spot.href
    pin.title = spot.name

    if (today?.condies) {
        pin.textContent = String(today.condies.score)
        pin.style.background = scoreColor(today.condies.score)
    } else {
        pin.textContent = `${today?.high ?? today?.low ?? "–"}°`
    }
    return pin
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
    let mapRef!: maplibregl.Map

    const latlon = createMemo(() => getData())
    const [radarOn, setRadarOn] = createSignal(true)

    createEffect(latlon, (coords) => {
        if (mapContainerRef.isConnected && coords) {
            mapRef = new maplibregl.Map({
                container: mapContainerRef,
                style: "https://tiles.openfreemap.org/styles/bright",
                center: [coords.lon, coords.lat],
                zoom: 9,
                attributionControl: false,
            })

            mapRef.addControl(new maplibregl.AttributionControl({ compact: true }), "top-left")

            mapRef.addControl(
                new maplibregl.NavigationControl({
                    showCompass: true,
                }),
                "bottom-right",
            )

            mapRef.addControl(
                new maplibregl.GeolocateControl({
                    positionOptions: {
                        enableHighAccuracy: true,
                    },
                    showAccuracyCircle: true,
                }),
                "bottom-right",
            )

            const handleClick = (e: maplibregl.MapMouseEvent) => {
                const { lat, lng } = e.lngLat
                reverse(lat.toFixed(6), lng.toFixed(6)).then((result) => {
                    // Place names are third-party text, so they must never be parsed as HTML.
                    const link = document.createElement("a")
                    link.href = `#/forecast/${lat.toFixed(4)},${lng.toFixed(4)}`
                    link.textContent = (result.display_name as string) ?? "View forecast"

                    new maplibregl.Popup()
                        .setLngLat(e.lngLat)
                        .setDOMContent(link)
                        .addTo(mapRef as maplibregl.Map)
                })
            }

            mapRef.on("click", handleClick)

            mapRef.on("load", () => {
                mapRef.addSource(radarLayer, {
                    type: "raster",
                    tiles: [radarTiles],
                    tileSize: 256,
                    attribution: "Radar: NOAA",
                })
                mapRef.addLayer({
                    id: radarLayer,
                    type: "raster",
                    source: radarLayer,
                    layout: { visibility: radarOn() ? "visible" : "none" },
                    paint: { "raster-opacity": 0.65 },
                })
            })

            let removed = false
            Promise.all(getSpots().map(loadSpot)).then((spots) => {
                if (removed) {
                    return
                }
                for (const spot of spots) {
                    if (spot) {
                        new maplibregl.Marker({ element: spotPin(spot) }).setLngLat([spot.lon, spot.lat]).addTo(mapRef)
                    }
                }
            })

            return () => {
                removed = true
                mapRef?.off("click", handleClick)
                mapRef?.remove()
            }
        }
    })

    createEffect(radarOn, (on) => {
        if (mapRef?.getLayer(radarLayer)) {
            mapRef.setLayoutProperty(radarLayer, "visibility", on ? "visible" : "none")
        }
    })

    return (
        <>
            <div id={"map"} class={"position-fixed top-0 start-0 z-2"} ref={mapContainerRef}></div>
            <button
                type="button"
                class={`btn btn-sm rounded-pill shadow-sm position-fixed bottom-0 start-50 translate-middle-x mb-4 z-3 above-dock ${
                    radarOn() ? "btn-primary" : "btn-light"
                }`}
                aria-pressed={radarOn() ? "true" : "false"}
                onClick={() => setRadarOn((on) => !on)}
            >
                <i class="bi bi-broadcast" /> Radar
            </button>
        </>
    )
}
