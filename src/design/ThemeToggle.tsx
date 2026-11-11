import type { Theme } from "./ramp.ts"

export type { Theme }

let horizonCount = 0

// The theme switch is a horizon. In light mode the sun is up. Switching sets the sun and raises a crescent moon,
// with two stars coming out; switching back is a sunrise. It shows the current theme, like a light switch.
export default function ThemeToggle(props: { theme: Theme; onToggle: () => void; class?: string }) {
    // Every copy on the page needs its own clip and mask ids.
    const id = `sq-horizon-${++horizonCount}`
    const dark = () => props.theme === "dark"
    return (
        <button
            type="button"
            class={`sq-theme ${props.class ?? ""}`}
            aria-label="Dark mode"
            aria-pressed={dark() ? "true" : "false"}
            onClick={() => props.onToggle()}
        >
            <svg class={dark() ? "sq-horizon sq-horizon-dark" : "sq-horizon"} viewBox="0 0 28 28" aria-hidden="true">
                <defs>
                    <clipPath id={`${id}-sky`}>
                        <rect width="28" height="19" />
                    </clipPath>
                    <mask id={`${id}-cut`}>
                        <rect width="28" height="28" fill="#fff" />
                        <circle cx="17.5" cy="10.5" r="4.6" fill="#000" />
                    </mask>
                </defs>
                <g clip-path={`url(#${id}-sky)`}>
                    <g class="sq-horizon-sun">
                        <circle cx="14" cy="14.5" r="4.5" />
                        <path d="M14 6.5V8M8.34 8.84l1.06 1.06M19.66 8.84l-1.06 1.06M6 14.5h1.5M20.5 14.5H22" />
                    </g>
                    <g class="sq-horizon-moon">
                        <circle cx="14" cy="12.5" r="5.5" mask={`url(#${id}-cut)`} />
                    </g>
                </g>
                <path class="sq-horizon-line" d="M3.5 20h21" />
                <g class="sq-horizon-stars">
                    <circle cx="6.5" cy="6.5" r="1.1" />
                    <circle cx="22.5" cy="5" r="1" />
                </g>
            </svg>
        </button>
    )
}
