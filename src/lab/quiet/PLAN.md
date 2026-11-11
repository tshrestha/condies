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
- `src/home/` (since phase 3), shared by the lab and the app:
    - `sections.tsx`: Home's sections and `HomeScreen`, driven by a `HomeCtx` of the forecast, the theme, a day
      link and two callbacks for opening sheets.
    - `sheets.tsx` (alert and avalanche sheets), `Placeholder.tsx` (waiting shapes) and `home.css`.
- `src/day/` (since phase 4), shared the same way: `sections.tsx` (`DayView` and its pager, driven by a `DayCtx`),
  `chart.tsx` (`Hourly`), `Placeholder.tsx` and `day.css`.
- `src/forecastData.ts`: `getForecastData` and `createForecastView`, which Home and the Day screen both build
  their view with, extras included.
- `src/spots/` (since phase 5): `sections.tsx` (`SpotsView`, driven by a `SpotsCtx` of the spots and a link for
  each), `Placeholder.tsx` and `spots.css`.
- The wide two-column split that Home, the Day screen and My Spots share is in `components.css`.
- What's left in `src/lab/quiet/` is the lab's own wiring, its search sample and the page background.

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
2. **Shell and theme. Done.**
    - What's in place:
        - `Shell.tsx`: the top bar on wide screens and the dock on phones, both wired to the router.
        - `theme.ts`: the theme controller and the pre-paint script, setting `data-theme` on `<html>`.
        - `present.ts`: the current temperature that the dock's current tab is painted with.
        - The offline notice and the full-screen loading and error states.
    - Search moved here from phase 6. The dock replaced the floating search bar, so it couldn't wait. It's
      `SearchSheet.tsx`: geocoding, recent places, arrow keys and Enter.
    - Bootstrap screens still sit outside `.sq-root`, between the shell's pieces, so Quiet's resets can't reach
      them. `src/transition.css` holds the temporary rules for that:
        - the shell's transparent pieces
        - lifting the Day screen's back button and the map controls above the dock
    - The old `ThemeToggle`, `LocationSearchForm`, `Loading`, and the Home screen's "My Spots" button are gone.
    - Behavior changes:
        - Tab no longer cycles search results.
        - Recent places list newest first.
        - The theme is one toggle.
    - Verified:
        - all tests pass, with the shell's end-to-end tests rewritten to roles and text
        - an axe check of the shell on phone and desktop, light and dark, with search open
        - the lab's 100 screenshots still byte-identical
    - `theme-color` and manifest colors move to phase 3, so they change with Home's background.
3. **Home. Done, waiting for review.**
    - What's in place:
        - `Forecast.tsx` builds a `ForecastView` from what `getForecastData` returns and renders `HomeScreen`
          in its own `.sq-root`. The lab renders the same `HomeScreen`.
        - Avalanche danger, snow depth and sun times are lazy fields of that view. Each section that reads one
          waits behind its own `Loading`, so nothing else waits for them. A failure leaves the section off.
        - Placeholders: the whole Home while the forecast loads, and Snow and Daylight while theirs do.
        - The numeral fits again when the alerts change size (avalanche danger arriving late) and when the
          connection drops or returns, as well as on resize.
        - The star saves to My Spots for real, and "Updated" reloads with an age that ticks every minute.
        - One `theme-color` meta that follows the chosen theme, set by the `index.html` script and
          `theme.ts`. The manifest uses the light ground.
    - The `.container` column moved out of `Shell.tsx` into the screens still on Bootstrap (Day, My Spots,
      Map). `transition.css` paints the page ground behind Home.
    - Bootstrap's stylesheet loads after the app's in production builds (it's in its own vendor chunk), so its
      bare element rules were beating Quiet's zero-specificity resets: blue underlined links (the dock's,
      since phase 2), list indents and paragraph margins. The resets in `tokens.css` now sit one element
      above (`html :where(.sq-root) p`), still below every class.
    - Removed: `CurrentConditions`, its placeholder, `LastUpdated`, `Alerts`, `SunRiseSet` and its
      placeholder, `MountainConditions`, `SpotStar` and `DailyForecast`. The Day screen keeps its two icon
      helpers locally until phase 4.
    - Fixed along the way:
        - The save star couldn't be tapped on phones: the numeral's glyphs overflow its trimmed box upward and
          took the taps. The star now sits above them.
        - On phones the Day screen's Back button and the map's Radar button were under the dock in production,
          since Bootstrap's `.bottom-0` loads later. The lift now out-ranks it, and the Bootstrap screens leave
          room at the end of the page for the dock and the button above it.
        - "No current avalanche rating" was indented twice. It no longer sits inside the notice frame's padding.
        - The storm sentence says "Snow from Thu night to Fri morning, 6.0″": a dot before an amount reads as a
          decimal point.
    - Behavior changes:
        - The location fallback is a plain notice above the alerts, in Quiet's wording.
        - With no hourly forecast, Now and the next 12 hours are left off; with no daily forecast, the week is.
        - "Updated" is left off when NWS doesn't say when it made the forecast, as before.
    - Verified:
        - the lab's 100 screenshots byte-identical after the move
        - an axe check of Home and the alert sheets on phone and desktop, light and dark
        - placeholders in both themes, and the numeral refitting when a level 4 avalanche rating arrives late
        - live NWS for Alta and Telluride, with no page errors
        - all tests pass: 93 end-to-end tests on three runs in a row, Home's rewritten to roles and text. The four
          sky tests went with the sky; tests for Now's facts and for a low avalanche rating were added.
    - Review point: the owner looks at Home on real data before going further.
4. **Day screen. Done.**
    - What's in place:
        - `ForecastDay.tsx` renders `DayView` on the same forecast view as Home. Sun times wait on their own.
        - The pager is the way between days, with "← Now" on the first. The floating back button is gone.
        - A placeholder while the forecast loads, and "There’s no forecast for this day." for old links.
        - The tab style moved to `components.css`, since My Spots' day filter uses it too.
    - One change to the reviewed design: the place name in the day's swatch is a link to that place's Now. The
      pager only reaches Now from the first day, and an installed app has no back button, so without it day 5
      of a searched place was five taps from its forecast. In the lab only that underline changed, on the 24 Day
      screenshots; the other 76 stayed byte-identical. Later checks compare against the screenshots taken with it.
    - Removed: `HourlyForecast`, `ForecastChart` and the four d3 chart components, and `HomeButton`. Only
      `tempColors.ts`, which nothing imports now, still uses d3; both go in phase 8 with the rest.
    - Fixed along the way:
        - The chart's last hour label could run past its right edge, and at 5 AM make the page scroll sideways.
          No hour label starts within two columns of the end now.
        - The no-forecast page and the app's error page say their message as a heading, so the page has one.
    - Verified:
        - the lab's screenshots as above, before and after the place link
        - all tests pass: 92 end-to-end tests on two runs in a row, the Day screen's rewritten to roles and text.
          Night shading went with the old chart; a few chart checks measure columns, gust marks and labels.
        - an axe check of the Day screen on phone and desktop, light and dark, with chart views and the score
          explanation open
        - live NWS for Alta, with no page errors
5. **My Spots. Done.**
    - What's in place:
        - `Spots.tsx` renders `SpotsView` on the saved spots, with one placeholder row per spot while they load.
        - Each row links to the spot's forecast, as before.
        - `loadSpot` stays in `Spots.tsx` for the map.
    - My Spots' head no longer depends on stylesheet order for its wide padding: it says so itself. That let the
      split move to `components.css`.
    - Behavior change: a spot whose forecast fails keeps its row, which says "Couldn’t load its forecast",
      instead of vanishing from the list.
    - Removed: the Bootstrap My Spots markup and `ForecastPlaceholder`. `scoreColor` stays for the map's pins
      until phase 7.
    - Verified:
        - the lab's 100 screenshots byte-identical
        - an axe check of My Spots on phone and desktop, light and dark, empty and with a failed spot
        - all tests pass: 93 end-to-end tests on two runs in a row, My Spots' rewritten to roles and text, plus
          a new one for a failed spot
6. **Search: done in phase 2.**
7. **Map. Done, waiting for review.**
    - What's in place, following DESIGN.md "Map":
        - `Map.tsx` in its own `.sq-root`, with `src/map/map.css`. The page is a flex column, so the map takes the
          height the top bar leaves and the dock floats over it.
        - Base map and radar follow the theme. The radar switch, the glass controls and the collapsed attribution.
        - Pins as temperature chips, opening the spot's row (`SpotRow`, now exported from `spots/sections.tsx`).
        - A tap elsewhere names the town and state.
    - Behavior changes:
        - Pins show the temperature rather than the score, and open a popup instead of going straight to the
          forecast.
        - A spot with no scored day (no forecast grid) shows its first day, in My Spots and on the map, rather
          than "No forecast for this day".
    - Removed: the map's rules in `app.css` (`#map`, `.spot-pin`) and the floating-button lifts in
      `transition.css`, since no Bootstrap screen is left. `scoreColor` is no longer used.
    - Verified:
        - live tiles and data on phone and desktop, light and dark, with every popup kept on screen, pins near
          both edges included
        - an axe check of the map on phone and desktop, light and dark, with a pin's popup open
        - the lab's 100 screenshots byte-identical
        - all tests pass: 94 end-to-end tests on two runs in a row. The pin test is rewritten to roles, and a new
          one checks the base map follows the theme with radar back on after it changes.
    - Review point: the map was never prototyped, so the owner looks at it before phase 8.
8. **Removal.**
    - Bootstrap provides two global rules Strata Quiet relies on: `box-sizing: border-box` on everything and
      `margin: 0` on the body. `tokens.css` must take them over before Bootstrap goes, or every padded control
      grows.
    - `src/transition.css`, the `.container` wrappers in the Bootstrap screens, and the Bootstrap attributes that
      `theme.ts` and `index.html` still set.
    - Bootstrap, Bootstrap Icons, `@types/bootstrap`, d3 and `@types/d3`, the Meteocons assets.
    - `wicons.ts`, `sky.ts` and `tempColors.ts` and their tests, and `scoreColor` in `score.ts`.
    - The old components, and the `html` prefix on the resets in `tokens.css` once nothing else styles bare
      elements.
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

Home's specs were rewritten in phase 3 and the Day screen's in phase 4. `snow` and
`spots` still use My Spots' old selectors until phase 5, and `map` until phase 7.

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
