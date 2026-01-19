import { Match, Switch } from 'solid-js'

import type { QuantitativeValue } from './lib/nws.ts'

export default function WindSpeed({ windSpeed }: { windSpeed: QuantitativeValue }) {
    return (
        <Switch>
            <Match when={windSpeed.minValue && windSpeed.maxValue}>
                <small>{`${windSpeed.minValue} - ${windSpeed.maxValue} mph`}</small>
            </Match>
            <Match when={windSpeed.value}>
                <small>{`${windSpeed.value} mph`}</small>
            </Match>
        </Switch>
    )
}
