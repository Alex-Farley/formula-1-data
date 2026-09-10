# Content design critique — 2026-09-10

**Critic:** `content-design-critic`, first run.
**Subject:** Lap Ledger at v2.20, `main`, working tree unmodified.
**Brief:** `.claude/CRITIQUE-BRIEF.md`. Prior work read: `docs/critiques/2026-09-10-product-design.md`, `docs/BACKLOG.md`.
**Method:** read the prose (`README.md`, `docs/`, `web/README.md`), the 22 page components, `web/scripts/prerender.js`, and queried the committed `f1.db` throughout. **I did not build the front end** — the brief said my discipline mostly does not need it and the pages are legible from source plus data. Every count below is a live query, not a reading of the README.

Findings are `CD-nn`. Sizes are S / M / L / ?.

**One correction after filing.** This critique as delivered gave the
`race_entries` denominator as 27,555 in two places. `SELECT COUNT(*) FROM
race_entries` returns **27,482**, which is the figure `CD-01` was filed with in
`docs/BACKLOG.md`, and both occurrences here now read that. The numerator
(15,714) and the finding are unaffected; the share moves from 57.0% to 57.2%.
Corrected rather than left standing because a file whose method line claims
every count is a live query does not get to carry one that is not.

**And five line citations in `CD-01`.** `Race.jsx:309` and `:313` are the "Out"
header and its footer at **298** and **312**; `prerender.js:554` and `:566` are
the static header row and the status cell at **555** and **563**; `missing()` is
`format.js:11`, not `:12`. Each was checked against the tree and corrected. The
other citations in this file were not audited line by line — the ones spot-
checked (`prerender.js:1218`, `Search.jsx:29`, `Home.jsx:233`, `smoke.mjs:859`,
`Race.jsx:440`) were all exact, so this looks like one cluster rather than
drift throughout. A wrong location is worse than none: a reader who opens
`Race.jsx:309`, finds a `render` callback, and concludes the finding is
imaginary has been misled by the citation, not the finding.

---

## The three that matter

### 1. Twenty drivers who finished the 2024 Bahrain Grand Prix are labelled, in the site's own words, as retirements nobody recorded a reason for

`Race.jsx:298` heads a column **"Out"**. `Race.jsx:312` footnotes it:

> "An empty “Out” is a retirement nobody recorded a reason for, not a driver who finished."

15,714 of 27,482 `race_entries` rows have `status IS NULL`. **All 15,714 have a finish position.** They are the finishers. `missing()` in `lib/format.js` renders them as an em dash, and the em dash is the one convention this site puts on its homepage, in its footer, and in its meta description.

So on every completed race page, the majority of the table says *unestablished* about a fact that is established, and a caption directly beneath asserts the wrong meaning. Verified by query:

    ./f1 sql "select finish_position, status, laps_completed from race_entries e
              join races r on r.id=e.race_id where r.year=2024 and r.round=1"
    → 20 rows, positions 1–20, status NULL for all twenty

The same column, unfootnoted, is on every driver page (`Driver.jsx:309`). The prerendered page has it too under a different header, "Status" (`prerender.js:555`).

**Ship instead:** render `status IS NULL AND finish_position IS NOT NULL` as **"Finished"**. Keep the em dash only where the driver has no finish position and no recorded reason. Then the footer becomes true and shorter:

> "“Out” is why a car stopped. A blank is a car that finished. A blank chassis is a season the team ran more than one design and no source says which raced here."

`CD-01`, S.

### 2. The lede of 111 driver pages explains the harvest; 1,172 race pages have no lede at all

`Driver.jsx:169` sets `lede={driver.notes}`. 111 of the 244 populated `notes` open with **"Added to the register from the podium harvest"** (62) or **"Added to the register from the pole position and fastest lap harvest"** (49). Chris Amon's page — and his Google snippet, built from the same string at `prerender.js:645` — reads:

> "Chris Amon, New Zealand, Formula One 1963-1976. 0 wins, 5 poles. Added to the register from the pole position and fastest lap harvest. Never won a World Championship Grand Prix. Pole and fastest-lap counts are derived from the race records; other career figures are not held. Widely held to be the fi…"

The sentence a reader came for is the one truncated away at character 300. Three sentences of provenance stand in front of it. This is the single clearest instance of the failure mode the brief names: **leading with the method on a well-engineered product.**

Meanwhile `races.note` is **populated on 0 of 1,172 races**, so `lede={race.note}` at `Race.jsx:170` is dead code and the largest page type on the site — the one a search arrival lands on — opens with an h1 and a grid of figures and not one sentence.

**Ship instead.** Amon: *"Widely held to be the finest driver never to win a championship Grand Prix: five poles and eleven podiums across 96 starts, and no victory."* Race pages, generated from columns the page already holds: *"Round 1 of 2024, at Bahrain International Circuit on 29 Feb – 2 Mar. Max Verstappen won for Red Bull from pole; 20 of 20 starters were classified."* And for a scheduled round: *"Round 5 of 2026, at Miami on 1–3 May. Not yet run, so this page carries a calendar entry and no result."*

`CD-02` (driver notes, S), `CD-03` (race ledes, S).

### 3. The explanatory layer is app-only. The reader who most needs it never gets it

Every convention this project worries about is explained in a `<DataTable footer>` or a `<Note>` — and `prerender.js` has neither. Grep confirms it: `dropped`, `shared drive` and the em-dash rule appear in `prerender.js` only in the three index-page ledes and one code comment. So the static page shows:

- a classification with a shared drive and **no** "two drivers took turns in one car" note (`Race.jsx:226` has it; `prerender.js:553` does not);
- `["Confidence", text(d.confidence)]` as a bare fact — **"Confidence: medium"** on 93 driver pages and **"Confidence: reference"** on 695 — with no definition, no link, and nothing on the page saying that "reference" is the third rung of five and not an endorsement;
- em dashes throughout, and a footer that, unlike the app's (`App.jsx:88`), drops the sentence explaining them (`prerender.js:203`).

This is not PD-02 again. PD-02 is about the static and the app printing *different numbers*. This is about them printing the same number with the explanation removed — which is worse for the deep-arrival reader, because they are given a figure they cannot read correctly and no clue that a rule applies.

**Ship instead:** three strings in `prerender.js` — one sentence appended to the static footer, one `<p class="note">` above any classification containing a shared drive, and the confidence value rendered as `medium — an exact figure may have drifted; confirm before publishing` with a link to `/reference/quality`.

`CD-04`, M.

---

## The full set, by consequence

### `CD-01` — The em dash lies in the one column where it appears most
*Evidence: read the source, queried the database. **Defect.*** *Size: S.*

Covered above. Locations: `web/src/pages/Race.jsx:298,312`, `web/src/pages/Driver.jsx:309`, `web/scripts/prerender.js:555,563`, `web/src/lib/format.js:11`.

Measurement: 15,714 of 27,482 entries (57.2%), on all 1,161 completed race pages and 862 driver pages.

One caution: do not fix this by changing `missing()`. The empty-string / NULL collapse is correct everywhere else. Fix it at the two render sites, where the domain knowledge lives.

### `CD-02` — 111 driver ledes and meta descriptions open with how the row got into the database
*Evidence: queried the database, read the source. **Defect.*** *Size: S.*

`drivers.notes`, 111 of 244 rows. Consumed as a page lede at `Driver.jsx:169` and as the meta description at `prerender.js:645`.

The good news is that it is bounded and the good sentence usually already exists at the end of the string. The fix is a data edit, not a code one: move the provenance clause out of `notes` and into the "Where this comes from" section that `Driver.jsx:373` already renders. Two replacement patterns, both derivable:

- Podium harvest, no bespoke sentence (many of the 62): *"Reached the podium in Formula One without ever winning: three third places for Ligier between 1979 and 1981."* Where nothing bespoke is known, no lede at all is better than a lede about the harvest.
- The source note beneath, where the caveat has to stay: *"This driver's wins, poles, podiums and fastest laps are counted from the races listed above. Entries, starts and career points are not held for them."*

That caveat is an accuracy obligation and must survive. It is currently 24 words of lede; make it 22 words of source note, below the fold, where it belongs.

Also check `constructors.notes` (65 rows, 0 leaks) and `circuits.notes` (80 rows, 1 leak) — they are clean, which shows the leak is a drivers-only harvest artefact rather than a house style.

### `CD-03` — 1,172 race pages have no standfirst, and the field they would use is empty on every row
*Evidence: queried the database, read the source. **Defect.*** *Size: S.*

`SELECT COUNT(*) FROM races WHERE note IS NOT NULL AND note <> ''` → **0**, against 1,172 rows.

The prerenderer already composes a decent sentence for the meta description (`prerender.js:480-482`) and then does not put it on the page. Put it on the page, in both renderers, from the same expression:

> "Max Verstappen won the 2024 Bahrain Grand Prix for Red Bull, round 1 of 24, at Bahrain International Circuit on 29 Feb – 2 Mar. Twenty starters, twenty classified."

Where the winner is unknown: *"Round 3 of 1952, at Spa-Francorchamps. The classification below is what this database holds; no winner is recorded."*

This is the highest-volume missing sentence on the site, and it costs one function.

### `CD-04` — The static half of the site prints the numbers and deletes the rules for reading them
*Evidence: read the source. **Defect.*** *Size: M.*

Covered above. Three specific strings:

1. Static footer (`prerender.js:203`) — append: *"Career totals are counted from the race records where the records support it, and an em dash means nobody has established that figure — never zero."* (This sentence already exists in `App.jsx:88`; it was simply not copied across.)
2. Shared drive on a static classification (`prerender.js:553`) — insert above the table when any entry has `shared_drive = 1`: *"This race includes a shared drive: two drivers took turns in one car and both are classified in the same position, so a position appears twice below. That is correct, not a duplicated row."*
3. Confidence as a bare fact (`prerender.js:547`, `:685`, and the constructor/car/circuit equivalents) — render the value with its one-line definition and a link, not alone.

Ownership note: item 3 overlaps `PD-02`'s "make the prerenderer call the page components' own queries". If `PD-02` is done as a shared-query refactor, 1 and 2 come free; if it is not, these three are independently shippable and I would ship them first, because they are ten lines and no data change.

### `CD-05` — `PD-12` answered: the words for the lap-timing position, and the four places they go
*Evidence: read the docs, read the source, queried the database. **Preference, high leverage.*** *Size: S.*

The owner asked for a position. Here it is, in three lengths.

**The claim, one sentence** (for `/data`, the README opening, and the GitHub repo description):

> Everything in Lap Ledger is something you may republish.

**The position, one paragraph** (for `/reference/sources`, as a seventh row in the *"What a licence cost, or bought"* table — Source: *Formula One live timing*, Licence: *none available*, Consequence:)

> Nobody publishes Formula One lap timing under a licence that permits passing it on. Rather than host it anyway, this database contains none: `laps`, `stints`, `race_timing` and `race_control_messages` are empty and will stay empty. The cost is that you cannot ask this database about a lap time. The benefit is that there is nothing here you have to strip out before you republish it.

**The pointer, one line** (in the SQL console schema browser beside `laps`, `stints`, `race_timing`, `race_control_messages`, and as the empty-result message when a statement returns nothing from one of them):

> Empty by design — no source licenses Formula One lap timing for redistribution. [Why](/reference/sources)

That last placement is the one that actually matters and is currently missing entirely. `Sql.jsx:220-234` lists all 46 tables in a schema browser with no row counts and no annotation, so `laps` looks like a table with data in it; `SELECT * FROM laps` returns `"The statement ran and matched nothing."` (`Sql.jsx:192`) — which, to a developer evaluating the database, reads as a bug in their query. The explanation exists on a gaps page they have no reason to open. **Explaining it twice, in the right places, beats explaining it once well on `/reference/quality`.**

Then delete `known_gaps` #5 from the public list (see `CD-06`). A constraint stated as a position stops being a gap.

I also endorse the constraint itself. I looked for a content angle on which the empty tables could be softened or hedged and did not find one: the current prose in `docs/TIMING-ARCHITECTURE.md` is accurate and the only problem is where it is filed.

### `CD-06` — `PD-05` answered: eleven gaps split into six reader sentences and eleven maintainer notes
*Evidence: queried the database, read the source. **Defect.*** *Size: S (copy) + S (the `state` column `PD-05` already specifies).*

`PD-05` says four of eleven are closed or not gaps. **I count five.** #1 and #2 are closed; #5 and #10 are positions, not gaps; #8 is a true null belonging on one race page. That leaves **six** genuine open gaps, and the homepage's "11 known gaps" claim (`Home.jsx:233`) should read six.

The `./f1 gaps` CLI has the same defect and the same header — "KNOWN GAPS — what the data does not yet cover" printing three entries beginning "CLOSED in".

Below, the reader sentence for each. The maintainer note is *everything currently in `description` and `resolution`* — none of it should be deleted, all of it should stop rendering to `/reference/quality`.

| # | Public? | Reader sentence |
|---|---|---|
| 1 | no — closed | (retire; the residue is a `BUILD-NOTES` entry) |
| 2 | no — closed, but two live facts escape | Split out as a **convention**, not a gap, and put it on race pages before 1965: *"One driver, one row. Where a driver drove two cars in one Grand Prix — normal before 1965 — this database keeps the better result and not both."* And as a second open gap: *"118 classifications read differently in two sources. Where a driver was disqualified, one source leaves the position vacant and the other promotes everyone below. Neither is wrong, and nobody has yet read the 118 to decide which this database should follow."* |
| 3 | **yes** | *"We do not know which car won 287 of 1,161 races. Where a team ran more than one design in a season and no source says which raced which round, the chassis is left blank rather than guessed. Closing it needs per-round entry lists, which no source in use here publishes."* |
| 4 | **yes** | *"For a handful of seasons we cannot say which car took a pole. Ninety-nine per cent of pole entries now name a constructor, but where a team ran two designs — McLaren's M23 and M26 through 1976 and 1977 — attributing the pole to one of them would be a guess."* |
| 5 | no — a position | (see `CD-05`) |
| 6 | **yes** | *"No race times. The winner's time, the fastest lap time and the margin are published race by race rather than season by season, so filling them means reading 1,161 individual race reports. That has not been done."* |
| 7 | **yes** | *"For 67 of 80 circuits we hold one shape — the current one. So a 1976 Kyalami lap is reported at the length of the 1992 rebuild. Thirteen circuits have a full configuration timeline; the rest say “current layout” where a race page cannot say “as raced”."* |
| 8 | no — a true null | Move to the 2021 round 12 race page as a note: *"No fastest lap was set. The race was abandoned after two laps behind the safety car, half points were awarded, and no racing lap was completed. The blank here is correct."* |
| 9 | **yes** | *"No sector times, tyre compounds or qualifying session detail before 1996. A pre-1996 qualifying session was a single time, so there are no Q1/Q2/Q3 figures to hold; sector times were never published at all before the live-timing era."* |
| 10 | no — a position | State on `/circuits/atlas` and `/reference/sources`: *"A traced circuit is always the circuit as it is today. OpenStreetMap maps what is on the ground, and Spa's 14.1 km road course is not on the ground any more. Historic layouts have no trace rather than a modern shape standing in for them."* |
| 11 | **yes** | *"We cannot confirm that 337 photographs show the car they are filed under. The article is verified; the picture in it is not, and there is no second source to check it against. One car article leads with a photograph of police officers."* |

Note the `races_affected` column is `'0'` on ten of eleven rows, including gap #3 which affects 287 races. Either populate it or drop it from the public table — a column headed with a count that is zero on a row about 287 races is worse than no column.

### `CD-07` — `PD-11` answered: what `/data` says
*Evidence: read the docs, queried the database. **Preference, high leverage.*** *Size: S for the copy; `PD-11`'s M is the page.*

The claim has to survive the reader thinking "I already have F1DB". So it cannot be "F1 data" and it cannot be a feature list. It is one adversarial sentence:

> **The Formula One record, audited.**
>
> Every race from 1950 to 2026 as one SQLite file, with the audit attached: a confidence level on every row, ~170 cross-checks that must pass before a byte is published, 60 recorded disagreements between sources kept rather than quietly resolved, six gaps stated in plain English, and a licence classification on all 16 sources so you know what you may republish. Nothing here is scraped from a source that forbids it, so everything here is something you may pass on.
>
> [SQLite, 20 MB] [Parquet, 1.5 MB] [JSON, 21 MB] · v2.20, built 2026-09-09 · CC BY-SA 4.0, with per-source terms on the sources page.

Three things that copy is doing deliberately:

1. **"Audited" is the noun, not "verified".** Verified is already a rung on the confidence ladder; using it for the whole product makes the ladder unreadable.
2. **The last sentence is `CD-05`'s claim.** Absence of lap times is the differentiator on `/data`, not a caveat — it is why the download is safe.
3. **It names the counts, and every one is a query.** They must be generated, or `PD-07` will happen to this page too within two versions.

One thing `/data` must carry that nothing else does, because `PD-11`'s backlog note says the files themselves will never be crawlable: *"`f1.db` carries no OpenStreetMap data. The 25 traced circuit centrelines ship beside it as `f1-geometry.db` under ODbL. Download both, or you get the database with no maps."* That is a licence obligation stated as a download instruction, which is the right form.

### `CD-08` — `PD-10` answered: what the citation block reads like
*Evidence: read the source, queried the database. **Preference.*** *Size: S.*

`Race.jsx:437` and `Driver.jsx:334` already render a section titled **"Where this comes from"**. That is the right heading and the right place; the block belongs inside it, not as a new component at the foot of the page. Rendered:

> **Cite this page**
>
> Lap Ledger. "Chris Amon". Database v2.20, built 2026-09-09. https://lapledger.org/drivers/amon (accessed 10 September 2026).
>
> Behind this page: F1DB (CC BY 4.0), Wikipedia season results tables (CC BY-SA 4.0). Wins, poles and fastest laps counted from the race records; entries and starts as published.
>
> [Copy] [Copy BibTeX]

Notes on the wording, since the owner asked what it *reads* like:

- **"Built 2026-09-09", not "accessed"** as the primary date. `BUILT` is a constant precisely so this is stable, and that is a genuine advantage over every source a Wikipedia editor would otherwise cite. The access date is second and browser-generated.
- **The second paragraph is the whole point.** A citation that names only the site is a citation of a middleman. Naming the distinct sources behind the rows on *this* page — which `source_registry` can supply — is what makes the block worth building rather than a `<link rel=canonical>`.
- **Do not put a confidence tier in the citation string.** It changes between builds and would make an old citation look like it said something it didn't. Show the tier on the page, above the block, where it already is.
- Prerender it. A crawler and a no-JS reader are two of the three audiences that would use it.

### `CD-09` — The glossary defines the sport's vocabulary and not the product's
*Evidence: queried the database, read the source. **Defect.*** *Size: M.*

44 terms: Apex, Bargeboard, Blistering, Box, Marbles, Porpoising. All correct, all well written, none of them the words a newcomer trips on *here*.

Missing, and each of them appears in a table cell on a page with no definition anywhere on the site:

- **DNQ** (1,041 `position_text` rows), **DNPQ** (336), **NC** (200), **DSQ**, **DNS**. `DNF` is the *only* results term in the glossary.
- **FL** (`Driver.jsx:238`, and `Quality.jsx:211-212` as "FL derived" / "FL published").
- **Classified** — appears as a stat note ("20 classified") and as a column, and it is the term that explains why a driver who retired still has a position.
- **Entry** vs **start** — the distinction the driver page's source note leans on and `PD-06` is blocked behind.
- **Chassis** vs **car** — the site has both a `/cars` route and a `Chassis` column, and the register lede at `Cars.jsx:49` uses both words for two different things in one sentence.
- **Confidence**, **verified / high / reference / medium / unverified**, **discrepancy**, **known gap**, **derived** vs **stored**. The product's own vocabulary is entirely undefined in the place a reader would look it up.

**Ship:** a second glossary category, `this database`, holding those fifteen or so terms, and — more importantly — link to it from the point of use. Two links do most of the work: the `Confidence` pill (`Page.jsx:113`) and the `Pos` column header on a classification.

Definitions to ship for the two hardest:

> **Reference** — Harvested from a published results table and checked against a second, independent source. Reliable; not official. Cite the FIA archive if you are publishing.
>
> **Unverified** — Nobody has been able to check this yet. It is here rather than hidden because leaving it out would be a stronger claim than we can make. Do not state it as fact.

### `CD-10` — The confidence pill is a bare word on 13 pages and the ladder is one nav item and two clicks away
*Evidence: read the source, queried the database. **Defect.*** *Size: S.*

`Page.jsx:110-115` renders `<span class="pill">{value}</span>`: no `title`, no link, no explanation. It is used on 13 of 22 pages — which `PD` correctly called a success of *reach*, and it is. But reach without a definition at the point of use is how you teach a reader that "medium" means "this site is unsure of itself" rather than "an exact figure may have drifted".

Two specific mis-readings the current wording invites:

- **"reference" reads as an endorsement.** 695 of 862 drivers carry it. In ordinary English a reference work is authoritative; here it is rung three of five and the word is doing the opposite of its job. If you will not rename it (and there is a real cost — it is a `provenance` primary key and reaches `f1_compat.json`), then it must never appear without its gloss.
- **`may_publish` renders as "Safe to quote: not without checking"** (`Quality.jsx:102`). "Not without checking" in a column headed "Safe to quote" answers a different question from the one asked. Ship: **"Quote it?" → "Yes" / "Check first"**.

Make the pill a link to `/reference/quality#ladder` with a `title` carrying the one-line definition. Six lines of code, and it converts the differentiator from decoration into a claim a reader can act on.

### `CD-11` — Meta descriptions at scale read as schema output
*Evidence: read the source, queried the database. **Defect.*** *Size: S.*

Generated at `prerender.js:645`. A results-list sample, verbatim:

> "Adolf Brudes, Germany, Formula One 1952-1952. 0 wins, 0 poles."
> "Adolfo Schwelm Cruz, Argentina, Formula One 1953-1953. 0 wins, 0 poles."
> "Al Herman, United States of America, Formula One 1955-1960. 0 wins, 0 poles."

618 driver pages have no `notes`, so this is the whole description for the majority of them. "0 wins, 0 poles" is the answer to a question nobody typed. And note the internal contradiction: this project's central convention is that *zero is a claim*, and the description asserts zero for figures that in several cases are derived rather than established.

**Ship:** describe what the page holds, not what the driver failed to do.

> "Adolf Brudes started one championship Grand Prix, the 1952 German, for Veritas. Full entry list, result and source on Lap Ledger."

For someone with a record: *"Chris Amon: 96 starts, 5 poles, 11 podiums and no wins, 1963–1976. Every entry, season by season, with sources."*

Two mechanical points while you are in there: the 300-character limit (`prerender.js:487`) is beyond what any search engine renders — 155 is the working budget, and truncating at 300 means the useful clause is cut *and* invisible; and `titled()` produces "Chris Amon — Lap Ledger", which is fine for a person but leaves 1,153 chassis pages titled "Ensign N177 — Lap Ledger" with nothing distinguishing them from a Wikipedia stub in a results list. **"Ensign N177 (1977–1979) — Lap Ledger"** costs one string and earns the click.

### `CD-12` — One concept, several words
*Evidence: read the source. **Defect** where the two renderers disagree; **preference** elsewhere.* *Size: M.*

Two words for one thing teaches a reader they are two things. The instances, worst first:

| Concept | Words in use | Where |
|---|---|---|
| Why a car stopped | **Out** (app) / **Status** (static) | `Race.jsx:298` vs `prerender.js:555`. Defect: same table, two renderers, two headers. |
| A row in `race_entries` | **Entries** / **Race entries** / **Starts** / **Races** / **Grands Prix** | `Home.jsx:109,113`, `Driver.jsx:175,234`, `Cars.jsx`, `Constructors.jsx`. `PD-06` is partly blocked on this. Pick two words — **entry** and **start** — define both in the glossary, and never use a third. |
| Where a driver finished | **Pos** / **Result** / **Best** | `Race.jsx:253`, `Driver.jsx:296,240` |
| Fastest lap | **Fastest laps** / **Fastest lap** / **FL** | `Driver.jsx:179,238`, `Quality.jsx:211` |
| A car | **Car** / **Chassis** / **Design** | `/cars` route, `Chassis` column, `Designs entered` at `Quality.jsx:301` |

The `Out`/`Status` split is the one to fix today because it is two renderers of one table. The rest is a vocabulary pass, and it is worth doing as one sitting with a written list rather than opportunistically — that is how you end up with a sixth word.

### `CD-13` — The site tells a reader why a grid penalty happened, and it does not know
*Evidence: read the source, queried the database. **Defect.*** *Size: S.*

`Race.jsx:204` and `prerender.js:543` render, where the fastest qualifier did not start first:

> "started P4, after a grid penalty"

Nothing in the database records *why* a driver started lower than they qualified. It could be a penalty, an engine change, a pit-lane start, a qualifying disqualification, or a car that failed to take the grid. On a site whose entire claim is that it does not guess, an unconditional `else` branch stating a cause is exactly the class of thing it refuses everywhere else.

**Ship:** *"started P4 — this database does not record why."* Or, better, the neutral statement of what it *does* know: *"Quickest in qualifying, but started P4."*

This is also where `PM-05`'s modelling decision surfaces to a reader, so the two should be written together. Whichever way `PM-05` goes, the sentence above is safe.

### `CD-14` — The homepage explains four conventions and there are seven
*Evidence: read the source. **Preference.*** *Size: S.*

`Home.jsx:204-238`, "Reading the numbers here", note: *"Four things worth knowing before you quote anything off this site."* It covers the em dash, disagreements, the ladder and the gaps. It omits the three that actually get read as bugs: a repeated finishing position, a pre-1991 margin, and a stored figure shown beside a derived one.

I would not add three more panels — six is a wall. Change the framing so the section is a door rather than a list:

> **Reading the numbers here**
> Four conventions that make this site's tables read differently from anyone else's — and a page that explains the rest.

…with the fourth panel replaced by:

> **Some of it looks wrong on purpose.**
> A finishing position that appears twice is a shared drive. A pre-1991 championship margin is net of dropped scores. Where a stored and a counted figure disagree, you get both. [How to read a table here →](/reference/quality)

Which, honestly, is where the conventions belong as a set — the audit page currently opens with confidence and never states the reading rules at all.

**Endorsement, since the brief asks for them.** I tested the "explained where met, or only in a glossary?" question the owner posed, and the answer is better than the question assumes. `Race.jsx:226` explains a shared drive *above* the table containing one. `Driver.jsx:324` explains two career points totals in a `<Note>` that only renders when they actually differ. `Seasons.jsx:91` explains the pre-1991 margin in the footer of the table that shows it. `Cars.jsx:49` explains the em dash in the lede of the register full of them. **That is content design done properly and it should not be touched.** The failures are elsewhere: (a) none of it reaches the static page (`CD-04`); (b) it is placed *below* the table as often as above it, which is right for a caveat and wrong for a rule a reader needs before they read the number; (c) `unverified` is the one convention on the owner's list with no in-place explanation anywhere (`CD-10`).

### `CD-15` — `./f1 gaps` prints "what the data does not yet cover" and then prints three entries beginning "CLOSED"
*Evidence: ran the tool. **Defect.*** *Size: S.*

Same content as `CD-06`, different surface, and the CLI is the surface the bulk-data audience actually touches. When `PD-05`'s `state` column lands, this command must filter on it too, and its header should read:

> **KNOWN GAPS — what this database does not hold, and what would close each one**

`./f1 licences` by contrast is very good: the three-line legend ("`yes` may be redistributed on the terms given / `facts-only` the facts may be restated; none of the source's own expression is held here / `no` may not be redistributed — verify.py fails on one") is a model of explaining a scheme at the moment it is met. It is the single best piece of microcopy in the repository and `CD-05`'s schema-browser line should be written to match it.

### `CD-16` — The README's first sentence defines the product by its own history
*Evidence: read the docs. **Defect of framing; the staleness is `PD-07`.*** *Size: S.*

> "An expansion of the original single-file JSON into a normalised, queryable SQLite database covering 1950–2026, with the JSON kept as a generated export."

A reader arriving at the repository does not know there was a single-file JSON and does not care. `PD-07` already schedules moving the version log out; this is what should replace it, and it is `CD-07`'s claim in repository voice:

> # Lap Ledger
>
> The Formula One championship record, 1950–2026, as a SQLite file you can check: 119,271 rows across 46 tables, every one carrying the source it came from and a confidence level, with ~170 cross-checks that must pass before a build is published.
>
> Where two sources disagree, the disagreement is recorded rather than resolved. Where nothing is known, the cell is blank and the gap is written down. There are no lap times, because nobody licenses them for redistribution — which means everything that *is* here, you may pass on.
>
> `f1.db` (20 MB) · `f1-geometry.db`, the ODbL circuit traces, ships beside it · Parquet and JSON exports on the release page · lapledger.org queries the same file in your browser.

### `CD-17` — Error and empty states: an inventory
*Evidence: read the source. **Mixed.*** *Size: S each.*

Written down as the brief asks, with what each currently says:

| State | Current | Verdict |
|---|---|---|
| Boot, in progress | "Downloading the database — Seventy-seven seasons are arriving as one database file. It downloads once, then it stays in your browser — later visits open straight away, and work offline." | **Excellent.** Names the phase, sets the expectation, justifies the wait. Do not touch. |
| Boot, failed | "The database could not be opened" + raw error + a paragraph about `npm run build` and `file://` | **Wrong audience.** A reader on lapledger.org gets developer instructions for a checkout they do not have. Ship: *"The database could not be opened. This usually means the download was interrupted — reload the page to try again. If it keeps happening, the site's data file may be temporarily unavailable."* Keep the developer paragraph behind "Running this from a checkout?" |
| Query failed (`ErrorBox`) | "The query failed" + raw message | Acceptable, because it should never fire — the database is local. Leave it. |
| SQL console, refused | "Reads only: start with SELECT, WITH, VALUES, EXPLAIN or PRAGMA. A write would be rolled back anyway, so nothing has changed." | **Excellent.** Refuses, explains, and reassures in one sentence. The best error message in the project. |
| SQL console, SQLite error | context "SQLite refused that" + raw message | Good context, no way forward. Add: *"The schema list on the right has every table and its columns."* |
| SQL console, 0 rows | "The statement ran and matched nothing." | Correct in general and wrong for `laps`/`stints`/`race_timing`/`race_control_messages` — see `CD-05`. |
| Table, 0 rows | "Nothing recorded." (default, `DataTable.jsx:50`) | **Weak, and it is the default on ~50 tables.** Under this site's own convention "nothing recorded" is a strong claim. Ship: *"No rows here."* as the neutral default, and override it wherever the absence means something — as `Car.jsx:315` already does, beautifully: *"No race entry in this database resolves here. That is usually a constructor that ran several designs in a season and no source saying which raced when, not a car that never raced."* That string is the model. Two or three more like it (a driver with no wins; a circuit with one race; a constructor with no cars) would cover most of the real cases. |
| Search, no match | "No match — Nothing in the register answers to that." | Good voice, no way forward. Add: *"Try a surname, a circuit, or a year."* |
| 404, app | "No such page — That address is not one this site has. Press / to search…" | Good. |
| 404, static | "Not found — There is no page at this address. It may have been a typo, or a link to something this database does not hold." + nav list | Good, and correctly does not mention the `/` shortcut, which needs JS. Keep both; they differ for a reason. |
| Race not yet run | "This race has not been run. It is on the {year} calendar and carries no result yet." | Good. |

---

## What is genuinely good — name it so an edit pass does not remove it

- **`/reference/sources`, the "What a licence cost, or bought" table.** `PD` said it and it is still true: a licence written as a consequence rather than a name. Everything I have proposed for `/data` and the README is written to sit beside it.
- **`Boot.jsx`'s four-phase wait copy**, and the comment explaining why a spinner would have been worse. It tells a reader which of four things is happening and what they get for waiting.
- **`Disagreement.jsx`**, including `label()` — *"`fastest_laps` is a column name. The reader is owed the words."* That one comment is the whole discipline in eleven words, and the component's closing line — *"Recorded rather than resolved, and open for somebody to settle"* — is the best sentence on the site.
- **The conditional `<Note>` at `Driver.jsx:324`**, which only appears when two totals actually differ and then explains why both are right. Explaining a thing exactly when it is confusing, and not otherwise, is rarer than it should be.
- **`Car.jsx:315`'s empty state.** The only bespoke one, and it is a small essay on why the absence is correct. Copy its approach, not its length.
- **`./f1 licences`'s three-line legend.**
- **The `Onward` hints throughout** — "Why a 1955 points total cannot be compared with a 2025 one", "The figures these checks are protecting". They give a reason to click rather than naming a destination, and there are about sixty of them, all written by hand and all good.
- **Reading level generally.** Sampling the hand-written ledes, the prose is plain, British, active and short — sentences average well under 25 words, with almost no nominalisation and no marketing register anywhere. The house voice is real and worth defending. Where it fails it is not because the writing got worse; it is because a database column got rendered where a sentence should have been.

## What I did not examine

- **The rendered site.** No build, no browser, per the brief's instruction. Everything about the app's appearance is inferred from the components and the prerenderer. Two consequences: I cannot say what the copy looks like at mobile width, and where a `<Note>` or a table footer sits relative to the fold is inference (`CD-14`b in particular).
- **Any real reader.** Comprehension claims here are a content designer's judgement, not a test. The five conventions are all testable with five people and an hour, and that is `UR`'s to run.
- **`Eras.jsx`, `Atlas.jsx`, `Circuit.jsx`, `Constructor.jsx`, `Season.jsx`, `Records.jsx`** beyond grepping their labels and ledes. `Eras.jsx:110`'s dropped-scores note is good; I did not read the era prose itself, which is 263 lines of the most reader-facing writing on the site and deserves its own pass.
- **The 552 short prose fields flagged in `PM-17`.** That is a licence question, but it is also a content question — nobody has read them as reader-facing copy, and `CD-02` is evidence that at least one register's prose has never been read that way.
- **`web/README.md` and `docs/` as documents.** Read for context, not critiqued; they are internal and a different job.
- **Chart captions and axis labels**, and the tables that accompany each chart. `VD` and `AX` overlap there.
- **The GitHub release body and repo description** (`PM-04`), which are reader-facing copy this project cannot check.
