# The Lap Ledger design system

**Status: adopted, version A (#843).** Written for VD-75 (#843) on 2026-10-06
from the five critiques in
[`critiques/2026-10-06-design-pass.md`](critiques/2026-10-06-design-pass.md).
The maintainer chose version A on #843 the same day, with DP-01 to DP-08 and
DP-28 to DP-33 accepted, to be built in seven reviewed steps (VD-78 to VD-84,
#865 to #871). VD-85 (#872) made it the rule for web work `[D-53]`: a new
page, component or critique is held to it, and a feature that needs something
it lacks extends it in the same pull request (§8). Versions B and C were
rejected; §10 keeps the record of what they were and what they gave up.

**What it is for.** The thirteen layout changes of 5–6 October each fixed one
page type well. Together they left five two-column systems, seven text widths
and eight different opening bands. No change was wrong. The site had no
written system for a change to be wrong *against*. This file is that
system, for the site as it is now and as it keeps changing: the rules a new
page, component or critique is held to, and the tests that hold them.

**The visual comparison** (the system's tokens, components and templates, and
today's driver, race and circuit pages beside each version at 1440 and 400 px)
is the page linked from #843. This file is the record; the page is the
picture.

**How to read it.** Most of the system was the same in all three proposed
versions and is marked **core**. What only version A has is marked **A**: a
12-column grid, and each entity page and the race page opening with its
heading on the left and one picture slot on the right, from 1180 px.

**Built, pending and provisional.** Each section says after its heading which
it is, so that nobody holds new work to a rule that has not landed:

- **built**: on `main`, in `web/src/styles/tokens.css` or a component, and
  held by a test where one applies. A diff is held to it, and a page off it
  is drift. Where a value written here and `tokens.css` differ, the file is
  the value.
- **pending (VD-nn)**: decided, and waiting for the build step named. A page
  that lacks it is that step's to fix, not a finding against the page, and a
  reviewer does not fail a diff for not having it. A new feature does not
  build a rival to it either: it waits for the step, or extends the system
  under §8.
- **provisional**: added by a feature under §8's *Extending*, and on trial
  until it is promoted to core or dropped.

§1's principles bind from adoption. The steps: VD-78 (#865, the grid, the
measure and the design-system tests), VD-79 (#866, tiles, one page
header and the handover), VD-80 (#867, one figure grammar), VD-81 (#868,
one vocabulary), VD-82 (#869, one reveal control, with sort and fold in
the address), VD-83 (#870, one section order per page type) and VD-84
(#871, the opening slot and the middle type register) are built: all seven.
VD-86 (#884) built the core rules none of the seven named, but for the
Loading, Empty and Error states, which are VD-100's (#1023). **A step's
pull request moves the sections it builds from pending to built**, in this
file, in the same change.

---

## 1. Principles

1. **Serve the value, and give it character.** A reader comes for a
   figure, a result or a comparison. Decoration that delays it is a defect,
   whatever its taste. Character that costs no lookup (colour with a
   meaning, annotation, a page with a point of view) is not decoration, and
   a page that is correct and dull has a defect too `[D-64]`.
2. **One system, applied.** Every width, gap and type size is a token, and
   every recurring block is a component. A page is an arrangement of
   components, never a one-off.
3. **Every deviation is declared.** This is the project's pattern
   (`AGENTS.md`) applied to design. A page that departs from its template
   says so in a comment that cites an issue or a `[D-nn]`, and a test lets it
   through by name.
4. **The static page and the app are one page.** Both renderers draw the
   same components in the same order, so a reader who arrives from a search
   is not moved when the app takes over.
5. **Accessible where possible, never below the floor.** An appealing design
   is weighted above strict accessibility, as the maintainer set on #843.
   But the floor that is enforced today stays enforced: axe-core's WCAG A/AA
   run in the smoke suite, the contrast checks in `web/test/conventions.mjs`,
   and `frontend-reviewer`'s item 7. Every accessibility rule below is
   marked **floor** (enforced) or **aim** (followed where it does not cost
   the design). Where design and accessibility pull apart, §7 names the
   conflict and the solution that keeps both.

---

## 2. Foundations: the tokens

### Where the tokens live — built (VD-78)

| Kind | Single source |
|---|---|
| Colour, type, weight, spacing, measure, page width, radius, fonts | `web/src/styles/tokens.css` |
| Grid columns, gutter, spans, breakpoints | `tokens.css`, the grid block. A custom property cannot stand in a media query, so `app.css` writes the two breakpoints as literals and `conventions.mjs` refuses any other |
| Livery and national racing colours | `lib/liveries.js`, `lib/racingColours.js`, the `--racing-*` pairs in `tokens.css`, `--livery*` set per element in `app.css`. They are data, with sources |
| Chart series and grid | `--series-ink`, `--series-mark`, `--series-1..3`, `--grid` in `tokens.css`; the validator record in `charts/palette.js` |
| Counts that shape a layout | stay in JS, one name each: `FOLD_TO` (`lib/table.js`), `PHOTOGRAPHS_SHOWN` and `PHOTOGRAPH_WIDTH` (`lib/site.js`) |
| Inline sizes in JSX | none. `conventions.mjs` refuses a size written as a literal in a `style={{ }}` (VD-60 #615, folded into VD-78) |

### Grid — built (VD-78)

The values are in `tokens.css`'s grid block, and this file names them
without restating them (§9):

| Token | Job |
|---|---|
| `--page` | the page's width; from there only the margins grow |
| `--columns` | 12 from `--bp-desktop`, 8 from `--bp-tablet`, 4 below |
| `--gutter` | the one gutter, `--space-8` |
| `--col`, `--span-n` | one column, and n columns with the gutters between them, counted off `main`'s content box |
| `--bp-tablet`, `--bp-desktop` | the two breakpoints, which replaced seven widths and the masthead's own wrap |
| Test widths | 400, 768, 1024, 1440, plus 1180 for the switch |

**Why 1180 for the switch, not 1024.** Between 1024 and 1180 a side column
costs a desktop reader more than it gives. The race classification loses
Points and FL to a scroll (141 px clipped at 1024). A lead chart's hover bars
are 3.7 px wide, against 6.0 px at 768 where it stacks. A side-by-side opening
starts at 1180 (interaction I3).

Every page is the 12-column grid.

### Spacing — built (VD-03): the scale, with roles named

The ten steps in `tokens.css` hold, and `conventions.mjs` refuses a value off
them. The visual critic found **no new literal in the thirteen changes**.
The roles below name what the steps already do, so that a component picks a
role and not a number:

| Role | Step |
|---|---|
| Between sections | `--space-9` (40) |
| Between blocks in a section; the gutter | `--space-8` (24) |
| Between a heading and its block | `--space-6` (12) |
| Inside a tile or frame | `--space-6` / `--space-7` |
| Between card siblings (photos, onward cards, record cards, outline cards, the outline strip) | `--space-6` (12), at every width; `conventions.mjs` holds every card grid to it (VD-86) |
| Above and below a table's body cell (**provisional**, VD-95) | `--row-pad`: `--space-4` (8) below `--bp-desktop`, `--space-2` (4) from it; §3 *Table* |
| Between a livery mark and its name: in a table cell, where nothing precedes the mark | `--space-4` (8) after it, `.livery` |
| Around a livery mark in a sentence, after a word (**provisional**, VD-45) | `--space-2` (4) on each side, `.livery-prose` (`LiveryMark`'s `prose`), so the word space before it makes that gap the larger and the mark reads as the name's; the mark and the name sit in one `.livery-prose-pair`, so a line never breaks between them |

### Type — built: the scale and the middle register (VD-84), the label register (VD-91), and the prose voice and heading case (VD-96); provisional: a box's heading (VD-119 #1341)

The eight small steps and the two display clamps hold. **`--size-9/10/11`
(32/40/50 px) were documented as VD-53's "one number per page" and used
nowhere** (visual V7). DP-10 kept them for the one hero figure per page,
which VD-84 set: the first lead figure of a ranked tile strip (a driver's, a
team's or a car's wins;
the season, race and circuit strips rank nothing and have none), at
`--size-9` on a phone,
`--size-10` from `--bp-tablet` and `--size-11` from `--bp-desktop`, beside
the opening band. A concluded season's is the margin on its plate (VD-104,
§3 *Season cycle*), and so is home's: the leader's margin over the
runner-up on the plate of the season being run (VD-109, `[D-69]`), or the
rounds run where there is no plate or it prints no margin. A second lead keeps `--size-8`, so a page has one hero and
not two, and a name is never one. `conventions.mjs` now declares no token
unused.

| Role | Step |
|---|---|
| Pills, tags, axis text | `--size-2` 11 |
| Column heads, tile labels; credits, source lines, footnotes | `--size-3` 12 |
| Tables, controls, notes **attached to a box**; the eyebrow above an h1 | `--size-4` 13.5 |
| Body, a value in a row | `--size-5` 15 |
| A box's heading: the disagreement box's h2, in Saira semibold (provisional, VD-119) | `--size-5` 15 |
| Lede, a name in a tile | `--size-6` 17 |
| Section head (h2) | `--size-7` 20 |
| A tile figure | `--size-8` 25 |
| One hero figure per page | `--size-9`–`--size-11`, by width (VD-84) |
| A record card's figure, on `/records`, whose numbers are the page | `--size-10` at every width (provisional, VD-111) |
| A record's figure, on its own page, which the page is built around | `--size-record`: twice `--size-11`, down to `--size-11` on a phone (provisional, VD-112) |
| Page title | `--size-display` |

**The label register (VD-91, `[D-62]`).** A label, a column head, a count,
a pill and the eyebrow above an h1 are set in Saira 500, untracked, in the
words as they are written: a label in sentence case, and a pill in lower
case, as the confidence tiers are stored (*verified*, *high*). Monospace is machine text only (SQL, code, a key, a
URL, an id shown as stored, like an engine's beside its team), and a figure in a column lines up in Saira's
own tabular figures (`.num`), not in a second face; a tile's figure keeps
the display face. Caps and tracking belong to the
display face, on the page title (VD-96, below). `--size-1` (10 px) is retired, and nothing is set
under 11 px; its number is left as a hole so that `--size-2` to `--size-11`
keep their names. `conventions.mjs` holds all three (§8, test 16).

**The prose voice (VD-96, DR-03, `[D-66]`).** Prose is set in a text serif,
`--serif` (Source Serif 4): the sentences a reader reads rather than scans,
which are a page's lede, a section's intro and a note under a block, a note
box, a table's source line in its footer band (the line, not the controls
beside it), how a column is derived, a figure's note, a source line, a
recorded disagreement's reading, the sentence under a livery band, and
running text at the measure and in faint, as on `/data` and in the footer's
credit. Each keeps the size, weight, ink and measure its own rule gives it:
at the scale's steps Source Serif 4 holds Saira's colour, so the face
changed and the scale did not. Labels, tiles, tables, pills, controls, a
photograph's caption and credit, and headings stay in Saira; a pill inside a line of prose
names the label face rather than taking the line's. `conventions.mjs` holds
the list (`PROSE`) and refuses the serif anywhere else (§8, test 18).

**Heading case (VD-96, `[D-66]`).** Condensed capitals are the page
title's: the h1 stays in them, and a section head (h2), the session sheets'
summary set as one, a car's name on its card (h3) and a circuit's on its
card are in the words as written, in the display face, untracked. The
wordmark, the site's name rather than a heading, keeps them; `DISPLAY_CAPS`
declares the two.

**A box's heading — provisional (VD-119 #1341).** The disagreement box's
heading is an h2, and it heads a box, not a section: it is set in the
label face, Saira rather than the condensed display face, semibold at
`--size-5` in ink, the table's row above. It was the display face at
`--size-4`, a 13.5 px condensed bold heading, the smallest display
setting on the site and on no role. A section head's `--size-7` would
outweigh the box's own reading and, on a race page, its one closed line.

### Measure — built (VD-78): one rule, two lengths, both on the grid

Before VD-78, `--measure: 46ch` was one token, but `ch` scales with the type
size, so it drew **seven right edges**: 525 (lede), 515 (figure note), 483
(figure caption), 463 (`.measure`), 417 (note), 370 (source note) and 304
(livery band). None of them fell on a column line, and the framed boxes that
inherited it (disagreement 463, note box 417, citation 370) aligned with
nothing. Now there are two, with their values in `tokens.css`:

| Token | Holds |
|---|---|
| `--measure` | free prose at 15–17 px, about 60–75 characters: five columns from 1180 |
| `--measure-small` | credits and source lines at 12–13.5 px: four columns from 1180 |

From 1180 px both end on a column line. Between the breakpoints they are
capped in rem, and below 768 everything runs the full column.

### Colour — built: listed with one name each

| Family | Tokens | Job |
|---|---|---|
| Surfaces | `--bg`, `--panel`, `--panel-sunk`, `--panel-raised`, `--stage` | ground, a box, a well, an overlay, the surface a chart or outline is drawn on |
| Ink | `--ink`, `--ink-soft`, `--ink-faint`, `--ink-invert` | text by rank; the foreground on an accent fill |
| Structure | `--rule`, `--rule-strong`, `--shadow-sm`, `--shadow` | hairlines; the two elevations |
| Interaction | `--accent`, `--accent-ink`, `--accent-wash` | the one interactive colour, the fastest lap, and on an ink chart the value its page states (`--series-mark`, `[D-61]`) |
| Result rail | `--rail-podium`, `--rail-points`, `--rail-classified` | state on a result row |
| Chart | `--series-ink`, `--series-mark`, `--series-1..3`, `--grid` | a chart with no owner in ink, its one stated value in the accent (VD-94, `[D-61]`); several series with no sourced colour in the three slots. Never text |
| Identity | `--racing-*` (1950–1967, a pair per theme); `--livery` (2010 on, per element) | a constructor's colour, beside a name it never replaces |
| Photograph | `--photo-trace`, `--photo-trace-casing` (provisional, AF-96, AF-177) | the layout drawn over an aerial photograph, and the casing under it; one value in both themes, since the photograph does not change with the theme |

Both themes keep their measured contrast (the figures are in the
`tokens.css` header). Dark stays a second instrument, not an inversion.

**A paper and an ink — built (VD-93 #923).** The surfaces, the inks and
the rules are tinted warm, toward the accent, in both themes: a paper, not
Tailwind's gray-100 ground under a white panel, and an ink that no longer
leans blue away from the red. Each keeps the lightness it had, or close to
it, so every contrast floor in §7 holds; `--panel-sunk` is held to the
luminance of the grey it replaced, because the livery pairs were stepped
against it. `conventions.mjs` refuses a surface, ink or rule that is
neutral or cool, and the gray-100 and white pair (§8, test 17).

**A team-mate's colour — built (VD-122 #1346), `[D-65]`.** Where two
drivers compared side by side drove for one team, the first takes the
team's colour and the second the second colour of the same livery as
`lib/liveries.js` holds it (Norris in McLaren's papaya, his team-mate in its
anthracite). The second colour is the mark's accent (`liveryPair`), and each
livery entry carries it as `second`, a light and dark pair moved in
lightness only as far as 3:1 on the surfaces the lead's pair clears - the
dark value lifted, and the light one darkened where the accent is pale, as
a white accent is. `conventions.mjs` holds every `second` to 3:1, to the
accent, and at least `ACCENT_APART` from the lead's pair in each theme; the
two entries where that cannot hold (McLaren 2015-16, Sauber 2013-14) say
null and are named in the test. A name always sits beside the mark, and
such a chart takes no accent (`[D-61]`). Where the livery holds no second
colour, a national colour included, the second driver is drawn in
`--ink`, the full ink rather than `--series-ink`, which sits too near the
German silver; with no colour on record, the two take the first two chart
slots, rule 3 of the Figure's colour rules.

**Close team colours in one chart — pending (VD-120 #1342).** Where two
liveries in one chart are hard to tell apart (Red Bull's navy beside
Williams' blue; 2026's three blues), they are kept apart by order or by a
one-pixel `--panel` outline per mark. Names stay beside every mark.

**The browser's own surfaces — built (VD-118 #1340); provisional: the
`--selection` token.** One rule on the root sets `accent-color` and the
caret in `--accent`, and the scrollbar's thumb in `--ink-faint` on a
`--rule` track; all three inherit, so every field, check box and scrolling
box takes them. Selected text sits on `--selection`, the accent mixed into
the panel, and takes `--ink`. It is not `--accent-wash`, which this section
first named: the wash sits too near the paper and the panel for a selection
in it to be seen. `conventions.mjs` holds the selected ink to 4.5:1, the
selection to 1.2:1 against `--bg` and each `--panel` surface, and the thumb
to 3:1 on its track, in both themes; the figures are in `tokens.css` and
`app.css`.

### Radii, borders, elevation — built; rules, not boxes (VD-93)

| Token | Value | Use |
|---|---|---|
| `--radius` | 3 px | every framed box |
| `--radius-sm` | 2 px | pills, chips, and the disagreement box (VD-78) |
| Frame | 1 px `--rule` | figures and tables: a block the reader reads inside (§3) |
| Rule | 1 px `--rule-strong` above | a tile, a record card, a door of an index or of `/data`, and home's two rounds and four conventions: siblings each under a rule on the paper, set off by the space after them, never a frame round each (VD-93). The onward band's routes sit under the band's own rule and draw none |
| Emphasis edge | 3 px left border `--rule-strong` | note box and disagreement only |
| Elevation | `--shadow` | overlays only: the search palette, a table's hover box. Never a page block |

A frame round every block, the same on a tile, a card and a door, made each
page a grid of identical boxes (design review DR-04, 2026-10-08). A rule
says where one thing ends without boxing it, which is how a printed table
of figures does it. `conventions.mjs` refuses a background, a frame on any
other side, a radius or a shadow on the ruled components, and a ruled one
that draws no rule (§8, test 17).

---

## 3. Components

Every recurring block, with its job, its parts, its widths and its states.
**Core** unless marked **A**.

### The text-width rule (core, asked for on #843) — built (VD-78, VD-80, VD-86)

Every text block is one of five kinds. Its kind sets its width.

1. **Free prose** (a lede, a section's intro, *Why it mattered*, a timeline
   entry) keeps the **measure**.
2. **Text that belongs to a box** (a figure's method note, a table's source
   line, the "same on every row" line) is drawn **inside the box's frame**:
   a footer band with a hairline as wide as the box. Its lines stop at the
   measure. The band matches the table, and the text stays legible.
   The figure's band is VD-80's and the table's VD-86's: both renderers
   print a table's source line in its footer band, a figure's numbers
   included, its lines stopping at `--measure-small`, and `smoke.mjs`
   (*Both renderers draw one page*) fails one left under its table or its
   figure in either half.
3. **A framed note** (disagreement, citation, *Where this comes from*) is a
   box: **the box spans its column**, and its lines stop at the measure (the
   citation's at `--measure-small`). A note box has one edge, its left rule,
   so the box and its lines end together at the measure.
4. **Structured or short text** (field lists, tiles, one-line notes,
   buttons) has no cap.
5. **Below 768 px**, every kind runs the full column.

"Its column" is the full content width (1,232 px at 1440), or the header
column in the opening band.

The result: **two text edges per page, both grid lines**, where there were
seven.

**A string with no break in it** (provisional, AF-110 #1005) - an address, a
SQL name, an API path, a word wider than its column - breaks where it must
rather than run past its box: `overflow-wrap: anywhere` on prose, code and a
name tile that hold one, `break-word` on the page's heading, which breaks
only a word that cannot fit a line of its own. A tile's figure is given
neither: `anywhere` there split "2017" into "201" and "7". The width sweep
in `smoke.mjs` (*Every route fits its width*, AF-101) fails a box that a
string runs past.

### Page header (core) — built (VD-79, VD-81)

- **Job:** say what this page is, and how to move along a sequence.
- **Parts:** eyebrow, h1, lede, stepper; on a race page, the weather line
  between the lede and the stepper.
  - The **eyebrow** is a dateline in the body face, `--size-4` at 500 in
    `--ink-soft`, not a chip of tracked capitals (VD-91). It follows one
    rule: the page type, then the facts that identify the entity, for example *Driver · United Kingdom · born 7
    January 1985* or *Race · Round 12 of 24 · 6 July 2025*. A fact the
    database does not hold is left out, never printed as a dash. All seven
    entity types carry one, seasons included (*Season · 23 rounds, 16
    run*), and an era's page does the same (*Era · 2014–2021*, IA-25),
    from `EYEBROWS` in `web/src/lib/site.js`, which both renderers
    read. This settles IA-09 (#253); smoke's *one vocabulary* check holds
    each entity page's eyebrow to its type in both halves (VD-81).
  - The **stepper** names its neighbours: *← 2025 Austrian Grand Prix*, as
    the race's own h1 names it (`raceSteps` in `lib/wayfinding.js`, VD-81).
- **One component drawn by both renderers.** `Page` in
  `components/Page.jsx` draws it in the app, and `opening()` with
  `structure()` in `scripts/prerender.js` draws the same markup, class for
  class, from the same strings: `NAMES` and `EYEBROWS` in `lib/site.js`,
  each register's lede in its `queries/*.js` module, and the livery band's
  words from `bandWords()` in `lib/liveries.js`. VD-56 (#550) and VD-71
  (#819) closed into it, and VD-73 (#822) the lead charts, which were the
  figure's and the slot's rather than the header's.
  - One declared difference: `/data/sql`'s static page keeps its own lede,
    because it is not the console and has no examples or schema for the
    app's lede to point at.
  - The **weather line** (provisional, AF-142 #1148) is one note, `--size-4`
    in the lede's ink at the measure, drawn by `RaceWeather` in `Race.jsx`
    and `weatherBlock()` in `prerender.js` from `raceWeather()` in
    `queries/race.js`, under the rules for it there:
    - A **mark** and a word from the race article's report: rain for wet;
      for dry, the sun, or a cloud where the phrase speaks of cloud or
      thunder and not of sun. The sun says dry, not a clear sky. The mark is
      `aria-hidden`, drawn in the line's ink at 1.25 em from `WEATHER_MARKS`,
      and never stands alone: the word says the same thing (*Wet*, *Dry*,
      *Dry, with cloud*). A phrase read as neither has neither.
    - The **model's figures** follow after ` · `, labelled *modelled*, with
      the link Open-Meteo asks for and a `.table-how` disclosure holding the
      method and the Copernicus credit, on the line's row where it fits, which
      keeps §4's four classification rows. They are the day's, so the line
      says *High of 18 °C, no rain on the day* and never the temperature at
      the start, which the database does not hold.
    - **Nothing is guessed.** A race with neither row has no line, and either
      half stands without the other. Where the two cannot both be true the
      disagreement box says so, as it does for any open row.
- **Widths:** the header column: 7 columns from 1180 beside the slot, the
  full width where the slot is empty or below 1180. The lede is at the
  measure.
- **Accessibility:**
  - One h1 per page (**floor**).
  - Focus lands on the h1 after navigation *and after the handover from the
    static page* (**floor**). It used to fall to `<body>` on driver,
    constructor and season pages in 6 of 6 cold loads, because `main.jsx`
    focused an h1 the page had not drawn yet. The app now renders out of
    sight and takes the static page's place once its page is drawn, and the
    h1 takes focus then (`lib/handover.js` `arrived()`). Held by §8's
    test 10.
  - A status region stays mounted and says when the page has changed
    (**aim**): `#page-status` in `index.html`, outside both halves, says
    *"…: the page has finished loading."* at the handover.
  - The page reads h1 → lede → the tile strip → a first h2 that is the
    page's lead answer, on every page type (**aim**; the accessibility
    critic's rule for predictability).

### Opening slot (A) — built (VD-84); provisional: home's (VD-92)

"The picture of this thing", 5 columns beside the header from 1180, after
the tiles below that. What fills it:

- driver, constructor and season: the lead chart, as `<Section lead>`;
- circuit: the current layout's outline, on every circuit with one. The
  maintainer's ruling on VD-74 (#823) is that the outline leads every
  circuit page, since only 19 of the 80 have an aerial photograph; where
  there is one it stays the header's own (VD-62), in three of the header's
  seven columns beside the heading, so the photograph and the outline share
  the band and neither is dropped;
- race: the outline (DP-11);
- car: the first photograph whose file name names the car
  (`carPhotographs` in `queries/car.js`). An unconfirmed file is never the
  picture of this thing, and the photo strip holds the rest rather than
  drawing it twice;
- home (**provisional**, VD-92 #922): a race's outline, with its result or
  its date in words — the last race run and its winner, or the next round of
  the season being run and its dates while that season has run none
  (`openingRace` in `queries/home.js`, read off the database and never a
  clock, so both renderers choose the same race). Where the one chosen has
  no drawing the other takes the slot, and with neither the header keeps the
  width. It is written after the season plate (VD-109), as a race's is after
  its classification, so below 1180 it follows the panel that names the race.

A picture is `<Slot>` in the app and `slot()` in `prerender.js`, the same
`div.slot`. A lead chart is `<Section lead>` in the app and `leadFigure()` in
`prerender.js`, the same `section.slot`: the static page draws all three
(VD-73) from the layouts in `charts/dotPlot.js`, `columnChart.js` and
`lineChart.js` and the figures in `queries/driver.js`, `constructor.js` and
`season.js`, which the app's components read too. It cannot measure, so it
lays the drawing out at one width and gives the plot the app's height
(`.plot-static`): the box is the app's at every width, and only the drawing
inside it is scaled, until the app redraws it at the width it occupies.

- **Order.** The slot is written after the tiles, a race's after its
  classification, and only the grid lifts it into the band, so a screen
  reader and the Tab key read heading, tiles, then the picture at every
  width.
- **Widths.** Below 1180 a picture is capped at 5 columns from
  `--bp-tablet`, and a chart keeps the column. An outline in the slot is
  drawn in a 2:1 box, so the band is little taller than the header beside
  it.
- **Empty.** An empty slot gives its width to the header. The band is as
  tall as the taller of the two, and the tiles start under both, so nothing
  below is ragged.
- **Minimum mark width.** A lead chart goes in the slot only where its
  hover targets keep 6 px at 1180, the slot's narrowest: `SLOT_MARKS` in
  `lib/site.js`, 63 columns. Ferrari's 77 seasons lead under the tiles at
  the full width instead, and its header keeps the band. A column chart's
  hover targets meet, each the full step wide.
- **Held by** `smoke.mjs`, *The opening slot*: §8, test 14; and the static
  lead charts by *The lead charts on the static page*, which holds each to
  the app's plot box, marks, legend and numbers.

### Tile strip (core) — built (VD-79, VD-81, VD-88)

- **Job:** the handful of figures the page is about.
- **Parts:** label (`--size-3`, the label register: Saira 500, sentence
  case, VD-91), figure (`--size-8`, or `--size-6` for a name), qualifier
  (`--size-3`). Every figure in a row sits on one baseline,
  the lead figures and the rest alike.
- **Widths:** a grid, not a flex row. Every tile draws its own rule (the
  option VD-46 #414 proposed, as a hairline frame; a rule over the tile
  since VD-93, with no fill and no left padding, so a strip's first figure
  stands on the page's edge), so a short last row ends against the page.
  There is **no ghost tile** and no stretched lone tile. Each renderer
  writes the strip's count as `--tiles`, and `.stats` in `app.css` picks
  the columns from it and from the strip's own width, with `--tile` and
  `--tile-pair` from `tokens.css`:
  - one row where the strip fits at `--tile` a tile (nine fit at 1440);
  - otherwise rows of equal count, half the tiles a row, then a third;
  - two to a row in a strip narrower than `--tile-pair`.
  A label may wrap: each tile is two rows of the strip's grid, shared
  through `subgrid`, so a two-line label moves every figure in its row
  together rather than its own alone.
- **One strip drawn by both renderers:** every strip is data in its page's
  `queries/*.js` module (VD-49, and VD-71 #819 for the Grand Prix pages, and
  the record pages until VD-112 opened them on their figure), drawn by `Stats` and by `prerender.js`'s `tiles()`. The one tile
  only the app draws is the season's *Next session*, because only a browser
  knows how long until it starts; §8's test 5 declares it.
- **Labels from one vocabulary:** *Seasons* for every year span, and
  *Entries* everywhere (CD-12 #258); a record's are *Value* and
  *Held by*, as /records' tables say them. The words are `LABELS` in
  `lib/site.js`, which every strip reads (VD-81); §8's test 7 refuses a
  synonym.
- **States:** a value not established is an em dash (**floor**: the NULL
  rule), in `.empty` as a table cell's is. A tile that does not apply to
  the page (the season's *Next session* with none to come, a Grand Prix's
  *Still to come* with nothing scheduled, a career's *Best grid* with no
  grid on record) is a different thing, and the strip says so by leaving
  the tile out of its list rather than giving it a null value; `lib/tiles.js`
  holds the rule for both renderers (VD-88). §8's test 5 holds one em dash
  tile in both halves.
- **Accessibility:** the strip is a `<dl>` with a name, "At a glance"
  (**aim**), carried by a `role="group"` wrapper around it, because an
  `aria-label` on a bare `<dl>` is not reliably exposed and `role="group"`
  on the `<dl>` itself breaks its `<dt>`/`<dd>` pairs. A wrapper rather
  than a hidden h2, so the strip adds no heading to the section list and
  a page still opens on its tiles with no heading above them. The name is
  `TILE_STRIP_NAME` in `lib/tiles.js`, and §8's test 5 reads it on every
  strip in both halves (VD-88).

### Record card (A) — provisional (VD-111 #1333)

Decided on the 2026-11-13 visual critique
(`docs/critiques/2026-11-13-visual-design/P11-records-cards-margin.html`).
`/records`'s headline records, one card each, under a rule (VD-93), never
a frame.

- **Job:** a record, and how far its holder is clear of the next.
- **Parts:** the record's name (`--size-4`, semibold, a link to its page);
  the number the value opens with at `--size-10` in the display face, with
  the rest of the value beside it as its qualifier at `--size-4`
  (`cardFigure`: where the number is `value_num`, the unit leads the
  qualifier, *<n> wins*; where it is not, as an age held in days and
  written in years, the value's own words do); the holder, a link where
  there is one; the comparator; the margin; and the derivation folded
  under *How it is derived*. A value that opens with no number is set
  whole at the tile's `--size-8`.
- **The comparator:** the holder's bar and the next two (`COMPARED`), read
  from the record's own derivation, the *Next:* list that closes it
  (`cardComparator`), so the card and the derivation it folds cannot
  disagree. Each name beside its bar and each figure printed at its end;
  the holder's bar in `--series-mark` and its name semibold in ink, the
  rest in `--series-ink` (`[D-61]`: the one value the card states). Each
  bar is its share of the longest; the longest leaves room at its end for
  a four-figure value. A shared record draws a bar for each holder, all
  marked; where the runners are seasons (*Max Verstappen 2022*), the
  holder's bar names its season too, or the card draws no bars; a tie at
  the third bar is drawn whole. A derivation with no
  *Next:* list, or one in neither of the build's two forms, draws no
  comparator rather than a guessed one, and the card keeps its figure and
  holder.
- **The margin:** one line in the label register, in ink: *<gap> clear
  of <the next>*, every runner level at the next figure named, or
  *Shared; <the next> next on <figure>* for a shared record; none where
  the holder and the next are level.
- **Widths:** four to a row from `--bp-desktop`, two from `--bp-tablet`,
  one below, a `--space-6` apart. Each card keeps its own height (IX-47).
- **Accessibility:** the bars are one `role="img"` whose name carries every
  name and figure; the printed figures make the bar never the only cue.
- **One card drawn by both renderers:** `Records.jsx`'s `RecordCards` and
  `prerender.js`'s `recordCards`, from the two functions in
  `queries/records.js`. `smoke.mjs` (*/records*) reads every card's name,
  figure, qualifier, holder, bars and margin in both halves, and the wins
  card against the race records; */records (the record cards)* reads the columns, the
  bars inside their cards from 1440 to 320, and the two fills.

### Figure, and its `lead` variant (core) — built (VD-80); provisional: annotation (VD-121 #1345), the key beside a full-width chart and markers on a column chart (VD-123 #1347), a career's line and markers on the dot plot (VD-124 #1348), the team-mates face-off (VD-122 #1346), the layout over a photograph (AF-96 #977, AF-177 #1393), a constructor's wins with its titles, peak and drought marked (VD-125 #1349), a race's biggest moves labelled on Grid to flag (VD-113 #1335)

**Annotation — provisional (VD-121 #1345).** Decided on the 2026-11-13 visual
critique (`docs/critiques/2026-11-13-visual-design/P09v2.html`): one pattern
for every chart that names its story, built once and shared.

- **A title that states the finding**, generated from the data as a race's
  standfirst is, set over the plot; the h2 stays the figure's name.
- **Markers, not text, on the plot:** a small numbered ink disc with a
  `--panel` ring, so it reads over gridlines, in empty space near its point,
  joined by a hairline leader.
- **Notes in a key:** each a bold short lead and one quieter line. Beside a
  full-width chart from 1180, in two columns from 768, and below the chart
  on a phone and wherever the chart sits beside the header. On a phone the
  text moves below the chart; it never shrinks.
- **Line-end labels in a right-hand gutter:** the name semibold, the value
  quieter, pushed at least 16 px apart with an angled leader where one
  moves, so converging lines never hide a value (Lauda's 68 in 1976,
  Russell's 262 in 2026).
- **Spans as shaded bands**, explained in the key, never brackets with text
  over the marks; tied peaks share one marker. Tied peaks further apart
  than that marker can sit between (more than two seasons, on a
  constructor's wins) each take a disc with the one note's number, which
  the key gives once (VD-125).
- **One to three notes per chart.** Every note is text in the key, so
  nothing lives only in the drawing. Declared: home's *shape of the
  championship* carries four, as its approved mockup (P02v2) does (VD-123),
  and so may a constructor's wins, as P07v2 does (VD-125).

**Built (VD-121), on the season's title race.** `charts/annotate.js` holds
the geometry both renderers share: the gutter as wide as the widest label,
the labels pushed `LABEL_GAP` (16 px) apart about where they wanted to be
(where one line of labels would take more than `GUTTER_SHARE`, three-tenths,
of the chart's width - a phone - each is set name over value and pushed
`STACKED_GAP` (34 px) apart, so the plot keeps its room),
the hairline from each line's end bending only where its label moved, and
a marker's disc (`MARKER`, r 8 with a 3 px `--panel` ring) above its point,
below it where above leaves the drawing or sits on another line, and
further out where it would touch another marker. `charts/lineChart.js`
lays the line chart out with them; `Figure` takes `finding`, `kicker` and
`annotations` and draws the finding and kicker over the frame and the key
(`AnnotationKey`) inside it under the plot, at every width; the static
page's `leadFigure()` writes the same. The finding is set at `--size-6`
semibold and the kicker in the label register at `--size-3`, both in ink
and faint ink; a line-end label is `--size-3`, its name semibold in ink and
its value in `--ink-soft`; a band is `--panel-sunk`. A line chart with
named ends takes no legend.
`titleRaceNotes()` in `queries/season.js` works out the title race's notes
from `standings` and `race_entries`, at most one of each kind: a
contender's longest run of rounds without an entry (a round none of the
three entered, the Indianapolis 500 to 1960, is none; one after a fatal
accident comes first, and says so), a title settled with
rounds to run where the season counted every result, and a title decided
at the last round; `titleFinding()` writes who led and for how long.
`units.mjs` holds the layout and the notes on rows written out;
`smoke.mjs` holds every line named at its end on `/seasons/1976`, each
marker a note in the key, and the finding, labels, markers and key the same
in both halves.

**Built (VD-123), on home's *shape of the championship*.** The first
full-width chart to carry the pattern, and the first column chart.
`Figure`'s `keyBeside` sets the key beside the plot, three page columns
wide, from 1180, in two columns under it from 768, and in one under it on
a phone (`.figure.key-beside` in `app.css`); a chart in a slot keeps its
key under it at every width. `charts/columnChart.js` takes `marks` and
`bands`: a band is shaded the plot's full height from its first column's
step to its last's, and a marker stands over the middle of the columns it
names - one, or a run of tied ones side by side, which share it - placed
by `placeColumnMarkers()` in `charts/annotate.js`: never below its point,
over no column it would cover, and with no hairline through another disc.
Where two would touch (home's 2024-25 and 2026, a few pixels apart on a
phone), the earlier steps aside, level, on an angled hairline, as the
mockup sets it, and the later one rises as far as it must to clear the
earlier one's hairline; a disc a taller neighbour would cover (1950's, on a
narrow chart) rises the same way. The layout lowers the plot until
every disc is inside the drawing. A band's marker has no hairline: it marks
the band, not a point in it. A column may carry `ahead`, what is still to
come, dashed over it the column's width in its own colour: the season being
run is its rounds run, solid, under the rest of its calendar. Dashed, not
outlined as the mockup drew it: an outline on a phone's 2.3 px column is all
stroke, and read as a solid 23. `chartNotes()` in `queries/home.js`
works the finding and the notes out from the rows; `units.mjs` holds the
working and the layout, and `smoke.mjs` the finding, the notes, the
markers and where the key stands at 1440, 1024 and 400, in both halves.

**Built (VD-124), on a driver's career.** The first dot plot to carry the
pattern (`docs/critiques/2026-11-13-visual-design/P05v2.html`). The dots
are joined season to season by a line at 1.5 px and half strength
(`.career-line`), in the one colour every dot shares and in ink where they
differ, broken at a season with no dot or not raced, so the line is the
career's shape and the dots stay the values. The gridlines are P1, P5 and
P10 and the tens past them, never the floor; the axis labels every season,
'19 where only the short form fits, and both ends with round years between
where neither does (IX-50). `charts/dotPlot.js` takes `line`,
`yTickValues`, `everyX` and `marks`; a marker is placed by
`placeDotMarkers()` in `charts/annotate.js` under its dot, in the space a
career's line leaves below its best seasons, as near as it is clear of
every dot, ring, stretch of line, axis label and other disc, over the dot
only where nothing under it is, and aside on an angled hairline only where
nothing straight under or over it is (a title between two low seasons on a
phone). `careerStory()` in `queries/driver.js`
writes the finding (a champion's climb, a count of titles, or the best
final place), the kicker and at most two notes, the first win and the
first title with its margin over the runner-up; a title is a final table's
first place, so the season being run is neither ringed nor a title.
`units.mjs` holds the working and the layout; `smoke.mjs` the finding, the
notes and the markers in both halves.

**Built (VD-125), on a constructor's wins.** The column chart's second
annotated use (`docs/critiques/2026-11-13-visual-design/P07v2.html`).
`winsStory()` in `queries/constructor.js` writes the finding - "The
Alonso years stand above everything else" only where the peak lies inside
one driver's straight titles in the team's car and every season of them
has more wins than any outside them (not Ferrari's, whose Schumacher 2001
and 2003 are no higher than 2006-07 and 2008, though the mockup says so),
the peak's figure otherwise, and how many seasons had a win where the best
is one - the kicker naming the colour drawn, and at most four notes in
axis order: the first drivers' title in the team's car and the same
driver's straight after it; the first run of constructors' titles in a row,
with the champions inside it; the peak, every season tied at it, where the
best is more than one win, with the champions in those seasons; and the longest winless run of two seasons or
more, shaded, "since" where it reaches the season being run. A note is
left out where another on the same seasons says it: the champion's where
it overlaps a run of titles that has its note, or is all at the peak (the
peak's note then names the champion), the run of titles where it is
exactly the seasons under one of the peak's discs. A title is a
final table's first place, drawn as an ink square under its column, a
second cue that is shape (`square`, with `SQUARE_ROOM` under the baseline
for it), and the kicker draws the square and names it. A season of no win
is a dashed stub on the baseline in the column's colour, 2 px, so a
drought reads as seasons entered (`stubs`, which no other column chart
sets: a zero elsewhere is none of a kind, and draws nothing). A drought's marker has `lift`: its disc
starts halfway up the plot, in the empty band, on a hairline down to the
baseline. The axis takes `roundLabels`: the first season, then the
decades, or every five or twenty-five years, as the width leaves 60 px
between them, none nearer the last than 40; where too few years are round
for that, every so many seasons, thinned the same way. The peak is no longer printed
over its first column; `columnChart.js` prints every column tied at the
peak where a chart prints one. The key stands beside a full-width chart
and under one in the slot. `units.mjs` holds the working and Ferrari's
layout at every width; `smoke.mjs` the finding, kicker, notes, markers,
squares, stubs and the key's place in both halves.

**Built (VD-113), on a race's *Grid to flag*.** The pattern's first labels
on the lines, to the approved mockup
(`docs/critiques/2026-11-13-visual-design/P04-race-grid-to-flag.html`,
approved 2026-11-13 as it stands). `gridFlagMoves()` in `queries/race.js`
picks the race's biggest moves, grid number minus finishing place, largest
first whichever way, a gain before a loss of the same size, at most three,
and a tie at the cut left out whole; a car not classified, a pit-lane start
and a shared drive have no move. `gridFlagStory()` writes the finding - the
biggest climb (*Verstappen came from 21st to finish 2nd*), the drivers tied
at it where several are, or the biggest fall where nobody picked climbed -
the kicker, and each move's label: *Hamilton: 20th to 9th*, the finding's
with its count (*up nineteen*), or the three-letter code where the chart
names drivers by theirs (*HAM 20th → 9th*); a surname two drivers the
figure draws share is written in full (*Michael Schumacher*), and the finding's
label is placed before the others'. The field is drawn at 1.2 px,
the moves over it in `--ink` at 2.5 px and the winner in `--series-mark` at
2.5 px, their names at the end semibold. `charts/gridFlag.js` sets each
label in the label register, `--size-3` semibold over a 5 px `--panel` halo,
on the side its own line leaves clear, inside the plot, clear of the other
labels and of every marked line, or not at all; the line stays heavy and
the drawing's accessible name says every move. Declared against the
mockup and the pattern: the labels stand on the lines, not in a key, as the
approved mockup sets them, and the table and the accessible name carry
every value, so nothing lives only in the drawing; the field stays in
`--series-ink`, where the mockup's `--rule-strong` is 1.5:1 on the panel and
under §7's 3:1 for a chart series; places are ordinals in digits, as a
race's standfirst writes them, not the mockup's *second*; and the winner's
own label (*Norris: pole to win*) is not drawn, the issue naming the three
moves and the pattern one to three notes. `units.mjs` holds the picks, the
words and the labels' places; `smoke.mjs` the moves, the finding, the
kicker and the labels in both halves, and the labels apart and inside the
drawing on a phone.

- **Job:** make one comparison visible.
- **Parts:** the section's **h2 is the figure's name**, with no second bold
  title: `Figure` takes no `title`, and reads the heading as its accessible
  name, as a table reads its caption. Then the plot, then its legend. Then
  the **method note under the plot, on every figure**, in a band inside the
  frame (the text-width rule, kind 2), and named as the figure's
  description. The note is cut to what stops a misreading, 50 words at most
  (content C1). Last, *The numbers behind this chart*, worded the same
  everywhere; what the table holds and the plot does not draw (an entry
  with no line) is said under the table, not in the note.
- **A figure its section's h2 cannot name** (two in one section, as the
  Records leaderboards and the chassis chart on `/data/quality`; one whose
  h2 names its section rather than what it measures, as the constructors'
  wins and the decade the chips chose on `/records`) sits in a
  `FigurePart`, whose h3 names it and its table.
- **Colour** (VD-94, `[D-61]`; `charts/palette.js` holds the order and the
  validator's numbers):
  1. A series that belongs to a team or a driver wears its sourced colour,
     the livery from 2010 or the racing colour before 1968, as the pair
     `charts/own.js` writes.
  2. A chart with one series and no such colour is drawn in `--series-ink`,
     and the one value its page states in `--series-mark`, with that value
     or its name printed on or beside the mark: the home chart's latest season
     raced (its value in the key, under the numbered marker beside it, VD-123),
     a record's holder on `/records`, a race's winner
     in *Grid to flag*. A chart whose page states no one value has no
     accented mark. A chart in liveries takes no accent.
  3. Several series with no sourced colour, or colours that cannot be told
     apart, take `--series-1..3`.
  A mark that is not a measurement of the same kind as the rest, such as a
  calendar among results, is hollow: outlined in ink, unfilled.
- **Widths:** the slot (5 columns) for the lead figure, the full width
  otherwise.
- **States:** a figure with nothing to draw says so in one sentence in its
  place, and does not leave an empty frame.
- **Accessibility:**
  - Series are never colour alone; a second cue (shape, ring, label) carries
    the meaning (**floor** for 1.4.1).
  - A ring that flags a mark (a title on a driver's chart) is drawn at full
    strength and at least 2 px wide, so the series colour's 3:1 is what
    reaches the screen (**floor** for 1.4.11; DP-33, held by
    `conventions.mjs`).
  - The hover box also opens on focus (**aim**, held by test): each chart
    that opens one - the dot plot, the column chart, the line chart - is one
    tab stop whose arrow keys step from mark to mark, with Home and End and
    Escape, and says what it reads in a status region
    (`charts/useChartKeys.js`; CR-74, AX-32 #881). IX-44 #844 is the
    containment half.
  - A hover target is at least 6 px wide at every width (**aim**; the 1180
    switch and §7's minimum mark width hold it).

**The team-mates face-off** (provisional, VD-122 #1346). Decided on the
2026-11-13 visual critique (`docs/critiques/2026-11-13-visual-design/P06v2.html`,
approved 2026-11-14): a driver's Team-mates section opens with who was
ahead of whom, before the table that holds every pairing.
`faceOffs()` in `queries/driver.js` sums the table's own `TEAM_MATES` rows
and writes every sentence; `charts/FaceOff.jsx` draws it and the static
page's `faceOffHtml()` writes the same markup.

- **Parts:** a headline in the display face, generated, about the latest
  team-mate (*Norris out-qualified Piastri 61–29*: who led in qualifying,
  or on finishes where qualifying is not established, or on points), the
  figure in tabular ink; a standfirst in the section-intro voice; then one
  block per team-mate shown, each the two surnames at either end over 4 px
  rules in their colours with a generated line between them saying who was
  ahead on what, three split tallies (qualifying, race when both
  classified, points) and each season as a small split; last, a key in
  faint prose saying what the colours and the figures are.
- **How many:** three blocks shown (`FACE_OFFS`): the latest team-mate,
  and the two others with the most Grands Prix together, set latest first.
  Every other team-mate's block is under them, latest first, behind one
  closed disclosure (`.face-fold`, VD-130 #1370, ruled 2026-11-17) whose
  faces are a fold's, *Show all 106 team-mates* and *Show the first 3*,
  counting what the section's heading counts; so a career of 106 team-mates
  opens on three blocks, and the key says where the rest are. Both halves
  write every block, as a fold writes every row, and a disclosure opened on
  the static page stays open at the handover. That costs Brabham's static
  page 103 blocks, some 270 KB of HTML but 6 KB gzipped, and the 488
  driver pages with more than three team-mates about 13.6 MB raw and
  440 KB gzipped together, under 6 % of every driver page's gzipped total
  (measured on the PR).
- **A tally:** a bar split at the driver's share of the two figures, the
  driver from the left, with a tick in ink at the middle where level would
  meet. The leading figure is `--size-9` in ink and the other `--size-7` in
  `--ink-faint`; level, neither leads. Qualifying with no race both have a
  position in is an em dash and draws no bar, a race count with no race both
  were classified in reads *none*, as the table's cells do, and a 0–0 in
  points is a level with no bar to split.
- **Type:** names in the display face at `--size-8`, `--size-10` from 768,
  in sentence case (`[D-66]`: capitals for the page title alone, so the
  mockup's capitals are not built).
- **Colour:** `[D-65]` above, the block's last season's team, as
  `charts/own.js` `faceColours()` writes it. No accent anywhere (`[D-61]`).
- **Second cue:** both figures are printed beside every bar and the names
  beside every rule, so colour is never the only cue (1.4.1). The bars are
  hidden from assistive technology, each printed figure following its
  driver's name in sr-only text; the per-season splits are hidden too, the
  table under them holding every season's figures under its own headers.
  A pairing at two teams in one season is one split, summed.
- **Phone:** the line between the names drops to a row under them, the
  tallies stack, and each season's small split sets its figures over its
  bar.

**The reach chart** (provisional, AF-132). A figure for one question: who
can still catch the leader. One row per contender: a solid bar from nought
to the points scored, then an outlined extension of it to the most they
could still reach under the season's own scoring, then the two figures
beside it in words (*340 → 490*, and *, out* where the extension stops
short). One dashed vertical line in ink across every row is the leader's
total, named at its head. `charts/reachChart.js` lays it out for both
renderers; `reachFigure()` in `queries/season.js` chooses the rows (those
still in, at most `TITLE_LIST_LIMIT`, and the highest placed of those out).
Names sit in BarChart's 168 px column beside the bars from a 480 px plot,
and above each bar from its left edge below that, where the leader's line
is drawn beside the bars only, so a long name is never cut at the edge and
the line never runs through one.

- **Colour:** rule 1 above where every bar has a sourced colour, as the
  title race takes it; ink otherwise, and no accent. The extension is the
  bar's own colour, outlined 2 px at full strength over a pale fill, so the
  outline carries the 3:1 (DP-33) and the fill carries nothing.
- **Second cue:** the figures beside every bar say who is out in words, so
  neither the line nor the colour is the only cue (1.4.1).
- **Placement:** two in one section, *Who can still win*, each a
  `FigurePart` named for its title, side by side in `.split`; its numbers
  are a table, as every figure's are.

**The clinch strip** (provisional, AF-138 #1144). A figure for the question
the reach chart cannot answer: which finishes at the next round would settle
the drivers' title. One strip for each place the leader could take that can
settle it, best first, each a `FigurePart` named for that finish (*If Andrea
Kimi Antonelli wins the United States Grand Prix*). In a strip, one row per
rival still in, named in a 120 px column (76 px below 480 px), wider where
a name needs it but never so wide a cell drops below 14 px, past which the
name is cut with an ellipsis and the table has it whole, and one
cell per place that rival could take: every place the season's scale pays,
numbered over its column, then *0 pts* (*0* below 480 px, where the axis
title says what it is), set 8 px apart so that *10* and *0* never read as
one number. `clinchStrips()` in
`queries/season.js` works out the strips and words the table;
`charts/clinchStrip.js` lays them out for both renderers. A cell is at most
36 px wide, so at 320 px eleven still fit beside the names, and a strip is
drawn only where every row can land on the title settled.

- **Marks:** each cell is one of three, and says so twice. *Champion*: a
  `--good-wash` cell outlined in `--good`, with a tick. *Level on points*,
  the countback deciding: `--warn-wash` outlined in `--warn`, with an
  equals sign. *The title goes on*: `--panel-sunk` outlined in
  `--series-ink`, with an arrow. The leader's own place has no cell, only a
  dash in `--ink-faint`. The outline and the symbol carry the 3:1 (DP-33);
  the wash carries nothing.
- **Second cue:** the symbols, so colour is never the only one (1.4.1); and
  the table under the figure, which says every cell in words, who the
  countback goes to included.
- **Not drawn:** a round at which the title cannot be settled; a sprint
  weekend, which has two results, or a season paying a point for the
  fastest lap, either of which turns on more than one place: there, where
  the round could settle it, one sentence in a following note says so and
  why it is not drawn. A team's
  title is two cars' finishes, and is not drawn.
- **Placement:** on a season being run, after the reach charts in *Who can
  still win*; on the upcoming race's page, in *What's at stake* under the
  answer and its basis. The static page draws the same SVG at 640 px.

**The starting grid, the dot strip and the winners' chips** (provisional,
AF-133). One question asked of a circuit: where its winners started.
`charts/gridStarts.js` lays out both drawings for both renderers;
`winnerStarts()` and the functions beside it in `queries/circuit.js` choose
and word everything else.

- **The starting grid** (from 768 px): grid boxes in two lanes, the even
  slots set half a box back, front at the left, each numbered outside its
  box: nine rows at the least (`GRID_MIN_SLOTS`, VD-116 #1338), 676 px,
  the most that draw at their natural size in the 698 px plot the grid
  first shows in at 768, and as far as the furthest slot won from where
  that is further back, always a whole row. A circuit of a few races drew
  its last winner's row and stopped, so Las Vegas's three on home were
  100 px of a 1,232 px frame. One dot
  per race won from a box, oldest first, four across and two down; a box of
  more than eight (`STARTS_CAP`) holds its count in `.value-text` instead.
  The boxes stand two abreast whatever the year, and the note says so,
  because the database does not record how each grid was formed.
- **The dot strip** (below 768 px): the grid's phone form, not a second
  chart. One column per slot, as far as the furthest slot won from and no
  minimum, so a phone's box is not filled with empty columns; numbered under
  a baseline, the dots stacked up
  from it; a count stands over a pale bar outlined in `--series-ink`. Both
  drawings are in the markup and `app.css` shows one, so the static page is
  the app's at every width and nothing moves at the handover; each keeps its
  natural size and scales down to its box.
- **The chips:** one per race, by decade, oldest first, each a decade label
  in tabular figures beside a wrapping row: the livery mark (the `LiveryMark`
  element, beside the name it belongs to), the year as a link to the race,
  the team, and the grid slot in bold. A hairline in `--rule` on the panel,
  so the colour is the mark's and never the chip's ground.
- **Colour:** rule 1 above for the dots, as the pair `charts/own.js`
  writes; a team with no colour on record is a hollow dot outlined in
  `--series-ink`, never a guessed fill. No accent.
- **Second cue:** the team is named on every chip, and on every dot in its
  tooltip; the table under the figure names every race, so colour is never
  the only cue (1.4.1).
- **Not a slot:** a pit-lane start, a slot nobody recorded and a shared
  drive (whose drivers each have their own slot, and the car's is not
  recorded) are never a box or a zero. They are rows of the table, words on
  a chip, and one line of the figures above.
- **Placement:** a section of its own, *Where winners start here*, on every
  circuit page with a race run: a line saying how many races and layouts it
  counts, the figures as `Fields`, the figure, then *Race by race* (h3) and
  the chips. `components/WinnerStarts.jsx` draws it in the app and
  `startsBlock()` in `prerender.js`, both from `historyBlock()`.
- **Which races it counts** (provisional, AF-139): *All layouts* or *This
  layout*, the reader's choice, as `Chips` in a `.filters` row between the line and the figures. *This layout* is
  the timeline row (`circuit_layouts`) the reference race was run on, read
  as `LAYOUT_RACED_JOIN` reads a race's: the one-off the race names, or else
  the by-year row whose seasons hold it. On a circuit page the reference is
  the latest race won there; on a race's page it is the race. The choice is
  in the address, `?history=layout`, absent for *All layouts*, written by
  replacing and not pushing (§6), so Back restores it. The switch is offered
  only where it changes the count, so a circuit with no timeline, or whose
  reference layout holds every race won there or none, has none. Over one
  layout, the line names it and its years and how many races every layout
  holds; the figures, the comparison at every circuit over the seasons
  those races span, and *most wins* are all of those races. The static page
  counts every layout and has no switch, which arrives with the app, as
  `/records`' decade chips do.
- **On the upcoming race's page** (provisional, AF-139): the same block for
  the circuit the race is held at, headed *What history says*, after the
  timetable and *What's at stake*, on the next round to run (the first still `scheduled`) until
  its results land. Its line says *won at* the circuit rather than *here*.
- **On a Grand Prix's page** (provisional, AF-139): the same block counted
  by the event across every venue it has used, headed *Where this Grand
  Prix's winners start*, after *Most wins*, its line saying how many
  circuits the count spans and that it is not by circuit. It has no switch:
  its races are at several venues, so no one layout is the event's.

**The stint figure and its pit wave** (provisional, AF-134; the bars are
PD-56's). One question asked of a race: when the field stopped.
`charts/stints.js` lays out both parts for both renderers on one lap axis;
`queries/race.js` words the note, the label and the empty state.

- **The pit wave:** a strip above the bars, one thin column per lap with a
  stop recorded, its height the stops on that lap across the field (every
  stop recorded for the race, a car with no lap count included), on a
  hairline base. No y axis: the strip's name, drawn above it from where the bars start
  (moved left over the label column where it would run past the edge),
  gives the tallest column's count (*Stops on each lap (up to 4)*). A column is
  three-fifths of a lap wide, at least 1 px and never wider than a bar is
  tall, and at least 2 px high.
- **The bars:** one per driver who started with a lap count, in finishing
  order, from lap 0 to the last lap completed, broken with an ink tick at
  each stop; a car not classified ends on grid to flag's cross.
- **A stint's label** (VD-103): its laps under its bar, centred, in the
  label register at the axis's size and ink (Saira 500, `--size-2`,
  `--ink-faint`) — *1–18*, then *19–41*, a stint
  of one lap by that lap — drawn only where they fit inside its length, and
  its number and laps as its tooltip, *Stint 2: laps 19–41*.
- **Colour:** rule 2 above, every stint and every column in
  `--series-ink`; no accent, since the page states no one value of it, and
  no second shade or hue between stints, which would read as a tyre
  compound the record does not hold. A stint is told from the next by the
  break, the tick and its label, which are shape and words, not colour
  (1.4.1); the maintainer kept the one ink on VD-103.
- **What it may say:** the lap of each stop, and (AF-141) its pit-lane time,
  which only a tick's tooltip and the table print: no mark's size or place
  measures it, and the footer under the table says it is all of the stop's
  time in the pit lane, any wait or repair there included. Nothing in the
  figure, its note or its label gives a stop's tyre or cause (no safety car:
  `race_control_messages` stays empty), or what it gained.
- **A tick's tooltip** (AF-141): a native `<title>`, *Lap 34: pit lane 22.4 s*,
  on a target that draws nothing, 6 px wide and as tall as the tick. It opens
  on hover alone, like every native title, so nothing lives only there.
- **Second cue:** the table under the figure gives every driver's stop laps
  and each stop's pit-lane time, an em dash where none is recorded, from
  which every column and tooltip follows; the drawing's accessible name gives
  the most stops on one lap and every lap that holds them.
- **States:** a race before the first season with a stop recorded, one with
  none, and one whose stops have not arrived each say so in one sentence in
  the section's place (§3, Figure, *States*).
- **Placement:** its own section, *Pit stops*, below the classification and
  qualifying; who stopped first between neighbours follows under an h3.

**The layout over a photograph — provisional (AF-96 #977, AF-177 #1393).**
F1DB's outline of a circuit's layout drawn over its aerial photograph, so a
reader sees the layout on the ground it runs over. It was the OpenStreetMap
centreline until AF-177 (ruled on AF-174 #1387), in the same casing and line
style.

- **Where:** inside the photograph's own figure, in the header's slot for it
  (VD-62). It displaces nothing: the outline still leads the opening slot
  (VD-74, VD-84), and a photograph with no placing is drawn exactly as
  before.
- **Parts:** `CommonsImage`'s `trace`, from `photoOutline()` in
  `lib/outline.js`, which `photograph()` in `scripts/prerender.js` draws too:
  `.photo-frame` round the picture, and an `aria-hidden` `svg.photo-trace`
  over it whose viewBox is the photograph's stored frame, fitted as
  `object-fit: contain` fits the pixels, and the outline's path under the
  placing's `transform`, so the line holds at any width and inside the
  header's capped height.
- **Ink:** `--photo-trace` at 2 px over `--photo-trace-casing` at 4 px, both
  at a constant stroke, so the line reads on the pale concrete and the dark
  woods of one picture.
- **Credit:** the drawing is F1DB's, CC BY 4.0, so the caption says
  *Layout drawn over the photograph: F1DB, CC BY 4.0, drawn by Jules Roy,
  placed by eye* (`PHOTO_OUTLINE_BY`) after the photograph's own credit. The
  one attribution rule still decides whether the figure is drawn at all.
- **Second cue:** the alt says the layout is drawn over the picture from
  F1DB's outline (`photographAlt` in `queries/circuit.js`); the line is
  decoration to it.
- **What it may claim:** that the layout runs there, to within the tolerance
  the build holds each placing to (`PHOTO_OUTLINE_TOLERANCE_PX` in
  `data/harvest.py`), and nothing about the photograph: the outline is a
  drawing of the layout, not a survey of the tarmac, and the placing is this
  project's own, at no more than *medium*.
- **States:** the line is drawn only over a photograph that has arrived:
  hidden while it loads, so it never stands alone in the empty box, and
  gone with it when it fails.

### Table (core) — built (VD-82, AX-21, VD-84, VD-89, VD-86, VD-98), and a table that fits its box (IX-45 #848; core on its second page, the season calendar, VD-116 #1338); provisional: the reference density (VD-95 #925), column groups and a picture in a row at the reference density (VD-106 #1248), and a value bar and the leader in the row (VD-110 #1332, VD-105 #1247)

- **Job:** every row, sortable, copyable.
- **Parts:**
  - a caption or an h2 that names it (**floor**, AX-21);
  - sticky column heads (VD-89): under the masthead on a table that fits
    its box, which DataTable marks `data-fits` and whose scroller then goes,
    so the page holds them; at the top of the box on a figure's numbers,
    which scroll in a box of their own. **A table wider than its box has
    no sticky heads** (VD-98, `[D-57]`): it keeps its scroller, a scroll
    container in both axes that never moves vertically, and each way of
    holding the heads anyway cost a nested scroller or a script. What a
    phone reader loses by it is VD-99 (#972). `smoke.mjs` (*Sticky column
    heads*) holds all three;
  - a footer band holding the source line on the left and *Copy* and *CSV*
    on the right; the static page's band holds the line alone, as the two
    buttons need a script (VD-86);
  - under the band, where a column is derived at query time, a closed
    *How it is derived* disclosure (`.table-how`) holding the method in a
    sentence, named for what it explains and, for a screen reader, for its
    table: *How it is derived: distance, Practice 2*. **Provisional**
    (AF-131): the race page's session sheets and their *≈ Distance* column
    are its first user. The derived column is its own column, never a second
    line in another's cell, so it sorts and copies as one value;
  - the **fold**.
- **The fold is the one reveal control.** It applies to any table over 25
  rows (`FOLD_OVER`) unless the table opts out with a reason. Its button
  names its noun from `FOLD_NOUN`: *Show all 74 team-mate seasons*. It
  replaced the paged *Show the remaining 144* on `/records`.
  - **The reasons are one list,** `UNFOLDED` in `lib/table.js`, given as
    DataTable's `unfolded` and prerender's option of the same name: a
    register (the page is the table, and it opens on a page of rows), the
    page's subject (a race's results, a season's calendar and standings), a
    reference list, a table that stands for a drawing (a chart's numbers),
    and the console's result. *Show the remaining N* survives only on a
    table that has opted out.
  - **A table over the threshold that does neither is refused** (§8, test
    12): `prerender.js` stops the build on any route it writes, and
    DataTable logs the error the smoke suite fails on.
- **Sort buttons show focus** (**floor**, 2.4.7), inside the header, as do
  `/data/sql`'s examples (AX-31 #863).
- **Column heads** are the label register (§2 *Type*, VD-91): `--size-3`,
  Saira 500, sentence case, untracked, and a figure column's cells are
  Saira's tabular figures.
- **Opening the fold moves focus to the first revealed row** (row 11's row
  header, `tabindex="-1"`), so a keyboard user is not left 13,000 px below
  the rows (**aim**).
- **A disclosure's name says what it opens:** *How it is derived: most
  wins*, not the same four words twelve times (**aim**).
- **Sort and fold live in the address,** keyed by table name, the contract
  the registers already keep (IA-08): `?every-entry.sort=year&every-entry.dir=desc&every-entry.all=1`,
  written by replacing the history entry, never pushing one. Back restores
  both, and with them the reader's place (interaction I2, IX-46 #849). A
  register keeps its bare `?sort=` and `?all=1`; a chart's numbers and the
  console's result keep nothing there (`remember={false}`). A fold opened
  on the static page before the database arrives stays open without being
  written down, as a seeded register's rows are: the address is written by
  the reader's hand, never by the handover.
- **Widths:** the full content width. A table never sits beside a side
  column that clips it.
- **The reference density** (provisional, VD-95 #925, DR-07). A body row
  is two tokens, `--row-pad` above and below its cells and `--row-leading`
  for its line. Below `--bp-desktop` they are the reading row the tables
  always had, `--space-4` on the body's 1.6, about 38.6 px with its rule;
  from it they close up to `--space-2` on 1.15, about 24.5 px, where the
  reference sites the design review studied run near 21 (Basketball-Reference).
  It is the default, not a reader's toggle, and it reaches every table,
  since both renderers share the stylesheet. Three things hold under it:
  - **A row's pitch is never under 24 px**, top to next top: a link in a
    row is a target, and the links of two rows keep 24 px between their
    centres, which is WCAG 2.5.8's spacing exception (§7). `conventions.mjs`
    reads the pitch off the tokens; the heads, the fold and the glossary key
    keep their own sizes.
  - **A cell that wraps keeps the reading leading**, `--row-leading-wrap`,
    and gives the difference back out of its padding, so a one-line prose
    cell is its row's height and sits on its neighbours' baseline.
  - **The result rail fills its row** at either density, and from 1180 a
    tag or a pill in a row takes its padding above and below back out of
    the line by a negative margin, so it draws as before, a pill keeps its
    size as a link, and a classification row is about a pixel over its
    table's others, as below 1180.

  `smoke.mjs` (*Dense rows from 1180 px*) reads a register, a
  classification, a driver's seasons and a season's standings at 1440 and
  1,024 in both halves. DR-07's other half, the leader marked inside the
  table, is *a value bar, and the leader in the row* below (VD-105 #1247).
- **Column groups** (provisional, VD-106 #1248, DR-07). A wide reference
  table names which of its figures belong together in a row of heads above
  the column heads: a label over each run of neighbouring columns that share
  one, centred, with a `--rule` under it that stops `--space-2` short of
  each side so two groups side by side read as two, and an empty cell over a
  run with none. A column declares `group` in its queries module and both
  renderers write the row from `groupRuns()` in `lib/table.js`, over the
  columns drawn, so a group whose columns all collapsed (VD-29) goes with
  them. Each run is a `<colgroup>` and each label a `<th scope="colgroup">`.
  The label register, set closer than the heads under it. **It is not held
  under the masthead**: the column heads are, as before, and the groups
  scroll away with the top of the table. Not with a phone set, which hides
  columns by a class a span cannot follow; both renderers refuse the pair
  and `conventions.mjs` holds every column list to it, and to one run a
  label. The season-by-season tables of a driver and a constructor are the
  first users, in a weekend's order: *Qualifying* (Poles), *Races* (Wins
  to *By round*), then the championship. `smoke.mjs` (*Season by season:
  column groups and the rounds*) compares the groups, their spans and their
  `<colgroup>`s across the halves.
- **A picture in a row at the reference density** (provisional, VD-106
  #1248). The registers draw a small multiple per row at 24 px (VD-54); at
  the reference density that would take a row from 24.5 px to 33, so a
  season-by-season table's *By round* is `ROW_SPARK_HEIGHT`, 14 px, inside
  the line at either density, by `BY_ROUND_WIDTH`, 72 px, both named in
  `charts/spark.js`. A bar for each round classified, on the season's own
  calendar and one scale for every season - tallest for a win, shortest for
  20th and below - a tick (`.spark-miss`, `--ink-soft`) for a round entered
  and not classified, and nothing for a round not entered, on a `--grid`
  line the season's length. Its words are the cell's text and the picture's
  `<title>`: every round entered and its place or the source's code. The
  table's source line says how to read it. `smoke.mjs` counts each season's
  bars and ticks in both halves against the database.
- **A table that fits its box** (core, IX-45 #848; promoted by its second
  page, VD-116 #1338). A table that is
  its page's subject, and has to be read whole, fits its content box from
  `--bp-tablet` rather than scrolling behind the fade. Its columns of words
  carry `.wraps` (a column's `cellClass`, so both renderers write it), and
  from 768 px those cells may break at a space, which the auto layout does
  only where the row would not otherwise fit, and at the reference density
  such a cell keeps the reading leading, as any cell that wraps does
  (VD-95); from 768 to 1,180 px every cell of
  the table also pads `--space-3` a side, not `--space-6`. A figure never wraps,
  and below `--bp-tablet` the rows keep to one line and the table scrolls,
  as every other does on a phone. The race classification was the first
  user: its ten columns were about 960 px at one line, and Points and FL
  scrolled out from 768 to 1,010 px. AF-157's Time made it eleven, and the
  races the smoke suite reads it on still fit at 768. When the rule landed it fitted every
  classification held from 780 px, and all but two at 768: the 1950 and
  1951 Indianapolis 500, where a car named *Championship Racer* leaves the
  table 12 px over below 780. The qualifying and sprint qualifying sheets
  are the second (IX-48 #907): a sheet is read for its times, gap and
  interval, which are its right-hand columns, and at 768 both ran 112 px
  past their box on /races/2024/21. Their Driver and Constructor carry
  `.wraps`. At 768 every sheet then fitted in the static page, read for
  each season from 2006 and every fourth before it, and in the app on
  seven races chosen to stretch it. A qualifying sheet that also carries a derived
  column (AF-131: *≈ Distance*, marked by its `derived` class) is about
  97 px wider, and at 768 all but 2 of the 441 sheets from 2006 then ran
  over, by up to 54 px, so between the breakpoints its heads may also
  break at a space and its cells pad `--space-2` a side. Every qualifying
  and sprint qualifying sheet from 2006, and every fourth season's before,
  then fitted at 768 in the static page. The sprint's classification and the practice
  sheets are not yet held to it (IX-49 #944); the practice sheets carry
  the derived column too, keep one line, and since it some run over at
  900 as well as at 768. The season calendar is the second page (VD-116):
  at one line its eight columns were about 1,285 px for 2026, 55 px past
  the box at 1440, so *Fastest lap* was clipped behind the fade on a
  desktop. Its Grand Prix, Circuit, Winner, Constructor, Pole and Fastest
  lap carry `.wraps`; the round and the dates do not. Every season's
  calendar, 1950 to 2026, then fitted in the static page at 768, 1,024,
  1,180 and 1,440. At 1440 four seasons still wrap, 1953, 1954, 1960 and
  2026, and in each of them most rows do, not a few names: the auto layout
  narrows every column of words, so 2026 has 16 of its 23 rows on two
  lines, 1954 all 9, 1953 6 of 9 and 1960 7 of 10, at 46 px a row against
  24.5. What it costs: a long name takes two lines where the table needs
  the room, so the table is taller. `smoke.mjs` reads three races at 768, 900 and 1,024
  in both halves, their classification and qualifying sheets, and three
  seasons' calendars at those widths and 1,440 (*the classification, the
  qualifying sheets and the calendar fit their box*).

- **A value bar, and the leader in the row** (provisional, VD-110 #1332
  and VD-105 #1247). Decided on the 2026-11-13 visual critique
  (`docs/critiques/2026-11-13-visual-design/P10-season-standings-designed.html`).
  A season's two standings tables are the first users, each at the full
  width, one above the other, as the static page always drew them: the
  bars need the room, and side by side the drivers' Points column had
  room for little more than its figures.
  - **The leader in the row.** A table marks its leader in the row itself,
    never in a card above it: an ink rule above the row and below it, and
    the row's words semibold in ink (`tr.is-leader`, lib/table.js's
    `LEADER`). A column list's page passes a predicate from its queries
    module - DataTable's `leader`, prerender's option of the same name - so
    both halves mark the same rows. A standings table ranks by position, so
    its leader is every row at P1: a place shared at the top marks both
    rows, never the first one sorted, and a level total split on countback
    marks the row the source placed first. It belongs to the row, not to
    where the row sorts to.
  - **The champion's pill.** The leader whose id is the season's recorded
    champion carries a hairline pill in ink beside the name, *champion*,
    and, in a season still running, *champion · settled R19* where the
    title was clinched with rounds to run and the arithmetic names the
    round (`championPill`); a season that has ended reads *champion*. A leader
    not yet champion has the row's mark and no pill. Below 768 px it takes
    a line of its own under the name.
  - **The value bar.** The subject column (a season's Points, `has-bar`)
    carries its figure and a bar beside it, the figure's share of the
    leader's total, the highest a classified row holds, held to 0 to 1
    (`pointsShare`), the leader's bar four fifths of the cell. The bar is
    in the row's colour worn as a chart series wears it (`.livery-series`,
    the pair held to 3:1), or in ink where none is on record (D-61: a table
    in liveries takes no accent). The mark stays beside the name. The figure
    is the cell's whole text and always printed, so the bar is never the
    only cue and the table still copies as data; the table's source line
    says how to read the bar. Below 768 px Wins goes (the phone set) and the
    bar stacks under its figure; the table still scrolls there, as every
    table does.

  `smoke.mjs` (*the leader in the row and a bar in the points, in both
  halves*) reads 2026, 1997 and 1958 at 1440 and 375 in both halves: the
  rows marked against the database's P1, a bar for each total held with
  the same shares, the pill on the champion's row, the colours or ink, and
  Wins and the stacking on a phone.

### Notes, attached notes and the disagreement box (core) — built (VD-78, VD-86); provisional: a race's box folded under the classification, with its pointer (VD-131 #1399); provisional: the box heading's role (VD-119 #1341, §2 *Type*)

| Block | Kind (text rule) | Frame |
|---|---|---|
| Section intro | free prose | none |
| Source line, "same on every row" | belongs to a box | footer band of its table or figure |
| Note box | framed | 3 px left edge; the box and its lines end together at the measure |
| Disagreement ("Two sources disagree") | framed | 1 px frame, 3 px left edge, spans the column; placed directly above the table it explains, as the shared-drive box already is, but on a race page (below) |
| Pointer to a folded disagreement | free prose | none; a note attached to the table under it, on one line at 1440 |

**A race's box, folded** (provisional, VD-131 #1399, `[D-67]`). On a race
page the box follows the classification, closed to its heading: a
`<details>` inside the aside, its h2 the summary, set inline beside the
disclosure's marker, so the closed box is one line in its frame at 1440
(a long heading wraps at a phone's width). The open
box is the box as it stands. Above the classification, and above the
shared-drive note where there is one, a line in the prose voice at
`--size-4` gives the box's own heading, so the two counts are one string,
and links to the box (*Two sources disagree about this race, in 4 places:
see below the table.*); following it in the app opens the box. The line
takes the section gap above it and `--space-5` over the table, or over the
shared-drive note where one stands between. An h2 inside a summary is
flattened into the disclosure's name by some screen readers. VD-119 set
only the heading's type: the element is still an h2, and that question is
where VD-131 left it. A reader
who opened the box on the static page finds it open at the handover
(`lib/handover.js`). Driver, constructor and car pages keep the box open
above what it concerns.

**A row mark** (provisional, DA-46 #911). Where one row of a table needs a
reason the columns cannot give, its row-header cell carries a mark after
the name (`*` for a classification row's note, `†` for a practice-only
driver on a session sheet). The mark is `aria-hidden` and spoken by
`.sr-only` words instead, and the reason is a sentence in the table's own
footer band, naming the row, so it is text that belongs to a box (kind 2).
The mark is in the column's `text` too, so both renderers and a copied file
carry it.

### Photo strip (core) — built: the place (VD-83) and the columns (VD-86)

- **Job:** what something looked like, credited.
- **Parts:** photo cards on column multiples: 4 to a row from 1180, 2 from
  768, 1 below, in both halves. That removed the 5 + 1 orphan auto-fill
  drew at 1440; `smoke.mjs` (*The photo strip*) counts the first row at
  six widths, either side of each breakpoint. Each photograph is
  credited through `CommonsCredit` and **fails closed**: no attribution, no
  image (**floor**, the one attribution rule).
- **Place:** after the page's own sections and straight before *Where this
  comes from*, on every page type. They sat in five places until VD-83;
  `smoke.mjs` holds the place in both halves (§8, test 13).

### Outline card (core) — built: the timeline card's heading (AX-26 #509); provisional: the race thumbnail and the circuits won at (VD-104 #1239); pending: the caption (CD-62 #1041)

- **Parts:** the drawing on `--stage`, then a **heading or caption in words**:
  *Current layout, raced since 2010 · 5.891 km, 18 turns · outline: F1DB (CC
  BY 4.0), drawn by Jules Roy*. This replaces the schema line *F1DB layout
  silverstone-8 · …*, and the OpenStreetMap sentence appears only where a
  trace is drawn (content C10; CD-62 #1041).
- **Rule, not box** (built, VD-93): the card has no frame. The drawing's
  `--stage` is its ground, the words sit under it on the paper, and the
  gap between cards sets one off from the next. AX-26 landed first, so this
  is the reading DR-04 asked of it.
- **A timeline card's heading** (built, AX-26): on a circuit's *Every layout
  raced here*, the `h3` is the layout's name and nothing else — or, for a
  drawing no row names, the words saying so and its years, so that no two
  such cards are headed alike. Its facts —
  years, the register's length, the confidence pill — are a `<dl
  class="layout-facts">` under it, each label beside its value and the
  pairs in a row that wraps, an unheld length the em dash. A link or a run of figures
  inside a heading reads as one string with no separators, and the pill's
  link repeats once per card. `lib/outline.js`'s `layoutFacts` gives both
  renderers the list; `smoke.mjs` holds the heading and the list in both
  halves.
- **The race thumbnail** (provisional, VD-104 #1239 (a)). A race linked as
  a card of its own is drawn by its outline: the season strip's rounds
  (AF-03), and an onward card that links a race — a race's next one, a
  circuit's or a Grand Prix's latest, a car's notable race, `/changes`'
  latest — with the drawing in a `--space-10` box beside the card's label
  and hint, decorative, since the label names the race. The band credits
  the drawing once under its cards (`ONWARD_OUTLINE_NOTE`), as the strip
  does, and a band with none prints no credit. A race named in a table's
  row, a circuit's winning chips or the stepper keeps its name alone: a
  drawing a row tall says nothing the name does not, and the static page
  would carry the path once per row (some 1.4 kB each). Whether those take
  one too is the maintainer's question, not this rule's, and is filed on
  the queue. A record page's strip of its races (VD-112 #1334) is this
  thumbnail.
- **Small multiples: the circuits a driver won at** (provisional, VD-104
  #1239 (b)). On a driver's page with a win, a section *Circuits won at*: a
  grid of cards, one per circuit, in the strip's box and ink — the drawing
  (decorative, the layout of the latest win there that F1DB draws), the
  circuit's name as a link, the count, and each win's year as a link to its
  race with the race's name read with it. Most wins first, a tie to the
  circuit won at last; under the grid, once, the drawing rule, the scale
  caveat and the credit (`WON_AT_NOTE`). The years' lines are 24 px. A
  driver who never won has no section. `wonAt` in `lib/outline.js` lays it
  out for both renderers; `units.mjs` holds the grouping and the order, and
  `smoke.mjs` the cards and race links against the database in both halves.

### Provenance and citation (core) — built: the name (VD-81), the citation on race, driver, constructor, circuit, car, Grand Prix and season pages (CD-08, CD-46); pending: the citation on a record's page (CD-63 #1046)

- **One name, *Where this comes from*,** on every page type, from
  `LABELS.provenance` in both renderers. It had three names, and "On the
  record" collided with `/records` (VD-81).
- **The citation** carries the *Behind this page* sentence on a page about
  one thing - a race, a driver, a constructor, a circuit, a car, a Grand Prix,
  a season, and once CD-63 lands a record: the registry entries the page's
  rows resolve to, each with its terms, from the page's own `*_SOURCES` query
  (CD-08, CD-46). It is a framed note under the text rule.

### Keep going, and On this page

- ***Keep going* (core) — built:** It is the best cross-page structure on
  the site (service). Its routes are words under the band's rule, not a row
  of framed cards (VD-93). A route to a race carries the race's outline,
  where F1DB draws one, beside its words (provisional, VD-104 #1239: §3 *Outline card*, the race
  thumbnail). Home has none: its index is its way on.
- ***Index* (provisional, VD-93 #923):** home's doors to every part of the
  site, one list, `BOARD` in `queries/home.js`, drawn by both renderers as
  `.board.index`: three to a row from 768 px, one on a phone, each door
  under a rule with its name, its count where it has one, and a line. It
  replaced two grids of doors on home - eight cards and the four of a
  *Popular ways in* band - and `smoke.mjs` holds one index and no onward
  band in both halves.
- ***On this page* (optional in A) — provisional (IA-30 #927):** a
  one-line list of the page's sections, under the tiles, on `/records` and
  the race page. A page may add it; no other is held to it.
  - **Parts:** the label *On this page* in the label register, then a link
    to each section by its heading's words, in the order the page draws
    them: `raceSections()` and `recordsSections()` in `lib/wayfinding.js`,
    drawn by `OnThisPage` in `Page.jsx` and `onThisPage()` in
    `prerender.js`, each section carrying the id its link names. A page
    with fewer than two sections draws none.
  - **Behaviour:** from `--bp-tablet` it sticks under the masthead while its
    page scrolls, one line of `--strip-height`, its links scrolling sideways
    where they outrun the width rather than wrapping. The stuck column heads
    and `html`'s `scroll-padding-top` count its height, so a section it
    opens is not brought to rest under it. It sticks inside the page's
    `<article>`, so it never stands over the footer. While one of its links
    has keyboard focus it opens to every line it needs, nothing clipped or
    faded, its focus ring drawn inside the link, because a browser does not
    scroll a link half showing at the edge into view. On a phone it is an
    ordinary block of the page and wraps, since the masthead already takes
    two rows there.
  - **Why a strip and not a rail beside the page:** the item asked for a
    sticky rail in the free right-hand columns. They are free beside the
    header and the prose, but `/records`' tables and figures and the race
    classification run the full width, and the classification never shares
    it (§4). A rail in the margin instead would need a third breakpoint where
    the grid has two (§2). The strip is the form this section already named.
  - **Costs:** about 50 px of the first screen, the block after it taking
    `--space-8` above it rather than a section's `--space-9`; the race
    page's classification heading is still on the first screen at 1440 ×
    900 (§4).
  - **Held by:** `smoke.mjs` (*On this page*): in both halves, every link
    resolves to a section of that id under that heading, in document order,
    every top-level section heading is linked, and the two halves list the
    same links.

### Masthead and dateline — provisional (IA-30 #927)

The masthead is the wordmark, the eight section links, search and the theme
toggle, sticky at the top of every page (`Chrome` in `App.jsx`, `chrome()` in
`prerender.js`). Under it, out of the sticky band, is the **dateline**: which
database the page is reading, when it was built, and the next race on the
calendar, for example *Database v2.26, built 9 Nov 2026 · Next race: 2026
Las Vegas Grand Prix, 19–21 Nov 2026*, as a newspaper's dateline names the
edition.

- **Parts:** the version and the build from the manifest, as the footer
  prints them; the next race from `DATELINE_RACE` in `queries/home.js`, the
  first round still to run in the season being run or, once that has run
  every round, the next season with one; its h1's words as a link to it, and
  its dates where they are held. With no race scheduled, the clause is left
  out. The words are `DATELINE_*` in `lib/site.js`.
- **Read off the database, never a clock**, as home's *Next on the
  calendar* is, so both halves name one race. The next race is the first
  round still `scheduled`, so while a refresh is late it names a weekend that
  has passed, until the result lands; that round's own page says it is late
  (§3, *States*).
- **Type:** `--size-3` at 500 in `--ink-faint`, the link in `--ink-soft`,
  aligned with the wordmark at the page's width.
- **Behaviour:** one line, whatever it holds, so the next race arriving a
  moment after the rest of the line moves nothing beneath it. Off below
  `--bp-tablet`, where the masthead already takes two rows before the h1;
  the footer carries the version and the build there.

### Site footer — provisional (IA-31 #981)

The same on every page, in both renderers: `Footer` in `App.jsx` and
`chrome()` in `prerender.js`, from the strings in `lib/site.js`. It was
some 230 words, most of them an essay on privacy, offline behaviour and em
dashes, the same under every table. It is now four short lines and the
database's facts:

1. **Where the reading happens**, one line, and a link named for what it
   opens, *What does leave, and when*, to the full account on `/data`
   (*What leaves this tab*).
2. **The em dash rule** in one sentence, then *How far to trust it · write
   your own query · what changed · who publishes this*. The em dash line
   stays until the rule stands beside every table that can show one
   (AF-98 #980).
3. ***Found something wrong? Report it.***
4. **The credits**, faint: F1DB, Wikipedia, OpenStreetMap, Wikimedia
   Commons and the circuit outlines, each with its licence, then *Full
   credits* to `/data/sources` and the unaffiliated line.

Beside them, the version, build, checked and digest list. A fifth line is
not added here: a new explanation goes to `/data`, or beside what it
explains, and the footer links it. `smoke.mjs` holds both renderers to the
same lines and to the count.

### Season cycle (A) — provisional (AF-135 #1141, the lap AF-156 #1250, the forecast AF-143 #1149); core: the podium, on home and every race page (VD-108 #1330), its race page's form the stepped slabs; the season plate, on the season page and home (VD-104 #1239, VD-109 #1331); pending: the plate on a constructor's page (VD-115 #1337)

Home's season block follows the calendar while the season being run has a
round to come, in three states worked out from the database and a clock —
the reader's in the app, the build's day in the prerender (`homeCycle` in
`queries/home.js`, which both renderers call):

| State | When | The round to come, and what follows it |
|---|---|---|
| Preview | from the end of the results state to the next round's first session | *Next on the calendar*; the next circuit's *Where winners start* figure |
| Weekend | from that first session (its first day, where it has no timetable) until the result is in the database | *This weekend*: once the race is over, a line that says so, with the last check (`resultsPending` in `lib/refresh.js`); the **weekend lap**, and under it the round's sessions as a list, its start times in UTC on the static page and in the reader's time in the app; the history figure |
| Results | from the result landing to the end of the third day after the race | *Next on the calendar*; the reach chart of the first title still fought (AF-132's); the history figure |

*Last race run* stands in every state (VD-109, `[D-69]`): beside the
champion on the season plate the page opens on, or in the block beside the
next round where there is no plate, and with its **podium** wherever one can
be drawn — until VD-109 the podium led in the results state alone, and the
rest of the cycle shrank the last race to its winner's sentence. With no
round to come, the block is as it was. Its parts are the system's
own — the round panels, `FigurePart`, `Figure`, AF-132's reach chart and
AF-133's grid — and these are new:

- **The podium.** Three steps, listed first to third in the markup, the
  order a screen reader reads them, and stood second, first, third by
  `app.css` as a podium stands. Each step is its place, the driver (a link)
  and the team in words, over a block in the team's colour pair
  (`.livery-series`, held to 3:1 like any series) or an outline in ink where
  none is on record, so colour is never the only cue. Heights are spacing
  tokens. A place held by two entries or by none is not drawn: the panel
  keeps its sentence. Under the team, each step shows the race's
  finishing time as F1DB publishes it (AF-157 #1252): the winner's
  elapsed time, and the gap for second and third (*+1.173*, *+1 lap*),
  tabular and never broken (`.podium-time`), a screen reader hearing
  first what it is (*race time*, *gap to the winner*), or the em dash on a
  step with none where another has one. None is shown where no step has one,
  or where the winner holds a gap — the gaps are then to a car ahead on
  the road that was disqualified (2024 round 14), and would read as gaps
  to the winner (`podium()` in `lib/podium.js`). Home's steps say where each driver started
  under the team, as a race page's slabs do — *McLaren · from pole* —
  from the same `podiumStart` (`lastPodium` in `queries/home.js`, VD-109).
  One component in each renderer,
  `components/Podium.jsx` and `podiumHtml()` in `prerender.js`.
  **Core** since its second page (VD-108 #1330, §8 *Promoting*): every race
  page draws the same three, from the same `podium()` in `lib/podium.js`,
  in the form approved for it on 2026-11-18 (C, `[D-68]`) — **the stepped
  slabs**, which take the tiles' row under the header:
  - Three slabs under the eyebrow *The podium · and where each started*,
    listed first to third and stood second, first, third from 768 px in
    tracks of 1fr, 1.15fr and 1fr, aligned to the floor, their minimum
    heights 104, 120 and 92 px from spacing tokens; under 768 px they stack
    in reading order at full width. Each is its team's colour pair
    (`.livery-series`), or the page's ink on `--panel` under a rule where
    none is on record.
  - On each: the place in the display face, large, at 22 % opacity and
    hidden from assistive technology; the place and given names (*2nd ·
    Max*); the surname in the display face, `--size-8` (`--size-9` for the
    winner), a link to the driver, in the words as written (`[D-66]`:
    capitals for the page title alone, so the mockup's capitals are not
    built); and a line with the team and where the driver started —
    *from pole*, *from 21st*, *from the front of the grid* where the driver
    started first without the pole credit, *from the pit lane*, or *grid
    not recorded* (`podiumStart` in `queries/race.js`; no podium drawn on
    the present data says the last, since every podium place with no grid
    on record is on a page whose podium is declined for a shared place) —
    then the step's race time or gap, as home's steps show it
    (`.race-slab-time`), then a chip for the
    places made or lost from a numbered slot: *▲ 19* on `--move-up`, *▼ 2*
    on `--move-down`, both white (`--on-move`), *held* ruled in the slab's
    ink, and no chip with no slot. A screen reader hears the chip's words
    (*19 places gained*) in place of the arrow.
  - The surname's link keeps the focus ring, drawn in the slab's ink
    (`currentColor`) rather than `--accent`, which on a red or papaya slab
    all but vanishes into it.
  - The words on a slab are whichever of black and white has the higher
    contrast ratio against that value of the pair (`inkOn()` in
    `lib/podium.js`, `RACING_INK` there for the national colours, which are
    tokens), so papaya takes black. Black rather than `--ink`, because
    against black and white the better ratio is never under 4.58:1, which
    holds §7's 4.5:1 floor on any colour; `units.mjs` holds every livery
    and racing colour to it in both themes.
  - Under the slabs, the strip's other tiles on one line, each its label
    in `--ink-faint` and its value, the circuit without its place
    (*Circuit Interlagos · Pole Norris · Fastest lap … · Entries 22 · 20
    classified*; `raceAlso()` in `queries/race.js`).
  - Where a place is shared or empty, or the round is not yet run, no
    podium is drawn and the strip stands, its Winner tile with it.
  - One component in each renderer, `components/RacePodium.jsx` and
    `racePodiumBlock()` in `prerender.js`, from `slab()` in `lib/podium.js`.
- **The season plate** — **core** since its second page (§8 *Promoting*):
  the season page (VD-104 #1239 (c)) and home (VD-109 #1331); pending on a
  constructor's page (VD-115 #1337). One component, `SeasonPlate`: a 4 px rule (`--space-2`) in the
  champion's team pair, `.livery-series` choosing the light or the dark
  value as a series does, or in ink where no colour is on record (1968 to
  2009, or a team with none sourced); the label, *2021 World Champion ·
  Red Bull Racing*, with the team's livery mark and its name a link, so
  the colour is never the only cue; the champion's name in the display
  face at `--size-8`, a stat figure's size, since a name is not a figure
  and stays out of the hero register (§2 *Type*); and the margin at the
  hero size beside *points clear of Sir Lewis Hamilton in the final table,
  with 395.5 points.* A
  season page opens on it once every round is run; a title settled with
  rounds to go waits for the last of them, the strip carrying the leader
  and the gap until then. The strip under it leaves out the
  *Drivers' champion* and *Margin* tiles it states; where no margin is
  stored the plate prints no figure and no sentence, and the strip keeps
  both, *Margin* showing the em dash. The margin is the page's one hero figure, since the season strip
  is not ranked. No accent (D-61). `seasonPlate` in `queries/season.js`
  gives both renderers the plate; `units.mjs` holds it and the strip it
  trims, `smoke.mjs` the plate and the strip in both halves. A
  constructor page is to run it season by season as a livery ribbon
  (VD-115, `P08-constructor-livery-ribbon.html`), built on this component.
  - **On home** (VD-109, `[D-69]`,
    `docs/critiques/2026-11-13-visual-design/P01-home-season-plate.html`):
    the season being run, from the first round run, in place of the six
    row counts the page opened on. The label is *Leading the 2026
    championship* until the record names the leader the champion, then
    *2026 World Champion*, with the team of the leader's latest race entry
    of the season (the record's for the champion); the margin is the
    leader's points less the runner-up's in the standings, beside *points
    clear of Max Verstappen after 20 of 23 rounds*, then, for each title on
    the record with rounds to run, where it was settled (*The title was
    settled at the Mexico City Grand Prix, round 19. Mercedes took the
    constructors' title at the Sao Paulo Grand Prix, round 20.*), which the
    next race's panel then does not say again (`homePlate` and `homeAhead`
    in `queries/home.js`). Level on points, it prints the sentence and no
    figure; a total not established, neither; and with no margin printed
    the block's rounds tile stays and is the page's hero. The name is the
    section's h2 (`heading`), as the mockup sets it, since the plate's
    section has no other. Beside the champion, under the same rule, *Last
    race run* and its podium: from 1180 px in the slot's column (`aside`,
    `.season-plate-split`), and below that under the champion. The six
    counts follow as one line, the figures in the ink and the words in the
    soft ink at `--size-4`, ending *How far to trust it →* to
    `/data/quality` (`dbLine`). With nobody leading — no round run yet —
    there is no plate, and the block's rounds tile leads as it did.
- **The weekend lap** (AF-156 #1250). The round's outline, `Outline`
  itself with the marks as its children, so a drawing with stops on it is
  still the one outline component (VD-92's), drawn faint and dashed as the
  season strip draws a round to come. A stop per session, the k-th of n at
  k/n of the way round from where F1DB's path begins, so the race closes
  the lap; the track drawn in, in ink, to the last session started; a
  started stop filled, one to come hollow, the next larger with a ring
  that pulses and stands still under `prefers-reduced-motion`. Ink, not
  accent, as on the strip. Under the outline, on the drawing's ground and
  not over the track: *Next:* and the session's name, its start (UTC on the
  static page, the reader's clock in the app) and how long until it, a line
  the static page writes empty, so the app fills each of the three lines in
  place and the block keeps its height. AF-156 asked for the words inside
  the outline; laid over the drawing, a stop or the track crossed them on
  most of 2026's circuits (the first review on #1258), so they stand under
  it. The caption says the
  spacing is order, not time, and that the drawing has no start line or
  direction, then credits the outline as an outline card does. A round
  with no drawing, or one `lib/lap.js` cannot read, gets the same stops on
  a plain strip, its words under it in the flow. `lapLayout` in
  `lib/lap.js` lays it out for both renderers from a clock it is given,
  so the static page draws the build's day and the app the reader's, and
  only the marks' state differs. Capped at 320 px in its panel.
- **The weekend list.** The text the lap stands for: each session's mark
  and state as the lap draws it (the state in words for a screen reader),
  its name, and its start at the line's end, so a start written wider in
  the reader's form moves only itself.
- **The forecast** (AF-143 #1149). Open-Meteo's, asked for by the app from
  the reader's browser at the point `race_weather_modelled` holds for the
  circuit, and never stored (`lib/forecast.js` says what is asked and
  when). In the weekend state, a line under each session still to start,
  in the list's row so its name and start keep their places: the weather
  line's mark (`.weather-mark`, from `WEATHER_MARKS`) and the word that
  says the same, then the hour's figures, *Cloudy · 18 °C · 40% rain*.
  From seven days before the weekend's first day, in *Next on the
  calendar*, a line a day, ruled as the weekend list is: the day's name,
  and *Clear · High of 24 °C · up to 10% rain*. Both in `--size-4` and
  the soft ink, and under them, beside the figures, the credit Open-Meteo
  asks for: *Forecast · Open-Meteo (CC BY 4.0) · updated 14:05*, each
  name linked, the time on the reader's clock, with its day where the
  answer came on an earlier one. An answer is asked for again after three
  hours, so a page left open does not keep an old one. **The app's alone, by the
  item's ruling**: the static page has none, so the lines arrive after
  the handover, when the answer does, and are the one part of the block
  that moves within a state. **It fails closed**: a refused or failed
  fetch, an answer it cannot read, or a session or day with no figure
  draws nothing for it — no placeholder, no zero, no credit without
  figures.

The static page prints the state at the build's day, and the app the state
at the reader's, so a page opened on a later day changes state at the
handover; within one state nothing moves. `units.mjs` holds each state and
both its edges on fixed clocks, and the lap a normal and a sprint
weekend, the strip, and every outline the database holds; `smoke.mjs`
reads the app at the build's day where it compares the two halves of `/`,
checks each half draws the state and the lap its clock gives, and draws
the app inside the next round's weekend on two fixed clocks at 400 px,
holding its stops, track, list, ring, words and credit to `lapLayout`.
For the forecast, `units.mjs` holds what is asked for and what is shown
on fixed clocks and answers, and `smoke.mjs` answers the app's one
request inside the weekend at 320 px and before it at 400, holding each
figure to its own session or day and the credit beside them, refuses it
once to see nothing drawn, and finds no forecast on the static page.

### States (core) — built: *Not established* and *Late*; Loading, Empty and Error pending (VD-100 #1023)

| State | Rule |
|---|---|
| Loading | Skeleton rows in the component's own shape; the static page's content stays until the app replaces it in place |
| Not established | An em dash, never 0 (**floor**: `conventions.mjs` "a NULL is not established") |
| Empty | One sentence saying what is absent and whether it is expected to arrive |
| Late | A round whose results F1DB has not published yet says so (SD-37). A fresh race's pit stops say they usually arrive after the classification, not "F1DB records no pit stop" (SD-40) |
| Error | Says what failed and what still works |

---

## 4. Page templates — built: the order (VD-83), the opening (VD-84) and the season's *Who can still win* (VD-90)

The order is the *What leads* critique's (2026-10-05) unless this pass found
a reason otherwise. The shared ending, provenance then *Keep going* then the
citation, is already one system and is kept.

### Entity pages: driver, constructor, circuit, season, car

| Width | Layout |
|---|---|
| ≥1180 | header (7 columns) beside the slot (5); tiles full width; the type's sections full width |
| <1180 | header; tiles; slot; sections (a race: header; tiles; classification; slot) |

**Per type (the middle of the page):**

- **Driver:** lead chart (championship finishes) · the current season
  (active drivers only; one statement, not a tile plus a note) · *Circuits
  won at*, a driver with a win (provisional, VD-104 #1239, §3 *Outline
  card*) · Season by season · Team-mates · Every entry. The lead chart is annotated
  in the shared pattern (provisional, VD-124 #1348, §3 *Figure*).
  **Pending:** Team-mates as a face-off, the two
  names set large over rules in each driver's colour, split tallies for
  qualifying, races and points with the winning side's figure set large,
  and a verdict headline (VD-122 #1346, `[D-65]`).
- **Constructor:** lead chart (wins by season) · Season by season · Every
  win · Cars built · photographs. The lead chart is annotated in the shared
  pattern, titles, peak and drought marked (provisional, VD-125 #1349, §3
  *Figure*). **Pending:** the livery band as a
  season-by-season ribbon (VD-115 #1337); one count of wins wherever the
  page and `/records` show them side by side (VD-117 #1339).
- **Circuit:** the current outline in the slot (VD-74, VD-84) · winners
  first on **all 80**, not only the 13 with a layout timeline (S2) ·
  Constructors here · *Where winners start here*, the starting grid and the
  chips (provisional, AF-133) · Every layout raced here (the timeline's rows or the
  other drawings behind one disclosure; absent where there are neither, and
  the slot's card then carries the rule) · Every race here.
- **Season:** a concluded season opens on its plate, above the tiles
  (provisional, VD-104 #1239, §3 *Season cycle*). *Who can still win* takes the lede position on a season
  being run, ahead of the season's own note, which follows it as a race's
  follows who won; what the answer was worked out from follows the tiles
  (VD-90: `titleAnswer` and `seasonLede` in `queries/season.js`, which both
  renderers print; smoke's *who can still win, in the lede*). The whole
  answer, some ninety words, was too long for a lede: it ran to ten lines
  and the web font's arrival added an eleventh, moving the page beneath it.
  A title on the record with rounds still to run is not fought here: the lede
  opens on who holds it and the round it was clinched at, and the answer and
  the reach chart cover the title left (LV-15: `seasonAnswer`) ·
  lead chart · *Who can still win*, the reach chart for each title the
  answer covers (provisional, AF-132), then the clinch strips where the next
  round can settle the drivers' title (provisional, AF-138) · standings, each table at the full
  width with its leader in the row and a bar beside each total (provisional,
  VD-110) · calendar · Who entered · photographs.
  **Pending:** the title-race chart annotated, the pattern's first use
  (VD-121 #1345). The stray OpenStreetMap sentence in *The next round*,
  once VD-116's to move into its outline card, goes with OpenStreetMap
  itself (AF-179 #1395). The
  photographs follow *Who entered* so that they sit where the photo strip
  puts them on every type (§3), which this line had the other way round.
- **Car:** tiles directly under the h1 · Why it mattered · Specification ·
  Every entry · photographs. This year's chassis opened on its photographs
  (I9, PD-49) until VD-83; the photograph that identifies a car is the
  opening slot's (VD-84), and the strip holds the rest.
- **Era** (provisional, IA-25): the header carries `EYEBROWS.era` as its
  eyebrow, the page type and then the years (*Era · 2014–2021*, *Era ·
  2026–*), as §3 has every entity page's; the era's summary as its lede and the stepper to the eras either
  side as its aside · the era's lines as fields (dominant teams, technology,
  confidence) · The seasons · Engine formulae · Regulation changes ·
  Technical innovations · Safety · *Keep going*, which is the three
  registers narrowed to the era. Each section is `/eras`'s own table or
  timeline over the era's years; one with nothing in them keeps its
  heading and says so in one sentence. It has no tiles or slot: an era has
  no single figure to lead with and no picture of its own.

### Event pages: race

Race pages follow the entity layout (DP-11): the header, with the weather
line where one is held (§3, Page header), beside the outline slot; the
podium where one can be drawn, with the strip's other tiles on a line under
it (§3, *Season cycle*, VD-108), and the tiles where it cannot;
*On this page* (§3, provisional, IA-30); the classification at full width,
with the line pointing to a recorded disagreement above it and the box after
it, closed (§3, *A race's box, folded*, VD-131); Grid to flag; qualifying; pit
stops; practice (folded); the timetable, once a result is held;
photographs. The page of the next round to run, until its results land,
carries *What's at stake* after the timetable: the season page's answer and
its basis, from the same function (provisional, AF-132), then the clinch
strips where the round can settle the drivers' title (provisional, AF-138),
and with every title already on the record the sentence alone (LV-15), then
*What history says*, the circuit's *Where winners start* (provisional,
AF-139, §3 *Figure*). The classification
never shares its
width with a side column (VD-84; beside the outline it lost Points and FL to
a scroll from 768 to 1,110 px), and a scheduled race leads with its
timetable (kept). From 768 px the classification also fits its own box
(§3, Table, *a table that fits its box*, IX-45), so Points and FL no longer
scroll at tablet width.
The slot is written after the classification, so below 1180 the outline
follows the result.

**Pending:** Grid to flag
naming its story, the biggest climb and fall drawn in full ink and labelled
over a halo, the other lines in `--rule-strong`, with a title that states it
(VD-113 #1335).

What it costs: the band is as tall as the outline, and the podium is
taller than the tiles it replaces, so at 1440 × 900 the classification's
heading is on the first screen and its rows may not be. PD-57's tiles in
the column beside the outline showed eight rows, and version A, before the
podium, four. The podium is the result and leads the page, so the first
screen holds the heading, not the rows, on every page that draws the
podium (VD-108, ruled on #1330, `[D-68]`). The smoke suite holds the
heading, whole, under the podium and inside the first 900 px, in both
halves, on the race pages whose openings are the longest.

### Lookup pages: records, Grand Prix, registers, `/data`

Single column. On these pages a table or a card grid leads. `/records`
opens on *On this page* (§3, provisional, IA-30) under its header, each
record family listed by its own address. A Grand Prix's page carries *Where
this Grand Prix's winners start* between *Most wins* and *Every edition*
(provisional, AF-139, §3 *Figure*).

- Records cards align to the top of their row, so opening one derivation
  does not move its neighbours (I8).
- **A record card sets its number large** (provisional, VD-111 #1333): §3,
  *Record card*.
- **A record's page is built around its record** (provisional, VD-112
  #1334; approved as the mockup
  `docs/critiques/2026-11-13-visual-design/P12-record-page-streak.html`). It
  opens on the number the value opens with (`cardFigure`, as the record card
  reads it) at `--size-record`, with the words that give it meaning beside
  it at `--size-6`: the rest of the value and *Held by* the holder, or, for a
  value that opens with no number, the value whole at `--size-8`. It
  replaces the *Value* and *Held by* tile strip. A record that is a run of
  races (`STREAKS` in `queries/records.js`; *Most consecutive wins* so far)
  is read as a sentence instead — *Max Verstappen won ten Grands Prix in a
  row in 2023, from the Miami Grand Prix in May to the Italian Grand Prix in
  September* — with the count in words because it is the figure's own
  sentence, not a lede beside a tile; then a strip of the run's races as
  race thumbnails (§3, *Outline card*), each a link to its race, ten a row
  and five on a phone, credited once under it; then *The longest runs*, the
  first five and on through a tie, as bars, the record's runs in
  `--series-mark` and the rest in `--series-ink` (`[D-61]`), every length
  printed, with one line under them stating the record's rule and linking
  the derivation. The runs are counted in
  the page under the record's own rule (`streakRuns`), and where that count
  does not bear out the record's figure, the page draws neither the
  sentence nor the runs, rather than two figures for one record. A run that
  reaches the latest completed race says so. `recordLead` lays the page out
  for both renderers; `smoke.mjs` (*/records/:key*) reads the lead, the
  strip and the runs in both halves and against the race records.
- **A leaderboard on a phone** (provisional, VD-114 #1336; approved as the
  mockup `docs/critiques/2026-11-13-visual-design/P13-records-leaderboard-phone.html`):
  below 768 px (`PHONE`, the page's width, not the plot's) each of
  BarChart's rows is the name on its own line from the plot's left edge,
  with the bar at the plot's width under it and the value at its end, as
  the reach chart does below a 480 px plot; from 768 the names keep their
  168 px column beside the bars, where the drivers' two leaderboards sit
  side by side in `.split`. The one bar that alone holds the top value says how far clear
  of the next value it is after its own, *15 clear*, in the label register
  (Saira 500) and in ink, as a record card's margin does; a tie at the top
  says nothing. Where the margin would cost the bars more than a quarter of
  their length (half of `.split` from 768 to about 930 px) it is left off, the
  table under the figure carrying every value it is worked from.
  `charts/barChart.js` lays it out; `units.mjs` holds the layout and the
  margin, a tie included, and `smoke.mjs` every name above or beside its bar
  and every figure inside the plot at 1280, 768, 767, 400 and 320, and the
  margin on the wins leader's own bar. The static page draws no bar chart,
  only each leaderboard's table, so it has nothing to stack.
- Registers keep their address contract.
- `/data` keeps its sub-navigation.

Home's opening is under *Season cycle* (the season plate, built by VD-109), and its
*Where winners start* figure draws the grid's nine rows at the least, 676 px
of a 1,232 px frame at 1440 rather than 100 px (§3, *The starting grid*,
VD-116 #1338).

### Phone

One column, two edges. The order is the document order above. The race page
puts the classification before the outline (visual defect 7).

---

## 5. Content rules (core) — built: voice, NULL and one label per concept (VD-81, the registers' columns in CD-58); dates (CD-57) and session times (CD-59), but for a weekend in a tile's note (CD-64 #1126); a race's standfirst (CD-39, CD-61)

- **Voice:** plain, specific, from the reader's side. Name the thing the
  reader recognises. No notes to self in published prose (the Hamilton lede).
- **No "X, not Y" cadence** (provisional, IA-30 #927): a sentence says what a thing is. A
  contrast with what it is not stays only where the page invites that very
  misreading - *entries, not starts*, on a count that could be read as
  either; *the lap, not cause, tyres or gain*, under a chart a reader would
  otherwise take as measuring them - and once, not as a rhythm. The design
  review of 2026-10-08 counted five to eight a page; "shown, not settled",
  "referenced, not stored" and "a calendar, not a set of results" were the
  habit, and are rewritten as what the thing is.
- **One label per concept:**
  - year span: *Seasons*;
  - entries: *Entries*;
  - provenance: *Where this comes from*;
  - a record: its *Value*, *Held by*, not *HOLDER*, on its tiles and in
    /records' tables.

  These are CD-12's vocabulary, applied: `LABELS` in `lib/site.js`, and
  `REPLACED` beside it lists the words they replaced, which the tests
  refuse. The `/constructors` and `/cars` register columns take them too
  (CD-58): the constructors register's per-season bars, beside its
  *Seasons* span, are *Season by season*, as the constructor page names its
  table of the same seasons.
- **A disclosure or a link says what it opens.** A disclosure that repeats
  on a page carries what it belongs to for a screen reader, as a fold
  carries its table's name: *How it is derived, Most Grand Prix wins*. A
  photograph's credit link is the file's title as Commons heads its page,
  with no extension, and is named *…, on Wikimedia Commons* (DP-30, DP-31).
- **Figures in prose** go stale; a lede carries no count that a tile beside
  it also shows.
- **A race's standfirst** (built, CD-39, CD-61) is generated, never typed:
  who won, for whom, from where on the grid and at which circuit; then what
  the race meant, each sentence only where the race records establish it -
  how much of the field was classified (how many starters were not, with
  neither the field's size nor the classified count, which are the Entries
  tile's, and only where each starter was a car of its own), a first
  championship race win for the driver or the constructor, a first
  championship podium, a record of championship Grand Prix wins set or
  equalled,
  the round that settled the drivers' title and who had led going into it.
  `raceSentence()` and `raceAftermath()` in `queries/race.js`, with
  `titleSettled()` in `queries/season.js`, write it for both renderers. A
  fact the records cannot establish leaves its sentence out; nothing is
  hedged, and no adjective goes in that a count does not prove.
- **Numbers:** tabular figures in every column. A season is printed as
  written, never as 1,950 (PD-63). A one-year span is printed once, never as
  *2023–2023*.
- **Dates** (core, built in CD-57): a calendar date in reading text, a
  table, a tile or a field is never raw ISO, and never all figures
  (`03/09/1997` is a different day either side of the Atlantic).
  - One formatter, `lib/format.js`, writes them: the **house format**, the
    month a word, `9 Mar 1997` in a table, tile or field and `9 March 1997`
    in a sentence; a weekend is `27–29 Mar 2026`. The static page is
    written in it, because it cannot know its reader.
  - The app rewrites each date in the **reader's format**, through
    `Intl.DateTimeFormat` in `navigator.language`: `Mar 9, 1997` in en-US,
    `9. März 1997` in de-DE. The house format is en-GB's, and an en-GB
    reader keeps it as written, so for them the handover changes nothing.
  - Every calendar date is a `<time datetime="1997-03-09">`, so a machine
    keeps the value the database holds. A weekend's `<time>` carries its
    race day.
  - How a page asks for one: `date` on a table column (`'short'`,
    `'long'`, `'race'` for a race row's weekend, `'text'` for sentences
    with days in them, `'time'` for an instant, with `at` naming it and its
    zone), `date` on a tile, or `<DateText>`, `<RaceDates>`, `<Dated>` and
    `<TimeText>` in `components/Dates.jsx`; `prerender.js` has a twin of
    each. A sentence built in a queries module keeps the ISO day and is
    drawn through `<Dated>`, so the words are shared and the date is each
    renderer's.
  - **Times** (built in CD-59): a session's start is an instant read on a
    named clock - the circuit's, UTC, or in the app the reader's own. The
    house form is `Fri 4 Dec 13:30`, the weekday and month words, a 24-hour
    clock, written by `lib/format.js` and not by ICU; the app writes the
    reader's (`Fri, Dec 4, 1:30 PM` in en-US, `Fr., 4. Dez., 13:30` in
    de-DE), and an en-GB reader keeps the house form. Each is a
    `<time datetime="2026-12-04T09:30Z">` holding the instant, and a file
    taken from the timetable carries the wall clock on each column's zone
    with its offset, `2026-12-04T13:30+04:00`.
  - Data stays ISO: SQL, the JSON and Parquet exports, `f1.db`, a file or
    copy taken from a table (a weekend as an interval, `2026-03-27/2026-03-29`),
    and the SQL console. A day inside a longer token, a file name or a path,
    is that token's and is left as written.
  - The one exception is a Commons file's title on its credit link, which
    is printed as Commons heads the file's page (the attribution rule).
  - *Pending (CD-64 #1126):* the weekend a scheduled race's Status tile
    carries in its note is in the house format and not yet in a `<time>`.
    The standfirst no longer carries one (CD-39): the eyebrow above it holds
    the race day in a `<time>`, and a lede is plain text in both renderers.
    A search result's description, which has no eyebrow, opens on the
    race's date in the house format.
- **NULL** is an em dash, never zero (**floor**).
- **Uncertainty and disagreement:**
  - a disagreement is a framed note above the table it concerns, naming both
    sources and both values; on a race page it follows the classification,
    closed, and a line above the table points to it (VD-131, `[D-67]`);
  - a derived-against-published pair always says which the page shows (DA-43
    #751);
  - an open gap is linked to `/data/quality`.
- **The footer explains nothing at length** (provisional, IA-31 #981): a
  line and a link, never the account itself, which stands on `/data` or
  beside what it explains. Its shape is §3's *Site footer*.
- **Captions:** at most 50 words. A caption explains how to read the figure
  and does not repeat what the figure shows.
- **Fold buttons and counts:** count the same unit in the heading and the
  button.

## 6. Interaction rules (core) — built in part

Built: the keyboard floor, reading order included (VD-86); nothing moving
at the handover (VD-79); and state in the address and the one reveal
control (VD-82).

- **Keyboard (floor):**
  - every control is reachable;
  - focus is visible;
  - the skip link works in both renderers;
  - reading order matches visual order. The side-by-side opening keeps
    header → tiles → slot, as it does today.
- **Hover equals focus (aim):** anything that opens on hover opens on focus
  and on tap.
- **State in the address (core):** register filters, entity-table sort and
  fold, and (provisional, AF-139) which races *Where winners start* counts.
- **Back** restores state and place.
- **One reveal control:** the fold.
- **Nothing moves under the reader:**
  - the static page and the app share the page header, slot or rail, and
    order (§8's test 5 holds the header, the tiles and the section order);
  - the app takes the static page's place only once its page is drawn,
    never on an empty frame: it renders out of sight until then
    (`main.jsx`, `data-handover` in `app.css`). The handover's layout shift
    was 0.57 on every race and driver page, and is under 0.01;
  - opening a disclosure never moves a sibling's control.
- **The service touchpoints** are part of the system:
  - the `/changes` page;
  - the late-results notice (SD-37);
  - `/build-status.txt`, written by the Parquet step and by `prerender.js`
    (`[D-10]`).

  Each says what is true now, in the voice above.

## 7. Accessibility: floor and aim — built where the table names a test

| Rule | Class | Held by |
|---|---|---|
| WCAG A/AA on the ten smoke routes | **floor** | axe-core in `web/test/smoke.mjs` (and 0 violations on 104 runs across 26 routes on 2026-10-06) |
| Every focusable element shows a visible change on `:focus-visible` | **floor** | `conventions.mjs` refuses an unset outline with no `:focus-visible` ring beside it (VD-78); `smoke.mjs` *Sorting* focuses a sort button and a console example from the keyboard and reads the ring (VD-82) |
| DOM order equals reading order at every width; no grid placement lifts content above earlier markup | **floor** | `smoke.mjs` *The grid* (VD-86): on the driver, race and circuit pages at 1440, 1024 and 400, in both halves, no block stands left of an earlier one in its container on its row, or above it in its column. A block wholly to the right of an earlier one is a column read after it, and may start higher. Declared there: A's opening slot, beside the header and above the tiles it follows in the markup, read header → tiles → slot as §6 keeps it. Declared here: the podium's steps on home and its slabs on a race page (§3 *Season cycle*), listed first, second, third and stood second, first, third as a podium stands, so the eye and the keyboard part company inside that one block; ruled with the approved designs (AF-135, VD-108 #1330), and under 768 px the slabs stand in reading order |
| Focus on the h1 after the handover, on every page type | **floor** | `smoke.mjs` *The handover* (VD-79): eleven page types, the first a held cold load |
| Text contrast 4.5:1 and a chart series 3:1, in both themes | **floor** | `web/test/conventions.mjs` (AX-06, AX-07, VD-27; a field's placeholder, AX-27; selected text, VD-118) |
| Every table names its rows; one h1; focus to h1 on navigation | **floor** | `conventions.mjs` (AX-21), `smoke.mjs` |
| No meaning by colour alone | **floor** (1.4.1) | review, `frontend-reviewer` item 7 |
| Reflow at 400 and 320 px with no sideways page scroll | **floor** | smoke at 400 |
| Hover box opens on focus | **aim** | `smoke.mjs`: the championship dots on `/drivers/hamilton` (CR-74), and the column and line charts on `/constructors/ferrari` and `/seasons/2024` (AX-32), each focused, stepped with the arrows and read in its box and its status region |
| Revealing content moves focus to the first revealed item | **aim** | `smoke.mjs` *An exhaustive list opens on its first ten* (VD-82): opening a fold puts focus on row 11's row header, on screen |
| A disclosure's name says what it opens | **aim** | `smoke.mjs` *Both renderers draw one page* (VD-81): no two disclosures, and no two stand-alone links to different places, share a name on a smoke route |
| The tile strip carries a name | **aim** | `smoke.mjs` *Both renderers draw one page* (VD-88): every strip on its routes is a group named "At a glance", in both halves |
| Text 12 px or smaller is not also faint and longer than the small measure | **aim** (33–62 % of entity-page text is ≤12 px; zoom and reflow work, so this is not pressed against the design) | the measure tokens |
| Target size of at least 24 px for controls and 6 px for chart marks | **aim** | a table row's pitch at either density, from the tokens in `conventions.mjs` and on four tables in both halves in `smoke.mjs` *Dense rows from 1180 px* (VD-95); the rest, — |
| Line length of 45–75 characters | **aim** | the measure tokens |
| Reduced motion respected | **aim** | — |

**Where design and accessibility pull apart:**

- **A's side-by-side opening.**
  - What the design gains: the first screen is full, with the chart beside
    the heading.
  - What accessibility gives up: at 200 % zoom on a 1440 screen the page is
    720 px wide, so it stacks, and nothing is lost. Between 1180 and 1280
    the chart's marks are smaller than when stacked.
  - Who is affected: mouse users with low precision.
  - What keeps both: a minimum mark width (aim), and the switch at 1180, not
    1024.
- **The handover.**
  - What the design gains: the opening band fills the first screen.
  - What it costs: not reading order, which is correct, but the jump when
    the app replaces the static page. It is felt by magnifier users and by
    anyone reading during a ~17 s cold boot.
  - What keeps both: the static page draws or reserves the same opening.
    The prerenderer already draws three charts on the static race page, and
    VD-79 draws one page header and one tile strip in both renderers, and
    swaps the two halves only once the app's page is drawn. The static
    driver, constructor and season pages draw their lead charts in a box the
    app's height (VD-73).
- **Small type on tiles and eyebrows** was 10–11 px tracked monospace caps,
  kept for the instrument-panel identity at a cost in legibility at low
  DPI. VD-91 settled it for legibility: nothing is set under 11 px, tile
  labels and column heads are 12 px Saira 500 in sentence case, and the
  eyebrow is 13.5 px (§2 *Type*).

**Version A needs no floor check relaxed.** If a change ever does, it names
the check, the change and the reason as a separate decision for the
maintainer (§8), and loosens nothing on its own.

## 8. How it stays true

The system is held by tests, not by memory.

**Enforced before the system (keep):**

- type, weight and spacing on the scales (`conventions.mjs`, VD-03);
- colour contrast for text, buttons and chart series, in both themes;
- the one attribution rule;
- NULL is never zero;
- every table names its rows;
- the fold at `FOLD_TO`;
- `smoke.mjs` comparing every static table with the app's, and, on the
  routes its VD-79 section reads, the prose around them (AF-100).

**The system's own tests, one each, so a drift fails the build.** Built in
VD-78: 1, 2, 3, 4, 8 and 9. Built in VD-79: 5 and 10. Built in VD-80: 6.
Built in VD-81: 7. Built in CD-57: 11. Built in VD-82: 12. Built in
VD-83: 13. Built in VD-84: 14. Built in VD-86: 4's reading order, and 15.
Built in VD-91: 16. Built in VD-93: 17. Built in VD-96: 18.

1. **Widths are spans.** Every `width`, `max-width` and
   `grid-template-columns` in `app.css` is a `--span-*`, `--measure*`,
   `100%` or `auto`, or carries a reason comment. This is the width
   equivalent of VD-03's scale test.
2. **Breakpoints are tokens.** Every `@media` width in `app.css` is one of
   the two breakpoint tokens.
3. **No inline sizes in JSX.** No `style={{…}}` with a length literal in
   `web/src/pages` or `components` (VD-60 #615).
4. **Edges land on the grid.** `smoke.mjs` measures each top-level block of
   `main` on the driver, race and circuit pages at 1440 and 1024, and fails
   on a left or right edge that is not a grid line, the measure or the full
   width. This is the test that would have caught 5–6 October. The same
   walk, at 400 too, fails a block drawn to the left of an earlier sibling
   on its row or above it in its column, a column to the right being read
   after the one to its left, and the opening slot beside the header
   declared (§6): DOM order is reading order (§7).
5. **One page, two renderers.** On every smoke route, the static page's
   section headings and their order equal the app's, and so do its header,
   child for child, and its tile strips (`smoke.mjs`, *Both renderers draw
   one page*). A known difference is declared there with the item that will
   remove it, and a declared difference that has gone fails too, so the
   list cannot outlive its cause.
6. **One figure grammar.** `Figure` takes its note as a prop and renders it
   under the plot, and no page passes a second title; every note builder is
   50 words at its longest (`conventions.mjs`), and on the smoke routes, in
   both halves, every figure is named for the heading above it, with its
   note under the plot in 50 words or fewer (`smoke.mjs`, *One figure
   grammar*).
7. **One vocabulary.** Tile labels and provenance headings come from one
   list, `LABELS` in `lib/site.js`, and a test refuses a synonym: in the
   source (`conventions.mjs`, *one vocabulary*), in any tile or column of
   `queries/*.js` but the winners tables' *Span*, declared with its reason,
   where a strip that writes a word of the list as a literal fails too, and
   on the smoke routes in
   both halves (`smoke.mjs`), which also hold every entity page's eyebrow
   to its type and its provenance section to *Where this comes from*.
8. **Tokens are used.** Every token defined in `tokens.css` is referenced
   somewhere, so `--size-9/10/11` either earn their place or go.
9. **Focus is visible.** `conventions.mjs` refuses an `all: unset` (or
   `outline: none`) selector that has no `:focus-visible` rule beside it.
10. **Focus survives the handover.** On a held cold load, `smoke.mjs`
    checks that focus is on the h1 after the app takes over, on every page
    type, that the status region says so, and that the handover's layout
    shift stays under 0.05 (*The handover*). It measures on the fallback
    stacks, with the web fonts answered empty: a font landing after the swap
    moves the page, and that is the font's shift, not the handover's (PM-80).
11. **Dates are words.** No ISO day is visible text on any prerendered
    page in `dist/`, outside a `<time datetime>` attribute, `<code>`, the
    SQL console and a Commons file's title; the app writes the same
    `<time>` as en-GB, en-US and de-DE readers expect, a timetable's
    starts included; and the handover is measured in en-US, where the
    dates and times change width (`smoke.mjs`, *Dates in
    the reader's format* and *The handover*; `units.mjs`, *dates are words
    on the page*).
12. **One reveal control.** A table over `FOLD_OVER` rows folds, naming
    its noun, or gives one of `UNFOLDED`'s reasons: `prerender.js` refuses
    any other on every route it writes, listing them all, and DataTable
    logs the error `smoke.mjs` fails on; `conventions.mjs` holds every
    reason given to the one list, in both halves. `smoke.mjs` *Back
    restores a table* opens a fold, sorts it, follows row 200 and comes
    back to the same address, fold, order and row.
13. **One section order.** On every smoke route, in each half on its own,
    the photographs come straight before *Where this comes from*, a
    circuit's winners come before its layouts, and a car has no heading
    above its tiles; a car, constructor, season and race route with
    photographs must be among them (`smoke.mjs`, *Both renderers draw one
    page*). The orders each type keeps around those are held by the
    sections that name them: *the result leads*, *the chart leads, the
    photographs follow*, and Monza's and a circuit with no timeline's.
14. **One opening.** On a driver, a constructor, two seasons, a race, two
    circuits, a car and home, the slot is beside the header from 1180 px, level
    with the heading and to the page's right edge, the tiles run the full
    width under both, and below 1180 the slot follows in one column, after
    the tiles, a race's classification or home's season block, in the app
    and, where it draws one, the static page; home's caption names the race
    the database says it should, in both. A column chart in the slot keeps every hover
    target 6 px wide at 1180, a team over `SLOT_MARKS` has no slot, and a
    page with nothing for it keeps its header and tiles the page's width
    (`smoke.mjs`, *The opening slot*).
15. **One card gap and one photo strip.** Every card grid in `app.css` -
    the photo strip, the record, onward and outline cards, the outline
    strip - gaps its cards by `--space-6` at every width
    (`conventions.mjs`), and the photo strip holds 4 to a row from 1180, 2
    from 768 and 1 below, in both halves (`smoke.mjs`, *The photo strip*).
16. **One label register.** Every rule in `app.css` that sets the
    monospace face, by token or keyword, names machine text declared in
    `MACHINE`, every rule that sets capitals, small caps or positive
    tracking in any unit is a display heading declared in `DISPLAY_CAPS`,
    each list refusing an entry that no longer applies, and no type step is under 11 px; a step taken out of
    the scale is declared in `RETIRED` and defined and used nowhere
    (`conventions.mjs`, VD-91). Both renderers share the stylesheet, so the
    static page and the app agree by construction.
17. **A paper, an ink and rules.** Every surface, ink and rule token is
    warm in both themes, and the ground and panel are never gray-100 and
    white; a tile, a record card, a door, the onward routes and home's
    rounds and conventions declare no background, side or bottom frame,
    radius or shadow, and all but the onward routes draw a rule above
    themselves; home's rounds and conventions are not `.panel`s in either
    renderer (`conventions.mjs`, VD-93).
18. **One prose voice.** Every rule in `app.css` that sets the text serif,
    by token or keyword, names a prose role declared in `PROSE`, which
    refuses an entry that no longer applies and any heading; `.pill` names
    the label face, so a pill in a line of prose keeps it; and `--serif`
    leads with the face chosen (`conventions.mjs`, VD-96). Both renderers
    share the stylesheet, so the static page and the app agree by
    construction.

### How a change to the system is made

The system is adopted, not finished. New features will need things it does
not have yet, and the way to get them is to grow it in the open, never to
work around it. A change to a rule is a pull request that edits this file
and the token or test together. There are three kinds, and a review holds
each to a different bar.

- **Extending.** A new component, token or template variant that a feature
  needs is allowed **in the feature's own pull request**. It is added to
  this file, in the section it belongs to, marked **provisional** with the
  item that added it. It is built from the tokens, and it adds or extends a
  test where one applies. The reviewer checks that the extension is coherent
  with the system (on the grid, on the scales, in the vocabulary, at the
  floor), not that the system already had it. Work off the system that does
  neither, using tokens or extending it, is a finding.
- **Promoting.** A provisional component becomes **core** when a second page
  uses it, in the pull request that brings it there, or at the next design
  pass. Promoting is an edit to its marker, and to its test where the second
  use shows the test was too narrow.
- **Changing or reversing.** Changing what an existing rule says, reversing
  one, or relaxing a floor check needs a `docs/DECISIONS.md` entry in the
  house form `[D-nn]`, because the next session has to know why, and the
  maintainer's ruling. A feature's pull request cannot do it on its own: the
  question is filed on the item for the maintainer, and the feature works
  within the rule as it stands until it is answered.

**A light review cadence.** The next design pass, and any critique, starts
from this file. It lists the provisional components and says of each
whether to promote, merge or drop it. A critique that finds a page
off-system files the drift against the rule it breaks, by name, and keeps a
finding against the system itself apart from drift.

## 9. Where it lives

- **This file** is the record. It versions with the code, and a reviewer
  reads it.
- **`web/src/styles/tokens.css`** is the single source of every value. This
  file names tokens and never restates a value that could drift. Where a
  table above still carries values, they are the record of the decision; as
  each step lands, its table is replaced with a pointer to the token, as the
  grid's and the measure's were when VD-78 landed.
- **`web/test/conventions.mjs` and `smoke.mjs`** hold the rules.
- **The comparison page** linked from #843 is the picture for the decision.
  It is not a second source.
- **`AGENTS.md`, `CONTRIBUTING.md`, the backlog-item skill and the agents in
  `.claude/agents/`** point here and restate none of it.

## 10. What was decided, and what was rejected

The maintainer's ruling on #843, 2026-10-06:

1. **The version (DP-09): A**, one grid with one opening slot.
2. **The middle type register (DP-10): kept and used**, as A requires.
3. **Race pages (DP-11): A's entity layout**, with the outline in the slot.
4. **The core:** DP-01 to DP-08 accepted in full, and DP-28 to DP-33 folded
   into the matching steps. Staged, one reviewed pull request per step.

**Rejected: version B, one reading column.** Every block would have started
at the left edge and ended at the measure or the full width, the lead
element following the tiles. It was the cheapest (mostly deletion), it is
the shape the static page already drew, so the handover jump would have
gone by construction, and it gave the largest charts. It gave up the right
half of the first screen at 1440, which was the *What leads* complaint
behind VD-52 and VD-53, and the circuit's aerial at the top.

**Rejected: version C, a reference entry.** A 4-column facts rail beside an
8-column reading column on entity pages, with events single column. It
brought the biography to the first screen and stopped the tile strip
wrapping. It gave up one page width (wide tables broke out below the rail,
so a page had two), it put the rail and the circuit aerial in competition
for one column, and it cost the most of the three.

The design-pass critique holds the full comparison, and the defects that
existed whichever version was chosen, with ids.

The maintainer's ruling on VD-107 (#1328), 2026-11-13: **principle 1 amended**
to "Serve the value, and give it character", so that character which costs
no lookup is not decoration and a correct, dull page is a defect `[D-64]`.
The direction, mostly data journalism with some of a broadcast's energy, is
in `.claude/critique/visual-direction.md`.

The maintainer's ruling on the visual critique of 2026-11-13, on its design
review page, 2026-11-13 and 2026-11-14: **thirteen designs approved as
mockups** and entered above as pending, each against the build step that
lands it (VD-108 to VD-115 and VD-121 to VD-125), with five fixes beside
them (VD-116 to VD-120). Five were approved only in a second version, after
the note that their labels needed handling "more gracefully" and that one
was "very boring"; the annotation pattern in §3 *Figure* is that answer.
**A team-mate from the same team takes that team's second livery colour**
`[D-65]`. The critique and the approved mockups are
`docs/critiques/2026-11-13-visual-design.md` and the folder beside it.

The maintainer's ruling on VD-96 (#928), 2026-11-16, from the side-by-side
comparison in `docs/critiques/2026-11-14-serif-comparison/`: **Source Serif
4 for prose**, chosen over Newsreader and over leaving prose in Saira, and
**section heads in the words as written**, the page title staying in
capitals `[D-66]`.

The maintainer's rulings on VD-108 (#1330), 2026-11-17 and 2026-11-18:
**the race page's first screen holds the classification's heading, not
its first four rows, on every page that draws the podium**, because the
approved podium is the result and leads the page; the opening was to
tighten to hold it there, and the podium was redrawn as the stepped slabs
that take the tiles' row, approved on the review page after two compact
forms read as dry `[D-68]`.

The maintainer's ruling on VD-108's review page (#1330), 2026-11-18: **a
race's disagreements move under the classification, closed to one line**,
with a pointer above the table (VD-131 #1399) `[D-67]`.
