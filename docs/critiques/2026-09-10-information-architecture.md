# Information architecture critique — 2026-09-10

**Critic:** `information-architecture-critic`, first run.
**Subject:** Lap Ledger at v2.20+ (`PD-01`/`PD-04` landed), the committed `f1.db`,
`web/src/`, `web/scripts/prerender.js`.
**Brief:** `.claude/CRITIQUE-BRIEF.md`. **Prior:** `docs/critiques/2026-09-10-product-design.md`,
`docs/BACKLOG.md`.

**How this was evidenced.** I did **not** build the front end. `web/dist/` is
absent and `npm ci && npm run build` costs minutes for evidence I could get
otherwise: the route table, the two chrome implementations, the filter axes and
the URL scheme are all fully legible in source, and every quantitative claim
below is a query against the committed `f1.db`. That is a real limitation and it
is named again at the end. Nothing here rests on how a page *looks*; where it
would have, I have said so and not made the claim.

**Read-only.** The repository was not modified.

---

## The three that matter

### 1. The most natural way to browse Formula One is in the database and has no page

`grands_prix` holds 53 rows. `v_grands_prix` already computes editions, first
held, last held and circuits used per event. Every one of the 1,172 races carries
a non-null `gp_id`. `web/` references the table exactly once — `Race.jsx:17`
joins it to print `race.gp_full` as **plain text in a `Fields` list**
(`Race.jsx:440`), because there is nowhere for it to link to.

There is no `/grands-prix` route, no prerendered page, no sitemap entry, no
search-index row, no nav item. "The British Grand Prix" — 77 editions, one of the
two events held every season since 1950, and the object a fan, a journalist and a
Wikipedia editor all name — is unreachable by browse, by search, or by a link
from the race page that names it.

The circuit page is not a substitute. **17 of 53 Grands Prix have used more than
one circuit, and those 17 account for 773 of 1,172 races — 66%.** The French
Grand Prix is spread across seven circuit pages (Reims 11, Paul Ricard 18,
Magny-Cours 18, Charade 4, Dijon 5, Rouen 5, Bugatti 1). For two-thirds of the
race pages on this site, the event axis is genuinely broken.

This is the clearest case in the whole product of the structure following the
storage model: `races` got a section because it is a table, `grands_prix` did not
because nobody wrote a component for it. The reader's model has both.

### 2. `/reference` is a drawer, and the right fix also answers `PD-11` — the two are one decision

Taking `PD-09` further rather than restating it. Three things are true that the
product critique did not record:

- **The drawer nests.** `/reference/eras` is not one topic under a two-word
  label; it renders **nine** tables — eras, engine formulae, points systems,
  regulation changes, regulation limits, technical innovations, safety
  milestones, governance, tyre suppliers (`Eras.jsx:56–234`). The nav label names
  two of the nine. `/reference/glossary` is "Glossary **and** people" — two.
- **The drawer says so in its own copy.** `Reference.jsx:29`: *"how the rules
  changed, what the words mean, where every figure came from, and what is still
  missing. **Plus** a console…"* Four clauses and a "plus" is the canonical tell.
  `Home.jsx:60` repeats it: *"Eras and rules, sources, what is missing, and a SQL
  console."*
- **It is two drawers, not one.** `quality` + `sources` + `sql` serve someone
  evaluating or using the *database*. `eras` + `glossary` serve someone reading
  about the *sport*. They have no reader in common.

`PD-11` proposes adding `/data` to the masthead. The masthead is already at 8
items and, on a 720px-or-narrower viewport, becomes a horizontally scrolling
strip with the scrollbar hidden (`app.css:302–319`). Adding one more item to a
container that already overflows silently is not a structural decision, it is a
deferral.

**`/data` is the answer to `PD-09`, not an addition to it.** The "data drawer"
half of `/reference` *is* `/data`. Replace `Reference` in the masthead with
`Data`; give `/data` the artefacts (SQLite, `f1-geometry.db`, Parquet, JSON), the
merged provenance page `PD-09` already asks for, and the SQL console. That is one
move that settles two blocked backlog items and keeps the masthead at eight.

`eras` and `glossary` stay where they are and come **out** of the masthead. Their
problem was never the drawer — it is that they are terminal (finding IA-12). A
glossary is not a destination anyone navigates to from a nav bar; it is something
reached from a word that was not understood.

### 3. The app and the prerenderer each have half the wayfinding, and neither has the other half

`prerender.js` writes a full breadcrumb trail on every entity page —
`Home / Drivers / Lewis Hamilton` (`prerender.js:199, 208, 651`). It writes **no**
onward band and **no** stepper (grep for `Keep going`, `stepper`, `Neighbour` in
`prerender.js`: zero hits).

The app writes an excellent computed onward band and a stepper
(`Page.jsx:133, 167`) and has **no breadcrumb**. Its `back` prop is a single
level, and its label on four different destinations is the identical string
`"The register"` (`Driver.jsx:168`, `Constructor.jsx:138`, `Circuit.jsx:94`,
`Car.jsx:131`).

So a reader arriving cold on `/drivers/hamilton` gets a breadcrumb for the
duration of the download, and the moment the app is ready `main.jsx` removes
`#prerendered` and the breadcrumb is replaced by "← The register". The
wayfinding does not improve when the app takes over; it trades sideways.

Worse, and separately: **the app never sets `document.title`.** No `document.title`,
no `useTitle`, no Helmet anywhere in `web/src/` (verified by grep). `prerender.js`
writes a correct per-route `<title>` and `<link rel="canonical">`, and
`smoke.mjs:859` asserts it on a fresh deep link — but after any client-side
navigation, both are stale. Go to `/drivers/hamilton` from a search engine, click
through to `/races/2021/22`, and the tab, the bookmark, the history entry, the
share sheet and the screen-reader page-change announcement all still say **"Sir
Lewis Hamilton — Lap Ledger"**, and the canonical still points at Hamilton. On a
site with 3,515 pages, one front door and deep arrival as the dominant pattern,
that is the wayfinding defect with the widest blast radius, and it is a few
lines in `Page.jsx`.

---

## Answers to the four questions the owner asked

**What is the right top level, and what does `/data` displace?**

```
Seasons · Races · Drivers · Constructors · Circuits · Cars · Records · Data
```

Eight, unchanged in count. `Data` displaces `Reference`. `/reference/quality` and
`/reference/sources` merge and move under `/data`; `/reference/sql` moves under
`/data`; `/reference/eras` and `/reference/glossary` keep their URLs, keep an
index at `/reference`, and lose the masthead slot in exchange for in-context
links from the pages where their content is needed. `/grands-prix` is added as a
**second-level** index reachable from `/races`, from the `Grand Prix` field on
every race page, and from the circuit page — three ways in, which is the test —
but not from the masthead, because it competes with Races for the same reader
and the masthead is full.

**`/reference`: category or drawer?** Drawer, and a nested one. Fix in IA-02.

**`/records`: nav problem or content problem?** Content, and the nav slot is
**right — do not move it.** Of the eight current masthead items, seven are entity
registers that map 1:1 onto database tables (`seasons`, `races`, `drivers`,
`constructors`, `circuits`, `chassis`). `Records` is the only slot in the whole
top level cut by *question* rather than by *table*, and it is the highest-intent
destination the fan audience has. Demoting it would remove the one non-schema cut
from a nav that is otherwise a schema diagram. `PD-03` is correctly filed and
correctly sized; my only escalation is that the reason it matters is structural,
not editorial — this is the single page whose job is to answer a question rather
than list a table, so it is the page whose failure most misrepresents what the
site is for. Fix the content; keep the slot.

**Is there a site-wide search surface, and is its absence right?** The premise of
the question is wrong, and that is the more interesting finding: `Search.jsx` is
a genuinely good global entity finder — one query, 3,494 rows, prefix-weighted
scoring, real `<Link>`s so middle-click works, a memoised index that deliberately
forgets a failed attempt. It is *not* a search, and it is mislabelled as one. It
is missing 6 pages and 53 entities, it cannot find a car by the name anyone would
type, and it has no address (IA-05, IA-07, IA-08). Fix those; do **not** build
full-text search. The whole prose corpus is already in the reader's browser, so
if content search is ever wanted it is one more `UNION ALL` into the same index
and a second results group — not an index to ship beside a 20 MB download.

---

## The findability tests

Eight questions, attempted by navigation only and then by search only, from `/`,
reading the route table and page components. *Evidence: read the source, queried
the database. Not driven in a browser.*

| # | Question | By browse | By search | Verdict |
|---|---|---|---|---|
| 1 | How many races has Hamilton won? | Drivers → filter → Hamilton. 2 clicks | `/` → "hamilton" → ↵ | Works. But `/records` says 105 and the driver page 106 (`PD-03`) |
| 2 | Who won the 1976 British Grand Prix? | Races → filter "British" → scroll to 1976. 2 clicks | `/` → "1976 british" matches at position 0 | Works both ways |
| 3 | Which circuits has the British GP been held at? | **Dead end.** Only by eyeballing the Circuit column of a 77-row filtered table | **Dead end.** No entity to match | **Fail.** `grands_prix.circuits_used` holds the answer (IA-01) |
| 4 | Where do I download the database? | **Dead end.** No card on `/`, nothing in `/reference`. The only mention is un-linked `<code>f1.db</code>` on the static SQL page (`prerender.js:1218`) | **Dead end** | **Fail.** `PD-11`, and see IA-15 |
| 5 | Which car was the Lotus 72? | Cars → gallery card. 2 clicks | **Fail** — index labels are `chassis.name` = `72B`, so "lotus 72" matches nothing (IA-05) | Browse only |
| 6 | What does DNPQ mean on this classification? | **Dead end.** Not in the 44-term glossary; not defined on the race page | **Dead end** — glossary is not indexed | **Fail** (IA-12) |
| 7 | How far can I trust a 1954 result? | Reference → Data quality. 2 clicks, but "Reference" is a guess; footer link is faster | **Dead end** — no page content indexed | Works, badly signposted |
| 8 | Compare Senna and Prost | **Dead end** except by writing SQL, 3 clicks deep | **Dead end** | No path; correctly out of scope for a register, but see IA-07 |

Three outright failures out of eight, and two of the three (#3, #6) have the
answer already sitting in the shipped database.

---

## The full set, by consequence

### `IA-01` — `grands_prix` has 53 rows, a view, and no page anywhere — **M**
*Evidence: queried the database, read the source. Defect.*

`Race.jsx:17` joins `grands_prix`; `Race.jsx:440` prints the name as dead text.
`Races.jsx:10` selects `rr.gp_id` and never uses it. Nothing else in `web/`
mentions the table.

Who this hurts: everyone. #3 in the findability table is the single most natural
question about Formula One that this site cannot answer, and it can answer it —
`v_grands_prix` already returns editions, span and circuit count per event.

**Do:** `/grands-prix` (53 rows: event, country, editions, span, circuits used,
last winner) and `/grands-prix/:id` (every edition, winners, the circuits it has
used, the aliases). Link it from: the `Grand Prix` field on every race page, a
"By Grand Prix" band on `/races`, and the circuit page's race list. Add
`SELECT 'Grand Prix', id, name, country, first_held, last_held FROM grands_prix`
to `Search.jsx:INDEX_SQL`. That gives browse, search and a contextual link —
three ways in — for +53 pages, one component and one prerender block. Note that
`races.name_used` vs `grands_prix.name` differs on only 16 of 1,172 rows (Mexico
City / Mexican, São Paulo / Brazilian, Emilia Romagna hyphenation), and the
modelling of that is already correct: the event page should use `name`, the race
page keeps `name_used`.

### `IA-02` — `Reference` leaves the masthead; `Data` takes the slot — **M** (decision first)
*Evidence: read the source, drove nothing. Preference, but a load-bearing one.*
*Supersedes the framing of `PD-09`; absorbs the nav half of `PD-11`.*

Evidence in finding 2 above. The move:

| Now | After | Cost |
|---|---|---|
| `Reference` in masthead | `Data` in masthead | one line, `App.jsx:31` + `prerender.js:180` |
| `/reference/quality` + `/reference/sources` | `/data/provenance` (merged) | `PD-09`'s work, unchanged |
| `/reference/sql` | `/data/sql` | route + 301 |
| — | `/data` index: artefacts, the audited-edition claim, links to both | `PD-11`'s work, unchanged |
| `/reference`, `/reference/eras`, `/reference/glossary` | unchanged URLs, no masthead slot | zero |

The two nav strings must be the **same string in both implementations** —
`App.jsx:31` and `prerender.js:180` are two hand-maintained copies of the same
list today, which is exactly how a taxonomy drifts between nav and page.

The reason to prefer this over "add `/data` as a 9th item": at ≤720px the nav is
`overflow-x: auto` with `scrollbar-width: none` (`app.css:309–318`). Summing the
declared paddings and font size across the eight labels puts the strip at roughly
620px against about 315px of visible width on a 360px phone — so the tail
(`Circuits`, `Cars`, `Records`, `Reference`) is already off-screen with no
affordance. *(Estimate from CSS, not measured in a browser — flagged as
inference.)* A ninth item makes an existing problem worse rather than making a
decision.

### `IA-03` — the app has no breadcrumb; the static page has no onward band — **S**
*Evidence: read the source. Defect.*

Detail in finding 3. `Page.jsx:16` takes a single `back`; `prerender.js:208`
builds a full trail. Neither renderer has what the other has.

**Do:** change `Page`'s `back` prop to a `trail` array and render the same
`Home / Section / Page` crumb the prerenderer already computes — the trails are
already written out per route in `prerender.js` and can be lifted. Separately,
give the four register pages distinct back labels: `"All drivers"`,
`"All constructors"`, `"All circuits"`, `"All cars"`. `"The register"` on four
destinations is a label that names nothing (see also `IA-10`).

Whether the onward band should also be prerendered is a `PD-02` question — it is
a second implementation of a computed thing — but the *breadcrumb* is cheap,
static, and the app is the side that is missing it.

### `IA-04` — `document.title` and `canonical` are never updated after the first paint — **S**
*Evidence: read the source. Defect.*

No `document.title`, `useTitle` or Helmet in `web/src/`. `prerender.js:1277`
writes a correct per-route title and `:1261` a correct canonical;
`smoke.mjs:859` asserts the title on a cold deep link only.

Who this hurts: every reader with more than one tab; anyone bookmarking; anyone
using a screen reader, for whom an SPA route change with no title change is a
silent navigation; and any crawler that executes JS and reads the canonical of a
client-navigated page.

**Do:** one `useEffect` in `Page.jsx` setting `document.title` from `title` (plus
` — Lap Ledger`) and updating `link[rel=canonical]`. Add an assertion to
`smoke.mjs` that navigates client-side and re-checks the title, since that is the
case the existing test structurally cannot catch.

### `IA-05` — the site's only search cannot find a car by the name anyone would type — **S**
*Evidence: read the source, queried the database. Defect.*

`Search.jsx:29` indexes chassis as
`SELECT 'Car', id, name, COALESCE(constructor_id,''), …`. `chassis.name` is the
bare model designation: `72B`, `312B3`, `6`, `8`, `JH24`. The scorer
(`Search.jsx:76`) does `entry.needle.indexOf(needle)`, so "ferrari 312" against
`"312b3"` returns −1. **Searching for "Ferrari 312", "Lotus 72" or "McLaren MP4/4"
returns "Nothing in the register answers to that."**

`chassis.full_name` is non-null for **all 1,153 rows** and contains the
constructor name in **947** of them (`Ferrari 312B3`, `Lotus 72D`).

**Do:** change `name` to `full_name` in `INDEX_SQL`. One word. This is the
cheapest finding in the report.

### `IA-06` — six of the most famous cars in F1 each have two URLs, and are absent from search — **S**
*Evidence: queried the database, read the source. Defect.*

`cars` has 29 rows, `chassis` 1,153, and **6 `cars` ids exist that no chassis
owns**: `alfa-158`, `brawn-bgp001`, `lotus-72`, `mercedes-w05`, `mercedes-w11`,
`vanwall-vw5`. Those six map to **10** chassis rows (`lotus-72` → 72B/72C/72D/72E;
`alfa-158` → `alfa-romeo-158`/`alfa-romeo-159`).

`PD-01` correctly fixed the 404s by prerendering the union. The consequence it
did not record: `/cars/mercedes-w11` **and** `/cars/mercedes-f1-w11` are both
written (`prerender.js:972` and `:1020`), both carry a self-referential
`<link rel="canonical">`, and both are in `sitemap.xml`. Sixteen URLs describe six
objects. The two halves are also not equivalent: the curated loop emits the
specification and no entries table; the chassis loop emits the entries table and
a `design family` pointer. Neither static page is the whole car; the app merges
them at whichever URL you land on.

Compounding it: `Search.jsx` indexes `FROM chassis` only, so **all six curated
car ids are unsearchable**. The Lotus 72, the W11 and the Brawn BGP 001 — the
flagship cards on `/cars` — cannot be found from the palette at all.

**Do:** (a) pick the curated id as canonical for those six and emit
`<link rel="canonical">` on the variant pages pointing at it — this does not
remove the variant pages, which are legitimately about a specific chassis, it
just says which one is the subject. (b) Add
`SELECT 'Car', id, full_name, … FROM cars WHERE id NOT IN (SELECT id FROM chassis)`
to the search index. The three addressing schemes in play — router (3,515),
sitemap (3,515), search index (3,494) — should agree, and today they do not.

### `IA-07` — a SQL console on a site that wants to be cited, with no permalink — **S**
*Evidence: read the source. Defect.*

`Sql.jsx` holds the query in `useState`. No `useSearchParams`, no
`URLSearchParams`, no hash. There is no way to share, bookmark, cite or link a
query. The six worked examples (`Sql.jsx:17`) are buttons, so even *they* have no
address — the project cannot link to its own best demonstration of what it is
for, from `/data`, from the README, or from a post.

This is the finding that turns `PD-09`'s "promote the console" from a nav change
into a real one. Promoting a surface that cannot be linked to is half a
promotion.

**Do:** read and write `?q=` (base64 or plain, either is fine at these lengths).
One `useSearchParams`. Then the examples become links, `/data` can carry three of
them as "questions this database answers", and a journalist can cite the query
alongside the figure.

### `IA-08` — no filter or sort state is in any URL, anywhere — **M**
*Evidence: read the source. Defect.*

Zero hits for `useSearchParams`, `URLSearchParams` or `location.search` across
`web/src/`. Every register's filters, chips, sort column, direction and page
(`Drivers.jsx:51`, `Races.jsx:21`, `Cars.jsx:138`, `Circuits.jsx:128`,
`Constructors.jsx:45`, `DataTable.jsx`) are local component state.

Consequences: "Every French driver who won a race" is a view a reader can
construct in three interactions and cannot send to anyone. Back and forward do
not restore it. A page refresh loses it. And the search palette is a modal with
no route, so a result set has no address either.

The site has **3,515 addressable records and zero addressable queries**, which is
an odd shape for a product whose whole premise is that it runs queries in your
tab.

**Do:** sync filter, sort and chip state to the query string in `Filters` and
`DataTable` — two components, every register benefits, and it is independently
shippable one register at a time. Lower priority than `IA-07` because a console
permalink carries the citation case on its own.

### `IA-09` — the eyebrow above every `h1` means four different things — **S**
*Evidence: read the source. Defect of consistency.*

`Page.jsx:25` renders one `eyebrow` slot in one position on every page. What
goes in it:

| Page | Eyebrow | Kind of thing |
|---|---|---|
| `Driver.jsx:166` | `Driver` | entity type |
| `Constructor.jsx:136` | `Constructor` | entity type |
| `Season.jsx:144` | `Season` | entity type |
| `Race.jsx:167` | `Round 9 of 1976` | position in a sequence |
| `Circuit.jsx:92` | `Monza, Italy` | place |
| `Car.jsx:129` | `Ferrari` *(the constructor)* | **the parent entity** |
| `Atlas.jsx:69` | `Circuits` | the parent **section** |

The car case is the damaging one: `Car.jsx:129` is
`eyebrow={chassis.constructor ?? 'Chassis'}`, so the type label appears only when
the constructor is unknown. A reader landing cold on `/cars/ags-jh24` sees
eyebrow "AGS", h1 "JH24", and a back link reading "The register". **Nothing on
that page says what kind of thing it is** — and cars are 1,159 of 3,515 pages,
a third of the site, and the part of the site most likely to be a reader's first
contact because it is the part Wikipedia does not cover.

**Do:** the eyebrow carries the entity type, always: `Driver`, `Constructor`,
`Season`, `Race`, `Circuit`, `Car`. Move `Ferrari`, `Monza, Italy` and
`Round 9 of 1976` into the standfirst or the stats block, where they already have
somewhere to sit. Six call sites.

### `IA-10` — one label for four destinations; two labels for one concept — **S**
*Evidence: read the source. Defect of naming, not of structure.*

- `back={{ label: 'The register' }}` on drivers, constructors, circuits **and**
  cars. Four destinations, one string, and none of them names where it goes.
  Races and seasons meanwhile use `"All races"` / `"All seasons"` — the right
  pattern, inconsistently applied.
- `/drivers` chip reads `"On the 2026 grid"`; `/constructors` chip reads
  `"Active"` (`Drivers.jsx:90`, `Constructors.jsx:79`). Same predicate, two
  labels, adjacent pages.
- The masthead says **Cars**; the page's own primary table is headed **"The
  chassis register"**; the filter noun is `chassis`; the route is `/cars/:id`;
  and on `/races` the column labelled **Car** links to a *constructor*
  (`Races.jsx:139`). "Car" carries three referents across the site.

Naming problems, not structural ones, and they cost proportionately less — but
they compound. The `Races.jsx` "Car" column is the sharpest: a reader who has
learned that "Cars" is the chassis section and clicks "Car" on a race row lands
on a team.

**Do:** four distinct back labels; one chip label; and rename the `/races`
column `Constructor` (which is what every other page calls it).

### `IA-11` — the two longest registers are the two with no time axis — **S**
*Evidence: read the source, queried the database. Defect.*

| Register | Rows | Filter axes |
|---|---|---|
| Cars | 1,153 | name, constructor, {winners, spec, landmark} |
| Races | 1,172 | name, **decade**, {run, scheduled} |
| Drivers | 862 | name, nationality, {winners, champions, on the 2026 grid} |
| Constructors | 150 | name, country, {winners, champions, active} |
| Circuits | 80 | name, country, type/traced |
| Seasons | 77 | none |

`/races` — the register that least needs one, because it is already ordered
newest-first — has a decade filter. `/drivers` (862) and `/cars` (1,153) do not,
despite both carrying `first_year`/`first_season` and both being *sorted* by it
(`Cars.jsx:41` orders by `first_year`). The site also ships a curated `eras`
table with ten named eras that would be a better cut than decades and is used
nowhere as a filter.

This is browse rot of the classic shape: a search box was added, and the browse
axes stopped growing. It is felt hardest by the reader who does not have a name
to type — "who was racing in the 1960s", "what did Cooper build" — which is
exactly the reader browse exists for.

**Do:** add a decade (or era) select to `/drivers` and `/cars`, matching
`Races.jsx:75` exactly. Same component, same shape, ~10 lines each. Pairs
naturally with `PD-06`, which is already changing that page's first screen.

### `IA-12` — the glossary is terminal, and the terms it should serve are undefined at the point they appear — **S**
*Evidence: queried the database, read the source. Defect of placement. Content design owns the wording.*

`/reference/glossary` holds 44 terms. It is linked from exactly three places in
`web/`: the `/reference` card, one `Onward` hint on `/reference/eras`, and the
sub-nav. **No term is linked from anywhere it actually occurs.**

Meanwhile `race_entries.status` carries **DNQ 1,029 times, DNPQ 336, NC 200** —
1,565 bare initialisms rendered verbatim on race classifications by
`format.js:result()`. Of those, none is in the glossary. `DNF` is the only
"did not …" term in it, and `DNF` is not among the top status values.

The pattern the project actually follows — and follows well — is *define at the
point of use*: `Records.jsx:263` defines "grand slam" in a `Note` right above the
table, and does it better than a glossary entry would. The glossary is therefore
the residue: terms that had nowhere else to go. That is a drawer inside a drawer.

**Do:** the structural half is to make the glossary a *lookup* rather than a
*destination* — an `<abbr>` or a small popover on the status column keyed off the
`glossary` table, and the DNQ/DNPQ/NC/DSQ rows added to it. The editorial half is
a content-design call.

### `IA-13` — `/reference/eras` renders nine tables under a two-word label — **S**
*Evidence: read the source. Defect.*

`Eras.jsx` sections: Ten eras (56), Engine formulae (81), Scoring systems (108),
Regulation changes (131), Regulation limits (156), Technical innovations (181),
Safety (199), Governance (218), Tyre suppliers (234). The nav label —
"Eras and regulations" — names two.

Scoring systems and regulation limits are the two a reader arrives *for*: "why is
a 1955 points total not comparable" is a real question this database can answer,
and `Seasons.jsx:101` even sends readers here for exactly that. It is section
three of nine on a page reached at depth 2 behind a label naming neither.

**Do:** this is a page-level split, not a re-taxonomy. Give each of the nine an
`id` (`Section` already accepts one, `Page.jsx:47`) and put a jump list at the
top; then deep-link from where the question is asked — `Seasons.jsx:101` →
`/reference/eras#scoring`, `Car.jsx:270` → `/reference/eras#limits` (which
already tells the reader the limits are "kept with the regulation limits" without
linking there). Cheap, and it does not require deciding the drawer question.

### `IA-14` — the masthead nav overflows silently on a phone, tail-first — **S**
*Evidence: read the source. Inference on the measurement.*

`app.css:302–319`: below 720px the nav becomes `width: 100%; overflow-x: auto;
flex-wrap: nowrap; scrollbar-width: none` with `::-webkit-scrollbar { display:
none }`. There is no fade, no chevron, no count.

Estimating from the declared `font-size: 13.5px` and `padding: 6px 10px`, the
eight labels run to roughly 620px against ~315px visible at 360px. The four that
fall off the end are `Circuits`, `Cars`, `Records`, `Reference` — which is to say
a third of the site's pages, the highest-intent page for the fan audience, and
the entire methodology section. *This is an estimate from CSS, not a browser
measurement; it wants confirming before it is acted on, and it is the main thing
building the site would have settled.*

It is also the constraint that makes `IA-02` a decision rather than an
addition.

**Do:** confirm the number, then either a visible scroll affordance or a
two-row nav below 720px. Visual design owns the treatment; IA owns the fact that
half the top level is currently invisible to a phone reader.

### `IA-15` — the one download instruction on the site names `f1.db` alone — **S**
*Evidence: read the source, read the docs. Defect.*

`prerender.js:1218`: *"The database is a plain SQLite file. If you would rather
query it with your own tools, download `f1.db` and open it with any SQLite
client."* `f1.db` is not a link (it is a `<code>`), and `robots.txt`
(`prerender.js:1332`) disallows it.

Two things wrong. First, it is the only place on 3,515 pages that tells a reader
the artefact exists, and it does not tell them where it is — `PD-11`'s point.
Second, `CLAUDE.md` states the binding rule: *"Anything that publishes `f1.db`
must publish `f1-geometry.db` beside it. Omitting it ships zero centrelines with
no way to obtain them."* This sentence publishes `f1.db` and does not mention
`f1-geometry.db`. A reader who follows it gets a database with an empty
`circuit_geometry` table and no indication that the missing 25 centrelines are a
second file — the exact failure the rule exists to prevent.

**Do:** the sentence moves to `/data` and names both files and why they are two,
which is `PD-12`'s "constraint as a position" argument applied to the ODbL split
(where it is already stated well, on `/reference/sources`).

### `IA-16` — `/records` keeps its slot; `PD-03` is a structural fix, not a tidy-up — **S** (a decision, not a task)
*Evidence: read the source, read the docs, queried the database. Endorsement with an escalation.*

Reasoning in the "answers" section above. Recording it as an ID so a later
critique has something to argue against rather than re-raising the nav question.

**Do:** nothing to the nav. Do `PD-03`. Consider, while there, that the page is
doing two jobs under one title — 30 authored one-liners and seven derived
leaderboards — and that if the authored block survives as "Published, not
derived", it should sit *below* the derived leaderboards, not above them, because
the derived ones are the demonstration and the authored ones are the caveat.

---

## What is genuinely good — do not disturb it

- **The `Onward` band, and that it is computed.** `Page.jsx:133` plus the call
  sites in `Driver.jsx:382`, `Constructor.jsx:375`, `Race.jsx:467` — a driver's
  *last team* and *best season by name*, a constructor's *most successful
  design*, the *next race*. Specific computed onward links are the single most
  effective substitute for a hierarchy that a deep-arriving reader can have, and
  this is a better implementation than most funded sites manage. Everything
  `IA-03` asks for is *in addition to* this, not instead of it.
- **`/seasons/:year` and `/races/:year/:round`.** Guessable, stable, shareable,
  human-readable, and they will still resolve in twenty years. `/circuits/atlas`
  nested under the section it belongs to rather than promoted to the top level is
  the right call and the kind that usually goes the other way.
- **The 404 is a real 404** (`prerender.js:1299`) with the eight section links on
  it, rather than an SPA rewrite to `index.html` with a 200. Almost nobody gets
  this right.
- **`Search.jsx` as a piece of engineering.** One query, in-memory filtering,
  prefix-weighted scoring, real `<Link>`s so middle-click and copy-link work, and
  a deliberately un-memoised rejection so one transient failure does not poison
  the session. The findings against it (IA-05, IA-06) are about *what it
  indexes*, not how it works.
- **`name_used` vs `grands_prix.name`.** 16 of 1,172 races differ, and the split
  is exactly right: the race page shows the name used that year, the event holds
  the continuing name, and `aliases` exists for the rest. This is a piece of
  modelling that anticipates a reader problem before the page that would expose
  it has been built — which is the argument for building it (IA-01).
- **`SubNav`** on all five reference pages, consistently, with the section label
  as `aria-label`. Whatever happens to `/reference`, that pattern is right and
  `/data` should inherit it.

---

## What I did not examine

- **The rendered site.** I did not build it. No screenshot, no browser
  measurement, no mobile viewport, no throttled first visit. `IA-14`'s
  measurement is an estimate from CSS and is marked as one; every other finding
  is legible from source or from the database.
- **Any real user.** Audiences reasoned from the artefact and from the brief.
  With no analytics (`PD-Ø`), every claim about *relative* demand — including my
  endorsement of the `/records` nav slot and my placement of `/grands-prix` below
  the masthead — is an argument from structure, not evidence. If `PD-Ø` is ever
  resolved, those two calls are the first to re-test.
- **Crawler behaviour.** I did not check what is actually indexed at
  lapledger.org, so `IA-06`'s canonical claim is about what the build emits, not
  about observed consequences.
- **Accessibility.** Left to that discipline, except where a structural defect
  has an obvious assistive-technology cost (`IA-04`'s silent route change,
  `IA-09`'s eyebrow).
- **The atlas, the charts and the SQL console as interactive surfaces.** Only
  their placement in the structure. `PD-08` is unaffected by anything here.
- **`docs/` beyond the brief, the backlog and the prior critique.** In
  particular I did not read `DERIVED-CONFIDENCE.md` or `TIMING-ARCHITECTURE.md`
  in full; the brief scopes both away from IA.
