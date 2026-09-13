# Information architecture critique — 2026-09-13

**Critic:** `information-architecture-critic`, second run.
**Subject:** a fresh `npm run build` of `main` at `aed5fb5` (v2.23), served
with `vite preview` at `localhost:4173` and driven in Playwright; the committed
`f1.db` queried.
**Brief:** the maintainer's asks of 2026-09-13 — a focused area for the current
season (driver, car and track profiles), tables with user-selectable columns,
and a natural-language search. Evaluate the structure, labelling and taxonomy,
browse versus search, wayfinding from a deep arrival, how the current season is
surfaced relative to 76 years of history, and how search behaves.
**Prior:** `docs/critiques/2026-09-10-information-architecture.md` (source
only), `docs/BACKLOG.md`. Everything below is new; where it touches an open ID
it says so. IDs continue from `IA-16`.

**Read-only.** The preview server was stopped; **the repository was not
modified.**

**Re-checked by the author before filing:** `Season.jsx:254`, `:325`, `:348`
carry the three headings quoted; `Constructors.jsx:78` labels the chip
*Active*; `rank()` in `web/src/lib/search.js` returns −1 unless every folded
word is a substring of the one label; `Sql.jsx:19` holds six example
questions. The palette result counts were not re-run and stand at the critic's
stated evidence level.

---

## The three that matter

**1. The current season is modelled as a finished one.** `/seasons/2026` — 13
of 23 rounds run — is headed **"How the title was decided"**, **"Final drivers'
standings"**, **"Final constructors' standings"**. The `Stats` block directly
above gets it right ("LEADS · Andrea Kimi Antonelli · 267 points", "GAP · 66"),
so the page contradicts itself within one screen. On `/seasons` the top row is
`2026 | 23 | — | — | — | — | — | — | —`: the register's columns are champion,
driving-for, points, wins, runner-up, margin, constructors' champion, and none
exists yet, so the live season renders as a data gap. On `/races` the default
sort puts ten not-yet-run races above the last race run. **Defect**, and the
cheapest half of what the owner is asking for: the season-in-progress page
already computes the right numbers, it is labelled as an archive.

**2. There is no address for "now", and the taxonomy has no slot to put one
in.** The top level is eight entity registers plus `Data` — a cut by *thing*,
mapping 1:1 onto tables. A current-season area is a cut by *time*, and the only
existing instance of that cut is `/seasons/:year`. That is the right home for
it: do not add a ninth masthead item (the nav already overflows tail-first at
≤720px, `IA-14`). Add `/now` as a redirect to the current season, make
`/seasons/:year` branch on `status`, and let the home page's "The season, at
both ends" panels — which are good — be the front door's link to it.

**3. Search is an entity finder that requires every typed word to appear in
one label, and six of ten realistic queries returned nothing.** Measured in
the palette:

| typed | results |
|---|---|
| `who won the 2026 italian grand prix` | 0 |
| `fastest lap at monza` | 0 |
| `ferrari 2026` | 0 |
| `championship leader` | 0 |
| `drivers championship` | 0 |
| `most wins` | 0 |
| `antonelli` | 1 |
| `monaco` | 40 |
| `italian grand prix` | 40 |
| `2026` | 24 |

`rank()` (`web/src/lib/search.js:42`) returns −1 unless every folded word is a
substring of the *one* entity's label. So `ferrari 2026` fails not through
ranking but because no single row's label contains both — a cross-entity query
is structurally unrepresentable. This is the constraint any natural-language
work has to start from, and it is not a scoring tweak.

## Full set

### `IA-17` — the season-in-progress is labelled as concluded — **S**

*Drove the site. Defect.* `web/src/pages/Season.jsx:254, 325, 348`. Branch the
three section titles on whether any round has `status = 'scheduled'`: "The
title race", "Drivers' standings after round 13", "Constructors' standings
after round 13". Same change makes `/seasons` honest: for the live season, show
leader/points/rounds-run in the champion columns with a "so far" marker, or
give the row a distinct treatment. Currently a reader cannot tell "nobody has
established this" from "the season is not over" — which is precisely the
distinction the site's own footer says it never blurs.

### `IA-18` — no stable address for the current season — **S**

*Read the source. Preference, load-bearing.* Add `/now` (and optionally
`/2026`) as a `Moved`-style redirect to `MAX(year)`; `App.jsx:207` already has
the pattern. It is guessable, shareable, and the one URL a returning fan will
type. Do **not** put "Current season" in the masthead.

### `IA-19` — one concept, two labels, and two registers have neither — **S**

*Drove the site. Defect.* `/drivers` offers the chip **"On the 2026 grid"**;
`/constructors` offers **"Active"** (`Constructors.jsx:78`) for the same idea;
`/cars` offers *Race winners / With a spec / Landmark*; `/circuits` offers type
filters and *Traced*. So the owner's wanted "current-season car profiles and
track profiles" have no browse path at all: from `/cars` there is no way to
reach this year's eleven chassis, and from `/circuits` no way to reach this
year's calendar. One chip, one label — **"On the 2026 grid"** / **"On the 2026
calendar"** — on all four registers is the single highest-value structural
addition here, and it is four small diffs, not a new section.

### `IA-20` — the search index cannot represent a question — **M, decision first**

*Drove the site, read the source.* See the table above. Three layers, in cost
order, each shippable alone:

1. **Widen the needle.** Index `label || ' ' || meta` (constructor, circuit,
   nationality, year) rather than `label` alone. `ferrari 2026` and `red bull
   monza` start working. `Search.jsx:18–45`, one line per UNION branch. **S.**
2. **Intent prefixes, not language.** Recognise a small closed set — `wins`,
   `poles`, `champions`, `standings`, `grid` — plus an entity, and route to an
   existing page or a parameterised `/data/sql?q=…`. `most wins` → `/records`.
   Deterministic, testable in `search.test`, no model. **M.**
3. **Text-to-SQL.** Only worth considering after (1) and (2), and note it
   breaks the site's own claim: every page is a query running in this tab and
   nothing leaves it. Generated SQL means either a server round-trip (a promise
   withdrawn) or a model in the browser (megabytes beside a 20 MB download).
   **The honest middle is a question library, not a generator** — `Sql.jsx:19`
   already holds six examples all phrased as questions ("Who has led a race
   from pole most often?"). Grow that to forty, index the question text into
   the palette, and a reader typing `pole to win` gets a runnable answer. That
   is question-answering over the schema with no model and no server.

### `IA-21` — the no-match state is a dead end — **S**

*Drove the site.* `Search.jsx:171` prints "Nothing in the register answers to
that." and offers nothing. It is the exact moment a reader has expressed an
intent the register cannot serve. Put two links there: the SQL console with the
term pre-filled, and `/records`.

### `IA-22` — the breadcrumb and the URL describe different hierarchies — **S**

*Drove the site.* Static `/races/2026/13` carries `Home / Seasons / 2026 /
Italian Grand Prix`; the URL says `/races/…`; the app carries neither trail,
only a single back link `2026 season` (`Race.jsx:183`) plus the excellent
computed "Keep going" band — which the static page does **not** have (grepped:
no `Onward`, no round 14). So `/races` is unreachable from a race page by any
trail, in either implementation, and the two implementations still hold
different halves. This is `IA-03` re-measured, now with the additional finding
that the trail disagrees with the addressing scheme. Make both trails `Home /
Races / 2026 / Italian Grand Prix`, and emit the onward band statically.

### `IA-23` — user-selectable columns are cheap in `DataTable` and expensive everywhere else — **M, sequence matters**

*Read the source.* `DataTable.jsx:32` already normalises columns to `{key,
label, align, render, sort}` objects, so a `visible` flag and a picker is a
contained change. The cost is that `scripts/prerender.js` is a second
implementation of every table, and **no filter or sort state is in any URL**
(`IA-08`, open, zero hits for `useSearchParams` across `web/src/`). Ship a
column set nobody can link to and you add a third divergence between what a
reader sees and what they can cite — on a site whose every page carries a
"Cite this page as…" line. **Do `IA-08` first**, then columns as `?cols=`; the
picker then costs one component.

## Findability tests (navigation only, from `/`, driven)

| Question | Path | Verdict |
|---|---|---|
| Who leads the 2026 championship? | `/` → panel → `/races/2026/13`, or `/seasons/2026` | Works, but the heading says "Final" |
| Which cars are racing in 2026? | none | **Fail** (`IA-19`) |
| Which tracks are on the 2026 calendar? | `/seasons/2026` → calendar | Works; not from `/circuits` |
| What is the next race? | `/` panel, 1 click | Works, well |
| Was the 2026 Italian GP run yet? | `/races` → top rows are unrun | Ambiguous (`IA-17`) |
| Antonelli's 2026 season | `/drivers` → chip → driver | Works |

## Genuinely good — leave alone

The home page's "The season, at both ends" panels are the best current-season
surface on the site and should be the model, not replaced. The `Keep going`
band on race, driver and constructor pages remains better than most funded
sites manage. `Drivers`' "On the 2026 grid" chip is exactly the right idea, in
one place out of four. The `EXAMPLES` array on the SQL console is already a
question library and nobody seems to have noticed.

## Not examined

Mobile viewports; the atlas; prerendered pages other than `/races/2026/13`;
live lapledger.org (local `dist` only, v2.23); any real user.
