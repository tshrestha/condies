import netlify from "@netlify/vite-plugin"
import solidPlugin from "@solidjs/vite-plugin"
import { defineConfig } from "vite"

export default defineConfig({
    plugins: [
        // Start mode, client-rendered: the build prerenders src/Document.tsx into a static index.html around
        // src/App.tsx, and builds a server that answers the app's server functions (src/server/geocoding.ts).
        solidPlugin({ start: { clientSetup: "./src/client-setup.ts" }, serverFunctions: true }),
        // Deploys that server as a Netlify Function, and emulates Netlify's platform under `vite dev`.
        netlify({ build: { enabled: true } }),
    ],
    server: {
        port: 3000,
    },
    environments: {
        client: {
            build: {
                rolldownOptions: {
                    output: {
                        codeSplitting: {
                            groups: [
                                {
                                    debugName: "vendor",
                                    name(id) {
                                        if (id.includes("node_modules")) {
                                            // Solid core - frequently cached, loaded on every page
                                            if (
                                                id.includes("/solid-js/")
                                                || id.includes("/@solidjs/")
                                                || id.includes("/@solid-primitives/scheduled/")
                                            ) {
                                                return "vendor-solid"
                                            }
                                            // MapLibre - large library, only needed on map page
                                            if (id.includes("/maplibre-gl/")) {
                                                return "vendor-maplibre"
                                            }
                                        }
                                    },
                                },
                            ],
                        },
                    },
                },
            },
        },
    },
})
