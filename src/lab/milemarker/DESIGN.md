# Mile Marker

The forecast, signed like a highway. Every block is a flat sign panel that follows US highway signing (the MUTCD):
a fixed color meaning, an inset border line, short legends, and Overpass, the open version of the Highway Gothic
alphabet. Signs stand alone on plain ground. Nothing is literal: no posts, bolts, reflective textures or photos.

## Principles

1. **Color is a meaning, never a decoration.** If a color can't be named from the table below, it doesn't ship.
2. **Seriousness looks serious.** Alert color follows NWS severity, never the product type, so a more severe
   alert always reads as stronger.
3. **Few frames.** One sign per idea: the whole week is one sign, a day's facts are one sign. Arrows appear only
   on alerts, where "this opens" matters most.
4. **Overview first.** Home answers now, warnings, the next 12 hours, the best day and the week. Everything else is
   on the Day screen or in a sheet.
5. **Solid ground behind every word, and every mark is data or a control.**

## Color tokens (`milemarker.css`, `.mm-root`)

| Sign       | Token      | Light     | Dark      | Legend | Used for                                                                 |
| ---------- | ---------- | --------- | --------- | ------ | ------------------------------------------------------------------------ |
| Guide      | `--green`  | `#006a4e` | `#00452f` | white  | Now, next 12 hours, best day, week, day facts, charts, search results    |
| Warning    | `--yellow` | `#ffcd00` | `#f2c400` | black  | Extreme and Severe alerts; avalanche danger 3 and up                     |
| Moderate   | `--orange` | `#ea7a1f` | `#e0701a` | black  | Moderate alerts; the error page                                          |
| Regulatory | `--white`  | `#ffffff` | `#e6e6e6` | black  | Minor alerts, avalanche danger 1–2, snow depth, offline, the score plate |
| Recreation | `--brown`  | `#683c1e` | `#55301a` | white  | My Spots: the nav sign and every ranked spot                             |

Ground is `#fff` (daylight) or `#000` (a black road at night, where panels deepen and legends glow). Ink is `--ink`,
secondary text `--ink-2`, focus rings `--focus`. Red is not used. The avalanche chip keeps the North American scale
exactly: 1 `#50b848`, 2 `#fff200`, 3 `#f7941e`, 4 `#ed1c24` (black text), 5 `#231f20` (white text).

## Sign anatomy

- `.mm-sign[data-tone]` is the only surface. Radius 12px (10px for one-line signs, 8px for plates). The border is
  two inset box-shadows: 4px of panel, then a 2px line in the legend color. White panels on daylight ground add a
  1px outer edge (`--edge`).
- **Tab** (`.mm-tab`): a small panel flush on a sign's top-left, as an exit number sits on a guide sign. Tabs carry
  the app's voice and nothing else: Right meow, POW DAY, PRIMO.
- **Arrow** (`Arrow`): the standard guide arrow, pointing right, at the end of alert lines only.
- **Diamond** (`Diamond`): a warning sign in miniature, on Extreme and Severe alerts only.

## Alerts

One line each, in this order: Extreme, Severe, avalanche danger 3+, Moderate, Minor.

| Severity       | Sign         | Marks                     |
| -------------- | ------------ | ------------------------- |
| Extreme        | yellow, 60px | 40px diamond, 24px legend |
| Severe         | yellow, 52px | 32px diamond, 16px legend |
| Moderate       | orange       | 16px legend               |
| Minor, Unknown | white        | 16px legend               |

Every line ends with its severity in words, so severity never rests on color. Avalanche danger reads
"Avalanche danger · High, 4 of 5" with the scale chip; 3 and up is yellow and joins the alerts, 1–2 is white under
On the mountain. Every line opens a sheet whose sign matches the line. No wit anywhere near alerts.

## Type

- One family: Overpass Variable, normal width, `tnum` everywhere.
- Four sizes: 16 (body, labels, ticks), 24 (legends, rows, headlines), 36 (plate numbers, lows), 88 (the reading
  now, a day's high). Two weights: 400 and 700.
- Mixed case for everything read as words. Capitals only for SNOW DEPTH, set the way SPEED LIMIT is.
- Times never break from AM/PM (`clock()`); windows read as spoken, "1–5 PM" (`span()`), except from midnight.
- A missing high or low is blank, never a dash, because a dash beside a number reads as a minus.

## The score: one plate

`Plate` is the only form of the Condies score: a white plate reading "Condies" over "84 of 100", so the scale is
always printed. It appears on the best-day sign, the Day screen's best window and every spot, never colored by value.

## Chart grammar (`Chart.tsx`)

One component, `HourChart`, everywhere. It always has the same title for a view: Temperature, Precip chance, Wind
and gusts, Snow each hour. One series, white on green, a 2px baseline, direct labels, no legend or grid.
Temperature is a 3px line labelled at start, high, low and end, each label on the side the line doesn't pass. Bars
label their peak; snow is a rate, so its label says "1.8″ an hour". Wind gusts are the outlined extension of each bar.
On Home the chart is `narrow` (beside the 12-hour headline, end ticks only); otherwise identical. Every chart has an
`aria-label` summary.

## Icon language (`Sym`)

Solid, heavy sign symbols on a 24px grid in the legend color: sun, moon, partly, cloud, rain, snow, storm, fog
(cloud over wavy lines), haze (half sun over wavy lines). Straight parallel bars are never used, since they read as
a menu. Knockouts are strokes of `--mm-panel`. The cat is a solid sitting silhouette, like animals on crossing signs.

## Screens

- **Home:** Now (tab, place, star), alerts, next 12 hours, best day, the week as one distance sign (day, symbol,
  snow, high, low), then On the mountain. Phone: one column, 16px apart. 960px: two columns. 1180px: three gantries.
- **Day:** text links for previous, home and next; the day sign; the best window with its plate; one facts sign
  (chance, total, wind, gusts, snow level with its rain/snow note, and sunrise and sunset on Today); the chart and
  its view buttons; the forecast text.
- **My Spots:** brown signs, ranked, each with its plate.

## Motion

Sheets rise 24px and fade in over 200ms. Loading pulses blank sign panels. Nothing else moves, and with
`prefers-reduced-motion` nothing moves at all.

## Voice

Wit lives in the system's own slots: the Right meow tab, the POW DAY and PRIMO tabs, "Forecast ahead" over blank
signs while loading, "Stays dry", "Where to?". Headlines are answers ("18″ of snow", "Until 1 AM"), never labels.
