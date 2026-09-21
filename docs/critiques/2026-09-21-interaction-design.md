# Interaction design critique — 2026-09-21

**Critic:** interaction-design critic, fourth run.
**Subject:** `main` at `dda5afb`, v2.24, driven in Chromium (Playwright) at
1280×900, 390×844 and iPhone 13, against `web/dist` served three ways: the
harness's server on `:4179` (unthrottled), and my own static server
(`scratchpad/.../slowserve.mjs`) capping the whole pipe at **4 Mbps/120 ms**
and **1.6 Mbps/250 ms** — including the Web Worker's own fetch, which CDP
page-level throttling does not reach and which is why the previous run's local
timings were unusable. Production checked by `curl` and one browser load.
**Brief:** the maintainer's of 2026-09-21 — can a reader get to a fact and get
it *out*; what a paying or depending user would expect; and is the site an
engaging place to visit now.
**Prior:** the 2026-09-11, -13 and -16 interaction reports, the 2026-09-13
design review, and the open queue. Landed items were re-checked, not
re-discovered; where one is still live I say so and give a new measurement.

**Read-only. The repository was not modified and no issues were filed.**

---

## The three that matter

**1. For the first 3 seconds of a cold visit the site is fast and complete;
after that it is slow and smaller, and the change is invisible.** At 1.6 Mbps,
clicking *Drivers* at t = 2.6 s gives all **862 rows on screen at t = 5.6 s**,
from the 224 KB prerendered page. Clicking the identical link at t = 3.2 s —
after `index.js` has parsed and React Router has taken the anchors — changes
the URL to `/drivers`, leaves the **homepage** on screen with its h1 and title
intact, and makes the reader wait until **t ≈ 30 s** for **150 rows**. Same
link, same reader, ~600 ms apart: a 3-second answer becomes a 27-second wait
for a fifth of the data. At 4 Mbps the cutover is at ~1.3 s and the penalty is
2.5 s → 13.7 s. The site owns 2,385 prerendered pages — median 12 KB raw, 4 KB
gzipped, worst case 33 KB gzipped — and switches every one of them off at the
moment they are worth most. The same flaw, in its terminal form: block
`f1.db.gz` and the strip correctly says *"The database could not be opened"* —
then clicking *Records* sets the URL to `/records` and leaves 862 driver rows
and the h1 "Drivers" on screen, permanently. The router never gives the links
back. → `IX-37`, `IX-38`.

**2. The front door is a different page before and after the handover, and so
are 1,282 tab titles.** Static `/` is headed *"Formula One, 1950–2027, with
its sources attached"*, titled *"Lap Ledger — a Formula One database you can
check"*, and shows a facts table (*"Races — 1,196 championship Grands Prix"*)
and *"The last ten champions"*. At t = 13.7 s (4 Mbps) / t ≈ 30 s (1.6 Mbps)
that is replaced by h1 *"Every Formula One race since 1950"*, a different lede,
a tile strip reading *"RACES RUN 1,163"*, and five different sections; the
champions table is gone from the app entirely. Across 18 sampled routes, **9
differ in title or h1** between the two renderers, and the static one is the
better one every time: `/races/1976/10` goes from *"1976 German Grand Prix"* to
*"German Grand Prix"* (1,196 race pages, 77 of them German); `/seasons/1976`
from *"1976 FIA Formula One World Championship"* to *"1976"* (78 pages); every
register from *"Every driver, 1950–2027"* to *"Drivers"*. Whether a reader's
bookmark, history entry or shared tab title carries the year depends on whether
they copied it before or after second 14. → `IX-39`, `IX-40`.

**3. Nothing a reader assembles can be shared, saved or taken away.**
`useSearchParams` appears in **one of 22 page components** — `Sql.jsx`. Filter
`/drivers` to France and sort by Wins and the URL is still `/drivers`; open a
driver and press Back and you get 150 rows, "All", wins-descending. There is no
`clipboard`, no `navigator.share` and no `download` attribute anywhere in
`web/src`. The journalist who has just filtered 862 drivers to 73 French ones
cannot send that view to an editor, cite it, or come back to it; the console's
permalink — the best state handling on the site — is available only to someone
who writes SQL. This is `IA-08` (#135) and `IX-26` (#140), both filed, both
sitting in *Someday* and *Next*. Against the maintainer's stated
commercialisation intent they are the two most valuable open items in the
queue, and I would move both to *Now*.

---

## Is it more engaging? A direct answer

**Partly, and the part that landed is the right part.** `/seasons/2026` is now
a season that knows it is September: *"Season in progress"*, `ROUNDS 23 / 14
run`, who leads by how much, the constructors' leader, and *"NEXT SESSION ·
Practice 1 · Azerbaijan Grand Prix, Thu 24 Sept 12:30 at the circuit, in 3
days"*, with a live title-permutation paragraph naming the nine drivers who can
still win. The homepage carries *"The season, at both ends"* with last race and
next race. `/now` redirects cleanly. That is a genuine change in what the site
*is* — a reason to come back on a Thursday — and it is the first one.

**But the reader still cannot do anything.** Inventory of every control on the
site: a search palette, a filter bar (text + select + chips) on six registers,
sortable table headers, one "Show the remaining N" per table, a theme toggle,
prev/next links, a SQL console, and hover on four charts. Of those, **one puts
its state in an address**. There is no comparison of any kind — no two drivers
side by side, no two seasons, no two constructors, no head-to-head, though
`race_entries` supports every one of them and no licence is anywhere near it
(→ `IX-47`). There is no way to take a number out. There is no view a reader
can make and keep. A contemporary data product of this class — the shape of
thing a reader arrives expecting — is judged on exactly those three, and Lap
Ledger has none of them. That, and not the visual language, is why it feels
dull: **reading is the only verb.**

The three capabilities that would change how it feels, in cost order, none of
them touching lap timing, telemetry or livery:

- **Addressable views** (`IA-08`, M). Every filter, sort, column set and
  expansion in the query string. It is prerequisite infrastructure for
  sharing, for citing, for Back, for a "clear filters" control (`IX-36`) and
  for column pickers (`IA-23`) — four filed items collapse into it.
- **Take it away** (`IX-26`, M). Copy-as-TSV and download-as-CSV in the
  `.table-foot` every table already renders, and on the console result. One
  component, every table on the site, and it is the first thing a depending
  user looks for.
- **Compare two of anything** (`IX-47`, M). `/compare?a=hunt&b=lauda` over the
  existing driver query: the two tile strips interleaved, the two championship
  dot plots on one axis, and the races they both entered with the finishing
  positions side by side. It is the single most-asked question in this sport,
  the database answers it exactly, and the route is addressable by
  construction, so it is the first shareable artefact the site would have.

## The full set, by consequence

**`IX-37` — during the boot window the router intercepts every link and hands
the reader nothing, though the answer is already prerendered on the server —
M.** *Drove the site, throttled. Defect.* Measured above: 1.6 Mbps, click at
2.6 s → 862 rows at 5.6 s; click at 3.2 s → homepage on screen until ~30 s,
then 150 rows. 4 Mbps: 2.5 s versus 13.7 s. The deferred route is the right
*idea* — it preserves the transfer, and the strip's *"— opening Drivers when it
is ready"* is good — but it changes the URL and the browser's history entry
immediately while `document.title` and the whole document stay on the previous
page, so for 9–27 s the address bar and the screen disagree (this is `IX-21`'s
symptom with its real cause). **Do:** on a click during boot, `fetch()` the
destination's own prerendered `index.html` and swap its `<main>` in, then let
React replace it when the database is ready. Cost to the reader: 4 KB gzipped
at the median, 33 KB at the worst (`/cars`), against 27 s of nothing; the
worker's transfer is untouched. *Absorbs `IX-21` (#160).*

**`IX-38` — once the database has failed, every masthead link changes the URL
and nothing else — S.** *Drove the site with `f1.db.gz` aborted. Defect.* The
failed strip is well written — *"The database could not be opened. The figures
on this page are from the last published build."* with a Try again button — and
then clicking *Records* leaves the reader at URL `/records` reading 862 rows of
the drivers register under the h1 "Drivers", with no message, for as long as
they stay. The prerendered `/records` is 22 KB on the server. **Do:** when
`phase === 'failed'`, stop intercepting anchors — one condition in the router —
so a failed app degrades to a complete static site instead of a frozen one. A
truncated download (I served half the bytes) is correctly detected and reaches
the same state, so this is the path every network failure ends at.

**`IX-39` — the homepage is one page for 14–30 s and a different page
afterwards — S.** *Drove the site, throttled; read the source. Defect.*
`scripts/prerender.js:1209` writes `<h1>Formula One, ${SPAN}, with its sources
attached</h1>` with a seven-row facts table and *"The last ten champions"*;
`src/pages/Home.jsx:90` renders `title="Every Formula One race since 1950"`
with a six-tile strip and five different sections, and no champions table at
all. Body text goes 1,921 → 3,874 characters, document height 1,684 → 2,274 px.
The two also print different counts for the same word: the static page says
*"Races — 1,196 championship Grands Prix"*, the app's tile says *"RACES RUN
1,163 · 1950–2027"* (both true; `races` has 1,196 rows, 1,163 completed), and
nothing on either page reconciles them. **Do:** make the prerendered homepage
the app's homepage — the app already has both figures and can print the static
page's sentence. *`VD-49` (#446) is the structural cause: seven pages write
their opening block inline in JSX, so the prerenderer re-implements it.*

**`IX-40` — nine of eighteen route classes change their document title at the
handover, and the app's is always the worse one — S.** *Drove the site.
Defect.* Static → app: `/races/:y/:r` *"1976 German Grand Prix"* → *"German
Grand Prix"*; `/seasons/:y` *"1976 Formula One World Championship"* → *"1976"*;
`/drivers` *"Every driver, 1950–2027"* → *"Drivers"*, and the same for
constructors, circuits, races, seasons; `/reference/glossary` *"Glossary"* →
*"Glossary and people"*; `/` as above. That is roughly **1,282 of 2,385 routes**
(1,196 races + 78 seasons + 8). The consequence is not cosmetic: a reader's
bookmark, history entry and pasted tab title carry the year only if they acted
before second 14, and 77 German Grands Prix become indistinguishable in a
history list. **Do:** one title function, called by both renderers — the
static one is correct, so this is deletion, not authoring.

**`IX-19` (#142) — still live, and worse on `/cars` than on `/drivers` —
re-size S, move to Now.** *Drove the site, throttled. Defect.* Re-measured at
4 Mbps on four registers, scrolled before the handover: `/drivers` 862 → 150
rows and 34,054 → 6,902 px, the reader moved from "Hideki Noda" to "Mika Salo";
`/cars` **1,182 → 150 rows and 59,549 → 10,829 px**, from "Honda RA273" to
"Midget"; `/races` 200 → 120. `/constructors` is the control: 150 → 150 rows
and the scroll position is restored **exactly**, which proves the restore works
and the row deletion is the whole cause. The fix is now one line, because the
app already renders *"Show the remaining 712"* in the foot: seed `DataTable`'s
visible count from the prerendered row count when standing in for a static
page.

**`IX-41` — a sorted table has no way back to its default order — S.** *Drove
the site. Defect.* `/drivers` opens "Most wins first" and says so in the foot.
Clicking a header cycles ascending → descending → ascending, with no third
state; the default order — which is itself an editorial statement and is
described in prose two inches below — is unreachable without a page reload, and
with no URL state a reload also discards the filter. **Do:** make the cycle
three-state (asc → desc → default) on the column that carries the default sort.

**`IX-42` — the championship chart's x-axis is the extent of the data, not of
the career, so a season the driver raced silently vanishes — S.** *Drove the
site; queried the database. Defect.* On `/drivers/andretti` the tile says
*"SEASONS 1968–1982, 14 with an entry"* and the chart four inches below, headed
*"Where each championship finished"*, runs **1970–1982**: 1968 and 1969 are not
drawn and not on the axis. `/drivers/hunt` says 1973–1979 and draws 1973–1978;
`/drivers/alboreto` 1981–1994 and draws 1982–1994; `/drivers/amon` 1963–1976
and draws 1964–1976. The caption pre-empts the *excluded* case (*"A season with
points but no position is one the driver was excluded from, so there is nothing
to plot"*) but not this one — a season with entries and no `standings` row. Of
the **388 drivers who have any standings rows and so get this chart, 219 (56 %)**
have at least one entered season outside the chart's span. The reader's only
reading is that the tile and the chart disagree. **Do:** set the domain from the
career span in the tile and draw the unplottable season as a labelled gap.

**`IX-43` — the console answers the site's biggest deliberate absence with
"matched nothing" — S.** *Drove the site. Defect.* `SELECT * FROM laps LIMIT 5`
returns *"0 rows in 19 ms · The statement ran and matched nothing."* — the same
sentence as `WHERE full_name = "Nobody"`. `laps`, `stints`, `race_timing` and
`race_control_messages` are empty by a licence decision documented at length,
and querying one of them is the first thing an F1 data person does. The reader
concludes the database is incomplete. **Do:** on zero rows, if the statement
names one of the four tables, add the one-line reason and a link. *This is
`PD-29` (#155)'s exact surface — the console is where a reader meets the
refusal, not the prose page; name it in that issue.*

**`IX-44` — the strip says what is happening and never says what it buys —
S.** *Drove the site, throttled. Defect of feedback.* The boot strip is good
mechanics: in view from ~1.3 s, a determinate bar, *"Downloading the database
2.4 MB of 5.0 MB"*, a `role="status"` live region. What it never says is why a
site already showing a complete page is downloading 5 MB, or that it happens
once. Measured payoff: a warm reload of `/drivers` at 4 Mbps is **3.56 s**
against **13.65 s** cold, and thereafter client-side navigation is instant. The
footer's *"This load · from your browser store"* is the only place the bargain
is recorded, and it is 7,000 px below the strip. **Do:** one clause in the
strip — *"Downloading the database once — after this, every page is
instant."*

**`IX-45` — the static 404 is generic where the app's is specific, and the
specific one arrives 14–30 s late — S.** *Drove the site; checked production.
Defect.* `https://lapledger.org/drivers/schumaker` returns 404 with *"Not
found. There is no page at this address. It may have been a typo, or a link to
something this database does not hold."* and eight register links — no search
box, no mention of the id that failed. The **app's** version of the same URL is
excellent: *"No such driver — Nothing in the register has the id "schumaker".
Press / to search every driver by name, or browse the register."* — and it
replaces the generic one after the full boot. A broken deep link is precisely
where the reader has the least patience. **Do:** ten lines of inline script in
`404.html` that read `location.pathname`, name the segment that failed, and say
which register it looks like — no database needed.

**`IX-46` — the theme toggle's first click does nothing visible for a reader on
the system default — S.** *Read the source; drove the site. Defect, minor.*
`Theme.jsx:16` cycles `system → light → dark → system`. A reader whose OS is
light clicks once and the page does not change (only the glyph does, from ◐ to
☀); the same is true one step along for a dark-OS reader. One of three clicks
is a no-op on a control whose entire purpose is a visible change. **Do:** label
the button with its destination rather than its state.

**`IX-47` — nothing on the site compares two of anything — M. New capability,
not a defect.** *Drove the site; read the routes.* Twenty-two page components,
no comparison route, no multi-select on any register, no way to pin a row. The
database answers head-to-head questions exactly and the licences do not reach
it. **Do:** `/compare?a=<id>&b=<id>` over the existing `queries/driver.js`:
tiles interleaved with the difference, both championship dot plots on one axis,
and the races both entered with the two finishing positions. Addressable by
construction, so it is also the site's first genuinely shareable artefact.
*Depends on nothing; does not wait for `IA-08`.*

**`IX-48` — the site downloads 5 MB, keeps it, and still fails a reload with no
network — M.** *Drove the site offline. Defect against a printed claim.* The
footer says *"once it has loaded, this tab keeps working without a network"*,
and client-side navigation offline does work. But there is no service worker
(`grep -rn serviceWorker src/ scripts/` is empty), so a reload or a second tab
offline gets the browser's error page, with 5 MB of Formula One sitting in
IndexedDB two inches away. A shell cache of `index.html`, the 576 KB of
`assets/` and `sql-wasm.wasm` would make the whole site work offline — a real
differentiator for a reference product people are meant to depend on, and it
costs one file. **Do:** cache-first service worker for the shell only; the
database path is already handled.

### Shared, owned elsewhere

- **`/records` leads with its workings.** The `HOW IT IS DERIVED` column takes
  ~35 % of the width and pushes `VALUE` — the thing the page is for — into a
  narrow third column. The most naturally engaging content on the site is laid
  out as an audit log. *Visual/IA owns the fix; a per-row disclosure is the
  interaction shape.*
- **Photographs have no loading state.** At 4 Mbps `/seasons/2026` holds five
  blank 800×400 boxes with captions for several seconds while
  `commons.wikimedia.org` responds. The *failure* state is exemplary (see
  below); the *waiting* state is nothing. *Visual owns it.*
- **Chart hover is mouse-only.** `onMouseEnter`/`onMouseMove` in all four
  charts, no `onFocus`, no `tabIndex`, no tap handler; I confirmed a tap on
  iPhone 13 changes nothing. It is not hover-*only* information, because every
  chart carries `▶ The numbers behind this chart`, so I am not filing it —
  but a keyboard or touch reader gets strictly less than a mouse one.
  *Accessibility owns it.*

## Backlog verdicts

### My prefix (IX-*)

| ID | Verdict |
|---|---|
| `IX-16` (#146, M) Back restores scroll not filter | **Merge into `IA-08`** (#135) — same defect, and it is IA-08's acceptance test, not a second item. |
| `IX-19` (#142, M) handover deletes rows | **Keep, → Now, re-size S.** Re-measured worse (`/cars` 1,182→150). The fix is one line now that "Show the remaining N" exists. |
| `IX-20` (#139, S) sortable and dead headers alike | **Keep, → Next.** Still live: `.sortable` carries no resting mark. |
| `IX-21` (#160, S) strip names a destination backed out of | **Merge into `IX-37`.** Same event; IX-37 has the cause and the general fix. |
| `IX-22` (#153, S) one wrong letter is a flat refusal | **Keep, → Now**, as rung 1 of the consolidated `IA-20`. Reconfirmed: `schumaker`, `verstapen`, `mp4-4` all return zero while `schuma` returns three Schumachers. |
| `IX-23` (#154, M) `<entity> <year>` returns nothing | **Merge into `IA-20`** as rung 4. |
| `IX-25` (#161, S) `SELEC` typo lectured about writes | **Keep, Someday.** Live, correct, low reach. |
| `IX-26` (#140, S) nothing can be taken away | **Keep, → Now, re-size M.** No clipboard, share or download anywhere in `src/`. Directly the commercialisation ask. |
| `IX-27` (#137, M) phone shows two of nine columns | **Keep, → Next.** Reconfirmed at 390 px: Driver and Nationality only. Ship *with* `IA-23`, not after. |
| `IX-28` (#141, S) filtered empty state says two words | **Merge into `CD-17`** (#260, error and empty states inventory) — that item is the right container and is already in Next. |
| `IX-29` (#332, M) layout grid draws invisible differences | **Keep, Someday.** Unchanged; rides with #306. |
| `IX-32` (#335, M) outline grid and timeline are one list twice | **Keep, Next.** |
| `IX-36` (#408, S) no clear-all | **Merge into `IA-08`** — with the filters in the query string, "clear" is dropping the params; building it twice against in-memory state is waste. Keep standalone only if `IA-08` is declined. |

### The two clusters

**Filter / sort / URL — `IA-08` is the trunk.** Absorb `IX-16` (acceptance
test) and `IX-36` (falls out of the fix). Then one item, not two, for
`IA-23` + `IX-27`: a column picker without a phone default is the wrong half of
the job, and `IX-27` is where it pays. `VD-29` (#132, constant columns) is
independent and cheap and should go *first*, because it shrinks the column set
`IA-23` has to offer. `CR-28` (#174, two tables with no sort signal) **merges
into `IX-20`** — same defect, two more tables. **`IX-26` must not be chained to
any of this**: copy/export is a component in `.table-foot` and ships on its
own, this week, which is exactly the shape the maintainer's bursty time wants.

**Search — one epic, four rungs, under `IA-20`.**
R1 (S): widen the needle to `label || ' ' || meta`, plus a Levenshtein-≤2 pass
on zero hits only — absorbs **`IX-22`**.
R2 (S): a no-match state that offers exits (season page, `/data/sql?q=`
prefilled) — absorbs **`IA-21`** (#152).
R3 (S): index the car aliases so `mp4-4` and `mclaren-mp4-4` resolve — absorbs
the search half of **`IA-06`** (#182); its duplicate-URL half stays with IA.
R4 (M): `<entity> <year>` and the closed-vocabulary intent grammar — absorbs
**`IX-23`**.
**`AX-02`** (#226, M, palette is not modal and not a listbox) stays separate and
**re-ranks Someday → Next**: it must land *before* R4, or the grammar ships on
a widget that does not announce its results.

### Others named in my brief

| ID | Verdict |
|---|---|
| `IA-08` (#135, M) | **Keep, → Now.** The highest-value structural item in the queue for the stated goals. Absorbs `IX-16`, `IX-36`. |
| `IA-20` (#151, M) | **Keep, → Next**, restructured as the four rungs above; re-size the epic **?** and each rung S/S/S/M. |
| `IA-21` (#152, S) | **Merge into `IA-20`** R2. |
| `IA-22` (#159, S) | **Keep, Next.** IA owns; I saw nothing new. |
| `IA-23` (#136, M) | **Keep, Next**, merged with `IX-27` into one item. |
| `IA-06` (#182, S) | **Split:** search half → `IA-20` R3; URL-duplication half stays, Next. |
| `CR-28` (#174, S) | **Merge into `IX-20`.** |
| `VD-29` (#132, S) | **Keep, → Now.** Cheap, and it makes `IA-23` smaller. |
| `AX-02` (#226, M) | **Re-rank Someday → Next**, gating `IA-20` R4. |
| `PD-38` (#432, M) | **Keep, → Now.** The current-season grid is the strongest remaining engagement item and the one page a returning reader would come back for. |
| `VD-49` (#446, M) | **Keep, → Next, re-size.** It is the structural cause of `IX-39` and `IX-40`: seven pages write their opening block inline, so the prerenderer re-implements each one and drifts. Say that in the issue — it changes it from tidying to a correctness fix. |

## Top ten for the project, from this discipline

| # | Item | Size | Why |
|---|---|---|---|
| 1 | **`IX-37`** *(new)* — serve the prerendered page during the boot window | M | Turns a 27-second wait into a 3-second answer on the visit that decides whether there is a second one. |
| 2 | **`IX-26`** (#140) *(existing)* — copy/CSV on every table and the console | M | The whole "get it out" goal, in one component, shippable alone. |
| 3 | **`IA-08`** (#135) *(existing)* — filter, sort and expansion state in the URL | M | Without it nothing on this site can be shared except an entity page; four filed items collapse into it. |
| 4 | **`IX-39` + `IX-40`** *(new)* — one homepage and one title function | S | ~1,282 pages currently rename themselves 14–30 s after arrival; the fix is deletion, and it is the cheapest credibility repair available. |
| 5 | **`IX-19`** (#142) *(existing)* — stop deleting 82–87 % of the rows at handover | S | Registers get smaller the longer you wait; the control case proves the restore already works. |
| 6 | **`IA-20` R1+R2** *(existing)* — fuzzy fallback and a no-match state with exits | S+S | One wrong letter is currently a dead end; both rungs are cheap and independent. |
| 7 | **`IX-47`** *(new)* — `/compare?a=&b=` | M | The most-asked question in the sport, exactly answerable, licence-free, and addressable by construction. The single biggest change to what a reader can *do*. |
| 8 | **`PD-38`** (#432) *(existing)* — the current season's grid and the pages that open on it | M | The returning-visitor surface; the 2026 page already proves the shape works. |
| 9 | **`IX-48`** *(new)* — a shell service worker | M | Makes true a claim the footer already prints, and makes an offline reference something a depending user can rely on. |
| 10 | **`IX-42`** *(new)* — chart domain from the career, not the data | S | 219 of 388 driver pages currently show a chart that contradicts the tile above it. |

`IX-38` (S) is not in the ten only because it is a two-line rider on `IX-37`
and should ship in the same diff.

## Genuinely good — do not disturb while fixing the rest

- **The boot strip's mechanics.** In view by ~1.3 s, determinate bar, bytes of
  bytes, a `role="status"` live region present from the first render, and a
  correct failure state with a retry. It only lacks a reason (`IX-44`).
- **Truncation is detected.** I served exactly half of `f1.db.gz` with an
  honest `content-length` and got the failed state, not a corrupt database.
- **The image failure state is the best error message on the site.** Blocking
  `commons.wikimedia.org` replaces each photograph with *"The photograph did
  not arrive from Wikimedia Commons. It is still there: open the file page."* —
  it names the cause, keeps the credit and offers the route out. Every error
  state on the site should be measured against this one.
- **The search palette.** The kind tag (`DRIVER`, `RACE`, `CAR`), a
  disambiguating second line (`Germany · 1991–2012`), and a keyboard legend
  with the index size. `schuma` → three Schumachers in career order. Case and
  diacritics both forgiven (`HAMILTON`, `Räikkönen`). Only the zero state fails.
- **The SQL console.** Runs an example on arrival so the first thing you see is
  a result; `15 rows in 6 ms`; a Cancel button that appears on a long query;
  *"Showing the first two hundred rows. Show the remaining 27,304"*; and
  *"The address links to the query last run, not to what you have typed; run it
  to update"*, which is still the best sentence on the site.
- **The app's own not-found pages.** *"Nothing in the register has the id
  'schumaker'. Press / to search every driver by name."* — cause, identifier
  and two exits.
- **Focus after navigation** (`IX-34`, landed): confirmed on `/drivers` →
  `/drivers/hamilton`, `document.activeElement` is the `h1`.
- **Browser Back restores scroll** on entity pages: y = 1,432 restored exactly
  on `/drivers/hamilton`.
- **Table feet that explain the table.** *"A blank is a figure nobody has
  established, not a zero, and those rows sink to the bottom whichever way you
  sort."* That sentence does more for the conventions problem than a glossary.
- **The 2026 season page**, as described above.
- **`/now`** redirects with a canonical link, a `noindex`, a `<meta refresh>`
  and a readable body — it works with JavaScript off and does not poison Back.

## Examined and cleared

- **The whole-download architecture.** I set out to argue against it and could
  not. The failure modes that matter — the boot window, the failed state, the
  offline reload — are all *recoverable by using the prerendered pages the
  project already builds*, which is cheaper than any range-request VFS
  (`D-13`) and does not touch the 4.5 MB decision. Fix the handover, not the
  architecture.
- **IndexedDB unavailable.** With `window.indexedDB` throwing on access the app
  still boots, renders and navigates; no page error, no dead end. It re-fetches
  every visit and the footer correctly says *"This load · downloaded"*.
- **The deferred-route mechanism itself** is right: the transfer is preserved
  and the strip names the destination. Only the immediate URL change and the
  absent content are wrong (`IX-37`).
- **`IX-30`, `IX-31`, `IX-33`, `IX-34`, `IX-35`, `IX-18`, `IX-24`** — spot-
  checked, all holding.
- **The prerendered `/races/1976/10` orientation** — `← 1976 season`, `ROUND 10
  OF 1976`, prev/next — needs nothing. Only the title does.
- **The `unchecked` photograph pill** reads like a warning cold, but the note
  that explains it is rendered under the same grid on the same page. Adequate;
  content's call whether it should be nearer.
- **The preview's backwards byte counter**, recorded and cleared by the
  previous run, did not recur on my server, which serves `.gz` as
  `application/gzip` exactly as production does.

## What I did not examine

Safari and Firefox; real devices and assistive technology; the dark theme
beyond the toggle's cycle; a rebuild arriving while a tab is open (the
*"Checking for a newer build"* phase, which I only ever saw succeed); the
`/changes` feed as an interactive surface; `/data/quality` and `/data/sources`;
the Parquet and release download flows end to end; the circuit routes, which
the 2026-09-16 run covered and I deliberately did not repeat; print; and
anything about how many people do any of this, which remains `PD-Ø`.
