import { Match, Switch } from 'solid-js'

import { getIcon } from './lib/wicons.ts'
import type { ForecastResult, Period, QuantitativeValue } from './lib/nws.ts'
import WindSpeed from './WindSpeed.tsx'
import windIcon from './assets/weather-icons-master/production/fill/all/wind.svg'

function tooWindy(windSpeed: QuantitativeValue, threshold = 10) {
    if (windSpeed.maxValue && windSpeed.maxValue > threshold) {
        return true
    }

    return !!(windSpeed.value && windSpeed.value > threshold)
}

function isPrimo(condies: Period) {
    const { shortForecast, isDaytime, windSpeed, windGust, temperature, probabilityOfPrecipitation } = condies
    if (!isDaytime) {
        return false
    }
    if (probabilityOfPrecipitation.value > 10) {
        return false
    }
    if (temperature < 55 || temperature > 75) {
        return false
    }
    if (windGust) {
        return false
    }
    if (tooWindy(windSpeed)) {
        return false
    }

    const p = /(mostly\s)?sunny/g
    return p.test(shortForecast.toLowerCase())
}

function isPowDay(condies: Period, ignoreIsDaytime = false, ignoreTemp = false) {
    const { detailedForecast, isDaytime, windSpeed, temperature, probabilityOfPrecipitation } = condies
    const snowForecastRegex = /(snow)(\saccumulation)?/gi
    const snowDepthRegex = /(\d+)\s(inches)/

    if (!isDaytime && !ignoreIsDaytime) {
        return false
    }
    if (temperature > 32 && !ignoreTemp) {
        return false
    }
    if (tooWindy(windSpeed, 20)) {
        return false
    }
    if (probabilityOfPrecipitation.value < 70) {
        return false
    }
    if (snowForecastRegex.test(detailedForecast)) {
        const match = detailedForecast.match(snowDepthRegex)
        if (!match) {
            return false
        }
        return parseInt(match[1], 10) >= 6
    }
}

export default function ShortForecast({ forecastResult }: { forecastResult: ForecastResult }) {
    return (
        <div class='list-group rounded-4 shadow-sm mb-4'>
            {forecastResult?.properties.periods.map((p, i) => (
                <div class='list-group-item'>
                    <div class={'d-flex justify-content-between align-items-center'}>
                        {i <= 1 && <div class={'col-3 fw-medium'}>{p.name}</div>}
                        {i > 1 && (
                            <div
                                class={'col-3 fw-medium'}
                            >{`${new Date(p.startTime).toLocaleDateString('en-US', { weekday: 'short' })}${p.isDaytime ? '' : ' night'}`}</div>
                        )}
                        <div class={'col-1 text-start me-2'}>
                            <img
                                src={getIcon({ keyword: p.shortForecast, isDay: p.isDaytime, isNight: !p.isDaytime })}
                                alt={p.shortForecast}
                                class='img-fluid'
                            />
                        </div>
                        <div class={'col-1 text-end'}>
                            <img src={windIcon} alt='clear day' class='img-fluid' />
                        </div>
                        <div class={'col-3 text-start'}>
                            <WindSpeed windSpeed={p.windSpeed} />
                        </div>
                        <div class={'col-2 text-end fw-medium'}>{p.temperature}º</div>
                    </div>
                    <Switch>
                        <Match when={isPrimo(p)}>
                            <div class={'d-flex justify-content-center align-items-center my-2'}>
                                <span class='badge rounded-pill text-bg-warning fw-bolder text-center py-2 px-3'>
                                    <i>️PRIMO CONDIES!</i>
                                </span>
                            </div>
                        </Match>
                        <Match when={isPowDay(p)}>
                            <div class={'d-flex justify-content-center align-items-center'}>
                                <span class={'fs-2 mx-3'}>🏂</span>
                                <span class='badge rounded-pill text-bg-primary fw-bolder text-center py-2 px-3'>
                                    <i>POW DAY!</i>
                                </span>
                                <span class={'fs-2 mx-3'}>⛷️</span>
                            </div>
                        </Match>
                    </Switch>
                </div>
            ))}
        </div>
    )
}
