// Renders a design from the lab across scenarios and checks it for layout and accessibility problems.
// Usage: node scripts/lab-shots.mjs <design> <output dir> [quick|full] [port]
import { mkdirSync, readFileSync } from "node:fs"
import { createRequire } from "node:module"
import { join } from "node:path"

import { chromium } from "@playwright/test"

const [design, outDir, matrix = "quick", port = "3000"] = process.argv.slice(2)
if (!design || !outDir) {
    console.error("usage: node scripts/lab-shots.mjs <design> <output dir> [quick|full] [port]")
    process.exit(1)
}
mkdirSync(outDir, { recursive: true })

const axeSource = readFileSync(createRequire(import.meta.url).resolve("axe-core/axe.min.js"), "utf8")

const phone = { width: 390, height: 844 }
const small = { width: 320, height: 640 }
const wide = { width: 1280, height: 800 }

const shot = (name, query, viewport = phone) => ({ name, query, viewport })

const quick = [
    shot("pow-home-light", "scenario=pow&theme=light"),
    shot("pow-home-dark", "scenario=pow&theme=dark"),
    shot("pow-day-light", "scenario=pow&theme=light&screen=day&day=0"),
    shot("pow-day-dark", "scenario=pow&theme=dark&screen=day&day=2"),
    shot("pow-spots-light", "scenario=pow&theme=light&screen=spots"),
    shot("pow-alert-open", "scenario=pow&theme=light&open=alert"),
    shot("pow-search-open", "scenario=pow&theme=light&open=search"),
    shot("bluebird-home-light", "scenario=bluebird&theme=light"),
    shot("rain-home-dark", "scenario=rain&theme=dark&hour=22"),
    shot("heat-home-light", "scenario=heat&theme=light"),
    shot("thunder-home-dark", "scenario=thunder&theme=dark"),
    shot("loading", "status=loading&theme=light"),
    shot("error", "status=error&theme=dark"),
    shot("offline-pow", "scenario=pow&theme=light&offline=1"),
    shot("spots-empty", "scenario=pow&theme=light&screen=spots&spots=0"),
    shot("heat-small", "scenario=heat&theme=light", small),
    shot("pow-wide", "scenario=pow&theme=light", wide),
]

const scenarios = ["pow", "bluebird", "rain", "heat", "thunder"]
const full = [
    ...quick,
    ...scenarios.flatMap((s) =>
        ["light", "dark"].flatMap((theme) => [
            shot(`${s}-home-${theme}`, `scenario=${s}&theme=${theme}`),
            shot(`${s}-night-${theme}`, `scenario=${s}&theme=${theme}&hour=22`),
            shot(`${s}-day1-${theme}`, `scenario=${s}&theme=${theme}&screen=day&day=1`),
            shot(`${s}-spots-${theme}`, `scenario=${s}&theme=${theme}&screen=spots`),
        ]),
    ),
]

const shots = matrix === "full" ? full : quick
const browser = await chromium.launch()
let problems = 0

for (const { name, query, viewport } of shots) {
    const context = await browser.newContext({ viewport, deviceScaleFactor: 2, timezoneId: "America/Denver" })
    const page = await context.newPage()
    const errors = []
    page.on("pageerror", (e) => errors.push(e.message))
    page.on("console", (m) => m.type() === "error" && errors.push(m.text()))

    await page.goto(`http://localhost:${port}/condies/lab.html?design=${design}&chrome=0&${query}`)
    await page.waitForLoadState("networkidle")
    await page.evaluate(() => document.fonts.ready)
    // Lets entrance animations finish, so a screenshot shows the settled design.
    await page.waitForTimeout(1800)
    // What a person sees before scrolling, for judging the first glance.
    await page.screenshot({ path: join(outDir, `${name}-fold.png`) })
    // A full-page capture would freeze bars fixed to the bottom of the screen mid-page, so move them to the
    // bottom of the page, where they sit once you've scrolled there.
    await page.evaluate(() => {
        const pageHeight = document.documentElement.scrollHeight
        for (const el of document.querySelectorAll("body *")) {
            const box = el.getBoundingClientRect()
            if (getComputedStyle(el).position === "fixed" && box.top > innerHeight / 2) {
                el.style.position = "absolute"
                el.style.top = `${pageHeight - (innerHeight - box.top)}px`
                el.style.bottom = "auto"
            }
        }
    })
    await page.screenshot({ path: join(outDir, `${name}.png`), fullPage: true })

    const overflow = await page.evaluate(() => {
        const limit = document.documentElement.clientWidth
        const scrolls = document.documentElement.scrollWidth > limit
        const offenders = [...document.querySelectorAll("body *")]
            .filter((el) => {
                const r = el.getBoundingClientRect()
                if (r.width === 0 || r.right <= limit + 1) {
                    return false
                }
                for (let p = el.parentElement; p; p = p.parentElement) {
                    const style = getComputedStyle(p)
                    if (style.overflowX !== "visible") {
                        return false
                    }
                }
                return true
            })
            .slice(0, 3)
            .map((el) => `${el.tagName.toLowerCase()}.${el.getAttribute("class") ?? ""}`)
        return scrolls ? offenders : []
    })

    await page.evaluate(axeSource)
    const axe = await page.evaluate(async () => {
        const result = await window.axe.run(document, {
            runOnly: ["wcag2a", "wcag2aa"],
            resultTypes: ["violations"],
        })
        return result.violations.map((v) => ({
            id: v.id,
            count: v.nodes.length,
            example: v.nodes[0].failureSummary?.split("\n").slice(1, 2).join(" ").trim(),
            target: v.nodes[0].target.join(" "),
        }))
    })

    const notes = []
    if (errors.length) {
        notes.push(`console: ${errors.slice(0, 2).join(" | ")}`)
    }
    if (overflow.length) {
        notes.push(`overflows page: ${overflow.join(", ")}`)
    }
    for (const v of axe) {
        notes.push(`axe ${v.id} x${v.count} at ${v.target}: ${v.example}`)
    }
    problems += notes.length
    console.log(`${notes.length ? "PROBLEM" : "ok     "} ${name}${notes.length ? `\n    ${notes.join("\n    ")}` : ""}`)
    await context.close()
}

await browser.close()
console.log(`\n${shots.length} screens, ${problems} problems. Screenshots in ${outDir}`)
