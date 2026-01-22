import { Show, Suspense } from 'solid-js'
import { createAsync, query, type RouteSectionProps, useLocation, useParams } from '@solidjs/router'

import { type ForecastResult, getForecast, getPoint, type Point } from './lib/nws.ts'

import LatestObservations from './LatestObservations.tsx'
import HourlyForecast from './HourlyForecast'
import ShortForecast from './ShortForecast.tsx'
import DetailedForecast from './DetailedForecaset.tsx'
import ForecastPlaceholder from './ForecastPlaceholder.tsx'
import HomeButton from './HomeButton.tsx'
import LatestObservationsPlaceholder from './LatestObservationsPlaceholder.tsx'
import SunRiseSet from './SunRiseSet.tsx'

export interface ForecastProps {
    point?: {
        lat: string
        lon: string
    }
}

const getData = query(async (lat, lon) => {
    const point: Point = await getPoint(lat, lon)
    const forecast: ForecastResult = (await getForecast(point.properties.forecast)) as ForecastResult
    const hourlyForecastResult: ForecastResult = (await getForecast(point.properties.forecastHourly)) as ForecastResult
    const timeRegex = /(\d+):(\d+)\s(AM|PM)/

    const periods = hourlyForecastResult.properties.periods
        .filter((p) => p.number >= 1 && p.number <= 10)
        .map((p) => {
            const d = new Date(p.startTime)
            const timeString = d.toLocaleTimeString('en-US', { hour12: true, timeStyle: 'short' })
            const match = timeString.match(timeRegex)
            p.hourString = `${match![1]} ${match![3]}`
            return { ...p, hourString: `${match![1]} ${match![3]}` }
        })
    const hourlyForecast = { periods }
    return { point, forecast, hourlyForecast }
}, 'forecast')

export default function Forecast(props: ForecastProps | RouteSectionProps) {
    const location = useLocation()
    const params = useParams()
    let lat, lon

    if ((props as ForecastProps).point) {
        lat = (props as ForecastProps).point!.lat
        lon = (props as ForecastProps).point!.lon
    } else {
        const point = params.point?.split(',')
        lat = point![0]
        lon = point![1]
    }

    const data = createAsync(() => getData(lat, lon))

    return (
        <>
            <Suspense fallback={<LatestObservationsPlaceholder />}>
                <Show when={data()}>
                    <LatestObservations point={data()!.point} />
                </Show>
            </Suspense>
            <SunRiseSet lat={lat} lon={lon} />
            <Suspense fallback={<ForecastPlaceholder />}>
                <Show when={data()}>
                    <HourlyForecast periods={data()!.hourlyForecast.periods} />
                    <ShortForecast periods={data()!.forecast.properties.periods} />
                    <DetailedForecast periods={data()!.forecast.properties.periods} />
                </Show>
            </Suspense>
            <Show when={location.pathname !== '/'}>
                <div class={'position-fixed bottom-0 pb-4 z-3'}>
                    <HomeButton />
                </div>
            </Show>
        </>
    )
}
