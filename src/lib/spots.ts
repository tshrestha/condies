import type { Feature } from "geojson"

import { getItem, savedSelectionsCollectionKey, setItem, spotsKey } from "./cache.ts"

export interface Spot {
    lat: number
    lon: number
    name: string
}

type Place = Pick<Spot, "lat" | "lon">

// About a kilometer. NWS grid cells are larger, so anything closer has the same forecast.
const samePlace = (a: Place, b: Place) => Math.abs(a.lat - b.lat) < 0.01 && Math.abs(a.lon - b.lon) < 0.01

const searchedPlaces = (): Spot[] =>
    ((getItem(savedSelectionsCollectionKey) ?? []) as Feature[]).map(({ properties }) => ({
        lat: properties!.coordinates.latitude,
        lon: properties!.coordinates.longitude,
        name: (properties!.full_address as string).split(",")[0],
    }))

// Before stars existed, every searched place was on the board. Those stay until the first change.
export const getSpots = (): Spot[] => getItem(spotsKey) ?? searchedPlaces()

export const isSpot = (place: Place) => getSpots().some((spot) => samePlace(spot, place))

// Returns whether the place is saved afterwards. A name the user searched for beats the nearest town.
export function toggleSpot(place: Spot) {
    const spots = getSpots()
    if (spots.some((spot) => samePlace(spot, place))) {
        setItem(
            spotsKey,
            spots.filter((spot) => !samePlace(spot, place)),
        )
        return false
    }

    const searched = searchedPlaces().find((p) => samePlace(p, place))
    setItem(spotsKey, [...spots, { ...place, name: searched?.name ?? place.name }])
    return true
}
