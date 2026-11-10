import { createRouter, hashHistory } from "@solidjs/router"
import { createSignal, Errored, lazy, Loading, onCleanup, Show } from "solid-js"

import { ForecastRoute } from "./Forecast.tsx"
import { ForecastDayRoute } from "./ForecastDay.tsx"
import Home from "./Home.tsx"
import LoadingScreen from "./Loading.tsx"
import Spots from "./Spots.tsx"

const Map = lazy(() => import("./Map.tsx"))

const Router = createRouter({
    routes: [
        { path: "/", component: Home },
        { path: "/map", component: Map },
        { path: "/forecast/:point", component: ForecastRoute },
        { path: "/forecast/:point/day/:date", component: ForecastDayRoute },
        { path: "/spots", component: Spots },
    ],
    history: hashHistory(),
})

function OfflineNotice() {
    const [online, setOnline] = createSignal(navigator.onLine)
    const update = () => setOnline(navigator.onLine)

    window.addEventListener("online", update)
    window.addEventListener("offline", update)
    onCleanup(() => {
        window.removeEventListener("online", update)
        window.removeEventListener("offline", update)
    })

    return (
        <Show when={!online()}>
            <div class="alert alert-secondary text-center rounded-5 small py-1 px-3 mb-2" role="status">
                <i class="bi bi-wifi-off" /> You're offline. This is the last forecast you loaded.
            </div>
        </Show>
    )
}

function App() {
    return (
        <Router>
            {(props) => (
                // Without a boundary, one uncaught error stops all reactivity for the rest of the session.
                <>
                    <OfflineNotice />
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
                </>
            )}
        </Router>
    )
}

export default App
