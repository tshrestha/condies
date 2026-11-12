import { HydrationScript } from "@solidjs/web"
import type { ParentProps } from "solid-js"

// Applies the theme before the first paint, so there's no flash of the wrong colors. theme.ts keeps it in step with
// the toggle.
const applyTheme = `;(function () {
    var theme
    var grounds = { light: "#ffffff", dark: "#0d0d0d" }
    try {
        theme = JSON.parse(localStorage.getItem("condiesTheme"))
    } catch (e) {}
    if (theme !== "light" && theme !== "dark") {
        theme = matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
    }
    document.documentElement.setAttribute("data-theme", theme)
    document.querySelector('meta[name="theme-color"]').setAttribute("content", grounds[theme])
})()`

// The page the app renders into. The build prerenders it once into index.html.
export default function Document(props: ParentProps) {
    return (
        <html lang="en">
            <head>
                <meta charset="UTF-8" />
                <link rel="icon" type="image/svg+xml" href="/icon.svg" />
                <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
                <link rel="manifest" href="/manifest.webmanifest" />
                <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
                <meta name="mobile-web-app-capable" content="yes" />
                {/* The ground of the chosen theme. The script below and theme.ts keep it in step with the toggle. */}
                <meta name="theme-color" content="#ffffff" />
                <title>Condies</title>
                <script innerHTML={applyTheme} />
                {/* Start mode's contract for a custom document. A client-rendered build leaves it out. */}
                <HydrationScript />
            </head>
            <body>{props.children}</body>
        </html>
    )
}
