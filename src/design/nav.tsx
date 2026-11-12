import { Cat, MapIcon, SearchIcon, StarIcon } from "./icons.tsx"
import type { Paint } from "./ramp.ts"
import ThemeToggle, { type Theme } from "./ThemeToggle.tsx"

// Spread onto an <a>: a plain link, with an optional click handler.
export interface LinkProps {
    href: string
    onClick?: (e: MouseEvent) => void
}

export type Tab = "home" | "spots" | "map"

export interface NavProps {
    theme: Theme
    onToggleTheme: () => void
    home: LinkProps
    spots: LinkProps
    map: LinkProps
    onSearch: () => void
    // The screen you're on, when it has a tab.
    current?: Tab
}

// A link's aria-current: "page" when it goes to the screen you're on, "false" when it doesn't. The nav links set it
// themselves because the router marks every link whose URL is the location, and on Now that includes the brand link,
// not just the tab. It leaves an aria-current the app set alone. (@solidjs/router 2.0.0-next.44)
export const ariaCurrent = (current: boolean) => (current ? "page" : "false")

// On a wide screen the controls sit in this top bar. On a phone the dock takes them, and this bar is hidden.
export function Masthead(props: NavProps) {
    return (
        <header class="sq-ground sq-mast">
            <a class="sq-brand" aria-current="false" {...props.home}>
                Condies
            </a>
            <nav class="sq-nav" aria-label="Main">
                <button type="button" onClick={() => props.onSearch()}>
                    Search
                </button>
                <a aria-current={ariaCurrent(props.current === "spots")} {...props.spots}>
                    Spots
                </a>
                <a aria-current={ariaCurrent(props.current === "map")} aria-label="Open the map" {...props.map}>
                    Map
                </a>
                <ThemeToggle theme={props.theme} onToggle={props.onToggleTheme} />
            </nav>
        </header>
    )
}

// The phone's controls, within thumb reach: clear frosted glass with the page's own colors glowing through, and
// the current tab as a chip in the color of the temperature right now, so a little of the present follows you
// to every screen. It floats, so it's round, unlike the printed, square things on the page. Without a
// temperature yet, the current tab is a plain ink chip.
export function Dock(props: NavProps & { now?: Paint }) {
    const chip = () =>
        props.now
            ? { "--sq-now-chip": props.now.bg, "--sq-now-ink": props.now.ink }
            : { "--sq-now-chip": "var(--sq-ink)", "--sq-now-ink": "var(--sq-ground)" }
    const current = (tab: Tab) => ariaCurrent(props.current === tab)
    return (
        <div class="sq-dock" style={chip()}>
            <nav class="sq-dock-nav sq-glass" aria-label="Main">
                <a class="sq-dock-item" aria-current={current("home")} {...props.home}>
                    <Cat />
                    <span>Now</span>
                </a>
                <button type="button" class="sq-dock-item" onClick={() => props.onSearch()}>
                    <SearchIcon />
                    <span>Search</span>
                </button>
                <a class="sq-dock-item" aria-current={current("spots")} {...props.spots}>
                    <StarIcon filled={props.current === "spots"} />
                    <span>Spots</span>
                </a>
                <a class="sq-dock-item" aria-current={current("map")} aria-label="Open the map" {...props.map}>
                    <MapIcon />
                    <span>Map</span>
                </a>
            </nav>
            <ThemeToggle theme={props.theme} onToggle={props.onToggleTheme} class="sq-glass sq-dock-theme" />
        </div>
    )
}
