# Content design critique — 2026-09-21

**Critic:** content-design-critic, second run. **Subject:** Lap Ledger at v2.24, `main` @ `dda5afb`, working tree unmodified.
**Method:** drove the built site at `http://localhost:4179` in Playwright/Chromium (app after hydration, and the prerendered HTML separately), read all 3,540 prerendered pages as files for the at-scale counts, queried the committed `f1.db` for every figure, read `web/README.md`, `README.md`, `docs/critiques/2026-09-10-content-design.md`, `docs/LANDED.md`, and the 150 open issues. **I did not modify the repository and filed no issues** (per the run's override). Findings are numbered `CD-35` onward, continuing the sequence; the report's own numbering is what I refer to below.

Since the first run: `CD-01`, `CD-02`, `CD-03`, `CD-04`, `CD-06`, `CD-10`, `CD-13`, `CD-18`, `CD-19` and `CD-30` have landed. I checked each. All held except where noted (`CD-19` has one live regression, §3.7; `CD-01`'s fix left a stranded footnote, §1.2). I have not re-raised anything already open unless my discipline sees a cause the filed item does not.

---

## The three that matter

### 1. The front door says four different things, and the one a stranger actually reads is the weakest

Four first sentences describe this product, and they are not the same product.

| Where | Current words |
|---|---|
| `<title>` and `og:title`, `dist/index.html` | *Lap Ledger — a Formula One database you can check* |
| `<meta name="description">` | *Every championship race, classification, qualifying sheet and pit stop from 1950 to 2027, queried in your browser. Every figure traceable to a source; every blank an unestablished fact rather than a zero.* (205 chars — Google renders ~155, so the clause that survives is the list) |
| **Static `<h1>`** — what a crawler indexes first, what a no-JS reader gets, what paints for the 4.5 MB of the cold wait | *Formula One, 1950–2027, with its sources attached* |
| App `<h1>` (`Home.jsx`) — only after the database opens | *Every Formula One race since 1950* |

The app's is much the best and nobody arrives at it first. The static one leads with the method — *with its sources attached* — and its lede leads with the storage format: *"Seventy-seven seasons as one SQLite file, queried in this tab."* A person who has never heard of this site is told, in its first nine words, about provenance and a file format. Against the maintainer's own statement of intent — *"a tool anyone can access to get reliable F1 data in one place"* — none of the four says **anyone**, **free**, **all of it**, or **in one place**.

**Ship one sentence, in all four places.** The app's H1 is nearly it; give it the promise:

> **Every Formula One result since 1950, free, and checkable.**
>
> Seventy-seven seasons of races, grids, championship tables and pit stops — every figure traceable to the source it came from. Search it, sort it, download the whole database, or write your own SQL. It runs in this tab; nothing you look at is sent anywhere.

`<title>`: **Lap Ledger — every Formula One result since 1950, free and checkable**
`<meta name="description">` (148 chars): **Every championship race, grid, championship table and pit stop from 1950 to 2027 — free, sourced, and downloadable as one SQLite file. No sign-up.**

*Evidence: drove the site, read the source (`web/scripts/prerender.js`, `web/src/pages/Home.jsx`), read `web/dist/index.html`.* **Defect** (the static/app divergence) plus **preference** (which sentence). *Size: S.* New: `CD-35`.

### 2. 1,163 race pages — the largest page type, and the one a search arrival lands on — carry one templated sentence, no date, and a footnote about a state that does not exist anywhere in the database

`CD-03` landed and put a standfirst on every race page. It is one shape. Stripping proper nouns from all 1,196 race ledes in `dist/` gives **831 + 191 + 61 + 31 + 15 + 13 + 9 + 4 = 1,163 instances of exactly one sentence: *"NAME won for NAME at NAME."*** Nothing else. No date, no margin, no round context, no reason to read on.

And the page never says **when the race was**. On `/races/2024/1` the only date anywhere is `Dates` → **`2024-03-02`**, an ISO string inside the *Where this comes from* provenance block at the foot. `races.dates` is the raw ISO day for all **1,163 completed** races and a human string (*"12-14 Mar 2027"*) only for the **33 scheduled** ones — so the display column is human-readable exactly for the races nobody has a result to read. The same ISO string is the `DATES` column of all 78 season calendars and every circuit's race list: **~5,900 raw ISO dates** across `drivers/`, `races/`, `seasons/`, `circuits/` and `constructors/` in `dist/`. Meanwhile `/now` renders *"Thu 24 Sept 12:30"* — the site owns a human date formatter and uses it on one surface.

Beneath the classification, on **all 1,163 pages, in both renderers** (`web/src/queries/race.js:181`):

> *"An empty “Out” is a retirement nobody recorded a reason for, not a driver who finished. A blank chassis is a season the team ran more than one design and no source says which car raced here."*

`SELECT COUNT(*) FROM race_entries WHERE (status IS NULL OR status='') AND finish_position IS NULL` → **0**. There is not one empty "Out" in the database. `CD-01` fixed the cell to read *Finished* and left the footnote behind, so every race page now teaches a rule about a value the reader will never see, directly under a column in which *Finished* appears twenty times. (The second sentence is true on 761 of 1,163 pages and unconditional on all of them.)

**Ship.** Standfirst, generated from columns the page already loads:

> *Round 1 of 24. Max Verstappen won the 2024 Bahrain Grand Prix for Red Bull Racing from pole on 2 March, and all twenty starters were classified.*

And where it earns more: *"…his ninth win in ten races"*, *"…the first win for Eagle"*, *"…four of the twenty-two starters saw the flag."* Every one of those is a count over rows already in hand. Where the winner is unknown: *"Round 3 of 1952, at Spa-Francorchamps on 22 June. The classification below is what this database holds; no winner is recorded."*

Footer, conditional:

> *(only when any row has a blank chassis)* **A blank chassis** is a season the team ran more than one design and no source says which car raced here.

*Evidence: drove the site, read the source, queried the database, parsed all 1,196 prerendered race pages.* **Defect** (the footnote, the ISO dates), **preference** (the richer standfirst). *Size: S (footnote + date formatter), M (the standfirst generator).* New: `CD-36` (footnote, S), `CD-37` (human dates, S), `CD-38` (race standfirst, M).

### 3. The em dash — the site's single loudest convention — is used for facts that are established, at a scale that undercuts the trust claim

The homepage panel is unambiguous: *"An em dash is a figure nobody has established — never a zero, never a plausible guess."* There are **106,958 bare em-dash cells** (`<td>—</td>` / `<dd>—</dd>`) across the 3,540 prerendered pages. A large, countable share of them are not unestablished at all:

| Where | Count | What the em dash actually means there |
|---|---|---|
| `Died —` on a driver page whose next row says `Status: active` or `retired` | **310 of 862** driver pages | the driver is alive |
| `Winner: not yet run` beside `Car —`, `Pole —`, `Fastest lap —` in a season calendar | **33 scheduled races × 3** | the race has not happened |
| 18-row `Specification` table in which every row is an em dash | **349 of 1,153** car pages (**6,282 cells**) | nobody published a spec for this car — one sentence, not eighteen claims |
| `Entries (published) —` / `Starts (published) —` | **824 / 831** of 862 driver pages | no published figure exists for all but 38 drivers; the derived figure is right there |

Lewis Hamilton's page reads `Born 1985-01-07` / `Died —` / `Status active`, three consecutive rows, two of which contradict each other under the site's own rule. This is `CD-01` again in three new places, and it matters more than it looks: the em-dash convention is the product's central promise about honesty, and a convention that is wrong at this volume teaches a careful reader to stop trusting it — which is the opposite of what it is for.

**Ship.** Four rules, all local to a render site:

- Omit the `Died` row entirely where `status IN ('active','retired')`. Where status is blank and `died` is NULL, keep the em dash — that one is true.
- A cell on a race that has not been run renders **`—`** only if the site also stops saying the em dash means unestablished; better, render nothing and let the row's `not yet run` tag carry it. Simplest correct fix: the whole row reads *not yet run* across the result columns.
- An all-empty specification renders one sentence instead of the table: *"No specification published for this car. Nobody has published a chassis, engine, weight or dimensions for the 349 chassis in this position — see the sources page for why."* (The existing note, *"A blank is a figure nobody published for this car…"*, is good; it just should not be under eighteen dashes.)
- `Entries (published)` / `Starts (published)` rows appear only when a published figure exists. Otherwise the derived figure stands alone, which is already labelled.

*Evidence: drove the site, queried the database, counted the prerendered HTML.* **Defect.** *Size: S each; four separate diffs.* New: `CD-39` (`Died —`, S), `CD-40` (not-yet-run cells, S), `CD-41` (empty spec table, S), `CD-42` (published-figure rows, S).

---

## The full set, ordered by consequence

Numbering continues from the three above.

### `CD-43` — Seven typed figures on the sources page contradict the database on the one page whose subject is trust
*Evidence: queried the database, drove the site. **Defect.*** *Size: S.*

`source_registry.use` and `.checkability` are rendered verbatim on `/data/sources`. Row 10 (F1DB) states:

> *"the full classification for all **1,161** races (**27,555** entries, 1950-2026), qualifying (**26,975**), championship standings after every round (**34,495**) and pit stops (**22,472**)"* — and *"The winner of every one of the **1,161** races came from the Wikipedia harvest"*.

Live: **1,163** completed races, **27,504** entries, **27,017** qualifying, **34,597** standings, **22,506** pit stops. Five wrong figures, one of them twice, on the page that exists to say the figures are checked. Nothing in `verify.py` reads prose typed into a database column, and `tools/readme_figures.py`'s span mechanism — which is exactly the right answer — has never been pointed at it.

This is `PD-25` (#195) and `AF-63` (#441) generalised: **`PD-25` is one claim, `AF-63` is one column, and this is the class.** Fix the class: a `{fig:races_completed}` style token expanded at build time from a small named registry, usable in any prose column, with `verify.py` failing on an unexpanded or stale token. Then `PD-25` and `AF-63` are both instances of it.

One more on the same page: row 12 reads *"It remains the **ONLY source here for 628,454 lap times** back to 1996"*. "Here" reads as "in this database", three clicks from the position that there are no lap times and never will be. Ship: *"It is the only source we know of for lap times back to 1996 — 628,454 of them, none held here: its non-commercial licence forbids passing them on."*

### `CD-44` — The site's internal documentation voice has leaked into `source_registry`, `known_gaps` and `records`, and it is measurable
*Evidence: queried the database, drove the site. **Defect.*** *Size: M, splittable by table.*

Mean sentence length, reader-facing prose:

| Field | Sentences | Mean words | Longest | > 30 words |
|---|---|---|---|---|
| `seasons.notes` | 147 | **10.2** | 28 | 0 % |
| `drivers.notes` | 246 | **11.6** | 31 | 0 % |
| `eras.summary` | 16 | **12.8** | 20 | 0 % |
| `glossary.definition` | 49 | **14.0** | 25 | 0 % |
| `records.detail` | 89 | 15.2 | 44 | 4 % |
| `source_registry.checkability` | 50 | **20.2** | **68** | 14 % |
| `cars.story` | 87 | 22.1 | 47 | 20 % |
| `known_gaps.reader` | 33 | **24.7** | **57** | **33 %** |

The hand-written reader prose is excellent and the house voice is real. The leak is confined and identifiable: the fields that were written as maintainer notes and then given a reader-facing surface. Symptoms beyond length — ALL-CAPS for emphasis (`FORBIDDEN`, `NOT`, `WHOLE`, `ONLY`, `NO NON-COMMERCIAL CLAUSE`, `SECOND OPINION`), file paths and flags in body copy (`tools/f1db_fetch.py`, `tools/ergast_load.py`, `--verify-dump`), and schema identifiers as nouns (`CAR_SEASONS assertions`, `(constructor, season) -> chassis mapping`, `regulation_limits`, `value_num is the age in days`).

`/records` is the worst-placed instance because it is a masthead page a fan clicks. The main table's widest column is **How it is derived**, 30–70 words of schema prose per row, and the genuinely interesting fact — *"Next: Michael Schumacher on 91, Max Verstappen on 71"* — is buried at the end of it. **Ship:** promote `Next:` to its own column or a second line under the holder; collapse the derivation into a `<details>` headed *How this is counted*. Two lines of JSX, and the page becomes readable by the audience it is on the masthead for without losing a word the other audience needs.

Two rewrites as the pattern, both shorter than what they replace:

> **Wikipedia season results tables — what can check it.** *Current (68 words, one sentence):* "Race count per season, contiguous rounds, and every driver and constructor name resolving to the register. NOT sufficient on its own for standings grids: they left-pack their cells, a driver who missed a round shifts every later result a column, and the winner cross-check passes anyway because winners sit in the dense top rows. That route is closed."
> **Ship:** "The race count, the round numbering and every name are checked against the register. Its standings grids are not used at all: they left-pack their cells, so a driver who missed a round shifts every later result one column across — and the winner check passes anyway, because winners sit in the top rows."

> **Known gap, chassis.** *Current:* "We do not know which car won roughly one race in four…" **Keep.** That one is already right, and it is the model for the rest.

### `CD-45` — 85 constructor pages have no sentence and a meta description that reads as schema output
*Evidence: queried the database, parsed the prerendered HTML. **Defect.*** *Size: S.*

`constructors.notes` is populated on **65 of 150**. The other 85 pages open with the name, a livery note and a stats strip, and their meta description is exactly the pattern `CD-11` condemned for drivers and which `PD-16` fixed there:

> *"Osella Squadra Corse, Italy, Formula One 1980–1990. 0 wins."* — **85 of 150 descriptions match that shape exactly.**

Drivers got a generated lede (*"Entered 1 championship Grand Prix in 1952 for Veritas; no classified finish."*) and constructors did not. Same generator, different table:

> **Page lede:** *"Entered 253 championship Grands Prix across eleven seasons, 1980 to 1990, without a points finish better than fifth."*
> **Meta description:** *"Osella entered 253 Grands Prix between 1980 and 1990 with 17 drivers and no win. Every season, every car it built, and every entry — on Lap Ledger."*

`CD-11` (#257) should be re-scoped to this: the driver half is done, the constructor half is not.

### `CD-46` — 1,159 car pages: the description repeats the name as the entrant, 332 say "No championship entry recorded", and 1,139 titles carry no year
*Evidence: parsed the prerendered HTML, queried the database. **Defect.*** *Size: S.*

- **912 of 1,159** car descriptions read *"X, entered by Y, …"* where Y is the first word of X: *"Ferrari 553, entered by Ferrari, 1953–1954."*, *"Krakau, entered by Krakau, 1952."* The clause is noise in the majority case and reads as a rendering bug in the identical case.
- **332** say *"No championship entry recorded."* Under this site's convention that is ambiguous — did it not race, or is the entry not recorded? And it is a sentence nobody clicks.
- **1,139 of 1,159** titles carry no year, and 87 of them begin *Ferrari*, 79 *McLaren*, 59 *Lotus*. In a results list `Ferrari 312B2 — Lap Ledger` is indistinguishable from its 86 siblings and from a Wikipedia stub.

**Ship:** title **`Ferrari 553 (1953–1954) — Lap Ledger`**; description **`Ferrari 553, raced 1953–1954 with the Lampredi engine. 6 championship entries, best finish 2nd. Specification, every entry and the sources, on Lap Ledger.`** Where no entry resolves: **`Krakau, 1952. One chassis with no championship entry that resolves to it — usually a team that ran several designs and no source saying which raced when.`** (That last is `Car.jsx:315`'s excellent empty state, reused as the description; it is already written.)

### `CD-47` — 270 hyphens are doing an em dash's job, and 144 year ranges use a hyphen where the interface uses an en dash
*Evidence: queried the database, drove the site. **Defect.*** *Size: S (one migration pass + a lint).*

Across 28 prose fields in `f1.db` — `known_gaps.reader`, `discrepancies.assessment`, `source_registry.*`, `records.detail`, `glossary.definition`, `cars.story`, `constructors.notes`, `chassis.*`, `team_radio.context` and others — there are **270 occurrences of ` - ` used as a parenthetical dash** and **144 hyphenated year ranges**. Rendered:

> *"where a team ran two designs - McLaren's M23 and M26 through 1976 and 1977 - attributing the pole to one of them would be a guess"*
> *"The sum a new team pays to join - the anti-dilution fund - is a term of the Concorde Agreement"*
> *"an entry counts as a start unless its result is DNQ, DNPQ, DNS, DNP or EX - did not qualify, pre-qualify, start or practise, or excluded before the start - so a pit-lane start counts"*
> *"Mercedes: **8, 2014-2021**"* beside a masthead that reads *1950–2027* and a driver hero that reads *1963–1976*.

The JSX layer is typographically consistent; the prose that lives in the database never got the pass. It reads as two authors. It also weakens the one mark this site loads with meaning: a reader who sees ` - ` used loosely has less reason to read ` — ` as a claim. One `data/*.py` pass, plus a Ruff-adjacent check or a `verify.py` assertion that no prose field contains ` - ` or a `\d{4}-\d{2,4}` range outside an ISO date.

### `CD-48` — 7,707 visible photograph captions are file names with the extension, on 2,065 pages
*Evidence: parsed the prerendered HTML, read the source. **Defect.*** *Size: S.* **Re-scopes `CD-29` (#403), which is now partly stale.**

`CD-29` was filed about `alt`. `photoAlt()` in `web/src/lib/commons.js:54` now strips the extension and the alt on `/races/2024/1` is `alt="Red Bull Racing RB20"` — so the alt half is done. What remains is bigger and visible: `CommonsImage.jsx:71` and the prerenderer render **`fileTitle(image.file_name)`**, which keeps the extension, as the caption link text:

> *Red Bull Racing RB20*
> *Max Verstappen 2024 Chinese GP.jpg · Liauzh · CC BY-SA 4.0 · unchecked*
> *2024-08-25 Motorsport, Formel 1, Großer Preis der Niederlande 2024 STP 3805 by Stepro.jpg · Steffen Prößdorf · CC BY-SA 4.0 · unchecked*

**2,065 pages, 7,707 occurrences** — race pages, season pages, `/now`, constructor pages and the `/cars` gallery, where it is the last line of an otherwise beautifully written card.

`CD-29`'s body says *"Leaving the file name in the caption is right — that is a citation."* I disagree, and this is the argument: Commons' own display convention is the file title **without** the extension, and the citation is carried by the `href`, which already points at the `File:` page. The extension is a file-system artefact, not part of the title. Ship: link text `Max Verstappen 2024 Chinese GP`, extension stripped by the same regex `photoAlt()` already uses. Both renderers together, or `smoke.mjs`'s parity checks catch it — which is the right outcome.

### `CD-49` — `Car` is the column header for a constructor, on 78 season pages, 80 circuit pages and `/races`
*Evidence: read the source, drove the site. **Defect.*** *Size: S.* **Belongs inside `CD-12` (#258).**

`src/queries/season.js:305`, `src/queries/circuit.js:114` and `src/queries/races.js:53` all render `{ key: 'constructor', label: 'Car' }`. The season calendar therefore has a `CAR` column containing *Red Bull Racing*, on a site that has a `/cars` route where a car is a chassis, and a `Chassis` column two pages away holding *RB20*. Three words for two things, one of them plainly wrong. **Ship: `Constructor`, everywhere** — it is already the word on the race and driver classifications.

The rest of `CD-12`'s table is still live and I add three:

| Concept | Words in use | Where |
|---|---|---|
| The constructor | **Car** / **Constructor** | `season.js:305`, `circuit.js:114`, `races.js:53` vs `race.js:153`, `driver.js` |
| A row in `race_entries` | **Entries** / **Race entries** / **Recorded entries** / **Races** / **Every entry** | `/cars/krakau` alone uses three: strip *RECORDED ENTRIES 1*, section *EVERY ENTRY*, count *1 RACES* |
| Anything in the search index | **entities** | `Search.jsx:187` — *"3,519 entities indexed"* is the schema talking |
| A season a driver is still racing | **`2007–`** (driver hero, People table) / **`2007`** (search subtitle) | `Driver.jsx` vs `Search.jsx:21` — in search, Lewis Hamilton is indistinguishable from a one-season driver |
| A constructor, in car search results | **`brabham`** | `Search.jsx` renders the lowercase id as the subtitle on 1,153 car results |

### `CD-50` — No pluralisation helper: "1 races", "1 rounds", "1 drivers" on ~313 pages
*Evidence: read the source, parsed the prerendered HTML. **Defect.*** *Size: S.*

~40 `<Section count={...}>` call sites across `src/pages/*.jsx` hard-code a plural noun: `` count={`${entries.length} races`} ``. **84 cars** have exactly one entry, **171 drivers** have one, **11 circuits** have one race, **47 constructors** raced one season; 42 instances survive into the static HTML (`1 rounds` ×25, `1 drivers` ×8, `1 races` ×6, `1 entries` ×3) and more appear in the app. One `plural(n, 'race')` helper in `lib/format.js`, applied at the call sites.

### `CD-51` — The reliability claims contradict each other across three pages
*Evidence: drove the site, queried the database, read the source. **Defect.*** *Size: S.*

Three, each on a surface whose whole job is to be precise:

1. **Five tiers or six.** `Data.jsx:203` reads *"Every row carries one of five confidence tiers"* and the block immediately below renders **six**: `VERIFIED HIGH REFERENCE MEDIUM UNVERIFIED CATALOGUED`. The homepage handles it correctly (*"…or unverified — only an official source reaches the top. Photographs have a sixth rung below those."*). Ship the homepage's construction on `/data`.
2. **"Disagreements are shown, not settled. There are 58 on record."** (`Home.jsx:246–249`.) 47 of the 58 *are* settled: 23 `resolved - withdrawn`, 12 `resolved - claim not corroborated`, 6 `explained - external figure is older`, 2+2+2 others; **11 are open**. `/data` states it correctly — *DISAGREEMENTS ON RECORD 58 / 11 still open*. Ship the homepage panel as: **"Disagreements are recorded, not quietly picked."** / *"Where two sources conflict you see both. 58 recorded, 11 still open."*
3. **Column headers that contradict their sections.** `/data/quality` heads three tables `FIELD | AREA | WHAT IS MISSING, AND WHY`. Two of them are *"Positions, not gaps — deliberate absences"* and *"Closed — gaps that have since been filled"*. Neither is missing. Ship per-section headers: *What is deliberately not here* and *What closed it*. And retire the `FIELD` column from all three: `chassis_id`, `cars.poles`, `regulation_limits.cost_cap_usd` in the leftmost position is the schema addressing the reader, when `AREA` beside it already says it in words.

### `CD-52` — Empty and error states: the inventory, redone, with the four that are wrong
*Evidence: drove the site (Playwright: aborted `f1.db.gz`, `db-manifest.json`, `sql-wasm.wasm`; filtered a register to zero; ran six bad statements in the console). **Mixed.*** *Size: S each.* Supersedes `CD-17` (#260)'s inventory with the rendered truth.

| State | What it says now | Verdict |
|---|---|---|
| Boot, in progress | prerendered page paints, then the app replaces it | **Good.** No spinner, no flash of nothing. |
| **Boot, failed** (all three assets tested) | *"The database could not be opened. The figures on this page are from the last published build."* | **Improved, still incomplete.** It says what happened and nothing to do. Ship: *"The database did not load, so this page is showing the last published build. Search, the filters and the SQL console need it — reload to try again."* |
| SQL console, refused write | *"Reads only: start with SELECT, WITH, VALUES, EXPLAIN or PRAGMA. A write would be rolled back anyway, so nothing has changed."* | **Still the best error message in the project.** Do not touch. |
| **SQL console, typo in a keyword** (`SELCT * FROM drivers`) | the write refusal above | **Wrong answer to the question asked.** `IX-25` (#161) has it; the wording is *"Did you mean `SELECT`? Only reads run here — start with SELECT, WITH, VALUES, EXPLAIN or PRAGMA."* |
| **SQL console, `no such table: driverz`** | raw SQLite text, nothing else | **Dead end.** Ship: *"SQLite refused that — no such table: driverz. The schema list on the right has all 48 tables and 41 views; open one to see its columns."* |
| **SQL console, `SELECT * FROM laps`** | *"The statement ran and matched nothing."* | **Wrong, and it is the one that matters.** `laps` is empty as a licence position and the console is where a developer meets it. `CD-05` (#176) specifies the line; it is still not there. Ship, as the zero-row message when the statement reads one of the four: *"Empty by design — no source licenses Formula One race timing for redistribution, so this table ships with no rows. [Why](/data/sources)"* |
| **Register filtered to zero** (Liechtenstein + Champions) | *"Nothing recorded."* | **Wrong claim.** Under this site's convention "nothing recorded" is a statement about the data, and the reader made it true with a filter. There *is* a Liechtenstein driver. Ship: *"No driver matches both filters. Liechtenstein has 1 driver in the register and none was champion."* + **Clear filters**. (`IX-28`, #141, owns it; that is the wording.) The default `DataTable` empty should be the neutral **"No rows here."** |
| Search, no match | *"No match — Nothing in the register answers to that."* | **Good voice, dead end.** `IA-21` (#152). |
| Search palette footer | *"3,519 entities indexed"* | **Schema's word.** Ship: *"3,519 drivers, teams, circuits, cars, seasons and races."* |
| Car with no entries | *"No race entry in this database resolves here. That is usually a constructor that ran several designs in a season and no source saying which raced when, not a car that never raced."* | **Still the best empty state on the site.** |
| 404, app / 404, static | *"No such page…"* / *"Not found…"* | **Both good**, and correctly different. |
| No such driver id | *"Nothing in the register has the id “chris-amon”. Press / to search every driver by name, or browse the register."* | **Good.** Names the thing, offers two ways out. |
| Race not yet run | app: *"…It is on the {year} calendar and carries no result yet."* / static: *"…The classification will appear here once it has."* | **Two renderers, two sentences.** `CD-33` (#448). |

### `CD-53` — Two notes appear where a reader could not misread the table without them, against the project's own stated rule
*Evidence: read the source, drove the site. **Defect** (by `web/README.md`'s own rule). *Size: S.*

`web/README.md`: *"A note beside a table survives only if a reader would **misread the table without it**."* Two break it at volume:

- `progressionNote()` (`src/queries/season.js:205`) appends *"Before 1991 only a driver's best few results counted, so a line can rise by less than they scored that weekend"* to the title-race chart on **all 78 season pages**, including 2026 and 2027. On the 37 seasons from 1991 it is noise attached to the most-read chart on the page. `points_systems.dropped_scores` is already fetched by `REMAINING` in the same file; condition on it.
- The circuit page renders six dated F1DB layouts under **"EVERY LAYOUT RACED HERE — 6"**, each with a year span (*1955–1972*, *1973–1975*…), and then states: *"No layout timeline for this circuit. Only thirteen of the eighty have one, so an early race here is reported at the length the circuit is today."* A reader who has just read six dated layouts is told there is no timeline. The distinction (F1DB outlines vs `circuit_layouts` rows) is internal. Ship: *"These are the six shapes F1DB distinguishes, with the seasons each was used. This database does not hold a dated layout for Monaco, so the length quoted on a race page here is the current 3.337 km whatever year it was run."*

Conversely, the conditional notes remain a model and should not be swept up: `Driver.jsx`'s two-points-totals note that only fires when they differ, the shared-drive note above the table containing one, and `Car.jsx:315`.

### `CD-54` — `Fastest laps: 69 derived · 67 published` is shown with no sentence saying which to use
*Evidence: drove the site, read the source. **Defect.*** *Size: S.*

On `/drivers/hamilton`, *On the record* shows `Wins 106 derived · 106 published`, `Poles 104 derived · 104 published`, **`Fastest laps 69 derived · 67 published`**. The long paragraph beneath explains **entries and starts** and says wins, podiums and poles *"are checked against the published totals on every build"*. Nothing addresses the case in front of the reader, which is the only row that disagrees. For the journalist this site wants, that is the exact moment a sentence is owed. Ship, conditional on a disagreement:

> *"Two counts disagree here. **69** is what this database counts from the races listed above; **67** is what formula1.com publishes. Neither is corrected. If you are publishing, cite the official figure and say so."*

And, separately: `drivers.notes` for Hamilton opens *"Record holder for wins (105 at end-2025) and poles (104)"* beside a strip deriving **106**. `CD-19` landed a check (`tools/lede_figures.py` + `verify.py`) precisely to stop that, and this note slips it because the figure is qualified with *"at end-2025"*. It is still a lede contradicting the number three centimetres below it, on the most-visited driver page on the site. Ship: *"The record holder for wins and poles, and the only driver to equal Schumacher's seven titles. Moved to Ferrari for 2025 and won at Barcelona in 2026."*

### `CD-55` — The SQL console opens with 120 words about ODbL, copied verbatim from `/data`
*Evidence: drove the site, read the source. **Preference, with a defect inside it.*** *Size: S.*

Above the editor, `/data/sql` reproduces the whole *"The database is a plain SQLite file… two files rather than one because distributing them together keeps them a collective database: merging them would pull 117,000 unrelated rows under the centrelines' share-alike licence. Take both, or you have no geometry and no way to get it. Everything you need to read it is inside it: `SELECT sql FROM sqlite_master`…"* paragraph, word for word from `/data`. A reader who came to write a query is given a licence essay first; a reader who came from `/data` reads it twice. The obligation is real and must stay somewhere — it is on `/data`, on `/data/sources` and in `ATTRIBUTION.md`. Ship, on the console, one line:

> *Prefer your own tools? [Download `f1.db`](/data) — and take `f1-geometry.db` beside it, or you get no circuit geometry.*

The rest of the console copy is good, and the sentence *"Nothing you type can break anything. The database is a copy in your own browser, every statement runs inside a transaction that is rolled back, and a reload restores it either way. Reads only."* is one of the best on the site.

### `CD-56` — The glossary still defines the sport and not the product
*Evidence: drove the site, queried the database. **Defect, unchanged since 2026-09-10.*** *Size: M.* This is `CD-09` (#179) and it has not moved.

44 terms, all about racing. The *People* table added since is genuinely excellent — 32 entries whose **Why they are here** column is the best short-form writing in the project. But the words a newcomer trips on *here* are still undefined anywhere:

**DNQ** (1,041 `position_text` rows), **DNPQ** (336), **NC** (200), **DSQ**, **DNS**, **EX**, **PL** — `DNF` is the only one in the glossary and its whole definition is *"Did Not Finish."*, which does not explain why a DNF still has a position. Plus **classified**, **entry vs start**, **chassis vs car**, **derived vs published**, **confidence**, **verified / high / reference / medium / unverified / catalogued**, **discrepancy**, **known gap**, **shared drive**.

On Chris Amon's *Every entry* table, `RESULT` and `OUT` both read `DNQ` on the same row, and both read `DNS` on another — the same undefined token twice, in two columns that mean different things. A reader cannot look either up.

Ship the second glossary category and, more importantly, link from the point of use: the `Pos`/`Result` column header, and the confidence pill (already a link — good). Two definitions to ship verbatim:

> **Classified** — Ranked in the final order. A driver who retired is still classified if they completed enough of the race distance, which is why a car that stopped can have a finishing position.
>
> **Reference** — Read from a published results table and cross-checked against a second, independent source. Reliable; not official. If you are publishing, cite the FIA archive.

### `CD-57` — The README's first sentence, and its second paragraph
*Evidence: read the docs. **Defect.*** *Size: S.* `CD-16` (#181), unchanged, plus one addition.

Still: *"An expansion of the original single-file JSON into a normalised, queryable SQLite database covering 1950–2027, with the JSON kept as a generated export."* The addition: the **second** paragraph is a v2.24 release note — *"Thirty rows had been typed from general knowledge, at `medium`, with nothing in `verify.py` reading them…"* — in the position a developer deciding whether to depend on this reads first. `PD-07` moved the version log; the release note took its place.

Also, `gh repo view` gives the repository description as *"Formula One, 1950–**2026**…"* against a site that says 1950–2027. It is the first line a developer reads on GitHub and nothing checks it. (`SD-12`, #220, counts the typed span 29 times across four channels; this is a 30th.)

### `CD-58` — Nothing anywhere says who publishes this, and the only correction route is a GitHub issue form
*Evidence: drove the site, parsed 3,540 prerendered pages. **Defect.*** *Size: S.* This is `UR-05` (#238) and `SD-15` (#223), and I am raising it again because commercialisation makes it load-bearing rather than polite.

On all 3,540 pages the footer offers *"Found something wrong? **Report it**."* → `github.com/.../issues/new?template=report.yml`. For a developer that is correct. For the fan, the journalist and the Wikipedia editor — three of the six audiences — it is a closed door, and for WP:RS purposes an unattributed publisher is not a source at all. No page names a person, an organisation, an email, or an update cadence in reader terms.

Words, for a short block on `/data` and a footer link:

> **Who publishes this**
>
> Lap Ledger is built and published by *[name]*, one person, in the open. The build, the checks and the source data are all public, so anything on this site can be reproduced from scratch rather than taken on trust.
>
> The database is rebuilt every morning at 06:00 UTC and republished when something has changed. If it stops, the last release stays downloadable and its `SHA256SUMS` still verify — nothing here depends on this site staying up.
>
> **Found a mistake?** Email *[address]*, or [open an issue](…) if you use GitHub. Corrections are welcome with a source; a claim two sources disagree about gets recorded as a disagreement rather than replaced.

The third paragraph is the one a journalist needs and the one that currently exists nowhere.

### `CD-59` — Three notes on the front door that would survive commercialisation
*Evidence: drove the site, read the docs. **Preference.*** *Size: S each.*

The maintainer asks whether the copy reads as a product or as a README rendered. It reads as a product on `/data`, `/changes`, `/now` and `/reference/eras`, and as a README everywhere provenance is the subject. Three specific gaps against *"deciding whether to depend on it"*:

1. **Nothing says it is free, or that there is no sign-up.** Not on the homepage, not on `/data`. For a bulk-data audience that is the first question. One clause: *"Free, no account, no rate limit — the whole database is one download."*
2. **Nothing states a stability promise.** `/changes` is excellent on *what* moved and silent on *what will not*. One sentence, and it is a commercial asset: *"Table and column names do not change without a major version. `meta.version` says which you have; the release page keeps every previous build."* (`SD-07`/`DA-04` own the underlying question; this is the sentence once it is answered.)
3. **The citation line is on every page and is good** — *"Cite this page as Lap Ledger, database v2.24 built 2026-09-16, https://… The version and build date fix which figures you saw."* Keep it exactly. `CD-08` (#178)'s named-sources paragraph is what is still owed on top of it.

### On "it is all a bit dull" — what a restrained reference can and cannot do with words

The site is already not dull in four places, and each is the proof of what works:

- **`seasons.notes`, 78 of 78 authored.** *"Verstappen's fourth straight title while McLaren took its first constructors' crown since 1998. Longest calendar to that point at 24 rounds."* Two sentences, no adjectives, entirely checkable, and it tells you why the year mattered.
- **`/reference/eras`.** *"Cooper put the engine behind the driver and the entire grid followed within three years."* *"Two revolutions at once: underbody downforce and forced induction. Power outputs reached figures never approached since."*
- **The People table's *Why they are here*.** *"Paralysed in a road accident in 1986 and ran the team from a wheelchair for a further 34 years. Nine constructors' titles."* *"Put the engine behind the driver and made every front-engined Grand Prix car obsolete."*
- **`Disagreement`'s closing line**, still the best sentence on the site: *"Recorded rather than resolved, and open for somebody to settle."*

**What it should do.** Extend that treatment down the two page types that have none. **Races**: 1,163 pages, one template, no date (§2). **Constructors**: 85 of 150 with no sentence (`CD-45`). **Cars**: 29 of 1,153 have a `story`; the other 1,124 have a name and a table, and 349 have not even a specification. The unit of work is a *generated* sentence built from superlatives the database can already prove — first win for a constructor, a driver's last race, the largest grid, the fewest classified, a debut, a record equalled — because those are facts, they are checkable, and they are interesting for exactly the reason a person came.

**What it must not do.** Adjectives it cannot source (*thrilling*, *legendary*, *controversial*), causes it does not hold (`CD-13` already caught one: *"after a grid penalty"*), quotations it has not licensed, or a tone that asks the reader to feel something. The voice that works here is the one already in `seasons.notes`: a flat declarative sentence about a surprising fact. That is engaging *because* it is restrained, and the moment it reaches for a magazine register it forfeits the only thing this site has that its competitors do not.

---

## What is genuinely good — do not remove it in an edit pass

- **`/data`.** *"The whole site is one SQLite file, and you can have it."* `CD-07`'s job, done better than `CD-07` asked. The three file cards, the two-file ODbL explanation as a download instruction, and *"What is not here"* stated as a position rather than a gap.
- **`/changes`** in full, and the feed's `<rights>` element, which is a complete attribution in one sentence.
- **`/now`'s title-race paragraph.** *"…9 rounds and 1 sprint still to run, so 233 points are still available, and a driver further behind the leader than that cannot reach them. Counted after round 14… Points only: a tie at the top is settled on wins, which this does not work out."* That last clause — declaring the limit of its own arithmetic — is the discipline in nine words.
- **The SQL console's refusal message**, and *"Nothing you type can break anything…"*.
- **`Car.jsx:315`'s empty state**, still the model.
- **The `Onward` / *Keep going* bands**, ~60 hand-written, each naming a reason rather than a destination: *"The championship they were part of, round by round."*
- **`/data/quality`'s gaps, rewritten to `CD-06`'s spec.** *"We do not know which car won roughly one race in four."* The *Maintainer's note* disclosure is the right separation.
- **The eras, the People table, and every `seasons.notes` row.**
- **The confidence pill is now a link** (`CD-10`), and the ladder's sixth rung is honestly named *catalogued* with a definition that says *"Never present it as the car without a person looking first."*
- **Reading level of the hand-written prose:** mean 10–14 words a sentence, zero sentences over 30 words in `seasons.notes`, `eras.summary` or `glossary.definition`. Plain, British, active. Defend it.

## What I did not examine

- **Anything at mobile width**, and anything about where a note falls relative to the fold.
- **Any real reader.** Every comprehension claim here is a content designer's judgement. The em-dash conventions are testable with five people in an hour and that is `UR`'s.
- **`/reference/eras` below the first four eras**, `/records`' leaderboards below the records table, `/circuits`, `/seasons`, `/races` index copy beyond their ledes, and the four chart tables.
- **The Parquet bundle, the release bodies, `SHA256SUMS`, `ATTRIBUTION.md`, `LICENSE-DATA`** as reader-facing copy.
- **`og:image` / share-card text**, and the `sitemap.xml` / `robots.txt` semantics.
- **The 552 short prose fields flagged in `PM-17`** as reader-facing copy, other than the sentence-length sample above.
- **The cold-network experience.** I aborted assets to reach the failure state; I did not throttle and watch the 4.5 MB arrive.

---

## Backlog verdicts

### My prefix (CD-\*)

| ID | # | Verdict |
|---|---|---|
| CD-05 timing position in three lengths | 176 | **Keep — move to Now.** The console placement (`SELECT * FROM laps` → *"matched nothing"*) is the one that matters and is still missing. Verified live today. Merge `PD-29` (#155) into it: same sentence, different surfaces, one diff. |
| CD-07 what `/data` claims | 177 | **Close as landed.** `/data` now reads better than the item specified. Nothing left in it. |
| CD-08 the citation block | 178 | **Keep, Next.** The per-page citation line landed; the named-sources paragraph did not, and it is the half that makes it worth building. Re-size S → S (unchanged). |
| CD-09 glossary defines the sport, not the product | 179 | **Keep — move to Now, re-size M → S+M.** Split: (a) S — add the 12 results abbreviations and link from the `Pos` header; (b) M — the product vocabulary. (a) is a data edit and unblocks the rest. Highest-value CD item still open. |
| CD-11 meta descriptions read as schema output | 257 | **Keep, re-scope.** Drivers are fixed. What remains is **85 constructor descriptions** ending *"0 wins."*, **912 car descriptions** saying *"X, entered by X"*, **1,139 car titles with no year**, and **414 descriptions over 155 chars**. Rewrite the body to those four measurements (my `CD-45`/`CD-46`). |
| CD-12 one concept, several words | 258 | **Keep — move to Now, re-size M → S then M.** The `Car`-means-constructor header (my `CD-49`) is a defect, is three lines, and should be split out and shipped first. The rest stays M as a vocabulary sitting. |
| CD-14 homepage explains four conventions, there are seven | 259 | **Keep, Next.** Still true; add the two corrections from my `CD-51` (the 58-disagreements framing, the tier count) to the same diff. |
| CD-15 `./f1 gaps` prints CLOSED entries | 180 | **Keep, Next.** Unblocked — the `state` split exists in the data now (`/data/quality` renders Open / Positions / Closed). One filter and a header. |
| CD-16 README's first sentence | 181 | **Keep, Next.** Add the second paragraph (a release note in the position a developer reads first) and the stale repo description. |
| CD-17 error and empty states inventory | 260 | **Decline as an item; supersede.** An inventory is not a task and it has sat in Next for ten days. My `CD-52` is the re-observed version. The two things it named are `IX-28` (#141, the filtered empty state) and the boot-failure copy — file the boot copy as its own S, close #260, and let `IX-28` / `IX-25` / `IA-21` carry the rest. Closing an inventory that has spawned its own items is the tidy-up this re-establishment is for. |
| CD-29 photograph alt text is a file name | 403 | **Keep in Now, re-scope.** The `alt` half is already fixed (`photoAlt()` strips the extension; `alt="Red Bull Racing RB20"` on `/races/2024/1`). What is left is the **visible** caption on **2,065 pages / 7,707 occurrences**, which the body currently endorses. Rewrite the body against my `CD-48`. |
| CD-31 static footer drops the privacy sentences | 439 | **Keep — move to Now.** Verified still true. Two strings, and they are the two claims (nothing sent anywhere; works offline) that a cold arrival most needs and only a warm one gets. Cheapest trust win on the board. |
| CD-32 not-yet-run season told about 1958 | 447 | **Keep, Next.** Merge `CD-33` (#448) into it: both are "what a not-yet-run thing says", both touch `Season.jsx`/`Race.jsx`/`prerender.js`, and my `CD-40` (the three em-dash cells on a scheduled calendar row) is the third instance. One item, one sitting. |
| CD-33 scheduled race told two things | 448 | **Merge into CD-32 (#447).** |
| CD-34 static constructor Wins/Poles read the stored column | 462 | **Keep, Next.** It is a content decision and the item states the three options well. My vote, for the record: **option 3** — show both where they differ, as the driver page does. It is the pattern already on the record and it is the only one that explains itself. Add a line to the item saying the decision is taken so a fork does not reopen it. |

### Assigned outside my prefix

| ID | # | Verdict |
|---|---|---|
| PD-25 disagreements claim should be live figures | 195 | **Keep — move to Now, and generalise.** Merge `AF-63` (#441) into it and widen to my `CD-43`: **seven** figures typed into `source_registry` prose are wrong today, on the sources page. One mechanism — a build-time figure token with a `verify.py` check, the `readme_figures.py` idea pointed at database prose — retires the whole class. Re-size S → M. |
| AF-63 `races.note` not held to the figure rule | 441 | **Merge into PD-25 (#195).** Same class, and merging is what stops the third instance being filed separately. |
| UR-05 nothing says who publishes this | 238 | **Keep — move to Now.** Merge `SD-15` (#223) into it; they are the same page and both bodies say so. Commercialisation makes this the item that most changes what the site is, and it is an S. Wording in my `CD-58`. |
| SD-15 who runs this, how often, what if he stops | 223 | **Merge into UR-05 (#238).** Keep SD-15's fourth paragraph (pure function of public sources, `SHA256SUMS`) — it is the best answer in either item. |
| SD-18 never announced to anyone | 389 | **Keep, blocked, Now.** Correctly a decision and correctly blocked. One note: it cannot be unblocked before `UR-05`/`SD-15`, because announcing a publication nobody's name is on is the wrong order. Add that dependency to the body. |
| IX-25 typo in SELECT answered with a lecture | 161 | **Keep — move to Now.** Verified live (`SELCT * FROM drivers` → the write refusal). S, and it is the console's only bad message. Merge `IX-22` (#153, the same edit-distance fix in search) into it: one `didYouMean()` helper, two call sites. |
| IX-22 one wrong letter is a flat refusal | 153 | **Merge into IX-25 (#161)** and move up from Someday. |
| IA-21 the no-match state is a dead end | 152 | **Keep, Next** (up from Someday). Small, and it is the moment the reader has told you exactly what they want. |
| IX-28 filtered empty state says two words | 141 | **Keep — move to Next** (up from Someday). Verified: Liechtenstein + Champions → *"Nothing recorded."*, which is a false claim about the data, not a statement about the filter. This is the strongest of the empty-state cluster and should be the one that lands. |
| PD-29 write the telemetry refusal where met | 155 | **Merge into CD-05 (#176).** Same sentence, overlapping surfaces; two items guarantee two wordings. |
| CR-25 NULL confidence prints `—` statically, nothing in the app | 171 | **Keep, Someday.** Correct, tiny, and no such row exists. Fold into whatever next touches `Page.jsx`'s `Confidence`; not worth a sitting of its own. |

### The empty/error cluster, resolved

`CD-17` (#260) closed as superseded → `IX-28` (#141, filtered empty, → Next) + `IX-25` (#161, console typo, → Now, absorbing `IX-22` #153) + `IA-21` (#152, no-match, → Next) + one new S for the boot-failure sentence. Four live items instead of five items and an inventory.

### The who-runs-this cluster, resolved

`UR-05` (#238) absorbs `SD-15` (#223) → Now. `SD-18` (#389) stays blocked behind it.

---

## Top ten for the whole project, from this discipline

Ranked by value against the three stated goals (reliable data in one place / commercialisable / less dull), size in brackets.

| # | Item | Size | Why |
|---|---|---|---|
| 1 | **One first sentence, in all four places** (new `CD-35`) | S | The static H1 is what a stranger and a crawler get, and it leads with the method. Everything downstream — announcement, citation, commercial pitch — needs one promise, and there are four. |
| 2 | **Say who publishes this and how to correct it** — `UR-05` #238 + `SD-15` #223 | S | A publication with no publisher cannot be cited by a Wikipedia editor, quoted by a journalist, or depended on commercially. Blocks `SD-18`. |
| 3 | **Race standfirsts that say something** (new `CD-38`) + **human dates** (new `CD-37`) | M + S | 1,163 pages, one template, no date. The largest page type and the commonest search arrival. This is the direct answer to "it is all a bit dull", and every fact it needs is already loaded. |
| 4 | **Retire the footnote about an "Out" that does not exist** (new `CD-36`) | S | Zero rows in the database match it; it is on 1,163 pages, under a column now reading *Finished*. Ten minutes. |
| 5 | **The em dash where the fact is established** (new `CD-39`–`CD-42`) | S ×4 | `Died —` on 310 living drivers, 6,282 dashes in 349 empty spec tables, `Entries (published) —` on 824 pages. The convention is the trust claim; it is wrong at volume. |
| 6 | **Figures typed into prose, checked by the build** — `PD-25` #195 absorbing `AF-63` #441, widened to `source_registry` | M | Seven wrong numbers on the sources page today. On a site whose product *is* verifiability, this is the finding that a hostile reader would lead with. One mechanism retires the class. |
| 7 | **Results abbreviations in the glossary, linked from the `Pos` header** — the S half of `CD-09` #179 | S | DNQ ×1,041, DNPQ ×336, NC ×200, DSQ, DNS, EX, PL — none defined anywhere, all in table cells. The cheapest comprehension gain on the site. |
| 8 | **The static footer's two privacy sentences** — `CD-31` #439 | S | *Nothing you type is sent anywhere* and *it works offline* are currently told only to readers who already stayed. Two strings. |
| 9 | **7,707 file-name captions** — `CD-29` #403, re-scoped | S | `Maserati 250 F, Bj. 1957 (1977-08-14) Südkehre.jpg` under an otherwise beautiful card, on 2,065 pages. One regex, already written elsewhere in the same file. |
| 10 | **`Car` is a constructor** — split out of `CD-12` #258 | S | A column header that is wrong, on 78 season pages, 80 circuit pages and `/races`, in a product that has a `/cars` route. Three lines. |

Existing: 2, 6, 7, 8, 9, 10 (and the `CD-12` split). New: 1, 3, 4, 5.

Eleventh, if there is room: the **270 hyphens doing an em dash's job** (`CD-47`, S). It is cosmetic on its own and load-bearing in aggregate, because it is the mark this site asks readers to read as a claim.
