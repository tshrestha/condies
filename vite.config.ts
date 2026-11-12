import solidPlugin from "@solidjs/vite-plugin"
import { defineConfig } from "vite"

// The server reads its settings from process.env (see netlify.toml). Locally they come from .env, which isn't
// committed. Netlify sets them itself and has no .env.
try {
    process.loadEnvFile()
} catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        throw error
    }
}

export default defineConfig({
    plugins: [
        // Start mode, client-rendered: the build prerenders src/Document.tsx into a static index.html around
        // src/App.tsx, and builds a server that answers the app's server functions (src/server/geocoding.ts).
        // netlify/functions/server.mjs deploys that server.
        solidPlugin({ start: { clientSetup: "./src/client-setup.ts" }, serverFunctions: true }),
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
