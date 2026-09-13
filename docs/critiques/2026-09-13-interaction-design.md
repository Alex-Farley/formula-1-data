# Interaction design critique — 2026-09-13

**Critic:** `interaction-design-critic`, second run.
**Subject:** live `https://lapledger.org` at v2.23, driven in Chromium via
Playwright at 1.6, 4 and 5 Mbps and offline, at 1280×900 and 390×844.
**Brief:** the maintainer's asks of 2026-09-13 — tables with user-selectable
fields, a natural-language search, richer and possibly animated track
visualisation. Judge affordance, feedback, state, latency and what fills it,
navigation and orientation, search and filtering, error recovery, and mobile.
**Prior:** `docs/critiques/2026-09-11-interaction-design.md`, `docs/BACKLOG.md`.
`IX-01`–`IX-09` and `IX-11`–`IX-15` have landed and each was confirmed working.
IDs continue from `IX-17`.

**Read-only.** **The repository was not modified.**

**Re-checked by the author before filing:** `app.css` sets `thead th {
position: sticky }` under a `.table-scroll { overflow-x: auto }` ancestor
(`AX-18` filed the same symptom without the cause); `DataTable.jsx` gates
sorting on `column.sortable !== false` with no resting-state mark; `Sql.jsx`
exposes Run and nothing else. The throttled timings were not re-run and stand
at the critic's stated evidence level.

---

## The three that matter

**1. The sticky table header has never stuck, anywhere.** `styles/app.css:628`
sets `thead th { position: sticky; top: 0 }`; `styles/app.css:589` sets
`.table-scroll { overflow-x: auto }` on its ancestor (`DataTable.jsx:150`).
`overflow-x: auto` forces `overflow-y` to `auto`, which makes `.table-scroll`
the sticky containing block — and that box never scrolls vertically, so the
header just leaves with the page. At `scrollY = 1500` on `/drivers` the header
sits at viewport top **−1,193 px**. A reader forty rows into 862 sees `210 10
48 12 21 0` with no labels. The masthead above it *is* sticky, which teaches
the wrong model.

**2. The handover deletes 712 rows out from under a reader mid-scroll.**
Static `/drivers` is 862 rows / 33,928 px; the app renders 150 / 6,828 px. At
4 Mbps I scrolled to `y = 20,000` at t = 2.5 s (Hiroshi Fushida in view); at
**t = 13.5 s** the app replaced it: `y = 156`, top row Hamilton, Fushida not in
the DOM. `IX-03`'s scroll restore cannot fire because the document shrank
fivefold. Nothing says rows were removed.

**3. Sorting is invisible and inconsistent, table to table, inside one page.**
`/seasons/1976` renders five tables. Four do not sort; "Who entered" does. The
only difference is a `▲` on its first column and `cursor: pointer`; header
colour is `rgb(101,108,119)` in both cases. The two tables a reader most wants
to sort — the race classification (`/races/1976/10`, 28 rows with Grid, Laps,
Points) and the final standings — are dead to the click, after `/drivers` has
taught that every column sorts.

## The full set, by consequence

**`IX-18` — sticky headers are inert on every table — S.** *Drove the site,
read the source. Defect.* As above. **Do:** add `overflow-y: clip` to
`.table-scroll`. It does not create a scroll container, so the header sticks to
the viewport; `overflow-x: auto` keeps working. One line. *Supersedes `AX-18`,
which filed the symptom.*

**`IX-19` — 862 rows become 150 at handover, with the reader inside them — M.**
*Drove the site. Defect.* Measured above. **Do:** seed `DataTable`'s visible
count from `data-rows` on the prerendered table, so the app opens showing what
the static page showed and only *then* offers to collapse. Failing that,
restore scroll against the new document height rather than the old.

**`IX-20` — sortable and non-sortable headers are indistinguishable — S.**
*Drove the site, read the source. Defect.* `DataTable.jsx:164` gates on
`sortable && column.sortable !== false`, and the `.sortable` class carries no
resting-state mark — the `▲`/`▼` appears only on the active column. **Do:**
render a dimmed `↕` on every sortable header, and pass `sortable` to the race
classification and standings tables.

**`IX-21` — during the cold wait the strip names a destination the reader has
already backed out of — S.** *Drove the site. Defect.* 1.6 Mbps: click Drivers
at t = 4.0 s, Circuits at t = 4.8 s, Back twice. URL reads `/`; the strip reads
**"Downloading the database — opening Circuits when it is ready"** for the
next 25 s; at ready it lands on `/`. `document.title` also stays the homepage
title the whole time the URL says `/drivers`. **Do:** derive the strip's label
from `location.pathname` on each render rather than from the intercepted
click.

**`IX-22` — one wrong letter is a flat refusal — S.** *Drove the site.
Defect.* `verstapen`, `schumaker`, `redbull` → *"Nothing in the register
answers to that."* — while `silverston`, `hakkinen` and `Räikkönen` all
resolve, so the reader cannot predict which misses will be forgiven. **Do:** on
zero hits only, re-run over the 3,494 labels with Levenshtein ≤ 2 and head the
list *"Did you mean…"*. It costs nothing on the hit path.

**`IX-23` — the no-match state is the whole "natural language" problem, and it
offers nothing — M.** *Drove the site. Defect.* `who won monaco in 1996`,
`ferrari 1979`, `hamilton 2008`, `most wins`, `british gp` all return the same
two lines. **Do not build a parser.** Two cheap pieces instead: (a) handle
`<entity> <year>` — `ferrari 1979` and `hamilton 2008` are entity pages the
site already has, anchored at a season row; (b) make the no-match state offer
routes out — *"Nothing matched. Try the 1996 season · ask it in SQL"*,
prefilling `/data/sql?q=`, which already works. That converts the dead end into
the console's front door. *Rides with `IA-20` and `IA-21`.*

**`IX-24` — the atlas has no address — M.** *Drove the site. Defect.* Selecting
Circuit de Monaco and toggling True scale left the URL at `/circuits/atlas`;
**Back leaves the site** (`about:blank`). Nothing about the atlas is linkable,
so no richer or animated version of it can be shared or cited either. **Do:**
`replaceState` to `?c=monaco&scale=1&at=1240` on every control change, and read
it on mount. Same fix unblocks animation: a shareable start point is what an
animated lap needs. `IA-08` / `IX-16` remain live on `/drivers` too — I
reconfirmed France + sort-by-Titles → URL `/drivers`, Back → 150 rows,
wins-descending, filter "All". *Rides with `PD-21`.*

**`IX-25` — a typo in the first keyword is answered with a lecture about
writes — S.** *Drove the site. Defect.* `SELEC 1` returns *"Reads only: start
with SELECT, WITH, VALUES, EXPLAIN or PRAGMA. A write would be rolled back
anyway, so nothing has changed."* The reader wrote a read and is told they
attempted a write. **Do:** if the first token is within edit distance 2 of a
permitted keyword, say *"Did you mean SELECT?"* instead.

**`IX-26` — nothing can be taken away — S.** *Drove the site. Defect.* No copy,
CSV or download control on any table or on a SQL result (`/data/sql` exposes
only Run). The journalist and the data scientist both end at select-and-drag
across 200 rows. **Do:** one "Copy as TSV" button in `.table-foot`, which every
table already renders.

**`IX-27` — mobile shows two of nine columns, and this is where field selection
pays — M.** *Drove the site. Defect.* At 390 px the `/drivers` wrapper is 344 px
against a 976 px table: **632 px of every row is off screen**, horizontally
scrollable with only an edge fade. Wins, poles and titles — the reason the page
exists — are past the edge. **Do:** the owner's user-selectable fields, scoped
to this: a "Columns" control with a phone default of three, persisted in the
query string alongside `IX-24`'s work. Free-choice columns on desktop are a
nice-to-have; on a phone they are the difference between a usable register and
a strip of names. *The phone half of `IA-23`.*

**`IX-28` — the filtered empty state says two words — S.** *Drove the site.
Defect.* `zzzz` + Brazil + Champions → *"Nothing recorded."*, and the header row
vanishes with it. The count line does read "0 of 862 drivers", but nothing
names which of three filters is responsible and there is no clear-all. Compare
`/cars/mp4-4`, which names the thing and offers two ways out. **Do:** *"No
driver matches 'zzzz' among Brazilian champions"* plus a Clear filters button.
*`CD-17`'s second verdict, placed.*

## Genuinely good — do not disturb

The cold boot is now excellent: the strip is in view from t ≈ 0.9 s with a
determinate bar and bytes-of-bytes, and a click during the wait becomes a
deferred route — *"Downloading the database — opening Drivers when it is
ready"* — with the transfer preserved (ready at 29.2 s on 1.6 Mbps either way).
The warm second visit was **125 ms**. The atlas output now reads "5,743 m
along the trace · fast, 245 m" and Monaco correctly disables the scrubber with
"not a closed lap". The console's permalink and its *"The address links to the
query last run, not to what you have typed; run it to update"* is the best
single sentence on the site. Race-page orientation ("1976 season / Round 10 of
1976 / German Grand Prix", with prev/next) needs nothing. The filter bar
composes chips, select and text cleanly and shows "0 of 862 drivers". Offline
client-side navigation works exactly as claimed.

## Not examined

Safari and Firefox; real devices; assistive technology; the dark theme;
`/records` and `/reference/quality` as interactive surfaces; a rebuild arriving
while a tab is open; the bulk-download flows on `/data`.
