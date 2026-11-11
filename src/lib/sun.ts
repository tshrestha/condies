const apiURL = "https://aa.usno.navy.mil/api/rstt/oneday"

export interface SunTimes {
    sunrise: string
    sunset: string
    // Local clock hours with minutes as a fraction, such as 7.3 for 7:18 AM, for drawing the day's light.
    sunriseHour: number
    sunsetHour: number
}

// Today's date and UTC offset at the forecast location, which can differ from the viewer's.
export function getLocalDateAndOffset(timeZone: string, now = new Date()) {
    const parts = new Intl.DateTimeFormat("en-US", {
        timeZone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        timeZoneName: "longOffset",
    }).formatToParts(now)
    const part = (type: string) => parts.find((p) => p.type === type)!.value

    const [, sign, hours, minutes] = part("timeZoneName").match(/GMT(?:([+-])(\d+):(\d+))?/)!
    const offset = hours ? parseInt(hours, 10) + parseInt(minutes, 10) / 60 : 0

    return { date: `${part("year")}-${part("month")}-${part("day")}`, offset: sign === "-" ? -offset : offset }
}

// The API gives 24-hour "HH:MM" local times.
export function readSunTime(time: string) {
    const [hours, minutes] = time.split(":")
    const hour = parseInt(hours, 10)
    return {
        label: `${hour % 12 || 12}:${minutes} ${hour < 12 ? "AM" : "PM"}`,
        hour: hour + parseInt(minutes, 10) / 60,
    }
}

// Sunrise and sunset for today at the place. A failed response is logged and gives null; a network failure
// throws, for the caller to treat as an optional extra.
export async function getSunTimes(lat: string, lon: string, timeZone: string): Promise<SunTimes | null> {
    const { date, offset } = getLocalDateAndOffset(timeZone)

    const response = await fetch(`${apiURL}?date=${date}&tz=${offset}&coords=${lat},${lon}&id=ElevationCodeWorksLLC`)
    if (!response.ok) {
        console.error("failed to get sun rise/set data", response.status, response.statusText)
        return null
    }

    const { sundata } = (await response.json()).properties.data as { sundata: Record<string, string>[] }
    const rise = readSunTime(sundata.find((d) => d.phen === "Rise")!.time)
    const set = readSunTime(sundata.find((d) => d.phen === "Set")!.time)
    return { sunrise: rise.label, sunset: set.label, sunriseHour: rise.hour, sunsetHour: set.hour }
}
