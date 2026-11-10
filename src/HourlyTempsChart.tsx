import ForecastChart from "./ForecastChart.tsx"
import type { Period } from "./lib/nws.ts"
import { tempColorDomain, tempColorRange } from "./lib/tempColors.ts"

export default function HourlyTempsChart(props: { periods: Period[] }) {
    return (
        <ForecastChart
            title={"HOURLY TEMPS"}
            colorDomain={tempColorDomain}
            colorRange={tempColorRange}
            periods={props.periods}
            getX={(p: Period) => p.temperature}
            getXLabel={(p: Period) => `${p.temperature}°`}
            getForecastLabel={(p) => p.shortForecast}
            getColorValue={(p) => p.temperature}
        />
    )
}
