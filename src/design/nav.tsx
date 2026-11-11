import { Cat, MapIcon, SearchIcon, StarIcon } from "./icons.tsx"
import type { Paint } from "./ramp.ts"
import ThemeToggle, { type Theme } from "./ThemeToggle.tsx"

// Spread onto an <a>. A plain hash link in the app; the lab adds a click handler.
export interface LinkProps {
    href: string
    onClick?: (e: MouseEvent) => void
}

export interface NavProps {
    theme: Theme
    onToggleTheme: () => void
    home: LinkProps
    spots: LinkProps
    onSearch: () => void
    onMap: () => void
}

// On a wide screen the controls sit in this top bar. On a phone the dock takes them, and this bar is hidden.
export function Masthead(props: NavProps) {
    return (
        <header class="sq-ground sq-mast">
            <a class="sq-brand" {...props.home}>
                Condies
            </a>
            <nav class="sq-nav" aria-label="Main">
                <button type="button" onClick={() => props.onSearch()}>
                    Search
                </button>
                <a {...props.spots}>Spots</a>
                <button type="button" aria-label="Open the map" onClick={() => props.onMap()}>
                    Map
                </button>
                <ThemeToggle theme={props.theme} onToggle={props.onToggleTheme} />
            </nav>
        </header>
    )
}

// The phone's controls, within thumb reach: clear frosted glass with the page's own colors glowing through, and
// the current tab as a chip in the color of the temperature right now, so a little of the present follows you
// to every screen. It floats, so it's round, unlike the printed, square things on the page. Without a
// temperature yet, the current tab is a plain ink chip.
export function Dock(props: NavProps & { current?: "home" | "spots"; now?: Paint }) {
    const chip = () =>
        props.now
            ? { "--sq-now-chip": props.now.bg, "--sq-now-ink": props.now.ink }
            : { "--sq-now-chip": "var(--sq-ink)", "--sq-now-ink": "var(--sq-ground)" }
    const current = (name: string) => (props.current === name ? "page" : undefined)
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
                <button type="button" class="sq-dock-item" aria-label="Open the map" onClick={() => props.onMap()}>
                    <MapIcon />
                    <span>Map</span>
                </button>
            </nav>
            <ThemeToggle theme={props.theme} onToggle={props.onToggleTheme} class="sq-glass sq-dock-theme" />
        </div>
    )
}
