import { formatSnow } from "./daily.ts"
import type { Grid } from "./grid.ts"

const HOUR = 3_600_000
// Snow that pauses for less than this is still the same storm.
const MAX_GAP = 6 * HOUR
const MIN_STORM_INCHES = 1
const TRACE_INCHES = 0.01

export interface Storm {
    start: number
    end: number
    inches: number
}

// The first stretch of snow still to come. If it's already snowing, only what's left is counted.
export function findNextStorm(snowfall: Grid["snowfall"], now: number): Storm | undefined {
    const snowyHours = [...snowfall]
        .filter(([hour, inches]) => inches >= TRACE_INCHES && hour + HOUR > now)
        .sort(([a], [b]) => a - b)

    let storm: Storm | undefined
    for (const [hour, inches] of snowyHours) {
        if (storm && hour - storm.end >= MAX_GAP) {
            if (storm.inches >= MIN_STORM_INCHES) {
                return storm
            }
            storm = undefined
        }
        storm ??= { start: hour, end: hour, inches: 0 }
        storm.end = hour + HOUR
        storm.inches += inches
    }
    return storm && storm.inches >= MIN_STORM_INCHES ? storm : undefined
}

function localParts(time: number, timeZone: string) {
    const parts = new Intl.DateTimeFormat("en-US", {
        timeZone,
        weekday: "short",
        day: "numeric",
        hour: "numeric",
        hourCycle: "h23",
    }).formatToParts(time)
    const part = (type: string) => parts.find((p) => p.type === type)!.value
    return { weekday: part("weekday"), day: part("day"), hour: Number(part("hour")) }
}

// The small hours count as the night before, which is how people talk about them.
function nightAdjusted(time: number, timeZone: string) {
    const shifted = localParts(time, timeZone).hour < 5 ? time - 6 * HOUR : time
    return localParts(shifted, timeZone)
}

// Snow amounts come in 6-hour blocks, so a part of the day is as exact as this can honestly be.
function describeTime(time: number, timeZone: string, now: number) {
    const { hour } = localParts(time, timeZone)
    const part = hour >= 5 && hour < 12 ? "morning" : hour >= 12 && hour < 17 ? "afternoon" : "night"

    const { weekday, day } = nightAdjusted(time, timeZone)
    if (day === nightAdjusted(now, timeZone).day) {
        return part === "night" ? "tonight" : `this ${part}`
    }
    return `${weekday} ${part}`
}

export function describeStorm(storm: Storm, timeZone: string, now: number) {
    const amount = formatSnow(storm.inches)
    // The end is the first hour without snow, so step back into the last one with it.
    const until = describeTime(storm.end - 1, timeZone, now)
    if (storm.start <= now) {
        return `Snow through ${until} · ${amount} more`
    }

    const from = describeTime(storm.start, timeZone, now)
    return from === until ? `Snow ${from} · ${amount}` : `Snow from ${from} to ${until} · ${amount}`
}
