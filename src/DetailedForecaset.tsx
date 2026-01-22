import type { Period } from './lib/nws.ts'
import { getIcon } from './lib/wicons.ts'
import { getPrecipType } from './lib/util.ts'
import windIcon from './assets/weather-icons-master/production/fill/all/wind.svg'
import raindropIcon from './assets/weather-icons-master/production/fill/all/raindrop.svg'
import snowflakeIcon from './assets/weather-icons-master/production/fill/all/snowflake.svg'
import WindSpeed from './WindSpeed.tsx'

export default function DetailedForecast({ periods }: { periods: Period[] }) {
    return (
        <div class='card rounded rounded-4 shadow-sm mt-4 mb-4'>
            <div class='card-header'>Detailed Forecast</div>
            <div class='list-group list-group-flush rounded-4'>
                {periods.map((p: Period) => {
                    const precipType = getPrecipType(p.detailedForecast)
                    return (
                        <div class={'list-group-item'}>
                            <div class={'d-flex justify-content-between align-items-center mb-3'}>
                                <div class={'col-2 fw-medium'}>
                                    {`${new Date(p.startTime).toLocaleDateString('en-US', { weekday: 'short' })}${p.isDaytime ? '' : ' night'}`}
                                </div>
                                <div class={'col-1 text-start'}>
                                    <img
                                        src={getIcon({
                                            keyword: p.shortForecast,
                                            isDay: p.isDaytime,
                                            isNight: !p.isDaytime
                                        })}
                                        alt={p.shortForecast}
                                        class='img-fluid'
                                    />
                                </div>
                                <div class={'col-1 text-end ms-4'}>
                                    <img src={windIcon} alt='wind icon' class='img-fluid' />
                                </div>
                                <div class={'col-3 text-start'}>
                                    <WindSpeed windSpeed={p.windSpeed} />
                                </div>
                                <div class={'col-1 text-end'}>
                                    {precipType === 'snow' && (
                                        <img src={snowflakeIcon} alt='precipitation' class='img-fluid' />
                                    )}
                                    {precipType === 'rain' && (
                                        <img src={raindropIcon} alt='precipitation' class='img-fluid' />
                                    )}
                                </div>
                                <div class={'col-2 text-start'}>
                                    <small>{`${p.probabilityOfPrecipitation['value']}%`}</small>
                                </div>
                                <div class={'col-auto text-end fw-medium'}>{p.temperature}º</div>
                            </div>
                            <p>{p.detailedForecast}</p>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}
