const HOUR = 3_600_000
const EARTH_RADIUS_MILES = 3959
const MAX_STATION_MILES = 15
const MAX_READING_AGE = 12 * HOUR
// Depth sensors wander by an inch or so from hour to hour.
const MIN_REAL_CHANGE_INCHES = 2

// Triplet, name, latitude, longitude, elevation in feet, and the UTC offset its readings use.
export type StationRow = [string, string, number, number, number, number]

export interface Station {
    triplet: string
    name: string
    elevation: number
    utcOffset: number
    miles: number
}

export interface DepthReading {
    date: string
    value: number | null
}

const toRadians = (degrees: number) => (degrees * Math.PI) / 180

function milesBetween(lat1: number, lon1: number, lat2: number, lon2: number) {
    const dLat = toRadians(lat2 - lat1)
    const dLon = toRadians(lon2 - lon1)
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLon / 2) ** 2
    return EARTH_RADIUS_MILES * 2 * Math.asin(Math.sqrt(a))
}

// Not every station measures depth, so callers get a few to try, closest first.
export function nearestStations(rows: StationRow[], lat: number, lon: number, count = 3): Station[] {
    return rows
        .map(([triplet, name, stationLat, stationLon, elevation, utcOffset]) => ({
            triplet,
            name,
            elevation,
            utcOffset,
            miles: milesBetween(lat, lon, stationLat, stationLon),
        }))
        .filter((station) => station.miles <= MAX_STATION_MILES)
        .sort((a, b) => a.miles - b.miles)
        .slice(0, count)
}

const median = (values: number[]) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)]

// Readings are hourly but can have gaps. A median keeps one bad reading from showing up as a storm.
export function readDepth(values: DepthReading[], utcOffset: number, now: number) {
    const readings = values
        .filter((v) => v.value !== null)
        .map((v) => ({
            time: Date.parse(`${v.date.replace(" ", "T")}:00Z`) - utcOffset * HOUR,
            depth: v.value as number,
        }))

    const latest = readings.at(-1)
    if (!latest || now - latest.time > MAX_READING_AGE) {
        return undefined
    }
    const depth = median(readings.slice(-3).map((r) => r.depth))

    const dayAgo = readings.filter((r) => Math.abs(latest.time - 24 * HOUR - r.time) <= 2 * HOUR)
    const change = dayAgo.length ? depth - median(dayAgo.map((r) => r.depth)) : 0
    return { depth, change: Math.abs(change) >= MIN_REAL_CHANGE_INCHES ? change : 0, measuredAt: latest.time }
}
