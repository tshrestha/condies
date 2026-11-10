# Station

The home weather station, redesigned. The page is the device face and the readings live in LCD
windows on it. An LCD has a fixed set of segments, one ink and one ground, so nothing on it can be
decorative. That budget is the design standard.

## Principles

1. **Face and windows.** The face carries printed words: titles, legends, tabs, prose, warnings.
   Windows (`.ws-lcd`) carry readings: numbers, units, icons, bar graphs and the words that describe
   a reading. Nothing sits behind text.
2. **Segments are rare.** DSEG7 draws only the current temperature and the Condies score. Every other
   number is Atkinson with tabular figures, so decimals ("1.3″") and ones ("51°") read exactly. No
   unlit ghost segments anywhere.
3. **Glance first.** Home answers six questions on the first screen: temperature, condition, rain or
   snow in the next 12 hours and how much, best day and when, warnings, tomorrow's high.
4. **Three lines per block**, and **remove before adding**: a mark that isn't data or a control goes.
   No outlined buttons, pills or badges.

## Tokens (`station.css`, on `.ws-root`)

| Token              | Light (unlit LCD) | Dark (backlight on) | Role                                  |
| ------------------ | ----------------- | ------------------- | ------------------------------------- |
| `--ws-face`        | `#eef0ef`         | `#1a2228`           | The one ground: the case              |
| `--ws-ink`         | `#14191b`         | `#dde4e6`           | Everything printed on the face        |
| `--ws-lcd`         | `#c4d0bf`         | `#5aa79f`           | The accent: window panel              |
| `--ws-seg`         | `#0c1a0f`         | `#021512`           | The window's ink, about 11:1 / 6.7:1  |
| `--ws-rule`        | seg at 22%        | seg at 28%          | Row dividers                          |
| `--ws-danger`      | `#c8232f`         | `#c8232f`           | Alert lamp fill, white text 5.6:1     |
| `--ws-danger-line` | `#c8232f`         | `#f06b6f`           | Moderate frame and word, Extreme ring |

Dark is the backlight switched on: the panel glows teal and the segments stay dark, in a dark slate
case. It reads as a lit LCD, not as light text on black. Avalanche danger keeps the North American
scale's five colors, the one place the single-ink rule breaks.

Spacing: 16px gutter and section gap, 14px window padding and radius. Wide (≥960px) turns the face
landscape: three columns of windows and taller bars.

## Type

Atkinson Hyperlegible Next for every word and most numbers; DSEG7 Classic Bold for the two segment
readings. Four sizes per screen, two weights (400, 700): 16 (body, legends, tabs, units), 22 (place,
condition, event names, small readings), 36 (week highs, the 12-hour amount, the score on Day),
68 (the hero; 56 at 320 wide). Figures are regular weight; names and headings are bold.

Use `Reading` for any measurement: the figures, then the unit (° and ″ follow the figures, mph sits
after a space at 16px). `Hero` is the current temperature. `Score` is the Condies score.

## Icons (`icons.tsx`)

One set of segment pictograms on a 32-unit grid in `currentColor`: sun, moon, partly sun, partly
moon, cloud, rain, snow, storm, fog, haze, plus cat, star, chevron and the LCD pointer. Overlaps are
cut out with `--ws-gap`, the local ground. `glyphFor(shortForecast, isDaytime)` picks one. A long
current condition drops its icon, since the words already name it.

## Chart grammar (`bars.tsx`)

The LCD bar graph: one column per hour, eight blocks high, one series at a time.

- Temp: the lowest hour is one block, the span is at least 8°. Wind: solid blocks, plus one outlined
  block above for the strongest gust. Rain and Snow: running totals, so the last column is the
  amount. Without grid amounts, Rain falls back to chance.
- Up to three direct labels (now, high, low, peak, total), 16px bold, never repeating a value and
  never sitting on a neighbor. A 2px baseline, no legend, no gridlines. Hour marks print on the face.
- Every graph has `role="img"` and a sentence summary.
- Home leads with one readout that matches the default graph: "18″ of snow" over the snow total,
  "3.3″ of rain" over the rain total, with "Chance up to 100%" as its caption. Dry hours say
  "No rain or snow" and default to Temp.

## Condies score

Segment digits with "Condies" printed beside them, never boxed. On Home it appears only on the best
day. It also appears on Day ("Condies score"), and in My Spots under "Ranked by Condies score".

## Best day

The week window opens with one lit block (segment ink on, panel-colored type), like an LCD's
highlighted line: "Best day · Pow day", "Condies 100", then "Saturday, 1 PM–5 PM". The reason
(Pow day or Primo condies) explains ties. The same day's row carries the LCD pointer ▸.

## Week rows

Day, icon, high (36), low (22), and snow (16) when any day this week has snow. No score column.

## Lamps (alerts)

The device's indicator lamps sit at the top of Home, sorted by severity, one line each, with the
severity word first:

- Extreme: a lit red lamp inside a second red ring, bold word, 22px white event name.
- Severe: the same lit red lamp without the ring.
- Moderate: a red frame and red bold "Moderate", 16px event.
- Minor: a faint frame, regular weight.
- Avalanche danger 3 and up: an ink frame with a chip in the scale's color reading "4 of 5".

Every lamp opens its detail sheet. Danger below 3, or no rating, uses the same lamp under On the mountain.

## Tabs and navigation

Every choice is a plain-text tab, 44px tall: bold with a 3px bar under it when selected, regular
otherwise. Nav: Home and Spots on the left (the current page is marked), Find, Map and the theme
switch on the right. The theme switch names what it does ("Night" or "Day") and is never shown
selected. Graph series and the Spots day filter (one scrolling row) use the same tab.

## Motion

LCD segments switch, they don't fade. Bar columns light left to right in 26ms steps when a graph
appears or changes series. Loading blinks the dashes in steps. Both stop under reduced motion.

## States

Loading ("Tuning in") blinks `--°F` and empty bar slots. Error shows them still, with Try again and
Go home links. Offline prints a bold notice under the nav. Empty Spots is a window with the star
and the hint.

## Voice

Light wit printed on the face: "Right meow" with the cat by the reading, "Pow day", "Primo condies",
"Tuning in". Never on lamps, alert sheets or avalanche text, which stay plain and serious.
