import "@fontsource-variable/chivo/wght.css"
import "../../design/tokens.css"
import "../../design/components.css"
import "./quiet.css"
// After quiet.css, so the split's wide padding still wins over My Spots' head as it did before Home moved out.
import "../../home/home.css"
import "../../day/day.css"

import { createMemo, createSignal, For, Match, Show, Switch } from "solid-js"

import { Dock as DesignDock, Masthead as DesignMasthead } from "../../design/nav.tsx"
import { Score, Sheet as SheetFrame } from "../../design/parts.tsx"
import { ErrorState, LoadingState, OfflineNotice } from "../../design/states.tsx"
import { paintTemp } from "../../design/ramp.ts"
import { dayName } from "../../design/words.ts"
import { type DayCtx, DayView } from "../../day/sections.tsx"
import { type Avalanche, type HomeCtx, HomeScreen as Home } from "../../home/sections.tsx"
import { AlertSheet, AvalancheSheet } from "../../home/sheets.tsx"
import { formatSnow, getDayLabel, hasSnow } from "../../lib/daily.ts"
import { type AlertView, rankSpots } from "../../lib/forecastView.ts"
import { formatAge } from "../../lib/util.ts"
import type { DesignProps } from "../data.ts"

type Sheet = { kind: "alert"; alert: AlertView } | { kind: "avalanche"; avalanche: Avalanche } | { kind: "search" }

interface Ctx {
    app: DesignProps
    open: (sheet: Sheet) => void
}

const otherTheme = (app: DesignProps) => (app.theme === "light" ? "dark" : "light")

// The shared top bar and dock, wired to the lab's own navigation.
function Masthead(props: Ctx) {
    return (
        <DesignMasthead
            theme={props.app.theme}
            onToggleTheme={() => props.app.setTheme(otherTheme(props.app))}
            home={props.app.link({ name: "home" })}
            spots={props.app.link({ name: "spots" })}
            onSearch={() => props.open({ kind: "search" })}
            map={{ href: "#", onClick: (e) => e.preventDefault() }}
        />
    )
}

function Dock(props: Ctx) {
    const screen = () => props.app.screen.name
    return (
        <DesignDock
            theme={props.app.theme}
            onToggleTheme={() => props.app.setTheme(otherTheme(props.app))}
            home={props.app.link({ name: "home" })}
            spots={props.app.link({ name: "spots" })}
            onSearch={() => props.open({ kind: "search" })}
            map={{ href: "#", onClick: (e) => e.preventDefault() }}
            current={screen() === "home" ? "home" : screen() === "spots" ? "spots" : undefined}
            now={paintTemp(props.app.forecast.current.temperature, props.app.theme)}
        />
    )
}

// Home is shared with the app. The lab wires it to its own links, a star that only remembers itself, and a
// refresh that only says it happened.
function HomeScreen(props: Ctx) {
    const f = () => props.app.forecast
    const [starred, setStarred] = createSignal(false)
    const [refreshed, setRefreshed] = createSignal(false)
    const home: HomeCtx = {
        get forecast() {
            return props.app.forecast
        },
        get theme() {
            return props.app.theme
        },
        dayLink: (date) => props.app.link({ name: "day", date }),
        openAlert: (alert) => props.open({ kind: "alert", alert }),
        openAvalanche: (avalanche) => props.open({ kind: "avalanche", avalanche }),
    }
    return (
        <Home
            {...home}
            saved={starred()}
            onToggleSave={() => setStarred(!starred())}
            updated={refreshed() ? "just now" : formatAge(f().now - Date.parse(f().updatedAt))}
            onRefresh={() => setRefreshed(true)}
        >
            <Masthead {...props} />
        </Home>
    )
}

// The Day screen is shared with the app. The lab wires it to its own links.
function DayScreen(props: Ctx) {
    const days = () => props.app.forecast.days
    const index = createMemo(() => {
        const screen = props.app.screen
        const found = screen.name === "day" ? days().findIndex((d) => d.date === screen.date) : 0
        return Math.max(0, found)
    })
    const ctx: DayCtx = {
        get forecast() {
            return props.app.forecast
        },
        get theme() {
            return props.app.theme
        },
        dayLink: (date) => props.app.link({ name: "day", date }),
        now: props.app.link({ name: "home" }),
    }
    return (
        <For each={[days()[index()]]}>
            {(day) => (
                <DayView {...ctx} day={day} index={index()}>
                    <Masthead {...props} />
                </DayView>
            )}
        </For>
    )
}

// Ranked by score, so the rows sit on the ground: a color here would read as a ranking.
function SpotsScreen(props: Ctx) {
    const [date, setDate] = createSignal<string>()
    const ranked = createMemo(() => rankSpots(props.app.spots, date()))
    const filterDays = () => props.app.spots[0]?.days ?? []

    return (
        <div class="sq-spotsview">
            <Masthead {...props} />
            <div class="sq-split">
                <div class="sq-lead sq-ground sq-spots-head">
                    <h1 class="sq-num">My Spots</h1>
                    <Show when={props.app.spots.length}>
                        <div class="sq-filters" role="group" aria-label="Which day">
                            <button
                                type="button"
                                class="sq-tab"
                                aria-pressed={date() === undefined ? "true" : "false"}
                                onClick={() => setDate(undefined)}
                            >
                                This week
                            </button>
                            <For each={filterDays()}>
                                {(day, i) => (
                                    <button
                                        type="button"
                                        class="sq-tab"
                                        aria-pressed={date() === day.date ? "true" : "false"}
                                        onClick={() => setDate(day.date)}
                                    >
                                        {getDayLabel(day, i(), "short")}
                                    </button>
                                )}
                            </For>
                        </div>
                    </Show>
                </div>
                <div class="sq-rest">
                    <Show
                        when={props.app.spots.length}
                        fallback={<p class="sq-ground sq-empty">Tap the star on any forecast to add it here.</p>}
                    >
                        <ol class="sq-spots">
                            <For each={ranked()}>
                                {(spot) => {
                                    const day = () => spot.day
                                    const index = () => (spot.day ? spot.days.indexOf(spot.day) : -1)
                                    return (
                                        <li>
                                            <div class="sq-ground sq-spot">
                                                <a class="sq-spot-text" {...props.app.link({ name: "home" })}>
                                                    <span class="sq-strong">{spot.name}</span>
                                                    <Show when={day()} fallback={<span>No forecast for this day</span>}>
                                                        {(d) => (
                                                            <>
                                                                <span>
                                                                    {dayName(d(), index())}
                                                                    <Show when={d().condies}>
                                                                        , {d().condies!.bestWindow}
                                                                    </Show>
                                                                </span>
                                                                <Show when={hasSnow(d())}>
                                                                    <span>{formatSnow(d().snow!)} snow</span>
                                                                </Show>
                                                            </>
                                                        )}
                                                    </Show>
                                                </a>
                                                <Score score={day()?.condies?.score} />
                                            </div>
                                        </li>
                                    )
                                }}
                            </For>
                        </ol>
                    </Show>
                </div>
            </div>
        </div>
    )
}

function SearchSheet(props: { samples: string[]; onClose: () => void }) {
    const [query, setQuery] = createSignal("")
    const results = () => {
        const q = query().trim().toLowerCase()
        return q ? props.samples.filter((s) => s.toLowerCase().includes(q)) : props.samples
    }
    let frame!: HTMLDivElement
    const close = () => frame.closest("dialog")?.close()
    return (
        <SheetFrame label="Search for a place" onClose={props.onClose} title="Search">
            <div ref={frame} class="sq-sheet-body">
                <form
                    class="sq-search"
                    onSubmit={(e) => {
                        e.preventDefault()
                        close()
                    }}
                >
                    <label class="sq-strong" for="sq-search-input">
                        Where to?
                    </label>
                    <input
                        autofocus
                        id="sq-search-input"
                        class="sq-input"
                        type="search"
                        placeholder="A town or a mountain"
                        autocomplete="off"
                        value={query()}
                        onInput={(e) => setQuery(e.currentTarget.value)}
                    />
                </form>
                <ul class="sq-results">
                    <For each={results()} fallback={<li class="sq-result-none">No places found.</li>}>
                        {(sample) => {
                            const [name, ...rest] = sample.split(", ")
                            return (
                                <li>
                                    <button type="button" class="sq-result" onClick={close}>
                                        <span class="sq-strong">{name}</span>
                                        <span class="sq-small">{rest.join(", ")}</span>
                                    </button>
                                </li>
                            )
                        }}
                    </For>
                </ul>
            </div>
        </SheetFrame>
    )
}

function Ready(props: { app: DesignProps }) {
    const first = props.app.open === "alert" ? props.app.forecast.alerts[0] : undefined
    const [sheet, setSheet] = createSignal<Sheet | undefined>(
        props.app.open === "search" ? { kind: "search" } : first ? { kind: "alert", alert: first } : undefined,
    )
    const ctx: Ctx = {
        get app() {
            return props.app
        },
        open: setSheet,
    }
    const close = () => setSheet(undefined)

    return (
        <>
            <Show when={props.app.offline}>
                <OfflineNotice />
            </Show>
            <Switch>
                <Match when={props.app.screen.name === "home"}>
                    <HomeScreen {...ctx} />
                </Match>
                <Match when={props.app.screen.name === "day"}>
                    <DayScreen {...ctx} />
                </Match>
                <Match when={props.app.screen.name === "spots"}>
                    <SpotsScreen {...ctx} />
                </Match>
            </Switch>
            <Dock {...ctx} />
            <Switch>
                <Match when={sheet()?.kind === "alert" && sheet()}>
                    {(s) => <AlertSheet alert={(s() as { alert: AlertView }).alert} onClose={close} />}
                </Match>
                <Match when={sheet()?.kind === "avalanche" && sheet()}>
                    {(s) => <AvalancheSheet avalanche={(s() as { avalanche: Avalanche }).avalanche} onClose={close} />}
                </Match>
                <Match when={sheet()?.kind === "search"}>
                    <SearchSheet samples={props.app.searchSamples} onClose={close} />
                </Match>
            </Switch>
        </>
    )
}

export default function Quiet(props: DesignProps) {
    return (
        <div class="sq-root" data-theme={props.theme}>
            <Switch>
                <Match when={props.status === "loading"}>
                    <LoadingState theme={props.theme} />
                </Match>
                <Match when={props.status === "error"}>
                    <ErrorState home={props.link({ name: "home" })} onRetry={() => location.reload()} />
                </Match>
                <Match when={props.status === "ready"}>
                    <Ready app={props} />
                </Match>
            </Switch>
        </div>
    )
}
