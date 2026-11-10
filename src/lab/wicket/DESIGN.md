# Wicket: the design standard

Every day is a lift ticket. The forecast is a fistful of them, hung from a wire on a jacket zipper.
Rigor first: a tight internal grid, real density, exact type. The noise is earned by the system.

## Principles

1. **One surface.** Everything sits on a `.wk-tk` ticket. Sections are `.wk-seg` segments inside `.wk-tk-face`.
   Between segments: a perforation and two die-cut notches (the mask does this automatically).
   Only alerts leave the surface, as closure signage.
2. **One ink plus black, and the ink prints the weather.** A ticket is its weekday's ink and black on bare stock.
   Black always overprints; white is never text on ink. The ink's main job is the sky print.
3. **Danger colors mean danger.** Red, orange and hazard yellow appear only on alerts and the avalanche scale.
4. **A real printed object.** Edges are die-cut, not outlined. No keyline on every box. Controls are flat tints.
5. **2 seconds, 5 seconds.** Now-temp and sky lead. Scores and highs compare in fixed columns down the stack.

## Tokens

Set on `.wk`, redefined under `[data-theme="dark"]`.

- `--stock` #fff in light; sodium-lit #c8b998 at night.
- `--page` #fff (blazing snowfield) / #05070f (night slope). `--band` #000 jacket. `--zip` teeth. `--wire` the wicket.
- `--edge` a hairline die-cut edge in light; a low sodium bounce at night. `--hazard` #ffd400.
- `--ink-raw` per `[data-day]`, chosen so black clears 4.5:1 and none of them borrows a danger hue:
  mon #38b6f0, tue #ad8cff, wed #3ed07c, thu #f27fd0, fri #22cdbf, sat #6f9dff, sun #b5dc5c.
- `--ink` is `--ink-raw` in light, mixed 28% toward brown at night, so nothing glares under the lights.
- Avalanche scale is exact and untouched: 1 #50b848, 2 #fff200, 3 #f7941e, 4 #ed1c24 (black text), 5 #231f20 (white text).

Light shadows are printed: a faint halftone offset behind standalone tickets. No soft shadows on the page.
Night lights the page: posterized sodium pools, one glow behind the whole stack so it can't tint another ticket.

## Type

- **Anybody** (variable width, italics) does nearly everything. Numerals and names are italic 900.
- `fitWidth` condenses or extends a line to fill its measure, never below 84% width. Past that the type gets smaller,
  then wraps. "Alta" fills a line; "Truth or Consequences" stays recognizably the same face.
- Three-digit temps step down in size, not width (`data-digits`).
- **Doto** 900, dot-matrix, only for short printed strings at 14px or larger: dates, serial, valid-at, barcode digits, window.
- **Knewave**, marker. Day marks, ranks, POW DAY, VOID. Short strings only.
- Type over a sky print gets a solid trap of bare stock (`-webkit-text-stroke` with `paint-order`), as a printer would knock out.

Scale: hero temp 100–140px, punch large 68px, week high 35px, score 30px, day name 19px, body 15–16px,
condensed detail 13.5px, legal 12.5px, edge microprint 10.5px (decorative).

## Sky print

`sky.tsx`. `skyNow(period)` and `skyDay(day)` classify a kind and a 0–1 level from the real forecast; `Sky` draws it in the ticket's ink.
Snow is a halftone whose dots grow with intensity. Rain is slashes, thicker when heavier. Storm is an ink flood with stock rain and a bolt.
Clear is sun rays. Night is ink with moon and stars. Partly adds a cloud. Cloud is a scalloped deck. Fog is broken banks. 90° and up is a big sun over heat shimmer.
Every ticket carries it: large on the field, small on the stub. Text hidden, the sky should still read across a room.

## Anatomy

- **Flap** (`.wk-flap`): fold, punched wicket hole (a real mask), ticket kind.
- **Field** (`.wk-field`): date line on bare stock, then the stage (sky print, place, the big number), then the ink condition strip.
- **Stub** (`StubCell`): sky print, day mark, date. Used on the today row, every stack ticket, spots and the day screen.
- **Day mark**: marker on the stub only, never beside a number. M W F are one letter; Tu Th Sa Su are two so nothing reads as a 1.
- Stack tickets step on the left and tilt within ±1.5° (halved at desk widths). The right edge holds still, so the score column does.
- Day screen: the lower half is a separate torn ticket (`.wk-torn`), and tears on entry.

## Reading order

Alerts. Avalanche ticket when danger is 3 or higher (desk: top of the right column). Today's ticket: place, now, sky.
Today row. Best day. Barcode. Sun and refresh. Print lines and fine print last. Then week total, the stack, and mountain tickets.

## Icon language

`Glyph` in `parts.tsx`: solid or heavy-line shapes on a 24 grid, butt caps, 6° italic skew to match the type,
`currentColor` only. The cat (`Cat`) is the only figure in the app.

## Chart grammar

One chart: the barcode (`Barcode`). One bar per hour between guard bars, EAN digits below.

- Every hour: a full-height hairline (the clock) plus a thick bar (the value). A thin bar is the qualifier: feels-like in Temp, gusts in Wind.
- Scales are honest. Temp stands on 0°F (subzero moves the floor to the next ten down). Precip 0–100. Wind from 0, top at least 15 mph. Snow from 0, top at least 0.4″.
- Direct labels are spaced by the plot's measured width and the widest label, so they can't run together.
- Scan: drag, tap, or arrow keys (`role="slider"`). The picked hour gets an ink block and an exact readout. Its accessible name summarizes the data.

## The score

`Punch` and nothing else: the number in italic black, plus ten positions with `round(score / 10)` punched. No score: a dash and ten open positions.

## Celebration and signage

- POW DAY: `PowStamp`, black slab with white type, in a fixed `tag` cell on tickets, marker and rubber-eroded across the corner of the condition strip when large.
- PRIMO: `PrimoFoil`, conic holographic foil, a seal when large, follows the pointer.
- Alerts: full-bleed tape under the zipper, sorted by severity. Severity is the word plus the sign's form: Extreme black plate on wide stripes, Severe yellow plate on stripes, Moderate orange on rope line, Minor bare stock on dashed rope. Words are NWS's own.
- Avalanche: plain ticket, standard colors, no marker, no ink, no jokes.

## Navigation

One way: the jacket band (home via wordmark, Find, Spots, Map, Night/Day) on every screen. Day screen adds previous, back, next under it. Overlays are native `<dialog>`.

## Motion

CSS only, all inside `prefers-reduced-motion: no-preference`. One verb: things hang and swing.
Home: hero drops, then each ticket on a 58ms stagger, about 900ms total. Day: ticket drops, stub tears off. Foil shimmers. Print bars pulse while loading.

## Voice

`voice.ts`: `ticketCopy` picks a kind, fine print and edge microprint from the conditions. Humor lives in fine print, ticket kinds and the cat.
Thunderstorms get plain words. Nothing funny on alerts or avalanche. Heat is a shade pass whose fine print still says to bring water.

## Layout

Phone first, single column with a 12px gutter. At 960px+: hero left (sticky), week and mountain right; Day splits main ticket and torn stub; My Spots runs both sides of a center zipper. Week rows reflow by container query.
