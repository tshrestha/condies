import { useLocation } from "@solidjs/router"
import { createSignal, onCleanup, type ParentProps, Show } from "solid-js"

import { Dock, Masthead, type NavProps } from "./design/nav.tsx"
import { paintTemp } from "./design/ramp.ts"
import { OfflineNotice } from "./design/states.tsx"
import { presentTemperature } from "./present.ts"
import SearchSheet from "./SearchSheet.tsx"
import { theme, toggleTheme } from "./theme.ts"

function useOnline() {
    const [online, setOnline] = createSignal(navigator.onLine)
    const update = () => setOnline(navigator.onLine)
    window.addEventListener("online", update)
    window.addEventListener("offline", update)
    onCleanup(() => {
        window.removeEventListener("online", update)
        window.removeEventListener("offline", update)
    })
    return online
}

// The frame every screen sits in: the top bar on wide screens, the dock on phones, the offline notice and search.
// It's the app's one .sq-root, so every screen inside it gets the theme's tokens.
export default function Shell(props: ParentProps) {
    const location = useLocation()
    const online = useOnline()
    const [searching, setSearching] = createSignal(false)

    const nav: NavProps = {
        get theme() {
            return theme()
        },
        onToggleTheme: toggleTheme,
        home: { href: "#/" },
        spots: { href: "#/spots" },
        map: { href: "#/map" },
        onSearch: () => setSearching(true),
    }
    const current = () => {
        const path = location.pathname
        return path === "/" ? "home" : path === "/spots" ? "spots" : path === "/map" ? "map" : undefined
    }
    const now = () => {
        const t = presentTemperature()
        return t === undefined ? undefined : paintTemp(t, theme())
    }

    return (
        <div class="sq-root" data-theme={theme()}>
            <Masthead {...nav} />
            <Show when={!online()}>
                <OfflineNotice />
            </Show>
            {props.children}
            <Dock {...nav} current={current()} now={now()} />
            <Show when={searching()}>
                <SearchSheet onClose={() => setSearching(false)} />
            </Show>
        </div>
    )
}
