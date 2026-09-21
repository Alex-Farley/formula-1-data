# Visual design critique — 2026-09-21

**Critic:** `visual-design-critic`, fourth run.
**Subject:** the built site of `main` at `dda5afb` (v2.24), served at
http://localhost:4179, driven in Playwright Chromium at 320, 400, 768, 900,
1024, 1200 and 1440 px, both themes, device scale 1 and 2, plus no-JS captures
of four routes. Twenty-one routes captured in each of light 1440, dark 1440,
light 400; eight at 768. Contact sheets, element measurements taken in the DOM,
and chromatic-pixel fractions computed from the rendered full-page screenshots.
**Brief:** `.claude/CRITIQUE-BRIEF.md`, plus the maintainer's 2026-09-21
restatement: reliability and completeness are the product; commercialisation
eventually; **"it is all a bit dull."**
**Prior read in full:** `docs/critiques/2026-09-11-visual-design.md`,
`2026-09-13-visual-design.md`, `2026-09-16-visual-design.md`,
`2026-09-13-design-review.md`, the open queue (182 items), and the decline
comments on `VD-32` (#128) and `VD-38` (#325).

**Read-only.** Screenshots, scripts and measurements beside this file.
**Neither the repository nor the running build was modified**, and no issues
were filed — the maintainer suspended that for this run.

---

## The three that matter

**1. "Dull" is not a mood, it is two measurable holes: there is no type step
between 26 px and 61 px, and there is almost no colour on the page.** Across
21 routes the app renders **22 distinct font sizes** — 9, 9.5, 10, 10.5, 11,
11.5, 11.96, 12, 12.42, 12.5, 13, 13.5, 13.8, 14, 14.5, 15, 16, 17, 17.55, 20,
25, 62 px — of which **seventeen fall inside the 7 px band from 9 to 16**, and
**nothing at all occupies 26–61 px**. Every page is therefore one 62 px shout
followed by 2,000–17,500 px of near-identical 12–16 px murmur; the `h1` is
62 px on all 21 routes and the largest thing under it is a 25 px stat figure.
Six weights are in use (400, 500, 600, 620, 640, 700) — three of them within
40 units of each other and indistinguishable at 13 px. On colour: sampling
every pixel of each full-page render, the **median chromatic fraction across
16 routes is 0.27 %**; `/reference/eras` is **0.03 %**, `/drivers` **0.06 %**,
`/circuits` **0.09 %** — and on those three, **100 % of the coloured pixels are
the link red**. Eleven of 21 routes contain **zero images and zero SVG**. The
project has since acquired ~180 sourced constructor-season colours (AF-04/45/46/47)
and spends them on 7 px chips and a 22 px ribbon. *(drove the site; measured in
the DOM and from the renders · defect for the type scale, diagnosis for the rest)*
→ **`VD-51`**, and the programme in §*What "dull" is now*.

**2. The page called Records sets its records fainter than the build date.**
`/records`, first row, measured: *Most constructors' championships* / Ferrari /
**16** / a paragraph of schema prose / 2026-09-13. Every one of those five cells
is **13.5 px, weight 400, Saira, left-aligned**; the *value* and the *derivation*
are both `--ink-soft` `rgb(79,85,97)` while the **as-of date is full `--ink`**.
The value column is not mono, so "16", "250" and "95.45 % (21 of 22, 2023)" do
not align on anything. The derivation column is the widest of the five (316 px
against the value's 218) and drives the row to **147 px at 1440 and 233 px at
400**, where the value is off-screen behind a horizontal scroll and ~190 px of
each row is blank. This is the most quotable page in the product — the one a
journalist screenshots and a prospective customer judges — and it ranks its
superlatives one tier below its footnotes. *(drove the site; probed the DOM ·
defect)* → **`VD-53`**

**3. The register of 80 circuits draws nothing, and the section headed "The
traced centrelines" contains no centreline.** `/circuits` renders **0 `<img>`
and 0 `<svg>` in 4,838 px**. The 25 trace thumbnails were removed under `AF-23`
("the register does not draw the circuits a third time", #325's decline), and
the reasoning is sound about *redundancy* — but nothing was put in their place.
F1DB's outline is **already in `f1.db`**, ~1.7 KB of path string, needs no
geometry parse, and is already drawn on `/circuits/:id`, on race pages and in
the season calendar strip; on the register it appears **zero** times. So the
one surface whose entire subject is shape is a filter bar, 25 text cards and a
table. `VD-43` recorded this for the *prerendered* page; it is now true of the
app as well, which is the recorded finding having got worse. *(drove the site;
read `Circuits.jsx:41–55`; read the #325 decline · defect)* → **`VD-50`**,
absorbing `VD-43`

---

## What "dull" is now — the maintainer's central question

### Did the 2026-09-13 programme move the needle? Yes, and measurably.

I checked each landed item against the running build rather than the diff:

- **`VD-01`** (two visual systems) — **landed and works.** The no-JS
  `/drivers/verstappen` and `/records` now carry the same masthead, the same
  62 px display `h1`, the same stat strip and the same table styling as the app.
  This was the single biggest visual defect on the site and it is gone. The one
  remaining divergence is wayfinding (`Home / Drivers / Max Verstappen` static
  vs `← The register` in the app) and the missing livery band — small.
- **`VD-28`** (tiles do not rank) — **landed, half-works.** Verstappen's strip
  now sets **71** and **4** at 25 px/700 and the other six at 16 px/600, and the
  eye does land on them. But see `VD-55`: the two ranks do not share a baseline.
- **`VD-33`** (602 photographs advertised, never shown) — **landed.** Six
  photographs on `/seasons/2026`, six on `/races/2026/13`, six on
  `/constructors/ferrari`, 28 on `/cars`. `/cars` is now the best-looking page
  on the site and proves the system can carry imagery.
- **`VD-34`** (let the entity own its colour) — **landed, and the best of the
  set.** The 2026 title-race chart draws Antonelli and Russell in Mercedes teal
  (solid / dashed, filled / hollow legend marker) against Hamilton's Ferrari
  red, with **292** and **211** direct-labelled at the line ends. The
  constructor leaderboard on `/records` draws each bar in the team's own colour
  and **hollow for the declared 1968–2009 gap** — an honest, legible,
  genuinely good piece of information design.
- **`AF-03` / `AF-46` / `AF-47`** — **landed.** The calendar strip on
  `/seasons/2026` (23 outlines, dashed for unrun, boxed for next, a winner's
  colour rail under each run round) is the strongest single object on the site.
- **`VD-25`, `VD-26`, `VD-27`, `VD-30`** — landed; I re-checked and found no
  regression.

So the needle moved. The site in September was flat *and* broken; it is now
flat and coherent. Which sharpens the question.

### What is dull, precisely

Not the typeface, not the palette's taste, not the restraint. Five things, in
order of how much each costs:

**(a) There is no middle register.** Measured above: nothing is ever set
between 26 and 61 px. A page therefore has exactly two volumes — title and
body — and a reader scanning 5,000 px of it gets no intermediate landmark.
Compare a data-desk page, which typically runs five or six ranks between the
title and the caption. The consequence is visible on the contact sheet
(`sheet-1440-light.png`): all 21 routes have an identical top 400 px —
masthead, mono eyebrow, 62 px caps `h1`, three lines of 16 px lede, then a
105 px strip of tiles — and nothing below it ever rises above 25 px again.

**(b) The first screen of every page is chrome, not content.** At 1440 the
`h1` baseline is at y=148 and the tile strip ends around y=500. Below that,
11 of 21 routes have nothing drawn at all. On `/seasons/2026` — the page with
the most going on — the first *graphic* (a photograph) is at y≈700 and the
first *chart* at y≈1,300. A reader's first screen of this product is words
about numbers.

**(c) The colour that was bought is not being spent.** The livery work is real
and sourced. It appears as: a **7 px** two-band chip beside a name in tables;
a **22 px** ribbon on a driver or constructor page; a **~8 px** rail under a
calendar card; and one bar chart on `/records`. The bar chart is right. The
rest is a colour system used at sizes where colour cannot do anything. On
`/constructors/ferrari` — a page about the most visually famous team in
motorsport — the page's own chromatic fraction is **0.55 %**.

**(d) Nothing ever moves, including the things that change.** `app.css` is
2,619 lines and contains **one** transition (`transition: width 0.2s` on the
boot progress bar) and three keyframe animations, two of which fire only during
boot. Filtering a register, sorting a column, switching a chip and toggling the
theme are all instantaneous full repaints. Instant is right for a table; a
whole-page black↔white flip with no easing is not restraint, it is an omission.

**(e) The same page shape 21 times.** Title → lede → tiles → sections of
`.card`s → onward band → citation → footer. It is a good shape. Applied
without variation to a register, an entity, a reference document and a SQL
console, it makes four unlike jobs look like one document.

### What "engaging" should mean for this product

Not animation, not a hero video, not a redesign. For a reference source whose
voice is restrained, engaging means **the page shows you the finding before you
read it.** Five moves, each independently shippable, sized, and named to pages:

| # | Move | Pages | Size | Why |
|---|---|---|---|---|
| E1 | **A lead figure at the top of each entity page**, occupying ~40 % of the first screen, above or beside the tile strip | `/drivers/:id`, `/constructors/:id`, `/circuits/:id`, `/races/:y/:r`, `/seasons/:y` | M | Every one of these already computes a figure that is currently 1,300–5,000 px down the page, or is a table. Moving the existing dot plot / line chart / outline up and sizing it is layout, not new data. |
| E2 | **Small multiples on the four registers** — 77 title-race sparklines on `/seasons`, 80 F1DB outlines on `/circuits` (the fix for `VD-50`), 150 entry-span bars on `/constructors` | `/seasons`, `/circuits`, `/constructors` | M | This is the highest-return contemporary move available and the data is already in hand. It is also the thing a sports desk publishes that this does not: a page that shows you the whole set at once and lets you pick. Prerenders as static SVG; no runtime cost. |
| E3 | **Spend the livery colour as each page's second ink** — the section rule under an `h2`, the chart series, a 3 px rule under the `h1` | `/constructors/:id`, `/drivers/:id`, `/cars/:id` | S | The palette exists, is sourced, and clears contrast. One rule per page type. It also fixes `VD-54`, since a colour used as a rule does not have to survive as a fill. |
| E4 | **Add the middle of the type scale** — three steps between 25 and 62 px, used for one number per page (the season leader's points, the driver's wins, the record's value) | all | S after `VD-51` | A single 40 px figure per page is the cheapest possible change of energy and the one a data desk always makes. |
| E5 | **One lead photograph at size, the rest as a strip** | `/races/:y/:r`, `/seasons/:y` | S | Same six Commons files, editorially arranged rather than tiled six-up at 220 px with three lines of credit each. `/cars` already proves the card works. |

**What must not be touched.** The Pit Wall restraint itself: the mono eyebrow
above every `h1`, the tabular figures, `--ink-faint` zeros in registers, the
four-state result rail with the accent-wash P1 row, the dark theme's
independent stepping (it is a second instrument, not an inversion, and it holds
across all 21 routes). The honesty apparatus, which is the product: `OUTLINE_RULE`
printed wherever a shape appears; the measured-against-published delta with a
signed figure; the `UNCHECKED` chip; the hollow bars for the declared
1968–2009 colour gap; "each at its own scale so the shape reads rather than the
size". The static/app convergence `VD-01` bought — do not add app-only chrome
the prerenderer cannot draw (`VD-49` is already the warning shot). And the 62 px
condensed `h1`: it is the identity, and it is the only thing on the site with
velocity. Give it company, do not replace it.

---

## The rest, by consequence

### `VD-51` — Twenty-two rendered font sizes, six weights, and a hole in the middle — **M**
*Evidence: drove the site; measured `getComputedStyle` on every text node of 21 routes.* **Defect.**

The full rendered set is listed in finding 1. `VD-03` (#150) counted **19
literal `font-size` values in `app.css`** in September and is still open in
*Someday*; the page-level count is now **22** and the drift the item predicted
has happened. Three sizes are computed accidents (11.96, 12.42, 13.8 px — `em`
or `%` inside a sized parent), which is the specific failure mode a scale
prevents. Weights 600, 620 and 640 all appear on `/`, `/seasons/2026`,
`/drivers/verstappen`, `/constructors/ferrari`, `/records` and `/data/quality`;
at 13 px Saira's 600 and 640 are not distinguishable, so two of the three are
doing nothing but making the next component's choice arbitrary.

`VD-03` should be **re-ranked from Someday to Next and re-sized to M**: it is
now a prerequisite for E4 and for any of the reshaping work, and it is the only
open item whose absence *causes* other items.

### `VD-52` — `--measure: 68ch` renders as 94 characters, and table prose at 107–113 — **S**
*Evidence: probed the running page; measured the `ch` advance and the real average character advance in Saira.* **Defect.**

`tokens.css:111` declares `--measure: 68ch` and `app.css` applies it in nine
places. It is applied faithfully: the home lede measures **730 px = 67.9 ch**.
But `ch` is the advance of the digit zero, and in Saira the zero is **10.75 px
at 16 px** against an average character advance of **7.74 px** — 39 % wider. The
rendered line is therefore **94 characters**, on every lede on every page, well
past the 45–75 range the token was plainly reaching for. Worse in tables, which
do not use the token at all: the prose column on `/data/quality` measures
**107 characters** at 13.5 px and on `/reference/eras` **109**.

Two numbers fix it: `--measure: 50ch` (≈69 characters), and a `max-width` on the
prose column of `DataTable` when a cell holds a sentence. Related: five routes
render a table wider than its container at a 1440 viewport —
**`/data/quality` 2,217 px in 1,234** (983 px of overflow), `/reference/eras`
1,626 in 1,234, `/circuits` 1,329, `/races` 1,287, `/seasons/2026` 1,275.

### `VD-53` — `/records` ranks its values below its footnotes — **S**
Detailed in finding 2. The fix is small and entirely within `Records.jsx` and
`DataTable`: value at the new 40 px step in `--ink` and in a tabular face;
derivation demoted to a `<details>` or to `--ink-faint` at a narrower measure;
`As of` to `--ink-faint`. Row height falls with it. Note the leaderboards below
the fold on the same page are *good* — see *What is well made*.

### `VD-54` — A white-led livery band is 1.02:1 against the light page — **S**
*Evidence: drove the site; probed the computed background; computed the ratio.* **Defect.**

`/drivers/verstappen`, light theme: the `.livery-band` is **428 × 22 px** with
`linear-gradient(#f2f2f2 0, #f2f2f2 58%, …)`. `#f2f2f2` against `--bg`
`#f3f4f6` is **1.02:1** — the "heritage white" band is invisible, and the mark
reads as an empty input field with a blue and a red line under it. In dark it
reads correctly. So the one page-level identity mark the site has is
theme-asymmetric, and its failure mode in light is the same class as `VD-26`'s
1.002:1 rosso-corsa-against-accent: a colour drawn on the surface it matches.
Any white, silver or near-white scheme (Mercedes 2010s, Brawn, Honda, Haas,
Williams heritage) has the same problem. A `--stage` ground behind the band, or
a ring per band rather than per mark, would cost one rule.

Secondary, same object: the band is a 22 px abstract tricolour with the colour
*names* set in mono caps beside it. The name of the colour is currently louder
than the colour. E3 is the better use of the same data.

### `VD-55` — The stat strip's two ranks do not share a baseline, and it orphans a tile — **S**
*Evidence: measured `getBoundingClientRect` at five widths.* **Defect.** Extends `VD-46` (#414).

`VD-28` correctly gave the strip two ranks. On `/drivers/verstappen` at 1440 all
eight `dd` tops are y=454, but the 25 px figures bottom at 482 and the 16 px
figures at 472 — the row of eight numbers sits on **two baselines 10 px apart**.
A row of figures that does not align is the one thing this discipline treats as
non-negotiable. `align-items: baseline` on the strip, or a fixed line box for
both ranks, closes it.

Separately, the strip wraps to an orphan at two common widths: **`/` at 768**
breaks 5 + 1 (the *Photographs* tile spans the full width alone) and
**`/drivers/verstappen` at 1024** breaks 7 + 1 (*Best finish P1* alone).
`VD-46` recorded one instance of this on `/data/quality`; it is a general
property of the strip, and the item should be re-scoped to the component rather
than the page.

### `VD-56` — `tokens.css` documents a colour system the product no longer runs — **S**
*Evidence: read the source; probed the running charts.* **Defect (of the stated system, not the rendering).**

`tokens.css:6–13` states the rule in these words: the accent "means *you can act
on this*… **Never a data mark**", and the `--series-*` slots are "the chart
colours". Shipped today: ~180 constructor-season livery colours are data marks
on every register, chart, table and calendar strip; the title-race chart strokes
Hamilton `#e30016`; `/records` draws Ferrari `#e30016` bars. Three parallel
palettes now exist — `--series-*`, `--racing-*`, and the livery map in
`lib/liveries.js` — and the token file names two of them and the rule that the
third breaks. This is the project's best document describing a state of affairs
that ended three weeks ago, on a project whose whole claim is that its
statements match its data. Rewrite the header comment to declare the three
palettes, which surfaces each owns, and what is left of the accent's
reservation (links, focus, current nav, P1 wash — no longer "never a data mark",
because it is one).

### `VD-57` — The calendar strip encodes the winner by colour alone, with no legend — **S**
*Evidence: drove the site; read `Outline.jsx:105–118`.* **Defect.**

`WinnerMark` paints an `aria-hidden` bar of the winning constructor's colour
under each run round and nothing else. On `/seasons/2026` that is 14 coloured
bars whose key is a table **~500 px below**. The pattern the strip creates —
nine teal bars in a row — is the single most legible statement of the season on
the whole site, and it is undecodable in place, and unavailable to a
colour-blind reader at all. One line under the strip — *Mercedes 9 · Ferrari 2 ·
McLaren 2 · Red Bull 1*, each with its swatch — makes the colour a legend
entry instead of a decoration, and costs nothing.

### `VD-58` — One transition in 2,619 lines of CSS — **S**
*Evidence: read `app.css`; drove every interactive control.* **Preference, with one defect inside it.**

The preference: a 120–160 ms ease on chip/filter/sort state and a cross-fade on
the theme toggle would make the interface feel made rather than assembled, at
no cost to the data. I am not asking for motion on any data mark — the 09-16
verdict against a moving lap is right and I would not reopen it.

The defect inside it: `app.css:1225`'s `slide` animation (the boot bar) has no
`prefers-reduced-motion` guard where the other two do. Recorded at 09-16,
unfixed, and accessibility's to own.

### `VD-59` — The wordmark is the faintest text in the masthead — **S**
*Evidence: probed the computed styles.* **Defect (of rank), bordering on preference.**

`Lap Ledger` renders at **16 px / 700 / `rgb(101,108,119)` = `--ink-faint`**
(5.3:1). The nav items beside it render at 13.5 px / 400 / `--ink-soft`
(7.5:1). The product's own name is therefore the **lowest-contrast text in its
own masthead**, and every screenshot anyone ever takes of this site carries the
brand at that rank. For a reference that wants citation and eventually money,
this is the wrong end of restraint. `--ink-soft` for the name and `--ink-faint`
for the tagline restores the order without raising the volume.

The mark itself is good: the 4×4 chequer with one accent cell survives at the
16 px favicon (the red cell is 4 device px and visible) and in dark. Two
versions exist — the favicon has a `#14161b` rounded ground, the masthead mark
is bare — which is fine, but nothing records which is canonical.

### `VD-60` — The credit still outweighs the thing credited — **S**
*Evidence: drove the site; measured.* **Defect.** This is `VD-39` (#326), unfixed and now in two more places.

Monza's `Every layout raced here` prints "F1DB, CC BY 4.0 · drawn by Jules Roy"
**seven** times under seven ~205 px drawings; the caption block is ~130 px under
a 205 px picture. The photograph cards repeat the same shape: on
`/seasons/2026` the dominant text in each card is the **Commons file name**,
underlined and at the same size as the car's name above it — "FIA F1 Austria
2026 Nr. 44 Hamilton (1).jpg" is visually the headline and "Ferrari SF-26" the
subtitle. CC BY-SA requires the title and the author; it does not require them
to be the loudest thing in the card. Set the file name at `--ink-faint` on one
line and the subject at the card's title rank. `VD-39` should be **re-sized from
S to M and re-scoped** to cover both the outline grid and the photograph card.
Related: `CD-29` (#403) already owns the alt text.

### `VD-61` — The driver dot plot promises a colour encoding that produces no colour — **S**
*Evidence: drove the site; read the caption against the render.* **Defect (small).**

`/drivers/verstappen`, *Where each championship finished*: the caption says
"Each dot is coloured for the team that season finished with… the team's own
livery." All twelve dots render in Red Bull navy, which at `#1b2a5e` is close
enough to `--ink` that the chart reads as monochrome and the sentence reads as
unfulfilled. Either the caption should be conditional (it is only informative
for a driver who changed teams), or the chart should ring the *team changes*
the way it already rings the titles. Also: the 2015 and 2026 dots sit on the
plot frame with no padding, and the y-axis ticks run P1, P3, P6, P9, P12 —
intervals of 2, 3, 3, 3.

### `VD-62` — One page, two chart palettes — **S**
*Evidence: drove the site.* **Defect (coherence).**

`/records`: the *Most wins by a driver* and *Most poles* leaderboards are
`--series-1` blue; the *Most wins by constructor* leaderboard immediately below
is drawn in each team's own livery with hollow bars for the declared gap. The
second is much better and is the page's only colour. Nothing on the page says
why the driver charts are not coloured, and the honest answer — a driver has no
single team — deserves a line rather than a silent difference.

### `VD-63` — The em dash carries two meanings in the same table — **S**
*Evidence: queried the database; drove the site.* **Defect — data architecture's to fix, visual's to report.**

`/races/2026/13` classification: rows 11–19 show **—** in *Points*. The home
page states the site's rule in so many words: "A blank means unknown. An em
dash is a figure nobody has established — never a zero." Eleventh place scored
zero and everybody knows it; `race_entries.points` is NULL because nothing
writes a zero (`./f1 sql` confirms). On `/seasons/2026` the standings render the
same fact as **0**. So adjacent pages render the same established figure two
ways, one of which the site's own convention reads as "unknown". This is
`DA-08` (#203, *Nothing scores zero, except in the one table where everything
does*) surfacing on the most-read table in the product, and it is evidence
`DA-08` is ranked too low. **Fix belongs to data architecture.**

### Smaller lapses, folded into the items above
- The static page's breadcrumb and the app's back-link are two wayfinding
  treatments in the same position (`IA-03` #170 owns this).
- `/races/2026/13` header: the outline card's caption runs ~200 px below the
  bottom of the tile row beside it, leaving a ragged edge; and *Winner* wraps to
  two lines while *Entries* does not, so "Mercedes" and "19 classified" land
  24 px apart.
- The photograph cards on `/seasons/2026` all carry the `UNCHECKED` warn chip —
  six amber chips in one row reads as a page of errors rather than a page of
  honest metadata. A single line above the grid would say it once.
- At 320 the masthead is **172 px** (three rows of nav) and the `h1` baseline is
  at **y=257** — 29 % of the first screen before the title. Improved from the
  280 px `VD-31` recorded, still the largest single block of chrome on a phone.

---

## What is well made, and should survive the fixes

- **The 2026 calendar strip.** Twenty-three outlines, dashed where unrun, boxed
  where next, a winner's colour under each run round, states in three words.
  It is the best object on the site and the clearest proof that this design
  language can be interesting without stopping being restrained.
- **The title-race line chart.** Two teammates in one team colour separated by
  dash and marker fill, the rival in his own, **292** and **211** direct-labelled
  at the line ends. This is a professionally good chart and it is the template
  for everything E1 and E2 should look like.
- **The constructor leaderboard's hollow bars** for the declared 1968–2009
  colour gap. Drawing a gap as an absence of fill rather than as grey is exactly
  the project's ethic made visual, and I have not seen it done better elsewhere.
- **`VD-01` closed properly.** The prerendered page is now the same design, not
  a relative of it. That was the biggest visual defect on the site in September.
- **`/cars`.** Real photographs at a usable size, a card with title / meta /
  description / figures / credit, and an explicit `NO PHOTOGRAPH MATCHED` state
  that is not a broken image. The system carries imagery; this page proves it.
- **The dark theme.** Genuinely stepped against its own ground, coherent across
  all 21 routes, with separate racing-colour values that were measured rather
  than inverted. I looked for a route where dark degrades and did not find one.
- **The result rail and the accent-wash P1 row** on every classification.
- **`--ink-faint` zeros in registers** — the careers really do surface.
- **`lib/outline.js`'s comment** that the outline "borrows none of the trace's
  colours because it carries none of the trace's facts". Still the best
  sentence in the codebase.

---

## Backlog verdicts — my prefix

| ID | # | Verdict | Note |
|---|---|---|---|
| `VD-03` No type scale or spacing scale | 150 | **keep · re-rank Someday → Next · re-size S? → M** | Now measured at the page: 22 rendered sizes, 6 weights, 3 accidental. It is the prerequisite for E4 and for `VD-53`/`VD-55`. The only open item whose absence causes others. |
| `VD-22` What the formula1.com ask should buy | 268 | **decline** | Its stated content is "`PD-18`'s visual half", and its own 2026-09-13 note already reassigned the circuits half to `VD-33` (landed) and the driver half to `PD-18`. Nothing is left inside it. Fold the 96–120 px tile-rhythm spec into `PD-18`'s body and close. |
| `VD-23` Each thumbnail is three redirects | 130 | **keep · Next** | Still true, still S, and it is now on four surfaces rather than two. Performance owner, not visual. |
| `VD-29` Constant columns / missing varying ones | 132 | **keep · Now** | Re-verified: `/races/2026/13` *Laps* is 53 on 15 of 22 rows and 52 on four more; *Out* is "Finished" on 19 of 22. Promote: it is S, it is the cheapest density win, and `VD-53` needs the same `DataTable` hook. |
| `VD-37` The circuit drawing is 12 % of the width | 324 | **keep · re-rank Someday → Next · re-size M → S** | Part of it landed with `AF-23`: outlines are now ~205 px, not 162.8, and there are seven across. What is left is one number (the grid's `minmax`) plus the 55 venues with no large drawing — and E2/`VD-50` gives them one for free. |
| `VD-39` The credit prints once per card | 326 | **keep · re-size S → M · re-scope** | Unfixed, and the same failure now also governs the photograph card, where the Commons file name outranks the subject. Merge my `VD-60` into it. |
| `VD-40` The arrow is sized in metres | 327 | **decline** | `LapFigure` and the drawing half of `lib/lap.js` were removed with `AF-23`; there is no arrow left to size. Confirm against `main` and close with the reason. |
| `VD-41` Non-closing traces drawn like closing ones | 328 | **decline, or re-open against text** | Same cause: the traces are no longer drawn anywhere. `/circuits` states "does not close" as words. If `VD-50`/E2 puts outlines on the register, the item returns as *the outline cannot show a trace's loose end* — which is a different item. Close this and let `VD-50` carry it. |
| `VD-42` Three stroke-weight rules | 329 | **keep · re-size S → S · re-rank Next → Now** | Reduced by `AF-23` to two rules (outline 2.25 px fixed, register thumbnail — now gone), so this is nearly free, and `VD-50` will create the third again unless it lands first. Take it *with* `VD-50`. |
| `VD-43` /circuits prerenders with no drawing | 330 | **merge into `VD-50`** | Its premise has been overtaken: the app draws nothing either now. My `VD-50` is the same item measured against the current build, at the correct severity. |
| `VD-45` Livery mark has a right margin and no left | 398 | **keep · Now** | Confirmed on `/` ("Won by … for ▮Mercedes"). Trivially S and visible on the front door. |
| `VD-46` Stat strip orphans a tile | 414 | **keep · re-scope to the component** | I found the same break on `/` at 768 (5+1) and `/drivers/verstappen` at 1024 (7+1). It is not a `/data/quality` bug. Merge my `VD-55`'s orphan half into it; keep the baseline half separate. |
| `VD-47` Circuit photographs need a mapping first | 420 | **keep · Someday · decision** | Correctly written as a decision. I would add one line to it: `VD-50`/E2 gives `/circuits` a picture without any of this work, so the photograph question is no longer urgent and should stay behind E2. |
| `VD-48` The app.css caption rule is unreachable | 436 | **keep · Now** | Dead code, one-line fix, no argument. |
| `VD-49` Tile strips written inline in seven pages | 446 | **keep · re-rank to Now** | This is the mechanism that will undo `VD-01` the next time anyone touches a tile strip — and E1/E4 both touch tile strips. Land it before the reshaping work, not after. |
| `AF-48` Two-colour mark cannot tell Red Bull from Toro Rosso | 375 | **keep · Next · but see note** | Real (ΔE 6.2). However, at the **7 px** the mark is drawn, ΔE 26 is not reliably distinguishable either — the fix for the pair is a fix for the size. Re-write it as *the mark is too small for the discrimination it is asked to make*, and it merges cleanly with E3. |
| `AF-49` Replace the result rail with the team colour rail | 376 | **decline as written** | The result rail (podium / points / classified) is one of the best things on the site and it encodes a fact the livery does not. Replacing it spends a good channel to duplicate the chip 20 px to its right. If the team colour wants a rail, it should take a *different* page — `/seasons/:y` standings, where there is no result state — not this one. Re-open scoped to standings only. |
| `AF-58` /cars card names a constructor with no colour | 394 | **keep · Next** | Correct and S. Do it inside E3, which decides card-level colour anyway. |
| `IX-29` Layouts draw differences too small to see | 332 | **keep · re-rank Someday → Next** | Its own measurement (30 of 81 consecutive pairs differ nowhere by >10 units) is the strongest argument on the board for a size-and-registration fix, and `VD-37` is the same fix. **Merge `IX-29` and `VD-37` into one item**; they cannot be done separately. |
| `IX-32` Outline grid and layout timeline disagree at Monza | 335 | **keep · Next** | Confirmed at 1440: seven cards and nine timeline rows, joined only by a string 700 px apart. Visual half is one page, and it is the clearest coherence lapse left on `/circuits/:id`. |
| `PD-18` Driver photographs | 267 | **keep · Someday · decision** | Unchanged. But its premise has shifted: `/seasons/2026` now shows six *car* photographs and none of the drivers, so a 2026-grid pilot has a home it did not have in September. Add that line. |

**Sizes and ranks I would change overall:** promote `VD-29`, `VD-45`, `VD-48`,
`VD-49`, `VD-42` to *Now* (all S, all cheap, three of them prerequisites);
promote `VD-03` and `IX-29`+`VD-37` to *Next*; decline `VD-22`, `VD-40`,
`VD-41` and `AF-49`-as-written; merge `VD-43` → `VD-50`, `IX-29` ↔ `VD-37`,
`VD-60` → `VD-39`.

---

## A ranked top ten for the whole project, from this discipline

| # | Item | New / existing | Size | Why |
|---|---|---|---|---|
| 1 | **`VD-50` — put F1DB's outline on `/circuits`** (80 cards, one shape each) | new (absorbs `VD-43`) | S | Turns the emptiest register into the site's best-looking page using data already in `f1.db`. Highest visible return per hour on the board. |
| 2 | **`VD-53` — `/records`: the value at display size, the derivation demoted** | new | S | The most citable and most screenshot-able page currently ranks its records below its footnotes. The commercialisation argument in one page. |
| 3 | **`VD-52` — `--measure: 50ch`, and a measure on prose table columns** | new | S | Every line of running text on the site is 94 characters; two prose columns are 107–113. One token and one rule. |
| 4 | **`VD-03` — a type scale and a spacing scale, with a middle register** | existing (re-sized M) | M | 22 rendered sizes and no step between 26 and 61 px. Nothing else on this list stays fixed without it. |
| 5 | **E2 — small multiples on `/seasons` and `/constructors`** | new | M | The contemporary data-editorial move this product is best shaped for and has never made: show the whole set, let the reader pick one. 77 sparklines, 150 bars, both prerenderable. |
| 6 | **E1 — a lead figure at the top of each entity page** | new | M | The charts already exist and are 1,300–5,000 px down. Moving and sizing them is layout. Breaks into one page type per sitting. |
| 7 | **E3 — spend the livery colour as a page's second ink** | new (absorbs `AF-58`, re-frames `AF-48`) | S per page type | ~180 sourced colours currently drawn at 7 px. A rule, a section mark and a chart series per entity page. |
| 8 | **`VD-55` — one baseline for the two tile ranks; stop the orphan** | new (half merges `VD-46`) | S | A row of eight figures on two baselines, on the site's signature component, at three common widths. |
| 9 | **`VD-49` — move the tile strips into shared code before reshaping** | existing (re-ranked) | M | The mechanism that will quietly undo `VD-01`. Land it before items 6 and 8 touch the same component. |
| 10 | **`VD-56` — rewrite `tokens.css`'s header to describe the system that ships** | new | S | The project's credibility rests on its statements matching its data. Its best design document currently describes a colour rule the product broke three weeks ago. |

Just outside: `VD-54` (the 1.02:1 white band) — real and cheap, but E3 makes it
moot if E3 lands first; `VD-57` (the calendar legend) — S and lovely, take it
with item 1; `VD-29` — promote regardless, it is half a day.

---

## What I did not examine

Hover, focus and active states beyond observing that no transition exists;
keyboard focus rings; the search palette's rendered appearance; the throttled
cold load and the look of the boot swap (the boot panel's position was fixed by
`VD-01`'s work but I did not re-measure it under throttling); print and
`forced-colors`; `/cars/:id`, `/now` beyond confirming it renders `/seasons/2026`,
`/data/sources` and `/changes` at anything other than 1440 and 400; the SQL
console's editor typography at small sizes; colour-vision simulation (I reasoned
about sole-channel encodings rather than simulating, because the site's only
hue-only encoding is `VD-57`'s winner mark); the 2,385 prerendered pages beyond
four samples; and every route between 1440 and 2560, where `--page: 1280` means
the design simply centres.
