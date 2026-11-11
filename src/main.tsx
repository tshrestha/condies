import "@fontsource-variable/chivo/wght.css"
import "./design/tokens.css"
import "./design/components.css"
import "./home/home.css"
import "./day/day.css"
import "./spots/spots.css"

import { render } from "@solidjs/web"

import App from "./App.tsx"

render(() => <App />, document.getElementById("root")!)

if (import.meta.env.PROD && "serviceWorker" in navigator) {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(console.error)
}

// Forecasts age quickly, so reload when someone returns to a tab left open for a while.
const staleAfterMs = 30 * 60 * 1000
const loadedAt = Date.now()
document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && Date.now() - loadedAt > staleAfterMs) {
        location.reload()
    }
})
