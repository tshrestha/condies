import Fuse, { type FuseResult } from "fuse.js"

import ClearDay from "../assets/weather-icons-master/production/fill/all/clear-day.svg"
import ClearNight from "../assets/weather-icons-master/production/fill/all/clear-night.svg"
import Cloudy from "../assets/weather-icons-master/production/fill/all/cloudy.svg"
import Drizzle from "../assets/weather-icons-master/production/fill/all/drizzle.svg"
import FogDay from "../assets/weather-icons-master/production/fill/all/fog-day.svg"
import FogNight from "../assets/weather-icons-master/production/fill/all/fog-night.svg"
import Fog from "../assets/weather-icons-master/production/fill/all/fog.svg"
import Mist from "../assets/weather-icons-master/production/fill/all/mist.svg"
import OvercastDay from "../assets/weather-icons-master/production/fill/all/overcast-day.svg"
import OvercastNight from "../assets/weather-icons-master/production/fill/all/overcast-night.svg"
import Overcast from "../assets/weather-icons-master/production/fill/all/overcast.svg"
import PartlyCloudyDayRain from "../assets/weather-icons-master/production/fill/all/partly-cloudy-day-rain.svg"
import PartlyCloudyDaySnow from "../assets/weather-icons-master/production/fill/all/partly-cloudy-day-snow.svg"
import PartlyCloudyDay from "../assets/weather-icons-master/production/fill/all/partly-cloudy-day.svg"
import PartlyCloudyNightRain from "../assets/weather-icons-master/production/fill/all/partly-cloudy-night-rain.svg"
import PartlyCloudyNightSnow from "../assets/weather-icons-master/production/fill/all/partly-cloudy-night-snow.svg"
import PartlyCloudyNight from "../assets/weather-icons-master/production/fill/all/partly-cloudy-night.svg"
import Rain from "../assets/weather-icons-master/production/fill/all/rain.svg"
import Sleet from "../assets/weather-icons-master/production/fill/all/sleet.svg"
import Snow from "../assets/weather-icons-master/production/fill/all/snow.svg"
import ThunderstormsDayRain from "../assets/weather-icons-master/production/fill/all/thunderstorms-day-rain.svg"
import ThunderstormsDay from "../assets/weather-icons-master/production/fill/all/thunderstorms-day.svg"
import ThunderstormsNightRain from "../assets/weather-icons-master/production/fill/all/thunderstorms-night-rain.svg"
import ThunderstormsNight from "../assets/weather-icons-master/production/fill/all/thunderstorms-night.svg"
import ThunderstormsSnow from "../assets/weather-icons-master/production/fill/all/thunderstorms-snow.svg"
import Thunderstorms from "../assets/weather-icons-master/production/fill/all/thunderstorms.svg"

import iconIndexJson from "../assets/icon.index.json"

export interface Icon {
    path: string
    keywords: string[]
    day?: boolean
    night?: boolean
    icon: string
}

export const icons = [
    {
        path: "./assets/weather-icons-master/production/fill/all/clear-day.svg",
        keywords: ["sunny", "mostly sunny"],
        day: true,
        night: false,
        icon: ClearDay,
    },
    {
        path: "./assets/weather-icons-master/production/fill/all/clear-night.svg",
        keywords: ["clear", "mostly clear"],
        day: false,
        night: true,
        icon: ClearNight,
    },
    {
        path: "./assets/weather-icons-master/production/fill/all/cloudy.svg",
        keywords: ["cloudy"],
        day: true,
        night: true,
        icon: Cloudy,
    },
    {
        path: "./assets/weather-icons-master/production/fill/all/cloudy.svg",
        keywords: ["cloudy"],
        day: true,
        night: false,
        icon: Cloudy,
    },
    {
        path: "./assets/weather-icons-master/production/fill/all/cloudy.svg",
        keywords: ["cloudy"],
        day: false,
        night: true,
        icon: Cloudy,
    },
    {
        path: "./assets/weather-icons-master/production/fill/all/overcast.svg",
        keywords: ["overcast"],
        day: true,
        night: true,
        icon: Overcast,
    },
    {
        path: "./assets/weather-icons-master/production/fill/all/overcast-day.svg",
        keywords: ["overcast"],
        day: true,
        night: false,
        icon: OvercastDay,
    },
    {
        path: "./assets/weather-icons-master/production/fill/all/overcast-night.svg",
        keywords: ["overcast"],
        day: false,
        night: true,
        icon: OvercastNight,
    },
    {
        path: "./assets/weather-icons-master/production/fill/all/drizzle.svg",
        keywords: ["drizzle", "light rain"],
        day: true,
        night: true,
        icon: Drizzle,
    },
    {
        path: "./assets/weather-icons-master/production/fill/all/rain.svg",
        keywords: ["rain", "moderate rain", "rain showers", "showers likely"],
        day: true,
        night: true,
        icon: Rain,
    },
    {
        path: "./assets/weather-icons-master/production/fill/all/rain.svg",
        keywords: ["rain", "moderate rain", "rain showers", "showers likely"],
        day: true,
        night: false,
        icon: Rain,
    },
    {
        path: "./assets/weather-icons-master/production/fill/all/rain.svg",
        keywords: ["rain", "moderate rain", "rain showers", "showers likely"],
        day: false,
        night: true,
        icon: Rain,
    },
    {
        path: "./assets/weather-icons-master/production/fill/all/partly-cloudy-day-rain.svg",
        keywords: ["light rain"],
        day: true,
        night: false,
        icon: PartlyCloudyDayRain,
    },
    {
        path: "./assets/weather-icons-master/production/fill/all/partly-cloudy-night-rain.svg",
        keywords: ["light rain"],
        day: false,
        night: true,
        icon: PartlyCloudyNightRain,
    },
    {
        path: "./assets/weather-icons-master/production/fill/all/sleet.svg",
        keywords: ["sleet", "freezing rain"],
        day: true,
        night: true,
        icon: Sleet,
    },
    {
        path: "./assets/weather-icons-master/production/fill/all/partly-cloudy-day.svg",
        keywords: ["partly cloudy", "mostly cloudy", "partly sunny"],
        day: true,
        night: false,
        icon: PartlyCloudyDay,
    },
    {
        path: "./assets/weather-icons-master/production/fill/all/partly-cloudy-night.svg",
        keywords: ["partly cloudy", "mostly cloudy"],
        day: false,
        night: true,
        icon: PartlyCloudyNight,
    },
    {
        path: "./assets/weather-icons-master/production/fill/all/mist.svg",
        keywords: ["mist"],
        day: true,
        night: true,
        icon: Mist,
    },
    {
        path: "./assets/weather-icons-master/production/fill/all/thunderstorms.svg",
        keywords: ["thunder", "thunderstorms", "thunder storms"],
        day: true,
        night: true,
        icon: Thunderstorms,
    },
    {
        path: "./assets/weather-icons-master/production/fill/all/thunderstorms-day.svg",
        keywords: ["thunder", "thunderstorms", "thunder storms"],
        day: true,
        night: false,
        icon: ThunderstormsDay,
    },
    {
        path: "./assets/weather-icons-master/production/fill/all/thunderstorms-night.svg",
        keywords: ["thunder", "thunderstorms", "thunder storms"],
        day: false,
        night: true,
        icon: ThunderstormsNight,
    },
    {
        path: "./assets/weather-icons-master/production/fill/all/thunderstorms-day-rain.svg",
        keywords: ["thunder", "thunderstorms", "thunder storms"],
        day: true,
        nigh: false,
        icon: ThunderstormsDayRain,
    },
    {
        path: "./assets/weather-icons-master/production/fill/all/thunderstorms-night-rain.svg",
        keywords: ["thunder", "thunderstorms", "thunder storms"],
        day: false,
        night: true,
        icon: ThunderstormsNightRain,
    },
    {
        path: "./assets/weather-icons-master/production/fill/all/thunderstorms-snow.svg",
        keywords: ["thunder snow"],
        day: true,
        night: true,
        icon: ThunderstormsSnow,
    },
    {
        path: "./assets/weather-icons-master/production/fill/all/fog.svg",
        keywords: ["fog", "foggy"],
        day: true,
        night: true,
        icon: Fog,
    },
    {
        path: "./assets/weather-icons-master/production/fill/all/fog-day.svg",
        keywords: ["fog", "foggy"],
        day: true,
        night: false,
        icon: FogDay,
    },
    {
        path: "./assets/weather-icons-master/production/fill/all/fog-night.svg",
        keywords: ["fog", "foggy"],
        day: false,
        night: true,
        icon: FogNight,
    },
    {
        path: "./assets/weather-icons-master/production/fill/all/snow.svg",
        keywords: ["snow", "blowing snow", "snow showers", "snow showers likely"],
        day: true,
        night: true,
        icon: Snow,
    },
    {
        path: "./assets/weather-icons-master/production/fill/all/snow.svg",
        keywords: ["snow", "blowing snow", "snow showers", "snow showers likely"],
        day: true,
        night: false,
        icon: Snow,
    },
    {
        path: "./assets/weather-icons-master/production/fill/all/snow.svg",
        keywords: ["snow", "blowing snow", "snow showers", "snow showers likely"],
        day: false,
        night: true,
        icon: Snow,
    },
    {
        path: "./assets/weather-icons-master/production/fill/all/partly-cloudy-day-snow.svg",
        keywords: ["light snow", "snow likely"],
        day: true,
        night: false,
        icon: PartlyCloudyDaySnow,
    },
    {
        path: "./assets/weather-icons-master/production/fill/all/partly-cloudy-night-snow.svg",
        keywords: ["light snow", "snow likely"],
        day: false,
        night: true,
        icon: PartlyCloudyNightSnow,
    },
]

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-expect-error
const iconIndex = Fuse.parseIndex(iconIndexJson)

const fuse = new Fuse(
    icons,
    {
        isCaseSensitive: false,
        keys: ["keywords"],
        includeScore: true,
        shouldSort: true,
    },
    iconIndex,
)

export function getIcon({ keyword, isDay, isNight }: Record<string, string | boolean>) {
    const tokens = (keyword as string).split(" ")

    let searchTerm
    if (tokens.length === 1) {
        searchTerm = tokens.pop()
    } else if (tokens.length === 2) {
        searchTerm = tokens.slice(-2).join(" ")
    } else {
        searchTerm = tokens.slice(-3).join(" ")
    }

    const searchResults: FuseResult<Icon>[] = fuse.search(searchTerm as string)

    const matchedIcons: Icon[] = searchResults.filter((s) => s.score! < 1).map((s) => s.item)

    const filteredIcons = matchedIcons.filter((i) => i && i.day === isDay && i.night === isNight)

    return filteredIcons.length ? filteredIcons[0].icon : ClearDay
}
