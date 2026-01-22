import type { Period } from './lib/nws.ts'
import ForecastChart from './ForecastChart.tsx'

export default function HourlyTempsChart({ periods }: { periods: Period[] }) {
    return (
        <ForecastChart
            title={'HOURLY TEMPS'}
            colorDomain={[0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100]}
            colorRange={[
                '#6b21a8', // 0°F - deep purple (frigid)
                '#7c3aed', // 10°F
                '#4f46e5', // 20°F - indigo
                '#3b82f6', // 30°F - blue (freezing)
                '#0ea5e9', // 40°F - sky blue
                '#14b8a6', // 50°F - teal (cool)
                '#22c55e', // 60°F - green (comfortable)
                '#eab308', // 70°F - yellow (warm)
                '#f97316', // 80°F - orange (hot)
                '#ef4444', // 90°F - red
                '#b91c1c' // 100°F - deep red (extreme heat)
            ]}
            periods={periods}
            getX={(p: Period) => p.temperature}
            getXLabel={(p: Period) => `${p.temperature}º`}
            getForecastLabel={(p) => p.shortForecast}
            getColorValue={(p) => p.temperature}
        />
    )
}
