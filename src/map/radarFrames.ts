import type * as maplibregl from "maplibre-gl"

import { frameAt, loopWindow, parseScanTimes, radarTiles, type Scan, scanListURL } from "./radar.ts"

// The radar on the map: NOAA's latest scan, kept live, and the last hour as a loop.
//
// Each frame is its own raster source and layer. A layer at opacity 0 still loads its tiles but isn't drawn, so
// every frame is ready and changing frames is a cut with nothing to reload. Frames are fetched only up to zoom 8,
// NOAA's own resolution of about 1 km; past that, MapLibre scales them up rather than asking for more.
//
// This runs on plain state rather than signals, since playback ticks every animation frame. It reports to the
// page through onState.

const opacity = 0.65
const prefix = "radar-"
// The key of NOAA's latest scan when its list of scans can't be read, and so has no time.
const untimed = ""
const idOf = (key: string) => `${prefix}${key || "latest"}`

// How often to check for new scans. Tests can shorten it.
const refreshMs = (globalThis as { condiesRadarRefreshMs?: number }).condiesRadarRefreshMs ?? 120_000
const listTimeoutMs = 10_000

export type SegmentState = "unloaded" | "loaded" | "failed"

export interface RadarState {
    // The loop's frames, oldest first, or only the untimed latest when there's no scan list.
    scans: (Scan | undefined)[]
    segments: SegmentState[]
    // The frame on screen.
    index: number
    // The frame asked for, which may still be loading. While playing, the one on screen.
    selected: number
    playing: boolean
    // Whether the loop can play: NOAA's list of scans has been read.
    available: boolean
}

export class RadarFrames {
    #map: maplibregl.Map
    #onState: (state: RadarState) => void

    // NOAA's scans in the last hour, oldest first.
    #scans: Scan[] = []
    #listFailed = false
    // Whether the rest of the hour has been asked for, by playing, scrubbing or stepping.
    #wholeLoop = false
    #playing = false
    #on = true
    #moving = false
    #hidden = document.hidden

    // The frame asked for while paused, by key. Undefined means the latest, whatever it is.
    #wanted: string | undefined
    // The frames whose sources are on the map, and the one drawn.
    #keys: string[] = []
    #shown: string | undefined
    #failed = new Set<string>()
    #beforeId: string | undefined

    // When playback last started from the oldest frame, once every frame was ready.
    #startedAt: number | undefined
    #raf = 0
    #timer: ReturnType<typeof setInterval> | undefined
    #fetching: AbortController | undefined
    #last = ""

    constructor(map: maplibregl.Map, onState: (state: RadarState) => void) {
        this.#map = map
        this.#onState = onState
        map.on("style.load", this.#rebuild)
        map.on("sourcedata", this.#onSourceData)
        map.on("idle", this.#sync)
        map.on("movestart", this.#onMoveStart)
        map.on("moveend", this.#onMoveEnd)
        map.on("error", this.#onError)
        document.addEventListener("visibilitychange", this.#onVisibility)
        this.#startChecking()
    }

    destroy() {
        this.#stopChecking()
        cancelAnimationFrame(this.#raf)
        document.removeEventListener("visibilitychange", this.#onVisibility)
        const map = this.#map
        map.off("style.load", this.#rebuild)
        map.off("sourcedata", this.#onSourceData)
        map.off("idle", this.#sync)
        map.off("movestart", this.#onMoveStart)
        map.off("moveend", this.#onMoveEnd)
        map.off("error", this.#onError)
    }

    play() {
        if (!this.#on || !this.#scans.length) {
            return
        }
        this.#wholeLoop = true
        this.#playing = true
        this.#startedAt = undefined
        this.#tick()
    }

    // Stays on the frame on screen.
    pause() {
        this.#playing = false
        this.#wanted = this.#shown === this.#latest() ? undefined : this.#shown
        this.#sync()
    }

    // Pauses on the frame at index, loading the rest of the hour first if it hasn't been.
    seek(index: number) {
        if (!this.#on || !this.#scans.length) {
            return
        }
        const scan = this.#scans[Math.max(0, Math.min(this.#scans.length - 1, index))]
        this.#wholeLoop = true
        this.#playing = false
        this.#wanted = scan === this.#scans.at(-1) ? undefined : scan.time
        this.#sync()
    }

    // Off, radar stops, lets go of all but the latest frame, and asks NOAA for nothing. On, it comes back paused
    // on the latest.
    setOn(on: boolean) {
        if (on === this.#on) {
            return
        }
        this.#on = on
        this.#playing = false
        this.#wanted = undefined
        if (on) {
            this.#startChecking()
        } else {
            this.#wholeLoop = false
            this.#stopChecking()
        }
        for (const key of this.#keys) {
            if (this.#map.getLayer(idOf(key))) {
                this.#map.setLayoutProperty(idOf(key), "visibility", on ? "visible" : "none")
            }
        }
        this.#sync()
    }

    // NOAA's list of scans

    #startChecking() {
        this.#stopChecking()
        if (!this.#on || this.#hidden) {
            return
        }
        void this.#check()
        this.#timer = setInterval(() => void this.#check(), refreshMs)
    }

    #stopChecking() {
        clearInterval(this.#timer)
        this.#timer = undefined
        this.#fetching?.abort()
        this.#fetching = undefined
    }

    async #check() {
        this.#fetching?.abort()
        const fetching = new AbortController()
        this.#fetching = fetching
        let timedOut = false
        const timeout = setTimeout(() => {
            timedOut = true
            fetching.abort()
        }, listTimeoutMs)
        let scans: Scan[] = []
        try {
            const response = await fetch(scanListURL, { signal: fetching.signal })
            if (response.ok) {
                scans = loopWindow(parseScanTimes(await response.text()))
            }
        } catch {
            // Treated as no list, below.
        } finally {
            clearTimeout(timeout)
        }
        // Stopped, or replaced by a newer check.
        if (fetching.signal.aborted && !timedOut) {
            return
        }
        // A failed check keeps the scans from the last good one. With none, NOAA's untimed latest stands in.
        this.#listFailed = !scans.length && !this.#scans.length
        if (scans.length) {
            this.#scans = scans
            // A frame paused on that has left the hour gives way to the oldest still in it.
            if (this.#wanted !== undefined && !scans.some((s) => s.time === this.#wanted)) {
                this.#wanted = scans[0].time
            }
        }
        this.#sync()
    }

    // Playback

    #tick = () => {
        cancelAnimationFrame(this.#raf)
        this.#sync()
        if (this.#playing && this.#on && !this.#hidden) {
            this.#raf = requestAnimationFrame(this.#tick)
        }
    }

    #latest() {
        return this.#scans.length ? this.#scans.at(-1)!.time : this.#listFailed ? untimed : undefined
    }

    // The frames that should be on the map: the latest, or the whole hour once it's been asked for.
    #wantedKeys() {
        const latest = this.#latest()
        if (latest === undefined) {
            return []
        }
        return this.#wholeLoop && this.#on ? this.#scans.map((s) => s.time) : [latest]
    }

    #loaded(key: string) {
        return !!this.#map.getSource(idOf(key)) && this.#map.isSourceLoaded(idOf(key))
    }

    // Which frame should be on screen now.
    #target(): string | undefined {
        const latest = this.#latest()
        if (!this.#playing) {
            return this.#wanted ?? latest
        }
        const playable = this.#scans.filter((s) => !this.#failed.has(s.time))
        const ready = !this.#moving && playable.length > 1 && playable.every((s) => this.#loaded(s.time))
        if (!ready) {
            // Held on the latest until every frame for this view has loaded, then started again from the oldest.
            this.#startedAt = undefined
            return latest
        }
        const now = performance.now()
        this.#startedAt ??= now
        return playable[frameAt(playable, now - this.#startedAt)].time
    }

    // Brings the map in line with the state: adds and removes frames, and shows the one that's due once it has
    // loaded, keeping the one on screen until then.
    #sync = () => {
        if (!this.#map.style?._loaded) {
            return
        }
        const keys = this.#wantedKeys()
        const target = this.#target()
        const keep = this.#shown !== undefined && this.#loaded(this.#shown) ? [this.#shown] : []
        this.#setKeys([...new Set([...keys, ...keep])])
        if (target !== undefined && target !== this.#shown && (this.#loaded(target) || !keep.length)) {
            this.#show(target)
            if (!keys.includes(keep[0])) {
                this.#setKeys(keys)
            }
        }
        this.#report()
    }

    #show(key: string) {
        const map = this.#map
        if (this.#shown !== undefined && map.getLayer(idOf(this.#shown))) {
            map.setPaintProperty(idOf(this.#shown), "raster-opacity", 0)
        }
        if (map.getLayer(idOf(key))) {
            map.setPaintProperty(idOf(key), "raster-opacity", opacity)
        }
        this.#shown = key
    }

    // The map's layers

    #setKeys(keys: string[]) {
        const map = this.#map
        for (const key of this.#keys) {
            if (!keys.includes(key)) {
                if (map.getLayer(idOf(key))) {
                    map.removeLayer(idOf(key))
                }
                if (map.getSource(idOf(key))) {
                    map.removeSource(idOf(key))
                }
                this.#failed.delete(key)
                if (this.#shown === key) {
                    this.#shown = undefined
                }
            }
        }
        const added = keys.filter((key) => !this.#keys.includes(key))
        this.#keys = keys
        if (added.length) {
            this.#beforeId ??= this.#firstLabel()
            added.forEach(this.#add)
        }
    }

    #add = (key: string) => {
        const id = idOf(key)
        if (this.#map.getSource(id)) {
            return
        }
        this.#map.addSource(id, {
            type: "raster",
            tiles: [radarTiles(key || undefined)],
            tileSize: 256,
            maxzoom: 8,
            // The contiguous US, which is all the mosaic covers.
            bounds: [-130, 20, -60, 55],
            attribution: "Radar: NOAA",
        })
        this.#map.addLayer(
            {
                id,
                type: "raster",
                source: id,
                layout: { visibility: this.#on ? "visible" : "none" },
                paint: {
                    "raster-opacity": key === this.#shown ? opacity : 0,
                    "raster-fade-duration": 0,
                    "raster-resampling": "linear",
                },
            },
            this.#beforeId,
        )
    }

    // Radar goes under the base map's place names.
    #firstLabel() {
        return this.#map.getStyle().layers.find((layer) => layer.type === "symbol")?.id
    }

    // A new base map drops every layer that isn't in it, so the frames go back on, as they were.
    #rebuild = () => {
        this.#beforeId = this.#firstLabel()
        this.#failed.clear()
        this.#keys.forEach(this.#add)
        this.#sync()
    }

    // Events

    // A frame that finishes loading may be the one waiting to be shown.
    #onSourceData = (e: maplibregl.MapSourceDataEvent) => {
        if (e.sourceId?.startsWith(prefix)) {
            this.#sync()
        }
    }

    // A frame with a tile NOAA couldn't send would play with a hole in it, so it's skipped.
    // MapLibre logs errors itself only while nothing else listens for them, so the rest are logged here.
    #onError = (e: { error?: unknown; sourceId?: string }) => {
        if (!e.sourceId?.startsWith(prefix)) {
            console.error(e.error)
            return
        }
        const key = this.#keys.find((k) => idOf(k) === e.sourceId)
        if (key !== undefined && key !== this.#latest()) {
            this.#failed.add(key)
            this.#sync()
        }
    }

    #onMoveStart = () => {
        this.#moving = true
    }

    #onMoveEnd = () => {
        this.#moving = false
        this.#sync()
    }

    #onVisibility = () => {
        this.#hidden = document.hidden
        if (this.#hidden) {
            this.#stopChecking()
            cancelAnimationFrame(this.#raf)
        } else {
            this.#startChecking()
            this.#startedAt = undefined
            this.#tick()
        }
    }

    // Tells the page, when anything it shows has changed.
    #report = () => {
        const scans: (Scan | undefined)[] = this.#scans.length ? this.#scans : [undefined]
        const keys = scans.map((s) => s?.time ?? untimed)
        const segments = keys.map((key): SegmentState =>
            this.#failed.has(key) ? "failed" : this.#loaded(key) ? "loaded" : "unloaded",
        )
        // A latest scan on its way out is still the latest as far as the tape is concerned.
        const shown = keys.indexOf(this.#shown ?? this.#latest() ?? untimed)
        const index = shown < 0 ? keys.length - 1 : shown
        const wanted = keys.indexOf(this.#wanted ?? this.#latest() ?? untimed)
        const state: RadarState = {
            scans,
            segments,
            index,
            selected: this.#playing || wanted < 0 ? index : wanted,
            playing: this.#playing,
            available: this.#scans.length > 0 && this.#on,
        }
        const signature = `${keys.join()}|${segments.join()}|${index}|${state.selected}|${state.playing}|${state.available}`
        if (signature !== this.#last) {
            this.#last = signature
            this.#onState(state)
        }
    }
}
