import { Match, Switch } from "solid-js"

import type { QuantitativeValue } from "./lib/nws.ts"

export default function WindSpeed(props: { windSpeed: QuantitativeValue }) {
    return (
        <Switch fallback={<small>0 mph</small>}>
            <Match
                when={
                    props.windSpeed
                    && typeof props.windSpeed.minValue !== "undefined"
                    && typeof props.windSpeed.maxValue !== "undefined"
                }
            >
                <small>{`${props.windSpeed.minValue} - ${props.windSpeed.maxValue} mph`}</small>
            </Match>
            <Match when={props.windSpeed && typeof props.windSpeed.value !== "undefined"}>
                <small>{`${props.windSpeed.value} mph`}</small>
            </Match>
        </Switch>
    )
}
