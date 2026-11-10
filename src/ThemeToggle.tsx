import { createSignal, For, Match, onCleanup, Switch } from "solid-js"
import { condiesThemeKey, getItem, setItem } from "./lib/cache.ts"

const condiesTheme = { light: "light", dark: "dark" }
const bgClasses = ["dark-bg", "light-bg"]

function updateTheme(theme: string) {
    if (theme) {
        const body = document.body
        body.classList.remove(...bgClasses)
        body.setAttribute("data-bs-theme", theme)

        if (theme === condiesTheme.dark) {
            body.classList.add("dark-bg")
        } else {
            body.classList.add("light-bg")
        }
    }
}

export default function ThemeToggle() {
    const systemTheme = matchMedia("(prefers-color-scheme: dark)")
    const getSystemTheme = () => (systemTheme.matches ? condiesTheme.dark : condiesTheme.light)

    const initialTheme: string = getItem(condiesThemeKey) || getSystemTheme()
    const [theme, setTheme] = createSignal(initialTheme)
    updateTheme(initialTheme)

    // Follow the system setting until the user picks a theme themselves.
    const onSystemChange = () => {
        if (!getItem(condiesThemeKey)) {
            setTheme(getSystemTheme())
            updateTheme(getSystemTheme())
        }
    }
    systemTheme.addEventListener("change", onSystemChange)
    onCleanup(() => systemTheme.removeEventListener("change", onSystemChange))

    const onClick = (t: string) => {
        setTheme(t)
        setItem(condiesThemeKey, t)
        updateTheme(t)
    }

    return (
        <div class="d-flex justify-content-end align-items-center">
            <div class="btn-group btn-group-sm bg-body" role="group" aria-label="Light and dark mode toggle buttons">
                <For each={Object.values(condiesTheme)}>
                    {(t) => (
                        <>
                            <input
                                type="radio"
                                class="btn-check"
                                name="theme-btn"
                                id={`condies-theme-${t}`}
                                autocomplete="off"
                                checked={t === theme()}
                                onClick={() => onClick(t)}
                            />
                            <label
                                class={`btn ${
                                    theme() === "dark" ? "btn-outline-light" : "btn-outline-primary"
                                } text-uppercase`}
                                for={`condies-theme-${t}`}
                            >
                                <Switch>
                                    <Match when={t === theme() && t === condiesTheme.light}>
                                        <i class={"bi bi-sun-fill"} />
                                    </Match>
                                    <Match when={t !== theme() && t === condiesTheme.light}>
                                        <i class={"bi bi-sun"} />
                                    </Match>
                                    <Match when={t === theme() && t === condiesTheme.dark}>
                                        <i class={"bi bi-moon-fill"} />
                                    </Match>
                                    <Match when={t !== theme() && t === condiesTheme.dark}>
                                        <i class={"bi bi-moon"} />
                                    </Match>
                                </Switch>
                                <small>{` ${t}`}</small>
                            </label>
                        </>
                    )}
                </For>
            </div>
        </div>
    )
}
