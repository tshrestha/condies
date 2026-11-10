import { createSignal, onSettled } from "solid-js"

// Charts draw in real pixels, so that type on them keeps its size at every width.
export function useWidth(element: () => HTMLElement | undefined) {
    const [width, setWidth] = createSignal(0)

    onSettled(() => {
        const node = element()
        if (!node) {
            return
        }
        setWidth(Math.round(node.clientWidth))
        const observer = new ResizeObserver(() => setWidth(Math.round(node.clientWidth)))
        observer.observe(node)
        return () => observer.disconnect()
    })

    return width
}

export const prefersCalm = () => matchMedia("(prefers-reduced-motion: reduce)").matches
