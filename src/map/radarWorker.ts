// Off the main thread, so the map keeps moving while an hour of tiles is smoothed: fetches each of NOAA's tiles,
// smooths it (see radarSmooth.ts) and sends it back, ready to draw.

import { tileBorder, tilePixels, tileScale } from "./radar.ts"
import { paletteOf, snapToPalette } from "./radarSmooth.ts"

// In output pixels: enough to round the steps between NOAA's cells before the colors are put back.
const blurPx = 1.2

export type SmoothRequest = { id: number; url: string } | { id: number; abort: true }
export type SmoothReply = { id: number; bitmap: ImageBitmap } | { id: number; error: string }

const working = new Map<number, AbortController>()

const reply = (message: SmoothReply, transfer: Transferable[] = []) => self.postMessage(message, { transfer })

async function smooth(url: string, signal: AbortSignal) {
    const response = await fetch(url, { signal })
    if (!response.ok) {
        throw new Error(`NOAA radar answered with status ${response.status}`)
    }
    const noaa = await createImageBitmap(await response.blob())
    const read = new OffscreenCanvas(noaa.width, noaa.height).getContext("2d", { willReadFrequently: true })!
    read.drawImage(noaa, 0, 0)
    const palette = paletteOf(read.getImageData(0, 0, noaa.width, noaa.height).data)
    // No rain: a clear pixel, stretched over the tile, rather than a quarter million of them. Made from pixels,
    // since a canvas that was never drawn on can't give up a bitmap.
    if (!palette.length) {
        noaa.close()
        return createImageBitmap(new ImageData(1, 1))
    }
    const size = tilePixels * tileScale
    const canvas = new OffscreenCanvas(size, size)
    const context = canvas.getContext("2d", { willReadFrequently: true })!
    context.imageSmoothingEnabled = true
    context.imageSmoothingQuality = "high"
    // Browsers without canvas filters still get the smooth enlargement.
    context.filter = `blur(${blurPx}px)`
    // The border falls outside the canvas, so the blur meets the neighboring tile's colors at the seam.
    const border = tileBorder * tileScale
    context.drawImage(noaa, -border, -border, size + 2 * border, size + 2 * border)
    noaa.close()
    const pixels = context.getImageData(0, 0, size, size)
    snapToPalette(pixels.data, palette)
    context.putImageData(pixels, 0, 0)
    return canvas.transferToImageBitmap()
}

self.onmessage = async (e: MessageEvent<SmoothRequest>) => {
    const message = e.data
    if ("abort" in message) {
        working.get(message.id)?.abort()
        return
    }
    const controller = new AbortController()
    working.set(message.id, controller)
    try {
        const bitmap = await smooth(message.url, controller.signal)
        reply({ id: message.id, bitmap }, [bitmap])
    } catch (error) {
        reply({ id: message.id, error: error instanceof Error ? error.message : String(error) })
    } finally {
        working.delete(message.id)
    }
}
