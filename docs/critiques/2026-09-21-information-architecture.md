# Information architecture critique — 2026-09-21

**Critic:** `information-architecture-critic`, third run.
**Subject:** `main` at `dda5afb` (v2.24). The prerendered `web/dist/` (3,545
`index.html` files) read directly, and the same build driven in Playwright at
`http://localhost:4179`. `f1.db` queried via `./f1 sql`.
**Prior read in full:** `docs/critiques/2026-09-10-information-architecture.md`,
`docs/critiques/2026-09-13-information-architecture.md`,
`docs/critiques/2026-09-13-design-review.md`, `docs/LANDED.md`, the 150 open
issues and the three board columns.
**Read-only.** No issue filed, no file in the repository touched, no build run.
Scratch under `scratchpad/critiques/information-architecture/`.

IDs continue from `IA-24`. Where a finding is an existing item re-measured, it
keeps that item's ID and says what is new.

---

## The three that matter

### 1. The site's entire relational layer exists only in the app, and it has left two pages with no inbound link anywhere

*Drove the site; read 3,545 prerendered files. **Defect.** `IA-03` re-measured,
with a cause the previous runs did not name.*

`Keep going` — the computed onward band — appears **0 times in 3,545
prerendered pages** (`grep -c "Keep going" web/scripts/prerender.js` → 0). So
does the race stepper: `web/dist/races/2026/13/index.html` contains no
`href="/races/2026/12"` and no `href="/races/2026/14"`. On all 1,196 static
race pages — 34% of the site — the most obvious relationship in the sport, the
round before and the round after, is absent until 5 MB has arrived.

The consequence nobody has recorded is worse than the omission. Counting every
`href` in every `<main>` across `web/dist`:

| destination | pages linking to it (whole document, incl. nav and footer) |
|---|---|
| `/data/quality` | 3,388 |
| `/records`, `/races`, `/changes`, `/data/sql` | 3,540–3,541 (masthead/footer) |
| **`/reference/eras`** | **0** |
| **`/reference/glossary`** | **0** |
| **`/now`** | **0** |

`/reference/eras` and `/reference/glossary` are in `sitemap.xml` and are linked
from **nothing** — not the masthead (they lost the slot in `IA-02`), not the
footer, not any body. Their only inbound links in the whole product are eight app-only
`<Link>`s: seven in `Onward` bands (`Home.jsx:279`, `Seasons.jsx:123`,
`Cars.jsx:97`, `Circuits.jsx:77`, `Races.jsx:96`, `Eras.jsx:235`,
`Glossary.jsx:99`) and one in prose on the car page (`Car.jsx:240`). There is
a `SportNav` that links the two to each other — and it renders **only on those
two pages** (`Eras.jsx:69`, `Glossary.jsx:30`), so the only navigation between
them is visible exclusively to a reader who has already arrived at one.
`SubNav.jsx:8–10` states the plan —
*"reached from the pages about the sport … not from `/data`"* — and the plan
was implemented in one renderer out of two.

For a search engine, an in-sitemap page with zero internal links is the textbook
signal to deprioritise. For a reader on a cold load, or with JS off, the eras
and the glossary do not exist. This is the discoverability half of a project
whose author says he wants readers and citations.

**Do:** emit `Onward` and the stepper from `prerender.js`. The items are already
computed in `web/src/queries/*.js`; the prerenderer already imports from there
(`smoke.mjs` imports `ENTRIES`, `CONSTRUCTOR_IMAGES` and friends the same way).
**M**, and it is the single change with the widest blast radius in this report.
Re-rank `IA-03` from *Next/S* to *Now/M*, and drop its breadcrumb half into
`IA-22` where it belongs.

### 2. `grands_prix` still has 53 rows, a view, and no page — and search now answers the question in the worst possible shape

*Queried the database; drove the search palette. **Defect.** `IA-01`
re-measured, under-ranked.*

Re-run against v2.24: **17 of 53 Grands Prix have used more than one circuit,
and those 17 account for 785 of 1,196 races — 66%.** Unchanged in substance,
worse in relevance: 2026 carries both a *Spanish Grand Prix* (round 7,
Catalunya) and a *Madrid Grand Prix* (round 14, Madring), and nothing on the
site can tell a reader how those relate.

New evidence the previous runs did not have. Typing `british grand prix` into
the palette now returns **40 results, and all 40 are individual races, oldest
first** — 1950, 1951, 1952 — truncated at the cap from a population of 77. The
site does have an answer path to the most natural question in Formula One; it
is 77 rows deep, alphabetically meaningless, and cut off at 40. A reader who
wants "the British Grand Prix" gets the 1950 British Grand Prix.

`Race.jsx` still joins `grands_prix` only to print `gp_full` as dead text.
`Races.jsx` still selects `gp_id` and discards it.

**Do:** `IA-01` as filed — `/grands-prix` (53) and `/grands-prix/:id`, linked
from the race page's Grand Prix field, a band on `/races`, and the circuit
page's race list; one `UNION ALL` into `INDEX_SQL`. **M.** Move it from *Next*
to *Now*. It is the largest single gap between the reader's model of the domain
and the site's, it adds 54 high-intent pages, and — given finding 3 — it is the
natural place to put the "held at these seven circuits" story that no page tells.

### 3. There is no time axis on the registers, the site's own copy says there is, and the ten eras in the database are an orphan page rather than a navigable cut

*Drove the site; read the source; queried the database. **Defect** (the false
promise) plus a **preference** (the era axis).*

Three onward bands ship this hint today:

- `Driver.jsx:344` — *"All drivers · Filter the register by nationality **or era**."*
- `Constructor.jsx:341` — *"All constructors · The other 149, filterable by country **and era**."*
- `Car.jsx:353` — *"All cars · 1,153 chassis, filterable by team **and era**."*

There is no era control, and no decade control, on `/drivers`, `/constructors`
or `/cars`. Driven: `/drivers` offers a name box, a nationality `<select>` and
three chips (All / Race winners / Champions / On the 2026 grid); `/cars` offers
a constructor `<select>` and four chips; `/constructors` a country `<select>`
and three chips. Only `/races` has a decade filter. The site advertises a
filter it does not have, on the two longest registers (862 and 1,153 rows,
both paginated behind *"Show the remaining 712"* / *"Show the remaining
1,003"*). That is `IA-11` with the site's own copy as the witness.

Meanwhile `eras` holds ten rows with `from_year`, `to_year`, `era_name`,
`summary`, `dominant_teams` and `defining_features`. Every season, race,
driver, car and constructor in the database falls into exactly one of them by
year. Today that structure is rendered as ten `<h2>`s on `/reference/eras` —
the page from finding 1 that nothing links to — alongside eight further
tables under a two-word label (`IA-13`).

This is the strongest answer available to *"it is all a bit dull"*, and it costs
one route plus one filter. An era is the cut a contemporary reference product
offers and this one does not: a time axis that is *editorial* rather than
arithmetic. A decade is a number; "Ground effect and turbos, 1977–1988,
dominated by Lotus, Williams, Brabham, McLaren and Ferrari" is a place to
arrive and look around.

**Do, in this order:** (a) delete the three false hints, or add the filter —
**S** either way, and it should not ship false for another week; (b) an era
`<select>` on the three registers, derived from `eras`, **S**; (c) `/eras` and
`/eras/:id` as a real section — the seasons, champions, rule changes, dominant
teams and landmark cars of each era, with `/reference/eras` 301ing to `/eras`
— **M**. (c) also disposes of finding 1's orphan problem and `IA-13`, because
the nine tables under the two-word label split naturally by era.

---

## The full set, ordered by consequence

Findings 1–3 above are `IA-03` (re-ranked), `IA-01` (re-ranked) and a new
`IA-27`. The rest follow.

### `IA-25` — `/reference` is a path segment that redirects away from its own children — **S, new**

*Read `web/dist`; read `App.jsx:328–332`. **Defect** of addressing, small.*

`web/dist/reference/index.html` is a `noindex` meta-refresh to `/data` with
`<link rel="canonical" href="https://lapledger.org/data">`. Beneath it,
`/reference/eras` and `/reference/glossary` are real pages. So a reader who
trims `/reference/glossary` to `/reference` — the commonest URL-repair
behaviour there is — lands on a page about SQLite files. The segment names
nothing; it is a fossil of the taxonomy `IA-02` replaced.

`IA-02` was right and `/data` is a genuine category, not a drawer: files,
schema, provenance, licences, gaps and the console all serve one reader. The
residue is the problem. Two pages about the sport are sitting under a noun
that now means "the database", in a directory whose index says they moved.

**Do:** `/eras` and `/glossary`, with `Moved` routes and static redirect pages
at the old addresses — the pattern already exists four times in `App.jsx`. Ship
with `IA-27`(c). One consequence worth stating: it puts two more items in the
top-level namespace without putting them in the masthead, which is the right
trade.

### `IA-26` — the two renderers give 1,276 of 3,540 pages different names — **S, new**

*Drove the site, route by route. **Defect.***

`Page.jsx` sets `document.title = h1 + ' — Lap Ledger'`;
`scripts/prerender.js` computes its own. They disagree on four route families:

| route | prerendered `<title>` / `h1` | app `<title>` / `h1` | pages |
|---|---|---|---|
| `/races/:y/:r` | `2026 Italian Grand Prix` | `Italian Grand Prix` | 1,196 |
| `/seasons/:y` | `1976 Formula One World Championship` / `1976 FIA Formula One World Championship` | `1976` | 78 |
| `/reference/eras` | `Eras` | `Eras and regulations` | 1 |
| `/` | `Lap Ledger — a Formula One database you can check` / `Formula One, 1950–2027, with its sources attached` | `Every Formula One race since 1950` | 1 |

**1,276 pages, 36% of the site.** What a reader experiences: they arrive on
`/races/1976/9` from a search engine whose index says *"1976 British Grand
Prix"*, and five seconds later their tab, their bookmark, their history entry
and their screen reader's page-change announcement all say *"British Grand
Prix"* — the year gone. On a season page the tab becomes the bare string
`1976`. On the home page the two renderers disagree about the product's own
positioning sentence.

`web/test/smoke.mjs:2035` already records the divergence — *"checked on routes
whose titles differ between the renderers, which is why the citation names the
address and not the title"* — and treats it as a constraint to route around.
The title-equals-h1 invariant is asserted at `:2566`, on a driver page, where
the two happen to agree.

**Do:** one function, imported by both renderers, per route family — the
project's own pattern (`standingsHeading`, `titleHeading` in
`src/queries/season.js` are exactly this, and `smoke.mjs:49` imports them). My
reading of which is right: the **prerenderer's**. `2026 Italian Grand Prix` is
what a reader types, cites and shares; `Italian Grand Prix` with an eyebrow
reading `Round 13 of 2026` is a page that only makes sense while you are
looking at it. Extend `PD-39`'s static-versus-app comparison to `<title>` and
`h1` so it cannot drift again.

### `IA-06` — re-sized from S to M: it is not only a search gap, it is two records of one car that disagree — **M, existing, escalate**

*Read `web/dist`; queried the database. **Defect.***

Unchanged since 2026-09-10: `cars` has 29 rows, `chassis` 1,153, six `cars`
ids own no chassis, and 23 ids are both. `/cars/mercedes-w11` and
`/cars/mercedes-f1-w11` both ship, both carry a self-referential canonical,
both are in `sitemap.xml`. What the original finding did not record is that
**they disagree about the facts**:

| | `/cars/mercedes-w11` | `/cars/mercedes-f1-w11` |
|---|---|---|
| `h1` | Mercedes F1 W11 EQ Performance | Mercedes F1 W11 |
| Constructor | `mercedes` | Mercedes |
| Designers | 5 names, `Loic Serra` | 10 names, `Loïc Serra` |
| Engine | Mercedes-Benz M11 EQ Performance turbo V6 | Mercedes-AMG F1 M11 EQ Performance (AMG HPP M11) |

And the app renames the first one again: its `h1` at `/cars/mercedes-w11` is
`Mercedes F1 W11`, not the static `Mercedes F1 W11 EQ Performance`.

Separately and cheaply: **all six curated car pages print the constructor id
where the constructor name belongs** — `lotus`, `alfa-romeo`, `brawn`,
`mercedes`, `vanwall` — unlinked, in the `Constructor` field of the
prerendered page. Those six are the flagship cards at the top of `/cars` and
the six most famous cars in the sport. It is the storage model on the page, on
the six pages most likely to be shown to someone.

For a product whose distinguishing claim is verifiability, two addressable
records of one object with two engine names is a credibility defect before it
is an IA one. Keep the two pages — a chassis is a legitimate subject — but say
which is the subject, and make them agree.

### `IA-29` — a record has no address — **M, new**

*Drove the site. **Preference**, load-bearing for two of the three goals.*

`/records` is one page carrying 29 records, a champions leaderboard, eight
decade tabs, a pole-to-win chart and 202 grand slams. It is linked from the
masthead and from one body (`Home.jsx:277`). "Most Grand Prix wins by a
constructor" — the highest-intent string a fan or a journalist will ever type
about this database — has no URL, cannot be cited, cannot be shared, cannot be
linked from Ferrari's page, and cannot be found by search (see `IA-30`).

`records` holds 29 rows with `holder`, `value`, a derivation sentence and an
`as_of`. `/records/:id` would be 29 pages that each answer one question
completely, carry the full ranked list rather than the top row, and link back
to the holder — which is `PD-27`'s "names, not links" finding solved from the
other end.

For the commercial goal this is the clearest instance of the general problem:
**the site has 3,540 addressable records and, apart from `?q=` on the console,
zero addressable answers.** A reference product other people build on is one
whose answers have URLs.

**Do:** `/records/:id`, prerendered, seeded from the existing table; link the
record name from the `/records` table; index the 29 record titles into search.
Ship `PD-27` in the same diff.

### `IA-30` — search covers six tables and nothing else the site has an address for — **S for the fix, existing (`IA-20` rung 1) — do this one first**

*Drove the palette; read `Search.jsx:18–46`. **Defect.***

`INDEX_SQL` unions `drivers`, `constructors`, `circuits`, `chassis`, `seasons`,
`races` = **3,519 entries** against **3,540 addressable pages**. Measured in the
palette on this build:

| typed | results |
|---|---|
| `british grand prix` | 40 — all of them individual races, oldest first |
| `records` | 0 |
| `glossary` | 0 |
| `eras` | 0 |
| `sql` | 0 |
| `DNPQ` | 0 |
| `ferrari 2026` | 0 |
| `most wins` | 0 |
| `senna prost` | 0 |
| `who won monaco 1988` | 0 |
| `schumaker` | 0 |
| `lotus 72` | 4 (all chassis; the curated `lotus-72` page is not indexed) |

**Every page on this site is unsearchable.** A reader who has heard there is a
SQL console cannot find it by typing `sql`. A reader who wants the records
cannot find them by typing `records`. The palette is the site's only search,
the `/` key is a global shortcut, and its index is a list of six tables.

`IA-20` frames this as three rungs and puts the cheap one second. Invert it:
rung 0 is *"index everything the site has an address for"* — ten pages, the six
curated cars, the 53 Grands Prix if `IA-01` lands, and the 29 records if
`IA-29` does. That is one SQL string and a `kind`, it is **S**, and it removes
most of the zero-result cases above without touching the ranker. `IA-21`'s
empty state matters much less afterwards.

### `IA-31` — 1,159 car pages carry no structured data, and no page carries a breadcrumb one — **S, new**

*Parsed every `ld+json` block in `web/dist`. **Defect**, shared with service design.*

Types found across 3,545 pages: `SportsEvent` 1,196, `Person` 862,
`SportsOrganization` 150, `Place` 80, `SportsSeason` 78, `WebSite` 1,
`Dataset` 1. Cars are the one entity type with none — 1,159 pages, a third of
the site, invisible as entities. And there is no `BreadcrumbList` anywhere,
although `prerender.js:208` already computes the trail it would be built from,
and no `ItemList` on any register.

Two notes for the queue. First, **`SD-11` ("No `schema.org/Dataset` markup") is
already satisfied** — `web/dist/data/index.html` carries a complete `Dataset`
block with `distribution`, `license`, `version` and `temporalCoverage`. It is
sitting in *Next*. Close it. Second, this finding is the cheap half of `SD-21`
(answer engines): a `BreadcrumbList` on 3,540 pages is a loop over data the
prerenderer already has.

### `IA-22` — the breadcrumb and the URL still describe different hierarchies — **S, existing, unchanged**

*Drove the site.* `/races/2026/13` static carries `Home / Seasons / 2026 /
Italian Grand Prix`; the app carries a single back link reading `2026 season`.
Neither reaches `/races`. Two renderers, two hierarchies, and neither agrees
with the address. Unchanged since 2026-09-13. Ship with `IA-03` — the crumb and
the onward band are the same component pass.

### `IA-10` — "The register" still labels four destinations — **S, existing, unchanged**

*Drove the site.* Confirmed on this build: `/drivers/hamilton`,
`/constructors/ferrari`, `/circuits/monza` and `/cars/lotus-72` each open with
a back link reading exactly `The register`. Meanwhile the *onward* bands at the
foot of those same pages already say `All drivers`, `All constructors`,
`All circuits`, `All cars`. The right strings exist in the same file. This is a
one-line-per-page fix that has been open since the first IA run.

### `IA-32` — the engine is a string on a car page and nothing else — **M, new, lower priority**

*Queried the database; grepped `web/src`.* `engines` holds 424 rows,
`engine_manufacturers` 22. `grep -rl "engine_manufacturers\|FROM engines"
web/src web/scripts` returns `Season.jsx` and `prerender.js` only. "Which cars
used the Cosworth DFV?" — an axis with its own decade of history, and the
subject of `/reference/eras`'s *Engine formulae* table — has no browse path,
no page and no search entry. I rank it below the Grand Prix and era axes
because the audience is narrower, but it is the third missing cut and it is
already modelled.

### `IA-33` — `/now` is a good idea nothing tells anyone about — **S, new, trivial**

*Read `web/dist/now/index.html`.* The redirect is well built (canonical,
`noindex`, meta-refresh *and* `location.replace`, and it resolves without
opening the database). It also has **zero inbound links in 3,545 pages**. The
one URL a returning reader could type is a secret. One sentence on
`/seasons/:year` for the live season — *"This page is always at
lapledger.org/now"* — makes it worth having.

---

## The task-based findability tests

Eight questions plus two, attempted by navigation only from `/` and then by
search only, driven in Playwright against this build.

| # | Question | By browse | By search | Verdict |
|---|---|---|---|---|
| 1 | Which circuits has the British Grand Prix used? | Dead end. `/races` → filter, then read 77 rows of a Circuit column | 40 of 77 editions, oldest first; no event | **Fail** (`IA-01`) |
| 2 | What does DNPQ mean on this classification? | Dead end. The glossary is in no nav and no static page links it | `glossary` → 0; `DNPQ` → 0 | **Fail** (`IA-03`, `IA-30`, `CD-09`) |
| 3 | Which cars are racing in 2026? | `/cars` → *On the 2026 grid*. 2 clicks | n/a | **Pass** — `IA-19` landed and works |
| 4 | Which tracks are on the 2026 calendar? | `/circuits` → *On the 2026 calendar*. 2 clicks | n/a | **Pass** — `IA-19` |
| 5 | Where do I download the database? | `/data` → *The files*. 2 clicks | 0 results for `data`, `download`, `sql` | Browse **pass**, search **fail** |
| 6 | Who leads the 2026 championship? | Home panel, 1 click; or type `/now` | `2026` → season row | **Pass** |
| 7 | Compare Hamilton and Schumacher | No path anywhere | 0 | **Fail** (`IA-34`, below) |
| 8 | What changed in the rules for 2026? | Scroll to the foot of `/`, `/seasons`, `/races`, `/cars` or `/circuits` in the **app** only | 0 | **Fail cold, pass warm** (`IA-03`) |
| 9 | What was the round before the 2026 Italian GP? | App: stepper, 1 click. Cold/static: no link on the page; go up to `/seasons/2026` and read the calendar | n/a | **Partial** (`IA-03`) |
| 10 | Every race held at Monza | `/circuits/monza` → *Every race held here 77*. 2 clicks | `monza` → 1 result, exact | **Pass**, and well |

Four outright failures and two partials out of ten. Three of the four failures
(1, 2, 7) have their answer sitting in the shipped database.

---

## `IA-34` — the one exploration feature every comparable product has, and this has none of — **M, new**

*Grepped `web/src` for `teammate`, `head to head`, `compare`: no hits outside
`DataTable`'s sort comparator and four sentences of prose. **Preference**,
directly against the stated goal.*

This is the structural answer to *"it is all a bit dull"*, and it is not a
route — it is a section.

Every page on this site is a **record**. A driver page is Hamilton's record; a
race page is that race's record; `/records` is the record of records. There is
no page anywhere whose subject is a **relation**: two drivers, two teams, a
rivalry, a season against another season. The onward bands do good relational
work in one direction — *the car before it*, *their best year*, *what happened
next* — and that is why they read so well. But there is nothing a reader can
*construct*.

The cheapest real version needs no new route and no new data: a **team-mate
record** section on every driver page, derived from `race_entries` — who they
were paired with, by season, qualifying and finishing head-to-head. It is the
single most-cited statistic in Formula One journalism, this database can
compute it exactly, and no page shows it.

**It is already in the backlog and invisible.** `PD-35` ("What an expert would
add, cheapest first", #158, *Next*, "S each") names it as clause three of five
unrelated items — grid penalties, tyre allocation, team-mate head to head,
title permutations, qualifying-format history. Five features in one issue, four
prefixes' worth of work, one size. Split it; give the team-mate record its own
item and rank it. A second rung — `?vs=<id>` on a driver page, prerendered for
nothing and shareable for everything — turns it into the site's first
addressable *answer* and costs one `useSearchParams`, which `IA-08` is buying
anyway.

Adjacent and equally cheap: **"on this day"**. `races.date` is populated for
1,196 rows; a home-page module and `/on-this-day` would be a dozen lines, is
the most shareable surface a historical database can have, and is exactly the
shape an answer engine quotes (`SD-21`). **S.**

---

## Consolidating the two clusters

### The filter / sort / URL-state cluster — eight items, two pieces of work

`IA-08` (#135) · `IX-16` (#146) · `IA-23` (#136) · `IX-26` (#140) ·
`IX-27` (#137) · `IX-36` (#408) · `CR-28` (#174) · `VD-29` (#132)

Confirmed on this build: filtering `/circuits` by *On the 2026 calendar* leaves
the URL at `http://localhost:4179/circuits`. Zero `useSearchParams` in
`web/src`. From an IA point of view these are **two** items, not eight, and
they are sequential:

**A. The register's state is in the URL.** `IA-08`, absorbing `IX-16` (Back
restoring the filter *is* the URL fix) and `IX-36` (clear-all is the same
`Filters` reset, and is meaningless until there is a URL to clear back to).
**M.** Ship one register at a time. This is the prerequisite for everything
else in the cluster, and — more importantly — it is the prerequisite for the
site having any addressable answer at all.

**B. The register shows the columns that matter, and the reader picks them.**
`IA-23`, absorbing `VD-29` (which columns are worth carrying is the same
decision as which are default), `IX-26` (removing a column is the picker),
`IX-27` (a phone gets a smaller default set, which is the same mechanism) and
`CR-28` (the sort signal lives in the same `DataTable` header). **M**, after A,
expressed as `?cols=`.

Nothing in the cluster should ship before A. Shipping a column picker whose
state has no address, on a site that puts a *"Cite this page as…"* block on
every page, adds a third thing a reader can see and cannot link to.

### The search cluster — six items, three rungs and one that is not search

`IA-20` (#151) · `IA-21` (#152) · `IX-22` (#153) · `IX-23` (#154) ·
`AX-02` (#226) · `IA-06` (#182)

**Rung 0 — index everything with an address.** New, **S**, do it first. The ten
pages, the six curated cars, `grands_prix` and `records` as they land. One
`UNION ALL` per kind plus a `ROUTE` entry. This alone turns eight of the twelve
zero-result queries in `IA-30` into hits, and it is the change that makes the
palette what its keyboard shortcut implies it is.

**Rung 1 — a wider needle and a forgiving one.** `IA-20` rung 1, absorbing
`IX-22` (one wrong letter) and `IX-23` (`<entity> <year>`). Index
`label || ' ' || meta`; allow one edit distance on tokens over four characters.
`ferrari 2026`, `schumaker` and `hamilton 2008` all start working, and they are
one ranker change, not three. **M.**

**Rung 2 — the question library.** `IA-20` rung 3, unchanged and still right:
grow `Sql.jsx:19`'s `EXAMPLES` from six to forty, index the question text, and
`most wins` returns a runnable answer. **M.** With `IA-29` landed, some of
those forty should resolve to `/records/:id` rather than to SQL.

`IA-21` (the dead-end empty state) folds into rung 0 as a two-link footer and
should not be its own item. `AX-02` is accessibility's, is independent of all
of the above, and should be scheduled to land in the same touch of
`Search.jsx`. **`IA-06` should leave this cluster**: its search half is one
line of rung 0, and its real content — two disagreeing records of one car — is
a separate, larger fix (see above).

---

## Backlog verdicts

### My prefix

| ID | # | Verdict |
|---|---|---|
| `IA-01` grands_prix has no page | 168 | **Keep · re-rank Next → Now.** Finding 2. Size M stands. |
| `IA-03` no breadcrumb / no onward band | 170 | **Keep · re-rank Next → Now, re-size S → M · re-scope.** Finding 1. Split the breadcrumb half into `IA-22`; this item becomes "prerender the onward band and the stepper", which is where the value is. |
| `IA-06` six cars, two URLs | 182 | **Keep · re-size S → M.** New evidence: the two W11 pages disagree on name, designers and engine, and all six curated pages print the constructor id. Take the search half out (rung 0). |
| `IA-08` no filter state in any URL | 135 | **Keep · re-rank Someday → Next.** Merge `IX-16` and `IX-36` in. The gateway item for the cluster and for any addressable answer. |
| `IA-09` the eyebrow means four things | 253 | **Keep, Someday.** Still true (`Driver`, `Constructor`, `Monza, Italy`, `Round 13 of 2026`, `Team Lotus`, and absent on `/records`). Genuinely low consequence. |
| `IA-10` one label for four destinations | 254 | **Keep · re-rank Someday → Next.** The correct strings already exist in the onward bands of the same files. This is a 30-minute item that has been open three weeks. |
| `IA-11` no time axis on the two longest registers | 255 | **Merge into `IA-27`.** New evidence — three onward bands claim the filter exists — belongs with the era work. |
| `IA-12` the glossary is terminal | 183 | **Keep, Next.** Sharpen: it is not merely terminal, it has **zero inbound links in 3,545 prerendered pages**. Sequence after `IA-03` and `IA-25`. |
| `IA-13` nine tables under a two-word label | 256 | **Merge into `IA-27`.** The nine tables split by era; that is the decomposition. |
| `IA-20` search cannot represent a question | 151 | **Keep · re-scope into three rungs, rung 0 new and S, re-rank Someday → Next.** |
| `IA-21` the no-match state is a dead end | 152 | **Merge into `IA-20` rung 0.** Two links in an empty state is not an item. |
| `IA-22` breadcrumb vs URL | 159 | **Keep, Next.** Absorb `IA-03`'s breadcrumb half. Decide the trail: `Home / Races / 2026 / Italian Grand Prix`, matching the address. |
| `IA-23` selectable columns | 136 | **Keep · merge `VD-29`, `IX-26`, `IX-27`, `CR-28` in · hard-block on `IA-08`.** |
| `IA-24` photo strip names six cars, links none | 422 | **Keep, Next, S.** The decision it is blocked on has an answer: link the caption to a car page only where the article maps to exactly one chassis (505 of 623), and leave the 118 multi-chassis captions as text until `/grands-prix`-style family pages exist. A link that is right 81% of the time and absent the rest beats no link. |

### The others assigned to me

| ID | # | Verdict |
|---|---|---|
| `PD-27` records leaderboards are names, not links | 196 | **Keep, Next, S** — and **ship inside `IA-29`**. Adding the id to three views is the same schema change a record page needs. |
| `PD-37` static puts the note below the facts | 424 | **Keep, Next, S.** Same class as `IA-26`: the two renderers disagree about a page's shape. Worth pairing in one sitting. |
| `PD-38` the current season's grid | 432 | **Keep · re-rank Next → Now, M.** This is the maintainer's stated focus area and the view (`v_current_grid`) already exists and is read by nothing. It is also where `IA-33`'s one sentence about `/now` belongs. |
| `IA-24` | 422 | above |
| `CD-09` the glossary defines the sport's words, not the product's | 179 | **Keep, Next, M.** Verified: the 44 terms are Apex … Wind tunnel restriction; `DNPQ`, `NC`, `FL` and the five confidence tiers appear on thousands of pages and are defined nowhere. Ship with `IA-12` — the wording and the placement are one job and splitting them has kept both open. |
| `CD-12` one concept, several words | 258 | **Keep · re-rank Someday → Next, and widen.** `IA-26` is the same defect at a larger scale (1,276 pages), and the eras page alone has four labels — *Eras*, *Eras and rules*, *Eras and regulations*, `/reference/eras` — for one destination. Make the item "one name per thing, in both renderers" and let `IA-26` be its first instance. |
| `IX-23` `<entity> <year>` returns nothing | 154 | **Merge into `IA-20` rung 1.** Correctly identified as riding rung 2 in its own body; it is one clause of the same ranker change as `IX-22`. |
| `SD-11` no `schema.org/Dataset` markup | 219 | **Decline — already done.** `web/dist/data/index.html` carries a full `Dataset` block. Close it and open the real gap: no `BreadcrumbList` on 3,540 pages, no structured data at all on 1,159 car pages (`IA-31`). |
| `CD-11` meta descriptions read as schema output | 257 | **Keep · re-rank Someday → Next, S.** Verified on this build: `"Adolf Brudes, Germany, Formula One 1952-1952. 0 wins, 0 poles."` The "0 wins, 0 poles" on 618 pages contradicts the site's own blank-is-not-zero convention *in the one string a search engine shows*. For a project that wants readers, the snippet is the product's shop window. |

---

## The ten I would do, project-wide, from this discipline

Ranked by value against the three stated goals (predictable structure · a
product to build on · somewhere worth visiting).

| # | Item | Size | New? | Why |
|---|---|---|---|---|
| 1 | Prerender the onward band and the race stepper (`IA-03`) | M | existing, re-ranked | The whole relational layer is app-only; two pages have zero inbound links in 3,545 files; 1,196 race pages have no neighbour link cold |
| 2 | `/grands-prix` + `/grands-prix/:id` (`IA-01`) | M | existing, re-ranked | The reader's primary axis; 66% of races sit under an event with more than one circuit; search currently answers with 40 of 77 editions, oldest first |
| 3 | Eras as an axis: delete the false hints, add the filter, then `/eras/:id` (`IA-27` ← `IA-11` + `IA-13`) | S, S, M | new + merges | Three onward bands promise a filter that does not exist; ten editorial eras are already in the database and rendered as an orphan page; the best available answer to "it is all a bit dull" |
| 4 | Search rung 0 — index everything with an address (`IA-20`) | S | existing, re-scoped | Twelve realistic queries, eight of them zero; every page on the site is unsearchable; one SQL string |
| 5 | One name per page in both renderers (`IA-26`, `CD-12`) | S | new | 1,276 pages, 36% of the site; the tab, the bookmark, the history entry and the crawler's index disagree |
| 6 | Register state in the URL (`IA-08` ← `IX-16` + `IX-36`) | M | existing, merged | 3,540 addressable records, zero addressable queries, on a site that asks to be cited; unblocks the whole column cluster |
| 7 | Team-mate head-to-head on the driver page, then `?vs=` (split out of `PD-35`) | M | existing, buried | The one exploration feature every comparable product has; exactly computable here; currently clause three of a five-item grab-bag |
| 8 | `/records/:id` + `PD-27`'s links (`IA-29`) | M | new + existing | The site's highest-intent answers have no URL; 29 prerendered pages of pure citation bait |
| 9 | `/eras`, `/glossary`, retire `/reference` (`IA-25`) | S | new | A parent that redirects away from its live children; ships with 3 |
| 10 | "On this day" on the home page and at `/on-this-day` (`IA-34`) | S | new | The most shareable surface a historical database has, from `races.date`, in a dozen lines; the shape an answer engine quotes |

Items 1, 4, 5, 9 and 10 are each a single sitting and none depends on another.
Items 2, 3, 6, 7 and 8 are each independently shippable in a week. Nothing here
needs a programme.

---

## What is genuinely good — leave it alone

- **`/data` is a category, not a drawer.** `IA-02` worked. Files, schema,
  provenance, licences, quality and the console serve one reader with one
  purpose, and the page's own copy stays on that purpose for its full length.
  It is the best-organised section on the site.
- **The onward bands are better than most funded sites manage.** *"F2004 —
  their most successful design, 15 wins"*; *"The 2019 season — their best year
  here, 11 wins from 21 entries"*; *"Lotus 49 — the car before it"*. These are
  computed, specific and worth clicking. The only criticism in this report is
  that two-thirds of the product cannot see them.
- **The addressing schemes agree.** 3,545 files, 3,541 sitemap entries, and the
  difference is exactly the five deliberate redirects plus `feed.xml`. The
  router, the sitemap and the filesystem are the same set. That is rare and it
  should be defended by a check.
- **`/now` and the four `Moved` routes** are properly built: canonical,
  `noindex`, meta-refresh *and* `location.replace`, and `/now` resolves without
  opening the database. The engineering is right; only the signposting is
  missing.
- **`IA-19` landed and works.** *On the 2026 grid* on drivers, constructors and
  cars; *On the 2026 calendar* on circuits. One idea, one label, four registers.
  Two of the ten findability tests pass because of it.
- **`IA-04` landed and holds.** `document.title` and the canonical follow a
  client-side navigation, asserted as an invariant rather than against a name.
  `IA-26` is a complaint about which name, not about whether it is set.
- **`/circuits/monza` is the best entity page on the site**: layouts, trace,
  how it changed, most wins here, constructors here, every race held here. It
  is the shape the other four entity types should be measured against.
- **URL design overall.** `/section/:slug`, lowercase, hyphenated, stable, no
  query strings in the path, no ids in the address bar except where the id *is*
  the name. Guessable and shareable. Do not change it.

## What I did not examine

Mobile and narrow viewports (`IX-27`, `IA-14` landed — I did not re-measure).
The SQL console's own interaction, beyond its example list and permalink. The
`/changes` page and `feed.xml` as a subscription surface. Any prerendered page
outside the sample of nine I parsed in full, though the link-graph and sitemap
counts are over all 3,545. Live `lapledger.org` (local `dist` only). The
Parquet and JSON exports as a navigable product. The GitHub release page's own
structure. Any real user.
