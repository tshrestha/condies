# Porting Strata Quiet into the app

The goal is to replace the Bootstrap UI with Strata Quiet everywhere, keeping today's data, routes, offline
support and behavior. `DESIGN.md` is the spec. This folder is the reference implementation: `npm run lab`,
choose a scenario or Live NWS. Delete this file when the port is done.

## Ground rules

- Work on `redesign/unified-design`, one phase per commit series, each ending with `npm test`,
  `npm run test:e2e`, `npm run lint`, `npm run build` green.
- Rewrite each end-to-end test against roles and visible text (`getByRole`, `getByText`) when its screen is
  ported, not against class names, so the tests stop depending on any particular styling.
- Keep the lab running until the last phase. It's the visual reference and holds the scenarios.

## Where things go (in place since phase 1)

- `src/design/`, shared by the lab and the app:
    - `tokens.css`: tokens, resets, surfaces, type, focus and gutters.
    - `components.css`: the top bar, icons, horizon, dock, alert notices, score, range bar and sheets.
    - `ramp.ts` and `words.ts`, with their tests.
    - `icons.tsx`, `ThemeToggle.tsx`, `nav.tsx` (`Masthead`, `Dock`) and `parts.tsx` (`Score`, `AlertRow`,
      `RangeBar`, `Sheet`).
    - These components take plain props (theme, links, callbacks), so the lab and the app can each wire their
      own navigation.
    - `DESIGN.md` moves here at the end.
- `src/lib/forecastView.ts`: `ForecastView`, `AlertView`, `SpotView`, `buildForecast`, `toAlertView` and
  `rankSpots`. Screens build the view from what `getForecastData` already returns.
- `src/lib/mountain.ts` (avalanche zones and snow depth) and `src/lib/sun.ts` (sun times, now with
  `sunriseHour` and `sunsetHour` for the Daylight bar). The current `MountainConditions.tsx` and `SunRiseSet.tsx`
  already use them through `query()`.
- Screen layouts (Now, next hours, week, snow, daylight, Day, Spots, loading, error) are still in
  `src/lab/quiet/quiet.css` and `index.tsx`. They move into the app with their screens in phases 3–5.

## Component map

| Today                                                              | Becomes                                                          |
| ------------------------------------------------------------------ | ---------------------------------------------------------------- |
| `App.tsx` (Bootstrap alerts, error)                                | Shell: `Masthead` (wide), `Dock` (phones), offline notice, error |
| `ThemeToggle.tsx`                                                  | Horizon `ThemeToggle`; `index.html` script sets `data-theme`     |
| `CurrentConditions.tsx`, `SpotStar.tsx`, `LastUpdated.tsx`         | `Now` swatch with the star icon (real `toggleSpot`) and refresh  |
| `Alerts.tsx` (Bootstrap Modal)                                     | `Alerts` + `AlertRow` + alert `Sheet`                            |
| `HourlyForecast.tsx`, `ForecastChart.tsx`, `Hourly*Chart.tsx` (d3) | Home: `NextHours`. Day screen: `Hourly` (CSS columns, no d3)     |
| `DailyForecast.tsx`                                                | `Best` + `Week` + `RangeBar`                                     |
| `MountainConditions.tsx`                                           | Avalanche row (raised to alerts at 3+) + `Snow` section          |
| `SunRiseSet.tsx`                                                   | `Daylight`                                                       |
| `ForecastDay.tsx`                                                  | `DayScreen`: pager, swatch, score, facts, snow line, chart, text |
| `Spots.tsx`                                                        | `SpotsScreen`: day filter, ranked rows with the score line       |
| `LocationSearchForm.tsx`                                           | Search `Sheet`, keeping geocoding, saved searches, keyboard nav  |
| `Map.tsx`                                                          | Restyled per DESIGN.md "Map"                                     |
| `HomeButton.tsx`, `Loading.tsx`, `*Placeholder.tsx`                | Dock's Now tab and Day pager; section placeholders; full loading |

The dock's current tab is painted with the temperature right now, so the shell needs that temperature: the
forecast screen publishes it through a small signal. Before any forecast has loaded, the tab is a plain ink
chip.

## Phases

1. **Foundation. Done.**
    - Shared design module and data layer in place.
    - Lab rewired to them.
    - Tokens and components load beside Bootstrap.
    - Verified:
        - the app's pixels are unchanged on five screens
        - the lab's 100 screenshots are byte-identical
        - all tests pass
2. **Shell and theme.**
    - App shell, dock, masthead, horizon toggle, offline notice and error state.
    - The pre-paint theme script.
    - `theme-color` and manifest colors.
3. **Home.**
    - Now, alerts, next 12 hours, best day, week, snow, daylight.
    - Section placeholders.
    - Numeral fitting against the dock.
    - Review point: the owner looks at Home on real data before going further.
4. **Day screen.**
5. **My Spots.**
6. **Search** with real geocoding.
7. **Map.** Review point: the map was never prototyped, so it gets its own look before moving on.
8. **Removal.**
    - Bootstrap, Bootstrap Icons, `@types/bootstrap`, d3 and `@types/d3`, the Meteocons assets.
    - `wicons.ts`, `sky.ts` and `tempColors.ts` and their tests, and `scoreColor` in `score.ts`.
    - The old components.
    - The lab, `lab.html`, the `lab` script and `axe-core` if nothing else uses them.
    - Move `DESIGN.md` to `src/design/`.
9. **Verification.**
    - End-to-end suite on the new screens.
    - An axe check on Home, Day, Spots and the sheets.
    - A screenshot pass of the real app over the test fixtures, compared with the lab's.
    - Live NWS for a few places.
    - Bundle size before and after.
    - Safari on an iPhone, installed as an app.

## End-to-end tests to rewrite

Every spec uses Bootstrap or old class names today:

- `app-shell`: `.alert-warning`, `.current-conditions h1.display-6`, `.daily-row`, the theme radios
  (`#condies-theme-dark`, `label[for=condies-theme-light]`).
- `daily`:
    - day rows: `.daily-row`, `.daily-chip`, `.daily-day .fw-medium`, `.daily-high`, `.daily-low`, `.daily-meta`
    - Day screen: `.day-hero`, `.day-hero-high`, `.day-hero-low`, `a.day-nav-link`, `.bi-arrow-left`
    - other: `.list-group-item`, `.time-label`, `.alert-secondary`
- `forecast`:
    - alerts and their modal: `.alert-danger`, `.alert-info`, `.alert-warning`, `.modal.show …`, `.modal-backdrop`
    - charts: `.chart-title`, `.forecast-chart svg`, `label[for=…]`
    - search: `#geocodingSearch`, `a.search-result`, `a.search-result.active`
    - other: `h1.display-5`
- `hero`: `.forecast-chart svg`, `.chart-title`, `.chart-legend`, `.chart-overlay`, `.night-bands rect`,
  `.sky-snowfall`, the chart tab labels `label[for=forecast-*]`.
- `map`: `.spot-pin`. MapLibre's own `.maplibregl-*` and `#map` selectors can stay.
- `mountain`: `.mountain-conditions`, `.snow-depth`, `.daily-outlook`, `a.daily-outlook`, `.sky-facts`,
  `.daily-row`, `.forecast-chart svg`.
- `reliability`: `.alert-danger`, `.alert-warning`, `.last-updated`, `.current-conditions h1.display-6`,
  `.daily-row`.
- `snow`: `.daily-chip`, `.daily-score`, `.daily-meta`, `.day-insight`, `.day-score-ring`, `.spot-row`,
  `.spot-score`, `.spots-filter .btn`, `.spots-filter .btn-primary`.
- `spots`: `.spot-row`, `.spot-pin`, `#geocodingSearch`, `.search-result`, `.alert-secondary`.

`tests/fixtures.ts` can stay as it is, since it mocks the APIs and not the UI.

Expected behavior changes that tests must follow:

- PRIMO markers now come only from a perfect score.
- Gusts and sun times are on the Day screen rather than Home.
- Condition icons are gone.
- Alerts open a `<dialog>`.

## Risks

- Numeral fitting runs after fonts load and on resize. Mobile browser toolbars change the viewport height, so
  check it on a real phone.
- `backdrop-filter` on low-end Android can be slow. The solid fallback is one media query away.
- Solid 2 is still a release candidate, so APIs used in the lab may shift. The app already pins its versions.
- The end-to-end rewrite is the largest single piece of work: 95 tests across 9 specs.
