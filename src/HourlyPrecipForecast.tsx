import ForecastChart from "./ForecastChart.tsx"
import type { Period } from "./lib/nws.ts"

export default function HourlyPrecipChart({ periods }: { periods: Period[] }) {
    return (
        <ForecastChart
            title={"HOURLY PRECIPITATION"}
            colorDomain={[0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100]}
            colorRange={[
                "#94a3b8", // 0% - slate gray
                "#7c9cbf", // 10%
                "#6495c6", // 20%
                "#4c8ecd", // 30%
                "#3b82c4", // 40%
                "#2b7ab8", // 50%
                "#2563a0", // 60%
                "#1e4d88", // 70%
                "#1e3a6e", // 80%
                "#1a2f5a", // 90%
                "#172554", // 100% - deep navy
            ]}
            periods={periods}
            getX={(p: Period) => p.probabilityOfPrecipitation.value}
            getXLabel={(p: Period) => `${p.probabilityOfPrecipitation.value}%`}
            getForecastLabel={(p) => p.shortForecast}
            getColorValue={(p) => p.probabilityOfPrecipitation.value}
        />
    )
}
