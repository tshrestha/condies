type Position = number[]
type PolygonRings = Position[][]

export interface AvalancheZone {
    properties: {
        center: string
        center_link?: string
        link: string
        off_season: boolean
        danger_level: number
        travel_advice: string
        end_date: string | null
        warning?: { product: string | null }
    }
    geometry: { type: "Polygon"; coordinates: PolygonRings } | { type: "MultiPolygon"; coordinates: PolygonRings[] }
}

export interface AvalancheStatus {
    center: string
    link: string
    // Set only when the zone has a rating that's still in effect.
    rating?: { level: number; name: string; advice: string; warning?: string }
}

const dangerNames = ["Low", "Moderate", "Considerable", "High", "Extreme"]

function insideRing([x, y]: Position, ring: Position[]) {
    let inside = false
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const [xi, yi] = ring[i]
        const [xj, yj] = ring[j]
        if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
            inside = !inside
        }
    }
    return inside
}

const insidePolygon = (point: Position, [outer, ...holes]: PolygonRings) =>
    insideRing(point, outer) && !holes.some((hole) => insideRing(point, hole))

// If zones ever overlap, the more dangerous rating is the one to show.
export function findZone(zones: AvalancheZone[], lat: number, lon: number) {
    const point = [lon, lat]
    return zones
        .filter(({ geometry }) =>
            geometry.type === "Polygon"
                ? insidePolygon(point, geometry.coordinates)
                : geometry.coordinates.some((polygon) => insidePolygon(point, polygon)),
        )
        .sort((a, b) => b.properties.danger_level - a.properties.danger_level)[0]
}

const isWebLink = (url?: string) => !!url && /^https?:\/\//i.test(url)

// A saved copy can outlive its forecast, so a rating only counts while it's provably still in effect.
// The feed's times have no offset and are in UTC.
export function readZone({ properties: zone }: AvalancheZone, now: number): AvalancheStatus | undefined {
    if (zone.off_season) {
        return undefined
    }

    const name = dangerNames[zone.danger_level - 1]
    const isCurrent = name !== undefined && !!zone.end_date && Date.parse(`${zone.end_date}Z`) > now
    const product = zone.warning?.product
    return {
        center: zone.center,
        link: [zone.link, zone.center_link].find(isWebLink) ?? "https://avalanche.org/",
        rating: isCurrent
            ? {
                  level: zone.danger_level,
                  name,
                  advice: zone.travel_advice,
                  warning: typeof product === "string" ? product : undefined,
              }
            : undefined,
    }
}
