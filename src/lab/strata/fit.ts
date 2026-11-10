// Advance width and left and right side bearings of League Gothic, in thousandths of an em, measured from
// the font. With them a size can be computed in CSS (100cqi / width) so that the ink of a word lands exactly
// on both grid edges, with no measuring at runtime.
const metrics: Record<string, [number, number, number]> = {
    "0": [354, 33, 33],
    "1": [240, 20, 40],
    "2": [363, 35, 35],
    "3": [352, 30, 30],
    "4": [351, 18, 18],
    "5": [342, 30, 30],
    "6": [342, 30, 30],
    "7": [307, 18, 18],
    "8": [340, 26, 26],
    "9": [342, 30, 30],
    "°": [229, 40, 40],
    "−": [379, 36, 36],
    "-": [217, 36, 36],
    ".": [157, 26, 26],
    ",": [151, 22, 24],
    "'": [151, 28, 18],
    "/": [352, 4, 4],
    " ": [154, 0, 154],
    A: [389, 18, 18],
    B: [364, 40, 24],
    C: [358, 35, 35],
    D: [372, 40, 35],
    E: [327, 40, 40],
    F: [301, 40, 4],
    G: [363, 35, 40],
    H: [380, 40, 40],
    I: [188, 40, 40],
    J: [212, 6, 40],
    K: [375, 40, 10],
    L: [295, 40, 4],
    M: [484, 40, 40],
    N: [395, 40, 40],
    O: [358, 35, 35],
    P: [352, 40, 19],
    Q: [358, 35, 14],
    R: [357, 40, 20],
    S: [338, 18, 18],
    T: [332, 10, 10],
    U: [368, 40, 40],
    V: [362, 15, 15],
    W: [512, 15, 15],
    X: [374, 15, 15],
    Y: [358, 15, 15],
    Z: [316, 15, 15],
    a: [320, 18, 25],
    b: [304, 25, 20],
    c: [299, 20, 20],
    d: [320, 20, 41],
    e: [301, 20, 20],
    f: [234, 5, 5],
    g: [345, 8, 3],
    h: [314, 25, 25],
    i: [161, 30, 30],
    j: [168, -22, 30],
    k: [304, 25, 8],
    l: [161, 30, 30],
    m: [471, 25, 25],
    n: [309, 25, 25],
    o: [299, 20, 20],
    p: [304, 25, 20],
    q: [304, 20, 25],
    r: [237, 25, 10],
    s: [300, 15, 15],
    t: [232, 5, 5],
    u: [309, 25, 25],
    v: [293, 8, 8],
    w: [437, 8, 8],
    x: [301, 8, 8],
    y: [301, 8, 8],
    z: [296, 25, 25],
}

const fallback: [number, number, number] = [340, 20, 20]
const of = (char?: string) => (char && metrics[char]) || fallback

// The ink width of a line in ems, from the left edge of its first glyph to the right edge of its last.
export function emWidth(text: string) {
    const chars = [...text]
    const total = chars.reduce((sum, char) => sum + of(char)[0], 0)
    return (total - of(chars[0])[1] - of(chars.at(-1))[2]) / 1000
}

// The custom properties a fitted element reads. Its CSS uses calc(100cqi / var(--em)) and a negative
// margin of var(--lsb) ems, so that ink rather than the glyph box sits on the grid.
export const fit = (text: string) => ({
    "--em": emWidth(text).toFixed(3),
    "--lsb": (of([...text][0])[1] / 1000).toFixed(3),
})
