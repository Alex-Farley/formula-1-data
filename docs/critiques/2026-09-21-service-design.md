# Service design critique — 2026-09-21

**Critic:** `service-design-critic`, second run (first was 2026-09-11, `docs/critiques/2026-09-11-service-design.md`).
**Subject:** the whole service at `main` = `7852de1` (the checkout moved from `dda5afb` during the run, when #466 merged; `f1.db` was unchanged by it); the live site at lapledger.org, serving the same commit; the local build on :4179, one merge behind; the public repository `Alex-Farley/formula-1-data`; the five workflows; releases v2.17–v2.24; the 181 open issues. Not the interface: eight other critics have it.
**Posture:** read-only. Nothing in the repository was modified; no issues were filed (the maintainer suspended that instruction for this run). One Playwright script and one `git show` ran against copies under the session scratchpad.

**Evidence tags:** `probed the live service` (an HTTP request to lapledger.org or the GitHub API today), `drove the site` (Playwright against the local build on :4179), `queried the database`, `read the source`, `read the docs`, `inference`.

**New findings are `SD-24` to `SD-36`** (`next.py --next-id SD` prints `SD-24`). Sizes are the brief's: S one sitting, M a few sittings shippable in pieces, L a decision before a task.

---

## The three that matter

### 1. Two different databases both call themselves "v2.24, built 2026-09-16", and the site tells you to check one against the other's checksums (`SD-24`)

*`probed the live service`, `queried the database`, `read the source`. Defect. S–M.*

Measured today:

| | SHA-256 (first 16) | `meta.version` | `meta.built` |
|---|---|---|---|
| `https://lapledger.org/f1.db` | `43c3a66f84f0f43c` | `2.24` | `2026-09-16` |
| GitHub release `v2.24` asset `f1.db` | `d9665a5104062ace` | `2.24` | `2026-09-16` |

Eleven commits have changed `f1.db` since the tag (`git log v2.24..HEAD -- f1.db`), including a new `catalogued` confidence rung, rewritten `formula1.com` citations and changed power notes. `BUILT` only moves on a *harvest* refresh; `data/*.py` moves on any commit. So `built` is a statement about F1DB's freshness that the front stage presents as a statement about this database's identity.

Three published claims are false as a result:

- `web/src/lib/site.js:72`, printed on all 3,541 pages: *"Cite this page as Lap Ledger, database v2.24 built 2026-09-16 … The version and build date fix which figures you saw."* They do not.
- `/changes`: *"Each release carries the version stamped into the database's own `meta` table, so a file you downloaded can be placed in this list without trusting the page it came from."* Two files place in the same row.
- `web/src/pages/Data.jsx:174`: the app's `/data` shows `f1.db digest 43c3a66f84f0f43c` and then says *"The full digests ship as `SHA256SUMS` with each release."* A user who follows that instruction downloads `/f1.db`, fetches the v2.24 `SHA256SUMS`, runs `shasum -c`, and gets **FAILED**. The attribution rule in this project fails closed everywhere; the integrity rule fails into a mismatch that looks like tampering.

`SD-07` (#216) predicted the version half of this in September and was ranked in *Next*. The measured state is worse than the prediction, because `built` collides too, so the pair the whole feed and changelog design rests on (`changes.js`: *"identified by the PAIR (`meta.version`, `meta.built`)"*) is not unique.

**Do:** the identity already exists and is already computed — `db-manifest.json`'s `digest` is the first 16 hex of the SHA-256 of the served file, verified today. (a) Put it in the citation string, in the static footer and in the `Dataset` JSON-LD as `identifier`; `prepare-assets.js` writes the manifest before `prerender.js` runs, so the prerenderer can read it. (b) Serve the full `SHA256SUMS` from the site for the site's own copy, which is what `AF-02` (#192) part 2 already asks for, and stop pointing at the release's. (c) Correct the `/changes` sentence. This is the single cheapest thing that makes the project citable, and every commercial conversation below depends on it.

### 2. Nothing anywhere says when the service last *checked*; only when the data last *changed* (`SD-25`)

*`probed the live service`, `read the source`, `read the docs`. Defect. S.*

`/changes` says *"This database is rebuilt from its sources every morning"*, and shows `Built 2026-09-16`. Behind it, `refresh.yml` has run on schedule on each of the ten days to 2026-09-21: nine successes and one failure (2026-09-13, `verify.py`: `harvest/chassis.txt does not name the F1DB version it came from`). **None of those ten runs reached any public surface.** A successful no-change run commits nothing, so nothing deploys, so nothing moves.

`/build-status.txt` looks like the answer and is not: it is written by `parquet-bundle.mjs` during a *deploy*, so it is a deploy heartbeat. Live it reads `when 2026-09-21T14:23`, which is today only because a pull request merged today. Stop merging and it freezes with everything else.

The front-stage consequence: on, say, 20 October, a reader seeing `Built 2026-09-16` cannot tell whether F1DB has published nothing (impossible — four races will have run) or whether the pipeline died. `SD-14` (#222) predicts exactly that death: GitHub disables a schedule after 60 days of repository inactivity, and the winter break is ~90 days in which `refresh.yml` deliberately commits nothing. The two findings are the same mechanism from opposite ends.

**Do:** have `refresh.yml` write the date on the **no-change path too** — a single-line `harvest/.last-checked` or a key in `meta` — and commit it. Three consequences for one change: the front stage can say *"Checked 21 September; last changed 16 September"*, which is the honest sentence; the repository gets a daily commit, which kills `SD-14` outright; and the deploy that follows refreshes `build-status.txt` daily. Cost: one Cloudflare build a day (~30/month against a 500 free-tier allowance) and a one-line diff in the harvest that must be excluded from the `BUILT`/rebuild gate. If a daily deploy is unwanted, the cheaper half is the wording alone: *"Checked daily; the data last moved on 16 September"* is true today and costs nothing.

### 3. The service is confidently wrong for about a day after every race, and the race page does not say so (`SD-26`)

*`queried the database`, `read the source`, `probed the live service`. Defect. S.*

Measured on the most recent race. Madrid Grand Prix, Sunday 2026-09-13. The only automated harvest commit in this repository's entire history is `0b174f5`, `2026-09-14 11:47:10 UTC`. The classification therefore reached the site roughly **23 hours** after the flag, and for those 23 hours `/races/2026/14` said, statically and in the app: *"This race has not been run. The classification will appear here once it has."*

That window is systematically longer than the cron implies, and three channels state the cron rather than the behaviour. `refresh.yml` says `cron: '0 6 * * *'`; `README.md` line 1084 says *"every day at 06:00 UTC"*; `/changes` says *"refreshed daily at 06:00 UTC"*; `changes.js` says it again. The ten observed scheduled starts are **10:03, 10:16, 10:32, 10:35, 10:49, 10:55, 11:02, 11:03, 11:44, 11:57 UTC** — a mean delay of 4 h 52 m, which is ordinary for a top-of-hour cron on shared public runners. So the real daily check is ~11:00 UTC, and a Sunday race that F1DB publishes after 11:00 on Monday waits until Tuesday: a 46-hour worst case, with nothing to say so.

Why it matters more than its size: this is the only window in the week when a general F1 audience is actively searching, and it is the window in which this service makes a confident false statement about the sport's most-searched fact. Every other freshness problem here is a stale figure; this one is a wrong sentence.

**Do,** three independent S pieces: (a) move the cron off the hour — `'17 5 * * *'` typically lands 1–3 h earlier than `'0 6 * * *'`; (b) make the three published cadence statements describe the behaviour (*"checked every morning, usually by 11:00 UTC"*) rather than the crontab; (c) `AF-01` (#184) already owns the race page's half — the sentence it needs is *"The classification is added within a day of the flag; this page was built on 16 September"*, which converts a false claim into a true one for free. Adding a second daily run at ~15:00 UTC on Mondays would halve the window and cost one extra short job a week.

---

## The map

Every way a person meets this service today, what each says about currency, what it actually is, and which finding owns the gap. Changes since 2026-09-11 are marked.

| Touchpoint | Public | Carries data | Currency it shows | Currency it has | Seam |
|---|---|---|---|---|---|
| Search result → prerendered page | yes | facts | footer `v2.24 / Built 2026-09-16` **(new)** | commit of last deploy | `SD-24` |
| lapledger.org, app | yes | yes | same, plus `/data` digest in app only | the served bytes | `SD-24` |
| `/data` **(new)** | yes | links all 3 served files | version, built, coverage | current | `SD-29` (names 2 files it does not serve; links no release) |
| `/changes` + `/feed.xml` **(new)** | yes | counts | version, built, 7 releases | current | `SD-25`, `SD-27`, `SD-23` |
| `/f1.db`, `/f1.db.gz`, `/f1-geometry.db` | yes | yes | `meta` inside the file | authoritative | — handled |
| `/f1-parquet.zip` | yes | yes | `meta.parquet` inside the zip | rebuilt each deploy | `PM-23` (no plain-text notice), `SD-30` (no per-table file) |
| `/db-manifest.json` | yes | manifest | `digest`, `built`, `staged` | **authoritative** | — handled, and under-used (`SD-24`) |
| `/build-status.txt` | yes | no | deploy timestamp | last deploy, not last refresh | `SD-25` |
| `/schema.sql`, `/ATTRIBUTION.md`, `/LICENSE-DATA` **(new)** | yes | docs | — | current | `SD-22` (Parquet unnamed) |
| `/robots.txt`, `/sitemap.xml` | yes | 3,541 URLs, **per-page `lastmod`** **(new)** | real dates | correct | `SD-16` (`f1-geometry.db` still crawlable) |
| `/404` | yes | no | — | — | — handled (real 404 status, site chrome) |
| `/now` | yes, **noindex, 0 inbound links** | no | — | — | `SD-34` |
| GitHub repo, README, `docs/` **(now public)** | yes | no | README figures are checked spans | current, except the repo **description** | `SD-33` |
| GitHub release v2.24 + 7 assets | yes | yes | tag + `SHA256SUMS` | **frozen 5 days / 11 rebuilds behind the site** | `SD-24`, `SD-27` |
| GitHub issues + `report.yml` **(new)** | yes | — | — | 0 external reports ever | `SD-32` — handled well, one door |
| `pages.yml` — a second site deploy | dormant, dispatchable | would carry all of it | — | comment says the repo is private; it is not | `SD-31` |
| `refresh.yml`, daily **(new cadence)** | back stage | writes to `main` | — | 9 of 10 runs green, invisible | `SD-25`, `SD-26` |
| Cloudflare Workers Build on push | back stage | rebuilds the site | logs off `[D-10]` | last green build | `SD-25` |
| Zenodo / DOI / Software Heritage / `CITATION.cff` | **absent** | — | — | — | `SD-28` |
| Email, form, social, calendar, newsletter | **absent** | — | — | — | `SD-32`, `SD-34` |

Read down the *Currency it shows* column and the shape of the service falls out. **Every freshness signal this service publishes is derived from the last time something changed. Not one is derived from the last time something was checked.** That is a single design gap with four faces: `SD-25` (no heartbeat), `SD-26` (the post-race window), `SD-14` (the schedule dies quietly), and `SD-24` (the identity that does not identify). All four were built one at a time, each correctly, and the missing thing is the one nobody owned.

The second shape: **the site is now the canonical channel and the release is a fossil that still advertises itself as the citable one.** Five days and eleven data-changing commits separate them, both call themselves 2.24, and the release body is the document that says *"use whichever suits — the newest data, or a version you can cite."* That sentence was right when the two copies differed only in freshness. It is now wrong in the way that matters: the pinned copy is not the one the pages describe.

---

## Three journeys, walked

### A journalist checking a figure before filing, Monday morning after a Grand Prix

Searches "2026 madrid grand prix result", lands on `/races/2026/14` from Google. Between roughly 15:00 Sunday and 11:47 Monday the page tells him, in the static half that paints first and in the app that replaces it, *"This race has not been run."* It is not blank and it is not wrong-looking; it is a confident, well-written false statement, and it carries no date of its own beyond a footer `Built 2026-09-16` he will not read (`SD-26`).

Suppose he arrives on Tuesday instead. The page is right. He wants to cite it. The footer offers *"Cite this page as Lap Ledger, database v2.24 built 2026-09-16"*. He files. Two weeks later a reader disputes the figure; he returns to `/races/2026/14` and it has changed, because the version and the build date did not move when the data behind it did (`SD-24`). There is no way for him to get back to what he saw: no DOI, no dated snapshot, no `SHA256SUMS` for the site's copy, and the release tagged v2.24 is a different file (`SD-28`).

He wants to ask a question. The footer says *"Found something wrong? Report it"* → a GitHub issue form. He does not have a GitHub account and is not going to make one on deadline (`SD-32`). There is no email, no form, nothing on `/data`.

**Verdict:** the journey works exactly once, at the wrong moment, and cannot be redone.

### A data scientist evaluating whether to build on this

Arrives at `/data` — which is now a genuinely good page, and the largest single improvement since September. She gets the three files, the licence position, the trust ladder, the *"everything you need to read it is inside it"* line, and `Dataset` JSON-LD with four `DataDownload` entries. `SD-01`, `SD-08`, `SD-09`, `SD-10` and `SD-11` have all landed and landed well.

Then she asks a dependant's four questions:

1. *How fresh is it, and who guarantees that?* `Built 2026-09-16`. Nothing says when it was last checked, or what the cadence commitment is (`SD-25`).
2. *How do I pin a version?* `/data` says two JSON exports *"travel with each release rather than being served from here"* and links no release. `/changes` lists seven released versions and links none of them. `https://lapledger.org/f1_compat.json` → 404 (`SD-29`). She finds the releases by guessing at GitHub; the latest one is five days and eleven rebuilds behind what she just downloaded, under the same version number (`SD-24`).
3. *What changed between versions?* The v2.24 release body's "What's Changed" is 31 auto-generated pull-request titles, over half about the project's own agent loop: *"Cut the loop's token cost: one normative home per rule"*, *"The fork's effort is not set by its frontmatter"*, *"D-18's token figures are measured now, not estimated"*. Nothing in it is about the data (`SD-27`).
4. *Who runs it and what happens if they stop?* Nothing, on any surface (`SD-15` #223, `UR-05` #238, still open). No named person, no institution, no archive, no DOI, no statement of what a dependant should mirror (`SD-28`).

She wants just the `races` table. The only bulk options are 23 MB of SQLite or a 1.4 MB zip of 43 Parquet files; the per-table files exist on disk at build time and are not served (`SD-30`). She unzips and finds no `README.txt`, no licence, no attribution (`PM-23`, still open and still correct).

**Verdict:** the discovery and licence halves are now excellent. The operational half — identity, cadence commitment, changelog, contact, continuity — is entirely absent, and it is precisely the half a dependant needs. A person does not depend on a dataset because it is good; they depend on it because they know what happens when it breaks.

### A fan on a race weekend, arriving twice

Friday: wants to know when qualifying is. There is no channel that brings that to him, and the front door does not mention the race. `lapledger.org` opens on seventy-seven years of history and the last ten champions. `/now` would redirect him to `/seasons/2026`, but `/now` is `noindex` and **zero pages link to it** — I checked all 3,541. The nav has eight items and none is *this weekend* (`SD-34`).

If he reaches `/races/2026/15`, the timetable is there and is good: every session, on the circuit's clock and in UTC. That data — 115 rows in `sessions` — is published and licence-cleared and appears on exactly one page each, reachable only by someone who already knew to go there.

Sunday evening: comes back to check the result, gets *"This race has not been run"* (`SD-26`), and has no reason to return. Nothing asks him to. There is an Atom feed, linked from every footer, which fires only when the database changes and describes it in counts (*"1,163 races run of 1,196 … 11 open disagreements"*) — a changelog for a maintainer, not a reason for a fan.

**Verdict:** the service has 23 scheduled moments a year when its audience is paying attention and it participates in none of them. This is the service-design shape of "it is all a bit dull".

---

## The full set, by consequence

`SD-24`, `SD-25`, `SD-26` are above.

### `SD-27` — Six changelogs, and none of them is about the data

*`read the docs`, `probed the live service`. Defect. S.*

A reader asking "what changed?" can land on: `README.md`'s version log, `docs/BUILD-NOTES.md` (1,278 lines by version), `docs/LANDED.md` (1,221 lines), `/changes`, `feed.xml`, and the GitHub release body. Six documents, four audiences, no stated precedence. The one a downstream user will actually open — the release — leads with a good hand-written distribution table and then appends 31 machine-generated PR titles whose subject is mostly this project's own tooling.

The cost is concrete and commercial: "should I take the new version?" is the question every dependant asks on every release, and this service answers it with engineering gossip.

**Do:** three hand-written lines at the top of each release body — *rows added, tables changed, anything a query might now return differently* — before the auto-generated list. `changes.js`'s `RELEASES` array already holds a one-line title per release for `/changes`; the same sentence serves both. And a six-line `docs/README.md` saying which of the six documents is for whom (`SD-17` already asks for this and should absorb it).

### `SD-28` — No persistent identifier and no archive: the whole service is one domain and one personal account

*`read the source`, `read the docs`, `inference`. Defect of omission, high leverage. S.*

There is no `CITATION.cff`, no `.zenodo.json`, no DOI, no Software Heritage deposit. Every citation this project invites — the footer string on 3,541 pages, the `Dataset` markup, the `/data` "cite this page" line — resolves to `lapledger.org`, which is one domain registration and one Cloudflare account. Nothing in `docs/` records who holds the domain, when it renews, or what happens to 3,541 URLs if it lapses. `CONTRIBUTING.md` line 343 mentions "Cloudflare DNS" as a thing not to touch; that is the entirety of the infrastructure record.

Three artefacts fix most of it, all S, all one sitting each:

- **`CITATION.cff`** in the repository root. GitHub renders a *"Cite this repository"* button from it automatically. Zero maintenance.
- **Zenodo's GitHub integration.** Flip one switch; every future tag mints a versioned DOI and Zenodo keeps the release assets under CERN's custody. That answers `SD-24` (a permanent identity per release), `SD-15`'s fourth question (what if he stops) and Google Dataset Search's `identifier` field simultaneously. It is also the single strongest signal to the citation audience — a Wikipedia editor citing a DOI does not have to argue about `WP:RS`; `UR-05` (#238) names that problem and this is a better answer than a page.
- **Software Heritage** — one form submission archives the git history permanently.

`README.md` already has the best version of the continuity argument anyone could write (*the database is a pure function of public sources, and `SHA256SUMS` lets you verify a rebuild*) and it is stated nowhere a reader will find it. Pairing it with an archive turns a paragraph into a guarantee.

### `SD-29` — The site names artefacts it does not serve and links no release

*`probed the live service`, `read the source`. Defect. S.*

`/data`: *"Two JSON exports — `f1_database.json.gz`, every table, and `f1_compat.json`, the original v1 key layout — are written by the same build and travel with each release rather than being served from here."* There is no link to a release on `/data`; there is no link to a release on `/changes`, which lists seven of them by version and date in a table; `https://lapledger.org/f1_compat.json` returns 404 and is 37 KB.

So the site describes the pinned-version channel accurately and provides no route to it. Every outbound link on `/data` is to the site itself except one, to the repository root.

**Do:** link the releases from the `/changes` table (one `href` per row — `changes.js` already holds the version), and add *"pin a version"* to `/data` with the `releases/latest/download/` URLs the release body already documents. S. Then serve `f1_compat.json` — it is 37 KB, it is the only small-payload artefact this project has, and it is currently the one file that is release-only for no reason anybody has written down.

### `SD-30` — The bulk channel is all-or-nothing

*`ran it`, `read the source`. Defect. S.*

The only two download shapes are 23 MB of SQLite and a 1.4 MB zip of 43 Parquet files. `tools/parquet_export.py` writes the 43 files to `parquet/` and `parquet-bundle.mjs` zips them; publishing the directory as well as the zip is a copy step in a chain that already runs. `races.parquet` is a few KB; a user who wants it takes 1.4 MB and a zip tool, or 23 MB and SQLite.

This matters for the stated goal — *"a tool anyone can access to get reliable F1 data"* — because "anyone" includes a person with a notebook and a slow connection, and because a directory of per-table URLs is the shape DuckDB, polars and pandas read directly over HTTP (`read_parquet('https://lapledger.org/parquet/races.parquet')`). That one line in a tutorial is a better advertisement for this project than any page on it.

Rider, and the reason to do it with `PM-23`: whatever is served must carry the notice. `parquet_export.py` writing `README.txt` from `source_registry` (as `PM-23` proposes) covers both.

### `SD-31` — A dormant second publication channel whose stated precondition is no longer true

*`read the source`, `probed the live service`. Defect, latent. S.*

`.github/workflows/pages.yml` header: *"NOT CURRENTLY LIVE. Pages needs the repository to be public, or the account to be on Pro or Team; this repository is private on Free."* The repository has been public since 2026-09-14. The workflow is `workflow_dispatch`-only and its last run failed on 2026-09-08; `gh api repos/.../pages` returns 404, so no Pages site exists yet.

The finding is not that it is broken. It is that a correct-looking workflow now has a false comment explaining why it is safe, and one dispatch would publish a complete second copy of all 3,541 pages at `Alex-Farley.github.io/formula-1-data/` — with its own `SITE_ORIGIN`, its own canonical tags, its own sitemap and its own `f1.db`. Two copies of a published dataset, updated by different triggers, with no stated rule about which wins. This project's own discipline is that two copies that can disagree need a declared rule; the release/site pair has one (in the release body) and this pair does not.

**Do:** delete the workflow, or update the comment to say the precondition now holds and add one line saying lapledger.org is canonical and Pages is a fallback only. Either is five minutes. Leaving a stale "this cannot run" note on a workflow that can now run is the configuration equivalent of a disconnected fire alarm.

### `SD-32` — The inbound channel is well designed, has one door, and that door needs a GitHub account

*`read the source`, `probed the live service`. Defect, small. S.*

`SD-04` landed properly. The footer on every page says *"Found something wrong? Report it"*; `.github/ISSUE_TEMPLATE/report.yml` asks for the page, the figure and the source, says in advance what happens to the report, and explicitly tells the reporter they need no id, size or label. `config.yml` disables blank issues and offers two contact links. This is better than most funded services manage, and the reasoning comment on the file is the best argument for a form I have read.

What remains: the two audiences most likely to find a wrong figure — the fan who was at the race and the Wikipedia editor — are the two least likely to hold a GitHub account, and the form is behind a sign-in wall with no alternative. In 14 days the repository has had **four unique visitors** and zero external reports.

**Do:** add a `mailto:` beside the link (*"or email …"*), or a Cloudflare Worker-backed form posting to the same issue tracker. A one-address inbox is the cheapest option and has the property the GitHub form does not: it works for someone who will never register anywhere.

### `SD-33` — The coverage claim now disagrees across channels, and it got there automatically

*`ran it`, `probed the live service`, `queried the database`. Defect. S.*

`SD-12`'s build half landed: `meta.coverage_seasons` is derived from the season register, and the masthead on all 3,541 pages, the homepage `h1`, the README and the `Dataset` markup now all read **1950–2027**. The GitHub repository description — the string a GitHub search result and every social unfurl of the repository shows — still reads **1950–2026**. `SD-12` predicted precisely this residue and it is now live rather than hypothetical.

Second half, worth a decision rather than a fix: `1950–2027 · every championship race` is under the wordmark on every page, and 2027 holds 24 scheduled races and zero results. Deriving from `MAX(seasons.year)` replaced a claim that went stale by hand with one that overstates by a year automatically, and it will do so every time a calendar is announced. `MAX(year WHERE a classification exists)` is the honest bound for a *coverage* claim; the announced calendar is a separate, and good, thing to advertise.

### `SD-34` — There is no return architecture, and the data for one is already published

*`drove the site`, `read the source`, `queried the database`. Defect on the gap, preference on the specific remedy. S each.*

The maintainer's "it is all a bit dull" is, in this discipline, a question about channels and rhythm rather than about the screen. The inventory:

- **Channels that can reach a user who is not on the site:** one — `feed.xml`. No email, no calendar, no notification, no social account, no newsletter.
- **Moments that could prompt a return:** 23 race weekends and roughly 60 sessions. The service participates in none.
- **Surfaces about the present:** `/now`, which is `noindex` with zero inbound links from 3,541 pages; and the season page, which is three clicks from the front door.
- **What the feed says when it fires:** counts of rows and disagreements. Correct, and written for a maintainer.

Two cheap changes, both using data already published and licence-cleared:

1. **`/f1.ics`** — the season as a subscribable calendar, generated in `prepare-assets.js` from the 115 rows of `sessions` (start times in UTC, already on `/races/*`, already classified `facts-only` and published). A subscription installs itself in a user's week. It is the only channel available here that produces a recurring arrival without asking anybody to remember a URL, it is about forty lines, and it is the sort of thing the bulk-data audience posts about. Nothing in the 181 open issues names it.
2. **A feed entry per completed race**, not only per build: *"2026 Azerbaijan Grand Prix classified: winner, pole, fastest lap, three records moved."* The information is in the database on the morning the refresh commits. This turns the feed from a build log into a weekly rhythm and gives `SD-23` (#412) the durable entries it wants for a better reason than completeness.

Both are also the honest answer to `SD-18`'s *"which audience first?"*: a calendar and a per-race feed are things you can announce.

### `SD-35` — Measurement is free, available on channels already in use, and says there are no users

*`probed the live service` (GitHub API, today). Defect of process. S.*

`PD-Ø` (#261) is open and is the right item. Its evidence, measured today:

| Signal | Value |
|---|---|
| Repository views, 14 days | 484, **4 unique visitors** |
| Repository clones, 14 days | 4,064 / 396 unique (CI runners) |
| Referrers | one: `github.com`, 1 unique |
| Stars / watchers / forks | 2 / 0 / 0 |
| Release asset downloads, v2.17–v2.24 | **1–2 per asset**, total 9 across seven releases |

Nothing on lapledger.org measures anything, but Cloudflare's zone analytics counts requests per path server-side with no script, no cookie and no privacy cost, and it is already on for this account. That is `PD-Ø`'s cheap half and it can be read this week.

The uncomfortable reading, which belongs in this critique because it governs every priority below: **on every channel this service can observe, its only users are its author and its CI.** Nine asset downloads across seven releases. One referrer. Four unique repository visitors in a fortnight. 181 open issues are improvements to something that, as far as anything here can tell, nobody has yet arrived at. `SD-18` (#389) is the item that changes that number and it is the only item on the board that can.

### `SD-36` — `docs/COMMERCIAL-READINESS.md` publicly commits the project to staying non-commercial, and two licence readings rest on that premise

*`read the docs`. Decision, not a task. L (a decision before any task).*

Line 255: *"What has been decided is the scope, not the law: **this stays free and non-commercial**, and no argument about trademark is advanced here because that is not this document's business."* That is a published statement in a public repository, and it is also load-bearing inside the same document:

- The 695 `facts-only` rows from `formula1.com` and `fia.com` are kept on the reading that *"facts are not copyrightable, and restating one is not redistribution"* (correct, and commerce-neutral).
- The 115 `sessions` rows are a different case and the document says so: *"the first facts-only use that takes the whole of one upstream set rather than single facts each cross-checked elsewhere"*, cleared against the class's own limit — *no substantial extraction of the source's database* — **by the maintainer on 2026-09-12**, under the scope stated above. Sui generis database right turns on substantiality rather than on commerciality, so the reading does not automatically fail; but the risk appetite it was taken with, and the exceptions available to argue it, both change when the same extraction sits behind a paid service.
- The six radio quotations carry an explicit reservation: *"Revisit it if the project is ever commercialised in a form that reproduces them prominently."*

None of this is legal advice and none of it is a blocker. The point is procedural and it is mine because it is a front-stage/back-stage seam: **the document that clears this data to publish scopes itself to a non-commercial project, and the scope cannot drift — it has to be revised deliberately, in the open, on the record, the way every other deviation here is.** `PM-18` (#250) is the item and it is sized *"not a task until there is a commercial form to ask about"*. There is now an intent; the item should move.

---

## Commercialisation, taken seriously

Asked to engage rather than write a business plan. Four things follow from the constraints, and they point one way.

**1. The data cannot be the product, and this is settled rather than arguable.** The database is CC BY-SA 4.0 and cannot be anything else: `harvest/races.txt` and 552 prose fields derive from Wikipedia, which is CC BY-SA, and the share-alike is not this project's to drop. There is no dual-licence option because the project does not hold the rights to offer one. Anyone may take `f1.db`, mirror it, and undercut any price with a copy — lawfully, and with this project's own blessing in `LICENSE-DATA`. A paywall on the file is bypassable in one `curl` and would contradict the positioning that is the only asset here.

**2. What can be sold is the service around the data.** CC BY-SA constrains copies, not hosting, support or guarantees. The sellable things are, in order of how cleanly they sit with the three fixed constraints:

- **A hosted read API.** The single biggest gap between this project and every alternative is that F1DB is an archive and OpenF1 has an API. A Worker over the same SQLite file on R2, with per-key rate limits, is a product that a free 23 MB download does not compete with, because the buyer is paying for *not downloading 23 MB*. It sits beside the site rather than inside it, so it does not reopen `[D-13]` or the whole-download architecture. L, and genuinely L — but it is the only shape here with recurring revenue in it.
- **Guaranteed, identified snapshots.** A dated, DOI'd, checksum-published monthly snapshot with a stated retention, for people who must be able to show what they cited. This is `SD-24` plus `SD-28` plus a promise, and the first two are wanted anyway.
- **Sponsorship and donation.** GitHub Sponsors is one file; zero licence exposure; no infrastructure. It is the only option that can be switched on this week and the only one that does not need an audience first to be *worth* switching on later.
- **Work, not product.** The verification apparatus — a build that refuses a fact, a published disagreement ledger, a machine-checked licence audit — is a consultancy portfolio for exactly the kind of data work that is hard to demonstrate. It is already public and already the most unusual thing here.

**3. What "good enough to pay for" means, per audience in the brief.** For the fan: nothing, ever — they are the audience that makes the numbers that justify the rest. For the journalist and the Wikipedia editor: a citable identity that survives a rebuild (`SD-24`), a correction channel with a stated turnaround (`SD-32`), and an archive (`SD-28`). They will not pay, and they are the ones who make it *worth* paying for, because a source others cite is a source worth licensing. For the data scientist and the developer: freshness with a commitment behind it (`SD-25`), a machine-readable changelog (`SD-27`), stable identifiers for rows (`DA-04` is open and is the data architect's), and an endpoint that is not 23 MB (`SD-30`, then the API). **Every one of those is already a finding in this critique filed for a non-commercial reason.** The operational work and the commercial work are the same work; there is no separate commercialisation project to start.

**4. The sequence is forced, and it is not the sequence the board is in.** Nine downloads and four unique visitors means there is no demand signal to price against, and pricing before there is one produces a number pulled from the air. So: measure (`PD-Ø`, free, this week) → announce (`SD-18`, one post) → read what the announcement does → and only then decide whether anything here wants paying for. `SD-36`/`PM-18` — the licence and trademark re-reading — should be answered *in parallel*, because it is a person's decision with a lead time and it gates the shape of anything that follows. Nothing else about money should be done before there is a number.

And one thing to protect: the reason anyone would ever pay for this is that it says how far it can be trusted. Every mechanism that would make money quickly — an ad, a tracker, an interstitial, a mailing-list gate on a download — cheapens exactly the asset. `/data` currently says *"Nothing is sent anywhere"* and means it. That is worth more than any of them.

---

## Seams already handled well

The hardest thing in this discipline and the easiest to undo. Do not touch these while fixing the rest.

- **The database failure state, which is the best thing I found today.** `drove the site`: I aborted `/f1.db*`, served a corrupt gzip, returned 503, and blocked `sql-wasm.wasm`. In all four cases the reader keeps the complete, correct prerendered page and gets a banded notice — *"The database could not be opened. The figures on this page are from the last published build."* with a **Try again** button — and zero uncaught errors. That is the answer to *can a user tell a broken service from an empty one*, it is correct in all four failure modes, and almost nothing on the web gets it right. (One gap: on `/data/sql`, the only route that is nothing but the app, the visible prose is the `noscript` fallback — *"The console needs JavaScript"* — which diagnoses the wrong failure while JavaScript is running fine. One sentence.)
- **`/data`.** In ten days this went from nonexistent to the best page in the service: the three files, why there are two databases, the licence per source, the trust ladder, the *"everything you need to read it is inside it"* SQL lines, and a `Dataset` JSON-LD with four `DataDownload` entries. `SD-01`, `SD-08`, `SD-09`, `SD-10` and `SD-11` all landed, and `SD-11` landed well enough that #219 can be closed.
- **`report.yml`.** An inbound form that asks only what a report needs, states what will happen to it before the reporter spends the effort, and explicitly tells them they do not need an id or a size. The header comment explaining why it is not `item.yml` is the clearest piece of service reasoning in the repository.
- **`refresh.yml`'s gate, now covering the front end.** Rebuild, verify, unit-test, export, build the site, run the Playwright smoke suite, `cmp` the served database against the built one, assert the sitemap size — all before the commit. `SD-05` asked for the web half and got more than it asked for. The 2026-09-13 failure proves it: `verify.py` refused, nothing was committed, the repository kept its last known-good harvest, and the next morning's run recovered unaided.
- **The pole vacancy, closed at the right layer.** `build.py:1866-1888` credits grid 1 where the hand-written pole harvest has not caught up, only into a vacancy, only where grid 1 is unique, only for completed races, and `verify.py` refuses it outside the current season. That is a freshness seam — a finished race showing a blank pole — solved with a rule rather than a reminder, and the comment names the exact round it was found on.
- **The immutable-cache seam**, still correct, still the model (`worker.js`), and now with `db-manifest.json` as a public, `no-cache`, authoritative currency record that four other findings above can simply read.
- **`html_handling: "drop-trailing-slash"` and `not_found_handling: "404-page"` in `wrangler.jsonc`,** with the reasoning written out: no SPA rewrite, so a missing `f1.db` cannot arrive as HTML pretending to be a database; a real 404 status on a page with the site's own chrome. Both verified live.
- **Per-page `<lastmod>` in the sitemap.** 3,541 URLs now carry real dates — `/seasons/2019` says 2019-12-01 — instead of one build date. `SD-19` landed exactly right.
- **The static footer now carries the version and build date**, and the report link, on the half of the site that paints first and survives a database failure.

---

## Backlog verdicts

### Service design (all 11 open)

| # | Item | Verdict |
|---|---|---|
| #216 | SD-07 `meta.version` does not identify the data | **Keep — move to Now, re-size S→M.** Supersede the body with `SD-24`: `built` collides too, so the (version, built) pair `changes.js` is built on is not unique, and the measured collision is `43c3a66f` vs `d9665a51`. Everything commercial and every citation depends on it. |
| #219 | SD-11 no `schema.org/Dataset` markup | **Close — landed.** `/data` ships `Dataset` with four `DataDownload` entries, `license`, `temporalCoverage`, `version`, `dateModified`. Open a one-line follow-on for the two missing fields: `identifier` (the DOI from `SD-28`) and `keywords`. |
| #220 | SD-12 "1950–2026" typed 29 times | **Re-size M→S and re-scope.** Build half landed. What is left is the GitHub repository description, now *wrong* (1950–2026 against the site's 1950–2027) — see `SD-33`. Fold the residue into the runbook in #223. |
| #222 | SD-14 GitHub disables the schedule in the winter break | **Merge into `SD-25`.** A daily `last-checked` commit on the no-change path removes the 60-day idle window as a side effect, and is wanted for its own sake. Keep the runbook line. |
| #223 | SD-15 no public surface says who runs this | **Keep, Now. Merge #238 (UR-05) into it** — same gap, one from service, one from use. Add `SD-28`: a DOI and a `CITATION.cff` answer the fourth question better than a paragraph does, and answer the Wikipedia editor's `WP:RS` problem outright. |
| #224 | SD-16 the licence statement does not follow the file | **Merge into #410 (SD-22)** — the same rule, overlapping text, one edit. Keep the two riders: `robots.txt` still leaves `/f1-geometry.db` (the one ODbL file) crawlable while disallowing the three CC-BY-SA ones; `meta.apply` is reachable again now the repository is public, so that third of the item is done. |
| #225 | SD-17 `docs/GITHUB-SETUP.md` documents a repository that no longer exists | **Keep, S.** Verified verbatim today: still tells the reader to `tar -xzf f1db-v2.6.tar.gz`. Absorb `SD-27`'s second half — `docs/README.md` now has six documents to disambiguate and six changelogs among them. |
| #389 | SD-18 the project has never been announced | **Keep — unblock, and rank #1 on the board.** Its question 1 (*"is an audience wanted at all?"*) has now been answered by the maintainer, twice: "a tool anyone can access" and "make money eventually". Its question 2 (*"is it ready to be found?"*) is now largely yes — `og:image` ships, `/data` exists, the Parquet bundle is documented, the report channel is live. Only `SD-24` should land first, because an announcement that invites citation of a string that does not identify anything spends the one moment of attention badly. |
| #392 | SD-21 answer engines | **Keep as a decision, Next.** Split: the measurement half (ask assistants a set of questions, record what they cite) belongs in `PD-Ø` (#261) as a cheap baseline, and should be run *before* `SD-18` so there is a before-and-after. The positioning half stays a maintainer's call. |
| #410 | SD-22 the licence documents name every published file but one | **Keep, Now.** Absorbs #224 and should ship with #166 (PM-23) — one pass over "does the notice follow every file we publish", covering `LICENSE-DATA`, `ATTRIBUTION.md`, the Parquet `README.txt`, and `robots.txt`. |
| #412 | SD-23 a refresh's feed entry is replaced | **Keep, Someday, re-size S.** Correct and low-value while the feed has no subscribers. Reconsider with `SD-34`'s per-race entries, which give the durable history a better reason than completeness. |

### Others I have a view on

| # | Item | Verdict |
|---|---|---|
| #261 | PD-Ø Measure something | **Keep — Now, and do the free half this week.** Evidence in `SD-35`: 4 unique repository visitors in 14 days, 9 asset downloads across 7 releases, one referrer. Cloudflare zone analytics needs no code and no cookie. Every other ranking on this board assumes an arrival pattern nobody has observed. |
| #250 | PM-18 Trademark, if money ever appears | **Re-rank: Someday → Now, as a decision.** Its own sizing says "not a task until there is a commercial form to ask about". There is now an intent. Pair with `SD-36`: revising `docs/COMMERCIAL-READINESS.md`'s *"this stays free and non-commercial"* is a deliberate, recorded act, and the `sessions` reading was taken under that scope. |
| #166 | PM-23 Parquet bundle carries no plain-text notice | **Keep, S — group with #410 and #224** into one licence-follows-the-file pass. Confirmed today: 43 members, no `.txt` or `.md` among them. Add `SD-30`'s rider — if the per-table files are served, the notice must be served beside them. |
| #238 | UR-05 nothing says who publishes this | **Merge into #223 (SD-15).** |
| #192 | AF-02 the build is public and reproducible; the site does not say so | **Keep, and split.** Part (2) — serve `SHA256SUMS` from the site — is now urgent rather than tidy, because it is half of `SD-24`: the digests the site shows and the `SHA256SUMS` it points at are for different files. Promote part (2) to Now as an S; leave parts (1) and (3) where they are. |
| #167 | PM-24 two Cloudflare build settings unconfirmed | **Keep, S.** It is the last unknown in the deploy, and `SD-25` would make an unnoticed deploy failure visible without needing it answered. |
| #313 | AF-27 `review.yml` reports SUCCESS without reviewing | **Keep, and re-rank up.** A control that is green and inert is worse than one that is red, and `CLAUDE.md`'s strongest rule is never to weaken a control. Not my discipline's fix, but it is my discipline's failure mode. |
| #165 | PM-22 `meta.database_name` still reads "F1 Verified Facts Project Memory Database" | **Keep, re-rank up to Next.** It is an S and it is the first string a downloader sees in a file this project is asking people to cite — and it appears on no page they have read. |
| #184 | AF-01 say when a race ends and whether it happened | **Keep, re-rank up.** It owns the front-stage half of `SD-26`, which is the most-read false statement the service makes. |
| #390 | SD-19 sitemap `lastmod` | **Landed well** — verified: per-page real dates, 3,541 URLs. Noted so it is not undone. |

### A ranked top ten for the project, from this discipline

Given the three stated goals — reliable one-place tool for someone who is not the author; money eventually; not dull.

| # | Item | New/existing | Size | Why |
|---|---|---|---|---|
| 1 | **`PD-Ø` — read Cloudflare's per-path counts and the release download counts, monthly** | existing #261 | S | Free, needs no code, and every other priority is currently guessed. Do it before anything on this list changes. |
| 2 | **`SD-24` — make the digest the identity: citation string, static footer, `Dataset.identifier`, and the site's own `SHA256SUMS`** | new (supersedes #216, absorbs #192 part 2) | S–M | Three published claims are provably false today, and citation is the whole positioning. |
| 3 | **`SD-18` — announce it** | existing #389, unblock | M | Four unique visitors in 14 days. 181 issues improve a thing nobody has arrived at. Run `SD-21`'s answer-engine baseline immediately before, so the announcement has a before-and-after. |
| 4 | **`SD-25` — publish "last checked", not only "last changed"** | new (absorbs #222) | S | The reliability claim currently has no evidence behind it, and this kills the winter-break schedule death as a side effect. |
| 5 | **`SD-28` — `CITATION.cff`, a Zenodo DOI per release, a Software Heritage deposit** | new | S | One afternoon buys citability, an archive, `SD-15`'s fourth answer, `UR-05`'s `WP:RS` answer and `Dataset.identifier`. |
| 6 | **`SD-15` + `UR-05` — who runs this, how often, how to report, what if he stops** | existing #223 + #238, merged | S | The four questions every dependant asks; the fourth already has an unusually strong answer written in `README.md` and published nowhere a reader looks. |
| 7 | **`SD-26` / `AF-01` — stop saying a race that has been run has not been run** | new + existing #184 | S | ~23 h a week, at the only moment a general audience is looking, the service is confidently wrong. Cheapest fix is a sentence; move the cron off the hour while there. |
| 8 | **`SD-34` — `/f1.ics` and a feed entry per race** | new | S + S | The engagement answer in this discipline: a channel that arrives in a user's week, built from 115 rows already published, and something concrete to announce. |
| 9 | **`SD-27` — three hand-written lines of data changelog per release, and `docs/README.md`** | new (absorbs #225) | S | "Should I take the new version?" currently answers with 31 PR titles about the agent loop. |
| 10 | **`PM-18` + `SD-36` — re-read the licence and trademark position under a commercial intent, and revise `COMMERCIAL-READINESS.md` deliberately** | existing #250 + new | ? (decision) | Long lead time, gates the shape of anything monetised, and the scope sentence must not drift silently — this project's own rule. |

Just below the line, and only because `PD-Ø` may reorder everything: `SD-22`+`SD-16`+`PM-23` as one licence-follows-the-file pass (S, three items, one sitting); `SD-30` per-table Parquet (S, and the best single advertisement available); `SD-29` link the releases (S).

---

## What I did not examine

Search Console, Bing Webmaster, and whether lapledger.org is indexed at all — I have no web access from here, and `AF-01` has Search Console open; every claim I make about discovery rests on GitHub's traffic API and the absence of referrers, which is weaker evidence. Cloudflare's dashboard, its analytics, its build logs, its retention and its notification settings — `PM-24` is the item and all of it is answerable from one screen I cannot see, so `SD-25`'s claim about what a failed deploy looks like remains inference. Whether an answer engine actually cites this site (`SD-21`'s baseline) — that needs the assistants, not me. The truth of any fact in the database. The `f1` CLI's subcommands as a touchpoint. The interface: screen-level design, microcopy, schema, accessibility and performance are the other eight critics' and I deliberately stayed out, including the cold-load timings, which I did not re-measure. Any real user — the journeys above are the brief's audiences, reasoned from the artefact, and the `user-research-simulator` should walk the journalist journey in particular, because `SD-24` and `SD-26` make a testable prediction about where it breaks and it is cheap to test.
