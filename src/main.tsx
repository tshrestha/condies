import "bootstrap/dist/css/bootstrap.min.css"
import "bootstrap-icons/font/bootstrap-icons.min.css"
import "./app.css"

import { HashRouter } from "@solidjs/router"
import { render } from "solid-js/web"

import App from "./App.tsx"

render(
    () => (
        <HashRouter>
            <App />
        </HashRouter>
    ),
    document.getElementById("root")!,
)
