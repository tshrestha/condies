// Smoothing a radar tile without blurring it. NOAA paints each 1 km cell one color, so enlarged, rain is squares.
// Enlarged smoothly instead, it's a haze. So a tile is enlarged smoothly and then every pixel is put back to the
// nearest of the colors NOAA used in that tile: the shapes come out rounded, and the edges between colors, and
// between rain and none, stay sharp.

export type Palette = Uint8ClampedArray[]

// The colors NOAA used, from its own tile: every pixel with any rain, without repeats.
export function paletteOf(pixels: Uint8ClampedArray): Palette {
    const colors = new Map<number, Uint8ClampedArray>()
    for (let i = 0; i < pixels.length; i += 4) {
        if (pixels[i + 3] > 0) {
            const key = ((pixels[i] << 16) | (pixels[i + 1] << 8) | pixels[i + 2]) * 256 + pixels[i + 3]
            if (!colors.has(key)) {
                colors.set(key, pixels.slice(i, i + 4))
            }
        }
    }
    return [...colors.values()]
}

// Puts every pixel, in place, to the nearest palette color, or to none where it's less than half there. Nearby
// smoothed colors are close to each other, so each is matched once.
export function snapToPalette(pixels: Uint8ClampedArray, palette: Palette) {
    const matches = new Map<number, Uint8ClampedArray>()
    for (let i = 0; i < pixels.length; i += 4) {
        if (pixels[i + 3] < 128 || !palette.length) {
            pixels[i] = pixels[i + 1] = pixels[i + 2] = pixels[i + 3] = 0
            continue
        }
        const r = pixels[i]
        const g = pixels[i + 1]
        const b = pixels[i + 2]
        const key = ((r >> 2) << 12) | ((g >> 2) << 6) | (b >> 2)
        let best = matches.get(key)
        if (!best) {
            let nearest = Infinity
            for (const color of palette) {
                const d = (color[0] - r) ** 2 + (color[1] - g) ** 2 + (color[2] - b) ** 2
                if (d < nearest) {
                    nearest = d
                    best = color
                }
            }
            matches.set(key, best!)
        }
        pixels.set(best!, i)
    }
}
