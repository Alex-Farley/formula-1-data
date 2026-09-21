# User research walkthrough — 2026-09-21

**Critic:** `user-research-simulator`, second run.
**Subject:** Lap Ledger at database v2.24 (built 2026-09-16), commit `dda5afb`, driven
against the built site served at `http://localhost:4179`, plus the committed `f1.db`
and the public GitHub release `v2.24`.
**Prior read:** `.claude/CRITIQUE-BRIEF.md`, `docs/critiques/2026-09-11-user-research.md`
in full, `docs/LANDED.md`'s `UR-*` entries, the open issue list (180 items), `PD-Ø` (#261)
and its four comments, `PD-36` (#400)'s decision, `LICENSE-DATA`, `docs/COMMERCIAL-READINESS.md`.
**Repository not modified.** No issues filed (suspended for this run by instruction).
All scratch files, scripts and screenshots are beside this report.

---

## These findings are simulated. No user was involved.

**This is not user research.** Nobody was asked anything. I built seven personas from
what the product contains, from the maintainer's three stated goals, and from who
plausibly needs the job it does; I gave each of them tasks with a right answer; and I
walked those tasks myself in a real browser, in character, holding to what each persona
could plausibly know.

I am systematically wrong in the ways real research exists to catch. I read faster than
people, I do not get bored, I do not arrive with the wrong mental model, and I have read
the schema — so I cannot tell you what anybody feels, prefers, or would pay.

Concretely:

- **No number here measures human behaviour.** Where I count, I count my own attempts,
  and I say so.
- **There are no quotations.** Nothing is attributed to a person, even illustratively.
- Timings, byte counts, row counts and pixel positions *are* real measurements — of the
  product, in Chromium, not of anybody using it.
- Every finding carries an evidence tag: `drove the site`, `queried the database`,
  `read the source`, `read the docs`, `inference`.
- The last-but-one section lists what only real research can settle, ranked by what a
  wrong guess costs, and says what to measure first. Given `PD-Ø` (#261) is decided and
  unstarted, that section is the honest part of this document.

**What I walked.** Seven personas, 21 tasks. By my own judgement of my own attempts —
not a completion rate, and not transferable to people — 11 reached the right answer
unaided, 4 reached an answer that is wrong or that the product contradicts elsewhere,
and 6 dead-ended.

---

## The three that matter

### 1. The championship the whole product is about can be read two ways, and the file hands you both (`UR-26`)

The site's own SQL console, on `/data/sql`, run with the query the shipped schema comment
tells you to run:

```sql
select position, entity, points, as_of from standings
where year=2026 and table_type='drivers' and after_round is null order by position
```

**46 rows in 43 ms, for 23 drivers.** Two rows per driver, two point totals, two
positions numbered 1:

```
1  Kimi Antonelli          242   2026-09-04 (after round 12)
1  Andrea Kimi Antonelli   292   current
3  Lewis Hamilton          183   2026-09-04 (after round 12)
3  Sir Lewis Hamilton      191   current
```

Two spellings of one driver, twice; `Lewis Hamilton` and `Sir Lewis Hamilton`, both at
position 3, are the same person and the same `entity_id`. The naive query without the
`after_round` clause returns **356 rows**. A developer, a data-journalist or an LLM
writing the obvious query gets a wrong table; one following the schema's own rescue gets
a duplicated table whose stale half is plausible and five points-scoring rounds old.

The *pages* are right — `/seasons/2026` shows 292 and a correct order — and the view that
fixes it, `v_standings_final`, exists and returns exactly 23 correct rows. Nothing points
at it: the console's six worked examples do not use it, `/data`'s "everything you need to
read it is inside it" paragraph does not name it, and the schema browser shows column
names only. `DA-01` (#197) predicted this shape ("2026's `as_of` column mixes `current`
with the dated snapshot"); what is new is that it is now the *first* thing the
bulk-data audience meets, and that the documented workaround does not work.

**Do, in order, all small:** point the console's examples and `/data`'s paragraph at
`v_standings_final`; print `sqlite_master.sql` (comments and all) when a table is opened
in the schema browser — the text is already in the browser's copy of the file; then take
`DA-01`'s open rungs. `UR-07` (#239) is the same item and should be re-sized **M** and
re-ranked to *Now*.

### 2. There is no front of house: no name, no contact, no way to become a customer (`UR-05`, still open as #238)

I grepped all **3,545** built pages. The string `Alex Farley` appears **zero** times. There
is no `mailto:` anywhere. There is no `/about`. The only route from a reader to a human is
`https://github.com/Alex-Farley/formula-1-data/issues/new?template=report.yml` — which
requires a GitHub account. There is no `FUNDING.yml`, no sponsor link, no "get in touch".

Four of my seven personas stopped here. The journalist could not attribute the figure to
a publisher. The Wikipedia editor could not satisfy WP:RS on authorship and fell back to
citing the upstream. The teacher had no one to ask whether a classroom re-publication was
fine. And the persona the maintainer now says he cares about most — anyone who might pay
— had no address to send money or a question to.

This was filed on 2026-09-11 as an `S`. It is a year's worth of the maintainer's stated
intent sitting behind one page. The intent to commercialise makes it the **highest
value-per-hour item on the board**: a project with 3,545 pages, a live domain, a public
repo and one download in five days cannot be bought from, and nobody can tell the
maintainer why.

**Do:** one `/about` page — who compiles this, the editorial rule (which already exists
and is written well), how to report an error *without* a GitHub account, what happens
when you do, and how to get in touch. Size **S**. `SD-15` (#223) is the same page; merge.

### 3. Two per cent of the rows put share-alike on one hundred per cent of the release (`UR-24`)

`LICENSE-DATA` offers the whole data release under CC BY-SA 4.0, and gives its reason:
*"Rather than draw a line field-by-field, the whole data release is licensed CC BY-SA
4.0."*

Measured against the shipped file, resolving each row's `source` through
`source_patterns` to `source_registry.share_alike`:

| | rows | share |
|---|---:|---:|
| sources with **no** share-alike (F1DB CC BY, facts-only official) | 93,611 | 79.0 % |
| `pit_stops`, whose `source` is the bare string `f1db` and matches **no pattern at all** | 22,506 | 19.0 % |
| sources **with** share-alike (Wikipedia, Commons, OSM) | **2,368** | **2.0 %** |

Of the 2,368: 1,128 `race_entries` and 1,125 `races` rows cite Wikipedia's *season results
tables* — bare facts, which are not copyrightable and which F1DB now supplies under CC BY
anyway; 29 `cars` rows and 16 `regulation_limits` rows are the genuine prose carriers,
plus `team_radio`'s six declared quotations.

My developer persona read `LICENSE-DATA`, understood it, and stopped: an app that ships
this database has to share-alike its own database. That is the audience with money in it,
and the licence is not asked to do anything that the row-level provenance could not do
better. The recorded reason was convenience at a time when the project could not tell one
row from another; it now can, and `source_registry` says so in the shipped file.

**This is a decision, not a task, and it is a maintainer's.** Written as one: *publish a
second artefact — `f1-facts.db` (or a Parquet subset) under CC BY 4.0, holding only rows
whose source carries no share-alike and with the Wikipedia-derived prose columns dropped
— or decide in writing that CC BY-SA is the permanent position and say so on `/data` so
an evaluator does not have to work it out.* Size **M** if taken, **S** if declined in
writing. Blocked behind `DA-03` (#199) if you want it enforced rather than asserted.

---

## The personas

Built from the maintainer's restated intent (2026-09-21): *a tool anyone can access to get
reliable F1 data in one place*, *commercialise it eventually*, *it is a bit dull*. Two of
the seven barely open the interface, which is where the audience with money is.

| | Arrives | Knows | Will not | Done when |
|---|---|---|---|---|
| **A. Sports-desk journalist, 20 min to filing** | desktop, from a search result or a bookmark | the sport; sceptical of any site | publish a figure she cannot date or attribute | has the figure, its date, and a publisher to name |
| **B. Developer evaluating the dataset** | GitHub release page, terminal | SQL, licences, dependency risk | build on a licence his employer will not take | knows the shape, the terms, the cadence, the id stability, and who to ask |
| **C. Fantasy/podcast producer, Thursday before Baku** | laptop, weekly ritual | the current season cold | dig for the grid; she has four other tabs | has the grid, the form and one talking point |
| **D. Casual fan, phone, mid-weekend** | 4 Mbps phone, Google, deep page | nothing about this site | wait, or read a methodology page | got the one fact and left |
| **E. Sixth-form teacher building a lesson** | school laptop, locked down | spreadsheets, not SQL | install anything, or ask IT | has a file thirty students can open, and knows he may use it |
| **F. Wikipedia editor sourcing a claim** | desktop, mid-edit | WP:RS, citation templates | cite a source with no named publisher | has a `{{cite web}}` he can defend |
| **G. Returning reader, "what's new?"** | desktop, or a feed reader | the site; visited a fortnight ago | re-read pages to spot a diff | knows what moved and can subscribe |

**A, D and F largely succeed.** I did not build seven versions of one person: the failures
cluster differently for each, and the two personas who never open a page (B, E) fail for
reasons no page-level fix touches.

---

## Persona A — the journalist on deadline

*Desktop 1280×900, warm cache. Three tasks. Two clean successes and one silent trap.*

**A1. "Antonelli's lead after Madrid — what is it, exactly?"**
`/seasons/2026`. The static page answers in **112 ms**: *After 14 of 23 rounds · Leads
Andrea Kimi Antonelli — 292 · Second George Russell — 211 · Gap 81*, followed by a
paragraph naming the nine drivers who can still win it, the 233 points remaining, and the
sentence *"Counted after round 14, from the database built 2026-09-16. Points only: a tie
at the top is settled on wins, which this does not work out."*

**Correct, fast, and better than any competitor I know of.** `UR-13` landed extremely
well. The self-limiting clause at the end is the kind of thing a desk editor trusts.

**A2. "Hamilton's win record, with something I can cite."**
`/records`, second block: *Most Grand Prix wins · Sir Lewis Hamilton · 106*, with the
derivation spelled out (`drivers.wins`, counted from `race_entries`, held equal by
`verify.py`), the next three holders, and `As of 2026-09-13`. The footer gives
*"Cite this page as Lap Ledger, database v2.24 built 2026-09-16, https://lapledger.org/records."*

**Correct.** `PD-03`/`UR-09` landed and the page is now one of the best things here.
The citation stops one step short: it names no publisher and no person (finding 2), so
what she can actually write is "according to Lap Ledger, a database" — which a desk lawyer
will query.

**A3. "Is anything about the 2026 table contested?"**
Here she is quietly misled, and it is the product's own strongest claim that fails.

Pierre Gasly's 2026 total is **41** on `/seasons/2026`. formula1.com says **44**. The
disagreement is *recorded* — `discrepancies` row 29, status `open` — and it is beautifully
explained on `/drivers/gasly` (*"Two sources disagree about this career"*) and on
`/races/2026/6` (a 10-second Monaco penalty; reclassifying that one race reproduces
formula1.com's whole table). **It is not shown on the standings table itself.** The
footnote under the drivers' standings talks about exclusions, shared drives and pre-1991
dropped scores, and says nothing about the nine contested figures in the table above it.

So the page where the number is consumed is the one page that does not flag it. A journalist
filing "Gasly has 41 points" against an F1.com page saying 44 has been let down by a product
that knew.
*Evidence: drove the site, queried the database. **Defect.** Size **S**.* (`UR-19`)

**Would she come back?** Yes, for `/records` and the season page. **Would she pay?** Not
for this; she would pay for a weekly "what moved" email she could scan, and she cannot
find a person to ask for one.

---

## Persona B — the developer evaluating the dataset

*GitHub release page, then a terminal. Four tasks. The data is good; everything around it is the problem.*

**B1. "Find it and get it."**
The repository is `Alex-Farley/formula-1-data`, not `lap-ledger`; the product name and the
repo name do not match, which costs a search. The description is good. **2 stars, 0 forks,
0 watchers.** The `v2.24` release lists seven assets with a clear table, per-file licence
notes, and — genuinely excellent — **stable `latest/download/` URLs and a note that the
site's Parquet copy is rebuilt every deploy**. Download counts: **1 per asset**.

The release body then prints an auto-generated *What's Changed* list of 24 internal PR
titles (`VD-26: remove the accent bar from stat tiles`, `AF-12: group backlog items that
share a file into one PR`). For an evaluator this is noise that makes the project look
like a private workshop. *Preference, not defect; cheap to suppress.*

He then opens `README.md`. The first sentence is *"An expansion of the original single-file
JSON into a normalised, queryable SQLite database"* — the product defined by its own
history, which is `CD-16` (#181), still open, and it is the developer's front door. The
first mention of `lapledger.org` is at line 58 of 1,141.

**B2. "Does it join?"** — the test that decides it.

```sql
select r.year, r.name_used, d.full_name, co.name, ci.country
from race_entries e join races r on r.id=e.race_id
join drivers d on d.id=e.driver_id
join constructors co on co.id=e.constructor_id
join circuits ci on ci.id=r.circuit_id
where e.finish_position=1 and r.year between 2020 and 2025
```

**131 rows against 131 completed races; zero winners with a null constructor.** Clean,
first time, no surprises. **This is the moment the product wins him**, and it deserves
saying: the register ids are human-readable, the joins are obvious, the foreign keys hold.

**B3. "What is it called, and is it current?"** The first thing he reads is `meta`:

```
database_name   F1 Verified Facts Project Memory Database
```

`PM-22` (#165), open since 2026-09-11. It is the *first string* in the artefact for this
audience and it reads like someone else's internal project. Cheap; re-rank up.

**B4. "Can I ship it, and will it break?"** Two blockers, one recorded and one not.

- **Licence:** CC BY-SA 4.0 on everything (finding 3). He stops.
- **Id stability:** nothing anywhere says whether `race_entries.id` survives a release.
  `DA-04` (#200) measured 17 % of them moving between v2.20 and v2.21 and is filed as a
  decision. From outside, this is invisible until it bites: the release notes, `/data`,
  the README and `meta` are all silent. **Publishing the policy is the `S` half of #200
  and it is what an evaluator actually needs** — not deterministic ordering.

Also his: `pit_stops`'s 22,506 rows carry `source = 'f1db'`, which matches none of the ten
`source_patterns`, so "may I publish this row?" answers *unknown* for 19 % of the file.
That is `DA-03` (#199) with a number attached.

**Would he build on it?** Not commercially, on the licence. **For a hobby project, yes,
happily.** He is one licence decision away from being the best-served persona here.

---

## Persona C — the fantasy/podcast producer, Thursday before Baku

*Laptop, 1280×900, in a hurry, does this every Thursday. Three tasks, one success and two dead ends.*

**C1. "When is everything, and in my time zone?"**
`/races/2026/15` is genuinely good in the app: a five-row timetable with **At the circuit /
UTC / Your time (Europe/London)**, and *"Next: Practice 1, Thu 24 Sept 12:30 at the circuit
— in 3 days."* The prerendered version drops the local-time column (it cannot know the
reader's zone), which is the right call. **Success.**

**C2. "Who is in the car this weekend?"**
Dead end, and an odd one. The upcoming race page shows a stat tile reading **`ENTRIES 0`**.
The site's own footer, on that page, says a figure is never zero unless it is zero — so the
page asserts nobody is entered for the Azerbaijan Grand Prix, on a page whose whole subject
is a race about to happen. *Defect, `S`, `UR-20`.*

There is no entry list anywhere for the weekend. Meanwhile the database contains
`season_entries` — 23 rows for 2026 with **car numbers, power units and a reserve-driver
role** — and a view built for exactly this, `v_current_grid`. I grepped `web/src`:
**no page uses either.** The string `car_number` appears on **0 of 3,545 built pages.**
A fan who wants to know who drives car 12 cannot find out here.
*Evidence: queried the database, read the source, drove the site. **Defect of omission**, `S`. (`UR-22`)*

**C3. "Give me a talking point."**
She finds one eventually — `/circuits/baku` has "Most wins here" — but the route from
*this weekend* to *the history of this circuit* is one unlabelled link in a facts list.
Nothing on the site assembles "what to say about Baku": not the race page, not the season
page. The material exists in six places.

And when she looks at the season page's entry list, she gets this (screenshot:
`entered.png`):

| Constructor | Entered as | Chassis | Engines |
|---|---|---|---|
| Mercedes | `mercedes-amg-petronas-formula-one-team` | `mercedes-f1-w17` | `mercedes-amg-f1-m17-16-v6-t-h` |
| Red Bull Racing | `oracle-red-bull-racing` | `red-bull-rb22` | `red-bull-ford-dm01-16-v6-t-h` |

**Four of the six columns in "Who entered" are raw F1DB slugs, on all 77 season pages.**
1976 is worse: `john-player-team-lotus`, `mclaren-m23d+mclaren-m26`, `first-national-city-bank-team-penske`
(screenshot: `entered1976.png`). `season_entrants` stores ids and no display names, so the
page has nothing else to print. The same leak reaches the constructors' standings, where
the engine column renders `Mercedes mercedes`, `Racing Bulls red-bull-ford`, `Haas F1 Team ferrari` —
which is `DA-11` (#206) surfacing to readers rather than staying in the schema.

This is the single largest reader-facing raw-identifier leak I found, it is on the most
time-sensitive pages on the site, and no open issue names it.
*Evidence: drove the site, queried the database. **Defect**, `M` (needs a sourced name map from F1DB, not title-casing). (`UR-14`)*

**Would she come back?** For the timetable, yes. **Would she pay?** For a grid-plus-form
page she could open on a Thursday, plausibly — and that page is three queries away from
data the project already holds.

---

## Persona D — the casual fan, phone, mid-weekend

*iPhone 13 emulation, CDP-throttled. Four tasks. The best-served persona, with one measurable tax.*

**D1. "Who won at Madrid?"** Landed on `/races/2026/14` from a search result.
**Static paint 117 ms on 4 Mbps**, and the first screen carries the answer in a sentence:
*"Andrea Kimi Antonelli won for Mercedes at Madrid IFEMA."* **Correct, immediately.**
This is the product's best moment and it is the commonest arrival.

**D2. "Tap the winner's name."** Tapped at 3,000 ms, mid-download. Measured: **one
`f1.db.gz` request, not two**; the URL changed to `/drivers/antonelli`; a pinned bar
appeared at the foot of the screen reading *"Downloading the database — opening Andrea
Kimi Antonelli when it is ready · 3.1 MB of 5.0 MB"* with a progress bar; the app opened
the right page at **15,079 ms** (screenshot: `tap-after.png`).

`UR-03` and `UR-04` landed and **they work**. That handover is now better than most
production sites manage, and it is worth protecting in the smoke suite.

**D3. The tax nobody has measured.** On that same cold visit:

| | bytes |
|---|---:|
| `f1.db.gz` | 5,083 kB |
| **Wikimedia Commons photographs (6)** | **1,344 kB** |
| fonts | 89 kB |

The six car photographs are **26 % of extra weight on the critical path**, downloading in
parallel with the database from 951 ms. The markup asks for `?width=600`; the Commons
redirect chain (302 → 301 → 200, three round trips each on a 70 ms link) delivers the
**960 px** file, and one of them is **685 kB** — for a slot about 180 px wide on a 390 px
phone. `loading="lazy"` is set, but they are above the fold on a phone, so it does not fire.

App-ready times I measured: **12,475 ms** homepage, **15,031 ms** race page (with photos),
**36,446 ms** for `/seasons/2026` at 1.6 Mbps.

`VD-23` (#130) already has the three-redirect finding; it now has a byte cost and a
critical-path argument, and should be re-ranked. The cheap half is a `srcset`/width fix and
`fetchpriority="low"`.
*Evidence: drove the site (throttled). **Defect**, `S`. (`UR-18`)*

**D4. "When is the next one?"** He goes to the front door — and gets a different site.
See finding `UR-15` below.

---

## Persona E — the teacher building a data lesson

*School laptop, cannot install anything, thirty students with spreadsheets. Three tasks, all blocked.*

**E1. "Get a file my class can open."** `/data` is a very good page — clear, honest,
well-written, and it names three formats: `f1.db` (SQLite), `f1-geometry.db`, and
`f1-parquet.zip`. **There is no CSV and no XLSX anywhere on the site or in the release.**
For a school, SQLite means a client nobody can install and Parquet means Python. He stops.

This is not an argument that CSV is better; it is that the one format a locked-down laptop
opens is absent, and the exporter already writes 41 tables. A `f1-csv.zip` beside the
Parquet bundle is the same build step with a different writer.

**E2. "Then get one answer out of the console."** The SQL console is excellent —
9–43 ms, six teaching examples, an unusually kind refusal message — and **it has no
export**. I enumerated every button and link on the results page: `Run`, two column
headers, six examples, the nav. No *Copy*, no *Download CSV*, no *Copy as Markdown*. The
only way out of a result is to select an HTML table with a mouse.

For a teacher, a journalist, a student and an analyst alike, "I have the answer, now get it
into a spreadsheet" is the last step of every task, and it is missing from the surface built
for exactly that. One button, `navigator.clipboard.writeText(tsv)`, plus a Blob download.
*Evidence: drove the site. **Defect**, `S`. (`UR-17`)*

**E3. "May I put this on the school intranet?"** `/data`'s licence section is clear and he
gets there — but CC BY-SA means the worksheet he builds from it inherits share-alike, which
is exactly the question he cannot answer alone and has nobody to ask (finding 2).

**Would he come back?** No. **Would he pay?** He has no budget, but a class of thirty is
thirty people who learn the name — and he is the cheapest distribution channel the project
has, blocked by one missing file format and one missing email address.

---

## Persona F — the Wikipedia editor

*Desktop. Three tasks. The product's best work, and then the same wall.*

**F1. "Who set the fastest lap in the 1970 South African Grand Prix, and is it disputed?"**
Answered on `/races/1970/1` in both renderers, with both readings, the reasoning, the
reference total that decides it, why that is a reason and not a proof, and
*"Recorded rather than resolved, and open for somebody to settle."* Unchanged since the
last run and still the best thing here.

**F2. "Cite it."** Better than last time — every page now carries
*"Cite this page as Lap Ledger, database v2.24 built 2026-09-16, <url>"*, which is
genuinely useful and version-pinned. Still no author and no publisher (finding 2), so a
WP:RS challenge lands on "self-published by whom?" and his realistic next move is to cite
the Wikipedia article the disagreement block links to. **The project does the work; the
upstream gets the citation.**

**F3. "What does this thing say about how far to trust it?"** `/data/quality` is much
improved and the Gasly/Monaco explanation is a model of the genre. One content note in
passing: the same 100-word paragraph explaining the round-12 disagreement appears **eight
times** on that page, once per affected row. It reads as generated boilerplate on the page
whose job is to sound like a person thinking. *Content design owns the fix.*

---

## Persona G — the returning reader

*Desktop, two weeks since the last visit. Two tasks, both partial.*

**G1. "What is new?"** `/changes` exists, is linked from the footer (not the nav), and is
good on *state*: version, build date, races run, entries, open disagreements, known gaps —
all computed, with the line *"Counted from the database this page was built from, not
stored anywhere."* Excellent.

It is poor on *change*. The "Released versions" table reads:

```
2.24  2026-09-16  v2.24, and a release reminder measured against this project's own releases
2.23  2026-09-13  v2.23 — the records are derived, not published
2.21  2026-09-11  v2.21: pole is its own column
```

These are engineering release titles. A returning reader wants *"Madrid Grand Prix added;
Antonelli's eighth win of 2026; one new disagreement on Gasly's points."* The `feed.xml`
entries are the same: `<summary>Released 2026-09-13, built 2026-09-09.</summary>`.

The database can produce the sentence — `/changes` already computes the race count and the
last race. The feed is the only push channel this project has, and it currently pushes
version numbers. *Evidence: drove the site, read the feed. **Defect of content**, `S`. (`UR-21`)*
`SD-23` (#412) is adjacent (feed durability) and this should ride with it.

**G2. "Subscribe."** The Atom link is there and correct. `<author><name>Lap Ledger</name></author>` —
a feed reader will show no human, consistent with finding 2.

---

## Findings, ordered by consequence

Sizes: S = a sitting; M = a few; L = a programme; ? = decide first.
Findings 1–3 are above and not repeated.

### `UR-15` — The homepage a crawler indexes is a different document from the one readers see — **S/M**
*Evidence: drove the site, read the source. **Defect.***

| | prerendered `/` | the app's `/` |
|---|---|---|
| `h1` | *Formula One, 1950–2027, with its sources attached* | *Every Formula One race since 1950* |
| lede | one sentence on traceability | four sentences on scope, search, SQL and privacy |
| main block | **The last ten champions** (2016–2025) | six row-count tiles, then **The season, at both ends** |
| current season | **absent** | *Last race: 2026 Madrid GP · Next: Azerbaijan, 24–26 Sep, round 15* |

`scripts/prerender.js:1209` writes one homepage; `src/pages/Home.jsx:90` renders another.
Two independent implementations of the front door that have diverged in title, lede and
content.

Why it matters to a named reader: my phone fan (D4) arriving at the front door mid-weekend
waits 12.5 s and sees, in the meantime, a table of champions ending in 2025 — the single
question a new arrival has is *"is this current?"*, and the indexed answer is "2016–2025".
It also means the H1 Google ranks is not the H1 anyone reads, which is the one SEO fact a
project with no analytics cannot afford to get wrong.

**Do:** make the prerendered home the app's home (the season block is already computed at
build time on `/seasons/2026`, so this is a lift, not new work), or, if the two are
deliberate, say why in a comment and pick one `h1`.

### `UR-14` — "Who entered" prints raw F1DB slugs on all 77 season pages — **M**
Detail under Persona C. Root cause read from the file: `season_entrants` stores
`entrant_id`, `chassis_ids`, `engine_ids`, `tyre_ids` and no display names. Related:
`DA-11` (#206) is the same leak in the constructors' standings, now visible to readers.
*Evidence: drove the site, queried the database, screenshots `entered.png`, `entered1976.png`. **Defect.***

### `UR-16` — The search box cannot find any page on the site — **S**
*Evidence: drove the site. **Defect.***

The palette says *"3,519 entities indexed"* and that is literally true: entities only.
Typed into it, each of these returns *"Nothing in the register answers to that."*:

`download` · `licence` · `sql` · `records` · `glossary` · `most wins` · `hamilton 2008` · `verstapen`

Five of those eight are destinations in the site's own nav or footer. `records` is in the
header. For my developer and teacher personas, whose first move is the search box, the
site's answer to "download" is that it has nothing.

Adding ~12 page records to the index is a fixture, not a feature. It also gives
`IA-21` (#152)'s dead-end state something to offer. `IX-22` (#153, one wrong letter) and
`IA-20` (#151, cannot represent a question) are the harder halves and can wait.

### `UR-17` — Nothing on the site can be exported — **S**
Detail under Persona E. No copy, no CSV, no download on the SQL console; no CSV among the
published formats. *Evidence: drove the site, read the release. **Defect.***

### `UR-19` — The season standings do not mark the figures the project knows are contested — **S**
Detail under Persona A3. Nine drivers and eleven constructors in the 2026 table are
affected by `discrepancies` row 29/34; the race page and the driver page both flag it; the
standings table does not. *Evidence: drove the site, queried the database. **Defect.***

### `UR-18` — 1.34 MB of Commons photographs share the critical path with the database — **S**
Detail under Persona D3. *Evidence: drove the site, throttled. **Defect.*** Rides with
`VD-23` (#130).

### `UR-20` — `ENTRIES 0` on a race that has not been run — **S**
`/races/2026/15`, app only; the prerendered page correctly says *Scheduled — not yet run*
and shows no such tile. The site's own convention makes `0` a positive claim.
*Evidence: drove the site. **Defect.***

### `UR-22` — The current grid, with car numbers, is in the database and on no page — **S**
Detail under Persona C2. `season_entries` (23 rows, 2026) and `v_current_grid` are unused
by the front end; `car_number` appears on 0 of 3,545 pages.
*Evidence: queried the database, read the source, grepped the build. **Defect of omission.***

### `UR-23` — The most-searched page on the site publishes two different win totals in its search snippet — **S**
`dist/drivers/hamilton/index.html`, `meta description`:

> *"…7 world titles, **106 wins**, 207 podiums and 104 poles. Record holder for wins (**105** at end-2025) and poles (104)."*

Both figures are defensible and the site explains the difference at length elsewhere; a
300-character snippet has no room for the explanation, and this is the one page where the
snippet is most likely to be seen. I scanned 400 driver descriptions: **Hamilton is the
only one affected**, which makes it a one-string fix on the highest-traffic page.
Since `PD-36` (#400) settled that the *image* stays generic, the description is the only
lever left on the unfurl, and it should be right.
*Evidence: read the built HTML. **Defect**, small.*

### `UR-25` — The release body is 24 internal PR titles — **S**
*Evidence: read the release. **Preference, not defect.*** An evaluator's first impression
of cadence and seriousness; `AF-xx`/`VD-xx` titles read as a private workshop. Suppress the
auto-generated section or fold it under a `<details>`.

---

## What is genuinely good — do not disturb it while fixing the rest

Named specifically, because several of these are load-bearing and a tidying pass could
damage them.

- **The cold-load handover.** Tap a link at 3 s and you get one download, the right
  destination, and a pinned bar naming the page you are waiting for, with a byte counter.
  Measured, not inferred. `UR-03`/`UR-04` landed properly; put an assertion on it.
- **`/seasons/2026`.** Leads, gap, who can still win it, points remaining, and the
  self-limiting sentence about ties. The best current-season page I have seen anywhere,
  and it is correct in the prerendered half too.
- **`/records`.** Every row derived, with its rule, its exclusions, its tie-holders and an
  ISO `as_of`. This turned the weakest page into a citable one.
- **`/races/1970/1` and the Gasly/Monaco chain.** A disagreement recorded, traced to a
  single 10-second penalty at one race, explained on the race page, the driver page and the
  quality page, and left open. Nothing else in this space does this.
- **`source_registry` shipped inside the file.** Eighteen rows, each with licence,
  cadence, checkability and what the licence cost or bought. It answered my developer
  persona's hardest question without a web page, and it is what makes finding 3 measurable.
- **The joins.** Five-table join, right answer, first try, no nulls. The register ids are
  readable and the keys hold.
- **The release's `latest/download/` URLs** and the note that the site's Parquet copy is
  rebuilt every deploy. That is a thoughtful answer to a real scripting problem.
- **`/data`.** Honest, complete, well-written, and it explains the two-file ODbL split in
  three sentences a non-lawyer follows.

---

## What only real research can settle — ranked by what a wrong guess costs

`PD-Ø` (#261) is **decided yes** and has not started. Everything below assumes it does.

1. **Does anybody arrive, and where do they land?**
   Every ranking in this document, and every ranking on the board, assumes an arrival
   pattern nobody has observed. **Cost of a wrong guess: the whole backlog order.**
   *Measure first, and only this: turn on Cloudflare Web Analytics and submit the sitemap
   to Google Search Console. Free, cookieless, consistent with the privacy promise,
   one sitting.* Read two numbers after a fortnight: **arrivals by landing page**, and
   **impressions and queries in Search Console**. Those two separate *nobody arrives* from
   *people arrive and bounce*, and those have opposite treatments.
2. **Would a licence change unlock the audience with money?**
   Finding 3 rests on my reading of one developer's incentives. **Cost of a wrong guess: a
   licence decision taken for nobody, or an audience permanently closed.** Cheapest
   settlement: ask five people who use F1DB or Ergast, on the F1DB issue tracker or
   r/F1Technical, one question — *"would CC BY-SA on a Formula One database stop you
   building on it?"* An afternoon, no budget.
3. **Is the correction route used, and by whom?**
   The product's differentiator is being correctable, and the only route requires a GitHub
   account. **Cost of a wrong guess: `UR-05` is either the unlock or a page nobody opens.**
   Settlement: ship the `/about` page with an email address and count what arrives in a
   month. The count is the finding either way.
4. **Do readers understand that an em dash is not a zero, and that two figures can both be right?**
   Five conventions are load-bearing and none has been tested on a person. **Cost of a
   wrong guess: a large writing programme nobody needed, or a permanent quiet misreading.**
   Five people, an hour, a printout: show them `/drivers/hamilton`'s first screen (105
   above 106) and ask what it means.
5. **Would a Wikipedia editor accept this, and what would it take?**
   Answerable for free by asking three experienced editors on a talk page. **Cost of a
   wrong guess: chasing a compliance problem the project may not have.**
6. **Does anybody want the current grid, the form table or the weekend page?**
   My Persona C is the most speculative one here — I constructed her from the maintainer's
   own example, not from evidence in the product. **Cost of a wrong guess: a few sittings.**
   Settle it after item 1: if `/seasons/2026` and `/races/2026/*` dominate arrivals during
   a race weekend, build it; if they do not, do not.

---

## Backlog verdicts

### My prefix, and the item that gates the board

| ID | Verdict | Why |
|---|---|---|
| **#238 `UR-05`** — nothing says who publishes this | **keep · re-rank to *Now*, top three · size S** | Re-confirmed exactly: 0 occurrences of a person's name across 3,545 pages, no `mailto:`, no `/about`, no `FUNDING.yml`. Blocks four of seven personas and is the only thing standing between the product and a conversation with a customer. **Merge `SD-15` (#223) into it** — same page, same sitting. |
| **#239 `UR-07`** — the obvious standings query | **keep · re-size S → M · re-rank to *Now*** | Worse than filed. The naive query now returns 356 rows; **the documented rescue returns 46 for 23 drivers**, with two point totals and two spellings of one driver. Re-scope to three parts: (a) point the console examples and `/data` at `v_standings_final`; (b) print `sqlite_master.sql` in the schema browser (still unbuilt — `Sql.jsx:13` reads `pragma_table_info` only); (c) hand the rest to `DA-01` (#197). |
| **#261 `PD-Ø`** — measure something | **keep · *Now*, first · size S** | The 2026-09-20 decision is right and I endorse it from use. One amendment: of the four measurements listed, **do Cloudflare Web Analytics and Search Console first and read only two numbers** (arrivals by landing page; impressions by query). Download counts and answer-engine tracing are downstream of knowing whether anyone arrives. Keep the `decision` label — the loop cannot do dashboard work. |

### Issues my walkthroughs hit directly

| ID | Verdict |
|---|---|
| **#197 `DA-01`** standings has no key, `as_of` four meanings | **re-rank *Next* → *Now***. It is the cause of my finding 1, and its own text already predicted the 2026 mixing. Size stands (M, then a decision). |
| **#199 `DA-03`** "may I publish this row?" is not a query | **keep · *Next***. New evidence: `pit_stops`'s 22,506 rows (19 % of the file) carry `source='f1db'`, which matches none of the ten `source_patterns`, so the answer today is *unknown* for a fifth of the database. |
| **#200 `DA-04`** id stability | **re-size: split**. The `S` half — *publish the policy* — is what an evaluator needs and should ship alone, in the release notes and on `/data`. The `M` half (deterministic ordering) can wait for a downstream user who exists. |
| **#206 `DA-11`** `standings.engine_id` is F1DB's namespace | **re-rank up**. Not schema hygiene: it renders to readers as `Mercedes mercedes` / `Haas F1 Team ferrari` in the constructors' standings. |
| **#165 `PM-22`** `meta.database_name` | **re-rank up · S**. It is the first string the bulk-data audience reads, and it names a different project. |
| **#181 `CD-16`** README's first sentence | **re-rank up · S**. Same argument: the developer's front door defines the product by its own changelog. |
| **#223 `SD-15`** who runs this | **merge into #238**. |
| **#130 `VD-23`** three redirects per thumbnail | **re-rank up**. Now carries a number: 1,344 kB and 3 redirects each, in parallel with a 5,083 kB database on a 4 Mbps phone. Add the `width` mismatch (asks 600, gets 960). |
| **#412 `SD-23`** the feed entry is not durable | **keep · fold `UR-21` in**. The deeper problem is that the entries describe *releases*, not what moved in the data. |
| **#151 `IA-20`** + **#152 `IA-21`** search cannot represent a question / dead end | **merge into one, and put my `UR-16` first**: indexing the site's ~12 pages is the `S` that makes the dead end survivable. `IX-22` (#153, fuzzy matching) stays separate and `Next`. |
| **#432 `PD-38`** the current season's grid | **re-check, then close or re-scope**. `/seasons/2026` now does most of what it asked. What remains is the *homepage* (`UR-15`) and the *grid* (`UR-22`). |
| **#389 `SD-18`** never announced | **keep · unblock after #261**. It is the top of the funnel and everything in this report about readers is theoretical until it happens. |
| **#392 `SD-21`** answer engines | **keep · *Someday* until #261 reports**. |
| **#400 `PD-36`** per-page share cards | **declined correctly; do not re-propose.** I endorse option 3 from use: the unfurl's text is the lever, which is why `UR-23` is a text fix. |
| **#119 `PD-20`**, **#127 `PD-30`**, the track atlas, code splitting, the range-request VFS | **not re-proposed.** Examined and cleared. |

### Proposed new items (not filed — report only)

`UR-14` season entrant slugs · **M** — `UR-15` two homepages · **S/M** —
`UR-16` search indexes no pages · **S** — `UR-17` no export anywhere · **S** —
`UR-18` photographs on the critical path · **S** — `UR-19` contested standings unmarked · **S** —
`UR-20` `ENTRIES 0` · **S** — `UR-21` the feed reports releases · **S** (with #412) —
`UR-22` the grid exists and is unused · **S** — `UR-23` Hamilton's snippet · **S** —
`UR-24` a CC BY facts export · **decision, M if taken** — `UR-25` release body noise · **S** —
`UR-26` = the escalation of #239, not a separate item.

---

## A ranked top ten for the whole project

Ranked as my seven personas would rank it against the three stated goals — *one reliable
place*, *commercialise eventually*, *not dull*. Existing items keep their ID.

| # | Item | Size | Exists? | Why it is here |
|---|---|---|---|---|
| 1 | **`PD-Ø` (#261): turn on Cloudflare Analytics and Search Console; read arrivals and queries** | S | existing | Decided, unstarted, and every other rank on this list is a guess until it reports. |
| 2 | **`UR-05` (#238) + `SD-15` (#223): one `/about` page — a name, an editorial rule, a non-GitHub correction route, an email** | S | existing | Blocks the journalist, the editor, the teacher and anyone who might pay. There is currently no way to buy anything or ask anything. |
| 3 | **`UR-24`: decide the licence — a CC BY 4.0 facts artefact, or CC BY-SA in writing on `/data`** | ? / M | **new** | 2 % of rows impose share-alike on 100 % of the release, and the audience it excludes is the one with money. A decision, not a task. |
| 4 | **`UR-07` (#239) + `DA-01` (#197): make the current championship unambiguous in the file** | M | existing | The product's core claim is reliability; its central table hands a stranger two answers. Point at `v_standings_final` today; fix the grain next. |
| 5 | **`SD-18` (#389): tell somebody it exists** | M | existing | One download in five days against F1DB's ~1,800. Blocked only by 1 and 2, and it is the difference between a reference and a private archive. |
| 6 | **`UR-15`: one homepage** | S/M | **new** | The indexed front door has no current season on it, and is not the page readers see. Cheapest fix to "is this current?" and to "a bit dull". |
| 7 | **`UR-22` + `UR-20`: a weekend page — the grid with car numbers, the timetable, and no `ENTRIES 0`** | S–M | **new** | The data and the view already exist and no page shows them. This is the one item that directly answers "dull": a reason to visit on a Thursday. |
| 8 | **`UR-17`: a copy button and a CSV export** | S | **new** | Every persona's last step is "get it out". It is missing from the surface built for that, and it unlocks the teacher. |
| 9 | **`UR-14`: give `season_entrants` display names** | M | **new** | Four of six columns on 77 season pages are machine ids. Nothing else on the site looks unfinished in this way. |
| 10 | **`UR-16`: index the site's own pages in the search palette** | S | **new** | The search box cannot find "download", "licence" or "records". A fixture, half a sitting. |

Just below the line, and each an `S`: `PM-22` (#165), `CD-16` (#181), `UR-19`, `UR-23`,
`UR-18`/`VD-23` (#130), and the `S` half of `DA-04` (#200).

**The shape of that list:** eight of the ten are about *being found, being trusted, and
being usable by someone who is not the maintainer*. None is about the data being wrong,
because — outside the standings grain — I could not make it be wrong. The database is in
better shape than the things around it, which is the opposite of the usual problem and
worth saying plainly.

---

## What I did not examine

- **Any real user.** Fifth critique in a row to say so. Everything here about demand,
  preference, patience and willingness to pay is an argument from structure in a persona's
  clothes.
- **Search visibility.** I could not observe where lapledger.org ranks; scripted engine
  queries are refused. So every "arrives from a search result" persona is simulated from
  the deep URL onward, not from the result backward — and that is the half that decides
  whether the persona exists at all. Search Console owns it (#261).
- **Assistive technology.** I ran a phone viewport, throttled links and no-JS reads. I did
  not run a screen reader or keyboard-only navigation; the accessibility critic owns that.
  One thing I noticed in passing and am handing over: on `/drivers/antonelli` the livery
  mark's accessible text reads *"BLACK AND SILVERSILVER · PETRONAS GREEN"* — visually it is
  correctly separated (`antonelli-top.png`), so this is a text-node concatenation, not a
  layout bug.
- **The deployed site.** Everything was measured against the local build at `:4179` from
  the same commit. Edge caching, real latency and Cloudflare's own behaviour will differ.
- **Warm-cache and repeat visits**, beyond noticing they are fast.
- **The Parquet bundle's contents**, the JSON exports, and `f1-geometry.db`.
- **Constructor, cars, eras, glossary and circuit-register pages** in any depth. I drove
  home, `/seasons/2026`, `/seasons/1976`, `/records`, `/changes`, `/data`, `/data/sql`,
  `/data/quality`, `/races/2026/14`, `/races/2026/15`, `/races/2026/6`, `/races/1970/1`,
  `/drivers/hamilton`, `/drivers/antonelli`, `/drivers/gasly`, and the search palette.
- **The truth of any fact in the database**, except where two of the project's own
  surfaces disagree. I checked one suspicion — that the 2026 calendar had Saturday races
  in error — against the data and withdrew it: Bahrain and Jeddah 2024 and Las Vegas are
  genuinely Saturday races, and the pattern holds.
- **Whether `UR-14`, `UR-15` or `UR-16` are regressions or have always been there.** I did
  not check the history; all are v2.24 behaviour, observed today.
