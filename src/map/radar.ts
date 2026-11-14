import { formatAge } from "../lib/util.ts"

// NOAA's radar mosaic (MRMS reflectivity) and its timeline, kept apart from the map so it can be tested on its own.

const layer = "https://opengeo.ncep.noaa.gov/geoserver/conus/conus_bref_qcd/ows?SERVICE=WMS&VERSION=1.3.0"

// The layer's own capabilities: about 8 KB, listing every scan of the last two hours.
export const scanListURL = `${layer}&REQUEST=GetCapabilities`

// One scan's tiles. Without a time, NOAA sends its latest. A past scan never changes, so NOAA lets it be cached for
// hours and every viewer shares the same URLs.
export const radarTiles = (time?: string) =>
    `${layer}&REQUEST=GetMap&FORMAT=image/png&TRANSPARENT=true&LAYERS=conus_bref_qcd&CRS=EPSG:3857`
    + `&WIDTH=256&HEIGHT=256&BBOX={bbox-epsg-3857}${time ? `&TIME=${time}` : ""}`

export interface Scan {
    // As NOAA wrote it, so tile URLs match what every other viewer requests.
    time: string
    at: number
}

// The scan times in the capabilities' time dimension, oldest first. None if it has no times.
export function parseScanTimes(xml: string): Scan[] {
    const list = /<Dimension\b[^>]*\bname="time"[^>]*>([^<]*)<\/Dimension>/i.exec(xml)?.[1] ?? ""
    const scans = new Map<number, Scan>()
    for (const entry of list.split(",")) {
        const time = entry.trim()
        const at = Date.parse(time)
        if (time && !Number.isNaN(at)) {
            scans.set(at, { time, at })
        }
    }
    return [...scans.values()].sort((a, b) => a.at - b.at)
}

export const loopMinutes = 60

// The loop: every scan in the hour ending at the latest, oldest first.
export function loopWindow(scans: Scan[]): Scan[] {
    const latest = scans.at(-1)
    return latest ? scans.filter((s) => s.at >= latest.at - loopMinutes * 60_000) : []
}

// Playback runs on the scans' own clock, so weather moves at an even speed even though NOAA's scans come 1.5 to 2.5
// minutes apart: a minute of weather takes this long, so an hour plays in about 4.3 seconds, about 7 frames a
// second. Then the latest holds before the loop starts again.
export const msPerScanMinute = 71
export const holdMs = 1500

export function loopLength(scans: Scan[]) {
    return scans.length < 2 ? holdMs : ((scans.at(-1)!.at - scans[0].at) / 60_000) * msPerScanMinute + holdMs
}

// Which frame is due after playing for elapsedMs.
export function frameAt(scans: Scan[], elapsedMs: number): number {
    if (scans.length < 2) {
        return 0
    }
    const t = elapsedMs % loopLength(scans)
    const at = scans[0].at + (t / msPerScanMinute) * 60_000
    let index = 0
    while (index < scans.length - 1 && scans[index + 1].at <= at) {
        index++
    }
    return index
}

// "1:48 PM", as the app writes times. The time zone is the viewer's own unless a test sets one.
export function clockTime(at: number, timeZone?: string) {
    return new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone })
        .format(at)
        .replace(/\s+/g, " ")
}

// A clock a little ahead of NOAA's would make the newest scans look like they're from the future.
const shortAge = (ms: number) => formatAge(Math.max(0, ms))

// formatAge's words in full, for screen readers, which would read "min" as "minimum".
function spokenAge(ms: number) {
    const minutes = Math.floor(Math.max(0, ms) / 60_000)
    if (minutes < 1) {
        return "just now"
    }
    if (minutes < 60) {
        return `${minutes} ${minutes === 1 ? "minute" : "minutes"} ago`
    }
    const hours = Math.floor(minutes / 60)
    return `${hours} ${hours === 1 ? "hour" : "hours"} ago`
}

// What the tape says under itself: "1:48 PM, 40 min ago", or "2:26 PM, latest" for the newest scan.
export function readout(scan: Scan, latest: boolean, now: number, timeZone?: string) {
    return `${clockTime(scan.at, timeZone)}, ${latest ? "latest" : shortAge(now - scan.at)}`
}

// The same, as a screen reader says it: "1:48 PM, 40 minutes ago".
export function spokenReadout(scan: Scan, latest: boolean, now: number, timeZone?: string) {
    return `${clockTime(scan.at, timeZone)}, ${latest ? "latest" : spokenAge(now - scan.at)}`
}
