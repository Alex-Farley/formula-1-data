# Design pass — 2026-10-06

**The issue:** VD-75 (#843). The page layouts no longer align after the
5 and 6 October changes.

**Critics:** five lenses, run side by side:

- `visual-design-critic`
- `interaction-design-critic`
- `service-design-critic`
- `content-design-critic`
- `accessibility-critic`, added at the maintainer's request and weighted
  below an appealing visual design (#843, comment of 06:20).

**Subject:** the built site of `main` at `52c5959`, served locally. The
critics drove it in Playwright Chromium at 1440, 1024, 768 and 400 px, with
1180 and 1280 for the lead band. They covered both themes, and the app and
the static page, on every page type: home, driver, constructor, circuit,
race, season, car, records, the registers and `/data`. Positions are page
offsets in px, measured with `getBoundingClientRect`.

**The question (maintainer, 2026-10-06):** the thirteen layout changes of
5–6 October each landed well on its own, but together they have left the
pages misaligned. The changes were PD-57, PD-58, VD-67, PD-59, VD-49, VD-53,
VD-68, PD-60, PD-56, VD-69, VD-54, PD-30 and PD-64. The maintainer asked for
a full design pass with directions visualised, so that a direction can be
chosen before anything is built. Two additions came while the pass ran, and
both are answered here:

- a rule for **text-block widths**;
- the plan expressed as **one reusable design system**, in which the
  directions become versions.

**Ruled out, and not proposed:** the track atlas `[D-29]`, route-level code
splitting `[D-12]`, and anything that needs lap timing.

**Outputs:**

- this critique;
- the design system, proposed in three versions:
  [`docs/design-system.md`](../design-system.md);
- the visual comparison page, published at
  <https://claude.ai/artifact/R7hke1LCPEVgKQXTEivToB> and linked from #843. It shows the system's tokens,
  components and templates, and today's driver, race and circuit pages
  beside each version at 1440 and 400, clean and with grid and text-width
  guides.

The mockups are the real built pages with a prototype stylesheet and a small
DOM transform applied in the browser. They are not the app. **Nothing in
`web/` was changed.** This pass is a review: every finding is a
**recommendation with an id** (DP-01 onward, in the table near the end), for
the maintainer to accept or reject on #843. Sixteen defects were filed as
issues before the maintainer withdrew that part of the brief. They are left
exactly as filed, and the table names their numbers.

**The repository was not modified by any critic.** Their scripts and
screenshots stayed outside it.

---

## The three that matter

**1. There is no grid. Five two-column systems each picked their own
ratio, gutter and breakpoint.** *(visual V1, V2; service S1; interaction I4;
all drove the site)* None of the five agree:

| Rule | Columns | Gutter | Switches at |
|---|---|---|---|
| lead band | 1fr/1fr | 40 | 1024 |
| `.split` | 1fr/1fr | 24 | 860 |
| photo header | 1fr/20rem | 40 | 760 |
| `.with-outline` | 1fr/200px | 16 | 720 |
| `.outline-set` | 5fr/7fr | 24 | 720 |

At 1440 the circuit page has **eight distinct right edges** and the driver
page five. The right-hand column starts on four different lines across three
page types (732, 740, 1016, 1136). The side-by-side opening never closes at
the bottom: the figure column ends 79–320 px above the tiles. The tile strip
then draws an **empty tile** (233 px at 1440) to stop a lone tile
stretching, and on this site a blank reads as "not established". Every page
*ends* the same way and no two page types *start* the same way: the side
column holds a chart, a photograph, an outline or nothing, at 596, 320, 200
or 0 px.

**2. Each URL is two pages, and the swap between them moves the reader.**
*(visual V3; service S3; interaction I1; measured)* The static page, which a
search arrival reads for 7–8 s at 10 Mbps, is single-column with no lead
chart. The app is two columns. The handover scores a **cumulative layout
shift of 0.52–0.55** on driver, constructor, season and race pages, against
Google's "poor" threshold of 0.25. A reader scrolled to *Qualifying* is
moved 307 px when the app takes over. VD-73, VD-72, VD-71, VD-56 and PD-37
each hold one drift. The cure is one page-header component drawn by both
renderers, or a layout the static page already draws (version B).

**3. The same thing is done differently from page to page.** *(content
C1–C3; interaction I5–I7; service S2)* Examples:

- **Figures:** two grammars. The note sits under the plot on lead figures
  and above it on every other figure; on Hamilton's page both appear 400 px
  apart. Every figure also carries two titles.
- **Labels:** five labels for a year span, four for entries, three names for
  the provenance section.
- **Circuit pages:** the 13 circuits with a layout timeline put winners
  first; the other 67 put layouts first.
- **Revealing the rest:** five different controls do it.
- **Photographs:** placed in five different positions.

**And the maintainer's text widths.** One token, `--measure: 46ch`, applied
at five type sizes, draws **seven text widths**: 525, 515, 483, 463, 417, 370
and 304 px. None of them sits on a column line. The framed boxes that inherit
it (disagreement, note box, citation) align with nothing. The rule below
replaces it.

## Where the five agree, and where they part

All five agree on the core:

- one grid token set;
- one figure grammar;
- one vocabulary;
- one reveal control;
- one section order per page type;
- tiles without the ghost;
- the static page and the app drawing the same page.

They part on the opening:

| Critic | A — one grid, one slot | B — one reading column | C — reference entry |
|---|---|---|---|
| Visual | grid tokens first, under any version | **leans B**: the only version that removes the ragged bottoms and the re-flow, not masks them | too narrow for a chart at 4 columns |
| Interaction | **supports A**, switching at 1180, plus *On this page* | one reading order; larger hover targets | — (proposed *On this page* as an add-on instead) |
| Service | best only if VD-73 ships with it | **strongest**: fixes the static/app gap for free | pragmatic as "two templates" |
| Content | A's vocabulary first, whatever follows | **preferred over C** because the copy is written for linear reading | the strongest unifier in words, costs most |
| Accessibility | neutral to positive **if** the static page shares the grid and no placement lifts content above earlier markup | best for assistive technology by construction, but **not argued over A** under the maintainer's weighting | a fixed slot is best for predictability; its reading-order rule goes into the core |

## The text-width rule

Every text block is one of five kinds, and its kind sets its width. The full
statement, with tokens, is in `docs/design-system.md` §3.

1. **Free prose** (a lede, a section intro) keeps the **measure**: 5 columns,
   about 500 px at 1440, which is 60–75 characters at 15–17 px.
2. **Text that belongs to a table or figure** (a method note, a source line,
   the "same on every row" line) is drawn **inside the box's frame**: a
   footer band with a hairline the width of the box. The band matches the
   table, and the lines stop at the measure.
3. **A framed note** (disagreement, note box, citation, provenance) spans its
   column, and the lines inside stop at the measure.
4. **Structured or short text** (fields, tiles, one-line notes) has no cap.
5. **Below 768 px**, everything runs the column.

The result is two text edges per page, both on grid lines, where today there
are seven. The comparison page shows today's widths beside each version's on
the driver, race and circuit pages at 1440 and 400, with the column guides
drawn. Text is tinted by kind: blue for prose, orange for text that belongs
to a box, green for framed notes.

## The directions, as versions of one system

Each version is the same design system (`docs/design-system.md`) with a
different answer to how a page opens and how wide its columns run. The core
(§3, §5, §6 and §8 of that file) is shared and can be built first.

### A — One grid, one opening slot (M–L)

**What changes:**

- A 12-column grid with a 24 px gutter.
- From 1180 px each entity page opens with its header in 7 columns and one
  **slot** in 5, "the picture of this thing":
  - the lead chart on driver, constructor and season pages;
  - the aerial on circuit pages;
  - the outline on race pages;
  - the photograph on car pages.

  The tiles take one full-width strip under both.
- The race classification runs full width.
- Card grids sit on column multiples (photographs 4-up).

**What it costs:** grid tokens and the opening band (S, plus
`prerender.js`), the card grids (S) and tiles (S). VD-73 becomes mandatory,
because the slot must be drawn statically too, or the re-flow grows.

**Closes or absorbs:** VD-46 (#414), VD-53's ragged bottom (partly), VD-74
(#823, it answers "the aerial is the slot"), and the race clipping.

**Gives up:**

- The opening band is still as tall as its taller half, so a gap remains
  under the shorter one.
- The slot's chart is 499 px at 1440, narrower than B's.
- Between 1180 and 1280 the chart's marks are small.

### B — One reading column (S–M)

**What changes:**

- VD-53's side-by-side, `.with-outline` and the photo-header grid are
  retired.
- Every block starts at the left edge and ends at the measure (prose) or
  the full width (tiles, figures, tables).
- The lead element follows the tiles at full width.
- On race pages the outline becomes the strip's last tile.
- On circuit pages the outline and the aerial become one drawing section.
- *On this page* sits under the tiles.

**What it costs:** mostly deletion (S), then the core.

**What it buys:**

- This is the shape the static page already draws, so the handover
  re-flow, the ghost tiles and the ragged bottoms go together.
- A single reading order at every width.
- The largest charts and hover targets.

**Closes or absorbs:** VD-46, most of VD-73's visible cost, and the race
clipping.

**Gives up:**

- At 1440 the right half of the first screen beside the lede is empty
  again, which was the *What leads* complaint behind VD-52 and VD-53.
- The circuit's top-right aerial goes.
- At 1440 the lead chart starts near y 540–770 instead of y 127, though it
  is still on the first screen.

### C — Reference entry: a facts rail on entity pages, single column on events (M–L)

**What changes:**

- On entity pages from 1180, a 4-column **rail** holds the picture, the
  identifying facts and the tiles as a two-column list. The identifying
  facts (born, nationality, base, length) sit at the foot of the page
  today.
- An 8-column reading column carries the header, the lead figure and the
  sections.
- A table wider than 7 columns breaks out to the full width below the rail.
- Race, Grand Prix, records and registers are single column, as in B. This
  is service's "two templates" and content's "reference entry", combined.

**What it costs:** the rail component and its prerender (M), plus the
template split (S).

**What it buys:**

- The biography reaches the first screen.
- The tile strip stops wrapping, because the rail lists the tiles.
- Every entity page has the same right-hand vocabulary.

**Gives up:**

- The reading column is 808 px, so wide tables break out and the page has
  two widths.
- The rail competes with the circuit aerial for the same column (VD-74).
- It costs the most of the three.
- On race pages it would leave a blank beside a short header, which is why
  events stay single column.

## What every version shares: the core, in build order (DP-01 to DP-08)

1. Grid tokens, the measure tokens and the text-width rule. Three
   breakpoints replace seven.
2. Tiles: a per-tile hairline, no ghost, rows that fill.
3. One page-header component drawn by both renderers. VD-56, VD-71, VD-72
   and VD-73 close into it.
4. One figure grammar: the h2 names the figure; the note goes under the
   plot, 50 words at most.
5. One vocabulary: labels, eyebrow, provenance and fold buttons (CD-12 #258,
   IA-09 #253).
6. One reveal control (the fold over 25 rows), and table state in the
   address.
7. One section order per page type. Photographs go before provenance
   everywhere; circuits put winners first on all 80; car pages put tiles
   first.
8. The tests in `docs/design-system.md` §8, so the next run of layout
   changes fails a check instead of drifting.

## Recommendations, for the maintainer to accept or reject

Each recommendation has an id, so that a ruling on #843 can name it:
*accept DP-01–DP-08, B for DP-09, reject DP-24*. The comparison page lists
the same ids, with an accept and reject toggle beside each and a button that
copies the choices as text to paste into #843.

The table has four groups:

- the design system's core;
- the maintainer's three choices;
- defects that exist whichever version is chosen: bugs, wrong facts and
  broken behaviour;
- items already on the queue that this pass would rank higher.

Sixteen of those defects were filed as issues (#848–#863) before the
maintainer withdrew the filing part of the brief. They are left untouched,
and the *Issue* column names them. #862 and #863 were created while the
board was refusing writes, so they carry their labels but may not be on the
board. Nothing else was filed.

**Core: the design system, under any version**

| Id | Recommendation | Lens | Size | Issue |
|---|---|---|---|---|
| DP-01 | Grid and measure tokens, and the text-width rule: a 12/8/4-column grid with a 24 px gutter, `--measure` and `--measure-small` on column spans, and three breakpoints in place of seven | visual, accessibility | M | — |
| DP-02 | Tiles: each tile draws its own hairline, there is no ghost tile, and rows fill evenly (absorbs VD-46, #414) | visual, interaction | S | — |
| DP-03 | One page-header component that both renderers draw, with focus on the h1 after the handover (VD-56, VD-71, VD-72 and VD-73 close into it) | all five | M | — |
| DP-04 | One figure grammar: the h2 names the figure, there is no second title, and the note goes under the plot, 50 words at most, on every figure | content, visual, interaction | S | — |
| DP-05 | One vocabulary: Seasons, Entries, Where this comes from; one eyebrow rule; a stepper that names its neighbours; fold buttons that name their noun (CD-12 #258, IA-09 #253) | content | S | — |
| DP-06 | One reveal control: the fold, on any table over 25 rows. Table sort and fold go in the address, and focus moves to the first revealed row | interaction, accessibility | M | — |
| DP-07 | One section order per page type: photographs before provenance everywhere, winners first on all 80 circuits, and tiles first on car pages | service, content, interaction | S | — |
| DP-08 | The design-system tests (§8 of docs/design-system.md): widths are spans, breakpoints are tokens, no inline sizes, edges on the grid, one page in two renderers, focus visible, focus survives the handover | all five | M | — |

**The maintainer's choices**

| Id | Recommendation | Lens | Size | Issue |
|---|---|---|---|---|
| DP-09 | Choose the version of the opening: A (one grid, one slot), B (one reading column) or C (reference entry) | decision | — | — |
| DP-10 | The middle type register (32/40/50 px): use it (A, C) or delete it (B) | decision | — | — |
| DP-11 | Race pages: the entity opening with an outline slot (A), or the single-column event template (B, C) | decision | — | — |

**Defects that exist whichever version is chosen**

| Id | Recommendation | Lens | Size | Issue |
|---|---|---|---|---|
| DP-12 | The race classification loses Points and FL to a scroll beside the outline column from 768 to 1,110 px | interaction | S | #848 |
| DP-13 | Back after opening a fold on an entity page lands at the page footer: sort and fold are not in the address | interaction | M | #849 |
| DP-14 | Opening one record card's derivation stretches its whole row and moves the neighbours' controls | interaction | S | #850 |
| DP-15 | The masthead navigation wraps to two rows from 900 to 1,099 px and three at 768 | visual | S | #851 |
| DP-16 | On /cars/red-bull-rb19 the 'Two sources disagree' box touches the Specification source note | visual | S | #852 |
| DP-17 | Every title chart from 1991 on says 'Before 1991 only a driver's best few results counted' | content | S | #853 |
| DP-18 | An active driver's first screen states the current season twice, and mixes 'P1' and '3rd' in one strip | content | S | #854 |
| DP-19 | Fangio's team-mates heading counts 46 drivers and its fold button 74 rows | content | S | #855 |
| DP-20 | Hamilton's lede says 105 wins above a tile that says 106, and ends with a note to self | content | S | #856 |
| DP-21 | Car specifications and their meta descriptions print a literal `<hr>` on 24 modern cars | content | S | #857 |
| DP-22 | 57 meta descriptions print a one-year span as a range, 'Red Bull RB19, 2023–2023' | content | S | #858 |
| DP-23 | A circuit's 'Every race held here' counts the scheduled race as held: 62 against the tile's 61 | service | S | #859 |
| DP-24 | A race's note replaces the winner sentence in its lede, so /races/2026/16 never says who won | service | S | #860 |
| DP-25 | A race two days old says 'F1DB records no pit stop for this race' as if no stop happened | service | S | #861 |
| DP-26 | A circuit page's section order depends on whether the register holds a layout timeline | service | S | #862 |
| DP-27 | The column-sort buttons in every table never show keyboard focus (2.4.7) | accessibility | S | #863 |
| DP-28 | At the handover, focus falls to `<body>` on driver, constructor and season pages, and nothing says the page changed | accessibility | S | — |
| DP-29 | 'Show all' on a folded table leaves focus thousands of pixels below the reader | accessibility | S | — |
| DP-30 | Twelve 'How it is derived' and five 'The numbers behind this chart' disclosures share one name on /records | accessibility | S | — |
| DP-31 | A photograph's credit link is named after its file, 'Circuit de Monaco, April 1, 2018 SkySat (cropped).jpg' | accessibility | S | — |

**Items already on the queue that this pass would rank higher**

| Id | Recommendation | Lens | Size | Issue |
|---|---|---|---|---|
| DP-32 | Raise VD-56 (#550): the static page's missing eyebrow keeps the race page shifting after VD-73, and the measured handover CLS is 0.52 | service | S | — |
| DP-33 | Raise AX-23 (#416): the title ring on the driver chart (1.83:1 light, 2.23:1 dark) is now on the first screen of every driver page | accessibility | S | — |

Already on the queue, and seen again by this pass with new evidence:

- **VD-46 (#414):** lone and ghost tiles.
- **VD-73 (#822), VD-56 (#550) and PD-37 (#424):** the handover. A measured
  CLS of 0.52 argues VD-56 up, because VD-73 alone leaves the race page's
  shift.
- **CD-12 (#258) and IA-09 (#253):** labels and eyebrow, now five meanings.
- **CD-46 (#631):** *Behind this page* on four page types.
- **CD-11 (#257) and CR-53 (#646):** meta descriptions.
- **UR-14 (#507):** raw engine ids in the season constructors' standings.
- **VD-60 (#615):** inline literals, including the 74 px gaps.
- **IX-44 (#844):** hover boxes clipped.
- **DA-43 (#751):** 250 against 251 Ferrari wins with no sentence saying
  which.
- **AX-26 (#509):** the outline heading.

---

The five critiques follow, each in its own section, condensed only where a
critic repeated a table another had made.

---

## 1. Visual design

**Critic:** `visual-design-critic` (Opus). Drove 24 routes at 1440, 1024, 768
and 400, light and dark, plus 1180 and 1280 for the lead band; measured
`getBoundingClientRect` and computed styles against `tokens.css` and
`app.css`. Evidence tags: **[drove]** measured in the DOM, **[source]** read
the source, **[inference]**.

**The short answer:** the 5–6 October changes kept to the spacing and type
scales, but nothing in the system defines a grid. Each change chose its own
column ratio, gutter and breakpoint, and that is why boxes no longer line up.

### The three that matter

**V1. Five two-column systems and no grid. Every one is on the spacing scale;
none of them agree.** [drove + source] · *Defect (coherence)*

| Rule | Columns | Gutter | Where it switches |
|---|---|---|---|
| `.page:has(.section-lead)` | 1fr / 1fr | 40 | two columns from 1024 |
| `.split` | 1fr / 1fr | 24 | stacks below 860 |
| `header:has(.page-photo)` | 1fr / 20rem | 40 | two columns from 760 |
| `.with-outline` | 1fr / 200px | 16 | stacks below 720 |
| `.outline-set` | 5fr / 7fr | 24 | stacks below 720 |

`tokens.css` has a spacing scale but no column or gutter token, so each
change picked a different step. Section-level edges at 1440:

| Page | Left edges | Right edges |
|---|---|---|
| Driver | 104, 740 | 474, 521, 629, 700, 1336 |
| Race | 104, 1136 | 474, 521, 629, 1120, 1336 |
| Circuit | 104, 732, 1016 | 474, 521, 567, 607, 629, 708, 976, 1336 |

At 1024 the pattern repeats (driver 24/532, race 24/800, circuit
24/524/680); at 768 the race is 24/544 and the circuit 24/424; at 400 every
page collapses to 24/376. The right-hand column starts on four lines across
three page types — 732, 740, 1016 and 1136 — and on `/seasons/2025` the gap
shows as a step: the lead figure starts at x 740 and *Final constructors'
standings*, directly below, at 732 (532 against 524 at 1024).

**V2. VD-53's side-by-side opening never closes at the bottom, and the tile
strip invents an empty tile to cope.** [drove] · *Defect*

- The right column ends 79–320 px above the left one at every width from
  1024 to 1440 (Senna 79, Hamilton 196, Ferrari 308 at 1440; Ferrari 297 at
  1024). A block of empty page sits under every lead figure.
- **The ghost tile.** `.stats::after`, added so a lone tile does not stretch,
  draws a blank cell in the tile's panel colour with the hairline round it:
  233 px wide at 1280–1440 (beside Hamilton's *2026 so far*, Ferrari's
  *Drivers' titles*, every season's *Margin*), 208 px at 1180, a 19–69 px
  sliver at 1024. On a site where a blank means "not established", an empty
  tile reads as a missing value.
- The last row's tiles land on edges that match neither row above
  (Hamilton's *2026 so far* ends at x 467; the column lines are 402 and 550).

**V3. The static page and the app are two layouts, so every driver,
constructor and season page re-flows when React takes over.** [drove] ·
*Defect*

Static `/drivers/hamilton` at 1440 draws the tiles in one 1,232 px row at
y 354; the app draws them 596 px wide at y 498 in three rows with the figure
beside. `/seasons/2025` re-flows the same way, and the static circuit and
season pages stack the `.split` tables the app puts side by side. The static
page is also, already, the calmer layout (Direction B).

### Further findings, by consequence

**V4. Three card idioms and five card-grid gutters.** [drove + source] ·
*Defect (coherence), mild.* Hairline-joined tiles (`.stats`, 1 px gap, mono
10 px labels); separate bordered cards with sentence-case 13.5 px semibold
labels (VD-68's record cards, gap 12); borderless outline cards. Gutters:
photographs 12, onward cards 10, outline strip 8, outline grid 16, record
cards 12 (8 on a phone). Widths that match nothing: photo cards 237, onward
cards 301 or 404, record cards ≈299. A record card and a stat tile do the
same job in two typographic voices.

**V5. The race page has two table widths and a 1,340 px empty column.**
[drove] · *Defect (PD-57 and PD-30 together).* Classification and *Grid to
flag* sit in a 1,016 px column beside a 200 px outline column; the outline
card ends near y 660 and its column is empty to about y 2,000; *Qualifying*
then widens to 1,232. Twin tables run 1,016 against 1,232 (504 against 720 at
768) and the right edge steps from 1,120 to 1,336 between consecutive
sections.

**V6. Figures follow two grammars on the same page.** [drove] · *Defect
(coherence).* VD-67 put the caption under the plot only on lead figures. On
`/drivers/hamilton` the lead dot plot has a 30 px title and the note below;
the *2026 season so far* figure under it carries 115 px of method text above
its plot. On `/races/2025/12`, *Pit stops* carries 172 px above its plot.

**V7. The middle type register exists only in the token file.** [source] ·
*Defect (stated system against execution).* `--size-9/10/11` (32/40/50 px)
are documented as "one number per page… (VD-53)"; `app.css` uses none of
them, and nothing on the 24 routes renders between 25 px and the display h1.
This is the 2026-09-21 critique's finding 1, unresolved, with tokens now
claiming it is fixed.

**V8. The spacing scale has not drifted.** [drove + source] Every
block-level spacing value is a step, apart from em-relative mono padding and
the inline literals VD-60 (#615) already lists (Circuit.jsx:230 and
Season.jsx:445 `marginTop: 34`, Data.jsx 18, Records.jsx −4, LiveryScheme 14,
BarChart `fontSize 12.5`). No new literal arrived with the thirteen changes.
One effect has got worse: the inline 34 now sits right after the lead band,
making the gap before *Final standings* and *Most wins here* 74 px where
every other section gap is 40.

**V9. Text-measure boxes.** [drove] · *Preference, leaning defect.*
`--measure: 46ch` is applied at four sizes: source notes 370, notes 417,
`.measure` 463, ledes 525. For prose this is defensible and documented, but
bordered elements inherit it (the disagreement aside at 463, the note box at
417, the cite aside at 370), so their box edges align with nothing.

### What is well made — keep it through any fix

- The outer edges are exact: 104/1336 at 1440 and 24/(width−24) below, on
  every route, width and theme; the masthead aligns to them.
- Vertical rhythm is 40 px between sections on all six pages measured, apart
  from V8's 74.
- 400 px is genuinely one system: two edges, one column.
- Dark geometry is identical to light, and dark is stepped, not inverted.
- The record cards are well built in themselves: shared row height, aligned
  disclosures.
- The tile figure ranks hold: 25/17 px Saira Condensed on every page type.

### Directions (visual)

- **A. Tighten to one grid — M, three S pieces.** (1) Grid tokens and the
  opening bands: `--gutter` 24 and a 12-column track at `--page`; the lead
  band, the photo header, `.with-outline` and `.split` share the gutter on
  column lines (lead band 6/6 or 7/5, circuit photo 4 columns ≈392, race
  outline 2 columns ≈185) and one breakpoint. (2) Card grids on column
  multiples: photographs 4-up instead of auto-fill 5-up (which removes the
  5+1 orphan), onward and record cards 4/3-up, one gap token. (3) Tiles:
  VD-46's option 2, a per-tile hairline, so a short row ends against the page
  and the ghost goes. *Gives up* nothing a reader would miss, but does not
  close V2's ragged bottoms or V3's re-flow.
- **B. A calmer single-column reading layout — S, mostly deletion.** Retire
  the lead-band grid, `.with-lead` and the `.page-photo` header grid. Every
  section starts at the left edge and ends at one of two right edges: the
  measure for prose, full width for tables, figures and strips. The lead
  figure follows the tiles at full width; the race outline joins the tile
  strip; the circuit photograph and outline become one drawing section. This
  is what the static page already draws, so the re-flow, the ghost tiles and
  the bottom mismatch all go. At 1440 a nine-tile strip is one row and
  Hamilton's plot lands near y 540–770, still on the first screen; at 1024 it
  lands partly below [inference]. *Gives up* the space beside the lede (the
  what-leads finding 1) and the circuit's top-right photograph.
- **C. One opening template for every entity type — M–L.** The same right
  slot from 1024, 4 of 12 columns, on every entity page; the header and tiles
  take 8; the slot's frame stretches to the left column's height so the
  bottoms meet. *Gives up* chart width (392 px at 1440, ~300 at 1024, too
  narrow for a 20-season dot plot [inference]) and the race page's
  classification-beside-outline, and keeps the re-flow unless the prerender
  gains the slot.

*Lean, labelled as such:* take A's grid tokens and tile fix first, then
choose B or C for the opening; the discipline leans B, the only one that
removes V2 and V3 rather than masking them.

### Defects worth fixing under any direction

1. Ghost tile — all lead-band pages ≥1024, both themes.
2. Lone tile stretched (VD-46, open) — `/circuits/monaco` 768, `/cars/red-bull-rb19` 768.
3. 8 px column step — `/seasons/2025` ≥1024.
4. Masthead nav wraps — two rows at 900–1099 px (66 → 90 px, pushing every h1 down 25 px in VD-53's band), three rows at 768 (126 px).
5. Photo grid orphan — six photographs break 5+1 at 1440 (`/seasons/2025`, `/races/2025/12`).
6. Twin table widths on race pages ≥768 (V5).
7. Outline before the result on a phone — `/races/*` at 400: classification starts at y 1,092 (2025/12), 1,197 (1955/1).
8. Two figure grammars (V6).
9. Collision — `/cars/red-bull-rb19` 1440: the *Two sources disagree* box touches Specification's source note (−1 px).
10. 74 px gap before the `.split` on seasons and circuits (V8).
11. Unused middle register (V7).
12. Blank beside the outline — `/circuits/silverstone` 1440: a 503 px drawing and ≈730 × 564 px of blank.

**Not examined:** 320 px, device scale 2, colour-vision simulation,
keyboard, `/compare`, `/now`, a Grand Prix page; the `/cars` register's
full-page capture failed (70,000 px).

---

## 2. Interaction design

**Critic:** `interaction-design-critic` (Opus). Drove 24 routes at 1440,
1180, 1024, 768 and 400 (light), 8 of them again in dark at 1440, 1024 and
400, a width sweep from 900 to 1440 on the entity pages, a JavaScript-off
pass, and a simulated slow first visit (the database request held 9 s).

### The three that matter

**I1. Every page has two layouts, and the swap between them moves the
reader.** *(drove; defect.)* The prerendered page — what a search arrival or
a cold visit reads for the first ~14–30 s (the 2026-09-21 measurement) — has
none of the 5–6 October layout: no lead chart on driver, constructor or
season pages, Ferrari's description *under* the tiles, season standings
stacked, the race page's practice tables expanded (static 8,120 px tall, app
6,710). Scrolled to a section on the static page and let the app take over:

- `/drivers/hamilton`: a reader at *Team-mates* ends up in *Every entry*.
- `/races/2025/12`: a reader at *Qualifying* ends up at *Pit stops*, 307 px past it.
- `/constructors/ferrari`: *Every win* drops 278 px.
- `/seasons/2025`: *The calendar* rises 160 px.

This is VD-73 (#822), VD-72, VD-71, VD-56 and PD-37, filed one drift at a
time, and worse since the thirteen changes. **Fix:** one page-header
component both renderers draw (eyebrow, h1, lede, prev/next, tiles, lead
slot), and close the drift items into it.

**I2. The same table behaves differently by page type.** *(drove; defect,
made worse by VD-69.)* Registers put filter and sort in the address
(`/drivers?q=sen&kind=winners&dir=asc`), which survives Back; on entity pages
sort and the fold do neither. Back now loses the reader's place: on
`/drivers/hamilton`, open *Show all 396*, click row 200 (2018 French GP),
press Back — the fold closes and scroll is restored against the shorter page,
landing in the footer (scrollY 4,705). IX-16 (#146) closed as part of IA-08,
which landed only on registers. **Fix:** the registers' address contract
(sort plus fold) on entity-page `DataTable`s, keyed by table name.

**I3. The 1024–1440 band costs a desktop reader what phone and tablet
readers keep.** *(drove; defect.)*

- **The race page's outline column clips the result.** The 200 px column runs
  the full length of the classification; from **1,110 px down to 768 px**,
  Points and FL scroll out of the table (141 px clipped at 1024, 383 px at
  768), with only a fade to say so — undoing PD-57's purpose.
- **The lead chart is smallest on desktop:** 446–574 px wide beside the
  heading, 698 px at 768 where it stacks. Ferrari's hover bars are **3.7 px at
  1024** against 6.0 px at 768: the mouse reader, the only one with hover,
  gets the smallest targets.

**Fix:** the race outline into the header's right slot so the
classification runs full width; start the side-by-side at 1180, not 1024.

### Full findings, by consequence

- **I4. Each page type puts something different in the right-hand slot.**
  Driver, constructor, season: a chart beside the header, with hover and a
  disclosure. Circuit: an aerial *inside* the header. Race: an outline beside
  the tiles, then a column down the classification. Car (762 of 1,159 pages):
  nothing, with photographs *first*. Records, Grand Prix, home: nothing.
  **Fix:** declare the slot once as "the picture of this thing", right of the
  h1 and lede, with the tiles under both. *Defect of consistency.*
- **I5. A lead figure's note is under the plot; every other figure's is
  above.** `/drivers/hamilton` lead note 127 px below; *2026 season so far*
  115 px above; *Grid to flag* 134 px and stint windows 172 px above;
  `/records` and `/data/quality` above. **Fix:** below, on every `Figure`.
- **I6. Circuit order depends on the data** (`Circuit.jsx:186–316`): 13 of 80
  get PD-60's order; on `/circuits/monaco` *Every layout* fills y 572–1,309
  and *Most wins here* starts at 1,342 (1,168 on Silverstone). **Fix:** winners
  before layouts on all 80, the grid behind the same disclosure.
- **I7. Five controls reveal "the rest" of something:** VD-69's summary row
  inside the table box (*Show all 251*); the paged table's bordered button,
  right (*Show the remaining 144*, `/records` Grand slams); *45 more
  photographs* at body size outside any box; *Practice sessions* at h2 size;
  *Each layout with its drawing, and what changed*. Folding happens only where
  a page asks: a car's *Every entry* (32 rows) shows in full while a driver's
  (51) folds; *Who entered* (35) shows in full. **Fix:** the fold replaces the
  paged button and applies to any table over 25 rows unless a page opts out.
  *Defect for the two table controls; preference for the wording.*
- **I8. Opening one record card's derivation moves its neighbours.** On
  `/records` at 1440 all four cards stretch 126 → 258 px and three summaries
  jump 132 px. **Fix:** `align-items: start` on the card grid.
- **I9. Car pages still open on photographs:** 762 of 1,159, with no lede;
  tiles headed *In figures* only when photographs exist. **Fix:** tiles under
  the h1, photographs below the entries table.
- **I10. Fangio's team-mates: heading 46, control 74.** Count one unit.
- **Shared, owned by visual:** the masthead wraps at 1,040 px and below
  (shifting every page 24–59 px where VD-53 switches on); tile rows end
  ragged with an empty bordered patch of 20–233 px; the lead slot leaves up
  to 320 px of gap under the chart (Ferrari, 1180).

### Directions (interaction)

- **A. One grid — M–L.** One header band on every entity type: left the
  eyebrow, h1, lede, prev/next and tiles; right the picture slot (chart,
  aerial, outline or photo), tiles spanning full width when the slot is
  empty. Starts at **1180**, stacks below. The race outline moves into the
  slot. One reveal control (the fold, over 25 rows), every note below its
  plot, entity-table state in the address; the band drawn by both renderers.
  Gives up little at 1440; below 1180 the chart moves under the tiles.
- **B. A calmer single column — S–M.** VD-53's side-by-side and the race
  outline column removed; one reading column, lead figure after the tiles at
  every width, wide tables breaking out. One reading order at every width; a
  ~720 px chart everywhere (bigger hover targets than today at 1024–1440);
  the handover jump shrinks to the drift alone. Gives up: at 1440 the chart
  moves to ~y 700–800 and the right half of the first screen is empty again.
- **C. "On this page" (S, adds to A or B).** A one-line list of the page's
  sections under the tiles; a reader who cannot predict where a section sits
  can jump to it, and Back has something stable to restore against. Costs one
  control and ~40 px of the first screen.

*Discipline's view:* A, with C if the orders cannot all be unified.

### Defects worth fixing whichever direction is chosen

1. `/races/:y/:r`, 768–1,110 px: Points and FL clipped by the outline column.
2. Any folded entity table: Back after opening a fold lands at the footer; fold and sort not in the address.
3. Driver, constructor, season static render: no lead chart, a different order, a 160–307 px move at handover (VD-73 and siblings).
4. `/drivers/hamilton`: method note below one chart and above the next.
5. `/circuits/monaco` and 66 others: layouts before winners.
6. `/records`, 1440 and 400: opening one derivation stretches the row.
7. `/records` Grand slams: *Show the remaining 144* (button, right) against *Show all N* (summary, left).
8. `/cars/mclaren-mcl40`: Specification → Engine prints a literal `<hr>` (content/data owns).
9. `/drivers/fangio`: heading 46, control 74.
10. `/races/2025/12` pit stops, 1440: Copy/Download wrap left under a long footnote (minor).
11. All pages at 1024: *Data* alone on a second masthead row.

### Keep

The side-by-side never inverts reading order (header → tiles → lead figure
→ next section at every width); dark moves nothing; *The numbers behind this
chart* opens the same way everywhere (a 300 px scroll box; opening it in the
lead slot moves the next section 41 px); the fold mechanics (focus stays on
the summary, sorting reorders the full set, *Copy all 251* says what it
copies); PD-57 at 400 (classification from y 3,024 to 1,127); register state
in the address (IA-08) and Copy/CSV on every table (IX-26); *Keep going* the
same everywhere, prev/next only where pages are a sequence; shared tile order
(span, entries, wins first).

**Not examined:** Safari, Firefox, touch, screen readers; `/compare`, `/now`,
`/changes`, `/data/sql` beyond layout; real network throttling (the database
request was delayed instead); current and upcoming race variants; print.

---

## 3. Service design

**Critic:** `service-design-critic` (Opus). Drove the app and the static
(JS-off) page at 1440, 1024, 768 and 400, light and dark, on the entity
pages, variants (`/races/2026/16`, `/races/2026/17`, `/seasons/2026`,
`/circuits/sepang`, `/circuits/marina-bay`, `/cars/ferrari-f2004`,
`/grands-prix/british`, `/records/most-wins`), the registers and `/data/*`.
Positions are page y at 1440 unless stated.

### The three that matter

**S1. Every page type has a top band, but no two page types build it the
same way.** *(drove; defect — the misalignment the maintainer describes,
seen as a service.)* Each of the thirteen changes picked its own answer for
its own page type, and nothing defines the parts every type should share. At
1440:

- **Beside the heading:** a 596 px chart at x 740 (driver, constructor,
  season); the 320 px aerial at x 1016 (circuit); nothing (race, car, Grand
  Prix, record, registers).
- **The heading column:** 596, 872 or 1,232 px wide.
- **The tile strip, three shapes:** 596 px wrapping 4+3+1 with blank cells
  (driver, constructor, season); 1,232 px in one row (circuit, car, Grand
  Prix); ≈1,015 px beside a 200 px outline (race).
- **Previous/next:** full width on race (Next at x 1,336), but stopping at
  x 700 on season, where it sits in the left column. Driver, constructor and
  circuit have none.
- **Photographs, in five places:** in the header (circuit); straight after
  the tiles (car); mid-page (constructor); after the calendar (season); next
  to last (race). Driver pages have none.

A reader going race → season → driver meets three different first screens.

**S2. On circuit pages, whether a back-office table has rows decides the
section order.** *(drove, read PR #829; defect.)* PD-60 put winners first only
at the 13 circuits with a layout timeline; the other 67 keep layouts above
winners.

| Circuit | This week | Opens on | *Most wins here* at 1440 | at 400 |
|---|---|---|---|---|
| Marina Bay | next race | winners | y 1,227 | y 1,583 |
| Sepang | last race | layouts | y 1,260 | y 1,426 |
| Monaco | (no timeline) | layouts | y 1,342 | — |

At 400 the "winners first" page shows its winners *lower* than the
"layouts first" page, because the large outline in its top band comes first.

**S3. A search arrival sees a different page, then watches it rebuild.**
*(drove, measured; known in parts, worse since VD-53.)* On driver,
constructor and season pages the static page is one column with no chart
(and on constructor and season, tiles before the lede). Throttled to
10 Mbps it stays up for **7.2–7.8 s**; the swap then scores a cumulative
layout shift of **0.52** on all three pages measured (0.54–0.55 unthrottled;
Google's "poor" threshold is 0.25). The race page shifts too, though its
order matches — by inference because the static page lacks the 26 px eyebrow.
VD-73 (#822), VD-56 (#550) and PD-37 (#424) cover the pieces; new here is
the number, and that VD-73 alone will not fix it (the race page's shift
stays), so VD-56 should rank higher. Direction B shrinks this gap for free.

### Where each part sits, by page type (1440, app)

| Part | Driver | Constructor | Circuit | Race | Season | Car | Grand Prix | Record |
|---|---|---|---|---|---|---|---|---|
| Eyebrow | "Driver" | "Constructor" | location | "Round 12 of 2025" | **none** | maker | country | **none** |
| Lede | yes | yes | yes | generated, or the race note | yes | yes / **none** (AFM 6) | yes | **none** |
| Beside the heading | chart | chart | aerial | — | chart | — | — | — |
| Previous/next | — | — | — | full width | left column | — | — | — |
| Tiles | 596 wrapped | 596 wrapped | 1,232 | ≈1,015 + outline | 596 wrapped | 1,232 | 1,232 | 1,232 |
| What the reader came for | tiles + chart, y 127 | chart, y 127 | winners y 1,168 **or** layouts | classification, y 487 | chart + standings, y 755 | photo, then *Why it mattered* | *Most wins*, y 723 | tiles |
| Long lists folded to 10 | yes | yes | yes | no | no | **no** (36 rows) | **no** (78, 43) | — |
| Photographs | none | middle | header | next to last | after calendar | first | none | none |
| Provenance section | *On the record* | *On the record* | *Traced and measured* + *On the record* | **Where this comes from** | **The season on the record** | *On the record* | *On the record* | *How it is derived* + *On the record* |
| Keep going | yes | yes | yes | yes | yes | yes | yes | yes |
| "Behind this page" | yes | **no** | **no** | yes | **no** | **no** | **no** | **no** |

Every page *ends* the same way — provenance, *Keep going*, the citation.
The end of the page is one system and the start is not; the 5–6 October
changes all worked on the start, each on one type.

### Journeys

- **A search arrival two days after a race** (`/races/2026/16`): the lede
  says *"The Bahrain Grand Prix of 2026 is hosted at Sepang, Malaysia"* and
  not who won (the only race of 1,165 with a `note`; `raceLede()` lets the
  note replace the winner sentence, `web/src/queries/race.js:588`). *Pit stops*
  says F1DB records none, as if permanent, while every other 2026 round holds
  9–50. *Keep going* → the 2026 season, where the standings "after round 16"
  are at y 3,241 at 1440 and y 5,580 at 400.
- **A fan before Singapore:** home → `/races/2026/17` leads with the
  timetable (good) → Marina Bay (winners first) → Sepang (layouts first) →
  the season page, where previous/next has moved from the right edge to the
  middle.
- **A journalist on `/constructors/ferrari`:** *Wins* 251 → *On the record*
  "251 derived · 250 published" with the rule → the citation's digest. It
  works, but "Behind this page" appears only on driver and race pages
  (`sources=` passed only in `Driver.jsx:341` and `Race.jsx:305`).

### Directions (service)

- **A. One grid with fixed parts — M.** Eyebrow, h1 and lede left; one
  *beside-the-heading slot*, always one width, filled by whatever leads the
  type (chart; aerial; the car photograph, today a 236 px thumbnail below the
  tiles; the race outline, moved up); previous/next always full width under
  the header; tiles always one full-width strip; photographs always just
  before provenance; provenance under one name; one circuit order. *Gives
  up:* the slot must be narrower than 596 px or the tiles fall below the
  first screen between 1024 and 1280; the race loses its full-width strip;
  VD-73 becomes mandatory.
- **B. A calmer single-column page — M.** Header, lede, one full-width tile
  row, the lead element full width, the type's own sections, then a closing
  reference band (folded lists, photographs, provenance, *Keep going*,
  citation). Static and app become the same shape — the only direction that
  removes most of S3 without first prerendering three charts. *Gives up* the
  ≈700 px blank beside the lede at 1440 and puts the lead chart near y 500–600.
- **C. Two layouts by what the reader came for, written down — S–M.** Event
  and lookup pages (race, Grand Prix, record, registers) single column with
  the table leading; shape and place pages (driver, constructor, season,
  circuit, car) take A's fixed parts. *Gives up* one system: race → season
  still changes shape, but always the same way.

*Discipline's view:* B is strongest (it fixes the static/app gap); C is
pragmatic; A is best only if VD-73 ships with it.

### Defects worth fixing under any direction

1. `/races/2026/16`: the lede is the race note, not who won. Let the winner sentence lead.
2. `/races/2026/16`: "F1DB records no pit stop for this race" two days after it; say stops usually arrive after the classification.
3. `/circuits/silverstone`, `/circuits/monaco`: *Every race held here* counts 62 and 73 against tiles of 61 and 72 — the scheduled 2027 race is counted as held.
4. Every circuit: section order depends on whether a layout timeline exists.
5. `/seasons/*` at 1440 and 1024: previous/next ends at the left column.
6. `/cars/ferrari-f2004`, `/grands-prix/british`: VD-69's fold is missing (*Every entry* 36 rows; *Every edition* 78; *Most wins* 43).
7. Every page type but driver and race: no "Behind this page" sentence in the citation.
8. Every page at handover: CLS 0.52–0.55, including race pages.
9. The provenance section has three names (content design owns the fix).

### Keep as they are

The end of every page (provenance → *Keep going* → citation) — *Keep going*
is the best cross-page structure on the site; breadcrumbs, identical in both
renderers; the race page's change of state (timetable before, classification
after); the current season's "Next session — in 3 days" tile and the date on
`/records`; dark-theme positions identical to light.

**Not examined:** `/compare`, `/now`, the glossary, the eras page; the
registers below 1440; keyboard and screen-reader paths; loads slower than
10 Mbps; the static page at 400; real readers.

---

## 4. Content design

**Critic:** `content-design-critic` (Opus). Extracted every heading, lede,
tile label, figure caption, note, disclosure label, title and meta
description, with positions, on all sample routes at 1440, with 1200 dark,
1024 and 400 screenshots; compared the app's headings with the prerendered
HTML; scanned all 3,714 meta descriptions in `web/dist`; queried `f1.db` for
counts. Content does not change between themes or widths; each finding holds
at every width in both themes unless stated.

### The three that matter

**C1. Every figure has two titles and one of two caption orders; Hamilton's
page shows both orders 400 px apart.** *(drove; defect — two orders in one
system.)* VD-67 (#817) moved the method note under the plot only on the
three lead figures. Every figure also has an h2 *and* a bold title of its
own:

| Page | h2 | Figure title | Note | Words in note |
|---|---|---|---|---|
| Driver (lead) | Where each championship finished | Final standing by season | below | **97** |
| Constructor (lead) | Wins by season | Race wins by season | below | 22 |
| Season (lead) | How the title was decided | Points after each round, 1976 | below | 32 |
| Driver, active | The 2026 season so far | Sir Lewis Hamilton's finishes, round by round | **above** | 68 |
| Race | Grid to flag | Where each car started, and where it ended | **above** | 78 |
| Race (PD-56, new) | Pit stops | Each driver's race, split where they stopped | **above** | **126** |

**C2. The same slot is labelled differently on each page type.** *(drove,
read the source; defect.)*

- **Year-span tile and column — five labels for one idea:** *Seasons*
  (driver), *Entered* (constructor), *Grands Prix* (circuit, where the value
  is "1950–2026"), *Raced* (car), *Span* (Grand Prix).
- **Entries — four labels:** *Entries*, *Race entries*, *Recorded entries*,
  and *Races* on /cars. "Every entry · 396 races" uses two in one heading.
- **Provenance — three names:** *On the record*, *Where this comes from*
  (race), *The season on the record* (season).
- **Eyebrow — five meanings, absent on seasons:** page type, location,
  position, parent constructor. IA-09 (#253) counted four; it has got worse.
- **Stepper:** seasons name their neighbours ("← 1975 season"); all 1,196
  race pages say only "← Previous race / Next race →"
  (`lib/wayfinding.js:555`).

VD-49 (#821) made the tile strips data in `queries/*.js`, so most of this is
now a handful of label strings.

**C3. Section order varies within one page type, and the most basic
reference facts are at the foot.** *(drove; defect for the order, mostly
preference for the biography.)* Circuits have two orders (C8); photographs
sit in a different place on each type (car pages still put them straight
after the tiles — RB19 photographs at y 555, specification at 1,170); a
driver's nationality and date of birth appear only in *On the record* at the
foot (y 3,936 on Hamilton, y 2,500 on Fangio, at 1440).

### Section order on each page type, as rendered

| Type | Order now |
|---|---|
| Driver | DRIVER · H1 · lede · livery note · tiles · **lead figure** · (active only) 2026 so far · Season by season · Team-mates · Every entry · On the record · Keep going |
| Constructor | CONSTRUCTOR · H1 · lede · livery note · tiles · **lead figure** · Season by season · Photographs · Every win · Cars built · On the record |
| Circuit (13) | location · H1 · lede · aerial · tiles · unheaded outline · Most wins here / Constructors here · Every layout · Every race held here · trace note · On the record |
| Circuit (67) | … tiles · **Every layout** · Most wins here / Constructors here · Every race held here · "No layout timeline" box · Traced and measured · On the record |
| Race | ROUND n OF yyyy · H1 · lede · stepper · tiles + unheaded outline · (shared-drive box) · Classification · Grid to flag · Qualifying · Pit stops · Practice (folded) · The cars in this race · Where this comes from |
| Season | *(no eyebrow)* · H1 · lede · stepper · tiles · **one or two unheaded notes** · **lead figure** · standings ×2 · Calendar · Photographs · Who entered · The season on the record |
| Car | constructor name · H1 · lede (curated cars only) · tiles · **Photographs** · Why it mattered · Specification · Every entry · On the record |
| Grand Prix | country · H1 · lede · tiles · Where it has been held · Most wins · Every edition · On the record |

### The full set, by consequence

- **C1 fix — one rule for figures (S).** The h2 is the figure's name; drop
  the bold title; the note goes under the plot on every figure, cut to what
  stops a misreading. Rewrites: driver lead (97 → 49 words) *"Final
  championship position each season; a ring marks a title. Each dot takes
  the colour of the team the season ended with, hollow where none is recorded
  (1968–2009). A season with points and no dot is one the driver was excluded
  from."*; grid to flag (78 → 31) *"Straight lines from grid slot to finishing
  place, so a crossing is not an overtake at that point. A dashed line ending
  in a cross is a driver not classified."*; pit stops (126 → 49) *"Each bar is
  one driver's race, in finishing order, broken where they stopped. The record
  holds only the lap of each stop, not its length, the tyres or the time
  gained, and F1DB's stop record has gaps: an unbroken bar is not proof of no
  stop."*
- **C2 fix — "Before 1991 only a driver's best few results counted…" sits on
  every title chart from 1991 to 2026, where it is false (S).**
  `progressionNote()` (`queries/season.js:402`) is unconditional, raised on
  2026-09-21 and worse now that PD-58 and VD-53 put the chart on the first
  screen of 36 season pages. Show it only before 1991; otherwise *"Points
  after each round for the three drivers who finished highest."*
- **C3 fix — the 2026 season twice on an active driver's first screen (S,
  caused by PD-59).** The tile *2026 SO FAR · 3rd · 214 points* and, 100 px
  below, the note saying the same. Drop the note; head the section **"2026,
  round by round"**. One position form in one strip: *P1* beside *3rd* today.
- **C4 — Team-mates "46" against "Show all 74" (S, caused by VD-69).** Put the
  noun in every fold button: **"Show all 74 team-mate seasons"**, **"Show all
  251 wins"**, **"Show all 51 photographs"**.
- **C5 — one label per slot (S, one diff over label strings).** **Seasons**
  for every year span; **Entries** everywhere; **Where this comes from** for
  every provenance section ("On the record" collides with /records and with
  "the race records" in notes). Absorbs the label half of CD-12 (#258).
- **C6 — one eyebrow rule: the page type, then the one fact that identifies
  the entity (S, against IA-09 #253).** *Driver · United Kingdom · born 7
  January 1985*; *Constructor · Italy · Maranello*; *Circuit · Silverstone,
  Northamptonshire, United Kingdom*; *Race · Round 12 of 24 · 6 July 2025*
  (also gives race pages the date CD-39 #499 asks for); *Season · 24 rounds,
  all run*; *Car · Red Bull Racing · 2023*; *Grand Prix · United Kingdom*.
- **C7 — name the race neighbours (S):** "← 2025 Austrian Grand Prix" /
  "2025 Belgian Grand Prix →".
- **C8 — one section order per page type (S each):** winners first on all 80
  circuits; car photographs after *Specification*; on seasons, put *Who can
  still win* in the lede position and move *The grid* into *Who entered*.
- **C9 — lede and tile contradict on the first screen (S).** On
  `/drivers/hamilton` the lede *"Record holder for wins (105 at end-2025)"*
  sits above the tile *WINS 106*, and ends with a note to self (*"Start/win
  totals move with the 2026 season"*, CD-54, still live). Rewrite without a
  figure so it cannot go stale.
- **C10 — two lead "figures" have no heading (S).** The circuit and race
  outlines are unheaded, with schema-shaped captions ("F1DB layout
  silverstone-8 · …"); the OSM sentence appears on race pages that show no
  trace, and twice on Silverstone's. Rewrite: **"Current layout, raced since
  2010 · 5.891 km, 18 turns · outline: F1DB (CC BY 4.0), drawn by Jules
  Roy"**. AX-26 (#509) is related.
- **C11 — schema text in tables and snippets.** Season constructors'
  standings show raw engine ids (*Brabham `alfa-romeo`*, UR-14 #507);
  *"Lineage chain · maranello"* and *"First Grand Prix (stored)"* in *On the
  record*; record tiles labelled **VALUE / HOLDER** (rewrite **"Wins · 106"**,
  **"Held by · Sir Lewis Hamilton"**).

### Directions (content)

- **A. One grid — S–M, mostly strings.** C1–C8 as one vocabulary, and a fixed
  order with type-specific middles: eyebrow · H1 · lede · stepper · tiles ·
  lead · body · photographs · Every … · Where this comes from · Keep going. The
  lead figure's h2 becomes the page's second-loudest line, so it should read
  as an answer (*How the title was decided* works; *Wins by season* is
  weaker — consider **"When Ferrari won"**). Gives up nothing in words.
- **B. A calmer single column — M.** The lead figure follows the tiles, so the
  h2 reads in document order and the double title is easy to drop; notes sit
  under what they qualify; the lede can widen and carry two sentences (the
  race standfirst from CD-39 fits); a short **"On this page"** line under the
  tiles answers length in words. Gives up the first-screen chart at 1440.
- **C. The reference-entry pattern: a facts panel beside the reading column —
  M–L.** A fixed right-hand panel on every entity page holds the identifying
  facts now at the foot (born, nationality, base, length, dates) and the
  tiles; the left column reads lede → lead → sections. The strongest unifier
  in words; competes with the circuit aerial (VD-74 #823) and costs most.

*Discipline's preference:* A's vocabulary first (it pays off whichever layout
follows), then B over C, because the copy is already written for linear
reading.

### Defects worth fixing under any direction

1. Literal `<hr>` text on 24 modern car pages and in their meta descriptions (`chassis.engine_name`, 24 rows; `engine_config`, 11).
2. 57 meta descriptions with a one-year span written as a range ("2023–2023").
3. 49 of 61 `/records/:key` meta descriptions are schema prose (CR-53 #646).
4. The "Before 1991" note on 36 post-1991 title charts.
5. `/drivers/fangio`: "46 team-mates" against "Show all 74".
6. `/drivers/hamilton`: lede 105 wins, tile 106; the lede carries a maintainer note.
7. All race pages: unnamed "Previous race / Next race".
8. Circuit pages: two section orders.
9. `/circuits/silverstone`: "Every race held here 62" against "Championship races 61" (the scheduled 2027 race).
10. Season constructors' standings: raw engine ids.
11. `/constructors` register 250 Ferrari wins against the page tile's 251, neither saying which (DA-43 #751).
12. `/data`: "one of five confidence tiers" above a ladder of six (CD-51), and "1950-2027" with a hyphen.

### Keep

The *Every …* heading family and the circuit page's *… here* suffix; the race
photographs note (*"taken wherever and whenever that was, not necessarily at
this race"*); the constructor lead note at 22 words, the model length; *The
numbers behind this chart*, worded identically everywhere; the shared-drive
box on `/races/1955/1`; the season ledes; *Keep going*, which gives reasons.

**Not examined:** `/compare`, `/now`, `/changes`, `/reference/eras`,
`/glossary`; register filter empty states; the static first paint beyond
headings; a 2026 race at Sepang listed as the "Bahrain Grand Prix" (a data
question).

---

## 5. Accessibility

**Critic:** `accessibility-critic` (Opus), added as a fifth lens at the
maintainer's request (#843, 06:20). It is **weighted below an appealing
visual design**: its findings are ranked against the visual direction, not
over it, and the enforced floor stays as it is.

**How it was run:** the critic drove Playwright Chromium at 1440, 1280, 1024,
768, 720 (200 % zoom at 1440), 400 and 320 px, light and dark, with reduced
motion, forced colours, JavaScript off, and a cold load throttled to 4 Mbps.

**No real screen reader was available.** Claims about assistive technology
come from Chromium's accessibility tree, read over CDP, and from observed
focus.

**The automated layer is clean.** axe-core with the smoke suite's tags
(`wcag2a wcag2aa wcag21a wcag21aa wcag22aa`, 64 rules) ran 104 times: 26
routes × 2 themes × 2 widths. It found **zero violations**. Everything below
is something a scanner cannot see.

### The three that matter

**A1. The column-sort buttons in every table never show keyboard focus.**
*2.4.7 Focus Visible (AA). Defect.*

- **Where:** every route with a table, at every width, in both themes. That
  is 10–31 buttons a page, plus the 12 example buttons on `/data/sql`.
- **Cause:** `th.sortable button { all: unset }` (`app.css:870`) outranks
  the global `:focus-visible` rule at line 62. `.example { all: unset }`
  (line 2572) wins on source order.
- **History:** it dates from `b41a0c2` (5 September), so the 5–6 October
  changes did not cause it. Both earlier audits missed it, and axe cannot
  see it.
- **Fix, at no visual cost:** a 2 px accent outline on `:focus-visible`.
  It measures 5.0–5.9:1 on every surface.

**A2. At the handover, focus is lost every time on the three page types
VD-53 gave a lead figure.** *2.4.3 Focus Order (A) and 4.1.3 Status Messages
(AA). Defect; the open half of the old AX-01, and worse on the redesigned
pages.*

- **The trials:** a cold load at 4 Mbps, with the handover at about 17 s.
  - On driver, constructor and season pages, focus ended on `<body>` in **6
    of 6** trials.
  - On race, circuit, car and the drivers register, it landed on the h1 in
    **4 of 8**.
- **The cause:** `main.jsx:80` focuses the h1 two frames after the static
  page is removed. The h1 is apparently replaced again when the page's query
  resolves (an inference from the DOM).
- **What the status region says:** its last words are "Querying the
  database…", and then it empties.
- **What a magnifier user sees:** on Hamilton the tile strip goes from
  1232 × 109 at y 354 to 596 × 280 at y 498, and every section below moves
  300–700 px.
- **Fix:** focus the h1 once the page's own data has resolved, or keep the
  h1 node stable. Write one sentence into a status region that stays
  mounted.

**A3. "Show all" on a folded table leaves focus up to 13,000 px below the
reader, and announces nothing.** *Usability with assistive technology; 2.4.3
arguable.*

- **On `/constructors/ferrari`, *Every win*:** after Enter, focus stays on
  the summary, now at y 9,769, while the viewport has not moved. The next
  Tab jumps past all 241 revealed rows.
- **Fix that keeps the design:** move focus to row 11's row header
  (`tabindex="-1"`).

### Alignment and the grid, in accessibility terms

What holds:

- **Reflow (1.4.10):** clean on 24 routes at 320, 400, 768 and 1024 in the
  app, and on the static pages at 320.
- **Reading and focus order match the visual order.** A Tab walk of 70 stops
  on 11 entity pages found no backward jumps beyond the deliberate column
  reads. VD-53's design (`app.css:2153`) works.
- **200 % zoom at 1440** gives a 720 px layout, so a zoomed reader always
  gets one column. The cost is first-screen value (tiles at y 511, the
  figure at y 779), not access.
- **Chart text** stays 11–12.5 px at every width.
- **Text spacing (1.4.12) and target size (2.5.8)** are clean, apart from
  inline links in a run-in sentence (exempt).

Where the pages do not read as one system, from this side:

- **The first section heading means a different thing on each page type:**
  the lead chart on driver, constructor and season pages; *Classification*
  on race pages; *Every layout raced here* on circuit pages. The tile strip
  has no name or heading anywhere.
  - On the race page, 422 characters are read before *Classification*,
    because the outline card sits between the tiles and the result in the
    DOM.
  - On the driver page the livery note is read before the career tiles.
- **Line length:** ledes and notes respect `--measure` (median 65 characters
  a line). Three things bypass it:
  - VD-67's `.figure-note` (`max-width: calc(60ch + …)`, line 2670) runs
    **89–93 characters** at 12 px in faint ink;
  - figure-caption method text runs 91–94;
  - `.fields` reaches 111 at 1024.
- **Disclosures are named three ways.** The folds append the table's name
  for screen readers ("Show all 251, Every win"). *How it is derived* (12 on
  `/records`) and *The numbers behind this chart* do not, so out of context
  they are identical.
- **Type size:** 33–62 % of visible entity-page text is 12 px or smaller.
  Zoom and reflow work, so this is **not pressed against the visual
  design**. It is an aim, and it matters only where the text is also faint
  and long-lined.

**Where design and accessibility pull apart.** VD-53's side-by-side figure
gains a full first screen at 1024–1440. It does not cost reading order. It
costs the jump at the handover, felt by magnifier users and by anyone
reading during the ~17 s boot. Both can be kept: the static page could hold
the same opening, with the slot drawn or reserved. The prerenderer already
draws three charts on the static race page, so this is achievable.

### Directions (accessibility)

*The critic was briefed with an earlier wording of the third direction, "one
fixed opening slot per entity type". Its rule for that direction is taken
into the core of every version, below.*

- **A — one grid (S on top of visual's work):** neutral to positive, on two
  conditions:
  - the static page uses the same grid, which removes the handover jump;
  - no grid placement lifts content above something earlier in the DOM.
    `.with-lead > .outline-card { grid-row: 1 / span 2 }` already does this
    mildly on race pages.

  Gives up nothing in accessibility terms.
- **B — single column (M):** best for assistive technology. DOM order equals
  visual order by construction, there is no handover jump, the measure is
  easy to apply everywhere, and there is room to raise prose size. It gives
  up the first-screen figure at 1440, which is a design loss. Given the
  weighting, the critic does **not** argue B over A on accessibility grounds:
  the margin is small if A meets its two conditions.
- **A fixed slot or rail (S on top):** best for screen-reader predictability.
  Pair it with one rule on every page type: h1 → lede → the tile strip as a
  labelled `<dl>` ("At a glance") → the first visible h2 is the page's lead
  answer.

### Proposed rules

**Floor — should be enforced.** None is enforced today except where noted.

- Every focusable element shows a visible change on `:focus-visible`. A
  smoke check would tab through and compare outline and box-shadow, or
  `conventions.mjs` would refuse an `all: unset` selector with no
  `:focus-visible` rule.
- DOM order equals reading order at every width.
- After the handover, focus is on the h1 on every page type (a smoke check).
- **Already enforced, keep:** no body scroll at 320 px; every chart is
  `role="img"` with a sentence label and its own table; the axe run; the
  contrast checks.

**No version needs any of these relaxed.**

**Aim:**

- every prose block uses the measure, figure notes and captions included;
- a disclosure's name says what it opens;
- revealing content moves focus to the first revealed item;
- the tile strip carries a name.

### Defects worth fixing whichever direction is chosen

1. Sort buttons with no focus ring (`app.css:870`), and `/data/sql`'s example buttons (`app.css:2572`). 2.4.7.
2. The handover drops focus on driver, constructor and season pages. The status region's last words are "Querying the database…".
3. The fold strands focus below the revealed rows (`/constructors/ferrari`, `/drivers/hamilton`).
4. AX-23 (open), more prominent now. The title ring on Hamilton's chart is 1.83:1 in light and 2.23:1 in dark: `opacity: 0.5` is applied after the 3:1 check, and VD-53 put that chart at the top of every driver page.
5. AX-27 and AX-26 (open), unchanged.
6. Long, small figure notes: 89–93 characters at 12 px in faint ink (covered by the text-width rule).
7. Repeated disclosure names on `/records`, and a stray space in the fold's name ("Show all 396 , Every entry").
8. A photograph's credit link is named after the file (*Circuit de Monaco, April 1, 2018 SkySat (cropped).jpg*). This is the old AX-31 half that never landed.
9. The faint "Seasons raced" track on `/constructors` (1.20–1.26:1), with its ranges only in an SVG `<title>`. Minor, an aim.

### Solid — do not churn

- VD-53's reading order.
- VD-54's cells, which carry real text equivalents.
- VD-68's cards, a `ul > li > h3 > a` list.
- VD-69, which keeps every row in the DOM and works with JavaScript off.
- The grid-to-flag and stint figures, whose marks measure 4.4–18:1 and which
  carry a dash and a cross as well as colour, legible under forced colours.
- The `photo-breathe` animation, which stops under reduced motion.
- AX-16, which is fixed.

**Not examined:** a real screen reader, voice control, or mobile assistive
technology; the search palette; `/now`, `/grands-prix/*`, `/compare` beyond
axe, and `/data/*` beyond axe and focus; Firefox text-only zoom.
