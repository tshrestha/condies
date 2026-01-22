import { writeFileSync } from "node:fs"

import Fuse from "fuse.js"
import path from "node:path"

export const icons = [
    {
        path: "clear-day.svg",
        keywords: ["sunny", "mostly sunny"],
        day: true,
    },
    {
        path: "clear-night.svg",
        keywords: ["clear", "mostly clear"],
        night: true,
    },
    {
        path: "cloudy.svg",
        keywords: ["cloudy"],
        day: true,
        night: true,
    },
    {
        path: "cloudy.svg",
        keywords: ["cloudy"],
        day: true,
        night: false,
    },
    {
        path: "cloudy.svg",
        keywords: ["cloudy"],
        day: false,
        night: true,
    },
    {
        path: "overcast.svg",
        keywords: ["overcast"],
        day: true,
        night: true,
    },
    {
        path: "overcast-day.svg",
        keywords: ["overcast"],
        day: true,
    },
    {
        path: "overcast-night.svg",
        keywords: ["overcast"],
        night: true,
    },
    {
        path: "drizzle.svg",
        keywords: ["drizzle", "light rain"],
        day: true,
        night: true,
    },
    {
        path: "rain.svg",
        keywords: ["rain", "moderate rain", "rain showers", "showers likely"],
        day: true,
        night: true,
    },
    {
        path: "rain.svg",
        keywords: ["rain", "moderate rain", "rain showers", "showers likely"],
        day: true,
        night: false,
    },
    {
        path: "rain.svg",
        keywords: ["rain", "moderate rain", "rain showers", "showers likely"],
        day: false,
        night: true,
    },
    {
        path: "partly-cloudy-day-rain.svg",
        keywords: ["light rain"],
        day: true,
        night: false,
    },
    {
        path: "partly-cloudy-night-rain.svg",
        keywords: ["light rain"],
        day: false,
        night: true,
    },
    {
        path: "sleet.svg",
        keywords: ["sleet", "freezing rain"],
        day: true,
        night: true,
    },
    {
        path: "partly-cloudy-day.svg",
        keywords: ["partly cloudy", "mostly cloudy", "partly sunny"],
        day: true,
    },
    {
        path: "partly-cloudy-night.svg",
        keywords: ["partly cloudy", "mostly cloudy"],
        night: true,
    },
    {
        path: "mist.svg",
        keywords: ["mist"],
        day: true,
        night: true,
    },
    {
        path: "thunderstorms.svg",
        keywords: ["thunder", "thunderstorms", "thunder storms"],
        day: true,
        night: true,
    },
    {
        path: "thunderstorms-day.svg",
        keywords: ["thunder", "thunderstorms", "thunder storms"],
        day: true,
    },
    {
        path: "thunderstorms-night.svg",
        keywords: ["thunder", "thunderstorms", "thunder storms"],
        night: true,
    },
    {
        path: "thunderstorms-day-rain.svg",
        keywords: ["thunder", "thunderstorms", "thunder storms"],
        day: true,
    },
    {
        path: "thunderstorms-night-rain.svg",
        keywords: ["thunder", "thunderstorms", "thunder storms"],
        night: true,
    },
    {
        path: "thunderstorms-snow.svg",
        keywords: ["thunder", "thunderstorms", "thunder storms", "snow"],
        day: true,
        night: true,
    },
    {
        path: "fog.svg",
        keywords: ["fog", "foggy"],
        day: true,
        night: true,
    },
    {
        path: "fog-day.svg",
        keywords: ["fog", "foggy"],
        day: true,
    },
    {
        path: "fog-night.svg",
        keywords: ["fog", "foggy"],
        night: true,
    },
    {
        path: "./assets/weather-icons-master/production/fill/all/snow.svg",
        keywords: ["snow", "blowing snow", "snow showers", "snow showers likely"],
        day: true,
        night: true,
    },
    {
        path: "./assets/weather-icons-master/production/fill/all/snow.svg",
        keywords: ["snow", "blowing snow", "snow showers", "snow showers likely"],
        day: true,
        night: false,
    },
    {
        path: "./assets/weather-icons-master/production/fill/all/snow.svg",
        keywords: ["snow", "blowing snow", "snow showers", "snow showers likely"],
        day: false,
        night: true,
    },
    {
        path: "./assets/weather-icons-master/production/fill/all/partly-cloudy-day-snow.svg",
        keywords: ["light snow", "snow likely"],
        day: true,
    },
    {
        path: "./assets/weather-icons-master/production/fill/all/partly-cloudy-night-snow.svg",
        keywords: ["light snow", "snow likely"],
        night: true,
    },
]

const index = Fuse.createIndex(["keywords", "path"], icons)
const filepath = path.join(import.meta.dirname, "./src/assets/icon.index.json")

console.log(filepath)
writeFileSync(filepath, JSON.stringify(index.toJSON()))
