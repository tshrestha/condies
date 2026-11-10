import { defineConfig } from "vite"
import solidPlugin from "@solidjs/vite-plugin"

export default defineConfig({
    plugins: [solidPlugin()],
    base: "/condies",
    server: {
        port: 3000,
    },
    build: {
        rolldownOptions: {
            output: {
                codeSplitting: {
                    groups: [
                        {
                            debugName: "vendor",
                            name(id) {
                                if (id.includes("node_modules")) {
                                    // React core - frequently cached, loaded on every page
                                    if (
                                        id.includes("/solid-js/")
                                        || id.includes("/@solidjs/")
                                        || id.includes("/@solid-primitives/scheduled/")
                                    ) {
                                        return "vendor-solid"
                                    }
                                    // Mapbox - large library, only needed on map page
                                    if (id.includes("/maplibre-gl/")) {
                                        return "vendor-maplibre"
                                    }
                                    // UI framework
                                    if (id.includes("/bootstrap/") || id.includes("/bootstrap-icons/")) {
                                        return "vendor-ui"
                                    }
                                }
                            },
                        },
                    ],
                },
            },
        },
    },
})
