# User research walkthrough — 2026-09-11

**Critic:** `user-research-simulator`, first live run.
**Subject:** Lap Ledger at v2.21 on `main`, against the built site served at `localhost:4180`, with two checks repeated against the deployed `lapledger.org`.
**Brief:** `.claude/CRITIQUE-BRIEF.md`. **Prior read in full:** the three critiques of 2026-09-10 (product, IA, content), the 2026-09-11 code review, the 2026-09-11 product critique — whose "four questions" section I was asked to answer from use — and `docs/BACKLOG.md`.

---

## These findings are simulated. No user was involved.

**This is not user research.** Nobody was asked anything. I constructed six personas from what the product contains and who it addresses, gave each of them tasks with a right answer, and walked those tasks myself in a real browser while holding to what the persona would plausibly know and do. Everything below is a *model reasoning about a plausible reader*, and I am systematically wrong in the ways real research exists to catch: I read faster than people, I do not get bored, I arrive with the correct mental model because I have read the schema, and I do not misread a table because I am on a train.

So, concretely:

- **No number here is a measurement of human behaviour.** Where I count, I count *my own attempts*, and I say so.
- **There are no quotations.** Nothing in this document is attributed to a person, even illustratively.
- Timings, pixel positions and row counts *are* real measurements — of the product, in Chromium, not of anybody using it.
- The last section lists what only real research can settle, ranked by what a wrong guess would cost. For the four questions the author is deciding now, that list is the honest part of my answer.

**Status of the claims.** Every finding carries an evidence tag: `drove the site` (Playwright against the built site, viewport and throttling stated), `queried the database` (the committed `f1.db`/`f1-geometry.db`), `read the source`, `read the docs`, `inference`. The repository was not modified; all scratch files and screenshots are under the session scratchpad. Findings are filed `UR-01` onward.

**Re-checked by the author before filing, all exact:** 65 end-of-season `standings` rows carry a `position` and no `position_text`, all in 2025 and 2026, and `Season.jsx:278/:303` render `position_text`; 591 of 3,266 driver-seasons have no classified finish, so `SUM(finish_position = 1)` is NULL for them (`Driver.jsx:42`); `Records.jsx:145` still reads "Counted as a grid position of 1"; `data/current.py:69` holds "Bahrain (hosted at Sepang, Malaysia)" in a field no page shows. The throttled timings and the deployed-site download measurement were not re-run.

**What I walked.** Six personas, 22 tasks. By my own judgement of my own attempts — not a completion rate, and not transferable to people — 7 of the 22 reached the right answer without help, 6 ended in an answer that was wrong or that the site itself contradicts elsewhere, and the rest ended in a partial answer or a dead end.

---

## The three that matter

### 1. The app tells you the reigning world champion has no championship position (`UR-01`)

On `/seasons/2025`, the prerendered page shows a correct championship table — `1 Lando Norris 423`, `2 Max Verstappen 421`. Eleven seconds later on a 4 Mbps connection the app replaces it with **"Final drivers' standings"** in which **all 21 drivers and all 10 constructors show an em dash in the Pos column**, under a footer reading *"A driver with points and no position was excluded from the classification: the points stand, the position does not."*

On `/drivers/norris`, the stat strip reads `TITLES 1 (2025)` and the season table three hundred pixels below reads `2025 · McLaren · … · CHAMPIONSHIP —`.

On `/seasons/2026`, 12 of 23 drivers are dashed, including Charles Leclerc, who is fifth.

38 pages: 2 season pages, 24 driver pages, 12 constructor pages — all of them about the current and previous season, which is the slice a fan or a journalist actually opens. The static half is right and the app is wrong, which inverts `PD-02`'s usual direction and is the sharpest instance of it anyone has found. Size **S**.

### 2. Following any link during the first eleven seconds restarts the 4.5 MB download (`UR-03`)

Deep arrival is the dominant pattern; the prerendered page is fully linked, which is right. But a reader who uses one of those links before the app takes over throws away everything downloaded so far. Measured against **the deployed site**, throttled to 4 Mbps/70 ms on a 390×844 phone: land on `/races/1976/9`, tap the winner's name at 3 s, and `f1.db.gz` is requested a second time in full (two `200`s, both `cf-cache-status: HIT` at the edge, neither reusing the aborted first). App ready at **14.1 s** instead of ~11.4 s, and it compounds with every further tap.

Meanwhile the excellent boot copy that explains the wait — the one `CD-17` singles out as the best state on the site — renders at **y = 2,655 px** on that phone, three screens below the 2,302 px prerendered block. The reader has no signal that anything is loading, no signal that clicking costs them, and the one sentence that would tell them is below the fold by a factor of three (`UR-04`). Size **M** for the first, **S** for the second.

### 3. Nothing on 3,515 pages says who publishes this or how to tell them they are wrong (`UR-05`)

My Wikipedia-editor persona verified a contested fact beautifully — the 1970 South African Grand Prix fastest lap, with the disagreement stated in both renderers — and then could not use it. There is no About page, no author, no publisher, no contact, no corrections route, and no link to the repository: I grepped all 3,515 built pages for *about*, *contact*, *maintained*, *compiled by*, *editorial*, *corrections*, *report an error* and `github.com/Alex`, and the only hits are incidental prose. The header and footer carry fourteen links, none of them about the publisher.

A Wikipedia editor assessing WP:RS has to answer "who is responsible for this, and what is its correction policy". Lap Ledger answers neither, and combined with `PD-14` — the repository being private, which I re-confirmed today — the verifiability claim is asking to be taken on trust by exactly the audience whose whole discipline is not doing that. Size **S** for a page; the private-repository half is `PD-14`'s decision.

---

## The personas

Derived from the brief's six named audiences. Each has what they want, what they already know, what they will not do, how they arrive, and what "done" means.

| | Arrives | Knows | Will not | Done when |
|---|---|---|---|---|
| **A. The fan settling an argument** | phone, from a group chat or a search; homepage or `/records` | the sport, not the site | read a methodology page, scroll past the first answer | has a number to send back |
| **B. The journalist checking a figure** | desktop, on deadline, from a search result | the sport; sceptical of any site | publish a figure they cannot date or attribute | has the figure, the date it is true to, and something to cite |
| **C. The data scientist** | terminal, may never open the site | SQL, Parquet, licences | click through a site to find a download | the file is on disk and they know what is in it |
| **D. The developer evaluating** | desktop, from a link or the repo | schemas, APIs, licensing risk | build on something they cannot read the source of | knows the shape, the terms, the cadence, and who maintains it |
| **E. The Wikipedia editor** | desktop, mid-edit | WP:RS, citation templates | cite a source with no named publisher | has a `{{cite web}}` they can defend at AfD |
| **F. Arriving cold on a deep page** | 4 Mbps phone, from a search result, mid-page | nothing about this site at all | wait, or read the homepage first | got the one fact and left |

I did not build a persona to prove a point, and one of them — E — got the hardest possible task right, twice. Where it works, I say so.

---

## Persona A — the fan settling an argument

*Phone, 390×844, mobile emulation. Four tasks.*

**A1. "Who has the most pole positions?"** Homepage → "Popular ways in" → Records → the published table. Answer: Hamilton, 104. **Correct**, two taps, no hesitation. The homepage band is doing real work here.

**A2. "How many Grands Prix has Hamilton won?"** Same route. `/records` says **105**, tagged `MEDIUM`, `TRUE AS OF end of 2025`.

That is where this persona stops: the number is bold, it is second in a 30-row table, and it is at **y = 940 px** — the second screen. The sentence that supersedes it — *"Where one of these disagrees with a leaderboard below, the leaderboard is the newer of the two"* — is at **y = 2,862 px**, and the derived **106** is at **y = 3,055 px**. So the site tells you it may be stale about 1,900 px after telling you the figure, on a page 10,675 px tall.

This is `PD-03`, and I am not re-filing it. What the walkthrough adds is a **placement** fix that is independent of the derivation work and much cheaper: move that one sentence *above* the published table. `UR-09`, **S**.

**A3. "Norris won the 2025 title — where did everyone else finish?"** Search → 2025 season → scroll. The static page, which is what I saw for the first eleven seconds, was correct. The app's table had an em dash in every position cell. **Wrong, and confidently so.** `UR-01`. This persona would have concluded the site is broken, and would have been right.

**A4. "Who has won most at Monaco?"** `/circuits/monaco` → "Most wins here" → Senna 6, Graham Hill 5, Schumacher 5. **Correct**, fast, and better presented than most places you could ask. Nothing to fix.

---

## Persona B — the journalist checking a figure

*Desktop 1280×900, warm cache after the first load.*

**B1. "How many Grands Prix did Chris Amon start?"** `/drivers/amon`. The page offers three answers and reconciles none of them:

- the lede (from `drivers.notes`) says **"eleven podiums across 96 starts"**;
- the stat strip says **ENTRIES 108**;
- the "On the record" block says **Starts (stored) —**, and the site's own footer, on that page, defines an em dash as *nobody has established that figure*;
- the entries table lists 108 rows.

Both 96 and 108 are defensible — 96 starts, 108 entries — and the difference is exactly the distinction the page's own source note leans on: *"an entry is not a start, and telling them apart needs a reason for each non-start that no source here supplies."* But that sentence is at the foot of a 7,000 px page, the two numbers are never shown together, and one of them is inside a sentence the reader reads as prose rather than as data. A journalist filing "Amon started 108 races" would be wrong, and nothing on the page stops them. `UR-12`, **S**. (`CD-09` names *entry vs start* as an undefined term; this is the page where the cost shows.)

**B2. "What is this current to, and how do I cite it?"** The app footer carries `Database v2.21 · Built 2026-09-09 · Size 20.0 MB · This load: downloaded`. That is good, and it is the single most journalist-useful element on the site.

It is also **absent from every prerendered page**. `grep` for `v2.21`, `Built` or `2026-09-09` in `dist/drivers/hamilton/index.html` returns nothing. So for the first eleven seconds of a cold visit, for every no-JS reader, and for every crawler, the figures have no currency statement at all. A journalist who copies a number off the page Google served has copied an undated figure from an unnamed publisher. `UR-06`, **S** — and it is the cheapest possible down-payment on `PD-10`/`CD-08`.

**B3. "How big is Antonelli's lead after Monza?"** `/seasons/2026`. Points are right (267 to 201). The section is headed **"Final drivers' standings"** for a season 13 rounds of 23 into itself, and twelve of the rows have no position. Partially wrong, and the wrong half is the half a headline would use. `UR-01`.

---

## Persona C — the data scientist who never opens the site

*Terminal. Three tasks. This persona is the one the README courts hardest.*

**C1. "Get the data."** There is no download link on the homepage, in the nav, or in the footer. `f1.db` and `f1-geometry.db` are named and linked on exactly one page — `/reference/sql`, whose nav label is "Reference" and whose page title is "SQL console". A bulk-data user has no reason to click either word. `f1-parquet.zip` is served and returns 200, and is **linked from 0 of 3,515 pages**. `f1_database.json` is 404 on the site and is a private release asset, so it exists publicly nowhere. This is `PD-11` + `IA-15` + `PD-14`, confirmed from the outside; `IA-15`'s landed fix is good and is on the wrong page.

The Parquet bundle unzips to **41 `.parquet` files and nothing else** — no licence, no attribution, no version, no note that the five absent tables are the five empty ones. I checked: the five missing are exactly `circuit_geometry`, `laps`, `stints`, `race_timing`, `race_control_messages`, so the bundle is complete in substance and a reader cannot know that. `PM-23`, confirmed.

**C2. "What is in it?"** The first thing this persona reads is `meta`. It says:

> *"Partial by design for: full driver register (every race winner, pole-sitter and fastest-lap setter, not all ~780 starters); full finishing order; **qualifying, grid and lap-by-lap data (not held)**"*

against 862 drivers, 27,482 classifications and **26,997 qualifying rows** in the same file. `meta.database_name` still reads *"F1 Verified Facts Project Memory Database"*. This is `PD-24`/`CR-08`/`PM-22` and I add only the persona's view: this is the *first* string this audience reads, it is inside the artefact rather than in a README they might skip, and it tells them the database lacks the thing they came for.

**C3. "Give me the 2026 drivers' championship."** The obvious query —

```sql
select * from standings where year=2026 and table_type='drivers' order by position
```

— returns **333 rows**, with 13 different drivers in position 1. Nothing in the result warns them. The rescue exists and is genuinely good: the `CREATE TABLE` comments survive into the shipped file, so `.schema standings` explains `after_round IS NULL` in four sentences. But a person who runs `SELECT *` before running `.schema` has already got a wrong answer, and this is the query every tutorial, notebook and LLM writes first. `UR-07`, **S** — see below for the fix, which belongs with `CR-02`.

---

## Persona D — the developer evaluating whether to build on it

*Desktop. Four tasks. This is the persona for whom the product is closest to working.*

**D1. "Ask it something."** The SQL console is excellent and I will not pretend otherwise: my queries returned in **13–38 ms**, the six examples teach the schema, the refusal message for a write is the best microcopy in the project, and the "Nothing you type can break anything" line answers the question a stranger actually has. **Done, happily.**

**D2. "Share the query."** Impossible. After running four different statements the URL was still `/reference/sql`. `IA-07`, confirmed by driving rather than by grep, and it is the difference between a demo and a citable artefact.

**D3. "Understand the schema."** The console's schema browser lists 84 objects with **column names only** — `id, year, table_type, position, position_text, entity, entity_id, engine_id, team, points, after_round, as_of, confidence, source` for `standings`. The comment that would have prevented C3's wrong answer is in `schema.sql` (private repo) and in the shipped file's `sqlite_master`, and is the one thing the surface built to teach the schema does not show. Second half of `UR-07`.

`select * from laps limit 5` returns **"The statement ran and matched nothing."** A developer reads that as a bug in their own query. `CD-05` predicted this exactly and wrote the fix; the walkthrough confirms it is the moment that matters.

**D4. "Read the terms, the cadence, and who runs it."** `/reference/sources` is very good on terms and cadence — `PD` and `CD` are both right that the *"What a licence cost, or bought"* framing is the best writing in the project. Who runs it: nothing (`UR-05`). Whether the source can be read: no (`PD-14`).

One small thing that undermines the console's authority for this persona: every integer is put through `text() → number() → toLocaleString`, so a year renders as **"1,950"** and **"2,026"**, and a row id as **"31,763"**. On a page whose job is to show a developer what the data looks like, the data does not look like itself. `web/src/pages/Sql.jsx:189` hands results to `DataTable`, whose default cell is `format.js:number`. `UR-08`, **S**.

---

## Persona E — the Wikipedia editor

*Desktop. Three tasks. One of these is the best thing that happened in this run.*

**E1. "Who set the fastest lap in the 1970 South African Grand Prix, and is it disputed?"** `/races/1970/1`. The page names Brabham, and then — **in the prerendered HTML as well as the app** — states the disagreement, both readings, the reasoning, the reference total that decides it, why that is a reason and not a proof, and the source URL, closing with *"Recorded rather than resolved, and open for somebody to settle."*

This is the product doing the thing nothing else in this space does, at the moment the reader needs it, in both renderers. `PD-04` landed well. **Do not touch it.**

**E2. "Cite it."** Fails. There is no publisher, no author, no About page, no date on the static page, no citation block, and no correction route (`UR-05`, `UR-06`). An editor's realistic next move is to follow the Wikipedia URL in the disagreement block and cite *that* instead — which means this project did the work and the upstream gets the citation.

**E3. "Check whether another claim is contested."** `/reference/quality` is where this persona goes, and it opens with:

> *"…tools/f1db_fetch.py now reads the fastest-lap results beside race-results.yml and writes harvest/fastest_laps.txt (1,161 rows, 1950-2026); build.py fills race_entries.fastest_lap ONLY where the pole harvest is silent…"*

and contains three entries beginning "CLOSED in v2.15/v2.18" and a stale `27,555`. `PD-05`/`CD-06`/`CD-15`, confirmed. The persona note is that this is *the trust page*, reached from the footer link literally labelled "How far to trust it", and it reads as a maintainer's notebook.

---

## Persona F — arriving cold on a deep page

*390×844 mobile emulation, CDP-throttled to 4 Mbps / 70 ms latency. Five tasks. Measurements against the local preview unless stated.*

Static paint **113–162 ms**. App takeover **11,396–11,530 ms** across three routes — consistent with the 11.4 s and 11.9 s the two product critiques measured, so nothing has regressed.

**F1. `/drivers/amon` — "did he ever win?"** The static page answers immediately: `Wins 0`. Good. It also shows `Entries —`, `Starts —`, `Career points —`, and `Born —`; the app then shows `ENTRIES 108`. On a phone, the first screen of that static page is `Nationality / New Zealand / Born / —`: the second fact a search arrival sees is an em dash. `PD-02` and `CD-04`, confirmed from the seat that matters most.

**F2. `/races/1976/9` — "who won the 1976 British Grand Prix?"** Static, complete and correct: Lauda, with Hunt shown `DSQ — Received outside assistance`. This is the site's best-served arrival. The only gap is `CD-03`: no sentence, so the page opens with a field list.

**F3. Tapping a link at 3 s.** Restarts the download; 14.1 s on production. `UR-03`.

**F4. `/seasons/2025`.** Static correct, app wrong (`UR-01`). Also worth naming for the current season: static `/seasons/2026` opens with **`Drivers' champion —`, `Team —`, `Points —`, `Runner-up — — —`, `Margin —`** — five em dashes and a triple em dash as the first thing on the most time-sensitive page on the site, while the database holds the running standings. `UR-13`, **S**.

**F5. `/circuits/atlas`.** 618 characters of chrome and *"The drawings need JavaScript."* — for the whole 11.9 s window and permanently without JS. `PD-22`, confirmed, including with JavaScript disabled.

---

## Findings

### `UR-01` — The app shows every 2025 and 2026 championship position as an em dash, under a footer saying that means the driver was excluded — **S**
*Evidence: drove the site, queried the database, read the source. **Defect.***

Observed on `/seasons/2025` (21 of 21 drivers, 10 of 10 constructors dashed), `/seasons/2026` (12 of 23, 6 of 11), `/drivers/norris` (2025 championship column `—` beside `TITLES 1 · 2025`), and by query on 24 driver and 12 constructor pages.

Root cause, read from the source: `Season.jsx:278` and `:303` render the column `position_text`; `Driver.jsx:246` and `Constructor.jsx:232` render `championship_text`, also `position_text`. **65 of the 2,436 `after_round IS NULL` rows carry a `position` and a NULL `position_text`** — every hand-maintained formula1.com row for 2025 and 2026. `lib/standings.js`'s `fold()` is careful to carry `position` and `team` across from whichever source has them, and does not carry `position_text`:

```js
position: missing(current.position) ? other.position : current.position,
team:     missing(current.team)     ? other.team     : current.team,
engine_id: missing(current.engine_id) ? other.engine_id : current.engine_id,
```

For 2025 there is only one source and it has no `position_text` at all, so `fold` is never even reached.

This is the same shape as the bug the `PM-05` front-end review caught — a column selected by name that quietly resolves to nothing — and the same shape as `CD-01`: a blank that the site's own footer converts into a positive false claim. Here the false claim is *"this driver was excluded from the championship"*, made about the reigning champion.

**Do:** render `position_text ?? position`, or carry `position_text` through `fold`. Then add a smoke assertion that the 2025 season page's top row reads `1`, read out of the database the way `smoke.mjs` already reads its other expectations — this is precisely the class of regression that test exists for and structurally cannot see today, because it asserts the app against the database only for pages nobody changed.

### `UR-02` — 591 driver-seasons print an em dash where the true figure is zero, contradicting the stat strip on the same page — **S**
*Evidence: drove the site, queried the database, read the source. **Defect.***

`/drivers/beppe-gabbiani`: the strip reads `WINS 0 · PODIUMS 0`; the season table 40 px below reads `1981 Osella 15 — — 0 0 — — 0`. `/drivers/bruce-halford`: `1959` and `1956` dashed, `1957` and `1960` zero, same driver, same career, same column.

Cause: `Driver.jsx:41-42`, `SUM(e.finish_position = 1)`. In SQLite the comparison is NULL when `finish_position` is NULL, so a season in which the driver was never classified sums to NULL, which `cell()` renders as the em dash. The career query at `Driver.jsx:26` has the identical expression, but `Driver.jsx:173` applies `?? 0`, so the two halves of one page disagree by construction.

**591 of 3,266 driver-seasons (18%) are affected, on 412 of 862 driver pages (48%).** Those are overwhelmingly the pre-1970 privateers — the half of the register the product critique correctly identifies as the part most its own.

**Do:** `COALESCE(SUM(...), 0)` in `BY_SEASON`. The `BEST` and `CHAMPIONSHIP` dashes on the same row are correct and should stay: nobody established a best finish, and there was no championship classification. That contrast is the argument for fixing this one — it is the column where the blank is wrong sitting beside two where it is right.

### `UR-03` — Following a link during the first-load window throws away the download and starts again — **M, or a decision**
*Evidence: drove the site, against localhost and against `lapledger.org`. **Defect**, though the right fix is a judgement call.*

Measured on the deployed site, 4 Mbps / 70 ms, 390×844: land on `/races/1976/9`, tap the winner at 3,000 ms, two full `f1.db.gz` responses, app ready at **14,126 ms**. The aborted response is not reused by the browser cache even though the file is served `public, max-age=31536000, immutable` with a `cf-cache-status: HIT` — the edge cache does not help a client that threw the bytes away.

Why it matters: deep arrival is the dominant pattern and the prerendered page is fully linked, which is correct and is `PD-01`'s whole point. The consequence nobody has recorded is that for the first eleven seconds, *every link on the page is a trap*, and the reader has no way to know.

**Do**, cheapest first and each independently shippable:

1. **Say what is happening where it can be read** — `UR-04`.
2. **Intercept in-page links once the worker is running but the database is not ready**, so a tap becomes a client-side route change that waits, rather than a document navigation that restarts. The app already owns the router; this is a capture-phase listener on `#prerendered`.
3. Only if 1 and 2 are not enough: a service worker, which is a real increase in surface area and should not be reached for first.

Note what this does *not* argue: it is not a case against the whole-download architecture. Both product critiques reopened that and cleared it, and so do I — the second page load in every session I ran was instant. It is a case that the eleven seconds need one behaviour they currently lack.

### `UR-04` — The sentence explaining the wait is three screens below the fold — **S**
*Evidence: drove the site. **Defect of placement.***

On `/drivers/amon` at 390×844, 4 Mbps, at t = 5 s: the prerendered block is **2,302 px** tall, `#root` begins at **y = 2,302**, and the node containing *"Downloading the database"* is at **y = 2,655** — 3.1 screens down. Viewport height 844.

`Boot.jsx`'s four-phase copy is, as `CD-17` says, excellent. It is also invisible to every reader who arrives on a deep page, which is most of them. The reader sees a complete-looking page with `Entries —` on it and no reason to wait.

**Do:** a single slim line pinned at the top of the prerendered block while the app is loading — *"Loading the full record — the figures below will fill in. Stay on this page."* — removed when `#prerendered` is. One element in `main.jsx`, and it is the sentence that makes `UR-03` survivable even before `UR-03` is fixed.

### `UR-05` — Nothing says who publishes this, or how to report an error — **S**
*Evidence: drove the site, read the built HTML. **Defect**, and partly a positioning decision.*

Grepped all 3,515 built pages: no About, no contact, no named publisher, no editorial policy, no corrections route, no link to the repository. Header and footer carry 14 links; the only outbound ones are F1DB and OpenStreetMap.

Who this blocks: the Wikipedia editor (cannot satisfy WP:RS), the journalist (cannot attribute), the developer (cannot judge whether to depend on it), and anyone who spots an error — which for a project whose differentiator is being correctable is the worst of the four. Note that `discrepancies` closing 44 of 45 rows is an *audit trail*, and an audit trail with no way to file into it is a closed book.

**Do:** one page, `/about` or a block on `/data` when it exists, carrying: who compiles it, what the editorial rule is (the rule already exists and is written well — *refuse rather than repair*, *record the disagreement*), how to report an error, and what happens when you do. `PD-14` decides whether that page can also say "the source is here"; this page is worth writing either way.

### `UR-06` — No prerendered page carries the version or the build date — **S**
*Evidence: drove the site, read the built HTML. **Defect.***

The app footer has `Database v2.21 · Built 2026-09-09`. `dist/drivers/hamilton/index.html` contains none of those strings. So the figures a search arrival, a no-JS reader or a crawler sees are undated.

`BUILT` being a deliberate constant is exactly what makes this cheap and valuable — the build date is a *stable* citation anchor, which is an advantage over every competitor, and it is currently withheld from the half of the site that gets cited.

**Do:** emit the same three facts into the static footer from `prerender.js`, from `meta` rather than from a literal. It is the smallest possible piece of `PD-10`/`CD-08` and it can ship on its own.

### `UR-07` — The obvious bulk query returns a wrong answer, and the console hides the comment that prevents it — **S**
*Evidence: drove the site, queried the database, read the schema. **Defect.***

`select * from standings where year=2026 and table_type='drivers'` returns **333 rows for 23 drivers**, 13 of them at position 1, in the shipped `f1.db` and in the site's own console. `schema.sql` explains it in a good comment that survives into the file's `sqlite_master` — so `.schema standings` rescues a careful reader — but the console's schema browser (`Sql.jsx:229`) prints the column list from `pragma_table_info` and nothing else.

This is the reader-facing face of `CR-02`, which is about the compat export. The exporter fix is `CR-02`'s; two things belong here:

**Do:** (a) print the table's `sqlite_master` SQL, comments and all, when a table is opened in the schema browser — the text is already in the browser's copy of the database and it is the single highest-value thing that panel could show; (b) add a worked example to the console's six: *"The 2026 championship as it stands"*, with the `after_round IS NULL` clause visible. That is one string and it teaches the trap at the moment it is met, which is the pattern `./f1 licences` already gets right.

### `UR-08` — The SQL console renders years as "2,026" — **S**
*Evidence: drove the site, read the source. **Defect, small.***

`select year, count(*) from races group by year` returns `1,950 | 7`. Ids read `31,763`. `Sql.jsx:189` hands results to `DataTable`, whose default cell is `cell()` → `text()` → `number()` → `toLocaleString('en-GB')` (`components/DataTable.jsx:195`, `lib/format.js:31`). Correct everywhere else on the site; wrong on the one surface whose job is to show data as data.

**Do:** a `raw` flag on `DataTable` used by the console only.

### `UR-09` — On `/records`, the caveat sits 1,900 px below the figure it caveats — **S**
*Evidence: drove the site. **Defect of placement.** Rides with `PD-03`, shippable before it.*

Phone, 390×844: `Most Grand Prix wins · Lewis Hamilton · 105` at **y = 940**; *"Where one of these disagrees with a leaderboard below, the leaderboard is the newer of the two"* at **y = 2,862**; the derived `106` at **y = 3,055**.

`PD-03` is right that the fix is derivation. But the sentence already exists and is already true, and moving it above the published table costs one line and stops the misreading today. `IA-16`'s point stands and sharpens: if the authored block survives, the caveat goes above it, not below.

### `UR-10` — The derived pole leaderboard's caption states the rule `PM-05` abolished — **S**
*Evidence: drove the site, read the source. **Defect.***

`Records.jsx:145`: `note="Counted as a grid position of 1 in the race records."` The query directly above it (`Records.jsx:31`) is `WHERE e.pole = 1`. `PM-05`'s entire finding was that grid 1 and pole are different facts that differ in three races.

This is the only place in the front end still asserting the old rule — I grepped — so it is one string. It matters because it is the caption on the site's most-read leaderboard, and because a reader who has read `PM-05`'s own record would conclude the page was not updated with the data.

### `UR-11` — "2026 Bahrain Grand Prix — Sepang International Circuit, Malaysia", with no explanation anywhere — **S**
*Evidence: drove the site, read the source data. **Defect of transmission.***

`/races/2026/16` and `/seasons/2026` both render a Bahrain Grand Prix at a Malaysian circuit with no note. `data/current.py:69` holds the explanation and throws it away:

```python
(16, "Bahrain Grand Prix", "Bahrain (hosted at Sepang, Malaysia)", "Sepang", "sepang", "02-04 Oct 2026", 0, "scheduled"),
```

The third field — the one that would have told the reader this is deliberate — is not the one the page displays. Every persona who saw this read it as a data error; it is the opposite, a declared oddity, and `CLAUDE.md`'s own rule is that *every deviation is declared, with a reason*. The declaration exists and does not reach the reader.

**Do:** carry that string to the race page and the calendar row as a note. And check whether any other authored field is being discarded the same way — this is one instance found by accident in one walkthrough, which is a bad way to find the others.

### `UR-12` — Entries, starts and the lede give three answers on the page that raises the question — **S**
*Evidence: drove the site, queried the database. **Defect.***

`/drivers/amon`: lede "96 starts", strip `ENTRIES 108`, `Starts (stored) —`, static page `Entries —`. All four are separately defensible; together they are unusable, and the reconciling sentence is 7,000 px down.

**Do:** this is `PD-15`/`PD-17`'s territory — derive `Starts` as `finish_position IS NOT NULL` plus a definition — but the walkthrough adds one cheap thing that does not wait for either: where `notes` states a career figure that the page also computes, the two must be shown adjacent or the prose figure must go. `CD-02` is already editing these 244 strings; this is a check to apply while in there.

### `UR-13` — The current season's static page opens with five em dashes — **S**
*Evidence: drove the site. **Defect.***

`/seasons/2026` prerendered: `Drivers' champion —`, `Team —`, `Points —`, `Runner-up — — —`, `Margin —`, then the calendar. `Runner-up — — —` in particular reads as a rendering fault.

For an in-progress season the page should lead with what is known: who leads, by how much, after how many rounds. The database holds all of it. This is `PD-02`'s family, but it is the one instance where the *static* page is not merely different from the app, it is close to content-free at the top, on the page most likely to be searched for in September.

---

## Confirmed from use — no new IDs, but now with a measurement

- **`IA-14`** asked for a device measurement before sizing. At 390 px, mobile emulation, the nav items sit at x = 22, 97, 156, 222, 323, **390 (Cars)**, **439 (Records)**, **512 (Reference)**. Three of eight top-level destinations are off-screen behind a hidden scrollbar with no affordance. The estimate from CSS was right. Size it as filed.
- **`IA-05`** — driven, not grepped: "Ferrari 312" and "Lotus 72" both return *"Nothing in the register answers to that."* "MP4/4" works. The empty state also offers no way forward (`CD-17`).
- **`PD-20`** — confirmed: zero `og:image` / `twitter:image` on the pages I checked; `twitter:card` is `summary`. Four of my six personas *arrive* through a shared link or a search result, which makes this the highest-leverage cosmetic on the site, and it is the honest answer to "where would looking nicer change what someone does".
- **`PD-21`** — confirmed by clicking: `/circuits/suzuka` says *"Open it in the atlas…"*, the link is `/circuits/atlas`, and it lands on Spa. Picking a cell in the wall works and changes nothing in the URL.
- **`PD-22`**, **`CD-05`**, **`PD-24`/`CR-08`**, **`PD-05`/`CD-06`/`CD-15`**, **`PM-23`**, **`PD-11`**, **`PD-14`**, **`IA-07`** — all reproduced as filed. None has got worse; none has got better.
- **`PD-19`, with a correction.** On the build I drove, the MP4/4 photograph is the **second** block on the page — `y = 553`, `234 × 178` on desktop; `y = 950`, `344 × 261` on a phone — above "Why it mattered" and above the specification, not below them, and at nearly full width on mobile. Whatever was measured at ~130 px is not what v2.21 renders. The recommendation to lead with it on the 346 confirmed pages still stands; the premise that it is buried does not, and that changes its priority.

---

## The four questions, answered from use

I answer these as the walkthroughs answer them. Where the honest answer is "no persona's task touched this", I say that rather than inventing a persona who wanted it.

### Q1. What is a driver page missing — a photograph, a sentence, or derived figures?

**From use: a page that does not contradict itself, then a sentence, then derived figures. A photograph did not come up once.**

I walked five driver pages in character — Amon, Hamilton, Norris, Halford, Gabbiani. In none of the five did the absence of a portrait cause a hesitation, a backtrack or a wrong answer. In four of the five, something else did:

| Page | What actually blocked the task |
|---|---|
| Norris | `CHAMPIONSHIP —` for the year he won the title, beside `TITLES 1` (`UR-01`) |
| Gabbiani | `WINS 0` in the strip, `—` in the table below (`UR-02`) |
| Halford | four adjacent zeros, no sentence, and the same em-dash split (`PD-15`, `UR-02`) |
| Amon | 96 vs 108 vs `—` for the same career (`UR-12`) |
| Hamilton | worked — and the "On the record" block, showing `106 derived · 106 published` with the external source and date, is the best thing on any driver page |

So the ordering the second product critique reached from structure — sentence, then a strip that fits the driver, then derived figures, then the photograph — is what use produces too, with one change of emphasis: **`UR-01` and `UR-02` come before all four of them**, because they are not thinness, they are the page stating something false about a real person, and they cost an afternoon between them.

The positive case for a photograph is real but it is not a *driver page* case. It is `PD-20`'s case: four of my six personas arrive through a link preview or a search result, and a portrait is the thing that makes one of those look like a reference work rather than a text file. That is an argument for one image per page *in the head*, not for a hero slot that 302 of 862 pages cannot fill.

### Q2. Does the track atlas do anything any persona wants?

**One of my six wanted something it does, and it delivers that thing at about thirty pixels.**

Honest accounting across the personas:

- The **fan** has a plausible question the wall answers — *is Monaco really that much smaller than Spa* — and I walked it. Toggling True scale does work: the cells share a viewBox (verified — Monaco's `viewBox` changes from 1,050 units to the shared 2,328). But at 1280 px the cells are **108 px** wide and the drawing inside them is **29–97 px**: Monaco 32, Gilles-Villeneuve 29, Spa 59. On a phone the cells are 148×56. The comparison is real and it is delivered at the size of a favicon, with the km figure printed underneath — and the km figure is what I ended up reading.
- The **journalist**, **data scientist**, **developer** and **Wikipedia editor**: nothing. The data scientist wants `f1-geometry.db`, not a page.
- The **cold arrival** is actively harmed: the atlas is the only page type on the site with no prerendered content, so for 11.9 s and for every crawler it is one sentence.
- The lap **scrubber** — the most-built thing here, disabled on 3 of 25 — answered no question any of my six personas could phrase. I tried to phrase one and could not.

So `PD-21`'s decision is the right one and I endorse it from use: **the atlas is a comparison surface**. Three things the walkthrough adds to its three pieces:

1. **The wall's cells are too small to carry the claim they exist to make.** Inverting the page is not enough; at true scale the wall needs to be the whole width and the cells need to be roughly the size the hero is now. This is the one place on the site where making something bigger *is* the feature.
2. **Picking a cell already works and already scrolls up.** That is better than `PD-21` implies. What is missing is only the address.
3. **The Suzuka→Spa link is worse than a broken link**, because it is a promise in prose — *"compare it with the other traced circuits at one scale"* — followed by a different circuit. Fix that one first; it is on 25 pages and it costs a `useSearchParams`.

### Q3. Would an interactive 3D circuit with elevation change any persona's outcome?

**No, and I could not construct a persona whose task it would touch without inventing their motivation.**

I agree with `PD-23` and will not restate its six reasons, which are stronger than anything I can add from use. Three things the walkthroughs contribute:

- **It would make the atlas's worst measured failure worse.** The atlas's biggest cost in this run was that it is blank for 11.9 s and blank forever without JavaScript. A WebGL canvas cannot be prerendered, cannot carry `Figure.jsx`'s table of its own numbers, and cannot be read by a screen reader. The one page with a deep-arrival hole would get a bigger one.
- **The personas who care about circuits at all were served by the circuit page.** My fan's circuit task was answered by "Most wins here" in two taps. My journalist never opened a circuit page. Nobody needed a gradient.
- **It would be the first figure on this site with no cross-check**, on a site whose readers I modelled as arriving *because* everything has one. The Wikipedia editor persona is the sharpest test here: the thing that made `/races/1970/1` work for them was that the site showed its uncertainty. A rendered elevation profile shows confidence the database cannot support.

`PD-23`'s alternative — `elevation_change_m` as a sourced, tiered column — is the version that survives all six personas, because it is a fact with a provenance and it sits next to Length and Turns where the fan already looks.

### Q4. Where would "looking nicer" change what a persona does?

**Three places, in this order, and none of them is inside a page.**

1. **The link preview and the search snippet** (`PD-20`). Four of six personas arrive that way. Zero of 3,515 pages carry an image; `twitter:card` is `summary`. This is the only place in the run where appearance decides whether the visit happens at all.
2. **The first screen of a prerendered page on a phone.** Not the palette — the *shape*. `/drivers/amon` at 390 px spends its first screen on `Nationality / New Zealand / Born / —`, and 2,302 px on a one-column key/value list before anything else. `/seasons/2026` opens with five em dashes. Making the static first screen say the two or three things that matter is a content-and-layout job worth more than any restyle.
3. **The atlas wall at true scale**, and only there, for the reason in Q2: the thing is too small to be read.

**Where it does not pay, from use:**

- **Deeper into a long page.** Hamilton's page is 7,009 px; the 2025 season page's standings are at y ≈ 4,000; the records page is 10,675 px. My personas stopped long before.
- **The car photograph**, which on this build is already the second block and 344 px wide on a phone. That work appears to be done.
- **The visual system generally.** I will name this as taste, not standard: across six personas and 22 tasks, nothing failed because of how it looked. Things failed because a number was wrong, a sentence was missing, an explanation was three screens away, or a link went to the wrong place. The driver pages read as thin because 73% of them have four zeros and no sentence, and — now — because 48% of them dash a figure they know to be zero.

---

## What is genuinely good — do not disturb it while fixing the rest

- **`/races/1970/1` end to end.** The disagreement, its reasoning, its source, and *"Recorded rather than resolved, and open for somebody to settle"* — in both renderers. This is the whole product working, and it is what my hardest persona needed.
- **The prerendered race page.** `/races/1976/9` gave a complete, correct classification at 118 ms on a throttled phone, including Hunt's disqualification and its reason. That is a better cold arrival than any competitor manages, and `CD-01`'s "Finished" fix is visible and right in both halves.
- **The SQL console's manners.** 13–38 ms, six teaching examples, and a refusal message that explains and reassures in one sentence. The findings against it are about what it *shows*, never how it behaves.
- **The circuit page.** "Most wins here", the length-against-published check stated as a percentage, and the honesty block about layout timelines. My fan's task was answered here in two taps.
- **`/reference/sources`.** Still the clearest statement of why this project exists, and the model for the About page `UR-05` asks for.
- **The schema comments surviving into the shipped file.** `.schema standings` in a downloaded `f1.db` explains `after_round` properly. That is a real, unusual kindness to the bulk-data audience and it is the reason `UR-07` is an S rather than a serious data problem.
- **The homepage's "The season, at both ends", and the computed `Onward` band.** Both were how my personas got anywhere at all after a deep arrival.

---

## What only real research can settle — ranked by what a wrong guess costs

This is the part of a simulated walkthrough that is actually worth the paper. I can tell you a page contradicts itself; I cannot tell you whether anyone reads it.

1. **Does anyone arrive at all, and where do they land?** Every recommendation in this document — mine, `PD`'s, `IA`'s, `CD`'s — is ranked on an assumed arrival pattern. If nothing ranks, `PD-20`/`UR-06` become urgent and `PD-15`/`PD-16` become premature; if driver pages rank, the reverse. **Cost of a wrong guess: the whole backlog ordering.** Cheapest settlement: Cloudflare's own request counts and Search Console's query and page reports, both free, both already available. This is `PD-Ø`, and it is the only item on the list that decides the others.
2. **Do readers understand that an em dash is not a zero?** Five conventions are load-bearing and none has ever been tested on a person. `UR-01` and `UR-02` are bugs whatever the answer, but the *severity* of the convention itself — whether the blank teaches or confuses — is unknowable from here. Five people and an hour. **Cost of a wrong guess: either a large writing programme nobody needed, or a permanent quiet misreading of the tables.**
3. **Does the eleven-second window lose people, and at what point?** I measured it precisely and I cannot tell you whether anyone waits, leaves, or taps and restarts it. A session recording or a simple "app became ready" beacon against "page closed first" would answer it in a fortnight. **Cost of a wrong guess: `UR-03`, `UR-04`, `PD-02`, `PD-22` and `CD-04` are either the top of the list or a footnote, and nothing in this repository can tell them apart.**
4. **What does the bulk-data audience actually want, and in what format?** F1DB publishes per-asset download counts; Lap Ledger's equivalent is unobtainable while the repository is private. Talking to five people who use F1DB would settle `PD-11`, `CD-07`, `PM-23` and the JSON-vs-Parquet question at once. **Cost of a wrong guess: building `/data` around a claim nobody is shopping for.**
5. **Would a Wikipedia editor accept this as a source, and what would it take?** This is answerable by asking three experienced editors directly, on a talk page, for free. My persona's judgement that it fails WP:RS on authorship is a reading of a policy, not evidence. **Cost of a wrong guess: `UR-05` is either a one-page fix that unlocks the citation audience, or a misreading that sends the project after a compliance problem it does not have.**
6. **Does anyone open the atlas?** `PD-08` has been unanswerable for two critiques and I have not answered it either — I have only shown that its unique half is 32 px wide and its duplicated half occupies the first 1,776 px. One number from Cloudflare ends the argument. **Cost of a wrong guess: a few sittings on `PD-21`, which is the smallest stake on this list — which is itself a finding about how much of the recent debate has been about this page.**

---

## What I did not examine

- **Any real user.** Again, and this is the fourth critique in a row to say so. Everything about demand, preference, comprehension and patience in this document is an argument from structure wearing a persona's clothes.
- **Search visibility.** I tried to observe where lapledger.org ranks and DuckDuckGo refused scripted queries. So the "arriving from a search engine" persona is simulated from the deep URL onward and not from the search result backward, which is the half that decides whether the persona exists. Search Console owns this and `AF-01` is the only note the project has.
- **Assistive technology.** I ran a mobile viewport, a throttled connection and a no-JS reader, which covers the constrained-device half of the brief's spread. I did not run a screen reader or keyboard-only navigation — the accessibility critic was running alongside me and owns it. Where my findings touch it (`UR-01`'s false footer, `UR-04`'s off-screen status message) I have said so.
- **Second and third visits.** Every measurement is a cold cache. The warm-cache experience — which is the one the author has and the one every returning reader has — I saw only incidentally, and it was fast.
- **Constructor, season-index, cars-register, eras and glossary pages** in any depth. I drove home, drivers, driver ×5, race ×3, season ×4, circuit ×2, cars ×1, records, atlas, sql, sources, quality, and the search palette.
- **Whether `UR-01` and `UR-02` are regressions or have always been there.** I did not check the history. Both are v2.21 behaviour, observed today.
- **The truth of any fact in the database**, except where two surfaces of this site disagree about it. Where I say a figure is wrong, I mean the site contradicts itself or contradicts its own stated convention — not that I checked Formula One.
