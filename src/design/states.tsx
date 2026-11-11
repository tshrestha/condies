import type { LinkProps } from "./nav.tsx"
import { rampWalk, type Theme } from "./ramp.ts"

// The first load with nothing saved: a swatch stepping through the temperature ramp in hard cuts.
export function LoadingState(props: { theme: Theme }) {
    const walk = () => rampWalk(props.theme)
    return (
        <div class="sq-loading" role="status">
            <div
                class="sq-loading-band"
                aria-hidden="true"
                style={Object.fromEntries(walk().map((c, i) => [`--c${i}`, c]))}
            />
            <p class="sq-ground sq-loading-text">Getting the forecast.</p>
        </div>
    )
}

export function ErrorState(props: { home: LinkProps; onRetry: () => void }) {
    return (
        <div class="sq-ground sq-error" role="alert">
            <p class="sq-num">Couldn’t load this page.</p>
            <div class="sq-error-actions">
                <button type="button" class="sq-link" onClick={() => props.onRetry()}>
                    Try again
                </button>
                <a class="sq-link" {...props.home}>
                    Go home
                </a>
            </div>
        </div>
    )
}

export function OfflineNotice() {
    return (
        <p class="sq-ground sq-offline" role="status">
            You’re offline. This is the last forecast you loaded.
        </p>
    )
}
