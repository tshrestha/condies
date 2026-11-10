import type { Period } from "./nws.ts"

export interface Sky {
    kind: "clear" | "cloudy" | "rain" | "snow" | "storm" | "fog"
    time: "day" | "night" | "dawn" | "dusk"
}

function getKind(forecast: string): Sky["kind"] {
    if (/thunder|t-?storm/.test(forecast)) {
        return "storm"
    }
    if (/snow|sleet|flurries|blizzard|wintry/.test(forecast)) {
        return "snow"
    }
    if (/rain|shower|drizzle/.test(forecast)) {
        return "rain"
    }
    if (/fog|mist|haze|smoke|dust/.test(forecast)) {
        return "fog"
    }
    return /overcast|cloudy/.test(forecast) && !/partly/.test(forecast) ? "cloudy" : "clear"
}

// NWS flips isDaytime at sunrise and sunset, so a change in the next hour means the sun is on the horizon.
export function getSky(current: Period, next?: Period): Sky {
    const kind = getKind(current.shortForecast.toLowerCase())
    const sunIsChanging = kind === "clear" && next !== undefined && next.isDaytime !== current.isDaytime

    if (sunIsChanging) {
        return { kind, time: current.isDaytime ? "dusk" : "dawn" }
    }
    return { kind, time: current.isDaytime ? "day" : "night" }
}
