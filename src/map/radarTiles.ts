import * as maplibregl from "maplibre-gl"

import { noaaTileURL, radarProtocol } from "./radar.ts"
import type { SmoothReply, SmoothRequest } from "./radarWorker.ts"

// Hands MapLibre NOAA's radar tiles smoothed (see radarSmooth.ts), by way of a worker. Smoothed tiles are 512
// pixels: four times the memory of NOAA's own, for rain with rounded, sharp-edged shapes rather than squares.
// Browsers that can't draw in a worker get NOAA's tiles as they are.

let registered = false
let worker: Worker | undefined
let nextId = 0
const waiting = new Map<number, { resolve: (bitmap: ImageBitmap) => void; reject: (error: Error) => void }>()

function smoother() {
    if (!worker) {
        worker = new Worker(new URL("./radarWorker.ts", import.meta.url), { type: "module" })
        worker.onmessage = (e: MessageEvent<SmoothReply>) => {
            const reply = e.data
            const tile = waiting.get(reply.id)
            waiting.delete(reply.id)
            if ("error" in reply) {
                tile?.reject(new Error(reply.error))
            } else if (tile) {
                tile.resolve(reply.bitmap)
            } else {
                reply.bitmap.close()
            }
        }
    }
    return worker
}

const send = (message: SmoothRequest) => smoother().postMessage(message)

export function registerRadarTiles() {
    if (registered) {
        return
    }
    registered = true
    if (typeof OffscreenCanvas === "undefined") {
        maplibregl.addProtocol(radarProtocol, async (request, abort) => {
            const response = await fetch(noaaTileURL(request.url, 0), { signal: abort.signal })
            if (!response.ok) {
                throw new Error(`NOAA radar answered with status ${response.status}`)
            }
            return { data: await response.arrayBuffer() }
        })
        return
    }
    maplibregl.addProtocol(
        radarProtocol,
        (request, abort) =>
            new Promise((resolve, reject) => {
                const id = nextId++
                waiting.set(id, { resolve: (bitmap) => resolve({ data: bitmap }), reject })
                send({ id, url: noaaTileURL(request.url) })
                abort.signal.addEventListener(
                    "abort",
                    () => {
                        if (waiting.delete(id)) {
                            send({ id, abort: true })
                            reject(new DOMException("The tile was no longer needed", "AbortError"))
                        }
                    },
                    { once: true },
                )
            }),
    )
}
