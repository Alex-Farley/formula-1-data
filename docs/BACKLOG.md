# Backlog

One list, whatever the source. A finding from a critique, an item the project
has been carrying in its own documents for versions, an idea you had in the car —
they compete for the same time, so they belong in the same place and get ranked
against each other rather than by who raised them.

## How this works

Every item is a checkbox with an **ID**, a **source**, and a **size**. Nothing
else is required.

    - [ ] `PD-04` **Attach discrepancies to the facts.** One component, three
          call sites. — *product critique · S*

**IDs** are a prefix and a number, and they never get reused:

| Prefix | Source |
|---|---|
| `PD-n` | product design critique |
| `AX-n` | accessibility critique |
| `IX-n` | interaction design critique |
| `VD-n` | visual design critique |
| `CD-n` | content design critique |
| `IA-n` | information architecture critique |
| `DA-n` | data architecture critique |
| `SD-n` | service design critique |
| `UR-n` | user research walkthrough |
| `PM-n` | the project's own record — `known_gaps`, `discrepancies`, a *still open* in `docs/`, a `verify.py` warning |
| `AF-n` | yours — an idea, a defect, a want |

A critique's own numbering carries straight over: finding 4 of the product
critique is `PD-04`, and stays `PD-04` even if the list is reordered. A second
product critique continues the sequence rather than restarting it.

**Size** is what it costs, not how much it matters:

- **S** — one sitting. A component, a query, a copy change.
- **M** — a few sittings, shippable in pieces.
- **L** — needs a plan first, and probably a decision that is not obvious.
- **?** — not costed yet. An honest state, and better than a guessed size.

Time here is bursty and unpredictable, so **an L that cannot be broken into
shippable pieces should be a decision to make, not a task to start.**

**Done** items get ticked, keep their ID, and move to *Landed* with the commit
that closed them. **Declining** is a normal outcome: move it to *Declined* with
one line saying why. Neither is deleted — what was declined and why is what a
later critique has to argue against, and a re-raised item can be answered from
here.

New critiques file their findings here as new IDs. `docs/critiques/` keeps the
full reasoning and the evidence; this file is the queue, not the argument.

---

## Now

Short enough to be a decision rather than a list.

- [ ] `PM-05` **Split pole position from grid 1.** Fourteen of the eighteen open
      `discrepancies` are the same modelling question, not fourteen research
      jobs: the harvest records who *started* at the front, F1DB records who was
      *quickest*, and both are true of what they describe. One column split
      closes all fourteen. (Thirteen carry `field = 'pole position'`; the
      fourteenth is 2022 round 21, filed under `grid position 1` —
      Magnussen started ahead, Russell was quickest — which is the same
      question wearing the other label, and is why the count was one short.) This moved up the list when `PD-04` landed — those
      rows now render to readers as "two sources disagree", which for a grid
      penalty is not a disagreement at all. Highest value-per-hour on this list.
      — *project record · M*

- [ ] `PD-02` **Make the prerenderer call the page components' own queries.**
      Static and app emit different numbers under the same label — 14 of 38
      drivers with a stored `entries` disagree with the derived count, and the
      other 824 show an em dash statically and a real figure in the app. Then
      make `smoke.mjs` assert the *static* output against the database as it
      already does the app's, which is what would have caught this on the day it
      shipped. — *product critique · M*

- [ ] `PD-07` **Stop the README lying.** It claims 39 tables, 34 views, ~8,400
      rows against an actual 46 / 38 / 119,271, and says qualifying is "not held
      at all" when 26,997 rows are. Move the version log to `BUILD-NOTES.md`,
      then generate every count from the database and add a `verify.py` check
      that fails when a stated figure disagrees — the discipline
      `f1_compat.json` already gets. — *product critique · M*

- [ ] `PD-03` **Derive `/records`, or stop shipping it.** All 30 rows are
      authored, sit at `medium`, and nothing in `verify.py` reads the table; the
      page says Hamilton has 105 wins while `drivers.wins` says 106. Derive the
      leaderboards; keep only what genuinely cannot be derived, in a block that
      says so. — *product critique · M*

- [ ] `PD-11` **Give the bulk data a front door, and a claim.** The Parquet
      bundle now builds and serves (`PM-01`) and is linked from nothing. A
      `/data` page in the masthead leading with the audited edition — 60 recorded
      disagreements, a confidence tier per row, a gap register, ~170
      cross-checks — which is a claim the upstream does not make.
      One implementation note: `prerender.js` writes `Disallow:` lines for
      `f1.db`, `f1.db.gz` and `f1-parquet.zip`, which is right — a crawler
      pulling 20 MB helps nobody — but it means the `/data` page itself has to
      be the crawlable surface that carries the claim, since the files it links
      never will be. — *product critique · M*

## Next

Worth doing, not yet urgent.

- [ ] `PD-05` **Split `known_gaps` into open and closed.** Four of the eleven are
      closed or not gaps, and the homepage counts all eleven. Add a `state`
      column, filter the public page, and split each row into a reader sentence
      and a maintainer note — it currently renders commit messages. —
      *product critique · S*

- [ ] `PD-06` **Fix the drivers register's first screen.** Opens on Adolf Brudes
      with two columns empty for 96% of rows. Drop `entries` and `starts`, add a
      derived `Races`, change the default sort to something that answers a
      question. Supersedes the older note in `Drivers.jsx` that entries and
      starts are "not yet derived". — *product critique · S*

- [ ] `PD-10` **A citation block.** Every ingredient exists — version, build
      date, per-row source, permanent URL — and they are assembled nowhere. One
      component, prerendered so a crawler sees it. — *product critique · S*

- [ ] `PD-12` **State the lap-timing constraint as a position,** not a
      schema-shaped apology inside a gaps table. "No one may lawfully
      redistribute Formula One lap timing, so this database contains none, and
      every figure here is one you may republish" is an advantage over anyone
      hosting scraped timing. — *product critique · S*

- [ ] `PD-13` **Write down the upstream dependency.** 93.5% of rows come from one
      source refreshed by one cron, and nothing records what happens if it
      changes licence or stops. One page in `docs/`. — *product critique · S*

- [ ] `PM-02` **`BUILD-NOTES.md` stops at v2.15.** Five releases exist only as
      README prose, and `CLAUDE.md` points at that file as *the* running record
      of what changed and what was deliberately not done. Fold in v2.16–v2.20
      while doing `PD-07`, which moves the version log there anyway. —
      *project record · S*

- [ ] `PM-03` **Rewrite `BUILD-NOTES.md`'s "Next, in order".** Its first two
      items were overtaken by v2.15's licence finding and the timing decision.
      This file is that list now, so the section should point here rather than
      compete with it. — *project record · S*

- [ ] `PM-04` **The GitHub repo description is stale.** Still "29 landmark cars …
      143 integrity tests", written before the full classification. It is the
      first thing a visitor reads and it is not in the repository, so nothing
      checks it. — *project record · S*

- [ ] `PM-20` **Clear the three actionable `verify.py` warnings.** Three
      centrelines do not close (Monaco 4 loose ends, Montjuïc 2, Las Vegas 1 —
      genuine 5.4–63.4 m holes in the OSM trace); two qualifying rows have no
      matching race entry; three chassis are claimed as entered after their car's
      authored life ends (`ferrari-500`, `cooper-t51`, `lotus-25`). The other
      three warnings are expected and should stay. — *project record · S*

- [ ] `PM-12` **Loosen the specification harvest's name check.** It refuses
      "Alfa Romeo 158/159 Alfetta" for `alfa-romeo-159`. Match the chassis name
      as a token subsequence rather than a strict prefix; the constructor and
      year checks still gate it. Specified in `BUILD-NOTES.md` v2.8. —
      *project record · S*

- [ ] `PM-13` **Six curated chassis weights await a sourced season limit.** —
      *project record · S*

- [ ] `PM-14` **`claims`, back-filled from the five existing encodings.** No new
      data — it retires five ad-hoc encodings of one idea and makes corroboration
      a `GROUP BY`. `DERIVED-CONFIDENCE.md` says explicitly this is worth doing
      whether or not `PM-15` and `PM-16` ever happen. — *project record · M*

- [ ] `PM-22` **`meta.database_name` still reads "F1 Verified Facts Project
      Memory Database".** Deliberately left out of the Lap Ledger rename because
      it reaches `f1_compat.json` and someone may be displaying it. Needs its own
      version bump and its own decision. — *project record · S*

- [ ] `PM-23` **The Parquet bundle carries no plain-text notice.** Unzipping
      `f1-parquet.zip` gives 41 binary files and nothing else — no licence, no
      attribution, no version, no mention that the ODbL centrelines ship
      separately as `f1-geometry.db`. *Engaging with the reason:* the terms are
      not actually absent, because `source_registry.parquet` and `meta.parquet`
      are both in the bundle, so a machine can read the licence of every row.
      That is a real defence and it is why this is an S and not urgent. But the
      release page states all of it in prose and a direct download from
      lapledger.org states none of it, and this project's own rule elsewhere is
      that attribution fails closed rather than requiring the reader to go
      looking. A `README.txt` written by `parquet_export.py` from
      `source_registry` — so it cannot drift from the data the way the README
      did in `PD-07` — settles it. — *project record · S*

- [ ] `PM-24` **Two Cloudflare build settings are unconfirmed, and one mismatch
      was never explained.** `SKIP_DEPENDENCY_INSTALL=1` is recorded in
      `web/README.md` as required but has never been observed in a build: the
      image installs fastf1, numpy, scipy and matplotlib from
      `requirements.txt` before every deploy, roughly ninety seconds, for a file
      only `tools/fastf1_load.py` uses. Separately, the dashboard's build-command
      field read `sh tools/cloudflare-build.sh` for an unknown period while every
      build log announced the npm chain; the field has since been corrected, so
      the symptom is gone, but *why it was ignored* was never established. Both
      are answerable from one build log. — *project record · S*

- [ ] `PM-25` **The four open `discrepancies` that `PM-05` does not close are two
      races, and they do not reconcile.** 1960 round 5 and 1970 round 1 are both
      credited to Brabham in the database; the external figures claim Phil Hill
      6 career fastest laps against a derived 5, and Brabham 12 against a derived
      11. Moving 1960 round 5 to Phil Hill would satisfy his total exactly — and
      would take Brabham to 10, further from the claimed 12, not closer. So the
      four rows cannot all be right, and the first question is not who set the
      lap but what `stored_value` and `derived_value` mean in each row: the
      per-race rows read database-then-source, the career rows read
      source-then-database. Establish that before spending a person on the
      sources. Cheap to answer, and it may turn four rows into one. —
      *project record · S*

## Someday, or maybe never

Real, but not costed, or waiting on a decision.

- [ ] `PM-06` **Read the 118 classification disagreements.** F1DB leaves a
      disqualified driver's position vacant; Jolpica promotes everyone below.
      Neither is wrong. `known_gaps` #2 says explicitly this is a person's work.
      — *project record · M*

- [ ] `PM-07` **The 337 photographs whose file name does not name the car.**
      `v_images_to_check` ranks them worst-first. The ATS D5 article leads with a
      photograph of officials and police, so the failure is real. The only part
      of the database with no cross-check available at all. — *project record · L*

- [ ] `PM-08` **Circuit configuration timelines for the remaining ten venues** —
      Kyalami, Zandvoort, Suzuka, Imola, Jerez, Estoril, Paul Ricard, Zolder,
      Brands Hatch, Buenos Aires. `verify.py` already enforces completeness and
      non-overlap once rows exist, so the guard rail is built. —
      *project record · L*

- [ ] `PM-09` **Per-round chassis harvest.** Closes `known_gaps` #3 (287 races
      with no known winning chassis) and #4 (car pole counts) in one pass. Only
      safe with the entry-list cross-check that now exists. — *project record · L*

- [ ] `PM-10` **Historical season entry lists.** `season_entries` is 23 rows,
      2026 only. — *project record · M*

- [ ] `PM-11` **Constructor on pole and fastest-lap entries,** which turns car
      pole counts from lower bounds into exact figures. — *project record · M*

- [ ] `PM-15` **`checks`, with `kind` and `constrains`.** The largest piece of the
      confidence model and the most mechanical: each check declares whether it
      compares against an independent source and which rows it covered. What
      stops `qualifying` counting as cross-checked on a re-derivation covering
      446 of 1,161 races. — *project record · L*

- [ ] `PM-16` **Derive confidence in `build.py`,** with `confidence_basis` and a
      check that no stored tier differs from the derived one. The rule currently
      reproduces 96.5% of stored tiers. — *project record · M*

- [ ] `PM-17` **The prose pass.** 552 short fields carrying the CC BY-SA
      obligation that comes from Wikipedia, not FOM. Each needs marking original,
      paraphrased, or close to source; only the third needs rewriting. This is
      about what the licence statement must say, not whether the data may ship —
      it may. Named *still open* in `COMMERCIAL-READINESS.md`. —
      *project record · L*

- [ ] `PM-18` **Trademark, if money ever appears.** "Formula 1", "F1" and "Grand
      Prix" are Formula One Licensing BV's. A solicitor's question, not a build
      check, and not a task until there is a commercial form to ask about. —
      *project record · ?*

- [ ] `PM-19` **Revisit the six radio quotations** only if this is ever
      commercialised in a form that reproduces them prominently. Weighed and kept
      on the record; a marketing surface is not a database row. —
      *project record · ?*

- [ ] `PD-09` **Rework `/reference`.** It holds an audit, an encyclopedia and a
      developer tool behind one nav item. Promote the SQL console and a merged
      provenance page to the masthead. Needs redirects and a naming decision. —
      *product critique · L*

- [ ] `PD-08` **Decide what the atlas is for.** Genuinely excellent, covers 25 of
      80 circuits, has no named audience, and nothing measures whether anyone
      opens it. Not a task until there is a way to answer the question. —
      *product critique · ?*

- [ ] `PD-Ø` **Measure something.** No analytics of any kind, so progress cannot
      be told from motion. Deliberately unsized: what to measure is a decision
      about what this is for, and the answer may be "nothing" — in which case say
      so here and let critics stop raising it. — *product critique · ?*

---

## Landed

- [x] `PM-01` **Serve the Parquet bundle from lapledger.org.** `/f1-parquet.zip`
      returned 404: the build step lived in a script Cloudflare never ran, and
      the interpreter with `sqlite3` had no `pip`. Moved into `npm run build`,
      which demonstrably runs, and the deploy script deleted rather than fixed —
      a build step whose execution cannot be established is worth less than no
      build step. CI holds the rebuild gate instead. —
      *project record · [#25](https://github.com/Alex-Farley/formula-1-data/pull/25)*

- [x] `PD-01` **Write a page for every chassis the app links.** 1,130 routes
      worked in the app and 404'd to anyone who followed a shared link;
      `prerender.js` iterated `cars` (29) where `Cars.jsx` links `chassis`
      (1,153). Fixed as the union of both, because six ids name a car no single
      chassis owns. 2,385 pages → 3,515. The smoke test caught its own stale
      expectation mid-change. — *product critique · `12629d8`*

- [x] `PD-04` **Attach recorded disagreements to the facts they are about.**
      `discrepancies` is one of the few tables this project originates and lived
      only on `/reference/quality`, aggregated. Now beside the fact on the 16
      race pages and 2 driver pages an open disagreement names — in the app and
      in the prerendered HTML, so both halves say the same thing. A `verify.py`
      check refuses a subject that joins to nothing, because the join fails
      silently by design. — *product critique · `7d1f444`*

## Declined

Measured, decided, and on the record. Each may be re-raised — the reason is what
a critique has to argue against.

- **Route-level code splitting in the front end.** The bundle is 398 KB raw /
  118 KB gzipped, irrelevant beside the database the browser downloads (4.4 MB
  gzipped, 20 MB raw). — `CLAUDE.md`

- **An HTTP range-request VFS for the data layer.** No source has lap times under
  a redistributable licence, and prerendering already took the download off the
  first-paint path. The product critique reopened this specifically and cleared
  it: *"the problem is not the 27 seconds — it is that the page shown during them
  is a different product."* — `CLAUDE.md`, `docs/TIMING-ARCHITECTURE.md`,
  `PD` critique

- **`BUILT` as a real timestamp.** The database must be a pure function of its
  sources so CI can compare the committed artefact against a fresh build, and so
  the browser can cache on a digest. — `CLAUDE.md`

- **Merging `f1-geometry.db` into `f1.db`.** ODbL's share-alike reaches the whole
  database its data lands in; merging would put 117,000 unrelated rows under
  ODbL. — `CLAUDE.md`, `docs/COMMERCIAL-READINESS.md`

- **Filling `laps`, `stints`, `race_timing` and `race_control_messages`.** No
  source publishes Formula One lap timing under a licence that permits passing it
  on. The empty tables are the correct permanent state, not a missing feature. —
  `docs/TIMING-ARCHITECTURE.md`

- **Deleting the 148 hand-maintained 2025–26 rows** in `races`, `race_entries`
  and `standings` as redundant beside F1DB. The Wikipedia harvest stops at 2024,
  so they are the only independent check on the two most recent seasons.
  Removing them removes a check, not a liability. — `docs/COMMERCIAL-READINESS.md`

- **A deploy-time database rebuild.** The Cloudflare build does not rebuild the
  database and should not: a build step whose execution cannot be established
  invites exactly the reasoning that cost three deploys. CI rebuilds from
  `data/*.py` and compares against the committed artefact on every push, which is
  a better place to stop a bad database than a deploy. — `CLAUDE.md`,
  [#25](https://github.com/Alex-Farley/formula-1-data/pull/25)
