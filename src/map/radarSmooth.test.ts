import { expect, test } from "vitest"

import { paletteOf, snapToPalette } from "./radarSmooth.ts"

const pixels = (...colors: number[][]) => new Uint8ClampedArray(colors.flat())

const green = [0, 200, 0, 255]
const yellow = [230, 230, 0, 255]
const red = [220, 0, 0, 255]
const none = [0, 0, 0, 0]

test("the palette is the colors NOAA used, once each, without the clear pixels", () => {
    const palette = paletteOf(pixels(green, none, yellow, green, none, yellow))
    expect(palette.map((c) => [...c])).toEqual([green, yellow])
})

test("smoothed colors go back to the nearest of NOAA's", () => {
    const palette = paletteOf(pixels(green, yellow, red))
    // Between green and yellow, nearer yellow; a muddy red-yellow, nearer red.
    const smoothed = pixels([170, 220, 0, 255], [215, 60, 0, 255], [10, 190, 5, 255])
    snapToPalette(smoothed, palette)
    expect([...smoothed]).toEqual([...yellow, ...red, ...green])
})

test("the edge of the rain is sharp: under half there is none, over half is rain", () => {
    const palette = paletteOf(pixels(green))
    const edge = pixels([0, 200, 0, 127], [0, 200, 0, 128], [0, 180, 0, 200])
    snapToPalette(edge, palette)
    expect([...edge]).toEqual([...none, ...green, ...green])
})

test("a tile with no rain stays clear", () => {
    const clear = pixels([30, 40, 50, 200], none)
    snapToPalette(clear, paletteOf(pixels(none, none)))
    expect([...clear]).toEqual([...none, ...none])
})
