import { createSignal, For, Match, Switch } from "solid-js"
import { getItem, setItem } from "./lib/cache.ts"
import { getTimeOfDay } from "./lib/util.ts"

const condiesTheme = { light: "light", dark: "dark" }
const bgClasses = ["morning", "day", "evening", "night"]

function updateTheme(theme: string) {
    const body = document.body
    body.classList.remove(...bgClasses)
    body.setAttribute("data-bs-theme", theme)

    if (theme === condiesTheme.dark) {
        body.classList.add("night")
    } else {
        body.classList.add(getTimeOfDay())
    }
}

export default function ThemeToggle() {
    let savedTheme = getItem("condiesTheme")
    const [theme, setTheme] = createSignal(savedTheme || condiesTheme.light)
    updateTheme(theme())

    const onClick = (t: string) => {
        navigator.vibrate(200)
        setTheme(t)
        setItem("condiesTheme", t)
        updateTheme(theme())
    }

    return (
        <div class="d-flex justify-content-end align-items-center">
            <div class="btn-group btn-group-sm" role="group" aria-label="Light and dark mode toggle buttons">
                <For each={Object.values(condiesTheme)}>
                    {(t) => (
                        <>
                            <input
                                type="radio"
                                class="btn-check"
                                name="btnradio"
                                id={`condies-theme-${t}`}
                                autocomplete="off"
                                checked={t === theme()}
                                onclick={() => onClick(t)}
                            />
                            <label class="btn btn-outline-primary text-capitalize" for={`condies-theme-${t}`}>
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
                                </Switch>{" "}
                                {t}
                            </label>
                        </>
                    )}
                </For>
            </div>
        </div>
    )
}
