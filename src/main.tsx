import "bootstrap/dist/css/bootstrap.min.css"
import "bootstrap-icons/font/bootstrap-icons.min.css"
import "./app.css"

import { HashRouter } from "@solidjs/router"
import { render } from "solid-js/web"

import App from "./App.tsx"
import { getTimeOfDay } from "./lib/util.ts"

const timeofDay = getTimeOfDay()
const body = document.body
body.classList.remove("morning")
body.classList.remove("day")
body.classList.remove("evening")
body.classList.remove("night")
body.classList.add(timeofDay)

if (timeofDay === "night") {
    body.setAttribute("data-bs-theme", "dark")
}

render(
    () => (
        <HashRouter>
            <App />
        </HashRouter>
    ),
    document.getElementById("root")!,
)
