# Strata Quiet

Status: final, chosen by the owner on 2026-11-10. This is the spec for porting the design into the app; see
`PLAN.md` beside it. The reference implementation is this folder, viewable with `npm run lab`.

Every 5°F has its own color, used like a paint chip: a flat swatch with dark ink, laid on a plain ground. The
current temperature is one swatch; the week is a range bar per day built from the same chips. Everything else
is plain type on the ground, and every number is printed. Not a broadcast panel: no full-bleed color bars, no
white type on saturated blue, no banners, no condensed numerals.

## Principles

1. **Color means temperature, and only where it's the point.** Home has the Now swatch and the week's range
   bars. The Day screen has its swatch and its temperature chart. Nothing else is colored.
2. **Chips, not backgrounds.** Color sits inside the margins as a swatch with dark ink, never edge to edge.
3. **Sentences sit on the ground.** A caption says what is happening; the numbers follow it.
4. **One block, one job, three lines.** A fourth line means the detail belongs on the Day screen or in a sheet.
5. **The first screen answers six questions**: temperature now, what's happening, rain or snow in the next 12
   hours, best day, any warning, tomorrow's high.
6. **No ornament.** No texture, gradient, shadow, card or legend. Weather is always told in words.
7. **Printed things are square; things you touch float and are round.** The swatch, notices and bars are square.
   Only the dock is round, with continuous (squircle) corners where the browser supports `corner-shape`, a
   plain capsule elsewhere, and a disc for the theme switch. Inner corners are concentric with the bar's.
8. **Icons are for controls only.** Search, star, map, the horizon theme switch and the cat for Now. One style:
   24px, 2px strokes, round joins, in the ink of what they sit on. Filled means on (a saved star, the current tab).

## Controls

- Phones (under 768px): the dock, fixed at the bottom within thumb reach, replaces the top bar. It's clear
  frosted glass, white at 74% by day and graphite at 74% by night, blurred and saturated so the page's own
  colors glow through, with a hairline edge and a soft shadow. Labels pass AA even over the worst content
  showing through (about 10:1 by day, 6:1 by night). With `prefers-reduced-transparency`, or without backdrop
  blur, it's solid. Tabs: Now (the cat), Search, Spots (the star), Map. The current tab is a chip in the color
  of the temperature right now, bold, with its icon filled: the dock's one painted thing. The theme switch is a
  separate 58px glass disc beside it.
- Wide screens: the top bar keeps words (Search, Spots, Map) and the same theme switch.
- The theme switch is a horizon: the sun up in light mode; switching sets the sun and raises a crescent moon
  as two stars come out. It shows the current theme and is a toggle button ("Dark mode", pressed or not).
- Save is a star icon in the Now swatch: outline when not saved, filled when saved.
- Home's numeral fitting measures to the top of the dock, so tomorrow's high still shows above it.

## Color (`ramp.ts`)

- Ground `#fff` with ink `#111`; dark theme ground `#0d0d0d` with ink `#f0f0f0`. Tracks are `--sq-track`.
- `paintTemp(t, theme)`: 28 steps, hard edges every 5°F, never interpolated. Designed in OKLCH as paint-chip
  tints: violet and periwinkle below 10°F, ice and glacier blues to 35°F, teal and sage to 50°F, then green,
  citron, apricot, coral and rose. Neighbors alternate lighter and darker so each 5° stays distinct. The cold
  end avoids saturated broadcast blue.
- `inkOn(bg)`: dark ink `#111` wherever it passes 4.5:1, which is every step from −10°F to 105°F in both
  themes. The dark column keeps each hue at lower lightness, still with dark ink.
- `rampSteps(low, high)` returns the 5° segments between two temperatures, for range bars.
- `avalancheScale`: the North American standard, exactly. Never retune it. Shown as a chip inside its alert.

## Type

Chivo for everything, tabular figures, two weights (400, 700). No condensed face, no tracked caps, no italics.

| Token     | Size   | Use                                                                         |
| --------- | ------ | --------------------------------------------------------------------------- |
| `--sq-s`  | 14px   | hour labels, severity words, "Low"/"High" heads, score label, small print   |
| `--sq-m`  | 18px   | body, captions, day names (bold), condition words, the score's value        |
| `--sq-l`  | 32px   | key numbers, highs, the condition now, Extreme alert titles                 |
| numeral   | fitted | Home's current temperature: Chivo 400, tracked −0.04em, sized to the swatch |
| `--sq-xl` | 88px   | the Day screen's high                                                       |

`numeralFit(text)` uses Chivo's measured figure widths (and `TRACKING`) so CSS sizes the numeral with
`100cqi / var(--em)`, capped at 26svh. On a busy phone screen `HomeScreen` shrinks it so tomorrow's high still
makes the first screen. A regular-width numeral read as a printed number in testing; League Gothic read as a
scoreboard.

## Alerts (`Alerts`, `AlertRow`)

Printed notices inside the margins, strongest first, directly under the masthead. Each is a button that opens
its sheet and prints its severity in words.

- Extreme: 5px ink frame, title at 32px. Severe: 2px ink frame, 18px bold.
- Avalanche danger 3 or higher: 2px frame with the standard color as a chip, "High avalanche danger · 4 of 5".
  Lower ratings sit below the week in the same form.
- Moderate and Minor: plain rows, regular weight, with an arrow.
  The sheet header keeps the notice's frame.

## The week (`Week`, `DayRow`, `RangeBar`)

On the ground. A head row reads "This week · Low · High" once. Each row: day name (bold), low (regular), range
bar, high (32px bold), and under them one condition word or a marker, and the snow amount if any. Markers
(`highlightWord`): POW DAY when the day is a pow day, otherwise PRIMO only when the day's score is a perfect 100. The old sunny-and-mild rule (`isPrimo`) no longer shows a marker, so a day never says PRIMO beside a
lesser grade. All
rows share one scale for the week, so warm days sit right and cold days left. The bar is the ramp's own 5°
steps as hard segments from low to high, on a thin track. A day missing its low shows a short tick at its high,
and its low column stays empty. Columns align through CSS subgrid.

## The Condies score (`Score`)

One treatment everywhere (Best day, the Day screen, My Spots), on one line:
"Condies score", an ink meter (a 0–100 track with an ink fill, never a temperature color), then
"84/100 Great". Grades from `grade()`: 100 PRIMO, 90+ Epic, 75+ Great, 60+ Good, 40+ Fair, below Poor. It is a button;
tapping it shows `scoreHelp`, one sentence on what the score measures. Never near a degree sign, never in the
temperatures' size. No score, no line.

## Other blocks

- Next 12 hours: a caption ("Snow until 1 AM, 17.5″") and three 4-hour blocks from the same hours, so the
  numbers agree. A storm that runs past them gets its own line with its own span.
- Best day: "Best day Saturday 1 PM–5 PM", then the score line.
- Snow (`Snow`): a bold heading like "This week", then up to three facts on the next-12-hours columns, in time
  order: "Last 24 hours", "On the ground", "Next 7 days". One small line names the measuring station. Numbers
  share a baseline even when a label wraps. No snow data, no section.
- Daylight (`Daylight`): a bold heading, then a row shaped like a week row: sunrise time on the left, sunset on
  the right, and today's light as a bar on a 24-hour track between them. The part already gone is dim, the
  part left is ink. Under it: "Sunrise", how much light is left ("3 hr 12 min left"), "Sunset".
- Day screen: a pager of neighboring days ("← Now" before the first), then the swatch with "High 26°" and
  "Low 10°" in words, best window and score, facts, the snow line, the hourly chart (temperature columns in
  ramp colors, other views in ink), the forecast text on the ground. The place name in the swatch links back to
  that place's Now from any day.
- My Spots: rows on the ground ranked by score: name, day and window, snow, then the score line.

## Map (designed here, not yet in the lab)

- Full screen. A quiet base map so the only color is data: OpenFreeMap's Positron style by day and its dark
  style at night (confirm the dark style's name when porting). NOAA radar on by default, as today.
- Radar switch: a glass chip at the top right, round because it's a control, "Radar" with a pressed state.
- Saved spots: square paint chips (printed, so square) in the color of the spot's high today, printing that
  high in its ink ("26°"). Tapping one opens a popup on the ground with the name, best day and window, and the
  score line, linking to the forecast. Place names from search or reverse geocoding are plain text, never HTML.
- Phones: the dock floats over the map. Map controls (zoom, compass, locate) sit on the right edge above the
  dock; attribution stays compact at the top left. Wide screens: the top bar.

## Loading in sections

The app fetches the forecast, sun times, avalanche danger and snow depth separately, so each section can be
waiting on its own. A waiting section shows its shape on the ground in `--sq-track`: the swatch as a plain
block of the same size, rows as bars at their text's height. No shimmer and no spinner. The full-screen state
(a swatch stepping through the ramp, "Getting the forecast.") is only for a first load with nothing saved.
Optional extras that fail (sun, avalanche, snow depth) leave their section off, as today.

## Theme and app colors

- `data-theme="light|dark"` on `<html>`, set before first paint by the inline script in `index.html`, stored
  under the existing `condiesTheme` key, following the system setting until the owner picks one.
- `theme-color` metas and the manifest: `#ffffff` light, `#0d0d0d` dark (the grounds).

## Chart grammar (`Hourly`)

One series at a time, one column per hour on a baseline, direct labels at the ends and extremes only. A
sentence above states the reading and is the chart's text alternative. No legends, no gridlines.

## Layout

Gutter `--sq-gut`: 20px, 32px from 600px, 40px from 1024px. From 1024px the masthead and alerts run full
width; below them the swatch holds still on the left and the list scrolls on the right.

## Motion

Nothing slides or fades in. A swatch's color shifts over 0.4s when data or theme changes; chart columns grow
from the baseline. Loading steps a swatch through the ramp in hard cuts. `prefers-reduced-motion` turns it off.

## Voice

Plain sentences. Mountain-town words live only in "Right meow", POW DAY, PRIMO and the score's grades. Warning
and avalanche text is the agency's own, with no jokes near it. Separators before a number are commas, never
" · ", which reads as a decimal point ("Snow until 1 AM, 17.5″").

## Known limits

- With the offline notice and three warnings on a 390×844 phone, tomorrow's row can't clear the dock even at
  the numeral's minimum size. Everything else answers the six questions on the first screen.
- `corner-shape: squircle` is Chromium-only so far; other browsers get a capsule. Tested only in Chromium:
  check Safari on iOS for backdrop blur, safe areas and the dock in standalone (installed) mode.

## Extending

- New datum: give it color only if its temperature is the point of that screen. Otherwise it's type.
- New color: don't. If something needs a key, redesign it.
- Prefix classes with `sq-`. Resets live in `:where(.sq-root)` so they never outrank swatch colors.
