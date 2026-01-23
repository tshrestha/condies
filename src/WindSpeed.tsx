import { Match, Switch } from "solid-js"

import type { QuantitativeValue } from "./lib/nws.ts"

export default function WindSpeed({ windSpeed }: { windSpeed: QuantitativeValue }) {
    return (
        <Switch>
            <Match when={typeof windSpeed.minValue !== "undefined" && typeof windSpeed.maxValue !== "undefined"}>
                <small>{`${windSpeed.minValue} - ${windSpeed.maxValue} mph`}</small>
            </Match>
            <Match when={typeof windSpeed.value !== "undefined"}>
                <small>{`${windSpeed.value} mph`}</small>
            </Match>
        </Switch>
    )
}
