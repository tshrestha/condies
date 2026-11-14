import { expect, test } from "vitest"

import {
    clockTime,
    frameAt,
    holdMs,
    loopLength,
    loopWindow,
    msPerScanMinute,
    parseScanTimes,
    readout,
    radarTiles,
    type Scan,
    spokenReadout,
} from "./radar.ts"

// Trimmed from NOAA's real capabilities for conus_bref_qcd, 2026-11-14.
const capabilities = (times: string) => `<?xml version="1.0" encoding="UTF-8"?>
<WMS_Capabilities version="1.3.0">
  <Capability>
    <Layer queryable="1" opaque="0">
      <Name>conus_bref_qcd</Name>
      <BoundingBox CRS="CRS:84" minx="-130.0" miny="20.000000782311" maxx="-60.0000015646219" maxy="55.0"/>
      <Dimension name="time" default="2026-11-14T20:28:09Z" units="ISO8601" nearestValue="1">${times}</Dimension>
      <DataURL>
        <Format>text/plain</Format>
        <OnlineResource xlink:type="simple" xlink:href="https://mrms.ncep.noaa.gov/data/RIDGEII/L2/CONUS/BREF_QCD"/>
      </DataURL>
    </Layer>
  </Capability>
</WMS_Capabilities>`

const scan = (time: string): Scan => ({ time, at: Date.parse(time) })

test("scan times are read from the time dimension, oldest first, as NOAA wrote them", () => {
    const scans = parseScanTimes(
        capabilities("2026-11-14T20:26:12.000Z,2026-11-14T18:30:18.000Z,2026-11-14T20:28:09.000Z"),
    )
    expect(scans.map((s) => s.time)).toEqual([
        "2026-11-14T18:30:18.000Z",
        "2026-11-14T20:26:12.000Z",
        "2026-11-14T20:28:09.000Z",
    ])
    expect(scans[0].at).toBe(Date.parse("2026-11-14T18:30:18.000Z"))
})

test("a missing, empty or garbled time dimension gives no scans", () => {
    expect(parseScanTimes("<WMS_Capabilities><Layer><Name>x</Name></Layer></WMS_Capabilities>")).toEqual([])
    expect(parseScanTimes(capabilities(""))).toEqual([])
    expect(parseScanTimes(capabilities("soon, later"))).toEqual([])
    expect(parseScanTimes("not xml at all")).toEqual([])
})

test("repeated times count once", () => {
    expect(parseScanTimes(capabilities("2026-11-14T20:28:09.000Z,2026-11-14T20:28:09.000Z"))).toHaveLength(1)
})

// Two hours of scans 1.5 to 2.5 minutes apart, as NOAA lists them.
function twoHours() {
    const gaps = [90, 150, 120, 105, 135]
    const scans: Scan[] = []
    let at = Date.parse("2026-11-14T18:30:00.000Z")
    for (let i = 0; at <= Date.parse("2026-11-14T20:30:00.000Z"); i++) {
        scans.push(scan(new Date(at).toISOString()))
        at += gaps[i % gaps.length] * 1000
    }
    return scans
}

test("the loop holds the hour ending at the latest scan, oldest first", () => {
    const scans = twoHours()
    const loop = loopWindow(scans)
    const latest = scans.at(-1)!
    expect(loop.at(-1)).toBe(latest)
    expect(loop[0].at).toBeGreaterThanOrEqual(latest.at - 60 * 60_000)
    expect(scans[scans.indexOf(loop[0]) - 1].at).toBeLessThan(latest.at - 60 * 60_000)
    expect(loop.length).toBeGreaterThanOrEqual(25)
    expect(loop.length).toBeLessThanOrEqual(40)
    expect(loopWindow([])).toEqual([])
})

test("playback follows the scans' clock, holds on the latest, then starts again", () => {
    const loop = [
        scan("2026-11-14T20:00:00Z"),
        scan("2026-11-14T20:02:00Z"),
        scan("2026-11-14T20:03:30Z"),
        scan("2026-11-14T20:06:00Z"),
    ]
    const at = (minutes: number) => minutes * msPerScanMinute
    expect(frameAt(loop, 0)).toBe(0)
    expect(frameAt(loop, at(1.9))).toBe(0)
    expect(frameAt(loop, at(2))).toBe(1)
    expect(frameAt(loop, at(3.4))).toBe(1)
    expect(frameAt(loop, at(3.5))).toBe(2)
    expect(frameAt(loop, at(5.9))).toBe(2)
    expect(frameAt(loop, at(6))).toBe(3)

    // The latest holds, then the loop wraps to the oldest.
    expect(loopLength(loop)).toBeCloseTo(at(6) + holdMs)
    expect(frameAt(loop, at(6) + holdMs - 1)).toBe(3)
    expect(frameAt(loop, at(6) + holdMs)).toBe(0)
    expect(frameAt(loop, at(6) + holdMs + at(2))).toBe(1)
})

test("an hour plays in about 4 seconds, about 7 frames a second", () => {
    const loop = loopWindow(twoHours())
    const playing = loopLength(loop) - holdMs
    expect(playing).toBeGreaterThan(4000)
    expect(playing).toBeLessThan(4600)
    expect(loop.length / (playing / 1000)).toBeGreaterThan(6)
    expect(loop.length / (playing / 1000)).toBeLessThan(9)
})

test("a loop of one scan stays on it", () => {
    expect(frameAt([scan("2026-11-14T20:00:00Z")], 12_345)).toBe(0)
    expect(frameAt([], 12_345)).toBe(0)
})

test("the readout gives the scan's time and age, as the app writes them", () => {
    const at1348 = scan("2026-11-14T20:48:00Z")
    const now = Date.parse("2026-11-14T21:28:30Z")
    expect(clockTime(at1348.at, "America/Denver")).toBe("1:48 PM")
    expect(readout(at1348, false, now, "America/Denver")).toBe("1:48 PM, 40 min ago")
    expect(spokenReadout(at1348, false, now, "America/Denver")).toBe("1:48 PM, 40 minutes ago")
    expect(readout(scan("2026-11-14T21:26:00Z"), true, now, "America/Denver")).toBe("2:26 PM, latest")
    expect(spokenReadout(scan("2026-11-14T21:26:00Z"), true, now, "America/Denver")).toBe("2:26 PM, latest")
    expect(spokenReadout(scan("2026-11-14T21:27:00Z"), false, now, "America/Denver")).toBe("2:27 PM, 1 minute ago")
})

test("a scan that seems to be from the future is just now", () => {
    const now = Date.parse("2026-11-14T21:28:00Z")
    const ahead = scan("2026-11-14T21:30:00Z")
    expect(readout(ahead, false, now, "America/Denver")).toBe("2:30 PM, just now")
    expect(spokenReadout(ahead, false, now, "America/Denver")).toBe("2:30 PM, just now")
})

test("tile URLs ask for a scan by its time, or the latest without one", () => {
    expect(radarTiles("2026-11-14T20:28:09.000Z")).toMatch(/&TIME=2026-11-14T20:28:09\.000Z$/)
    expect(radarTiles()).not.toContain("TIME=")
    expect(radarTiles()).toContain("BBOX={bbox-epsg-3857}")
})
