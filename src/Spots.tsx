import { createMemo, Loading } from "solid-js"

import { getForecastData } from "./forecastData.ts"
import { groupIntoDays } from "./lib/daily.ts"
import type { SpotView } from "./lib/forecastView.ts"
import { getSpots, type Spot } from "./lib/spots.ts"
import { SpotsPlaceholder } from "./spots/Placeholder.tsx"
import { SpotsView } from "./spots/sections.tsx"

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
    // A spot whose forecast fails still gets its row, which says so, rather than vanishing from the list.
    const spots = createMemo(() =>
        Promise.all(saved.map(async (spot): Promise<SpotView> => (await loadSpot(spot)) ?? { ...spot, days: [] })),
    )

    return (
        <Loading fallback={<SpotsPlaceholder count={saved.length} />}>
            <SpotsView
                spots={saved.length ? spots() : []}
                spotLink={(spot) => ({ href: `#/forecast/${spot.lat},${spot.lon}` })}
            />
        </Loading>
    )
}
