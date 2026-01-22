import { beaufortScale, type Period, toBeaufortForce } from './lib/nws.ts'
import ForecastChart from './ForecastChart.tsx'
import { getWindArrow } from './lib/util.ts'

export default function HourlyWindChart({ periods }: { periods: Period[] }) {
    return (
        <ForecastChart
            title={'HOURLY WIND'}
            colorDomain={beaufortScale.map(({ force }) => force)}
            colorRange={[
                '#00bbf0',
                '#00bbf0',
                '#6b8e6b', // 0 mph - sage green (calm)
                '#5a9178', // 10 mph
                '#4a9485', // 20 mph
                '#d4a843', // 30 mph - golden (moderate)
                '#d4883a', // 40 mph
                '#d46832', // 50 mph - orange (strong)
                '#c94a2a', // 60 mph
                '#b33025', // 70 mph - red (severe)
                '#8b1a1a', // 80 mph
                '#5c1a5c' // 90+ mph - deep purple (extreme)
            ]}
            classList={['wind-forecast-chart']}
            periods={periods}
            getX={(p: Period) => p.windSpeed.value as number}
            getXLabel={(p: Period) => (p.windSpeed.value as number).toString() + ' mph'}
            getForecastLabel={(p) => `${getWindArrow(p.windDirection)} ${p.windDirection}`}
            getColorValue={(p) => toBeaufortForce(p.windSpeed.value as number)}
        />
    )
}
