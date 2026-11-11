import { createSignal } from "solid-js"

import type { Theme } from "./design/ramp.ts"
import { condiesThemeKey, getItem, setItem } from "./lib/cache.ts"

const system = matchMedia("(prefers-color-scheme: dark)")
const systemTheme = (): Theme => (system.matches ? "dark" : "light")

const savedTheme = (): Theme | undefined => {
    const saved = getItem(condiesThemeKey)
    return saved === "light" || saved === "dark" ? saved : undefined
}

const [theme, setThemeSignal] = createSignal<Theme>(savedTheme() ?? systemTheme())

// index.html applies the same before the first paint. Screens still on Bootstrap read the body's attribute and
// class until they move to Strata Quiet.
function apply(next: Theme) {
    document.documentElement.dataset.theme = next
    document.body.setAttribute("data-bs-theme", next)
    document.body.classList.remove("light-bg", "dark-bg")
    document.body.classList.add(`${next}-bg`)
}

apply(theme())

// Follow the system setting until the user picks a theme themselves.
system.addEventListener("change", () => {
    if (!savedTheme()) {
        setThemeSignal(systemTheme())
        apply(systemTheme())
    }
})

export { theme }

export function setTheme(next: Theme) {
    setThemeSignal(next)
    setItem(condiesThemeKey, next)
    apply(next)
}

export const toggleTheme = () => setTheme(theme() === "light" ? "dark" : "light")
