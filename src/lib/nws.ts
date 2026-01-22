export const weatherURL = "https://api.weather.gov"

export const denver = {
    lat: "39.7643918",
    lon: "-105.019559",
}

export interface QuantitativeValue {
    value?: number
    minValue?: number
    maxValue?: number
    unitCode: string
}

export interface Period {
    number: number
    name: string
    startTime: string
    endTime: string
    isDaytime: boolean
    temperature: number
    probabilityOfPrecipitation: {
        unitCode: string
        value: number
    }
    dewpoint: {
        unitCode: string
        value: number
    }
    relativeHumidity: {
        unitCode: string
        value: number
    }
    windSpeed: QuantitativeValue
    windGust?: QuantitativeValue
    windDirection: string
    shortForecast: string
    detailedForecast: string
    hourString: string
}

export interface HourlyForecast {
    minTemp: number
    maxTemp: number
    periods: Period[]
}

export interface ForecastResult {
    properties: {
        periods: Period[]
    }
}

export interface Point {
    properties: {
        forecast: string
        forecastHourly: string
        forcastGridData: string
        observationStations: string
    }
}

export interface Station {
    properties: {
        stationIdentifier: string
        name: string
    }
}

export interface StationsResult {
    features: Station[]
}

export interface LatestObservations {
    properties: {
        stationName: string
        temperature: {
            value: number
            minValue: number
            maxValue: number
            unitCode: string
        }
        textDescription: string
    }
}

export interface BeaufortScale {
    force: number
    mphMin: number
    mphMax: number
    description: string
}

const headers = {
    "User-Agent": "Elevation Code Works LLC",
}

export const beaufortScale: BeaufortScale[] = [
    { force: 0, mphMin: 0, mphMax: 1, description: "Calm" },
    { force: 1, mphMin: 1, mphMax: 3, description: "Light Air" },
    { force: 2, mphMin: 4, mphMax: 7, description: "Light Breeze" },
    { force: 3, mphMin: 8, mphMax: 12, description: "Gentle Breeze" },
    {
        force: 4,
        mphMin: 13,
        mphMax: 18,
        description: "Moderate Breeze",
    },
    {
        force: 5,
        mphMin: 19,
        mphMax: 24,
        description: "Fresh Breeze",
    },
    { force: 6, mphMin: 25, mphMax: 31, description: "Strong Breeze" },
    { force: 7, mphMin: 32, mphMax: 38, description: "Near Gale" },
    { force: 8, mphMin: 39, mphMax: 46, description: "Gale" },
    { force: 9, mphMin: 47, mphMax: 54, description: "Severe Gale" },
    { force: 10, mphMin: 55, mphMax: 63, description: "Storm" },
    { force: 11, mphMin: 64, mphMax: 72, description: "Violent Storm" },
    { force: 12, mphMin: 72, mphMax: 83, description: "Hurricane" },
]

export function toBeaufortForce(windSpeed: number): number {
    if (windSpeed > 83) {
        return 12
    }
    if (windSpeed < 0) {
        return 0
    }
    let beauf = beaufortScale.find(({ mphMin, mphMax }) => windSpeed >= mphMin && windSpeed <= mphMax)
    return beauf!.force
}

export function toF(temp: number) {
    return Math.round((temp * 9) / 5 + 32)
}

export function toMph(speed: number) {
    return Math.round(speed * 0.621371)
}

export async function getPoint(lat: string, lon: string) {
    const response = await fetch(`${weatherURL}/points/${parseFloat(lat).toFixed(4)},${parseFloat(lon).toFixed(4)}`, {
        headers,
    })
    if (!response.ok) {
        console.error(`failed to fetch point ${lat},${lon}`)
        return null
    }

    return await response.json()
}

export async function getClosestStation(stationsURL: string) {
    const response = await fetch(`${stationsURL}?limit=1`, { headers })
    if (!response.ok) {
        console.error("failed to get stations")
        return null
    }

    const stations = (await response.json()) as StationsResult
    return stations.features[0]
}

export async function getLatestObservations(stationID: string) {
    const response = await fetch(`${weatherURL}/stations/${stationID}/observations/latest`, {
        headers,
    })
    if (!response.ok) {
        console.error("failed to get latest observations")
        return null
    }

    return await response.json()
}

export async function getForecast(forecastURL: string) {
    const response = await fetch(`${forecastURL}?units=us`, {
        headers: {
            ...headers,
            "Feature-Flags": "forecast_wind_speed_qv",
        },
    })
    if (!response.ok) {
        console.error("failed to get forecast")
        return null
    }

    const result: ForecastResult = await response.json()
    result.properties.periods.forEach((p) => {
        if (p.windSpeed && p.windSpeed.unitCode.includes("km_h")) {
            p.windSpeed.value = typeof p.windSpeed.value === "number" ? toMph(p.windSpeed.value) : p.windSpeed.value
            p.windSpeed.minValue = typeof p.windSpeed.minValue === "number"
                ? toMph(p.windSpeed.minValue)
                : p.windSpeed.minValue
            p.windSpeed.maxValue = typeof p.windSpeed.maxValue === "number"
                ? toMph(p.windSpeed.maxValue)
                : p.windSpeed.maxValue
            p.windSpeed.unitCode = "mph"
        }
        if (p.windGust && p.windGust.unitCode.includes("km_h")) {
            p.windGust.value = typeof p.windGust.value === "number" ? toMph(p.windGust.value) : p.windGust.value
            p.windGust.unitCode = "mph"
        }
    })

    return result
}
