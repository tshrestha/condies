import { type Period, type Point } from "./lib/nws.ts"
import { getIcon } from "./lib/wicons.ts"

export default function LatestObservations(props: { point: Point; period: Period }) {
    return (
        <div class={"mt-4 mb-4 text-center latest-observations"}>
            <h1 class={"display-6"}>{props.point.properties.relativeLocation?.properties.city}</h1>
            <p class={"mb-0"}>Right meow 🐱</p>
            <div class={"d-flex justify-content-center align-items-center"}>
                <div class="col-6 text-end">
                    <img
                        src={getIcon({
                            keyword: props.period.shortForecast,
                            isDay: props.period.isDaytime,
                        })}
                        class={"img-fluid w-50"}
                    />
                </div>
                <div class="col-6 text-start">
                    <h1 class={"display-1 align-middle fw-lighter"} style={"font-size: 4rem;"}>
                        {props.period.temperature}°
                    </h1>
                </div>
            </div>
            <span class={"badge text-bg-secondary fs-6 p-2 fw-light"}>{props.period.shortForecast}</span>
        </div>
    )
}
