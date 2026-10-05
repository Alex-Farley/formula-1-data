# What leads each page type — 2026-10-05

**Critics:** `product-design-critic` and `visual-design-critic`, run side by
side on one question for VD-66 (#788).
**Subject:** the built site of `main` at `629b303`, served locally and driven
in Playwright Chromium at 1440×900 and 400×800, app and static page, light
and dark where it mattered. Both critics measured element positions in the
DOM. Their scripts and screenshots stayed outside the repository.
**The question (maintainer, 2026-10-05):** the site is "very table heavy".
Before filing more one-off items, decide what should lead each page type
(driver, constructor, circuit, race, season, the registers, records): a
chart, a sentence or a table, and in what order the rest follows.
**Briefed with** the four queued items to rank against: VD-53 (#504), VD-54
(#505), PD-30 (#127) and PD-56 (#787). Also briefed with what is ruled out:
the track atlas `[D-29]`, route-level code splitting `[D-12]`, and anything
that needs lap timing (`docs/TIMING-ARCHITECTURE.md`).
**The repository was not modified by either critic.** The calling session
merged their proposals and filed the twelve new items below at *Someday*. It
ranked none of them, because ranking is the maintainer's. Both reports follow
in full, after the synthesis.

All y values are page offsets in px. The first screen ends at y 900 at 1440
and at y 800 at 400. Where the two critics measured the same element on
different example pages, both figures are given as a range.

---

## The three that matter

**1. "Table heavy" means the pages are long. The first screen is not where
the problem is.** At 1440, **0 % of any entity page's first screen is
table**, but **53–85 % of its height is**:

- Ferrari's page is 20,089 px, and *Every win* (251 rows) is 9,844 px of it.
- Verstappen's *Every entry* is 4,022 px.
- A 2025 race page's three practice tables come to about 3,000 px.

The first screen is part empty instead. The lede has been 525 px wide since
VD-52, which leaves about 700 px blank beside it on every entity page except
circuits. *(both critics, drove the site)*

**2. On the pages that matter most, the answer sits below things that are not
the answer, and the photograph strip is the main cause.** VD-33 (#129)
decided which pages carry photographs but never where on the page. The strip
landed straight after the tiles. It is 683–757 px tall at 1440 and about
2,000 px at 400, and it pushes down:

- **The race classification**, to y 1,420–1,737 at 1440 and 3,024–3,296 at
  400, on 1,151 of 1,196 race pages.
- **Ferrari's *Wins by season***, to y 1,482–1,566 at 1440.
- **The season title-race charts**, to y 1,316–1,441 at 1440.

*(both critics, drove the site)*

**3. VD-53's rule, "a figure leads every entity page", is right for three page
types and wrong for two.**

- **Right for driver, constructor and season**, where the reader wants the
  shape of a career or a title race.
- **Wrong for race**, where the reader wants the result, and the result is a
  table.
- **Already true for circuit**, where the aerial photograph fills the slot
  beside the lede.

The charts the site already draws are good enough to lead. Their caption
blocks are not: 58–154 px of method text sits above a 180–250 px plot, and on
Fangio at 400 it is 217 px of caption over a 210 px plot. *(both critics; the
caption measurement is the visual critic's)*

## The rule underneath

**A sentence always comes first.** It already does on driver, constructor,
circuit, race and season pages. Both critics name the generated lede as the
product's best lead and want it kept. **The second element depends on why the
reader came:**

| Reader's job | Second element |
|---|---|
| The shape of a career or a season | a chart |
| An event or a lookup | a table |
| A place | a drawing or photograph |

The fix to "table heavy" is therefore mostly **order and depth**, not
replacing tables with charts:

- move what blocks the answer down;
- give the lead figure the empty slot beside the lede;
- stop exhaustive lists dominating the page.

## Page by page

| Page type | Reader and job | Now (1440 / 400) | Should lead | Then |
|---|---|---|---|---|
| **Driver** | A fan or journalist checking a career. Wants totals and when the driver was good | Fangio: livery band 327–460, tiles 502–597, dot plot about 820. **Active drivers: career tiles at 999–1,023 / 1,131–1,155**, behind the current-season section. The static page draws no chart | **Sentence, tiles, then the existing championship dot plot** in the slot beside the lede (≥1024 px), or after the tiles below that width | Current season (as a tile or the lead figure), season by season, team-mates, every entry. The livery note moves below the chart |
| **Constructor** | A fan asking when they were dominant. Wants the shape of success | Tiles 529–651, photographs from 691–773, *Wins by season* **1,482–1,566 / 3,200** | **Sentence, tiles, *Wins by season*.** The best lead the site already draws | Season by season, photographs, then *Every win* and cars built, collapsed |
| **Circuit** | A fan before a race weekend. Wants what the track looks like and who wins there | Aerial top right at 128, tiles 403–499, outline 749. *Most wins* **4,576–4,611 / 5,026** | **Sentence and photograph, with the current outline as the drawing.** This is the closest to right today | Most wins, then the layout history as a timeline with collapsible cards, then every race, then *Traced and measured* (method) last |
| **Race** | Someone who searched for a result. Wants the result | Tiles and outline 360–473, photographs 729–811, a run race's timetable 1,383, classification **1,420–1,737 / 3,024–3,296**. Practice adds about 3,000 px | **Sentence, then the classification table** after the tiles and outline, with about 8 rows visible at 1440 | Grid against finish (PD-30 (a)) beside it, qualifying, strategy (PD-56), practice collapsed, photographs, timetable. Before the race is run, the timetable leads |
| **Season** | A fan asking who won and how close it was. Wants the title race | Tiles 361–456, photographs 598–653, title chart **1,316–1,441 / 2,877–2,952**, standings 2,952–3,284 | **Sentence, tiles, the existing title-race line chart.** In the current season, "who can still win" should be set at lede size | Final standings (drivers' and constructors'), calendar, photographs, entrants. For a season in progress the calendar comes before the standings |
| **Grand Prix** | Wants who has won it | Tables from 367–417. **No lede** on 24 of 53 static pages | **A sentence**, then the table, which correctly leads | Most wins, every edition |
| **Registers** (/drivers, /constructors, /races, /grands-prix, /seasons) | Wants to find one entity, or sort to find the extreme case | Tables at 354–498 at 1440; filters take 12–25 % of a phone's first screen | **The table, after its filters.** Correct already | If VD-54 is done, its graphics belong as a column in the table, not as a separate grid |
| **/circuits** | Wants to find one circuit | The outline grid at 572 (VD-50), then the table. The search filters both | **The drawing grid.** Correct already | Table |
| **Records** | A fan settling an argument. Wants who holds it and who is next | **2 of 12 headline records visible at 1440, 0 at 400.** The derivation column sets the row height (94–228 px). The leaderboard charts are at 9,548–9,612 | **The 12 headline values as large figures**, each with its holder, and the derivation behind a disclosure | Leaderboard charts, then the families |
| **/records/:key** | Wants the value, holder and runner-up | Sentence and tiles. The ranked list exists only as prose | **Sentence and tiles.** Correct | A top-10 table |
| **/reference/quality** | A developer deciding whether to trust the data | 44,423 px. Opens on ladder definitions; the distribution chart is at 1,574 | **A sentence of the headline figures and the existing distribution chart** | Ladder, gaps, disagreements |
| **/reference/eras** | Wants to know when each era was | Prose timeline; 53 % of the first screen is empty | **A chart:** one 1950–2026 band divided into the ten eras | Era text, regulation tables |
| **Glossary, /reference** | Looking up a term or the data | Sentence, then list | **As is** | — |

## Where the critics differed, and how this report settles it

- **VD-53's scope.**
  - *Product:* re-scope it to driver, constructor and season.
  - *Visual:* keep every entity type, but put the figure in the slot right of
    the 525 px lede rather than beside the tiles, and below 1024 px put it
    after the tiles.
  - *Settled:* both, since they are compatible. Circuit already has its lead in
    that slot, and race leads with a table.
  - The re-scope is proposed here and left to the maintainer. VD-53's body is
    unchanged.
- **VD-54.**
  - *Product:* rank it last. The registers are rightly table-led, and the
    /circuits piece has landed.
  - *Visual:* re-scope it. Draw the sparkline and the entry span as a column
    inside the existing /seasons and /constructors tables, because a separate
    grid of 77 or 150 above a 77- or 150-row table draws the same set twice.
  - *Settled:* last in the plan, and done as columns if it is done.
- **Circuit order.**
  - *Product:* winners before the layout history.
  - *Visual:* layouts before winners, with *Traced and measured* last.
  - *Settled:* winners first, because that is the reader's job. The layout
    history follows as a collapsible timeline, and the method section goes
    last. #794 records the choice.
- **The current driver's lead.**
  - *Product:* the current season becomes one tile.
  - *Visual:* the current season becomes the lead figure in the slot.
  - *Settled:* either works. #792 says so and leaves the choice to VD-53's
    driver sitting.

## The ranked plan

This is the critique's proposed order. It changes no board position.

| | Item | Size | Why here |
|---|---|---|---|
| 1 | **PD-57 (#790)**, race page order | S | 1,151 pages, the most-arrived page type. The answer moves to the first screen, and only existing sections move |
| 2 | **PD-58 (#791)**, photographs below the chart and main table on season and constructor pages | S | Most of VD-53's gain on 156 pages, with no layout work |
| 3 | **VD-67 (#793)**, a `lead` figure variant with the caption beneath the plot | S | VD-53 should not ship without it |
| 4 | **PD-59 (#792)**, an active driver's career tiles under the lede | S | The 23 most-visited driver pages. Fold it into VD-53's driver sitting if that comes first |
| 5 | **VD-53 (#504)**, the lead figure, re-scoped as above | M | One sitting per page type: constructor, season, driver. It is mostly layout once 2–4 have landed, and still comes after VD-49 (#446) |
| 6 | **VD-68 (#795)**, /records as a wall of headline figures | S | The most-quoted page shows no record on a phone's first screen |
| 7 | **PD-30 (a) (#127)**, grid against finish | M | The one race chart a reader looks at twice. It sits beside the classification once PD-57 lands. Take it before PD-56 |
| 8 | **PD-60 (#794)**, circuit winners before the layout history | S | The circuit page is closest to right already |
| 9 | **PD-56 (#787)**, stint windows | M | Right, but the third section of a race page, not its lead, and only for 610 races since 1994 |
| 10 | **VD-69 (#798)**, collapse exhaustive lists | M | Removes most of the "table heavy" depth. Needs an accessible disclosure |
| 11 | **PD-61 (#796)**, a ranked table on each record page | M | Touches the build, and coordinates with CR-53 (#646) |
| 12 | **PD-62 (#797)**, /reference/quality leads with its figures | S | A narrower reader |
| 13 | **VD-70 (#799)**, the eras band | S | A preference about one page |
| 14 | **VD-54 (#505)**, small multiples, as columns in the register tables | M | The registers are correctly table-led |

Neither critic argued for PD-30 (c), gap to pole. It stays where the
2026-09-21 re-scope put it. PD-30 (b) is folded into PD-56.

**Off the question, and filed:**

- **PD-63 (#801)**, a correctness defect. Every "numbers behind this chart"
  table prints seasons as 1,950. `Figure.jsx` renders through `DataTable`
  without `raw`, so the year column goes through `format.js`'s thousands
  separator. The product critic drove it; the cause was read in the source.
- **CD-49 (#800)**, Grand Prix pages without a lede. It is content design's,
  and both critics raised it.

**Proposed against existing items, not filed:** the visual critic suggests
that VD-59 (#572) should also move the livery note out of the lead column.
The note takes 133 px above the career tiles at 1440 and ranks a colour's name
above the career.

## What both critics said not to touch

- The generated one-sentence lede on driver, constructor, circuit, race and
  season pages.
- The circuit page's top band: aerial photograph top right, then the tiles,
  then the outline. Every entity page should copy this pattern.
- The plots themselves: *Wins by season*, the title-race lines and the
  championship dot plot.
- The /circuits outline grid, and its search filtering the grid and the table
  together.
- Registers that open on a filterable table.
- Every chart carrying its own numbers table.
- The dark theme, which keeps every position the same and holds its contrast.

## Not examined

These were not covered by either critic:

- Pages: `/`, `/cars`, `/compare`, `/now` and `/data/*`.
- Widths between 400 and 1440. 768 and 1024 are where the lead slot would
  break.
- Throttled or cold loads.
- Colour-vision simulation.
- Whether VD-69's disclosure works by keyboard and screen reader.
- Comparison with other F1 reference sites.

The reader jobs above are inference: nobody has asked a reader.

---

## Appendix A — product design critic's report

*As returned, lightly condensed, with the issue each proposal was filed as added in brackets. The proposed items' full bodies are not repeated here; they are the filed issues.*

### 1. The three findings that matter most

1. **Tables are not the main problem. The answer sits below things that are
   not the answer.** On the race page the classification is the answer, and
   it is right to show it as a table. Today it starts at y 1,420 at 1440, y
   3,024 at 400 and y 2,824 on the static page. That is true on 1,151 of the
   1,196 race pages, because the photograph strip (683 px at 1440, 1,932 px
   at 400) sits between the tile strip and the results. The race page should
   lead with its sentence and then the classification table, not with a
   chart. *(drove the site)*
2. **The photograph strip is now what pushes the existing charts off the first
   screen, and nobody decided where it goes.** VD-33 (#129) says which pages
   get photographs, not where on the page. The strip landed straight after
   the tiles on all 77 season pages and 79 constructor pages. Moving it below
   the chart and the main table is an S, needs no layout work, and does most
   of what VD-53 wants:
   - Ferrari's wins chart moves from y 1,566 to about 810 at 1440, and from
     3,200 to about 1,130 at 400.
   - 2025's title-race chart moves from 1,441 to about 760 at 1440, and from
     2,952 to about 1,020 at 400.

   *(drove the site; read the issue)*
3. **VD-53's one rule, "a figure leads every entity page", is right for three
   page types and wrong for two.**
   - Right for driver, constructor and season, where the reader wants the
     shape of a career or a title race.
   - Wrong for race, where the reader wants the result, and it is a table.
   - Already done on circuit: the photograph is top right and the current
     outline is at y 749. Circuit's real defect is that "Most wins here" is at
     y 4,611, behind 3,500 px of nine layout cards.

   VD-53 should be re-scoped to driver, constructor and season. *(drove the
   site; inference on reader jobs)*

### 2. Page by page

**Driver** (916 pages). *Reader:* a fan settling an argument, or a journalist
checking a career figure, landing from a search. *Job:* career totals, and
when the driver was good.

- *Now, 1440:*
  - Fangio: h1, editorial lede, then the livery band (y 327–460, 135 px: a
    swatch and four lines of explanation), then the tiles (502–597). The
    chart heading is at 637, but only the P1 row of dots is visible.
  - Verstappen and the other 23 drivers in the 2026 field: lede, livery,
    then "2026 season so far" with its chart at 664. **The career tiles are at
    y 999, off the first screen at both widths** (1,131 at 400).
- *Now, 400:* lede and livery only. Fangio's tiles start at about 700.
- **Lead:** the sentence (keep it) and the tiles, with the existing
  "Championship finishing position by season" dot plot beside the tiles.
- **Order:** sentence → career tiles (for an active driver, "2026: 6th, 163
  pts" in one tile) → career chart → current-season strip → season by season
  → team-mates → every entry. The livery band drops below the chart.
- The static page draws no chart at all, so whichever figure leads must be
  prerendered. VD-53 needs to say so.

**Constructor** (151). *Reader:* a fan asking "when were they dominant?".
*Job:* the shape of success over time.

- *Now:* at 1440, lede, livery (354–490), tiles (530–650), then photographs
  from 691. The "Wins by season" chart is at 1,566. At 400 the tiles are on
  screen and the chart is at 3,200.
- **Lead:** sentence, tiles and the existing "Race wins per season" column
  chart.
- **Order:** season-by-season table → every win → cars built → photographs.
- The page is 20,089 px, dominated by "Every win" (251 rows, about 9,800 px).
  Collapsing that list past 20 rows is a preference, not a defect.

**Circuit** (81). *Reader:* a fan before a race weekend. *Job:* what the track
looks like, who wins here, how many races it has held.

- *Now, 1440:* lede, aerial photograph top right, tiles, then the current
  outline at 749. **Good.**
- *Now, 400:* lede, then the photograph at 489 and the outline at 1,346.
- **Lead:** the sentence and the photograph, as today, with the outline as the
  chart.
- **Order:** "Most wins here" and "Every race held here" go above "Every layout
  raced here". Today they are at 4,611 and 6,408 at 1440, and "Most wins
  here" is at 5,026 at 400. The layout history can be reduced to its timeline
  strip, with the cards opening from it. [PD-60, #794]

**Race** (1,196). *Reader:* someone who searched "2025 Australian Grand Prix
result". *Job:* the result.

- *Now:* at 1440, the lede ("Lando Norris won for McLaren at Albert Park."),
  tiles, a 200 px outline, then photographs, with the classification at
  1,420. At 400 the tiles fill the first screen and the classification is at
  3,024. In 2025, three practice tables (about 2,700 px) sit between
  qualifying and pit stops. 721 race pages carry practice.
- **Lead:** the sentence, then the classification table directly after the
  tiles and outline.
- **Order:** grid against finish (PD-30 (a)) beside the table it re-encodes,
  not above it → qualifying → stint windows (PD-56) → practice, collapsed →
  photographs → sources. [PD-57, #790]

**Season** (79). *Reader:* a fan asking who won and how close it was. *Job:*
the title race.

- *Now:* at 1440, a strong lede, then tiles including the margin, then
  photographs from 598. The chart is at 1,441, the calendar at 1,778 and the
  standings at 3,284. At 400 the chart is at 2,952 and the standings at
  6,036.
- **Lead:** sentence, tiles and the existing "Championship points by round"
  line chart.
- **Order:** final standings (drivers' and constructors' side by side) →
  calendar → photographs → entrants. For the season in progress, the calendar
  comes before the standings. [PD-58, #791]

**Grand Prix** (54). Tables start at y 417, and there is **no lede paragraph
at all**. A table leads, correctly, because the job is "who has won it". A
one-line computed lede would help, but this is minor. [CD-49, #800]

**Registers** (/drivers, /constructors, /circuits, /seasons, /races,
/grands-prix). *Reader:* someone finding one entity, or sorting to find the
extreme case.

- **A table leads after the filters on each one.** That is already true:
  tables start at y 355–498 at 1440. No change needed.
- /circuits already leads with 79 outlines. At 400 the table is at y 12,302,
  but this works, because the search filters the grid too ("monza" leaves one
  shape and one row).
- /seasons is where small multiples would do least. Its table already carries
  the champion, runner-up and margin.

**Reference.** *Reader:* a developer or journalist deciding whether to trust
the data.

- /reference (Data) leads with a sentence. **Good.**
- /reference/quality is 44,423 px, with 11 tables and 688 rows. It leads with
  the ladder definitions, whose REFERENCE cell is about 400 px tall.
- **Lead for quality:** a sentence with the headline figures and the existing
  distribution chart, which is at y 1,574 today. Then the ladder, the gaps and
  the disagreements. [PD-62, #797]
- Eras and glossary: sentence, then list. Fine.

**Records.** *Reader:* a fan settling an argument. *Job:* who holds the
record, and who is next.

- *Now:* /records leads with the headline table, 12 rows over about 1,700 px.
  Each row is about 130 px tall because the "How it is derived" column (about
  27 % of the width) wraps to six lines. The five leaderboard charts (top 15
  for wins, poles and so on) are at y 9,612, or 17,122 at 400.
- **Lead:** the table, slimmed down to record, holder, value and a new "next
  three" column, which the derivation already computes. The derivation itself
  already lives on each record's own page.
- **Order:** headline table → leaderboard charts → families. [VD-68, #795]
- /records/:key correctly leads with the value and holder tiles. But the
  ranked list a searcher wants exists only as a prose "Next: …" inside the
  derivation, with no table. [PD-61, #796]

### 3. Ranked plan

1. **Race page order** (S). It covers 1,151 pages, the most-arrived page
   type, and puts the answer on the first or second screen. [#790]
2. **Photographs below the chart and standings on season and constructor
   pages** (S). Most of VD-53's gain for 156 pages, with no layout work.
   [#791]
3. **Career tiles first on an active driver's page** (S). It covers the 23
   most-searched drivers. [#792]
4. **VD-53, re-scoped to driver, constructor and season**, after the
   photograph move: the chart goes beside the tiles and is prerendered. What
   is left after the photograph move is layout.
5. **PD-30 (a)**, grid against finish, beside the classification. The one race
   chart a reader looks at twice.
6. **Circuit: winners and races before the layout history** (S). [#794]
7. **Slim the /records headline table and move the charts up** (S). [#795]
8. **PD-56, stint windows.** Correct, but third in the race page's order, and
   only for 610 races since 1994.
9. **A ranked table on each record page** (M). [#796]
10. **Quality page leads with its figures** (S), for a narrower reader.
    [#797]
11. **VD-54.** The registers are correctly table-led, the circuits piece is
    done, and the /seasons sparklines add least.

### 4. Incidental

The "numbers behind this chart" tables print years as **1,950** on
/drivers/fangio and /constructors/ferrari. I think content or interaction
design should own the fix. S. [PD-63, #801]

### 5. Evidence, defect against preference, what is good, coverage

- **Evidence:**
  - Every y value: drove the site, app and static.
  - Page counts and the photograph and practice prevalence: from the built
    files.
  - The active-driver count: queried the database.
  - VD-33's silence on placement: read the issue.
  - Reader jobs: inference.
- **Defects** (the reader's stated job is pushed off the first screens): race
  order, photograph placement, active-driver tiles, circuit order, and the
  1,950 formatting.
- **Preferences:** slimming /records, the quality page's lead, the livery
  band's position, collapsing "Every win", and ranking VD-54 last.
- **Between the two:** the record-page table.
- **Good:**
  - The editorial ledes.
  - The circuit page's top band.
  - Registers that open on a filterable table.
  - Every chart carrying its own numbers table.
  - The /circuits search driving the grid and the table together.
- **Not examined:**
  - The home page, /cars, /compare and /now.
  - The current-season variants of the season and race pages.
  - Dark mode, and throttled or cold loads.
  - Other F1 reference sites.
  - How the four charts read in detail. That is for the visual critic, who
    should also own caption length: the captions run four or five lines of
    method text before the plot.

---

## Appendix B — visual design critic's report

*As returned, lightly condensed, with the issue each proposal was filed as added in brackets. The proposed items' full bodies are not repeated here; they are the filed issues.*

### 1. The three findings that matter most

**1. "Table heavy" comes from how long the pages are, not from the first
screen, which is mostly empty space.** On entity pages at 1440, 0 % of the
first screen is table, but 53–85 % of the page height is:

- *Every win* (251 rows) is 9,844 px of Ferrari's 20,089 px page (49 %).
- Verstappen's *Every entry* is 4,022 px (46 %).
- A race page's three practice tables come to 3,048 px (36 %).

Meanwhile the lede has been 525 px wide since VD-52, so **the ~700 px to the
right of the title and lede is empty** on every entity page except circuits.
24–43 % of the first screen's content area is blank, and on /reference/eras it
is 53 %. That empty space is where the lead belongs. *(drove the site;
measured)* · defect

**2. The charts are good enough to lead; their caption blocks are not.** Each
figure puts its title and a two-to-five-line caption above the plot. That
block is 58–154 px tall at 1440 and 77–231 px at 400, against plots of
180–250 px. On Fangio at 400 it is 217 px of caption over a 210 px plot. If
VD-53 moves figures up as they are:

- a phone's first screen is about 27 % caption prose and no data;
- at 1440, Fangio's plot still begins about 150 px into its box.

The plots themselves are good enough to lead without change: Ferrari's *Wins
by season*, the 1976 title race and the championship dot plot. *(drove the
site; measured)* · defect [VD-67, #793]

**3. Three pages are in the wrong order, even where the kind of content is
right.**

- **Race pages** (1,196 routes, half the site). The photographs (y 729) and a
  run race's timetable (1,383) sit above the classification, which is at
  1,737 at 1440 and 3,296 at 400, the fourth screen down. [#790]
- **Current drivers.** PD-49's season section pushes the career figures to
  1,023 at 1440 and 1,155 at 400, so "4 titles, 71 wins" is below the fold on
  the most-visited driver pages. [#792]
- **/records.** It shows 2 of its 12 headline records at 1440 and none at 400.
  Rows are 94–132 px tall at 1440 and 151–228 px at 400, because the
  derivation prose sets the row height. Its best charts are at 9,548 of
  16,653 px. [#795]

*(drove the site; read the PD-49 comment in `queries/driver.js`)* · defect

### 2. Page type by page type

The rule: **a sentence always comes first**, which it already does
everywhere, and it is the cheapest thing to quote. **The second element
depends on why the reader came:** a chart for a career or a season, a table
for an event or a lookup, a drawing for a place.

| Page | Now at 1440 | Now at 400 | Should lead | Then |
|---|---|---|---|---|
| Driver (Fangio) | Lede to 300; colour note 327–460; tiles 502–597; plot about 820; first table 1,068; table is 0 % of the first screen | Colour note about 340–450; tiles 596–926 (two columns, 330 px, 41 % of the screen); chart 1,222 | **Chart:** the existing *Where each championship finished* dot plot, in the slot right of the lede at ≥1024 px | Tiles directly under the lede, then season by season, team-mates, every entry |
| Driver, current (Verstappen) | Season figure 542; career tiles **1,023** | Season figure 636; tiles **1,155** | The same dot plot with the current season as a final "so far" dot, *or* PD-49's round-by-round plot in the slot | Career tiles under the lede, which keeps PD-49's intent and ends its cost; then the season table |
| Constructor (Ferrari) | Tiles 529–651; photographs 773; *Wins by season* **1,482**; table 1,812; 85 % table | Tiles 596–953; chart **3,200** | **Chart:** *Wins by season* (77 bars, where the gaps are the droughts). The best lead the site already draws | Tiles, season by season, photographs; every win and cars built collapsed |
| Circuit (Monza) | Aerial 128, already in the slot; tiles 403–499; outline grid 749; *Traced and measured* 4,111, before *Most wins* 4,576 | Aerial 489; tiles 782 | **Drawing:** the current outline, large, beside the aerial. Closest to right | Layouts, then most wins and constructors, then every race, then *Traced and measured* last, since it is method |
| Race (2026/13) | Tiles and outline 360–473; photographs 811; timetable 1,383; classification **1,737** | Tiles 399–703; photographs 1,173; classification **3,296** | **Table:** the classification, about 8 rows visible at 1440, with PD-30 (a) beside it | Qualifying, strategy (PD-56), photographs, timetable last; practice collapsed |
| Season (1976) | Tiles 361–456; photographs 653; title chart **1,316**; standings 2,952 | Chart 2,877 | **Chart:** *How the title was decided*, in the slot | Final standings, calendar strip, photographs, entrants |
| Season, current (2026) | "Who can still win" sentence (488–620) in 13.5 px soft grey; next-round table 831; title chart **3,499**; calendar 3,986; standings 5,421 | Title chart **5,455** | **Chart:** the title race, in the slot. Set "who can still win" at lede size, because it is the page's best sentence | Standings, calendar strip, next round. *Won here before*, *On the grid* and photographs go below the standings |
| Grand Prix | **No lede** on 24 of 53 static pages; a two-row table at 382 leads | Same | **Sentence**, with the circuits written into it [#800] | Most wins, every edition |
| /drivers, /constructors, /races, /grands-prix | Table at 443 / 497 / 443 / 367; 30–41 % of the first screen | Table 7 / 4 / 19 / 30 %; **filter controls 12–25 %** | **Table.** These are lookup pages, and the table is right | Inline graphic columns (VD-54, re-scoped) |
| /seasons | Table 354, 40 % | 30 % | **Table**, with a sparkline column for each title race | — |
| /circuits | Outline grid 572 (VD-50 landed) | 806 | **Drawing grid.** Correct | Table |
| /records | First row 562; 2 of 12 visible; charts 9,548 | 0 visible; charts 17,039 of 25,500 | **Figures at sentence scale:** the 12 headline values set large in a grid, holder beneath, derivation behind a disclosure [#795] | Leaderboard charts, then the family tables |
| /reference/eras | Prose timeline to x ≈ 540; 53 % empty; 20,679 px | 32,210 px | **Chart:** a single 1950–2026 band divided into the ten eras, each a link [#799] | Era text, regulation tables |
| /reference/glossary | Table 501 | 700 | **Table** (a lookup) | — |
| /records/:key | Sentence and tiles; 1,629 px | — | **Sentence.** Right | — |

Dark theme: I checked Fangio, a race page, /records and two charts. Element
positions are identical and the charts hold their contrast.

### 3. Ranked plan

1. **Race page order** (S). Half the site's routes, only existing sections
   move, and the reader's goal is on the first screen. [#790]
2. **A lead variant of the figure** (S). VD-53 should not ship without it.
   [#793]
3. **VD-53** (M), one sitting per page type in this order: constructor,
   season, driver (including the current-driver fix), circuit. Two changes to
   its scope:
   - the figure goes in the **slot right of the 525 px lede**, not beside the
     tiles;
   - below 1024 px it goes after the tiles.

   It still needs VD-49 first.
4. **/records as a wall of headline figures** (S). [#795]
5. **PD-30 (a), grid against finish** (M). It becomes the classification's
   companion. Take it before PD-56.
6. **Current drivers keep the career strip under the lede** (S). Fold it into
   VD-53's driver sitting if that comes first. [#792]
7. **PD-56, stint windows** (M). Right, but the third section of a race page.
8. **Collapse the exhaustive lists** (M). Removes most of the depth.
   [#798]
9. **VD-54, re-scoped** (M). On /seasons and /constructors, draw the
   sparkline and the entry span as a column inside the existing table,
   roughly 120×24 px in the 39 px row. A separate grid above a table of the
   same set draws it twice.
10. **The eras band** (S). [#799]

### 4. Evidence, defect against preference, what to keep, coverage

- **Evidence:** the positions, shares, row heights and caption heights are
  from the rendered site. The static-page lede counts were taken from the
  built HTML. PD-49's reasoning is from the source comment. The lead choices
  are inference from what a reader comes to each page for. I did not query
  the database.
- **Defects:** the three findings, race order, the caption block,
  current-driver tiles, /records and the eras band's empty space.
- **Preferences:** the collapse threshold, the eras band over some other
  device, and re-scoping VD-54 from a grid to columns.
- **Owned by other disciplines:**
  - The missing Grand Prix ledes are content design's.
  - Register controls taking 12–25 % of a phone's first screen are
    interaction design's.
  - The livery note above the career tiles (133 px at 1440, about 110 px at
    400) belongs in VD-59 (#572), as "move the note out of the lead column".
- **Well made:**
  - The plots.
  - The /circuits outline grid.
  - Monza's aerial in the top-right slot, which is the pattern every entity
    page should copy.
  - The generated lede on all 915 driver pages and on race pages.
  - The 2026 calendar strip.
  - The dark theme.
- **Not examined:**
  - `/`, `/cars`, `/compare` and `/data/*`.
  - Widths between 400 and 1440.
  - The static first paint.
  - Throttled loading.
  - Colour-vision simulation.
  - Whether the collapse disclosure works by keyboard and screen reader.
