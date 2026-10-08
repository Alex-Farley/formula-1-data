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
VD-86 (#884) holds the core rules none of the seven named. **A step's pull request moves
the sections it builds from pending to built**, in this file, in the same
change.

---

## 1. Principles

1. **Serve the value.** A reader comes for a figure, a result or a
   comparison. Decoration that delays it is a defect, whatever its taste.
2. **One system, applied.** Every width, gap and type size is a token, and
   every recurring block is a component. A page is an arrangement of
   components, never a one-off.
3. **Every deviation is declared.** This is the project's pattern
   (`CLAUDE.md`) applied to design. A page that departs from its template
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
| Chart series and grid | `--series-1..3`, `--grid` in `tokens.css`; the validator record in `charts/palette.js` |
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
| Between card siblings (photos, onward cards, record cards, outline cards) | `--space-6` (12). Pending: the card grids still use several gaps (VD-86 #884) |

### Type — built: the scale and the middle register (VD-84)

The eight small steps and the two display clamps hold. **`--size-9/10/11`
(32/40/50 px) were documented as VD-53's "one number per page" and used
nowhere** (visual V7). DP-10 kept them for the one hero figure per page,
which VD-84 set: the first lead figure of a ranked tile strip (a driver's, a
team's or a car's wins, a record's value, the rounds run on the home page;
the season, race and circuit strips rank nothing and have none), at
`--size-9` on a phone,
`--size-10` from `--bp-tablet` and `--size-11` from `--bp-desktop`, beside
the opening band. A second lead keeps `--size-8`, so a page has one hero and
not two, and a name is never one. `conventions.mjs` now declares no token
unused.

| Role | Step |
|---|---|
| Eyebrow, pills | `--size-1` 10 (mono, tracked) |
| Column heads, axis text, tile labels | `--size-2` 11 |
| Credits, source lines, footnotes | `--size-3` 12 |
| Tables, controls, notes **attached to a box** | `--size-4` 13.5 |
| Body, a value in a row | `--size-5` 15 |
| Lede, a name in a tile | `--size-6` 17 |
| Section head (h2) | `--size-7` 20 |
| A tile figure | `--size-8` 25 |
| One hero figure per page | `--size-9`–`--size-11`, by width (VD-84) |
| Page title | `--size-display` |

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
| Interaction | `--accent`, `--accent-ink`, `--accent-wash` | the one interactive colour, and the fastest lap |
| Result rail | `--rail-podium`, `--rail-points`, `--rail-classified` | state on a result row |
| Chart | `--series-1..3`, `--grid` | categorical series. Never text |
| Identity | `--racing-*` (1950–1967, a pair per theme); `--livery` (2010 on, per element) | a constructor's colour, beside a name it never replaces |

Both themes keep their measured contrast (the figures are in the
`tokens.css` header). Dark stays a second instrument, not an inversion.

### Radii, borders, elevation — built

| Token | Value | Use |
|---|---|---|
| `--radius` | 3 px | every framed box |
| `--radius-sm` | 2 px | pills, chips, and the disagreement box (VD-78) |
| Frame | 1 px `--rule` | one frame for tiles, figures, tables and cards (§3) |
| Emphasis edge | 3 px left border `--rule-strong` | note box and disagreement only |
| Elevation | `--shadow` | overlays only: the search palette, a table's hover box. Never a page block |

---

## 3. Components

Every recurring block, with its job, its parts, its widths and its states.
**Core** unless marked **A**.

### The text-width rule (core, asked for on #843) — built (VD-78), but for kind 2's band

Every text block is one of five kinds. Its kind sets its width.

1. **Free prose** (a lede, a section's intro, *Why it mattered*, a timeline
   entry) keeps the **measure**.
2. **Text that belongs to a box** (a figure's method note, a table's source
   line, the "same on every row" line) is drawn **inside the box's frame**:
   a footer band with a hairline as wide as the box. Its lines stop at the
   measure. The band matches the table, and the text stays legible.
   The figure's band is built (VD-80). *Pending:* a table's source line
   still sits under its box at `--measure-small` until VD-86 (#884).
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

### Page header (core) — built (VD-79, VD-81)

- **Job:** say what this page is, and how to move along a sequence.
- **Parts:** eyebrow, h1, lede, stepper.
  - The **eyebrow** follows one rule: the page type, then the facts that
    identify the entity, for example *Driver · United Kingdom · born 7
    January 1985* or *Race · Round 12 of 24 · 6 July 2025*. A fact the
    database does not hold is left out, never printed as a dash. All seven
    entity types carry one, seasons included (*Season · 23 rounds, 16
    run*), from `EYEBROWS` in `web/src/lib/site.js`, which both renderers
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
  (#819) closed into it. VD-73 (#822), the static page's missing lead
  charts, is the figure's and the slot's, not the header's: §8's test 5
  declares its headings until it lands.
  - One declared difference: `/data/sql`'s static page keeps its own lede,
    because it is not the console and has no examples or schema for the
    app's lede to point at.
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

### Opening slot (A) — built (VD-84)

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
  drawing it twice.

A picture is `<Slot>` in the app and `slot()` in `prerender.js`, the same
`div.slot`; the static page draws the race's, the circuit's and the car's,
and not yet the three charts (VD-73 #822).

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
- **Held by** `smoke.mjs`, *The opening slot*: §8, test 14.

### Tile strip (core) — built (VD-79, VD-81), but for its em dash and its name (VD-88 #887)

- **Job:** the handful of figures the page is about.
- **Parts:** label (`--size-2` mono), figure (`--size-8`, or `--size-6` for a
  name), qualifier (`--size-3`). Every figure in a row sits on one baseline,
  the lead figures and the rest alike.
- **Widths:** a grid, not a flex row. Every tile draws its own hairline (the
  option VD-46 #414 proposed), so a short last row ends against the page.
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
  `queries/*.js` module (VD-49, and VD-71 #819 for the Grand Prix and record
  pages), drawn by `Stats` and by `prerender.js`'s `tiles()`. The one tile
  only the app draws is the season's *Next session*, because only a browser
  knows how long until it starts; §8's test 5 declares it.
- **Labels from one vocabulary:** *Seasons* for every year span, and
  *Entries* everywhere (CD-12 #258); a record's strip is *Value* and
  *Held by*, as /records' tables are. The words are `LABELS` in
  `lib/site.js`, which every strip reads (VD-81); §8's test 7 refuses a
  synonym.
- **States:** a value not established is an em dash (**floor**: the NULL
  rule). *Pending (VD-88 #887):* both renderers still drop a tile whose
  value is null.
- **Accessibility:** the strip is a `<dl>` with a name ("At a glance"),
  either as an `aria-label` or as a visually hidden h2 (**aim**). *Pending
  (VD-88 #887).*

### Figure, and its `lead` variant (core) — built (VD-80)

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
  - The hover box also opens on focus (**aim**; IX-44 #844 is the
    containment half).
  - A hover target is at least 6 px wide at every width (**aim**; the 1180
    switch and §7's minimum mark width hold it).

### Table (core) — built (VD-82, AX-21, VD-84), but for sticky heads (VD-89 #901) and the race classification's own width below 1,010 px (IX-45 #848)

- **Job:** every row, sortable, copyable.
- **Parts:**
  - a caption or an h2 that names it (**floor**, AX-21);
  - sticky column heads;
  - a footer band holding the source line on the left and *Copy* and *CSV*
    on the right;
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

### Notes, attached notes and the disagreement box (core) — built (VD-78), but for the source line's band

| Block | Kind (text rule) | Frame |
|---|---|---|
| Section intro | free prose | none |
| Source line, "same on every row" | belongs to a box | footer band of its table or figure |
| Note box | framed | 3 px left edge; the box and its lines end together at the measure |
| Disagreement ("Two sources disagree") | framed | 1 px frame, 3 px left edge, spans the column; placed directly above the table it explains, as the shared-drive box already is |

### Photo strip (core) — built: the place (VD-83); pending: the columns (VD-86 #884)

- **Job:** what something looked like, credited.
- **Parts:** photo cards on column multiples: 4 to a row from 1180, 2 from
  768, 1 below. That removes today's 5 + 1 orphan. Each photograph is
  credited through `CommonsCredit` and **fails closed**: no attribution, no
  image (**floor**, the one attribution rule).
- **Place:** after the page's own sections and straight before *Where this
  comes from*, on every page type. They sat in five places until VD-83;
  `smoke.mjs` holds the place in both halves (§8, test 13).

### Outline card (core) — pending (AX-26 #509)

- **Parts:** the drawing on `--stage`, then a **heading or caption in words**:
  *Current layout, raced since 2010 · 5.891 km, 18 turns · outline: F1DB (CC
  BY 4.0), drawn by Jules Roy*. This replaces the schema line *F1DB layout
  silverstone-8 · …*, and the OpenStreetMap sentence appears only where a
  trace is drawn (content C10; AX-26 #509).

### Provenance and citation (core) — built: the name (VD-81); pending: the citation (CD-46 #631)

- **One name, *Where this comes from*,** on every page type, from
  `LABELS.provenance` in both renderers. It had three names, and "On the
  record" collided with `/records` (VD-81).
- **The citation** carries the *Behind this page* sentence on every page type
  (CD-46 #631). It is a framed note under the text rule.

### Keep going, and On this page

- ***Keep going* (core) — built:** unchanged. It is the best cross-page
  structure on the site (service).
- ***On this page* (optional in A) — not built:** a one-line list of the
  page's sections, under the tiles. It costs about 40 px of the first screen.
  A page may add it; none is held to it.

### States (core) — built: *Not established* and *Late*; Loading, Empty and Error pending (VD-86 #884)

| State | Rule |
|---|---|
| Loading | Skeleton rows in the component's own shape; the static page's content stays until the app replaces it in place |
| Not established | An em dash, never 0 (**floor**: `conventions.mjs` "a NULL is not established") |
| Empty | One sentence saying what is absent and whether it is expected to arrive |
| Late | A round whose results F1DB has not published yet says so (SD-37). A fresh race's pit stops say they usually arrive after the classification, not "F1DB records no pit stop" (SD-40) |
| Error | Says what failed and what still works |

---

## 4. Page templates — built: the order (VD-83) and the opening (VD-84), but for the season's *Who can still win* (VD-90 #904)

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
  (active drivers only; one statement, not a tile plus a note) · Season by
  season · Team-mates · Every entry.
- **Constructor:** lead chart (wins by season) · Season by season · Every
  win · Cars built · photographs.
- **Circuit:** the current outline in the slot (VD-74, VD-84) · winners
  first on **all 80**, not only the 13 with a layout timeline (S2) ·
  Constructors here · Every layout raced here (the timeline's rows or the
  other drawings behind one disclosure; absent where there are neither, and
  the slot's card then carries the rule) · Every race here.
- **Season:** *Who can still win* takes the lede position (VD-90 #904) ·
  lead chart · standings · calendar · Who entered · photographs. The
  photographs follow *Who entered* so that they sit where the photo strip
  puts them on every type (§3), which this line had the other way round.
- **Car:** tiles directly under the h1 · Why it mattered · Specification ·
  Every entry · photographs. This year's chassis opened on its photographs
  (I9, PD-49) until VD-83; the photograph that identifies a car is the
  opening slot's (VD-84), and the strip holds the rest.

### Event pages: race

Race pages follow the entity layout (DP-11): the header beside the outline
slot; tiles; the classification at full width; Grid to flag; qualifying; pit
stops; practice (folded); the timetable, once a result is held;
photographs. The classification never shares its
width with a side column (VD-84; beside the outline it lost Points and FL to
a scroll from 768 to 1,110 px), and a scheduled race leads with its
timetable (kept). Pending (IX-45 #848): the table is about 960 px wide on its
own, so below about 1,010 px Points and FL still scroll.
The slot is written after the classification, so below 1180 the outline
follows the result.

What it costs: the band is as tall as the outline, so at 1440 × 900 the
classification's heading and its first four rows are on the first screen,
where PD-57's tiles in the column beside the outline showed eight. The smoke
suite holds the four.

### Lookup pages: records, Grand Prix, registers, `/data`

Single column. On these pages a table or a card grid leads.

- Records cards align to the top of their row, so opening one derivation
  does not move its neighbours (I8).
- Registers keep their address contract.
- `/data` keeps its sub-navigation.

### Phone

One column, two edges. The order is the document order above. The race page
puts the classification before the outline (visual defect 7).

---

## 5. Content rules (core) — built: voice, NULL and one label per concept (VD-81), but for the registers' columns (CD-58 #893); dates (CD-57), but for a weekend in a sentence (CD-39 #499) and session times (CD-59 #900)

- **Voice:** plain, specific, from the reader's side. Name the thing the
  reader recognises. No notes to self in published prose (the Hamilton lede).
- **One label per concept:**
  - year span: *Seasons*;
  - entries: *Entries*;
  - provenance: *Where this comes from*;
  - a record: its *Value*, *Held by*, not *HOLDER*, on its tiles and in
    /records' tables.

  These are CD-12's vocabulary, applied: `LABELS` in `lib/site.js`, and
  `REPLACED` beside it lists the words they replaced, which the tests
  refuse. *Pending (CD-58 #893):* the `/constructors` and `/cars` register
  columns still say *Entered*, *Raced* and *Race entries*, declared in the
  test until that item moves them.
- **A disclosure or a link says what it opens.** A disclosure that repeats
  on a page carries what it belongs to for a screen reader, as a fold
  carries its table's name: *How it is derived, Most Grand Prix wins*. A
  photograph's credit link is the file's title as Commons heads its page,
  with no extension, and is named *…, on Wikimedia Commons* (DP-30, DP-31).
- **Figures in prose** go stale; a lede carries no count that a tile beside
  it also shows.
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
    with days in them), `date` on a tile, or `<DateText>`, `<RaceDates>`
    and `<Dated>` in `components/Dates.jsx`; `prerender.js` has a twin of
    each. A sentence built in a queries module keeps the ISO day and is
    drawn through `<Dated>`, so the words are shared and the date is each
    renderer's.
  - *Pending (CD-59 #900):* session times. The race timetable writes each
    start on the circuit's clock and in UTC, each zone named, and the app
    adds the reader's own zone; all three are in en-GB's form, with no
    `<time>`, and are not yet localised.
  - Data stays ISO: SQL, the JSON and Parquet exports, `f1.db`, a file or
    copy taken from a table (a weekend as an interval, `2026-03-27/2026-03-29`),
    and the SQL console. A day inside a longer token, a file name or a path,
    is that token's and is left as written.
  - The one exception is a Commons file's title on its credit link, which
    is printed as Commons heads the file's page (the attribution rule).
  - *Pending (CD-39 #499):* a weekend a sentence carries as words, in a
    scheduled race's standfirst and its Status tile, is in the house format
    and not yet in a `<time>`; CD-39 rewrites race standfirsts with human
    dates, from this formatter.
- **NULL** is an em dash, never zero (**floor**).
- **Uncertainty and disagreement:**
  - a disagreement is a framed note above the table it concerns, naming both
    sources and both values;
  - a derived-against-published pair always says which the page shows (DA-43
    #751);
  - an open gap is linked to `/data/quality`.
- **Captions:** at most 50 words. A caption explains how to read the figure
  and does not repeat what the figure shows.
- **Fold buttons and counts:** count the same unit in the heading and the
  button.

## 6. Interaction rules (core) — built in part

Built: the keyboard floor, but for reading order, a floor no test holds
yet (VD-86 #884); nothing moving at the handover (VD-79); and state in the
address and the one reveal control (VD-82).

- **Keyboard (floor):**
  - every control is reachable;
  - focus is visible;
  - the skip link works in both renderers;
  - reading order matches visual order. The side-by-side opening keeps
    header → tiles → slot, as it does today.
- **Hover equals focus (aim):** anything that opens on hover opens on focus
  and on tap.
- **State in the address (core):** register filters, entity-table sort and
  fold.
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
| DOM order equals reading order at every width; no grid placement lifts content above earlier markup | **floor**, not yet enforced | pending (VD-86 #884): the edge test also checks order |
| Focus on the h1 after the handover, on every page type | **floor** | `smoke.mjs` *The handover* (VD-79): eleven page types, the first a held cold load |
| Text contrast 4.5:1 and a chart series 3:1, in both themes | **floor** | `web/test/conventions.mjs` (AX-06, AX-07, VD-27) |
| Every table names its rows; one h1; focus to h1 on navigation | **floor** | `conventions.mjs` (AX-21), `smoke.mjs` |
| No meaning by colour alone | **floor** (1.4.1) | review, `frontend-reviewer` item 7 |
| Reflow at 400 and 320 px with no sideways page scroll | **floor** | smoke at 400 |
| Hover box opens on focus | **aim** | — |
| Revealing content moves focus to the first revealed item | **aim** | `smoke.mjs` *An exhaustive list opens on its first ten* (VD-82): opening a fold puts focus on row 11's row header, on screen |
| A disclosure's name says what it opens | **aim** | `smoke.mjs` *Both renderers draw one page* (VD-81): no two disclosures, and no two stand-alone links to different places, share a name on a smoke route |
| The tile strip carries a name | **aim** | — |
| Text 12 px or smaller is not also faint and longer than the small measure | **aim** (33–62 % of entity-page text is ≤12 px; zoom and reflow work, so this is not pressed against the design) | the measure tokens |
| Target size of at least 24 px for controls and 6 px for chart marks | **aim** | — |
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
    swaps the two halves only once the app's page is drawn. The lead charts
    the static driver, constructor and season pages still lack are VD-73
    (#822).
- **Small type on tiles and eyebrows (10–11 px mono, tracked).**
  - What the design gains: the instrument-panel identity.
  - What accessibility gives up: legibility at low DPI.
  - What keeps both: these are labels, not content, and they pass contrast.
    Raise their weight before their size (aim).

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
- `smoke.mjs` comparing every static table with the app's.

**The system's own tests, one each, so a drift fails the build.** Built in
VD-78: 1, 2, 3, 4, 8 and 9. Built in VD-79: 5 and 10. Built in VD-80: 6.
Built in VD-81: 7. Built in CD-57: 11. Built in VD-82: 12. Built in
VD-83: 13. Built in VD-84: 14.

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
   width. This is the test that would have caught 5–6 October.
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
   `queries/*.js` but the register columns declared until CD-58 (#893),
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
    shift stays under 0.05 (*The handover*).
11. **Dates are words.** No ISO day is visible text on any prerendered
    page in `dist/`, outside a `<time datetime>` attribute, `<code>`, the
    SQL console and a Commons file's title; the app writes the same
    `<time>` as en-GB, en-US and de-DE readers expect; and the handover is
    measured in en-US, where the dates change width (`smoke.mjs`, *Dates in
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
    circuits and a car, the slot is beside the header from 1180 px, level
    with the heading and to the page's right edge, the tiles run the full
    width under both, and below 1180 the slot follows in one column, after
    the tiles or a race's classification, in the app and, where it draws
    one, the static page. A column chart in the slot keeps every hover
    target 6 px wide at 1180, a team over `SLOT_MARKS` has no slot, and a
    page with nothing for it keeps its header and tiles the page's width
    (`smoke.mjs`, *The opening slot*).

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
- **`CLAUDE.md`, `CONTRIBUTING.md`, the backlog-item skill and the agents in
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
