// Refreshes the list of snow stations bundled with the app. The full list is 400 KB and rarely
// changes, so it isn't worth downloading on a phone.
// Run with: node scripts/update-snotel-stations.mjs && npm run fmt
import { writeFile } from "node:fs/promises"

const url =
    "https://wcc.sc.egov.usda.gov/awdbRestApi/services/v1/stations"
    + "?stationTriplets=*:*:SNTL&returnForecastPointMetadata=false&returnReservoirMetadata=false"
    + "&returnStationElements=false&activeOnly=true"

const response = await fetch(url)
if (!response.ok) {
    throw new Error(`station list request failed: ${response.status}`)
}

const round = (value) => Math.round(value * 10_000) / 10_000
const rows = (await response.json())
    .map((s) => [s.stationTriplet, s.name, round(s.latitude), round(s.longitude), s.elevation, s.dataTimeZone])
    .sort(([a], [b]) => a.localeCompare(b))

const target = new URL("../src/assets/snotel-stations.json", import.meta.url)
await writeFile(target, `[\n${rows.map((row) => `    ${JSON.stringify(row)}`).join(",\n")}\n]\n`)
console.log(`wrote ${rows.length} stations`)
