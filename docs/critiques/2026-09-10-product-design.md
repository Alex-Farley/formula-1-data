# Product design critique — 2026-09-10

**Critic:** `product-design-critic` (`.claude/agents/`), first live run.
**Subject:** the whole product at v2.20, commit `5fd14f5` on `main`.
**Brief:** `.claude/CRITIQUE-BRIEF.md`.
**Readable version:** https://claude.ai/code/artifact/6be5bf76-bbc2-4859-9bfe-a274b184d1e1
(private to the author unless shared; this file is the canonical record)

**Status of the claims below.** The critic ran read-only and left the repository
unmodified. Its seven load-bearing factual claims were independently re-checked
against the committed `f1.db` and the front-end source before this file was
written; all seven held. They are marked ✅ where re-checked. Everything else is
the critic's own observation at its stated evidence level, and is not
independently confirmed.

Findings are the critic's. **This file is the reasoning and the evidence; the
queue is `docs/BACKLOG.md`,** where each finding below appears as `PD-nn` with a
size, and is ticked, declined with a reason, or still waiting. Check there for
current state — the numbering matches, and this file is not updated as items
land.

---

## The three that matter

### 1. There are two Lap Ledgers, and the weaker one is the one most people meet

`web/scripts/prerender.js` (1,149 lines — the largest file in the front end) is a
second, independent implementation of every page. It serves search engines, no-JS
readers, and *the first 11.4 seconds of every cold visit on a 4 Mbps connection,
27.7 s on 1.6 Mbps* (measured, throttled Chromium against `vite preview`).

In that window it contradicts the app:

- Hamilton's page reads **"Entries 392"** statically and **393** in the app ✅
- Carlos Sainz reads **"Entries —, Starts —, Career points —"** while the database
  holds 245 `race_entries` rows for him — and this site's own stated convention is
  that an em dash means *nobody has established that figure*
- `prerender.js:911` tells the reader *"Each figure here is derived from the race
  records and checked against the published one"* on `/records`, where `verify.py`
  contains **zero** queries against the `records` table ✅
- 1,124 pages that work in the app return **HTTP 404** to anyone who shares the
  link ✅

This is the same class of defect the hash-router migration was undertaken to fix,
still live.

### 2. The app leads with the claim it shares with everything else; the static page leads with the one nobody else has

The prerendered homepage says *"Formula One, 1950–2026, with its sources attached
— every figure is traceable to the source it came from."* Eleven seconds later
React replaces it with *"Every Formula One race since 1950"* (`Home.jsx:87`),
which is also true of Wikipedia, F1DB, StatsF1 and the FIA archive. The
verifiability material is then section five of six.

Meanwhile 93.5% of the database (111,497 of 119,271 rows, per `ATTRIBUTION.md`)
is a re-export of F1DB, which publishes its own bulk downloads under the same
licence. The ~7,700 rows Lap Ledger actually originates — `discrepancies`,
`known_gaps`, `constructor_lineage`, `circuit_layouts`, `source_registry`, the
confidence tiers — are the entire reason to prefer it, and none of them appear on
the page where the fact they qualify lives. All 18 open discrepancies name a
specific race or driver, every one of which has a page, and no page mentions
them: `discrepanc` appears in only `Home.jsx`, `Quality.jsx` and `Reference.jsx` ✅

### 3. Nothing measures whether any of this works, and one of the three products has no door

There is no analytics of any kind in `web/` ✅ — not a self-hosted counter,
nothing. Combined with nobody having asked a user anything, the project cannot
distinguish progress from motion, and the release notes read accordingly:
v2.17–v2.20 are all supply-side (Parquet, h1 levels, SHA256SUMS, date columns).

Separately, the deploy build (then `tools/cloudflare-build.sh`, since deleted —
see `PM-01`) builds a Parquet bundle and serves it from
lapledger.org, and **no HTML file among the 2,385 links to it, to the GitHub
release, or to the repository at all**; `robots.txt` disallows it ✅. The
bulk-data audience the README courts most cannot find the artefact from the
product's front door.

---

## The full set, by consequence

### 1. 1,124 working pages return 404 to the outside world
*Evidence: drove the site, read the source, queried the database. Defect.*

`Cars.jsx:208` links every one of 1,153 chassis to `/cars/<id>`, unconditionally.
`prerender.js:831` writes pages from `SELECT * FROM cars` — 29 rows ✅.
`curl http://localhost:4179/cars/ensign-n177` → **404**; the same route inside the
app renders a complete page ("Ensign N177, raced 1977–1979, recorded entries 49").

Who this hurts: the deep-arrival reader, and anyone sharing a link to a car nobody
else has written a page about — precisely where this project has an advantage over
Wikipedia.

**Do:** change `prerender.js` to iterate `chassis`, not `cars`. Roughly a one-line
change to the source query plus a template that already exists, taking the site
from 2,385 to ~3,509 indexed pages — a 47% increase in crawlable surface.

### 2. The prerendered page contradicts the app on the same figure
*Evidence: drove the site, read the source, queried the database. Defect.*

`prerender.js:606` emits `['Entries', num(d.entries)]` — the stored column.
`Driver.jsx:23,173` emits `COUNT(*) FROM race_entries` under the identical label.
38 of 862 drivers carry a stored `entries` ✅; **14 of those 38 disagree** with the
derived count (farina 35/34, fangio 52/51, lauda 177/176, alonso 439/441, leclerc
183/186, piastri 80/83…). The remaining 824 get an em dash statically and a real
number in the app.

A journalist who copies a figure off the page Google served is copying a different
number from the one the site will show them thirty seconds later.

**Do:** make `prerender.js` call the same query the page does. If the
stored/derived distinction is worth preserving — and it is — prerender it as the
app does, labelled "Entries" and "Entries (stored)". Do not let the static layer
silently pick one.

### 3. `/records` is the least verifiable page on the site and sits in the top nav
*Evidence: drove the site, queried the database, read the docs. Defect.*

All 30 rows of `records` carry `confidence = 'medium'` ✅, which this site's own
ladder defines as *"not without checking"*. The page renders that badge 30 times.
`README.md` and `docs/DERIVED-CONFIDENCE.md` already say `records` is `authored`,
that "nothing in `verify.py` reads that table at all", and that it duplicates
career records which *are* checked on `drivers`.

The result is visible on one screen: the published table says **"Most Grand Prix
wins — Lewis Hamilton — 105 — medium"** while `drivers.wins` (derived from 27,482
entries and cross-checked against `wins_external`) is **106** ✅.

Some rows are not records at all: *"Most race starts — Fernando Alonso — over
400"*, *"Most races before a first win — Sergio Perez / Nico Hulkenberg comparison
— varies"*.

"Most wins" is the head query for the fan-settling-an-argument audience, and
Records is one of eight masthead items. The one page a fan is most likely to reach
is the one page the project's own machinery does not check.

**Do:** drop the authored rows from the front of that page and derive the
leaderboards you already derive below it. Keep the handful that genuinely cannot
be derived (closest finish, oldest winner) in a separate block titled "Published,
not derived", with the source URL on each. This turns the weakest page into a
demonstration of the strongest claim.

### 4. The differentiator is aggregated on one page instead of attached to facts
*Evidence: read the source, queried the database. Defect of placement, not of data.*

`discrepancies` has 60 rows, 18 open. Every open row's `subject` is either
`'YYYY round N'` or a driver's full name — both directly joinable to a route. A
reader on `/races/2021/10` sees a pole position stated flatly; the database records
that two sources disagree about it. The confidence tier *is* well distributed (13
of 22 pages render it), so the machinery and the taste both exist; the disagreement
ledger just never made it out of `/reference/quality`.

**Do:** one component, `<Disagreement subject={…}/>`, rendered on `Race.jsx`,
`Driver.jsx` and `Constructor.jsx`. Eighteen rows, three call sites, and a
footnote-worthy claim becomes a visible product property. **The cheapest
high-value change on this list.**

### 5. `known_gaps` publishes closed gaps and maintainer prose to a public page
*Evidence: queried the database, drove the site. Defect.*

The homepage advertises "**11 known gaps** — what is missing, why, and what would
close it". Of the 11: #1's resolution begins *"CLOSED in v2.18"*; #2's description
begins *"CLOSED in v2.15"*; #4 is *"now mostly closed"*; #8 is the 2021 Belgian
true null, explicitly *"Nothing to fix - the absence is correct."* `races_affected`
is `'0'` on ten of eleven rows including gaps that affect hundreds.

The prose rendered to the public page reads *"tools/f1db_fetch.py now reads the
fastest-lap results beside race-results.yml and writes harvest/fastest_laps.txt …
build.py fills race_entries.fastest_lap ONLY where the pole harvest is silent."*
That is a commit message on a reader-facing page.

*Engaging with the reason:* the closed entries are kept as a record of decisions,
consistent with the declared-deviation discipline — but that is an argument for
keeping them *in the table*, not for counting them as gaps on the homepage.

**Do:** add a `state` column (`open`/`closed`), filter the public page and the
homepage count to `open`, and split each row into a reader sentence and a
maintainer note, rendering only the first. Four open gaps honestly stated is a
stronger claim than eleven, four of which are boasts.

### 6. The drivers register's two leading numeric columns are empty for 96% of rows
*Evidence: drove the site, read the source, queried the database. Defect.*

`/drivers` opens sorted alphabetically on **Adolf Brudes**, then eight more drivers
nobody is looking for, with "Entries —, Starts —" and zeros across. 824 of 862 rows
have `entries IS NULL` ✅; 831 have `starts IS NULL`.

The reason is recorded (`Drivers.jsx:10-16`, `README.md`): an "entry" is not a
`race_entries` row once practice-only and withdrawn entries are counted.
*Engaging with that:* the reason justifies **not calling the derived count
"Entries"**. It does not justify printing an em dash under a column called Entries
on 96% of rows, when the site's own convention makes that em dash a positive claim
that nobody knows — which is false, because the driver's own page shows the number.

**Do:** drop `entries` and `starts` from the register and add one derived column,
`Races` = `COUNT(*) FROM race_entries`, non-null for every row. Separately, change
the default sort from `full_name` to something that answers a question — wins
descending, or last season descending. Alphabetical is an unexamined default;
nothing in the repository records a decision to use it.

### 7. The README is stale by more than an order of magnitude, and it is the database's front door
*Evidence: read the docs, queried the database. Defect.*

Wider than the section the brief warned about:

| `README.md` says | Actual |
|---|---|
| "39 tables, 34 views, ~8,400 rows" | **46 tables, 38 views, 119,271 rows** ✅ |
| "Drivers — 244 rows" | 862 |
| "Constructors — 55 rows" | 150 |
| "Lap times, grid positions, retirements, qualifying. Not held at all" | 26,997 qualifying rows; grid on `race_entries` |
| "`standings` … cover 2025–26 only" | 34,563 rows across all 77 seasons |
| "262 of 2,424 race entries carry a car" | 27,482 entries |
| "The `known_gaps` table holds six entries" | eleven |

The pattern behind it is the finding: **the build verifies every fact in the
database and nothing at all in the prose that describes it.** The same drift shows
in code — `racingColours.js` documents "five constructors are 'British' where
fifty-three are 'United Kingdom'"; the register now has no `British` at all.

For a product whose claim is that facts are checked, the document a prospective
user reads *first* being wrong by 14× is the most expensive kind of error
available.

**Do:** (a) move the 225-line reverse-chronological version log out of `README.md`
into `docs/BUILD-NOTES.md`, where it already lives, and open the README with what
the database is and who it is for. (b) Generate every count in the README from the
database and add a `verify.py` check that fails when a stated figure disagrees —
the project already has exactly this discipline for `f1_compat.json`.

### 8. Effort and value are inverted between the two largest pieces of front-end work
*Evidence: read the source, drove the site. Mixed — the atlas call is preference; the prerender call is defect.*

The most elaborately built thing is the track atlas: `Atlas.jsx` (370) +
`lib/lap.js` (196) + `TrackMap.jsx`, with a measured one-metre way-join threshold,
turn-rate quintiles over 6,272 points, dual-scale projection, and a build/verify
contract on `closes`/`loose_ends`/`segment_count`. It is genuinely excellent and
the only visually novel thing here. It also has no named audience, covers 25 of 80
circuits, and is the sole reason the second database and the runtime merge exist.
Nothing measures whether anyone opens it.

The most *load-bearing* thing is `prerender.js` — the largest file, the only
renderer most arrivals see, and (findings 1–3) the least correct.

**Do:** keep the atlas — maintenance cost is near zero and it is a legitimate
reason to link to the site — but stop giving it a slot in "Popular ways in" until
something tells you it earns one. Spend the next unit of front-end effort making
`prerender.js` call the page components' own queries. `web/test/smoke.mjs` asserts
app output against the database; it should assert the *static* output against the
same database, which would have caught 392-vs-393 and the false `/records` lede on
the day they shipped.

### 9. `/reference` is a drawer holding two unlike products
*Evidence: drove the site, read the source. Preference.*

Behind one nav item sit: the audit (`/quality`, `/sources`), an encyclopedia
(`/eras`, `/glossary`), and a developer tool (`/sql`). Three different people. The
audit is the distinguishing claim and is one click deeper than "Cars". The SQL
console — which returned a five-row aggregate over 27,482 entries in **8 ms**,
refuses writes with an excellent message, and ships six worked examples and an
84-object schema browser — is the best surface on the site for the developer and
journalist audiences, and it is item five inside item eight.

**Do:** promote two of the three. `/sql` to the masthead. Merge `/quality` and
`/sources` into one page named for what it is — "How we know" or "Provenance" — and
put it in the masthead too. Leave `/reference` holding eras and glossary, which is
what "reference" means in a sports encyclopedia. Cost: routing plus redirects; the
pages need no rewriting.

### 10. The unbuilt thing: a citation
*Evidence: drove the site, read the source, inference. Preference, high leverage.*

For a Wikipedia editor, a journalist or an academic, a source is usable when it can
be cited: a stable URL, a version, an access date, and a statement of where the
figure came from. Lap Ledger has every ingredient — `meta.version`, `BUILT` as a
deliberate constant, a per-row `source`, `source_registry`, a confidence tier, a
permanent URL per page — and assembles them nowhere.

**Do:** a `<CiteThis/>` block at the foot of every entity page emitting page title,
canonical URL, database version, build date and the distinct sources behind the
rows on that page, with a copy button — and prerendered, so a crawler sees it. One
component, one call in `Page.jsx`, one block in `prerender.js`. This converts a
browsable reference into a citable one, and no alternative in this space offers it.

### 11. The bulk-data product has no entry point, and the wrong claim on it
*Evidence: read the source, drove the site, read the docs. Defect.*

The right move is not "add a download link", it is to decide what the download is
*for*. 93.5% of it is F1DB's data; a data scientist who wants F1 results already
has F1DB, refreshed by its maintainers rather than by a Monday cron in a fork.

**Do:** publish and lead with the **audited edition**. A `/data` page in the
masthead: this is F1DB's race record with 60 recorded source disagreements, a
confidence tier on every row, a documented gap register, constructor lineage
through name changes, and 170 cross-checks that must pass before a byte is
published — here are the SQLite, Parquet and JSON. That is a claim F1DB does not
make and cannot easily copy, and it is already true. Without it the bulk export is
a redundant mirror; with it, it is the only audited F1 database in existence.

### 12. Constraints as positioning: two are stated, one is apologised for
*Evidence: read the docs, drove the site. Preference.*

The ODbL split and the racing-colours substitution are handled exactly right —
`/reference/sources` states each as a decision with a consequence, and
`racingColours.js` documents the search that failed. That is a constraint turned
into a position, and it is the best writing in the project.

The lap-timing constraint is not. On the site it appears only inside `known_gaps`
#5 as a paragraph beginning *"The laps, stints, pit_stops, race_control_messages
and team_radio tables are EMPTY…"* — a schema-shaped apology on a page about gaps.
The correct framing is a position: *no one may lawfully redistribute Formula One
lap timing, so this database contains none, and every figure here is one you may
republish.* That is a competitive advantage over any site quietly hosting scraped
timing, and it belongs on `/data` and the sources page, not in a gaps table.

### 13. Longevity: the product depends on one upstream and one unfunded person
*Evidence: read the docs, inference. Observation.*

111,497 rows come from F1DB, refreshed by `refresh.yml` every Monday. If F1DB
changes licence, stops, or restructures its YAML, the job fails and 93.5% of the
database freezes. Nothing records what happens then. The own-authored
`discrepancies`, the lineage table and the layout timelines are the assets that
survive that event — a second argument for making them the product.

**Do:** write the dependency and its fallback down in `docs/` (Jolpica under
CC BY-NC-SA remains available for local cross-checking; `harvest/` is the frozen
copy). One page, and it changes how a prospective adopter reads the whole thing.

---

## What is genuinely good — do not touch while fixing the rest

- **`/reference/sources`.** The "What a licence cost, or bought" table is the
  clearest articulation of this product's reason to exist anywhere in the
  repository, including the README. Everything else should be rewritten to match
  its voice, not the other way round.
- **The SQL console.** 8–20 ms queries, six examples chosen to teach the schema, a
  schema browser, and a refusal message that explains itself. Finished work.
- **The confidence tier's reach.** 13 of 22 pages render it — the differentiator
  actually shipped where a reader stands, and the model for what finding 4 asks of
  `discrepancies`.
- **The whole-download architecture.** The critic looked for a reason to reopen it,
  as the brief invites, and did not find one: once loaded every page is instant and
  offline, and range requests would trade a 27-second first visit for a permanently
  slower one on aggregate queries. *"The problem is not the 27 seconds — it is that
  the page shown during them is a different product."*
- **The `f1.db` / `f1-geometry.db` split, and the empty timing tables.** Correct,
  well-documented, stated as positions.

## What the critic did not examine

- Any real user. Audiences were inferred from the artefact.
- The site on a real device, network or mobile viewport — all measurement was
  1280×720 Chromium against `vite preview` on localhost with CDP throttling.
- Accessibility beyond noting the h1 and chart-table work is done.
- 15 of 22 page components in their rendered state.
- The build and verify pipeline; every database claim is a direct query against the
  committed `f1.db`.
- Live competitors — GitHub access returned 403 in that session, so the
  characterisation of F1DB's published artefacts rests on `ATTRIBUTION.md`,
  `docs/COMMERCIAL-READINESS.md` and prior knowledge. Finding 11's *diagnosis*
  holds regardless; calibrate its recommendation against what F1DB actually ships.
- Whether `f1-parquet.zip` is currently present on the deployed site.
