// The app's server functions (src/server/) on Netlify. The build writes the server to dist/server/server.js, whose
// default export answers a Request: @solidjs/vite-plugin's deployment contract.
import server from "../../dist/server/server.js"

export default (request) => server.fetch(request)

export const config = { path: ["/_server", "/_server/*"] }
