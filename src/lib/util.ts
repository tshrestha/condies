import type { Period, QuantitativeValue } from "./nws.ts"

// NWS wording, like "New snow accumulation of 3 to 5 inches" or "snow accumulation of around 8 inches".
const snowAccumulationRegex = /snow accumulation of (?:around |up to )?(\d+)(?:\sto\s(\d+))?\sinch/i

export function getLatLon(path: string) {
    const segments = path.split("/")
    const point = segments.pop() as string
    const [lat, lon] = point.split(",")
    return { lat, lon }
}

export function getPrecipType(forecast: string) {
    return /\bsnow\b/i.test(forecast) ? "snow" : "rain"
}

// NWS timestamps carry the forecast location's own date, so read it directly from the text.
export function getWeekday(isoTime: string) {
    return new Date(`${isoTime.slice(0, 10)}T12:00:00Z`).toLocaleDateString("en-US", {
        weekday: "short",
        timeZone: "UTC",
    })
}

export function getLocation() {
    return new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
            (p) => {
                resolve(p)
            },
            (e) => {
                reject(e)
            },
            // Forecasts only need rough coordinates, and waiting for a GPS-quality fix often takes too long.
            { enableHighAccuracy: false, maximumAge: 600_000, timeout: 15_000 },
        )
    })
}

export function getMinMaxTemp(forecastPeriods: Period[]) {
    const min = forecastPeriods.sort((a, b) => a.temperature - b.temperature)[0]
    const max = forecastPeriods.sort((a, b) => b.temperature - a.temperature)[0]
    return [min.temperature, max.temperature]
}

export function getRangeStep({ min, max, desiredStep }: Record<string, number>) {
    // step = ((max - min) / (desiredStep / 100)) / 100
    const diff = max - min
    return Math.round(diff / (desiredStep / 100) / 100)
}

// Maps wind direction to arrow showing where wind is blowing TO
export function getWindArrow(direction: string): string {
    const arrows: Record<string, string> = {
        N: "↓",
        S: "↑",
        E: "←",
        W: "→",
        NE: "↙",
        NW: "↘",
        SE: "↖",
        SW: "↗",
        NNE: "↙",
        NNW: "↘",
        SSE: "↖",
        SSW: "↗",
        ENE: "↙",
        ESE: "↖",
        WNW: "↘",
        WSW: "↗",
    }
    return arrows[direction] || "○"
}

export function tooWindy(windSpeed: QuantitativeValue, threshold = 10) {
    if (windSpeed.maxValue && windSpeed.maxValue > threshold) {
        return true
    }

    return !!(windSpeed.value && windSpeed.value > threshold)
}

export function isPrimo(condies: Period) {
    const { shortForecast, isDaytime, windSpeed, windGust, temperature, probabilityOfPrecipitation } = condies
    if (!isDaytime) {
        return false
    }
    if (probabilityOfPrecipitation.value > 10) {
        return false
    }
    if (temperature < 55 || temperature > 75) {
        return false
    }
    if (windGust && tooWindy(windGust)) {
        return false
    }
    if (tooWindy(windSpeed)) {
        return false
    }

    return /^(mostly )?sunny$/i.test(shortForecast)
}

export function getTotalSnowAccumulation({ periods, index }: { periods: Period[]; index: number }) {
    let total = 0
    for (let i = index; i >= 0 && index - i <= 2; i--) {
        const match = periods[i].detailedForecast.match(snowAccumulationRegex)
        if (match) {
            const low = parseInt(match[1], 10)
            const high = match[2] ? parseInt(match[2], 10) : low
            // A range counts as its midpoint, the best single estimate of what will fall.
            total += (low + high) / 2
        }
    }

    return total
}

export function isPowDay({
    condies,
    periods,
    index,
    ignoreIsDaytime = false,
    ignoreTemp = true,
}: {
    condies: Period
    periods: Period[]
    index: number
    ignoreIsDaytime?: boolean
    ignoreTemp?: boolean
}) {
    const { isDaytime, windSpeed, temperature, probabilityOfPrecipitation } = condies

    if (!isDaytime && !ignoreIsDaytime) {
        return false
    }
    if (temperature > 32 && !ignoreTemp) {
        return false
    }
    if (tooWindy(windSpeed, 20)) {
        return false
    }
    if (probabilityOfPrecipitation.value < 70) {
        return false
    }

    const totalAccuulation = getTotalSnowAccumulation({ periods, index })
    return totalAccuulation >= 6
}
