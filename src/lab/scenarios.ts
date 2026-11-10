import type { AvalancheStatus } from "../lib/avalanche.ts"
import { groupIntoDays } from "../lib/daily.ts"
import type { Grid } from "../lib/grid.ts"
import type { Period } from "../lib/nws.ts"
import { buildForecast, type LabAlert, type LabForecast, type LabSnowDepth, type LabSpot, toLabAlert } from "./data.ts"

const HOUR = 3_600_000
const HOURS = 156

type StormKind = "snow" | "rain" | "thunder"

interface StormConfig {
    from: number
    to: number
    kind: StormKind
    // Snow or rain in inches per hour at the storm's peak.
    rate: number
}

interface ScenarioConfig {
    id: string
    label: string
    city: string
    state: string
    lat: string
    lon: string
    timeZone: string
    elevationFeet: number
    snowLevelFeet: number
    sunrise: number
    sunset: number
    sun: { sunrise: string; sunset: string }
    highs: number[]
    lows: number[]
    skies: number[]
    winds: number[]
    gustiness: number
    windDirections: string[]
    storms: StormConfig[]
    fogHours?: number[]
    haze?: boolean
    rawAlerts: {
        severity: LabAlert["severity"]
        event: string
        headline: string
        description: string
        instruction: string
    }[]
    avalanche?: AvalancheStatus
    snowDepth?: Omit<LabSnowDepth, "measuredAt">
    spots: { name: string; lat: number; lon: number; warmer: number; stormier: number; windier?: number }[]
    search: string[]
}

const lerp = (values: number[], position: number) => {
    const i = Math.max(0, Math.min(values.length - 1, Math.floor(position)))
    const j = Math.min(values.length - 1, i + 1)
    const t = Math.max(0, Math.min(1, position - i))
    return values[i] + (values[j] - values[i]) * t
}

function offsetOf(timeZone: string, time: number) {
    const name = new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: "longOffset" })
        .formatToParts(time)
        .find((p) => p.type === "timeZoneName")!.value
    return name === "GMT" ? "+00:00" : name.replace("GMT", "")
}

function offsetMs(offset: string) {
    const [, sign, h, m] = offset.match(/([+-])(\d+):(\d+)/)!
    return (sign === "-" ? -1 : 1) * (Number(h) * HOUR + Number(m) * 60_000)
}

function toLocalIso(time: number, timeZone: string) {
    const offset = offsetOf(timeZone, time)
    return `${new Date(time + offsetMs(offset)).toISOString().slice(0, 19)}${offset}`
}

const localHourOf = (iso: string) => Number(iso.slice(11, 13))

function stormAt(config: ScenarioConfig, hour: number) {
    for (const storm of config.storms) {
        if (hour >= storm.from && hour < storm.to) {
            const ramp = Math.min(1, (hour - storm.from + 1) / 3, (storm.to - hour) / 3)
            return { storm, intensity: storm.rate * Math.max(0.2, ramp) }
        }
    }
    return undefined
}

const shoulderOf = (config: ScenarioConfig, hour: number) =>
    config.storms.find((s) => (hour >= s.from - 4 && hour < s.from) || (hour >= s.to && hour < s.to + 2))

function hourForecast(config: ScenarioConfig, hour: number, sky: number, isDay: boolean) {
    const active = stormAt(config, hour)
    if (active) {
        const { storm, intensity } = active
        const strength = intensity / storm.rate
        if (storm.kind === "snow") {
            return strength > 0.85 && storm.rate > 0.5
                ? "Heavy Snow"
                : strength > 0.6
                  ? "Snow"
                  : strength > 0.3
                    ? "Light Snow"
                    : "Snow Showers Likely"
        }
        if (storm.kind === "thunder") {
            return strength > 0.7 ? "Showers And Thunderstorms" : "Showers And Thunderstorms Likely"
        }
        return strength > 0.7 ? "Rain" : strength > 0.4 ? "Rain Showers Likely" : "Light Rain"
    }
    const shoulder = shoulderOf(config, hour)
    if (shoulder) {
        return shoulder.kind === "snow"
            ? "Chance Snow Showers"
            : shoulder.kind === "thunder"
              ? "Chance Showers And Thunderstorms"
              : "Slight Chance Rain Showers"
    }
    if (config.fogHours?.includes(hour)) {
        return "Patchy Fog"
    }
    if (config.haze && isDay && sky < 30) {
        return "Haze"
    }
    if (sky < 12) {
        return isDay ? "Sunny" : "Clear"
    }
    if (sky < 35) {
        return isDay ? "Mostly Sunny" : "Mostly Clear"
    }
    if (sky < 65) {
        return isDay ? "Partly Sunny" : "Partly Cloudy"
    }
    return sky < 88 ? "Mostly Cloudy" : "Cloudy"
}

const windWords: Record<string, string> = {
    N: "North",
    NE: "Northeast",
    E: "East",
    SE: "Southeast",
    S: "South",
    SW: "Southwest",
    W: "West",
    NW: "Northwest",
    WNW: "West northwest",
    NNW: "North northwest",
    SSW: "South southwest",
    WSW: "West southwest",
}

function buildScenario(config: ScenarioConfig, startHour: number, warmer = 0, stormier = 1, windier = 0) {
    const adjusted: ScenarioConfig = {
        ...config,
        storms: config.storms.map((s) => ({ ...s, rate: s.rate * stormier })),
    }
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: config.timeZone }).format(Date.now())
    const offset = offsetOf(config.timeZone, Date.now())
    const now = Date.parse(`${today}T${String(startHour).padStart(2, "0")}:00:00${offset}`)

    const grid: Grid = {
        elevation: config.elevationFeet / 3.28084,
        snowfall: new Map(),
        precipitation: new Map(),
        snowLevel: new Map(),
        windChill: new Map(),
        feelsLike: new Map(),
        gust: new Map(),
        sky: new Map(),
    }

    const makeHour = (i: number): Period => {
        const start = now + i * HOUR
        const startTime = toLocalIso(start, config.timeZone)
        const localHour = localHourOf(startTime)
        const dayPosition = (i + startHour) / 24
        const isDaytime = localHour >= config.sunrise && localHour < config.sunset

        const high = lerp(config.highs, dayPosition)
        const low = lerp(config.lows, dayPosition)
        const swing = Math.cos(((localHour - 15) / 24) * 2 * Math.PI)
        const temperature = Math.round((high + low) / 2 + ((high - low) / 2) * swing + 0.7 * Math.sin(i * 1.7) + warmer)

        const active = stormAt(adjusted, i)
        const baseSky = lerp(config.skies, dayPosition)
        const sky = Math.round(active ? 100 : Math.min(100, baseSky + 12 * Math.sin(i / 5)))

        const baseWind = lerp(config.winds, dayPosition)
        const speed = Math.max(0, Math.round(baseWind + 3 * Math.sin(i / 4.5) + (active ? 4 : 0) + windier))
        const gust = Math.round(speed * config.gustiness)
        const windDirection = config.windDirections[Math.floor(i / 19) % config.windDirections.length]

        const snow = active?.storm.kind === "snow" ? active.intensity : 0
        const rain = active && active.storm.kind !== "snow" ? active.intensity : 0
        const precipitation = snow > 0 ? (snow * 25.4) / 10 : rain * 25.4

        const shoulder = shoulderOf(adjusted, i)
        const chance = active
            ? Math.round((60 + (active.intensity / active.storm.rate) * 40) / 5) * 5
            : shoulder
              ? 30
              : Math.round(Math.min(15, baseSky / 8) / 5) * 5

        const feelsLike = temperature - Math.max(0, (speed - 5) * 0.55) * (temperature < 50 ? 1 : 0)
        grid.snowfall.set(start, snow)
        grid.precipitation.set(start, precipitation)
        grid.snowLevel.set(
            start,
            (active?.storm.kind === "snow" ? config.snowLevelFeet : config.snowLevelFeet + 1500) / 3.28084,
        )
        grid.windChill.set(start, feelsLike)
        grid.feelsLike.set(start, feelsLike)
        grid.gust.set(start, gust)
        grid.sky.set(start, sky)

        return {
            number: i + 1,
            name: "",
            startTime,
            endTime: toLocalIso(start + HOUR, config.timeZone),
            isDaytime,
            temperature,
            probabilityOfPrecipitation: { unitCode: "wmoUnit:percent", value: chance },
            dewpoint: { unitCode: "wmoUnit:degF", value: temperature - 8 },
            relativeHumidity: { unitCode: "wmoUnit:percent", value: active ? 90 : 45 },
            windSpeed: { value: speed, unitCode: "mph" },
            windGust: gust > speed + 4 ? { value: gust, unitCode: "mph" } : undefined,
            windDirection,
            shortForecast: hourForecast(adjusted, i, sky, isDaytime),
            detailedForecast: "",
            hourString: `${localHour % 12 || 12} ${localHour < 12 ? "AM" : "PM"}`,
            snowInches: snow,
            feelsLike: Math.round(feelsLike),
        }
    }

    // The 24 hours before now count toward fresh snow in the score.
    for (let i = -24; i < 0; i++) {
        makeHour(i)
    }
    const hours = Array.from({ length: HOURS }, (_, i) => makeHour(i))

    return { now, grid, hours, periods: toPeriods(hours, grid, startHour) }
}

const weekdayOf = (iso: string) =>
    new Date(`${iso.slice(0, 10)}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" })

// Rolls the hours up into the alternating day and night periods that NWS sends.
function toPeriods(hours: Period[], grid: Grid, startHour: number): Period[] {
    const blocks: Period[][] = []
    let block: Period[] = []
    let blockIsDay: boolean | undefined
    for (const hour of hours) {
        const local = localHourOf(hour.startTime)
        const isDay = local >= 6 && local < 18
        if (blockIsDay !== undefined && isDay !== blockIsDay) {
            blocks.push(block)
            block = []
        }
        blockIsDay = isDay
        block.push(hour)
    }
    if (block.length >= 12) {
        blocks.push(block)
    }

    const severity = (forecast: string) =>
        [
            /Sunny|Clear/,
            /Haze|Partly/,
            /Mostly Cloudy|Cloudy/,
            /Fog/,
            /Slight|Chance/,
            /Likely/,
            /Light/,
            /Rain|Snow$/,
            /Thunder|Heavy/,
        ].reduce((level, pattern, i) => (pattern.test(forecast) ? i : level), -1)
    const worst = (list: Period[]) =>
        list.reduce((a, b) => (severity(b.shortForecast) > severity(a.shortForecast) ? b : a)).shortForecast

    return blocks.slice(0, 14).map((list, i) => {
        const first = list[0]
        const isDay = localHourOf(first.startTime) >= 6 && localHourOf(first.startTime) < 18
        const weekday = weekdayOf(first.startTime)
        let name = isDay ? weekday : `${weekday} Night`
        if (i === 0) {
            name = isDay ? (startHour >= 12 ? "This Afternoon" : "Today") : startHour < 6 ? "Overnight" : "Tonight"
        } else if (i === 1 && !isDay) {
            name = "Tonight"
        }

        // A 6-to-6 block overlaps sunrise and sunset, so "Clear" before dawn shouldn't describe the day.
        const lit = list.filter((p) => p.isDaytime === isDay)
        const described = lit.length ? lit : list
        const half = Math.ceil(described.length / 2)
        const early = worst(described.slice(0, half))
        const late = described.length > half ? worst(described.slice(half)) : early
        const shortForecast = early === late ? early : `${early} then ${late}`

        const temperatures = list.map((p) => p.temperature)
        const temperature = isDay ? Math.max(...temperatures) : Math.min(...temperatures)
        const speeds = list.map((p) => p.windSpeed.value ?? 0)
        const minValue = Math.min(...speeds)
        const maxValue = Math.max(...speeds)
        const gusts = list.map((p) => p.windGust?.value ?? 0)
        const gust = Math.max(...gusts)
        const chance = Math.max(...list.map((p) => p.probabilityOfPrecipitation.value))
        const snowTotal = list.reduce((total, p) => total + (grid.snowfall.get(Date.parse(p.startTime)) ?? 0), 0)
        const direction = first.windDirection

        const sentences = [
            `${shortForecast}.`,
            `${isDay ? "High near" : "Low around"} ${temperature}.`,
            `${windWords[direction] ?? direction} wind ${minValue} to ${maxValue} mph${
                gust ? `, with gusts as high as ${gust} mph` : ""
            }.`,
        ]
        if (chance >= 20) {
            sentences.push(`Chance of precipitation is ${chance}%.`)
        }
        if (snowTotal >= 1) {
            sentences.push(
                `New snow accumulation of ${Math.max(1, Math.floor(snowTotal - 1))} to ${Math.ceil(snowTotal + 1)} inches possible.`,
            )
        }

        return {
            ...first,
            number: i + 1,
            name,
            startTime: first.startTime,
            endTime: list.at(-1)!.endTime,
            isDaytime: isDay,
            temperature,
            probabilityOfPrecipitation: { unitCode: "wmoUnit:percent", value: chance },
            windSpeed: { minValue, maxValue, unitCode: "mph" },
            windGust: gust ? { value: gust, unitCode: "mph" } : undefined,
            windDirection: direction,
            shortForecast,
            detailedForecast: sentences.join(" "),
        }
    })
}

const utah = [
    { name: "Alta", lat: 40.58, lon: -111.64, warmer: 0, stormier: 1 },
    { name: "Snowbird", lat: 40.58, lon: -111.66, warmer: 1, stormier: 0.92, windier: 12 },
    { name: "Brighton", lat: 40.6, lon: -111.58, warmer: 2, stormier: 0.8, windier: 20 },
    { name: "Park City Mountain", lat: 40.65, lon: -111.51, warmer: 5, stormier: 0.45, windier: 28 },
    { name: "Powder Mountain", lat: 41.38, lon: -111.78, warmer: 3, stormier: 0.6, windier: 16 },
]

const scenarioConfigs: ScenarioConfig[] = [
    {
        id: "pow",
        label: "Pow day",
        city: "Alta",
        state: "UT",
        lat: "40.5884",
        lon: "-111.6386",
        timeZone: "America/Denver",
        elevationFeet: 8530,
        snowLevelFeet: 4200,
        sunrise: 7,
        sunset: 17,
        sun: { sunrise: "7:18 AM", sunset: "5:12 PM" },
        highs: [27, 24, 19, 22, 28, 31, 26, 24],
        lows: [14, 11, 6, 3, 12, 18, 14, 10],
        skies: [95, 90, 30, 10, 25, 70, 95, 80],
        winds: [9, 10, 8, 7, 9, 14, 12, 9],
        gustiness: 1.55,
        windDirections: ["WNW", "NW", "W", "NNW"],
        storms: [
            { from: -14, to: 11, kind: "snow", rate: 1.75 },
            { from: 73, to: 95, kind: "snow", rate: 0.46 },
            { from: 128, to: 138, kind: "snow", rate: 0.18 },
        ],
        rawAlerts: [
            {
                severity: "Severe",
                event: "Winter Storm Warning",
                headline: "Winter Storm Warning issued by NWS Salt Lake City UT",
                description:
                    "* WHAT...Heavy snow expected. Total snow accumulations between 14 and 24 inches, with locally higher amounts on favored aspects.\n\n* WHERE...Wasatch Mountains south of Interstate 80.\n\n* WHEN...Until 5 AM MST Wednesday.\n\n* IMPACTS...Travel could be very difficult to impossible. Little Cottonwood Canyon may close without notice.",
                instruction: "If you must travel, keep an extra flashlight, food, and water in your vehicle.",
            },
            {
                severity: "Moderate",
                event: "Backcountry Avalanche Watch",
                headline: "Avalanche Watch in effect through Wednesday morning",
                description:
                    "* WHAT...Avalanche danger is expected to rise to high.\n\n* WHERE...Wasatch Range.\n\n* IMPACTS...Natural and human triggered avalanches likely.",
                instruction: "Avoid travel on and below steep slopes.",
            },
        ],
        avalanche: {
            center: "Utah Avalanche Center",
            link: "https://utahavalanchecenter.org/",
            rating: {
                level: 4,
                name: "High",
                advice: "Very dangerous avalanche conditions. Travel in avalanche terrain not recommended.",
                warning: "warning",
            },
        },
        snowDepth: {
            depth: 87,
            change: 14,
            station: { name: "Snowbird", miles: 1.2, elevation: 9177 },
        },
        spots: utah,
        search: [
            "Alta, Utah, United States",
            "Altamont, Illinois, United States",
            "Alta Lake, British Columbia, Canada",
        ],
    },
    {
        id: "bluebird",
        label: "Bluebird",
        city: "Telluride",
        state: "CO",
        lat: "37.9375",
        lon: "-107.8123",
        timeZone: "America/Denver",
        elevationFeet: 8750,
        snowLevelFeet: 9500,
        sunrise: 7,
        sunset: 17,
        sun: { sunrise: "7:02 AM", sunset: "5:21 PM" },
        highs: [47, 52, 58, 62, 57, 49, 45, 48],
        lows: [21, 24, 28, 31, 30, 22, 19, 20],
        skies: [8, 5, 4, 10, 18, 35, 28, 15],
        winds: [5, 4, 4, 5, 8, 12, 10, 6],
        gustiness: 1.1,
        windDirections: ["SW", "W"],
        storms: [],
        rawAlerts: [],
        avalanche: {
            center: "Colorado Avalanche Information Center",
            link: "https://avalanche.state.co.us/",
            rating: {
                level: 2,
                name: "Moderate",
                advice: "Heightened avalanche conditions on specific terrain features. Evaluate snow and terrain carefully.",
            },
        },
        snowDepth: { depth: 31, change: 0, station: { name: "Lizard Head Pass", miles: 9.4, elevation: 10200 } },
        spots: [
            { name: "Telluride", lat: 37.94, lon: -107.81, warmer: 0, stormier: 1 },
            { name: "Crested Butte", lat: 38.9, lon: -106.97, warmer: -3, stormier: 1, windier: 7 },
            { name: "Silverton", lat: 37.81, lon: -107.66, warmer: -6, stormier: 1, windier: 13 },
            { name: "Wolf Creek", lat: 37.47, lon: -106.79, warmer: -4, stormier: 1, windier: 4 },
        ],
        search: ["Telluride, Colorado, United States", "Telluride Regional Airport, Colorado, United States"],
    },
    {
        id: "rain",
        label: "Soggy",
        city: "Seattle",
        state: "WA",
        lat: "47.6062",
        lon: "-122.3321",
        timeZone: "America/Los_Angeles",
        elevationFeet: 180,
        snowLevelFeet: 4800,
        sunrise: 7,
        sunset: 16,
        sun: { sunrise: "7:24 AM", sunset: "4:39 PM" },
        highs: [51, 49, 52, 54, 50, 47, 48, 50],
        lows: [44, 42, 43, 46, 44, 39, 38, 41],
        skies: [100, 95, 90, 100, 85, 60, 75, 95],
        winds: [14, 18, 12, 16, 11, 7, 8, 12],
        gustiness: 1.8,
        windDirections: ["S", "SSW", "SW"],
        storms: [
            { from: -5, to: 16, kind: "rain", rate: 0.11 },
            { from: 28, to: 44, kind: "rain", rate: 0.07 },
            { from: 60, to: 88, kind: "rain", rate: 0.16 },
            { from: 136, to: 152, kind: "rain", rate: 0.08 },
        ],
        rawAlerts: [
            {
                severity: "Minor",
                event: "Small Craft Advisory",
                headline: "Small Craft Advisory until 10 PM PST this evening",
                description:
                    "* WHAT...South winds 15 to 25 kt with gusts up to 30 kt.\n\n* WHERE...Puget Sound and Hood Canal.",
                instruction: "Inexperienced mariners should avoid navigating in hazardous conditions.",
            },
        ],
        spots: [
            { name: "Seattle", lat: 47.61, lon: -122.33, warmer: 0, stormier: 1 },
            { name: "Mt Baker", lat: 48.86, lon: -121.68, warmer: -14, stormier: 1.2, windier: 3 },
            { name: "Stevens Pass", lat: 47.75, lon: -121.09, warmer: -12, stormier: 1.1, windier: 6 },
            { name: "Crystal Mountain", lat: 46.93, lon: -121.47, warmer: -10, stormier: 0.9, windier: 1 },
        ],
        search: ["Seattle, Washington, United States", "Seattle Heights, Washington, United States"],
    },
    {
        id: "heat",
        label: "Heat wave",
        city: "Truth or Consequences",
        state: "NM",
        lat: "33.1284",
        lon: "-107.2528",
        timeZone: "America/Denver",
        elevationFeet: 4245,
        snowLevelFeet: 14000,
        sunrise: 6,
        sunset: 20,
        sun: { sunrise: "6:04 AM", sunset: "8:17 PM" },
        highs: [101, 104, 108, 107, 103, 98, 94, 96],
        lows: [72, 75, 79, 78, 74, 69, 66, 67],
        skies: [6, 4, 8, 14, 22, 10, 6, 9],
        winds: [6, 7, 9, 12, 11, 8, 6, 6],
        gustiness: 1.5,
        windDirections: ["S", "SW", "W"],
        storms: [],
        haze: true,
        rawAlerts: [
            {
                severity: "Severe",
                event: "Extreme Heat Warning",
                headline: "Extreme Heat Warning until 9 PM MDT Thursday",
                description:
                    "* WHAT...Dangerously hot conditions with temperatures up to 108.\n\n* WHERE...Sierra County Lakes.\n\n* WHEN...Until 9 PM MDT Thursday.\n\n* IMPACTS...Heat related illnesses increase significantly during extreme heat events.",
                instruction: "Drink plenty of fluids, stay in an air-conditioned room, and stay out of the sun.",
            },
        ],
        spots: [
            { name: "Truth or Consequences", lat: 33.13, lon: -107.25, warmer: 0, stormier: 1 },
            { name: "Moab", lat: 38.57, lon: -109.55, warmer: -6, stormier: 1, windier: 4 },
            { name: "Zion Canyon", lat: 37.2, lon: -112.99, warmer: -3, stormier: 1, windier: 1 },
        ],
        search: ["Truth or Consequences, New Mexico, United States"],
    },
    {
        id: "thunder",
        label: "Tornado week",
        city: "Moore",
        state: "OK",
        lat: "35.3395",
        lon: "-97.4867",
        timeZone: "America/Chicago",
        elevationFeet: 1200,
        snowLevelFeet: 13000,
        sunrise: 6,
        sunset: 20,
        sun: { sunrise: "6:31 AM", sunset: "8:29 PM" },
        highs: [86, 83, 79, 74, 81, 85, 88, 84],
        lows: [67, 64, 58, 54, 59, 64, 68, 66],
        skies: [55, 80, 60, 30, 20, 45, 70, 60],
        winds: [17, 22, 15, 9, 8, 13, 19, 16],
        gustiness: 1.9,
        windDirections: ["SSW", "S", "SW", "W"],
        storms: [
            { from: 2, to: 9, kind: "thunder", rate: 0.65 },
            { from: 26, to: 36, kind: "thunder", rate: 0.5 },
            { from: 122, to: 132, kind: "thunder", rate: 0.4 },
        ],
        fogHours: [64, 65, 66, 67, 88, 89, 90],
        rawAlerts: [
            {
                severity: "Extreme",
                event: "Tornado Watch",
                headline: "Tornado Watch issued until 9 PM CDT",
                description:
                    "* WHAT...A few tornadoes likely, with hail up to 2 inches and wind gusts to 75 mph.\n\n* WHERE...Central Oklahoma.\n\n* WHEN...Until 9 PM CDT this evening.",
                instruction: "Be ready to move to a place of safety if a warning is issued for your area.",
            },
            {
                severity: "Severe",
                event: "Severe Thunderstorm Warning",
                headline: "Severe Thunderstorm Warning until 4:15 PM CDT",
                description:
                    "* WHAT...70 mph wind gusts and quarter size hail.\n\n* IMPACTS...Expect damage to roofs, siding, and trees.",
                instruction: "Move to an interior room on the lowest floor of a building.",
            },
            {
                severity: "Minor",
                event: "Heat Advisory",
                headline: "Heat Advisory until 7 PM CDT",
                description: "* WHAT...Heat index values up to 105.",
                instruction: "Drink plenty of fluids.",
            },
        ],
        spots: [
            { name: "Moore", lat: 35.34, lon: -97.49, warmer: 0, stormier: 1 },
            { name: "Norman", lat: 35.22, lon: -97.44, warmer: 0, stormier: 0.9, windier: 2 },
            { name: "Wichita Mountains", lat: 34.74, lon: -98.71, warmer: -2, stormier: 0.7, windier: 5 },
        ],
        search: ["Moore, Oklahoma, United States", "Moorefield, West Virginia, United States"],
    },
]

export const scenarios = scenarioConfigs.map(({ id, label }) => ({ id, label }))

export function loadScenario(
    id: string,
    startHour: number,
): { forecast: LabForecast; spots: LabSpot[]; searchSamples: string[] } {
    const config = scenarioConfigs.find((s) => s.id === id) ?? scenarioConfigs[0]
    const { now, grid, hours, periods } = buildScenario(config, startHour)

    const spots = config.spots.map((spot) => {
        const built = buildScenario(config, startHour, spot.warmer, spot.stormier, spot.windier)
        return {
            name: spot.name,
            lat: spot.lat,
            lon: spot.lon,
            days: groupIntoDays(built.periods, { grid: built.grid, hourly: built.hours }),
        }
    })

    const parseHour = (label: string) => {
        const [time, meridiem] = label.split(" ")
        const [h, m] = time.split(":").map(Number)
        return (h % 12) + (meridiem === "PM" ? 12 : 0) + m / 60
    }

    const forecast = buildForecast({
        place: {
            city: config.city,
            state: config.state,
            lat: config.lat,
            lon: config.lon,
            timeZone: config.timeZone,
            elevationFeet: config.elevationFeet,
        },
        now,
        periods,
        hours,
        grid,
        alerts: config.rawAlerts.map(toLabAlert),
        sun: {
            ...config.sun,
            sunriseHour: parseHour(config.sun.sunrise),
            sunsetHour: parseHour(config.sun.sunset),
        },
        avalanche: config.avalanche,
        snowDepth: config.snowDepth && { ...config.snowDepth, measuredAt: now - 40 * 60_000 },
        updatedAt: new Date(now - 22 * 60_000).toISOString(),
    })

    return { forecast, spots, searchSamples: config.search }
}
