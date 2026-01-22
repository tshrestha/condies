import { Match, Switch } from 'solid-js'

import { getIcon } from './lib/wicons.ts'
import type { Period } from './lib/nws.ts'
import { isPowDay, isPrimo } from './lib/util.ts'
import WindSpeed from './WindSpeed.tsx'
import windIcon from './assets/weather-icons-master/production/fill/all/wind.svg'

export default function ShortForecast({ periods }: { periods: Period[] }) {
    return (
        <div class={'card rounded-4 shadow-sm mb-4'}>
            <div class={'card-header'}>7-DAY FORECAST</div>
            <div class='list-group list-group-flush rounded-4'>
                {periods.map((p, i) => (
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
                                    src={getIcon({
                                        keyword: p.shortForecast,
                                        isDay: p.isDaytime,
                                        isNight: !p.isDaytime
                                    })}
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
        </div>
    )
}
