// Lets the app open with no signal, showing the last forecast it loaded.
const SHELL_CACHE = "condies-shell-v1"
const DATA_CACHE = "condies-data-v1"
const FORECAST_HOSTS = ["api.weather.gov", "aa.usno.navy.mil", "api.avalanche.org", "wcc.sc.egov.usda.gov"]
const MAX_FORECAST_RESPONSES = 120
// On a weak signal a request can hang for a minute, so stop waiting once there's a saved copy to show.
// Forecast data gets longer because an old forecast is worse than a slow one.
const SHELL_TIMEOUT_MS = 3_000
const DATA_TIMEOUT_MS = 8_000

self.addEventListener("install", () => self.skipWaiting())

self.addEventListener("activate", (event) => {
    event.waitUntil(
        caches
            .keys()
            .then((names) =>
                Promise.all(
                    names
                        .filter((name) => ![SHELL_CACHE, DATA_CACHE].includes(name))
                        .map((name) => caches.delete(name)),
                ),
            )
            .then(() => self.clients.claim()),
    )
})

async function trim(cache) {
    const keys = await cache.keys()
    await Promise.all(keys.slice(0, Math.max(0, keys.length - MAX_FORECAST_RESPONSES)).map((key) => cache.delete(key)))
}

async function networkFirst(event, cacheName, timeoutMs) {
    const { request } = event
    const cache = await caches.open(cacheName)
    const cached = await cache.match(request, { ignoreVary: true })

    const network = fetch(request).then(async (response) => {
        if (response.ok) {
            await cache.put(request, response.clone())
            await trim(cache)
        }
        return response
    })
    if (!cached) {
        return network
    }

    // The request keeps running after a timeout, so the next open has the new data.
    event.waitUntil(network.catch(() => {}))
    const timeout = new Promise((resolve) => setTimeout(resolve, timeoutMs, cached))
    return Promise.race([
        network.then((response) => (response.status >= 500 ? cached : response)).catch(() => cached),
        timeout,
    ])
}

// Built files have a content hash in their names, so a cached copy is never out of date.
async function cacheFirst(request) {
    const cache = await caches.open(SHELL_CACHE)
    const cached = await cache.match(request)
    if (cached) {
        return cached
    }
    const response = await fetch(request)
    if (response.ok) {
        await cache.put(request, response.clone())
    }
    return response
}

self.addEventListener("fetch", (event) => {
    const { request } = event
    if (request.method !== "GET") {
        return
    }

    const url = new URL(request.url)
    if (FORECAST_HOSTS.includes(url.hostname)) {
        // A location's grid almost never changes, and every other request has to wait for it.
        const timeout = url.pathname.startsWith("/points/") ? 0 : DATA_TIMEOUT_MS
        event.respondWith(networkFirst(event, DATA_CACHE, timeout))
    } else if (url.origin === self.location.origin) {
        event.respondWith(
            url.pathname.includes("/assets/")
                ? cacheFirst(request)
                : networkFirst(event, SHELL_CACHE, SHELL_TIMEOUT_MS),
        )
    }
})
