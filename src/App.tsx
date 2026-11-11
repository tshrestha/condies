import { createRouter, hashHistory } from "@solidjs/router"
import { Errored, lazy, Loading } from "solid-js"

import { ErrorState, LoadingState } from "./design/states.tsx"
import { ForecastRoute } from "./Forecast.tsx"
import { ForecastDayRoute } from "./ForecastDay.tsx"
import Home from "./Home.tsx"
import Shell from "./Shell.tsx"
import Spots from "./Spots.tsx"
import { theme } from "./theme.ts"

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

function App() {
    return (
        <Router>
            {(props) => (
                <Shell>
                    {/* Without a boundary, one uncaught error stops all reactivity for the rest of the session. */}
                    <Errored fallback={<ErrorState home={{ href: "#/" }} onRetry={() => location.reload()} />}>
                        <Loading fallback={<LoadingState theme={theme()} />}>{props.children}</Loading>
                    </Errored>
                </Shell>
            )}
        </Router>
    )
}

export default App
