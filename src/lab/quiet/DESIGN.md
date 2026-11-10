# Strata Quiet

The forecast is a painting, said calmly. Color appears only where a temperature is the point: the current
temperature as one flat band, and the week as seven. One color per 5°F, the same everywhere, every day, so it
can be learned and read across a room. Everything else sits on a plain ground, and every number is printed.

## Principles

1. **Color means temperature, and only where it's needed.** Now and the week carry color, as do the Day
   screen's hero and its temperature chart. Hourly blocks, Best day, My Spots and forecast text sit on the ground.
2. **Warnings are black and white**, which no temperature ever is, so they stand out on any day's color.
3. **Sentences sit on the ground, numbers sit on their color.** A caption says what is happening; the band
   below carries the numbers.
4. **One band, one job, three lines.** A fourth line means the detail belongs on the Day screen or in a sheet.
5. **The first screen answers six questions**: temperature now, what's happening, rain or snow in the next 12
   hours, best day, any warning, tomorrow's high.
6. **No ornament.** No texture, pattern, gradient, shadow, radius, card, icon or legend. The cat is the only drawing.

## Color (`ramp.ts`)

- Ground `#fff` with ink `#000`; dark theme ground `#000` with ink `#fff`.
- `paintTemp(t, theme)`: Strata's 28 hand-tuned steps, hard edges every 5°F, never interpolated. The dark
  column keeps each hue (same OKLCH hue angle) at lower lightness, comfortable as a full-width band at night.
- `inkOn(bg)` picks black or white text per band. Every step passes 4.5:1.
- `paintDay(day)` paints a day with its high (its low when there's no high).
- `alertBand`: black with white text in both themes, framed by 2px white rules so it also reads on black.
- `avalancheScale`: the North American standard, exactly. Never retune it.
- CSS reads only `--b` (band) and `--k` (ink), set through `paintVars`.

## Type

Chivo for everything (tabular figures by default). League Gothic only for Home's current temperature.
Two weights, 400 and 700. No tracked caps, no italics, no condensed text. Four sizes per screen:

| Token     | Size   | Use                                                                        |
| --------- | ------ | -------------------------------------------------------------------------- |
| `--sq-s`  | 14px   | hour labels, severity words, the age line, small print                     |
| `--sq-m`  | 18px   | body, captions, day names (bold), conditions                               |
| `--sq-l`  | 32px   | key numbers, the condition now, Extreme alert titles, the score            |
| numeral   | fitted | Home's current temperature in League Gothic                                |
| `--sq-xl` | 88px   | the day's high and low in Chivo (Day screen only, in place of the numeral) |

## Space and structure

- Gutter `--sq-gut`: 20px phone, 32px from 600px, 40px from 1024px. Every left edge sits on it.
- Bands are full-bleed and separated by 2px of ground (`border-bottom` on `.sq-band`), so two days of the
  same color never merge. Nothing else draws a line except the alert frame, chart baseline and search rule.
- The 12-hour blocks sit on a three-column grid aligned to the gutter.
- From 1024px the masthead and alerts run full width. Below them, the lead (Now, or the day's hero) holds
  still in the left half while the list scrolls on the right.

## The numeral

The condition always sits beside the numeral, in a column of at least 166px. The numeral takes the rest of the
width up to half the band, and at most 40svh of font size (about 30% of the screen's height). On a busy phone
screen, `HomeScreen` shrinks it further so that tomorrow's high still clears the bottom of the first screen.

## Home, in order

1. Masthead on the ground: Condies, Search, Spots, Map, theme.
2. Alerts (`Alerts`, `AlertRow`), strongest first, each a full-width button that opens its sheet:
    - Extreme: black band, title at 32px. Severe: black band, title at 18px bold.
    - Avalanche danger 3 or higher: the standard color, "High avalanche danger · 4 of 5".
    - Moderate and Minor: quiet rows on the ground, regular weight.
    - Every row prints its severity in words and ends with an arrow.
3. Now: "Right meow in {place}" with Star, then the numeral beside condition, feels like (if 3° off), wind
   and the age.
4. Next 12 hours, from now: one caption and three 4-hour blocks (time, temp, what falls), read from the same
   hours. The caption's snow total is the sum of the blocks, and it names when the span ends ("Snow until 1 AM ·
   17.5″"). A storm that runs past the span, or starts later, gets a second line with its own span.
5. Best day: day, window, high and the score. "No standout day this week" when nothing qualifies.
6. The week: seven bands in the color of each day's high: day, one condition word (or POW DAY / PRIMO), snow
   if any, high in bold and low in regular. A missing high reads "Low 10°", never "– 10°".
7. Below the week: week snow total, lower avalanche ratings, snow depth, sunrise and sunset.

## The Condies score

`Score` is the only treatment: a 68px square of ink with "Condies" and the number knocked out in the ground
color. It only ever sits on the ground, so it never takes a temperature color, and it has no degree sign. It
appears on Best day, the Day screen and My Spots. If there's no score, there's no square.

## Chart grammar (`Hourly`)

One series at a time, one column per hour on a baseline, with direct labels at the ends and extremes only.
Temperature columns are painted from the ramp, with heights relative to the day's range. Precipitation, wind
and snow are ink. Gusts are a short ink mark above each wind column, labeled in words. A sentence above the
chart states the reading and is also its text alternative. No legends, no gridlines.

## Navigation

One masthead everywhere. Every week band is a link to its day. The Day screen adds a plain pager of the
neighboring days ("← Now 25°" on the first). Alert detail, avalanche detail and search open in a sheet.

## Motion

Nothing slides, fades in or bounces. When the theme or the data changes, a band's color shifts over 0.4s, and
chart columns grow from the baseline when switching views. Loading steps through the ramp, cold to hot, in hard
cuts. `prefers-reduced-motion` turns all of it off.

## Voice

Plain sentences. Mountain-town words live only in "Right meow", POW DAY and PRIMO. Warning and avalanche text
is the agency's own, with no jokes anywhere near it.

## Extending

- New datum: decide whether it is a sentence (ground) or a number. Give it a color only if its temperature is
  the point of that screen. If it is neither, it belongs on the Day screen.
- New color: don't. If something needs a key, redesign it.
- Prefix classes with `sq-`. Resets live in `:where(.sq-root)` so they never outrank band colors.
