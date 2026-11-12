// Runs in the browser before the app renders. Start mode's generated entry loads it.

// Routes used to live in the URL's hash (/#/forecast/…), so old bookmarks and shared links still open the page they
// name. Only a path on this site is followed.
if (location.hash.startsWith("#/")) {
    const target = new URL(location.hash.slice(1), location.origin)
    if (target.origin === location.origin) {
        history.replaceState(null, "", target.pathname + target.search)
    }
}

if (import.meta.env.PROD && "serviceWorker" in navigator) {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(console.error)
}

// Forecasts age quickly, so reload when someone returns to a tab left open for a while.
const staleAfterMs = 30 * 60 * 1000
const loadedAt = Date.now()
document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && Date.now() - loadedAt > staleAfterMs) {
        location.reload()
    }
})
