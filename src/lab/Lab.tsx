import { createMemo, createSignal, Errored, For, lazy, Loading, Show } from "solid-js"
import type { Component } from "solid-js"

import { denver } from "../lib/nws.ts"

import type { ForecastView, SpotView } from "../lib/forecastView.ts"

import { type DesignProps, loadLive, type Screen } from "./data.ts"
import { loadScenario, scenarios } from "./scenarios.ts"

// Each design is its own lazily loaded module, so a design that's mid-edit can't break the others.
const modules = import.meta.glob<{ default: Component<DesignProps> }>("./*/index.tsx")
const designIds = Object.keys(modules).map((path) => path.split("/")[1])

const params = new URLSearchParams(location.search)

const read = (key: string, fallback: string) => params.get(key) ?? fallback

const design = read("design", designIds[0] ?? "")
const scenario = read("scenario", "pow")
const startHour = Number(read("hour", "14"))
const status = read("status", "ready") as DesignProps["status"]
const offline = read("offline", "0") === "1"
const showStrip = read("chrome", "1") !== "0"
const emptySpots = read("spots", "") === "0"
const open = (params.get("open") ?? undefined) as DesignProps["open"]

// Any control other than the theme and the screen reloads, which also clears the last design's CSS.
function withParams(changes: Record<string, string>) {
    const next = new URLSearchParams(location.search)
    for (const [key, value] of Object.entries(changes)) {
        next.set(key, value)
    }
    return `?${next}`
}

function replaceParams(changes: Record<string, string>) {
    try {
        history.replaceState(null, "", withParams(changes))
    } catch {
        // Some embedded viewers don't allow this, and the page works without it.
    }
}

function systemTheme() {
    return matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
}

function initialScreen(forecast?: ForecastView): Screen {
    const name = read("screen", "home")
    if (name === "day") {
        const index = Number(read("day", "0"))
        return { name: "day", date: forecast?.days[index]?.date ?? forecast?.days[0]?.date ?? "" }
    }
    return name === "spots" ? { name: "spots" } : { name: "home" }
}

function Strip(props: {
    screen: Screen
    theme: string
    onScreen: (name: "home" | "day" | "spots") => void
    onTheme: (theme: "light" | "dark") => void
}) {
    const Choice = (choice: { param: string; value: string; label: string; current: string }) => (
        <a
            href={withParams({ [choice.param]: choice.value })}
            aria-current={choice.current === choice.value ? "true" : undefined}
        >
            {choice.label}
        </a>
    )

    return (
        <nav class="lab-strip" aria-label="Design review controls">
            <div class="lab-group">
                <For each={designIds}>
                    {(id) => <Choice param="design" value={id} label={id.toUpperCase()} current={design} />}
                </For>
            </div>
            <div class="lab-group">
                <For each={[...scenarios, { id: "live", label: "Live NWS" }]}>
                    {(s) => <Choice param="scenario" value={s.id} label={s.label} current={scenario} />}
                </For>
            </div>
            <div class="lab-group">
                <For each={["home", "day", "spots"] as const}>
                    {(name) => (
                        <button
                            type="button"
                            aria-current={props.screen.name === name ? "true" : undefined}
                            onClick={() => props.onScreen(name)}
                        >
                            {name}
                        </button>
                    )}
                </For>
            </div>
            <div class="lab-group">
                <For each={["light", "dark"] as const}>
                    {(t) => (
                        <button
                            type="button"
                            aria-current={props.theme === t ? "true" : undefined}
                            onClick={() => props.onTheme(t)}
                        >
                            {t}
                        </button>
                    )}
                </For>
            </div>
            <div class="lab-group">
                <For
                    each={[
                        ["7", "7am"],
                        ["14", "2pm"],
                        ["22", "10pm"],
                    ]}
                >
                    {([value, label]) => (
                        <Choice param="hour" value={value} label={label} current={String(startHour)} />
                    )}
                </For>
            </div>
            <div class="lab-group">
                <For each={["ready", "loading", "error"]}>
                    {(s) => <Choice param="status" value={s} label={s} current={status} />}
                </For>
            </div>
        </nav>
    )
}

type Loaded = { forecast: ForecastView; spots: SpotView[]; searchSamples: string[] }

function getLivePoint(): Promise<{ lat: string; lon: string }> {
    const lat = params.get("lat")
    const lon = params.get("lon")
    if (lat && lon) {
        return Promise.resolve({ lat, lon })
    }
    return new Promise((resolve) => {
        const fallback = () => resolve({ lat: denver.lat, lon: denver.lon })
        if (!navigator.geolocation) {
            fallback()
            return
        }
        navigator.geolocation.getCurrentPosition(
            ({ coords }) => resolve({ lat: coords.latitude.toFixed(4), lon: coords.longitude.toFixed(4) }),
            fallback,
            { timeout: 8000, maximumAge: 600_000 },
        )
    })
}

async function loadLiveData(): Promise<Loaded> {
    const { lat, lon } = await getLivePoint()
    const forecast = await loadLive(lat, lon)
    return { forecast, spots: [], searchSamples: ["Denver, Colorado, United States"] }
}

export default function Lab() {
    const [theme, setThemeSignal] = createSignal<"light" | "dark">(read("theme", systemTheme()) as "light" | "dark")
    const data = createMemo<Loaded | Promise<Loaded>>(() =>
        scenario === "live" ? loadLiveData() : loadScenario(scenario, startHour),
    )
    const [chosenScreen, setChosenScreen] = createSignal<Screen>()
    const currentScreen = () => chosenScreen() ?? initialScreen((data() as Loaded).forecast)

    const setTheme = (next: "light" | "dark") => {
        setThemeSignal(next)
        document.documentElement.dataset.theme = next
        replaceParams({ theme: next })
    }

    const go = (next: Screen) => {
        setChosenScreen(next)
        replaceParams(next.name === "day" ? { screen: "day" } : { screen: next.name })
        scrollTo(0, 0)
    }

    const link = (target: Screen) => ({
        href: "#",
        onClick: (e: MouseEvent) => {
            e.preventDefault()
            go(target)
        },
    })

    const onScreen = (name: "home" | "day" | "spots") => {
        const firstDay = (data() as Loaded).forecast.days[0]?.date ?? ""
        go(name === "day" ? { name: "day", date: firstDay } : { name })
    }

    document.documentElement.dataset.theme = theme()
    document.documentElement.dataset.design = design

    const loader = modules[`./${design}/index.tsx`]
    const Design = (loader ? lazy(loader) : undefined) as Component<DesignProps>
    const loaded = () => data() as Loaded

    return (
        <>
            <Show when={showStrip}>
                <Loading fallback={null}>
                    <Strip screen={currentScreen()} theme={theme()} onScreen={onScreen} onTheme={setTheme} />
                </Loading>
            </Show>
            <Show
                when={Design}
                fallback={
                    <p class="lab-message">
                        No design named "{design}" yet. Available: {designIds.join(", ")}
                    </p>
                }
            >
                <Errored fallback={(error) => <p class="lab-message">This design hit an error: {String(error())}</p>}>
                    <Loading fallback={<p class="lab-message">Loading…</p>}>
                        <Design
                            forecast={loaded().forecast}
                            spots={emptySpots ? [] : loaded().spots}
                            searchSamples={loaded().searchSamples}
                            screen={currentScreen()}
                            go={go}
                            link={link}
                            theme={theme()}
                            setTheme={setTheme}
                            status={status}
                            offline={offline}
                            open={open}
                        />
                    </Loading>
                </Errored>
            </Show>
        </>
    )
}
