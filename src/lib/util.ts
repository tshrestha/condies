import type { Period, QuantitativeValue } from "./nws.ts"

const snowForecastRegex = /(snow)(\saccumulation)?/gi
const snowDepthRegex = /(\d+)(?:\sto\s)?(\d+)?\sinches/

export function getLatLon(path: string) {
    const segments = path.split("/")
    const point = segments.pop() as string
    const [lat, lon] = point.split(",")
    return { lat, lon }
}

export function getPrecipType(forecast: string) {
    const tokens = forecast.toLowerCase().split(" ")
    return tokens.includes("snow") ? "snow" : "rain"
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
            { enableHighAccuracy: true, timeout: 5000 },
        )
    })
}

export function getTimeOfDay() {
    const date = new Date()
    const hours = date.getHours()

    if (hours >= 5 && hours < 9) {
        return "morning"
    }

    if (hours >= 9 && hours < 17) {
        return "day"
    }

    if (hours >= 17 && hours < 20) {
        return "evening"
    }

    return "night"
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
    if (windGust) {
        return false
    }
    if (tooWindy(windSpeed)) {
        return false
    }

    const p = /(mostly\s)?sunny/g
    return p.test(shortForecast.toLowerCase())
}

export function getTotalSnowAccumulation({ periods, index }: { periods: Period[]; index: number }) {
    const accumulations = []
    for (let i = index; i >= 0 && index - i <= 2; i--) {
        const { detailedForecast } = periods[i]
        if (snowForecastRegex.test(detailedForecast)) {
            const match = detailedForecast.match(snowDepthRegex)
            if (match && match.length === 2) {
                accumulations.push(parseInt(match[1]))
            }
            if (match && match.length === 3) {
                accumulations.push(parseInt(match[1]))
                accumulations.push(parseInt(match[2]))
            }
        }
    }

    console.log("accumulations", accumulations)
    if (accumulations.length) {
        const total = accumulations.reduce((a, b) => a + b)
        console.log("total accumulation", total)
        return total
    }

    return 0
}

export function isPowDay({ condies, periods, index, ignoreIsDaytime = false, ignoreTemp = true }: {
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
