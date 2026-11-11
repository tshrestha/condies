import { type Grid, parseGrid } from "./grid.ts"

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
    snowInches?: number
    feelsLike?: number
}

export interface ForecastResult {
    properties: {
        periods: Period[]
        generatedAt?: string
    }
}

export interface Point {
    properties: {
        forecast: string
        forecastHourly: string
        forecastGridData?: string
        observationStations: string
        forecastZone: string
        timeZone: string
        relativeLocation?: {
            properties: {
                city: string
                state: string
            }
        }
    }
}

/**
 * "properties": {
 *                 "@id": "https://api.weather.gov/alerts/urn:oid:2.49.0.1.840.0.a675215faa4fa8f4919432cfbda087bd8650671a.001.1",
 *                 "@type": "wx:Alert",
 *                 "id": "urn:oid:2.49.0.1.840.0.a675215faa4fa8f4919432cfbda087bd8650671a.001.1",
 *                 "areaDesc": "Grand and Battlement Mesas; Gore and Elk Mountains/Central Mountain Valleys; West Elk and Sawatch Mountains; Northwestern San Juan Mountains; Southwest San Juan Mountains",
 *                 "geocode": {
 *                     "SAME": [
 *                         "008029",
 *                         "008045",
 *                         "008077",
 *                         "008037",
 *                         "008097",
 *                         "008051",
 *                         "008085",
 *                         "008053",
 *                         "008091",
 *                         "008113",
 *                         "008007",
 *                         "008033",
 *                         "008067",
 *                         "008083",
 *                         "008111"
 *                     ],
 *                     "UGC": [
 *                         "COZ009",
 *                         "COZ010",
 *                         "COZ012",
 *                         "COZ018",
 *                         "COZ019"
 *                     ]
 *                 },
 *                 "affectedZones": [
 *                     "https://api.weather.gov/zones/forecast/COZ009",
 *                     "https://api.weather.gov/zones/forecast/COZ010",
 *                     "https://api.weather.gov/zones/forecast/COZ012",
 *                     "https://api.weather.gov/zones/forecast/COZ018",
 *                     "https://api.weather.gov/zones/forecast/COZ019"
 *                 ],
 *                 "references": [
 *                     {
 *                         "@id": "https://api.weather.gov/alerts/urn:oid:2.49.0.1.840.0.818474b3e7969bcdfcc7154f431aeb9e90c8cdfb.001.1",
 *                         "identifier": "urn:oid:2.49.0.1.840.0.818474b3e7969bcdfcc7154f431aeb9e90c8cdfb.001.1",
 *                         "sender": "w-nws.webmaster@noaa.gov",
 *                         "sent": "2026-01-22T13:05:00-07:00"
 *                     }
 *                 ],
 *                 "sent": "2026-01-23T02:13:00-07:00",
 *                 "effective": "2026-01-23T02:13:00-07:00",
 *                 "onset": "2026-01-23T05:00:00-07:00",
 *                 "expires": "2026-01-24T02:15:00-07:00",
 *                 "ends": "2026-01-25T05:00:00-07:00",
 *                 "status": "Actual",
 *                 "messageType": "Update",
 *                 "category": "Met",
 *                 "severity": "Moderate",
 *                 "certainty": "Likely",
 *                 "urgency": "Expected",
 *                 "event": "Winter Weather Advisory",
 *                 "sender": "w-nws.webmaster@noaa.gov",
 *                 "senderName": "NWS Grand Junction CO",
 *                 "headline": "Winter Weather Advisory issued January 23 at 2:13AM MST until January 25 at 5:00AM MST by NWS Grand Junction CO",
 *                 "description": "* WHAT...Snow expected. Total snow accumulations between 6 and 12\ninches, with locally higher amounts on favored aspects.\n\n* WHERE...Northwest San Juan Mountains, Southwest San Juan\nMountains, Gore and Elk Mountains/Central Mountain Valleys, Grand\nand Battlement Mesas, and West Elk and Sawatch Mountains.\n\n* WHEN...Until 5 AM MST Sunday.\n\n* IMPACTS...Travel could be very difficult to impossible. The\nhazardous conditions could impact the Friday morning and evening\ncommutes.",
 *                 "instruction": "Slow down and use caution while traveling. The latest road\nconditions for the state you are calling from can be obtained by\ncalling 5 1 1.",
 *                 "response": "Execute",
 *                 "parameters": {
 *                     "AWIPSidentifier": [
 *                         "WSWGJT"
 *                     ],
 *                     "WMOidentifier": [
 *                         "WWUS45 KGJT 230913"
 *                     ],
 *                     "NWSheadline": [
 *                         "WINTER WEATHER ADVISORY REMAINS IN EFFECT UNTIL 5 AM MST SUNDAY"
 *                     ],
 *                     "BLOCKCHANNEL": [
 *                         "EAS",
 *                         "NWEM",
 *                         "CMAS"
 *                     ],
 *                     "VTEC": [
 *                         "/O.CON.KGJT.WW.Y.0003.260123T1200Z-260125T1200Z/"
 *                     ],
 *                     "eventEndingTime": [
 *                         "2026-01-25T05:00:00-07:00"
 *                     ],
 *                     "expiredReferences": [
 *                         "w-nws.webmaster@noaa.gov,urn:oid:2.49.0.1.840.0.337a590588be3521f7696acb88d72b4da3d76ddf.001.1,2026-01-22T02:58:00-07:00 w-nws.webmaster@noaa.gov,urn:oid:2.49.0.1.840.0.26c4511a9d6549eec428b5e6d317e124ba3a3358.001.1,2026-01-21T13:58:00-07:00"
 *                     ]
 *                 },
 *                 "scope": "Public",
 *                 "code": "IPAWSv1.0",
 *                 "language": "en-US",
 *                 "web": "http://www.weather.gov",
 *                 "eventCode": {
 *                     "SAME": [
 *                         "NWS"
 *                     ],
 *                     "NationalWeatherService": [
 *                         "WWY"
 *                     ]
 *                 }
 *             }
 */

export interface Alert {
    severity: "Extreme" | "Severe" | "Moderate" | "Minor" | "Unknown"
    event: string
    headline: string
    description: string
    instruction: string
    descriptions: string[]
}

const headers = {
    "User-Agent": "Elevation Code Works LLC",
}

export function toMph(speed: number) {
    return Math.round(speed * 0.621371)
}

const retryDelaysMs = [400, 1200]

// NWS often answers with a 5xx that works a moment later. With no connection, retrying can't help.
async function fetchWithRetry(url: string, init: RequestInit) {
    for (let attempt = 0; ; attempt++) {
        try {
            const response = await fetch(url, init)
            if (response.status < 500 || attempt === retryDelaysMs.length) {
                return response
            }
        } catch (e) {
            if (attempt === retryDelaysMs.length || !navigator.onLine) {
                throw e
            }
        }
        await new Promise((resolve) => setTimeout(resolve, retryDelaysMs[attempt]))
    }
}

export async function getPoint(lat: string, lon: string) {
    const url = `${weatherURL}/points/${parseFloat(lat).toFixed(4)},${parseFloat(lon).toFixed(4)}`
    const response = await fetchWithRetry(url, { headers })
    if (!response.ok) {
        console.error(`failed to fetch point ${lat},${lon}`)
        return null
    }

    return await response.json()
}

// Adds snow amounts and hourly detail, so a failure here shouldn't affect the main forecast.
export async function getGridForecast(gridURL?: string): Promise<Grid | null> {
    if (!gridURL) {
        return null
    }

    try {
        const response = await fetchWithRetry(gridURL, { headers })
        if (!response.ok) {
            console.error("failed to get grid forecast")
            return null
        }
        return parseGrid(await response.json())
    } catch (e) {
        console.error("failed to get grid forecast", e)
        return null
    }
}

export async function getForecast(forecastURL: string | null) {
    // Some points NWS knows about, like offshore waters, have no forecast.
    if (!forecastURL) {
        return null
    }

    let response: Response
    try {
        response = await fetchWithRetry(`${forecastURL}?units=us`, {
            headers: {
                ...headers,
                "Feature-Flags": "forecast_wind_speed_qv",
            },
        })
    } catch (e) {
        // The daily and hourly forecasts load separately, so one can still show without the other.
        console.error("failed to get forecast", e)
        return null
    }
    if (!response.ok) {
        console.error("failed to get forecast")
        return null
    }

    const result: ForecastResult = await response.json()
    result.properties.periods.forEach((p) => {
        // The API allows null here, and everything downstream expects a number.
        p.probabilityOfPrecipitation.value ??= 0

        if (p.windSpeed && p.windSpeed.unitCode.includes("km_h")) {
            p.windSpeed.value = typeof p.windSpeed.value === "number" ? toMph(p.windSpeed.value) : p.windSpeed.value
            p.windSpeed.minValue =
                typeof p.windSpeed.minValue === "number" ? toMph(p.windSpeed.minValue) : p.windSpeed.minValue
            p.windSpeed.maxValue =
                typeof p.windSpeed.maxValue === "number" ? toMph(p.windSpeed.maxValue) : p.windSpeed.maxValue
            p.windSpeed.unitCode = "mph"
        }
        if (p.windGust && p.windGust.unitCode.includes("km_h")) {
            p.windGust.value = typeof p.windGust.value === "number" ? toMph(p.windGust.value) : p.windGust.value
            p.windGust.unitCode = "mph"
        }
    })

    return result
}

export async function getAlerts(lat: string, lon: string) {
    // Looking up by point also finds county and fire-zone alerts, such as tornado warnings.
    const point = `${parseFloat(lat).toFixed(4)},${parseFloat(lon).toFixed(4)}`
    try {
        const response = await fetchWithRetry(`${weatherURL}/alerts/active?status=actual&point=${point}`, {
            headers: { ...headers },
        })
        if (response.ok) {
            return await response.json()
        }
        console.error("failed to get alerts for point:", point)
    } catch (e) {
        console.error("failed to get alerts for point:", point, e)
    }
    return null
}
