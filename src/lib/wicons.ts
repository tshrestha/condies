import ClearDay from "../assets/weather-icons-master/production/fill/all/clear-day.svg"
import ClearNight from "../assets/weather-icons-master/production/fill/all/clear-night.svg"
import Cloudy from "../assets/weather-icons-master/production/fill/all/cloudy.svg"
import Drizzle from "../assets/weather-icons-master/production/fill/all/drizzle.svg"
import DustDay from "../assets/weather-icons-master/production/fill/all/dust-day.svg"
import DustNight from "../assets/weather-icons-master/production/fill/all/dust-night.svg"
import FogDay from "../assets/weather-icons-master/production/fill/all/fog-day.svg"
import FogNight from "../assets/weather-icons-master/production/fill/all/fog-night.svg"
import HazeDay from "../assets/weather-icons-master/production/fill/all/haze-day.svg"
import HazeNight from "../assets/weather-icons-master/production/fill/all/haze-night.svg"
import Mist from "../assets/weather-icons-master/production/fill/all/mist.svg"
import OvercastDay from "../assets/weather-icons-master/production/fill/all/overcast-day.svg"
import OvercastNight from "../assets/weather-icons-master/production/fill/all/overcast-night.svg"
import PartlyCloudyDayRain from "../assets/weather-icons-master/production/fill/all/partly-cloudy-day-rain.svg"
import PartlyCloudyDaySnow from "../assets/weather-icons-master/production/fill/all/partly-cloudy-day-snow.svg"
import PartlyCloudyDay from "../assets/weather-icons-master/production/fill/all/partly-cloudy-day.svg"
import PartlyCloudyNightRain from "../assets/weather-icons-master/production/fill/all/partly-cloudy-night-rain.svg"
import PartlyCloudyNightSnow from "../assets/weather-icons-master/production/fill/all/partly-cloudy-night-snow.svg"
import PartlyCloudyNight from "../assets/weather-icons-master/production/fill/all/partly-cloudy-night.svg"
import Rain from "../assets/weather-icons-master/production/fill/all/rain.svg"
import Sleet from "../assets/weather-icons-master/production/fill/all/sleet.svg"
import Smoke from "../assets/weather-icons-master/production/fill/all/smoke.svg"
import Snow from "../assets/weather-icons-master/production/fill/all/snow.svg"
import ThunderstormsDayRain from "../assets/weather-icons-master/production/fill/all/thunderstorms-day-rain.svg"
import ThunderstormsDay from "../assets/weather-icons-master/production/fill/all/thunderstorms-day.svg"
import ThunderstormsNightRain from "../assets/weather-icons-master/production/fill/all/thunderstorms-night-rain.svg"
import ThunderstormsNight from "../assets/weather-icons-master/production/fill/all/thunderstorms-night.svg"
import ThunderstormsSnow from "../assets/weather-icons-master/production/fill/all/thunderstorms-snow.svg"

interface IconRule {
    pattern: RegExp
    day: string
    night: string
}

// The first matching rule wins, so the most significant weather comes first. That way a forecast
// with several conditions, like "Partly Sunny then Chance Rain Showers", shows the precipitation.
const iconRules: IconRule[] = [
    { pattern: /thunder.*\bsnow\b|\bsnow\b.*thunder/, day: ThunderstormsSnow, night: ThunderstormsSnow },
    {
        pattern: /thunder.*\b(rain|showers)\b|\b(rain|showers)\b.*thunder/,
        day: ThunderstormsDayRain,
        night: ThunderstormsNightRain,
    },
    { pattern: /thunder|t-?storm/, day: ThunderstormsDay, night: ThunderstormsNight },

    {
        pattern: /sleet|ice pellets|wintry mix|freezing (rain|drizzle)|\brain\b.*\bsnow\b|\bsnow\b.*\brain\b/,
        day: Sleet,
        night: Sleet,
    },
    { pattern: /light snow|flurries|\bsnow likely\b/, day: PartlyCloudyDaySnow, night: PartlyCloudyNightSnow },
    { pattern: /\bsnow\b|blizzard/, day: Snow, night: Snow },

    { pattern: /drizzle|sprinkles/, day: Drizzle, night: Drizzle },
    { pattern: /light rain/, day: PartlyCloudyDayRain, night: PartlyCloudyNightRain },
    { pattern: /\b(rain|showers)\b/, day: Rain, night: Rain },

    { pattern: /\bfog/, day: FogDay, night: FogNight },
    { pattern: /\bmist\b/, day: Mist, night: Mist },
    { pattern: /\bsmoke\b/, day: Smoke, night: Smoke },
    { pattern: /\bhaze\b/, day: HazeDay, night: HazeNight },
    { pattern: /\b(dust|sand)\b/, day: DustDay, night: DustNight },

    { pattern: /overcast/, day: OvercastDay, night: OvercastNight },
    { pattern: /partly (cloudy|sunny)|mostly cloudy/, day: PartlyCloudyDay, night: PartlyCloudyNight },
    { pattern: /\bcloudy\b/, day: Cloudy, night: Cloudy },
]

export function getIcon({ keyword, isDay }: { keyword: string; isDay: boolean }) {
    const forecast = keyword.toLowerCase()
    const rule = iconRules.find(({ pattern }) => pattern.test(forecast))

    if (rule) {
        return isDay ? rule.day : rule.night
    }
    return isDay ? ClearDay : ClearNight
}
