import "maplibre-gl/dist/maplibre-gl.css"

import { query } from "@solidjs/router"
import maplibregl from "maplibre-gl"
import { createEffect, createMemo } from "solid-js"

import { reverse } from "./lib/geocoding.ts"
import { denver } from "./lib/nws.ts"
import { getLocation } from "./lib/util.ts"

import HomeButton from "./HomeButton.tsx"

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

            return () => {
                mapRef?.off("click", handleClick)
                mapRef?.remove()
            }
        }
    })

    return (
        <>
            <div id={"map"} class={"position-fixed top-0 start-0 z-2"} ref={mapContainerRef}></div>
            <div class={"position-fixed bottom-0 start-0 mb-3 mx-3 z-3"}>
                <HomeButton />
            </div>
        </>
    )
}
