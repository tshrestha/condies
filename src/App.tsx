import { createRouter, hashHistory } from "@solidjs/router"
import { Errored, lazy, Loading } from "solid-js"

import { ForecastRoute } from "./Forecast.tsx"
import Home from "./Home.tsx"
import LoadingScreen from "./Loading.tsx"

const Map = lazy(() => import("./Map.tsx"))

const Router = createRouter({
    routes: [
        { path: "/", component: Home },
        { path: "/map", component: Map },
        { path: "/forecast/:point", component: ForecastRoute },
    ],
    history: hashHistory(),
})

function App() {
    return (
        <Router>
            {(props) => (
                // Without a boundary, one uncaught error stops all reactivity for the rest of the session.
                <Errored
                    fallback={
                        <div class="alert alert-danger text-center rounded-5 mt-4" role="alert">
                            Couldn't load this page.{" "}
                            <button
                                type="button"
                                class="btn btn-link alert-link p-0 align-baseline"
                                onClick={() => location.reload()}
                            >
                                Try again
                            </button>{" "}
                            or{" "}
                            <a href="#/" class="alert-link">
                                go home
                            </a>
                        </div>
                    }
                >
                    <Loading fallback={<LoadingScreen />}>{props.children}</Loading>
                </Errored>
            )}
        </Router>
    )
}

export default App
