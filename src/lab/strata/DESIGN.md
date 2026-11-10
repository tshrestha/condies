# Strata

The forecast is a painting. The interface is a stack of flat bands of pure color, and all of the color comes
from the data. Ed Hawkins' Warming Stripes, applied to a forecast. There are no cards, borders, radii, shadows,
gradients or icons. Only color, enormous type and a strict grid.

## Principles

1. **Color means temperature.** Chromatic color is only ever a temperature, or the avalanche scale. Every other
   value prints in neutral graphite. Never add a decorative color.
2. **The ramp is absolute.** The same temperature is the same color on every screen, every day.
3. **Time is vertical.** Now at the top, then hours, then the week. On wide screens the hour axis turns on its
   side into full-height stripes. The stack is the same one.
4. **Words do the job of icons.** There is no icon set. The cat is the only drawing.
5. **Numerals are architecture.** Size them until they feel slightly too big.
6. **Never rescue contrast with tints.** Text is pure black or pure white, chosen per band.

## Color tokens (`ramp.ts`)

- Ground: `#fff` light, `#000` dark. The `dark` column of the ramp is the same hue printed about 25–30% darker, so
  a full-screen flood is comfortable in a dark room. Every band uses it, which keeps the ramp absolute per theme.
- `temperatureRamp`: 28 named steps, hard-coded per 5°F, from Abyss through Ultramarine, Cobalt, Glacier, Lagoon,
  Spruce, Jade, Chartreuse, Saffron, Vermilion, Magenta, Oxblood and Char. Lightness rises to a peak at 35°, falls
  through 45° and rises again to 65°, so a dull 44–52° week still changes color. Do not interpolate between steps.
- Graphite: neutral ink at seven densities for the non-temperature hour views, so they can never be read against
  the ramp. `paintPrecip` and `paintWind` add ink with value. `paintSnow` is reversed on paper: more snow clears
  toward white. Day-page facts and snow depth print plainly on the ground.
- `avalancheScale`: the North American standard. A safety requirement, not to be retuned.
- `inkOn(hex)` computes black or white for a band. Every step passes 4.5:1.

Pass every band through `paintVars(paint)`, which sets `--b` and `--k`. CSS reads only those.

## Type

- Display: League Gothic (`--st-d`). Anything large, and every number that is data.
- Text: Chivo (`--st-t`), 13–18px on phones (10–11px only for meridiems and gust labels in wide columns), weights
  500–800.
- No tracked caps, no monospace, no italics.
- `fit(text)` returns `--em` and `--lsb` from measured glyph metrics in `fit.ts`. A fitted element sizes itself
  with `calc(100cqi / var(--em))` and offsets by `--lsb` ems, so the ink of a word lands exactly on both grid edges
  without measuring at runtime. Use it for the current temperature, the city and day names.

| Role                       | Size at phone width                |
| -------------------------- | ---------------------------------- |
| Current temperature        | fitted to column (about 400px)     |
| Alert: Extreme / Severe    | fitted to column (caps 124 / 92px) |
| Advisory: Moderate / Minor | 28 / 23px on one line              |
| Section title              | 96px                               |
| Hour value                 | 40px in a 48px band                |
| Body                       | 13–17px Chivo                      |

## Grid

- Gutter `--st-gut`: 16px, or 32px from 1024px. Every left edge and right value aligns to it.
- Unit `--st-unit`: 48px, one hour band, also the height of tabs, masthead and peeks.
- The Day poster is 24 rows of `--st-u`, one for each hour band. Its blocks snap to those rows.

## Texture (`texture.ts`)

Hard-edged printmaking in place of weather icons, with density encoding intensity. Stipple is snow, diagonal hatch
is rain, tighter hatch plus a zig-zag band edge is thunder, and a line screen is fog or haze. Textures are masks
filled with the band's ink, or with white for snow.

**No text ever sits on texture.** Texture gets a zone of its own: the middle of an hour band, between the words and
the value; a full-bleed strip between the city and the numeral on Home; a strip across a Spots band. Do not use
knockout chips. Wind and snow views carry no texture because their densities already say it.

## Chart grammar

One grammar: a band of color per unit of time, value in numerals. Hours are one band each, in fixed zones: time and
condition words solid at left, texture in the middle, value solid at right. Week bands add one vertical strip per hour on a fixed 24-column axis, so the warm center
of each day lines up down the stack. The missing hours of today stay the band's own color. Every painting has a
text alternative through `stripLabel` or the hour list itself, and every value is also printed in numbers or words.

## The Condies score

`Tile` is the only treatment: a solid black square with the word Condies inside and a heavy Chivo numeral. It is
set in Chivo because the display face means temperature, and a score must never read as a degree. It sits on a
colored band so it reads in both themes, and never stacked on a temperature block. On week rows it goes at the
left, away from the highs and lows. Size may change; proportions do not. If a day has no score, the tile is absent.

Markers (`POW DAY`, `PRIMO`) are one white block with black text. On the Day screen the same block runs vertically
up the stripes.

## Navigation

One masthead with words: Condies, Search, Map, Spots, Dark or Light. On Home it is printed on the NOW color. On
other screens it sits on the ground. Moving between days is by the neighboring day's color, which peeks at the top
and bottom edges of the screen and sticks there while you scroll. Before the first day, the top peek is Right meow.

## Motion

A single idea: bands being laid down. `st-lay` is a clip-path wipe from the top, staggered, about 700ms overall.
Switching an hourly view is the same idea sideways: `shutter` clones the stack, repaints it underneath, and each
new band wipes over the old one. Nothing bounces, fades or scales. `prefers-reduced-motion` turns it all off.

## Alerts and avalanche

Hazards come first. Extreme and Severe alerts are a pure black band above the numeral, carrying the masthead, with
the event fitted to the column on one line. The hero shrinks to a two-column reading to make room. Moderate and
Minor are one-line advisories after the go decision. Severity is carried by the printed word, type size and
position, never by color. Copy stays plain, and there are no jokes near it.

Avalanche danger is a stack of five bands from the standard scale, with the current level opened up and the others
left as thin strata. A rating of 3 or higher moves up to directly after the hero.

## Page order

Home: hazards, Now, avalanche 3 or higher, go decision (Best day, storm sentence), advisories, hours, sun, mountain, week.

## Voice

Short sentences ending in periods, in plain words. Mountain-town phrases live on Home and in the markers only.

## Extending

- A new value view needs a plate in `ramp.ts` and a case in `describe`. Do not add a new visual form.
- Prefix classes with `st-`. Keep resets inside `:where(.st-root)` so they never outrank band colors.
- Check the ramp as a full swatch strip before changing any step.
