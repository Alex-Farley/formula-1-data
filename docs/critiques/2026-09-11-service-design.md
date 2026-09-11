# Service design critique — 2026-09-11

**Critic:** `service-design-critic`, first live run.
**Subject:** the whole service at v2.21 — `main` at `c4026ca`, the live site at lapledger.org, the GitHub repository `Alex-Farley/formula-1-data`, the five workflows, the v2.21 release, and the artefacts each of them publishes. Not the interface: other critics have it.
**Brief:** `.claude/CRITIQUE-BRIEF.md`. Read `docs/BACKLOG.md` and all four files in `docs/critiques/` first, including today's code review, which hands `CR-02`, `CR-08`, `CR-09` and `CR-13` partly here.

**Status of the claims below.** Read-only throughout. The repository was not modified (`git status` clean before and after); one experiment ran on a copy under the session scratchpad. Evidence tags: `probed the live service` means an HTTP request to lapledger.org or the GitHub API today; `ran it` means a command run today, on a copy; `read the source`; `read the docs`; `inference`. Two findings (`SD-05`, `SD-14`) rest on documented GitHub behaviour I could not trigger today, and are marked as predictions with the date they will be confirmed or refuted. Nothing here has been independently re-checked.

**Re-checked by the author before filing:** `gh repo view` reports `PRIVATE`; `https://lapledger.org/schema.sql` and the release's "stable link" for `f1.db` both return 404 to an unauthenticated request; `refresh.yml` runs `cron: '0 6 * * 1'`; the silent skip and its comment are at `build.py:1447-1451`; `prerender.js` emits no `schema.org/Dataset`; the coverage string appears nine times in `prerender.js` and once in `App.jsx`. The 2027-round experiment, the `review.yml` failure history and the GitHub token behaviour in `SD-05` were not re-run and stand at the critic's stated evidence level.

**Findings are `SD-01` to `SD-17`.** Sizes are the brief's: S one sitting, M a few sittings shippable in pieces, L a decision before a task. Where a finding is another discipline's to fix, the line says so.

---

## The map

Every way a person meets this service, and what each one is currently able to tell them. The findings live in the last two columns.

| Touchpoint | Public? | Carries the data? | Currency it shows | Currency it has | Who owns the gap |
|---|---|---|---|---|---|
| Search result → prerendered page | yes | facts only | nothing | build date | nobody |
| lapledger.org, app | yes | yes | footer: `v2.21 / Built 2026-09-09` | last successful deploy | nobody |
| lapledger.org, static half | yes | yes | **nothing at all** | same | `CD-04` neighbours |
| `/f1.db`, `/f1-geometry.db` | yes | yes | `meta.built` inside the file | same | `SD-09` |
| `/f1-parquet.zip` | yes | yes | `meta.parquet` inside the zip | same | `PM-23`, `SD-10` |
| `/db-manifest.json` | yes | manifest | `built`, `staged`, digest | authoritative | — (handled) |
| `/build-status.txt` | yes | Parquet step only | ISO timestamp | last *successful* deploy | `SD-06` |
| `/robots.txt`, `/sitemap.xml` | yes | 3,515 URLs | uniform `lastmod` | = `BUILT` | `SD-06` |
| GitHub repo, README, `docs/`, `CONTRIBUTING` | **no — private** | n/a | version log | stale (`PD-07`) | `SD-01` |
| GitHub release v2.21 + 7 assets | **no — 404** | yes | tag + `SHA256SUMS` | frozen at tag | `SD-01`, `SD-08` |
| GitHub issues | **no — private** | n/a | — | zero issues, ever | `SD-04` |
| `./f1` CLI, `tools/geometry_overlay.py` | **no** | n/a | — | — | `SD-01` |
| `refresh.yml`, Mondays 06:00 UTC | back stage | writes to `main` | — | **has never run** | `SD-02`–`SD-05` |
| Cloudflare deploy on push | back stage | rebuilds the site | build logs **off** | last green build | `SD-06` |

Read across the middle of that table and the shape of the service falls out. **Three artefacts are published to the world. Every document that explains them, every channel that could receive a correction about them, and the tool one of them names in its own instructions, are behind a private repository.** Nobody decided that. Cloudflare Pages will deploy from a private repository, so the data went public and the repository did not, and no step in any workflow noticed.

---

## The three that matter

### 1. The data is published; everything that explains it is not (`SD-01`)

`gh repo view` returns `"isPrivate": true`. `https://github.com/Alex-Farley/formula-1-data/releases/latest/download/f1.db` — printed verbatim in the v2.21 release body as a **stable link** — returns **404** to the public, as do all seven assets of all five releases. Meanwhile `https://lapledger.org/f1.db` returns 20,996,096 bytes to anyone.

So today the entire public product is a website plus three unannotated binaries. `schema.sql` 404s on the site. `ATTRIBUTION.md`, which the release body tells the reader to see, is unreachable. `f1-geometry.db`'s own `meta` table tells its downloader to run `python3 tools/geometry_overlay.py --apply`, a file that exists only in the private repository. `CONTRIBUTING.md` addresses contributors who cannot see it. `docs/COMMERCIAL-READINESS.md` concludes, in as many words, *"This is about knowing what the licence statement must say, not about whether the data may ship. **It may.**"* — and it already has.

This is not one broken link. It is the whole of the front stage except the website.

### 2. A season the calendar does not hold is discarded in silence (`SD-02`)

On a copy I appended one synthetic 2027 round-1 result to `harvest/race_results.txt` and one date to `harvest/race_dates.txt` — exactly the shape `tools/f1db_fetch.py` will write on the first Monday of the 2027 season — and rebuilt (`ran it`):

```
build.py  → exit 0
verify.py → exit 0, "All checks passed. 7 warning(s)."  (identical to baseline)
total rows 119,256 → 119,256.  2027 races: 0.  2027 entries: 0.
```

`build.py:1447-1451` is the cause, and it says why:

```python
rid = race_key.get((yr, rnd))
if rid is None:
    # F1DB reaches the current season before this database's own
    # calendar does. A race we do not hold is not an error.
    continue
```

That reasoning is correct for a round inside a season the database holds. It is applied to a season the database has never heard of. The front-stage consequence is the worst available shape for a staleness failure: `refresh.yml` will see a changed harvest, move `BUILT` to that day, pass every gate, commit, and deploy — so **lapledger.org's footer advertises a fresh build date over data that is frozen**, every Monday, until a person notices. The build's own summary line reports `race results: 1162 races` and never prints how many races it skipped, though the identical block does count and print skipped *drivers*.

`CR-01` is the sibling finding (a bulk file going missing has no floor) and not the same one: this is new upstream data arriving and being thrown away.

### 3. There is no way to tell this service anything (`SD-04`)

`grep -rni "contact|mailto|report|email|feedback"` across `web/src/` and `prerender.js` returns nothing. The site's only outbound links are to F1DB, OpenStreetMap and Wikipedia. GitHub issues are enabled and invisible; zero have ever been opened. For a project whose distinguishing claim is that facts are checked, and whose own method (`CONTRIBUTING.md`) is "harvest a table that also contains a fact you already hold", a reader who spots a wrong value is a free, adversarial cross-check — the only kind this project cannot generate for itself — and the service has no aperture to receive one. A closed inbound channel can be a deliberate choice. This one is not a choice; it is an unfilled slot.

---

## Three journeys

**A data scientist, arriving from a search for "formula 1 sqlite database".** Lands on a deep page — a driver, most likely, since 863 of the 3,515 sitemap URLs are drivers. Nothing on that page mentions a download. She has to reach the masthead's *Reference*, then *SQL console*, the fifth item inside the eighth, to find the only sentence on 3,516 pages that links `f1.db`. She downloads 21 MB. She now wants the schema: `/schema.sql` → 404. The release → 404. The repository → 404. She opens the file and finds it is called *"F1 Verified Facts Project Memory Database"* (`PM-22`), a name that appears on no page she has read. If she had thought to run `SELECT sql FROM sqlite_master` she would have found full column comments, and `SELECT * FROM source_registry` would have given her a licence, a cadence and a redistributability flag per source — the artefact is unusually self-documenting and nothing anywhere tells her so. She wants Parquet instead; the only mention of `f1-parquet.zip` anywhere in the built site is the `Disallow:` line in `robots.txt`.

**A fan, Sunday 13 September, half an hour after the Madrid Grand Prix.** `/races/2026/14` reads, statically and correctly: *"Status: Scheduled — not yet run. This race has not been run. The classification will appear here once it has."* That sentence is good work — the absence is named rather than shown as a blank, in the half of the site that paints first. It does not say when. The refresh cron is Mondays 06:00 UTC, so the best case is ~17 hours. But `refresh.yml`'s own comment says F1DB "updates within a day or two of a race": if F1DB publishes at 10:00 UTC on Monday, four hours after the cron, the next attempt is the following Monday and the page says a race that has been run has not been run for **8 days and 17 hours**. There is no retry and no second attempt. The job is idempotent and exits in seconds when nothing has changed; running it daily costs nothing and closes this to 24 hours.

**A Wikipedia editor wanting to cite a figure.** Finds a page, wants a stable reference. There is no citation block (`PD-10`/`CD-08`, queued). He improvises: the site, the date, the version. The version is `2.21`, which is what the release page offers him — *"Swap `latest` for a tag (`v2.19`) to pin a version instead."* But `refresh.yml` moves `BUILT` and never touches `VERSION`, so from the first Monday refresh onward `meta.version = "2.21"` names the release asset, and a different database on `main`, and a third one on the site, and a new one every week. The thing that does identify the bytes — the digest in `db-manifest.json` — is exposed on exactly one public surface, undocumented, and appears in neither the database nor the release page.

---

## The full set, by consequence

### `SD-01` — The repository is private, so the service publishes its data and withholds every document that explains it

*`probed the live service`, `read the docs`. Defect. **L** — a decision, then two S follow-ons.*

Detailed above. Three things make this urgent rather than tidy:

- The publication decision has already been made and taken effect. `lapledger.org` serves `f1.db` (21 MB), `f1-geometry.db` (217 KB) and `f1-parquet.zip` (1.3 MB), all 200. `docs/COMMERCIAL-READINESS.md` clears the data to ship. Privacy is protecting nothing that is not already out.
- `ATTRIBUTION.md`'s first line still reads *"Read this before making the repository public"*, and `docs/GITHUB-SETUP.md` step 3 still says *"there is no `LICENSE` file"* against two that exist. The decision was staged and then overtaken by a deploy mechanism that did not need it.
- Every attribution notice this project writes **fails closed** except this one. `commons.js` `canShow()` refuses an image without a credit; `f1-geometry.db` carries its own ODbL notice inside the file; `parquet_export.py` refuses to run on ODbL rows. The release body's *"See `ATTRIBUTION.md`"* fails open, into a 404.

**Do,** in order and independently shippable: (a) make the repository public, or decide in `docs/` that it stays private and accept the consequences named here; (b) whichever way that goes, serve `schema.sql`, `ATTRIBUTION.md` and `LICENSE-DATA` from lapledger.org, because the artefacts are published from there and the obligation follows the file; (c) set the repository's `homepageUrl` to `https://lapledger.org` and add the seven topics `docs/GITHUB-SETUP.md` already drafted — `repositoryTopics` is currently `null` and the description is `PM-04`'s stale one.

### `SD-02` — A race in a season the calendar does not hold is discarded in silence, and the front stage shows a fresh build date over frozen data

*`ran it`, `read the source`. Defect. **S**.*

Detailed above; `build.py:1447-1451`. Two things to fix, both small:

1. Narrow the skip. A round inside a year `seasons` holds is not an error; a year `seasons` does not hold is. `raise SystemExit` there, or count it and `warn()` in `verify.py` with a floor, the way every bulk loader in the same stage already counts its skipped drivers.
2. Print it. `res_races` counts accepted races only; add `res_skipped_races` to the summary line at `build.py:1532`, because that line is the only place a human sees this stage's arithmetic.

While in there: `meta.coverage_seasons` is the hardcoded string `"1950-2026"` (`build.py:212`). It is the label under which the season rollover will next be forgotten. Derive it from `MIN(year)`/`MAX(year)` in `seasons`, which also makes `SD-12` half-free. Root cause is shared with `CR-07`; the fix here is the guard, not the constant.

### `SD-03` — The refresh cron is slower than the upstream it watches

*`read the source`, `read the docs`. Defect. **S** — one character.*

`refresh.yml` runs `cron: '0 6 * * 1'`. Its own header says F1DB "updates within a day or two of a race". A weekly poll against an upstream with a one-to-two-day latency has a failure mode with no recovery inside the period: miss by four hours, wait 168. The published consequence is `/races/YYYY/NN` asserting *"This race has not been run"* about a race that has, for up to 8 days 17 hours, on the highest-traffic page of the highest-traffic week.

**Do:** `cron: '0 6 * * *'`. The job's first real step is a `git diff --quiet -- harvest/` that short-circuits everything after it, so 29 of 30 monthly runs cost a checkout, a `pip install pyyaml` and a fetch. Keep the Monday framing in the comment if it helps, but the schedule should match the upstream's cadence, not the calendar's.

### `SD-04` — There is no inbound channel, and the one that exists is invisible

*`read the source`, `probed the live service`. Defect. **S** for the first half.*

Detailed above. **Do:** one line in the footer — *"Found something wrong? "* with a `mailto:` or, once `SD-01` is settled, a link to a GitHub issue template. Then decide what happens next: a report with no destination is worse than none. The destination this project already has is `discrepancies` and `known_gaps`, and `CONTRIBUTING.md` already documents the discipline for both — so the honest promise is small and true: *"reports go into the disagreement ledger, which is public."*

Second half, **M** and worth doing after `PD-04` has bedded in: the 16 race pages and 2 driver pages that now render an open disagreement are the pages where a reader is most likely to know something. Put the report link there specifically.

### `SD-05` — The one commit nobody reviews is the one commit CI never sees, and it deploys unaided

*`read the source`, `inference` on GitHub's token behaviour — confirmable on 2026-09-15. Defect. **S**.*

`refresh.yml` pushes to `main` with the workflow's `GITHUB_TOKEN`. GitHub does not trigger further workflow runs from events raised by `GITHUB_TOKEN`, so `ci.yml` will not run on the weekly harvest commit. Cloudflare Pages deploys on a webhook rather than an Action, so the deploy *will* run. The net: every Monday, an unreviewed commit reaches production having skipped the whole gate that `ci.yml` is.

`refresh.yml` does run `build.py`, `verify.py`, the unit tests and the export inline, so the database half is covered and that is the half that matters most. What is not covered is the entire `web` job: `npm ci`, `npm run build`, the prerender assertions, `npm run test:units`, and the Playwright smoke test that reads its expectations out of `f1.db`. A data refresh is precisely the change that breaks a front-end assertion — `smoke.mjs` asserts the MP4/4's fifteen poles against the database, a driver id can be renamed upstream, a new constructor can appear — and none of it is checked before the deploy.

**Do:** add the `web` job's four steps to `refresh.yml` after `verify.py` and before `Commit`. About five minutes on a job that runs weekly. Alternatively, have the refresh open a pull request rather than push, which gets `ci.yml` and `review.yml` both, at the cost of the unattended property the workflow exists for. The first is cheaper and keeps the design.

The prediction is testable on Monday 15 September: if `ci.yml` shows no run against the `harvest: refresh` commit, this holds.

### `SD-06` — Nothing distinguishes a current service from a frozen one

*`probed the live service`, `read the source`, `inference`. Defect. **S**.*

Build logs are off for this project (`CLAUDE.md`). Cloudflare Pages keeps the last successful deployment live when a build fails. So a deploy that has been failing for a month serves a correct-looking site whose footer reads *"Built 2026-09-09"* — and `build-status.txt`, the project's one public status endpoint, will also show the last *successful* deploy's timestamp, because it is written by the build that failed to replace it. Every freshness signal the service has is a lagging indicator of the last thing that worked.

The sitemap makes it worse in a way no interface review would see: `prerender.js:1361` sets every one of 3,515 `<lastmod>` values to `meta.built`. So (a) all 3,515 pages claim the same modification date, and (b) that date is `BUILT`, which by design only moves on a harvest refresh — so the four commits that changed rendered output on 11 September shipped with `lastmod` 2026-09-09, and a crawler has no signal to return. `AF-01` already has Search Console open; this is the same surface.

**Do,** cheapest first: put the `built` date and the last completed round into the **static** footer, not just the app's (`App.jsx:106` has it; `prerender.js:209` does not) — so the search arrival and the cold first paint carry the one fact that says whether to trust the page. Then make `build-status.txt` a real heartbeat: deploy commit, `meta.built`, the F1DB version from `harvest/race_results.txt` line 2, and the round the data is complete through. It costs three lines in `prepare-assets.js` and turns an undiagnosable outage into a URL you can look at.

### `SD-07` — `meta.version` does not identify the data, and the release page offers it as the citation handle

*`read the source`, `probed the live service`. Defect. **S** to state the rule; **M** if `PD-10` depends on it.*

`refresh.yml` moves `BUILT` and never touches `VERSION`. From 15 September, `meta.version = "2.21"` will name at least three different databases: the v2.21 release asset, the weekly-refreshed copy on `main`, and the deployed copy. The release body says *"Swap `latest` for a tag (`v2.19`) to pin a version instead"*, offering the version as the citable identity. It is not one. The digest in `db-manifest.json` is, and it appears on no other channel.

**Do:** pick one and write it down. Either (a) the refresh bumps the patch version (`2.21.1`), which makes `meta.version` an identity again and costs one `sed` beside the existing `BUILT` one — note `release.yml`'s tag check and `CLAUDE.md`'s release rule both assume `v<VERSION>`, so this needs a line in `CLAUDE.md`; or (b) declare that `built` + digest is the identity, put both in the citation block `PD-10`/`CD-08` are going to build, and correct the release body's sentence. (a) is smaller. (b) is more honest about what the build already guarantees — the database is a pure function of its sources, so the digest *is* the version, and `CLAUDE.md` already says so about caching.

### `SD-08` — The documented channel is the stale one; the fresh channel is undocumented

*`probed the live service`, `read the source`. Defect. **S**.*

The release body is the best-written document in the service: it names every asset, states which licence follows which file, and — unusually well — states the rule for which copy wins (*"the newest data, or a version you can cite"*). It is also 404 to everyone, and it will describe increasingly old assets, because nothing re-releases after a refresh.

lapledger.org is the copy that is always current, and it names only `f1.db` and `f1-geometry.db`, on one page, in passing. `f1-parquet.zip` it does not name at all (`SD-10`). `f1_compat.json`, `f1_database.json.gz` and `schema.sql` are not served from it.

**Do,** independent of `SD-01`: this is exactly the page `PD-11`/`IA-02`/`CD-07` are queued to build. Add to their spec that the `/data` page is the *canonical* distribution surface, carrying all four served artefacts, their sizes, their digests read from `db-manifest.json`, the `built` date, and one sentence of the release body's which-copy-wins rule. That sentence already exists and needs moving, not writing.

### `SD-09` — The artefacts document themselves, and no public surface says so

*`queried the database`, `read the source`. Defect of omission, high leverage. **S**.*

`f1.db`'s `sqlite_master` retains the full commented `CREATE TABLE` text — including the paragraph on `race_entries.chassis_id` explaining when it is filled and why it is NULL everywhere else. `source_registry` carries `licence`, `cadence`, `checkability`, `redistributable`, `share_alike` and `attribution_required` for all 16 sources. `f1-geometry.db`'s `meta` carries `licence`, `licence_url`, `attribution` and `companion`. This is a genuinely rare property: the downloaded file answers its own documentation questions offline, and cannot drift from the data the way `README.md` did.

The SQL console's download sentence stops at *"open it with any SQLite client."*

**Do:** three clauses after that sentence, and on the `/data` page when it exists — *"Everything you need to read it is inside it: `SELECT sql FROM sqlite_master` for the commented schema, `SELECT * FROM meta` for the version and build date, `SELECT * FROM source_registry` for the licence of every row."* This is the highest value-per-word change in this critique and it cannot go stale.

It also gives `PM-23` its answer: `f1-geometry.db`'s internal `meta` block is the pattern the Parquet zip's `README.txt` should copy, and it is already in the repository.

### `SD-10` — The only public mention of the Parquet bundle is a line forbidding it

*`ran it`, `probed the live service`. Defect. **S** — rider on `PD-11`.*

`grep -rl "f1-parquet" web/dist` across 3,516 HTML files and every other built asset returns exactly one file: `robots.txt`, where it appears as `Disallow: /f1-parquet.zip`. The file is 1,338,249 bytes, built fresh on every deploy, served with `must-revalidate` and an ETag, and announced nowhere.

`PD-11` filed this as "linked from nothing" against the deploy that then did not exist. It now exists and ships. The `Disallow` is the right call and `PD-11` already notes that it makes the `/data` page the crawlable surface; the new fact is that a data scientist reading `robots.txt` — which is how several of them find bulk files — reads a prohibition and infers the file is private rather than that it is 1.3 MB of the product.

**Do:** with `PD-11`. Until then, one line in `robots.txt`'s existing comment block naming where the file is documented would cost nothing.

### `SD-11` — The bulk product has no `Dataset` markup, so it is invisible to the one search surface built for it

*`ran it`, `read the source`. Defect. **S** — rider on `PD-11`.*

The prerenderer emits `WebSite`, `Person`, `Place` and `SportsEvent` JSON-LD (`prerender.js:1310`). It emits no `schema.org/Dataset`. Google Dataset Search indexes on exactly that type and on nothing else; so do several academic and civic dataset aggregators. For a project whose author's stated want is "a public reference that other people depend on", and whose most differentiated asset is a downloadable audited dataset, this is the single discovery mechanism designed for the audience it most wants and it is not implemented.

Every required and recommended field is already held: `name`, `description`, `license` (CC BY-SA 4.0), `creator`, `version` (`meta.version`), `dateModified` (`meta.built`), `temporalCoverage` (`1950/2026`), `isAccessibleForFree`, and a `distribution` array of three `DataDownload` entries with `encodingFormat` and `contentUrl`. It belongs on the `/data` page and nowhere else.

Contrast with `AF-01`, which correctly reasons that of 1,172 race pages only ten can ever earn an Event rich result. `Dataset` on one page can earn a listing for the whole product. It is the better bet and it is the same amount of work.

### `SD-12` — "1950–2026" is typed 29 times across four channels, one of which is the wordmark on 3,516 pages

*`ran it`. Defect. **M**, S for the front end alone.*

`grep -ro "1950[–-]2026\|1950 to 2026"` over `web/src`, `web/scripts`, `web/index.html`, `build.py` and `README.md` returns **29** occurrences, including `App.jsx:64` and `prerender.js:199` — the masthead, on every page, in both renderers — plus the `<meta name="description">` template, the homepage `h1`, `meta.coverage_seasons`, the README title and the GitHub repository description.

`CR-07` filed the build-side half of this. The service-side half is different in kind: these are not pins that catch a truncated file, they are a *claim about coverage* repeated on every public surface the service has, and on 1 January 2027 all 29 become false at once, in four channels, one of which is not in the repository at all.

**Do:** derive one string at build time from `MIN(year)`/`MAX(year)` in `seasons`, put it in `meta.coverage_seasons`, and have `App.jsx` and `prerender.js` read it from the manifest as they already read `version` and `built`. That is an S and it removes 12 of the 29. The README, the repository description and the release body stay hand-written and stay a season-rollover checklist item — which is `SD-15`'s runbook.

### `SD-13` — The advisory review check has been red through four consecutive merges

*`probed the live service`. Defect (of signal). **S**.*

`review.yml` has failed on PRs #31, #32, #33 and #34 — every pull request since 12:32 today — and succeeded on the twelve before them. The failure is at the action, not the configuration: `Claude result reported subtype success with is_error:true`, `num_turns: 1`, `total_cost_usd: 0`, 517 ms. All four were merged with the red X.

The workflow is thoughtfully built to make a *green* check distinguishable between four outcomes, with a run-summary step and a long comment explaining why. It met a fifth outcome — red — and the summary that names it is in a place nobody opens when the X already tells them the story. Four merges through a red advisory check is how a maintainer learns that this check does not mean anything, which is exactly the state in which it stops being able to warn about something real.

**Do:** two things, both small. (a) Diagnose the 517 ms failure — a missing or exhausted credential is the likely cause and is not visible from here. (b) Make the step non-fatal (`continue-on-error: true`), so the review's *findings* are the signal and its *plumbing* is not. `review.yml`'s own header says "it reviews and comments; it never gates" — the workflow currently contradicts that in the only way a maintainer sees.

### `SD-14` — The schedule will most likely be disabled during the winter break, before the season it exists for

*`read the docs`, `inference`. Defect (of durability). **S**.*

GitHub disables scheduled workflows in a repository with no activity for 60 days and notifies once. The Formula One winter break runs from the first week of December to the first week of March — roughly 90 days, and the period in which this project has least reason to receive a commit, because `refresh.yml` itself finds nothing to do and commits nothing. So the schedule's most likely moment of death is the three months immediately before the season it exists to track, and it would die quietly, after which `SD-02`'s silent-drop and `SD-06`'s missing heartbeat mean nothing on any surface would say so.

**Do:** write the season-start runbook (`SD-15`) with "check `refresh.yml` is still enabled" as item one, and set a calendar reminder for the first week of March. A keepalive commit is the other option and is worse — it defeats the mechanism rather than answering it, and this project's own rule is that a step whose execution you cannot establish is worth less than none.

### `SD-15` — No public surface says who runs this, how often, or what happens if he stops

*`ran it`, `read the source`. Defect. **S**.*

`grep -rni "farley|maintain|author"` across `web/src/` and `prerender.js` returns nothing but a comment about racing colours. The site has no about page, no named maintainer, no statement of cadence, no statement of what is committed to. The closest thing to a service-level statement anywhere is a clause inside a `known_gaps` entry rendered on `/reference/quality` — *"refreshed from F1DB by a scheduled job within a day or two of the flag"* — which is buried, and which is wrong about the cadence in the way `SD-03` describes: F1DB updates within a day or two; this service picks it up on the next Monday.

A prospective dependant asks four questions before they build on something: who runs it, how current is it, how do I report a problem, and what happens if you stop. This service answers none of them on any public channel, while looking finished enough that the questions feel answered. That is the expectation mismatch the brief names as the most damaging and least visible kind.

**Do:** `PD-13` already asks for the upstream-dependency page in `docs/`. This is its reader-facing half and should ship with it: four short paragraphs on `/data` or in the footer — who, cadence (state it correctly), how to report, and what a dependant should mirror if this stops. `docs/COMMERCIAL-READINESS.md` and `docs/TIMING-ARCHITECTURE.md` show this author can write that paragraph in ten minutes. The fourth one has an unusually good answer available: *the database is a pure function of its sources, the sources are public, and `SHA256SUMS` lets you verify a rebuild* — which is a stronger continuity guarantee than most funded services offer and is currently stated nowhere a user can read it.

### `SD-16` — The licence statement does not follow the file

*`read the docs`, `probed the live service`. Defect, small. **S** — folds into `PM-23`.*

Three small inconsistencies in one rule. `LICENSE-DATA` enumerates the files it covers — `data/`, `harvest/`, `f1.db`, `f1_database.json`, `f1_compat.json` — and omits `f1-parquet.zip`, which is the format most likely to be taken by the audience most likely to care. `robots.txt` disallows `/f1.db`, `/f1.db.gz` and `/f1-parquet.zip` and not `/f1-geometry.db`, so the one ODbL file is the one left crawlable. And `f1-geometry.db`'s internal `meta.apply` names `tools/geometry_overlay.py`, which is unreachable (`SD-01`).

None of these is a compliance failure — the licence travels inside every artefact, which is the defence `PM-23` correctly identifies. They are the places where an otherwise exemplary fail-closed rule fails open, and all three are one-line edits.

### `SD-17` — `docs/GITHUB-SETUP.md` documents a repository that no longer exists

*`read the docs`. Defect. **S**.*

Ninety lines instructing the reader to unpack `f1db-v2.6.tar.gz`, decide on licensing because "there is no `LICENSE` file", create the remote, and use a repository description with "121 integrity tests" in it. Both licence files exist, the remote exists, and `PM-04` is already tracking the description. `CR-09` caught the "121". The document as a whole is a fossil: it describes a setup that completed a week ago, sits beside six documents that are current, and is the second file a browser of `docs/` opens alphabetically.

**Do:** delete it, or reduce it to the two things that outlived it — the suggested description and the topic list, which `SD-01` needs anyway — and move them into `README.md`. While there: `docs/` has no index and no status convention, though four of its six files open with one (*"Status: decided"*, *"A sketch, first written against v2.15"*). A six-line `docs/README.md` saying what each file is and whether it is current is an S and stops the next fossil being mistaken for guidance.

---

## Seams already handled well

The hardest part of this discipline and the easiest to undo. Do not touch these while fixing the rest.

- **The immutable-cache seam, designed and solved.** `/f1.db.gz` is served `max-age=31536000, immutable` at a fixed path, which would normally mean a returning reader never receives a refreshed database. `web/src/data/worker.js:28-40` names the trap in full, fetches `db-manifest.json` `no-cache`, puts the digest in the query string of every asset URL, and falls back to `cache: 'reload'` when the bytes still mismatch. This is the exact class of finding this critique exists to produce, and it was produced and fixed before I arrived.
- **`"Status: Scheduled — not yet run. This race has not been run. The classification will appear here once it has."`** A future absence named as a state rather than shown as a blank — and in the *static* half, which is where `CD-04` says the conventions usually get dropped. Add the "when" and it is complete.
- **`f1-geometry.db` carries its own licence, attribution and companion note inside `meta`.** The artefact explains itself offline. This is the model `PM-23` should copy and `SD-09` should advertise.
- **`CLAUDE.md`'s "publish `f1-geometry.db` beside `f1.db`" rule holds on every channel I checked** — git, the release, and lapledger.org, all three, plus `db-manifest.json`, plus the SQL console sentence `IA-15` landed. A rule stated once and honoured on four channels is rare.
- **`refresh.yml`'s gate and its `BUILT` handling.** Rebuild and verify before committing, so a bad upstream leaves the repository on its last known-good harvest; and the `sed` on `BUILT` is followed by a `grep -q` that fails the job loudly if the constant moved or was renamed. Both are the right shape. `SD-05` asks only that the gate also include the front end.
- **`build-status.txt` is written on success as well as failure, and served.** The rule in `CLAUDE.md` is right and the Parquet step follows it. `SD-06` asks for more in the same file, not for a different mechanism.
- **The release body states which copy wins.** *"The release asset above is pinned to this tag; use whichever suits — the newest data, or a version you can cite."* Two copies that can disagree, with a stated rule. It is on the wrong channel (`SD-01`, `SD-08`) and the version half of it is not true yet (`SD-07`), but the sentence is right and should be moved rather than rewritten.
- **`robots.txt` disallowing the 20 MB download.** Correct, with a comment saying why.

---

## What I did not examine

The rendered site beyond the prerendered HTML and four page fetches — no browser was driven, no throttling, no mobile; the interaction and accessibility critics own that and `PD-02` is queued. The Cloudflare dashboard, its build logs, its notification settings and its deployment retention — `PM-24` is the item and all of it is answerable from one build log I cannot see, so `SD-06`'s claim about what a failed deploy looks like is inference. Whether lapledger.org is actually indexed, and by what; `AF-01` has Search Console open and can answer it. The `f1` CLI's 45 subcommands as a touchpoint, since it is currently reachable by nobody. The truth of any fact in the database. The content of `f1_compat.json` beyond `CR-02`'s finding, and the JSON export at all, both being unreachable today. Any real user: the audiences in the journeys above are the brief's, inferred from the artefact, and the `user-research-simulator` should walk the data-scientist journey in particular — `SD-09` and `SD-10` predict where it breaks and the prediction is cheap to test.

## Which critics should run next

- **`user-research-simulator`** — the data-scientist journey above ends at a 404 within four clicks and that is a testable prediction, not a reading.
- **`data-architecture-critic`**, as the code review says — `SD-07`'s version-identity question and `CR-02`'s `as_of` root cause are the same conversation about what identifies a row and what identifies a build.
