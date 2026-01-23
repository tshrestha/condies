import { Match, Switch } from "solid-js"

import type { QuantitativeValue } from "./lib/nws.ts"

export default function WindSpeed({ windSpeed }: { windSpeed: QuantitativeValue }) {
    return (
        <Switch fallback={<small>0 mph</small>}>
            <Match when={windSpeed && typeof windSpeed.minValue !== "undefined" && typeof windSpeed.maxValue !== "undefined"}>
                <small>{`${windSpeed.minValue} - ${windSpeed.maxValue} mph`}</small>
            </Match>
            <Match when={windSpeed && typeof windSpeed.value !== "undefined"}>
                <small>{`${windSpeed.value} mph`}</small>
            </Match>
        </Switch>
    )
}
