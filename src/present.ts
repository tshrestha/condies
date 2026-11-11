import { createSignal } from "solid-js"

// The temperature of the forecast on screen right now, so the dock's current tab can carry its color. It stays
// on the last one shown when you move to a screen without a forecast.
export const [presentTemperature, setPresentTemperature] = createSignal<number>()
