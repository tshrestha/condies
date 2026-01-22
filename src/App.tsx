import { Route } from "@solidjs/router"
import { lazy, Suspense } from "solid-js"

import Forecast from "./Forecast.tsx"
import Home from "./Home.tsx"
import Loading from "./Loading.tsx"

const Map = lazy(() => import("./Map.tsx"))

function App() {
    return (
        <Suspense fallback={<Loading />}>
            <Route path={"/"} component={Home} />
            <Route path={"/map"} component={Map} />
            <Route path={"/forecast/:point"} component={Forecast} />
        </Suspense>
    )
}

export default App
