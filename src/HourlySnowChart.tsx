import ForecastChart from "./ForecastChart.tsx"
import type { Period } from "./lib/nws.ts"

const snowOf = (p: Period) => p.snowInches ?? 0

export default function HourlySnowChart(props: { periods: Period[] }) {
    return (
        <ForecastChart
            title={"HOURLY SNOW"}
            colorDomain={[0, 0.25, 0.5, 1, 2]}
            colorRange={["#bfdbfe", "#60a5fa", "#3b82f6", "#1d4ed8", "#1e3a8a"]}
            periods={props.periods}
            xDomain={[0, Math.max(0.5, ...props.periods.map(snowOf))]}
            getX={snowOf}
            getXLabel={(p: Period) => `${snowOf(p).toFixed(1)}″`}
            getForecastLabel={(p) => p.shortForecast}
            getColorValue={snowOf}
        />
    )
}
