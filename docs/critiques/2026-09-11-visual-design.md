# Visual design critique — 2026-09-11

**Critic:** `visual-design-critic`, first live run.
**Subject:** the front end at v2.21, commit `c4026ca` on `main` *(the critic wrote `c8aa3cf`, the pre-#33 head; corrected — the served build was v2.21)*, driven as a
built site (`vite preview` of `web/dist`) at http://localhost:4180 in Playwright
Chromium.
**Brief:** `.claude/CRITIQUE-BRIEF.md`. Prior critiques read before starting:
`docs/critiques/2026-09-10-{product-design,information-architecture,content-design}.md`
and `docs/BACKLOG.md`.

**What I judged.** The **running app**, unless a finding says otherwise. Where a
finding is about the prerendered HTML I say so explicitly, because this site has
two renderers and telling them apart is half the job. Screenshots: light and
dark at 1280×1000 and 375×812, plus no-JS captures and a throttled cold load.
All of it in a scratch directory; **the repository was not modified**.

**Status of the claims.** Every number below was measured in the browser or read
out of the source, and the location is given so it can be re-checked. The
contrast ratios are my own computation from the resolved token values (probed
from `getComputedStyle` on the running page, not read off `tokens.css`), by the
WCAG relative-luminance formula. Where I am inferring rather than observing I
say `inference`. Findings are filed as `VD-nn` in `docs/BACKLOG.md`; this file is
the reasoning.

**Re-checked by the author before filing:** nineteen distinct literal `font-size` values in `app.css` (2,291 lines); `overflow-wrap: anywhere` at `app.css:504` on `.stats dd`; `ColumnChart.jsx` passes no `integer` option where `DotPlot.jsx:42` and `:53` do; `thead th` at 9.5 px (`app.css:596`, `:841`); `Atlas.jsx:80` opens on `'spa'`. The contrast computations, the 13 s cold-load figure and the boot panel's `y = 6151` were not re-measured and stand at the critic's stated evidence level.

---

## The three that matter

### 1. There are two visual systems, and a cold arrival meets the weaker one for thirteen seconds

The product critique established that the prerendered half prints different
*numbers* (`PD-02`), the content critique that it deletes the *rules* (`CD-04`),
the IA critique that it holds half the *wayfinding* (`IA-03`). Nobody has yet
said the obvious visual thing: **it is a different design.**

Side by side at 1280, `/drivers/hamilton`:

| | app | prerendered |
|---|---|---|
| `h1` | `clamp(34px, 5.2vw, 62px)`, **uppercase**, tracked ‑0.012em (`app.css:357`) | `clamp(28px, 4vw, 40px)`, sentence case (`app.css:2171`) |
| the figures | eight stat tiles, each with a lit accent edge | a 13-row grey key/value table |
| the chart | a dot plot of every championship finish | absent |
| the classification | a four-state result rail | absent |
| the circuit page | the traced centreline | **no drawing at all** |
| `/circuits/atlas` | the wall | a heading, two lines, and ~1,000 px of empty white above the footer |

On a 500 KB/s connection (Chrome DevTools emulation, 100 ms latency) the app
replaced the static page at **13 s**; the static page is what was on screen at
3 s, 5 s, 7 s, 9 s and 11 s. That is the version a search arrival reads, and it
is the one carrying `Status: active` and `Confidence: verified` as bare rows in a
schema dump.

The static page is not badly made — it is *unrelatedly* made. Shipping the same
shapes (the tile row, the rail, the section rhythm) from one set of rules would
cost less than maintaining the second look, and it is the one change that makes
the front door look like the product.

### 2. The component built to make the wait legible renders 6,151 px below the fold

`Boot.jsx` is a good piece of work: four named phases, a byte count, a real
progress bar, and a comment explaining why a spinner would be a lie. During a
cold load I found it in the DOM at **`y = 6151`, height 1000** — six screens
below the prerendered content, on `/drivers/hamilton` at 1280×1000. It stays
there for the entire download (`"Downloading the database"` at 3–9 s, `"Starting
SQLite"` at 11 s) and is removed at 13 s without ever having been on screen.

So the reader gets no indication that anything is loading, no indication that a
better version is coming, and then the page silently changes shape under them.
The fix is layout, not design: while `#prerendered` is present, render the boot
state as a slim strip pinned under the masthead, and keep the full panel for the
case where there is no prerendered content to stand in front of it.

### 3. The design system is a colour system; type and space are ungoverned

`tokens.css` is excellent and I will defend it below. It is also the whole of the
system: it declares three font *families*, `--measure`, `--page`, two radii — and
**no type scale and no spacing scale**.

What is in `app.css` instead:

- **nineteen literal pixel font sizes** — 9, 9.5, 10, 10.5, 11, 11.5, 12, 12.5,
  13, 13.5, 14, 14.5, 15, 16, 16.5, 19, 20, 22, 25 — plus three `clamp()`s and
  one `em`. Thirteen distinct steps between 9 px and 16 px, at half-pixel
  intervals. That is not a scale, it is a continuum.
- **twenty-seven literal spacing values**, including every integer from 1 to 18.

The result still mostly looks coherent, because it was all chosen by one pair of
eyes in one go. But nothing holds it: the next component gets 11 px or 13 px by
feel, and the drift is invisible until someone lines two screens up. The colour
half of this system is enforced (two `#fff` literals in 2,291 lines of CSS, and
nothing else); the typographic half is enforced by memory.

---

## The findings

Each carries: evidence, defect or preference, and a size.

---

### `VD-01` Two visual systems, and the weaker one is the front door — **M**

*Evidence: drove the site (no-JS captures at 1280, throttled cold load); read the
source.* **Defect.**

Detailed above. Locations: `app.css:2144–2270` (the `#prerendered` block, with
its own `h1`/`h2`/`h3` sizes, its own `.facts` shape, its own `.cards`),
`app.css:357` (the app's `h1`), `scripts/prerender.js` (the markup).

The specific lapses, in order of how much they cost:

1. `/circuits/monaco` static shows **no centreline**. The ODbL geometry is the
   most distinctive thing this project draws and the search-engine version of
   the page does not have it. `/circuits/atlas` static is honest about needing
   JavaScript — good copy — but leaves a 1,000 px white void above the footer,
   which reads as a broken page rather than a deliberate one.
2. Two `h1` treatments for the same content, one uppercase display and one
   sentence case, swapping at 13 s.
3. Eight measured figures presented as tiles in one and as a schema table in the
   other — including two rows (`Status`, `Confidence`) that the app deliberately
   does not surface at the top of a page.
4. The static masthead has no active-item underline, no search affordance and no
   theme control, so the chrome changes at the same moment as the content.

**What I would do.** Ship with `PD-02`. When the prerenderer is made to call the
page components' queries, make it emit the components' *shapes* too — the tile
row, the section heading with its count, the table with its footer note. The
`#prerendered` CSS block should shrink to almost nothing; the fact that it is 126
lines is the measurement of the divergence. The one thing worth keeping distinct
is the breadcrumb, which the app should adopt rather than the static page drop
(`IA-03`).

---

### `VD-02` The boot panel renders six screens below the fold — **S**

*Evidence: drove the site (DOM probe during a throttled cold load).* **Defect.**

`Boot.jsx`, mounted inside `#root` beneath the still-present `#prerendered`
block. Measured at `y = 6151` for the full 13 s of a 500 KB/s cold load. The
progress bar, the phase word and the byte count are all correct and all
unreadable.

**What I would do.** Two states for one component. While `#prerendered` is in the
document, render a 3 px accent progress strip immediately under the masthead with
the phase word beside it at 11–12 px — enough to say *something is arriving*
without competing with the content that is already readable. When there is no
prerendered content, keep the full panel exactly as it is.

---

### `VD-03` No type scale and no spacing scale in the token file — **M, shippable in pieces**

*Evidence: read the source (`tokens.css`, `app.css`).* **Defect** of system
coherence, not of any single screen.

Nineteen literal font sizes and twenty-seven spacing values, none of them named.
`tokens.css:85–94` declares families, measure, page width and radii, and stops.

**What I would do.** Not a rewrite. Add `--size-1…-8` and `--space-1…-7` to
`tokens.css`, choose the eight sizes that cover the nineteen (9.5/11/12/13.5/
15/19/25 plus the display clamps is close to what is already there), and convert
one file's worth of components per sitting. The value arrives incrementally: each
converted component is one that cannot drift again, and the first conversion pass
is what surfaces the one-offs (7 px, 9 px, 11 px, 13 px, 15 px, 17 px) that have
no reason to exist.

---

### `VD-04` The registers spend their full ink on absence — **S**

*Evidence: drove the site (DOM measurement on `/drivers`).* **Defect of
hierarchy.**

On the first 150 rows of `/drivers`, **973 of 1,200 numeric cells — 81% — are
`0` or an em dash**, and every one of them is set in `--ink` (`rgb(20,22,27)`),
the same weight and colour as Prost's 51 wins. Nine columns, seven numeric. The
eye lands on a field of zeros and has to hunt for the two rows in twenty that
carry a career.

This is the site's densest screen and the test the brief sets — *can the eye find
the primary value without reading?* — fails on it. It fails for the same reason
in both themes.

**What I would do.** One rule in `DataTable`: a zero or an unestablished value in
a numeric column renders at `--ink-faint`, the way the header row already does.
Nothing moves, nothing is hidden, the convention that a blank is not a zero is
untouched — and Ascari, Prost and Jones surface out of the page without a single
new pixel of chrome. (`--ink-faint` is 4.7:1 on panel in light, 4.8:1 in dark, so
this does not create a contrast problem.)

---

### `VD-05` The column chart draws a time series on an ordinal axis, and prints half a win — **S**

*Evidence: drove the site (`/constructors/ferrari`); read the source.*
**Defect**, and a direct contradiction of a rule the project states in
`web/README.md`.

Two things at once on *Ferrari race wins*:

1. **The y-axis is ticked 0, 2.5, 5, 7.5, 10, 12.5, 15** on a count of race
   wins. `web/README.md` says *"Axis ticks must be round, and whole where the
   values are"*, and `scales.js:35` implements exactly that with an `integer`
   option — which `ColumnChart.jsx:44` does not pass. `DotPlot` and `LineChart`
   both pass it on their category axes. One argument, one line.
2. **The x-axis is a `band()` scale over "seasons Ferrari won in"**, so the
   winless years are not narrow bars, they are *not there* — and the pixels
   between 1990 and 1994 are the same width as the pixels between 1996 and 1997.
   The subtitle admits it (*"Only seasons with a win are drawn"*), which is
   honest text under a dishonest picture. A reader sees an unbroken run of wins
   from 1951 to 2026.

**What I would do.** Pass every season in the constructor's span, zeros included,
and the axis becomes true, the drought becomes visible, and the subtitle can be
deleted. Then pass `{ integer: true }` at `ColumnChart.jsx:44`. Both together are
one sitting, and the chart goes from misleading to the single most interesting
figure on the site.

---

### `VD-06` The dot plot never labels P1 — **S**

*Evidence: drove the site (`/drivers/hamilton`); read the source.* **Defect.**

`DotPlot.jsx:42` ticks the position axis with `ticks([1, top], 4, { integer:
true })`, which for a 10-position domain yields a step of 2 and a first tick at
**2**. So the gridlines read P2, P4, P6, P8, P10 and the seven title-winning
seasons sit above the topmost line with nothing naming the value they share. On a
chart called *Where each championship finished*, the championship is the one
value not on the axis.

**What I would do.** Force the domain minimum into the tick set for this chart —
P1, P3, P5, P10, or P1 plus the existing evens. And since P1 is the one position
that means something categorically different, this is the place the accent
belongs: a faint accent rule at P1 with the label in accent, per the token file's
own statement that accent means *"this was fastest"*.

---

### `VD-07` The result rail's middle two bands are the same lightness, in both themes — **S**

*Evidence: read the source (`tokens.css:55–62`); computed contrast from probed
token values.* **Defect**, and an interesting one because it is a measurement
taken against the wrong thing.

`tokens.css` records the rail colours measured **against the panel** — 5.9 / 4.0
/ 3.1 in light, 5.4 / 3.5 / 3.5 in dark — and concludes all four states can be
seen. But the comparison a reader makes is *band against band*, and that was
never measured. My computation from the shipped values:

| pair | light | dark |
|---|---|---|
| podium → scored points | 1.83 : 1 | 1.48 : 1 |
| **scored points → classified** | **1.05 : 1** | **1.07 : 1** |

`--rail-points` and `--rail-classified` are within 2% of the same relative
luminance in both themes. They differ by hue only — a pink against a blue-grey —
on a 4 px vertical bar. To a protanope they are one band, and to anyone else they
are one band at a glance. The tokens file's own stated fear (*"which left the
rail encoding podium-versus-not"*) has come back one rung down: what ships
encodes **podium / everything-else**.

The rail's defence — that it always sits beside the position text — holds for
*classified*, which the position number gives you. It does not hold for *scored
points*, which is the band that varies by era and which the rail is the only
compact carrier of.

**What I would do.** Separate points and classified by lightness, not hue: keep
`--rail-points` where it is and take `--rail-classified` down (light) / up (dark)
until the pair clears about 1.6:1 between them while both still clear 3:1 against
the panel. Then add the band-against-band figures to the comment, because the
comment is what will be checked next time.

---

### `VD-08` The interface's most unusual claim is set in 10.5 px monospace across 175 characters — **S**

*Evidence: drove the site (computed style and bounding box on
`/constructors/ferrari`); read the source (`app.css:1791`).* **Defect.**

The `.livery-band` note — *"— Italy's international racing colour, under the
convention that painted a car for the country that entered it until sponsor
liveries took over around 1968. Not this team's own livery."* — renders as:

- **JetBrains Mono**, `font-size: 10.5px`, `color: var(--ink-faint)`
- **1,110 px wide**, 184 characters, which lands as roughly **175 characters on
  the first line**
- against a `--measure` token of **68ch** that the ledes on the same page obey

This is the sentence that does the work of the whole international-racing-colour
decision: it is the reason a reader does not think you have invented a team
livery. It is set smaller than the footnote under a chart, in the face reserved
for figures, on a line three times the measure the system declares.

The same habit appears wherever a note sits beside a swatch or a label: mono is
being used as a *tone* (technical, instrument-panel) rather than for its job
(figures that must align). `web/README.md` states the job correctly — *"every
number that lines up in a column is set in JetBrains Mono"* — and prose is not
that.

**What I would do.** Set the explanation in `--sans` at 12.5–13 px, `--ink-soft`,
constrained to `--measure`, under the swatch rather than beside it. Keep the
swatch and the uppercase mono **ROSSO CORSA** label exactly as they are — that
pairing is good, and the mono there is doing real work as a code-like identifier.

---

### `VD-09` `overflow-wrap: anywhere` breaks years mid-number — **S**

*Evidence: drove the site (1280 and 375, light and dark); read the source
(`app.css:504`).* **Defect.**

The titles tile on `/drivers/hamilton` renders `2008,2014,2015,201` / `7,2018,
2019,2020`. On `/constructors/ferrari` it is worse: `1999,2000,2001,200` /
`2,2003,2004,2007,2` / `008`. A four-digit year split across a line break, three
times on one tile, in a database whose subject is numbers.

Cause: `.stats dd { overflow-wrap: anywhere }` (`app.css:504`), inherited by
`.stats dd small`, against a comma-separated list with no spaces to break at in a
123 px column. The rule's comment is about proportional versus tabular figures
and does not mention wrapping at all, so this is an accident rather than a
decision.

It appears on every driver and constructor with more than two titles, at every
width I tested.

**What I would do.** Two small things. Scope `overflow-wrap: anywhere` to the
element that needs it (the provenance URL case the `.fields` comment at
`app.css:544` correctly describes) and off `.stats dd`. Then format the list with
a space after each comma and ranges collapsed — `2008, 2014–15, 2017–20` — which
is shorter, wraps at commas, and reads as a career rather than a dump.

---

### `VD-10` A badge that never varies is decoration, and the project has already written the rule against it — **S**

*Evidence: drove the site (`/records`, `/reference/eras`); read the source.*
**Defect**, and an internal contradiction.

`/cars` says, on the page, in the section note:

> Every one of these is flagged a landmark in the register, so the flag is not
> drawn: it would sit on all 29 and mean nothing.

That is exactly right, and it is exactly what `/records` and `/reference/eras`
do. `/records` gives the rightmost column of a six-column table to **thirty
identical `MEDIUM` badges**; `/reference/eras` prints **ten identical `MEDIUM`
badges** down a timeline. Each badge is an outlined box, so the effect is a
column of empty rectangles that a reader must look at and then discard.

**What I would do.** Where a page's rows all share a tier, say it once in the
section note and drop the column. The space on `/records` is better spent giving
the `DETAIL` column room. (This is smaller than, and independent of, `PD-03`
deriving the leaderboards — the badge column is wrong whether the figures are
authored or derived.)

---

### `VD-11` The confidence ladder is drawn without rungs — **S**

*Evidence: drove the site (`/reference/quality`, both themes).* **Defect.**

Five tiers, five badges, and only the two extremes are coloured: `VERIFIED` in
the good wash, `UNVERIFIED` in the warn wash, and **`HIGH`, `REFERENCE` and
`MEDIUM` are pixel-identical outlined boxes**. The page is called *The confidence
ladder* and the badge does not encode rank.

That matters away from this page more than on it. A reader who meets
`REFERENCE` on a car page, or `MEDIUM` on `/records`, cannot tell from the mark
whether it is near the top of the ladder or near the bottom; they have to come
back here and read a table. The badge is doing the work of a label but is
shaped like a rank indicator.

**What I would do.** Step the three middle rungs on a channel that is not hue:
border weight, or a two- or three-cell rung mark before the word, or a stepped
`--ink` → `--ink-faint` on the border. Colour stays where it is — the extremes
keep their washes, so nothing depends on colour alone — and the middle becomes
readable as an ordering.

---

### `VD-12` The circuit page shows the weakest possible drawing of the best asset — **M**

*Evidence: drove the site (`/circuits/monaco` vs `/circuits/atlas`, both themes,
both widths).* **Defect**, and this is where I answer the 3D-with-elevation ask.

The same centreline, on two pages:

| | `/circuits/:id` | `/circuits/atlas` |
|---|---|---|
| stroke | 1 px `--ink` outline | banded by corner radius, 5 steps |
| start/finish | none | red marker |
| direction | none (stated as text in a tile) | scrubber walks it |
| scale | none | true-scale toggle across all 25 |
| legend | none | corner-radius key with metre ranges |
| use of frame | Monaco occupies roughly a third of a 730 px box | fills it |

The circuit page is the one with an audience — 80 circuit routes, reachable from
every race — and it shows the flattest rendering. The atlas is the one nobody
arrives at, and it holds the good one. `PD-08` sized this as "decide what the
atlas is for, unsized"; my discipline sees a cause the product critic did not.
**The atlas has no audience partly because the page that has one shows an
inferior drawing of the same data, so a reader is never given a reason to want
more of it.**

**What I would do, and what I would not.**

- **Do:** render the circuit page's map with `Atlas.jsx`'s renderer — radius
  bands, start marker, direction, the walked-versus-published figure it already
  prints below. One component, one call site. This is most of the "looks nicer"
  the author is after, it costs a sitting or two, and every pixel of it is a
  fact. Keep `/atlas` as what it is genuinely for — *comparison at one scale* —
  and link to it from the circuit page as the compare view, which the page
  already does in prose.
- **Do not build an interactive 3D scene.** A perspective view of a circuit
  makes the one comparison the shape exists to support — this corner against
  that one, this circuit against that one — *harder*, because it puts the near
  end of the lap at a different scale from the far end. Every reference atlas
  that has ever worked draws tracks in plan. This one would be decoration at the
  cost of the comparison, which is the brief's first test, and it is an L.
- **Elevation is a different question, and a better one.** Eau Rouge is a fact
  about elevation, and the database holds none — there is no altitude column and
  no licensed source for one in `source_registry`. *If* elevation is ever
  sourced and classified, the figure that serves a reference reader is a **60–80
  px profile strip beneath the plan map**, x-aligned to the same distance axis as
  the scrubber, so the reader sees the climb at the position they are standing
  at. That is a small chart in a system that already has four. It is not a third
  dimension of the map.

---

### `VD-13` `/records` right-aligns scalars and phrases in the same column — **S**

*Evidence: drove the site.* **Defect of alignment.**

The `VALUE` column holds `16`, `8`, `21 from 22`, `15 from 16 (93.75%)`, `833`,
`2 teams`, `7 each`, `over 400`, `about 47%`, `23 years, 134 days`. All
right-aligned, all in mono. The consequence is that the digits do not line up as
digits: the right edge holds `16`, `22`, `%)`, `33`, `ms`, `ch`, `00`. A reader
scanning down the column of figures is reading the last token of a sentence.

**What I would do.** Split the column: a right-aligned numeric column for the
scalar and a left-aligned qualifier beside it (`21` / `from 22`, `15` / `from 16
(93.75%)`, `about` / `47%`). If that is too much surgery before `PD-03` settles
what the page is, left-align the whole column — a column that does not align as
numbers should stop pretending to.

---

### `VD-14` On a phone the widest tables clip at the container edge with no affordance — **S**

*Evidence: drove the site at 375×812, light and dark; read the source
(`app.css:569`, `app.css:2236`).* **Defect.**

`.table-scroll { overflow-x: auto }` is the right mechanism and the tables do
scroll. What is missing is any sign that they do. At 375:

- `/races/2024/1` shows `POS · DRIVER · CONSTRUCTOR` and cuts dead at the border.
  Grid, laps, out, points and fastest lap are off-screen with nothing indicating
  they exist.
- `/drivers` shows `DRIVER · NATIONALITY` and clips `United States of Am…`
  mid-word at the edge. **Seven of the nine columns — the entire career record —
  are invisible**, on a register whose lede promises the career.

The nav strip above has the same problem (`IA-14`, already filed, and I confirmed
it visually: `Circ…` is cut at 375 with the scrollbar hidden). So a phone reader
meets two silent horizontal scrolls on the same screen.

**What I would do.** A right-edge fade on `.table-scroll` when it is scrollable —
a 24 px gradient from `--panel` to transparent, removed at the scroll end. Cheap,
purely visual, and it is the standard signal. For `/drivers` specifically,
consider dropping to a three-column phone layout (name, seasons, a single
"record" summary) rather than hiding seven columns behind a gesture — but the
fade is the S, and it ships today.

---

### `VD-15` Column headers are set at 9.5 px — **S**

*Evidence: drove the site (computed style; 1× capture at `deviceScaleFactor: 1`);
read the source (`app.css:596`, `app.css:841`).* **Defect at the stated size, and
a mild one.**

`thead th { font-size: 9.5px; font-family: var(--mono); letter-spacing: 0.16em;
text-transform: uppercase; color: var(--ink-faint) }`. I captured the
classification table at 1× to see it as a non-retina reader does: it is legible
and it is effortful. Uppercase monospace at 9.5 px is below where any reference
interface I would defend puts a functional label, and these labels are functional
— they carry the sort control.

The letterspacing and the all-caps are doing real work (they make the header band
read as a band, not as a row of data) and I would keep both. The size is the
problem.

**What I would do.** 10.5–11 px, same face, same tracking, same colour. It costs
nothing — the row already has 10 px of vertical padding — and it is one of the
first things `VD-03`'s scale should pin down.

---

### `VD-16` Prose inside a table cell ignores the measure the system declares — **S**

*Evidence: drove the site (`/reference/sources`, `/reference/quality`).*
**Defect of consistency.**

`--measure: 68ch` is applied in eight places (`app.css:118, 371, 403, 898, 921,
977, 1623 …`) — all of them ledes and prose blocks. No table cell has it. On
`/reference/sources` the `CONSEQUENCE` column runs a sentence of roughly **128
characters per line** at 1280; on `/reference/quality` the *What it means* column
is similar. These are the two pages a journalist or a Wikipedia editor reads
carefully, and they are the two with the longest lines on the site.

**What I would do.** `max-width: 60ch` on prose-bearing table cells. It is one
declaration and it puts the one rule the system has about line length back in
charge of the place it is most needed.

---

### `VD-17` The pale end of the sequential ramp is under 3:1 against its own stage — **S**

*Evidence: computed contrast from probed token values; drove the site
(`/circuits/atlas`, both themes).* **Defect, narrow.**

The ramp's *assignment* is right and deserves saying plainly: `Atlas.jsx:47`
maps the tightest radius to `--seq-5`, which is the darkest step in light and the
lightest in dark, so **the hairpins are the strongest mark in both themes**
(11.2:1 in light, 10.6:1 in dark against `--stage`). That is the correct
direction and it survived the dark-mode reversal. Good.

The weak end is `--seq-1`, *straight*: **1.99:1 in light**, 2.86:1 in dark. Both
under the 3:1 a non-text graphic wants. The consequence is not that a reader
misses a band — it is that the straights carry the *silhouette*, so at 1.99:1 the
recognisable outline of the circuit is the faintest thing on the page. On a dim
laptop panel in daylight, parts of Spa's Kemmel straight drop out.

**What I would do.** Darken `--seq-1` in light until it clears 3:1 against
`--stage` (roughly a step and a half down the same hue), then re-run the palette
validator that already exists in `src/charts/palette.js` to confirm the five
bands stay separable from each other. While there: the legend swatches are 26×8
px dashes of five steps of one hue, which is the hardest possible way to tell a
ramp apart — make them 26×14 and butt them together as a continuous bar with the
labels beside it, which is how a sequential key reads.

---

### `VD-18` The fastest-lap mark ignores the meaning the token file assigns to the accent — **S**

*Evidence: read the source (`tokens.css:6–8`, `Race.jsx:334–339`); drove the
site.* **Defect of consistency, small.**

`tokens.css` opens by defining `--accent` as *"you can act on this **or this was
fastest**"*. The only place on the site where "this was fastest" is marked is the
`FL` column of the classification, which renders a bare `'●'` in body ink
(`Race.jsx:338`). So the token file states a semantic that its single use site
does not honour, and the mark itself is an unlabelled bullet under a 9.5 px
header.

**What I would do.** Either colour it `--accent` — it is not clickable, but
neither is P1's row wash, and the token comment already blesses it — or delete
the second clause from the token comment. The first is better: it gives the
column a reason to exist at a glance.

---

### `VD-19` The SQL console clips its own example query — **S**

*Evidence: drove the site (`/reference/sql`, 1280×1000, both themes).*
**Defect.**

The editor loads with a seven-line example and the textarea is short enough that
`LIMIT 15` is sliced through the middle by the bottom edge. The first thing the
page shows a developer evaluating this project is a query they cannot fully see.

**What I would do.** Size the textarea to the loaded query's line count, with a
floor of about eight rows and a ceiling, and keep it resizable. This is the page
that has to look competent to the bulk-data audience `PD-11` wants to court.

---

### `VD-20` A loading photograph and an absent photograph look the same — **S**

*Evidence: drove the site (`/cars`, network trace and DOM measurement).*
**Defect.**

`.carcard-shot` reserves 180 px of `--panel-sunk` per card (`app.css:1890`, with
a comment explaining why every frame is one height — that reasoning is right).
But the *loading* state and the *no photograph matched* state are both a flat
grey rectangle of that size, so for the first seconds the register is 29 grey
boxes and the reader cannot tell which will resolve.

And it is seconds. Each thumbnail goes through **three hops** —
`commons.wikimedia.org/wiki/Special:FilePath/…` 302 → `Special:Redirect/file/…`
301 → `upload.wikimedia.org` 200. I counted **72 Wikimedia responses for 24
images**, first response at 1.4 s after navigation, on an unthrottled
connection with the database already warm.

**What I would do.** Give the loading state something the empty state does not
have — the sunk panel with a faint centred rule, or a very low-amplitude shimmer
— so the two are distinguishable; the "no photograph matched" label already
distinguishes itself once it is the settled state. Separately (and this is a
build question rather than a visual one) the three-hop URL is worth replacing
with the resolved `upload.wikimedia.org` thumbnail URL if the licence metadata
harvest can capture it, which would cut two round trips per image.

---

### `VD-21` The README describes a mark the site does not ship — **S**

*Evidence: read the docs (`web/README.md`); read the source (`index.html`);
drove the site.* **Defect of record, not of design.**

`web/README.md` says: *"The mark is a chequered flag, three squares by two… Six
cells rather than four… The two accent cells sit on the bottom row."* What ships
in `index.html` is a **4×4 grid, eight white cells, one accent cell** on a dark
rounded square, and the source comment there describes that correctly (*"Eight
cells of a chequered field, one in accent… The 4x4 grid holds to 24px; below that
the mark is redrawn 3x3"*). Two documents, two marks.

On the mark itself, as design: it survives. At 26 px in the masthead it reads as
a chequered flag and the single red cell registers. At favicon size the 4×4 is at
its limit, which is what the 3×3 fallback in the comment is for. I have no
quarrel with it. The wordmark beside it — `LAP LEDGER` in condensed bold with a
10.5 px mono strapline — is the most confident piece of typography on the site
and should not be touched.

**What I would do.** Fix the README paragraph. A stale description of the
identity is the one piece of documentation that a future redesign will trust.

---

### `VD-22` Driver photographs: what the f1.com ask should actually buy — **M for the surface, L for the data** 

*Evidence: queried the database; read the source (`schema.sql:562–579`,
`commons.js`); drove the site.* This is an **answer to a question**, not a
defect.

The state of it, checked rather than assumed:

- `article_images` is the only image table, it has **602 rows**, and it joins
  **`chassis.article` only**. There is no image path for drivers, constructors or
  circuits — no `article` column on `drivers` or `circuits` at all.
- **265 of the 602 have `name_matches = 1`**, which is why some car credits end
  in `· unchecked`.
- So `/cars` is the only page on the site with a photograph, and it is already
  the most magazine-like surface here. The machinery — `CommonsImage`,
  `attribution()`, `canShow()`, the fails-closed smoke test — is good and is the
  hard part.

**My judgement on the ask.** formula1.com's driver pages are a marketing surface
for a licence holder; their photographs are FOM copyright and they lead with a
face at 600 px because they are selling a season. This is a reference source, and
the image that serves a reference reader on a driver page is **an identification
photograph, not a hero**: a 96–120 px portrait set beside the `h1`, in the
existing tile rhythm, credited in the caption by `CommonsCredit` exactly as the
car cards are. It confirms *you are on the right Hamilton* and it costs no
vertical space above the figures. A full-bleed hero would push the eight stat
tiles — the reason the page exists — below the fold, and that is the failure the
brief's first test is about.

The reachable path, and it is not small: Wikidata's **P18 (image)** is CC0,
present on essentially every F1 driver, and this project **already uses Wikidata
to resolve circuit identity to an OSM relation** (stated on `/reference/sources`).
So the identity resolution is a pattern that exists here. The work is a harvest
plus a `drivers.article`-equivalent plus a `verify.py` check, which is an **L on
the data side**; the front-end surface, once the rows exist, is an **M**. Worth
saying plainly: the visual half is the cheap half, and it should not be started
until the data half is decided.

If only one image programme is ever done, **circuits would serve the reader more
than drivers** — because `VD-12` shows the circuit page already has an image and
is under-using it, and because a photograph of Monaco tells a reader something a
name does not, whereas 862 driver portraits mostly tell them what they already
knew.

---

## What is genuinely good, and should survive the fixes

Specifically, so it is clear what not to touch:

- **`tokens.css` as a colour system.** Two `#fff` literals in 2,291 lines of CSS
  and nothing else: every colour on this site comes from a token. That is rarer
  than it sounds and it is why the dark theme works at all.
- **Dark is a second instrument, not an inversion.** `--panel #14161b` on `--bg
  #0c0d10` with `--panel-raised #1b1e25` is genuinely stepped against its own
  ground, and the theme holds on every one of the twelve screens I shot in both.
  The sequential ramp's *reversal of direction rather than of values* in dark
  (`tokens.css:130`) is the detail that proves someone thought about it.
- **The tabular discipline.** Every figure that sits in a column is in JetBrains
  Mono, numeric columns are right-aligned, and `/seasons` — 77 rows, nine
  columns, points and margins — aligns perfectly. The `DataTable` component is
  the strongest thing in the front end.
- **The atlas.** The best-made screen on the site: the radius bands are derived
  from the real distribution, the legend gives metre ranges rather than
  adjectives, the caveat about radius-not-g-force is the right length in the
  right place, and the true-scale toggle makes a comparison nothing else here
  makes. My complaint in `VD-12` is that it is the only place this work appears.
- **The search overlay.** Kind label, name, right-aligned meta, accent bar on the
  selected row, keyboard hints and an indexed count in the footer. It is correct
  in both themes and it is the one interaction that feels like an instrument.
- **The focus ring**: 2 px `--accent` solid at 2 px offset, present on the first
  thing I tabbed to.
- **The one filled button on the site is `Run`.** Reserving a solid accent fill
  for the single destructive-looking-but-harmless action, and giving every other
  control an outline, is disciplined and it works.
- **`app.css` comments.** Nearly every unusual rule carries the reason it exists
  (`.carcard-shot`'s equal heights, `.fields`' `anywhere`, the `.sr-only` note
  about an unnamed rail column). Three of my findings above were locatable in
  minutes because of them.

---

## What I did not examine

- **Any theme other than light and dark**, and no forced-colours / high-contrast
  mode.
- **Print styles** — I did not check whether there are any.
- **Real devices.** Everything is Chromium at `deviceScaleFactor` 2 and 1;
  `VD-15` is the one finding where a real non-retina panel would sharpen the
  verdict, and `VD-14` should be confirmed with a thumb before sizing.
- **Safari and Firefox.** Condensed faces and `text-wrap: balance` behave
  differently; I saw neither.
- **Motion**, transitions and the scrubber in use — I captured the atlas at rest.
- **Contrast auditing as an accessibility discipline.** I computed ratios only
  where a *visual* claim depended on one (`VD-07`, `VD-17`). The accessibility
  critic owns the full audit, and owns the `FL` bullet's screen-reader
  announcement in `VD-18`.
- **The 3,515 pages I did not open.** I drove roughly twenty routes; the
  registers and the reference pages are template-heavy and I trust the sample,
  but `/cars/:id`, `/seasons/:year` and the sparse pre-1960 race shapes each got
  one visit, not a survey.
