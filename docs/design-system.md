# The Lap Ledger design system — a proposal in three versions

**Status: proposal, not built.** Written for VD-75 (#843) on 2026-10-06 from
the five critiques in
[`critiques/2026-10-06-design-pass.md`](critiques/2026-10-06-design-pass.md).
Nothing in `web/` changes until the maintainer chooses a version. That choice is
recorded on #843 as a decision. Until then, this file
describes what the site *should* hold, and says so wherever that differs from
what it holds today.

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

**How to read it.** Most of the system is the same in every version and is
marked **core**. The three versions differ in one thing, which is how a page
opens and how wide its columns run. Where they differ, the text says
**A**, **B** or **C**:

- **A — one grid, one opening slot.** A 12-column grid. Each entity page
  opens with its heading on the left and one picture slot on the right, from
  1180 px.
- **B — one reading column.** Every block starts at the left edge and ends at
  one of two right edges: the reading measure or the full width. This is the
  shape the static page already draws.
- **C — a reference entry.** A facts rail sits beside a reading column on
  entity pages, and event pages are single column.

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

### Where the tokens live today, and where they should

| Kind | Today | Proposed single source |
|---|---|---|
| Colour, type, weight, spacing, measure, page width, radius, fonts | `web/src/styles/tokens.css` | unchanged: `tokens.css` |
| Grid columns, gutter, spans, breakpoints | **nowhere.** Five rules pick their own (`app.css` `.page:has(.section-lead)`, `.split`, `header:has(.page-photo)`, `.with-outline`, `.outline-set`) | `tokens.css`, new block "grid" |
| Livery and national racing colours | `lib/liveries.js`, `lib/racingColours.js`, the `--racing-*` pairs in `tokens.css`, `--livery*` set per element in `app.css` | unchanged (they are data, with sources), with the token names listed here |
| Chart series and grid | `--series-1..3`, `--grid` in `tokens.css`; validator record in `charts/palette.js` | unchanged |
| Counts that shape a layout | `FOLD_TO = 10` (`lib/table.js`), `PHOTOGRAPHS_SHOWN = 6`, `PHOTOGRAPH_WIDTH = 600` (`lib/site.js`) | stay in JS, but listed in the token table below with one name each |
| Inline literals in JSX | `Circuit.jsx:230` and `Season.jsx:445` `marginTop: 34`, `Data.jsx` 18, `Records.jsx` −4, `LiveryScheme` 14, `BarChart` `fontSize 12.5` (VD-60, #615) | none. Each becomes a token or a class |

### Grid (new)

| Token | Value | Notes |
|---|---|---|
| `--page` | 1280 px (content 1232 between 24 px margins) | exists |
| `--margin` | 24 px, 104 px at 1440 (centred) | exists in effect, unnamed |
| `--columns` | 12 from 1180 px, 8 from 768, 4 below | new |
| `--gutter` | 24 px (`--space-8`) | new; replaces the 40, 24 and 16 px gutters the five rules use today |
| `--col` | `(content − 11 × gutter) / 12` | 80.7 px at 1440 |
| `--span-n` | `n × col + (n − 1) × gutter` | spans 4, 5, 6, 7, 8 and 12 are the ones in use |
| Breakpoints | `--bp-tablet` 768, `--bp-desktop` 1180, `--bp-wide` 1280 | new; **replaces the seven in use today** (480, 560, 600, 720, 760, 860, 1024) and the masthead's implicit wrap at 1099 |
| Test widths | 400, 768, 1024, 1440, plus 1180 for the switch | the four the maintainer named |

**Why 1180 for the switch, not 1024.** Between 1024 and 1180 a side column
costs a desktop reader more than it gives. The race classification loses
Points and FL to a scroll (141 px clipped at 1024). A lead chart's hover bars
are 3.7 px wide, against 6.0 px at 768 where it stacks. A side-by-side opening
starts at 1180 (interaction I3).

**A:** every page is the 12-column grid. **B:** the grid exists for spans and
the measure, but every block is one column. **C:** entity pages are 8 + 4
columns from 1180.

### Spacing — keep the scale, name the roles

The ten steps in `tokens.css` (2, 4, 6, 8, 10, 12, 16, 24, 40, 64) hold. The
visual critic found **no new literal in the thirteen changes**. The
proposal adds names for the roles the steps already play, so that a component
picks a role and not a number:

| Role | Step |
|---|---|
| Between sections | `--space-9` (40). Today it is 40 everywhere except two 74 px gaps from the inline `marginTop: 34` |
| Between blocks in a section; the gutter | `--space-8` (24) |
| Between a heading and its block | `--space-6` (12) |
| Inside a tile or frame | `--space-6` / `--space-7` |
| Between card siblings (photos, onward cards, record cards, outline cards) | `--space-6` (12). Today five gaps are in use: 8, 10, 12, 16 and 12/8 |

### Type — keep the scale, settle the middle register

The eight small steps and the two display clamps hold. **`--size-9/10/11`
(32/40/50 px) are documented as VD-53's "one number per page" and used
nowhere** (visual V7). The proposal is either to use them for the one hero
figure per page (A and C: the slot's or the rail's headline number), or to
delete them and the claim (B). Holding a token the stylesheet never uses is
the one choice the proposal rules out.

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
| One hero figure per page (A, C) | `--size-9`–`--size-11`, or deleted (B) |
| Page title | `--size-display` |

### Measure — one rule, two lengths, both on the grid

Today `--measure: 46ch` is one token, but `ch` scales with the type size, so
it draws **seven right edges**: 525 (lede), 515 (figure note), 483 (figure
caption), 463 (`.measure`), 417 (note), 370 (source note) and 304 (livery
band). None of them falls on a column line, and the framed boxes that
inherit it (disagreement 463, note box 417, citation 370) align with
nothing. The proposal:

| Token | Value | Holds |
|---|---|---|
| `--measure` | `max(var(--span-5), min(100%, 28rem))`, which is 499 px at 1440 and 448 px at 1024, so about 60–75 characters at 15–17 px | free prose at 15–17 px |
| `--measure-small` | `max(var(--span-4), min(100%, 22rem))`, which is 395 px at 1440, so about 60–72 characters at 12–13.5 px | credits and source lines |

From 1180 px both end on a column line. Below that they keep a floor in rem,
and below 768 everything runs the full column (at most 352 px at 400).

### Colour — unchanged, listed with one name each

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

### Radii, borders, elevation

| Token | Value | Use |
|---|---|---|
| `--radius` | 3 px | every framed box |
| `--radius-sm` | 2 px | pills, chips. **The disagreement box's literal `border-radius: 2px` becomes this** |
| Frame | 1 px `--rule` | one frame for tiles, figures, tables and cards (§3) |
| Emphasis edge | 3 px left border `--rule-strong` | note box and disagreement only |
| Elevation | `--shadow` | overlays only: the search palette, a table's hover box. Never a page block |

---

## 3. Components

Every recurring block, with its job, its parts, its widths and its states.
**Core** unless a version is named.

### The text-width rule (core, asked for on #843)

Every text block is one of five kinds. Its kind sets its width.

1. **Free prose** (a lede, a section's intro, *Why it mattered*, a timeline
   entry) keeps the **measure**.
2. **Text that belongs to a box** (a figure's method note, a table's source
   line, the "same on every row" line) is drawn **inside the box's frame**:
   a footer band with a hairline as wide as the box. Its lines stop at the
   measure. The band matches the table, and the text stays legible.
3. **A framed note** (disagreement, note box, citation, *Where this comes
   from*) is a box: **the box spans its column**, and its lines stop at the
   measure.
4. **Structured or short text** (field lists, tiles, one-line notes,
   buttons) has no cap.
5. **Below 768 px**, every kind runs the full column.

How the versions apply it:

- **A and B:** "its column" is the full content width (1,232 px at 1440), or
  the header column in A's opening band.
- **C:** "its column" is the 8-column reading column (808 px). Text in the
  rail uses `--measure-small`.

The result: **two text edges per page, both grid lines**, where today there
are seven.

### Page header (core)

- **Job:** say what this page is, and how to move along a sequence.
- **Parts:** eyebrow, h1, lede, stepper.
  - The **eyebrow** follows one rule: the page type, then the one fact that
    identifies the entity, for example *Driver · United Kingdom · born 7
    January 1985* or *Race · Round 12 of 24 · 6 July 2025*. This settles
    IA-09 (#253).
  - The **stepper** names its neighbours: *← 2025 Austrian Grand Prix*.
- **One component drawn by both renderers** (VD-56 #550, VD-71 #819 and
  VD-73 #822 close into it).
- **Widths:** the header column (A: 7 columns from 1180; B: full; C: 8
  columns). The lede is at the measure.
- **Accessibility:**
  - One h1 per page (**floor**).
  - Focus lands on the h1 after navigation *and after the handover from the
    static page* (**floor**). Today it falls to `<body>` on driver,
    constructor and season pages in 6 of 6 cold loads, because the h1 node
    is replaced when the page's query resolves.
  - A status region stays mounted and says when the page has changed
    (**aim**).
  - The page reads h1 → lede → the tile strip → a first h2 that is the
    page's lead answer, on every page type (**aim**; the accessibility
    critic's rule for predictability).

### Opening slot (A) · facts rail (C) · none (B)

- **A, the slot:** "the picture of this thing", 5 columns beside the header
  from 1180, after the tiles below that. What fills it:
  - driver, constructor and season: the lead chart;
  - circuit: the aerial photograph;
  - race: the outline;
  - car: its photograph.

  An empty slot gives its width to the header. The band is as tall as the
  taller of the two, and the tiles start under both, so nothing below is
  ragged.
- **C, the rail:** 4 columns from 1180. Its parts, top to bottom: the
  picture, then the identifying facts that sit in *On the record* at the
  foot today (born, nationality, base, length), then the tiles as a
  two-column list. Blocks run beside it until the first table wider than 7
  columns, which breaks out to the full width below it. Below 1180 the rail
  is a block after the header.
- **B:** no slot. The lead element follows the tiles at full width. On a
  race page the outline is the last tile of the strip; on a circuit page the
  outline and the photograph form one drawing section after the tiles.

### Tile strip (core)

- **Job:** the handful of figures the page is about.
- **Parts:** label (`--size-2` mono), figure (`--size-8`, or `--size-6` for a
  name), qualifier (`--size-3`).
- **Widths:** a grid, not a flex row. Every tile draws its own hairline (the
  option VD-46 #414 proposed), so a short last row ends against the page.
  There is **no ghost tile** (today's `.stats::after`) and no stretched lone
  tile.
  - One row where the strip fits at 125 px a tile. Nine tiles fit at 1440.
  - Otherwise, rows of equal count.
  - Two to a row below 560.
- **Labels from one vocabulary:** *Seasons* for every year span, and
  *Entries* everywhere (CD-12 #258).
- **States:** a value not established is an em dash (**floor**: the NULL
  rule).
- **Accessibility:** the strip is a `<dl>` with a name ("At a glance"),
  either as an `aria-label` or as a visually hidden h2 (**aim**).

### Figure, and its `lead` variant (core)

- **Job:** make one comparison visible.
- **Parts:** the section's **h2 is the figure's name**, with no second bold
  title. Then the plot. Then the **method note under the plot, on every
  figure**, not only the lead variant VD-67 reached. The note is cut to what
  stops a misreading, 50 words at most (content C1). Last, *The numbers behind
  this chart*, worded the same everywhere.
- **Widths:**
  - A: the slot (5 columns) for the lead figure, the full width otherwise.
  - B: the full width.
  - C: the reading column (8 columns).
- **States:** a figure with nothing to draw says so in one sentence in its
  place, and does not leave an empty frame.
- **Accessibility:**
  - Series are never colour alone; a second cue (shape, ring, label) carries
    the meaning (**floor** for 1.4.1).
  - The hover box also opens on focus (**aim**; IX-44 #844 is the
    containment half).
  - A hover target is at least 6 px wide at every width (**aim**; that is
    what B and the 1180 switch buy).

### Table (core)

- **Job:** every row, sortable, copyable.
- **Parts:**
  - a caption or an h2 that names it (**floor**, AX-21);
  - sticky column heads;
  - a footer band holding the source line on the left and *Copy* and *CSV*
    on the right;
  - the **fold**.
- **The fold is the one reveal control.** It applies to any table over 25
  rows unless the page opts out with a reason. Its button names its noun:
  *Show all 74 team-mate seasons*. It replaces the paged *Show the remaining
  144* on `/records`.
- **Sort buttons show focus** (**floor**, 2.4.7). Today
  `th.sortable button { all: unset }` (`app.css:870`) removes the ring on
  every table.
- **Opening the fold moves focus to the first revealed row** (row 11's row
  header, `tabindex="-1"`), so a keyboard user is not left 13,000 px below
  the rows (**aim**).
- **A disclosure's name says what it opens:** *How it is derived: most
  wins*, not the same four words twelve times (**aim**).
- **Sort and fold live in the address,** keyed by table name, the contract
  the registers already keep (IA-08). Back restores both, and with them the
  reader's place (interaction I2).
- **Widths:** the full content width (A, B), or the reading column, breaking
  out when wider than 7 columns (C). A table never sits beside a side column
  that clips it.

### Notes, attached notes and the disagreement box (core)

| Block | Kind (text rule) | Frame |
|---|---|---|
| Section intro | free prose | none |
| Source line, "same on every row" | belongs to a box | footer band of its table or figure |
| Note box | framed | 3 px left edge, spans the column |
| Disagreement ("Two sources disagree") | framed | 1 px frame, 3 px left edge, spans the column; placed directly above the table it explains, as the shared-drive box already is |

### Photo strip (core)

- **Job:** what something looked like, credited.
- **Parts:** photo cards on column multiples: 4 to a row from 1180, 2 from
  768, 1 below. That removes today's 5 + 1 orphan. Each photograph is
  credited through `CommonsCredit` and **fails closed**: no attribution, no
  image (**floor**, the one attribution rule).
- **Place:** after the page's own sections and before *Where this comes
  from*, on every page type. Today photographs sit in five places.

### Outline card (core)

- **Parts:** the drawing on `--stage`, then a **heading or caption in words**:
  *Current layout, raced since 2010 · 5.891 km, 18 turns · outline: F1DB (CC
  BY 4.0), drawn by Jules Roy*. This replaces the schema line *F1DB layout
  silverstone-8 · …*, and the OpenStreetMap sentence appears only where a
  trace is drawn (content C10; AX-26 #509).

### Provenance and citation (core)

- **One name, *Where this comes from*,** on every page type. Today it has
  three names, and "On the record" collides with `/records`.
- **The citation** carries the *Behind this page* sentence on every page type
  (CD-46 #631). It is a framed note under the text rule.

### Keep going, and On this page

- ***Keep going* (core):** unchanged. It is the best cross-page structure on
  the site (service).
- ***On this page* (B; optional in A and C):** a one-line list of the page's
  sections, under the tiles. It costs about 40 px of the first screen.

### States (core)

| State | Rule |
|---|---|
| Loading | Skeleton rows in the component's own shape; the static page's content stays until the app replaces it in place |
| Not established | An em dash, never 0 (**floor**: `conventions.mjs` "a NULL is not established") |
| Empty | One sentence saying what is absent and whether it is expected to arrive |
| Late | A round whose results F1DB has not published yet says so (SD-37). A fresh race's pit stops say they usually arrive after the classification, not "F1DB records no pit stop" |
| Error | Says what failed and what still works |

---

## 4. Page templates

The order is the *What leads* critique's (2026-10-05) unless this pass found
a reason otherwise. The shared ending, provenance then *Keep going* then the
citation, is already one system and is kept.

### Entity pages: driver, constructor, circuit, season, car

| | A | B | C |
|---|---|---|---|
| ≥1180 | header (7 columns) beside the slot (5); tiles full width; the type's sections full width | header; tiles (one row); *On this page*; lead element full width; sections | header and sections in 8 columns, beside the rail (4) until the first wide table; then full width |
| <1180 | header; tiles; slot; sections | the same | header; rail as a block; sections |

**Per type (the middle of the page, the same in every version):**

- **Driver:** lead chart (championship finishes) · the current season
  (active drivers only; one statement, not a tile plus a note) · Season by
  season · Team-mates · Every entry.
- **Constructor:** lead chart (wins by season) · Season by season · Every
  win · Cars built · photographs.
- **Circuit:** winners first on **all 80**, not only the 13 with a layout
  timeline (S2) · Constructors here · Every layout raced here (the current
  outline joins this section in A) · Every race here.
- **Season:** *Who can still win* takes the lede position · lead chart ·
  standings · calendar · photographs · Who entered.
- **Car:** tiles directly under the h1 · Why it mattered · Specification ·
  Every entry · photographs. Photographs move from first place (I9).

### Event pages: race

- **A:** the header beside the outline slot; tiles; the classification at
  full width; Grid to flag; qualifying; pit stops; practice (folded);
  photographs.
- **B and C:** single column. The outline is a tile; the rest follows the
  same order.
- **Every version:** the classification never shares its width with a side
  column, and a scheduled race leads with its timetable (kept).

### Lookup pages: records, Grand Prix, registers, `/data`

Single column in every version. On these pages a table or a card grid
leads.

- Records cards align to the top of their row, so opening one derivation
  does not move its neighbours (I8).
- Registers keep their address contract.
- `/data` keeps its sub-navigation.

### Phone (every version)

One column, two edges. The order is the document order above. The race page
puts the classification before the outline (visual defect 7).

---

## 5. Content rules (core)

- **Voice:** plain, specific, from the reader's side. Name the thing the
  reader recognises. No notes to self in published prose (the Hamilton lede).
- **One label per concept:**
  - year span: *Seasons*;
  - entries: *Entries*;
  - provenance: *Where this comes from*;
  - a record tile: *Held by*, not *HOLDER*.

  These are CD-12's vocabulary, applied.
- **Figures in prose** go stale; a lede carries no count that a tile beside
  it also shows.
- **Numbers:** tabular figures in every column. A season is printed as
  written, never as 1,950 (PD-63). A one-year span is printed once, never as
  *2023–2023*.
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

## 6. Interaction rules (core)

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
    order;
  - opening a disclosure never moves a sibling's control.
- **The service touchpoints** are part of the system:
  - the `/changes` page;
  - the late-results notice (SD-37);
  - `/build-status.txt`, written by the Parquet step and by `prerender.js`
    (`[D-10]`).

  Each says what is true now, in the voice above.

## 7. Accessibility: floor and aim

| Rule | Class | Held by |
|---|---|---|
| WCAG A/AA on the ten smoke routes | **floor** | axe-core in `web/test/smoke.mjs` (and 0 violations on 104 runs across 26 routes on 2026-10-06) |
| Every focusable element shows a visible change on `:focus-visible` | **floor**, not yet enforced; the table sort buttons and `/data/sql`'s examples fail it today | proposed: `conventions.mjs` refuses an `all: unset` selector with no `:focus-visible` rule |
| DOM order equals reading order at every width; no grid placement lifts content above earlier markup | **floor**, not yet enforced | proposed: the edge test also checks order |
| Focus on the h1 after the handover, on every page type | **floor**, not yet enforced | proposed: a smoke check on a held cold load |
| Text contrast 4.5:1 and a chart series 3:1, in both themes | **floor** | `web/test/conventions.mjs` (AX-06, AX-07, VD-27) |
| Every table names its rows; one h1; focus to h1 on navigation | **floor** | `conventions.mjs` (AX-21), `smoke.mjs` |
| No meaning by colour alone | **floor** (1.4.1) | review, `frontend-reviewer` item 7 |
| Reflow at 400 and 320 px with no sideways page scroll | **floor** | smoke at 400 |
| Hover box opens on focus | **aim** | — |
| Revealing content moves focus to the first revealed item | **aim** | — |
| A disclosure's name says what it opens | **aim** | — |
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
- **C's rail.**
  - What the design gains: the facts sit beside the reading.
  - What accessibility gives up: the rail comes after the header in the
    source, so a screen-reader user meets the facts before the lede's
    sections, which is the same order a sighted reader gets.
  - What keeps both: the rail is an `aside` with a heading.
- **The handover.**
  - What the design gains: VD-53's opening fills the first screen.
  - What it costs: not reading order, which is correct, but the jump when
    the app replaces the static page. It is felt by magnifier users and by
    anyone reading during a ~17 s cold boot.
  - What keeps both: the static page draws or reserves the same opening.
    The prerenderer already draws three charts on the static race page. B
    removes the jump by construction.
- **Small type on tiles and eyebrows (10–11 px mono, tracked).**
  - What the design gains: the instrument-panel identity.
  - What accessibility gives up: legibility at low DPI.
  - What keeps both: these are labels, not content, and they pass contrast.
    Raise their weight before their size (aim).

**No version needs a floor check relaxed.** If one ever does, the plan names
the check, the change and the reason as a separate decision for the
maintainer, and this pass loosens nothing.

## 8. How it stays true

The system is held by tests, not by memory.

**Already enforced (keep):**

- type, weight and spacing on the scales (`conventions.mjs`, VD-03);
- colour contrast for text, buttons and chart series, in both themes;
- the one attribution rule;
- NULL is never zero;
- every table names its rows;
- the fold at `FOLD_TO`;
- `smoke.mjs` comparing every static table with the app's.

**Proposed, one test each, so a drift fails the build:**

1. **Widths are spans.** Every `width`, `max-width` and
   `grid-template-columns` in `app.css` is a `--span-*`, `--measure*`,
   `100%` or `auto`, or carries a reason comment. This is the width
   equivalent of VD-03's scale test.
2. **Breakpoints are tokens.** Every `@media` width in `app.css` is one of
   the three breakpoints.
3. **No inline sizes in JSX.** No `style={{…}}` with a length literal in
   `web/src/pages` or `components` (VD-60 #615).
4. **Edges land on the grid.** `smoke.mjs` measures each top-level block of
   `main` on the driver, race and circuit pages at 1440 and 1024, and fails
   on a left or right edge that is not a grid line, the measure or the full
   width. This is the test that would have caught 5–6 October.
5. **One page, two renderers.** On every smoke route, the static page's
   section headings and their order equal the app's.
6. **One figure grammar.** `Figure` takes its note as a prop and renders it
   under the plot, and no page passes a second title.
7. **One vocabulary.** Tile labels and provenance headings come from one
   list in `lib/site.js`, and a test refuses a synonym.
8. **Tokens are used.** Every token defined in `tokens.css` is referenced
   somewhere, so `--size-9/10/11` either earn their place or go.
9. **Focus is visible.** `conventions.mjs` refuses an `all: unset` (or
   `outline: none`) selector that has no `:focus-visible` rule beside it.
10. **Focus survives the handover.** On a held cold load, `smoke.mjs`
    checks that focus is on the h1 after the app takes over, on every page
    type.

**How a change to the system is made.** A change to a rule here is a pull
request that edits this file and the token or test together. A change that
reverses a rule, or relaxes a floor check, also gets a `docs/DECISIONS.md`
entry, in the house form `[D-nn]`, because the next session has to know why.
A critique that finds a page off-system files the drift against the rule it
breaks, by name.

## 9. Where it lives

- **This file** is the record. It versions with the code, and a reviewer
  reads it.
- **`web/src/styles/tokens.css`** is the single source of every value. This
  file names tokens and never restates a value that could drift. The values
  in the tables above are there to support the decision; once a version is
  built, each table is replaced with a pointer to the token.
- **`web/test/conventions.mjs` and `smoke.mjs`** hold the rules.
- **The comparison page** linked from #843 is the picture for the decision.
  It is not a second source.

## 10. What the maintainer is asked to decide

1. **The version (DP-09):** A, B or C. §4 says what each costs and gives up; the
   design-pass critique gives the items each one closes.
2. **The middle type register (DP-10):** use it (A, C) or delete it (B).
3. **Whether race pages follow the entity template (DP-11, A)** or the event
   template (B, C).

The core sections (§3, §5, §6, §8) are the same under every answer, and can
be built first once a version is chosen. They are recommendations DP-01 to
DP-08 in the design-pass critique, which also lists, with ids, the defects
that exist whichever version is chosen.
