import { onSettled } from "solid-js"

import { buildRelief, paintBase, paintLayer, type Painter, surveySheet, type Theme } from "./terrain.ts"
import { prefersCalm } from "./useWidth.ts"

const RISE_MS = 1800
const HOLD_MS = 900

// The loading state is the sheet being surveyed: invented terrain, tide rising, sweep passing over.
export default function Surveying(props: { theme: Theme }) {
    let holder!: HTMLDivElement
    let canvas!: HTMLCanvasElement

    onSettled(() => {
        const width = holder.clientWidth
        const height = holder.clientHeight
        const scale = Math.min(window.devicePixelRatio || 1, 2)
        canvas.width = Math.round(width * scale)
        canvas.height = Math.round(height * scale)
        const ctx = canvas.getContext("2d")!
        ctx.setTransform(scale, 0, 0, scale, 0, 0)
        const relief = buildRelief(surveySheet(), width, height, props.theme)
        const painter: Painter = { ctx, scale, theme: props.theme }

        const paintUpTo = (count: number, partial = 0) => {
            paintBase(painter, relief, width, height)
            relief.layers.slice(0, count).forEach((layer) => paintLayer(painter, layer))
            if (count < relief.layers.length && partial > 0) {
                paintLayer(painter, relief.layers[count], partial)
            }
        }

        if (prefersCalm()) {
            paintUpTo(relief.layers.length)
            return
        }

        let frame = 0
        const start = performance.now()
        const tick = (time: number) => {
            const t = Math.max(0, (time - start) % (RISE_MS + HOLD_MS)) / RISE_MS
            const position = Math.min(1, t) * relief.layers.length
            const whole = Math.floor(position)
            paintUpTo(whole, position - whole)
            frame = requestAnimationFrame(tick)
        }
        frame = requestAnimationFrame(tick)
        return () => cancelAnimationFrame(frame)
    })

    return (
        <main class="rl-state rl-state-loading" role="status" aria-label="Surveying the forecast">
            <div class="rl-survey" ref={holder} aria-hidden="true">
                <canvas ref={canvas} />
                <span class="rl-survey-sweep" />
            </div>
            <p class="rl-state-title">Surveying the week</p>
        </main>
    )
}
