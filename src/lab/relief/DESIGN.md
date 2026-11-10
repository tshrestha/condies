# Relief: the Condies design standard

Your week, surveyed. The whole app is one printed map sheet, and the week is its terrain: hour of day
across, days down, temperature as elevation. It is a Hovmöller diagram (1949) drawn as a Swiss topographic
sheet with Tanaka illumination (1950). Cartographic convention is the design standard: if a real map has
a way of showing something, use that way.

## Principles

1. The map does the work. The terrain replaces the 7-day list as the primary reading of the week, and
   every number on it is real and legible at arm's length.
2. Now first. The current reading stays plain and huge: flush-left, heavy, never thin or centered.
   Avalanche danger of 3 or more rises above the week, directly after alerts. It's a go/no-go fact.
3. One sheet. One neatline, one ink set, one way of drawing each datum everywhere. No cards, no radius, no shadows
   on interface elements. Structure comes from rules and collars, as on a printed quad.
4. Honest ground. Hours with no data are hatched "unsurveyed", never guessed at in view.
5. Plain near hazards. Alerts and avalanche text carry no jokes. The cat stays with "Right meow".

## Tokens (`relief.css`, set on `html[data-design="relief"]`, swapped by `data-theme`)

| token                     | light                 | dark                   | use                                 |
| ------------------------- | --------------------- | ---------------------- | ----------------------------------- |
| `--rl-ground`             | `#e8f2f0` glacial     | `#081312` spruce-black | the sheet                           |
| `--rl-ink` / `--rl-ink-2` | `#0e2a2e` / `#3a5556` | `#dceee8` / `#9db8b1`  | linework, type                      |
| `--rl-hair`               | `#a9c0bc`             | `#2f4a46`              | hairlines, hatch                    |
| `--rl-water`              | `#124374`             | `#a9dcff`              | anything that falls from the sky    |
| `--rl-accent`             | `#ff4f00`             | `#ff6a24`              | survey orange: now and actions only |
| `--rl-accent-text`        | `#bb3500`             | `#ff8a52`              | accent as text, AA on ground        |
| `--rl-hazard`             | `#b1005a`             | `#ff4fa3`              | aeronautical magenta: alerts only   |
| `--rl-hazard-x` / `-s`    | `#6b0037` / `#b1005a` | `#ff4fa3` / `#a81c64`  | Extreme and Severe overprint fills  |
| `--rl-halo`               | pale ground           | dark ground            | map label halos                     |

The hypsometric tint ramp lives in `terrain.ts` (`tint(value, theme)`), keyed in °F so a temperature is
the same color on every sheet: glacial blues, ice at 32°F, sea green, spruce, moss, lichen, straw, ochre, ember.
Every chart reads from it. Precip uses the cold limb (`32 - pct/2`), wind the warm limb (`46 + mph*1.25`).
Dark mode is a separate deep ramp with luminous lines (`inks.dark`), not an inversion.
Avalanche plates use the North American scale exactly: `#50b848`, `#fff200`, `#f7941e`, `#ed1c24` with
black text, `#231f20` with white.

## Type

Overpass (Highway Gothic's descendant) for words; B612 Mono (the Airbus cockpit face) for measured values.

| role                          | setting                                                            |
| ----------------------------- | ------------------------------------------------------------------ |
| Current temperature, High/Low | Overpass 800, `clamp(82px, 27vw, 118px)`, -0.05em                  |
| Day name, My Spots            | Overpass 800, `clamp(44px, 14vw, 72px)`                            |
| Section title                 | Overpass 800, 21px                                                 |
| Conditions                    | Overpass 600 italic, 21–23px                                       |
| Body                          | Overpass 15–16px                                                   |
| Data                          | B612 Mono 11.5–16px, 700 for values                                |
| Place headline                | Overpass 800, `clamp(36px, 11.5vw, 48px)`, -0.025em, sentence case |
| Labels on the map             | Overpass 700, caps, `0.22em` tracking                              |

The cartographer's rules, applied everywhere:

- Italic in `--rl-water` for anything water: rain, snow, fog, "on the ground" (`isWater`, `.rl-water`).
- Widely spaced caps only for labels printed on the map itself. Place names in the interface are plain Overpass headlines, and coordinates live in the foot of the sheet.
- Upright numerals for measured values, even inside italic water phrases. Always go through `<Num>` (or `<TightSvg>`):
  B612 gives punctuation a full cell, and "6.4" falls apart without the pinch.

## Icons (`glyphs.tsx`, `wx.ts`)

One monoline set, 24px grid, 1.7 stroke, round joins, drawn from WMO synoptic figures and survey marks.
Dots rain, asterisks snow, bars fog, the bracket and bolt thunder, triangle and dot showers. Sky cover is
the station-model circle filled by oktas (`SkyCircle`). Wind is a real barb (`barbPath`): staff points into
the wind, half feather 5 kt, full 10, pennant 50. `StationPlot` composes these for the current observation.
High is a filled summit triangle, low an open inverted one. The cat is a point symbol with summits for ears.
Never use another icon family or emoji.

## The Condies score: one treatment

`<Benchmark score size />`, a surveyor's benchmark disc with a triangle mark at its top. Inked solid at
60 and above (worth going), hollow below. Same construction at every size, no other rendering anywhere.

## The sheet map (`TerrainMap.tsx`, `terrain.ts`)

- `forecast.hours` onto a days × 24 matrix from the `startTime` string. Gaps borrow the nearest row's shape, level with their row, and are hatched over.
- Bicubic upsample, then d3 `contours()`. Interval: 5°F when the week spans 38° or more, 2°F from 18°, 1°F below, so a dull week still has terrain. 32°F is always added.
- Painter's order, lowest band first. Each ring is cut into segments, shaded by how squarely the slope faces the northwest light, and merged into 11 stroke buckets per band. Fills cast a small drop shadow, so bands read as cut paper.
- 32°F is the index contour: heaviest line, labeled in the line.
- Each row is ruled off, with its caption strip on top, on the same line as the day name, so a caption can only belong to its own day.
- The now crosshair stops at its marker: a leader from the axis, broken across the caption, and short arms. It sits above the spot-height line, so no reading is mistaken for now. Axis labels give way to the leader.
- Spot heights mark the hottest and coldest hour of each calendar row at their true position. Weather glyphs and barbs sit at their true hour, one to four by intensity. Glyphs step around labels.
- Rows are real links over the terrain with a full spoken summary. Captions are halo-printed on the terrain.

## Hazards

Alerts are restricted-area overprints, and severity steps in form as well as color. Extreme: deepest fill, comb on both sides, offset outer line, largest type. Severe: solid fill, comb on one side. Moderate: tinted fill, thin comb. Minor: outline only, dotted tier plate. Never put a `·` before a number anywhere: on this sheet it reads as a decimal point.

## Chart grammar (`Profile.tsx`)

Hours are always a terrain profile: a filled ridge in the tint ramp, hard band steps, a heavy ridge line, values printed above it, precipitation symbols falling onto it, the orange crosshair at now. Temperature, Precip, Wind and Snow only change what's plotted. Gusts are a dashed second ridge. Do not add bar charts or line charts.

## Motion

One move. On first load the bands rise lowest to highest over 1.2s, like water filling a valley in reverse,
then labels fade in and the crosshair draws. It runs once per session and again only on "Surveyed".
`prefers-reduced-motion` paints the finished sheet at once. Nothing else animates.

## Layout

Phone-first single column inside the neatline. On a phone the key collapses to the tint ramp with the freezing line and a Key control. From 980px the map takes the plate and the marginalia
(title block, alerts, now, notes, mountain) run down the right side, as on a real sheet, with the hourly
profile across the foot at 24 hours.

## Voice

Dry surveyor. "The week, surveyed", "Surveyed 22 min ago", "Key to the sheet", "Survey notes", "Unsurveyed".
"Right meow" and POW DAY keep the mountain-town grin. Hazards and avalanche text stay literal.
