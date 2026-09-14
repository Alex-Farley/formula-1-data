# Landed and declined

What has been done and what was decided against, each entry with the pull
request that closed it or the reason it was declined. Nothing here is a task.
The queue of open work is
[GitHub Issues](https://github.com/Alex-Farley/formula-1-data/issues) and its
ranking is the [Lap Ledger project](https://github.com/users/Alex-Farley/projects/1);
the conventions - id, source, size, how an item lands or is declined - are in
`CONTRIBUTING.md` under *The queue*.

Until 2026-09-13 both sections sat at the foot of `docs/BACKLOG.md`, under the
open items. They moved here in one piece when the open items became issues
(`PM-37`, decided that day); the entry format is the one the backlog used, and
the ids are the ones the issues carry on. An item that lands now is closed by
its pull request (*Closes #n*) and is not copied here; an item declined now is
closed with a comment saying why. This file is the record of everything before
that, and a later critique still has to argue against a *Declined* entry below
before re-raising it.

## Landed

- [x] `PM-36` **The loop runs each item in a forked context, at a chosen
      pace.** Measured from the session transcripts: the session driving the
      loop was 75-85 % of its tokens, the reviewers 15-25 %, because 190-440
      turns each carried a median 230,000-356,000 tokens of backlog slices,
      build logs and reviewer reports. `/backlog-loop` is now a thin driver
      that invokes `backlog-item`, a forked skill holding the per-item
      procedure, and reads back one contract line; `next.py` prints the one
      item to work on instead of the 145 KB queue; a pace argument (`fast`,
      `balanced`, `thorough`) sets what the table in `backlog-item/SKILL.md`
      allows and nothing else; the three reviewers carry `effort: high` and a
      90-turn runaway cap, and `frontend-reviewer-quick` is the fast pace's
      Sonnet variant with 50; `tests/test_conventions.py` checks every agent's
      and skill's frontmatter; the duplicate `.claude/commands/backlog-loop.md`
      is gone (skills win over commands of the same name). Decisions 1-3 under
      *Decisions needed* taken the same day; `PM-37` filed. —
      *project record · [#111](https://github.com/Alex-Farley/formula-1-data/pull/111)*

- [x] `PM-35` **Review cost, second pass: a PASS merges as reviewed, and the
      rungs of one item are one PR.** Decided 2026-09-13 by the maintainer,
      after the `PD-02` run spent four Opus passes and three Sonnet
      confirmations on four rungs whose diffs one pass would have read: the
      reviewed head merges on PASS as it is and non-blocking code findings are
      carried into the next PR, named in the PR comment; a fix that is only
      documentation, a comment, a test or dead-code removal merges without a
      further pass; the rungs of one M item ship as one PR; `smoke.mjs` proves
      static-against-app parity for every shown row so the brief no longer asks
      a reviewer to rebuild it. Set in the loop's skill and `review-prompt.md`;
      `CONTRIBUTING.md` says so. —
      *project record · [#106](https://github.com/Alex-Farley/formula-1-data/pull/106)*

- [x] `PM-33` **Review cost: which model, and when a fix needs no further
      pass.** Decided 2026-09-13 by the maintainer, after the 2026-09-12 run
      spent 40,000-130,000 tokens a reviewer pass over two or three passes a
      PR: Opus for a first pass on data and front-end alike (the front end
      reviewed thoroughly, with a design eye); a fresh Sonnet context to
      confirm a fix or to review a docs-, backlog- or wording-only change; one
      reviewer, with the licence reviewer added only when a source is added or
      reclassified, a workflow, export or publishing path is touched, or a
      whole dataset is taken from one source; a post-PASS fix that is only
      documentation wording, a blank line or a comment merges without a
      further pass, named in the PR comment. Revised by `PM-35` and, for the
      `fast` pace only, by `PM-36`. —
      *project record · [#98](https://github.com/Alex-Farley/formula-1-data/pull/98)*

- [x] `LV-04` **Is a full season's timetable within facts-only?** Decided
      2026-09-12: option (a), proceed as facts-only, with the reading recorded
      in `docs/COMMERCIAL-READINESS.md` (a public schedule the promoter and
      the FIA both publish, not a compilation whose value is in the
      collecting; five rows an event) and the FIA event timetable as the
      independent check still owed (`known_gaps` #15). The reading landed
      in #91 with the timetable rows; the page followed as `LV-02` in #95. —
      *project record · [#91](https://github.com/Alex-Farley/formula-1-data/pull/91)*

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

- [x] `CD-01` **A classified finisher reads *Finished*, not an em dash.** 15,714
      of 27,482 `race_entries` rows carry a null `status` and a finish
      position; every one rendered as the em dash meaning "not established",
      under a footer asserting the opposite in as many words. All twenty
      finishers of the 2024 Bahrain Grand Prix read that way. The finding named
      two render sites; there were five — the sprint table, car pages and the
      prerenderer had it too. One rule in `format.js`, imported by
      `prerender.js` rather than restated, because a copy in the static half is
      the `circuit_geometry` failure again. The footer was false and is now
      true. — *content critique · `cb5364b`*

- [x] `IA-15` **The download instruction names both database files.** The one
      sentence on 3,515 pages that says the artefact exists named `f1.db` alone
      and did not link it, against a binding `CLAUDE.md` rule. It now names
      both, links both, and says why they are two: a collective database keeps
      the share-alike from reaching across, and merging them would pull 117,000
      unrelated rows under it. Stays on the SQL console — `IA-15` wants it on
      `/data`, which is `IA-02` and does not exist yet. It reached the
      static page only; the app's copy, and the sentence that the file
      documents itself, landed with `SD-09` in #52. — *IA critique ·
      `8c26ccf`*

- [x] `IA-04` **The document is renamed when the reader navigates.** No
      `document.title` existed anywhere in `web/src/`, so after any in-app
      navigation the tab, the bookmark, the history entry and the screen
      reader's announcement all still named the page the reader landed on. It
      lives in `Page`, which every page already hands the string it uses for
      the h1, so the document name and the visible name cannot drift. A page
      with no name gets the site alone, never `undefined — Lap Ledger`. `SITE`
      and `titled()` moved to `src/lib/site.js` so the two halves cannot name a
      page differently. `smoke.mjs` asserted a title on cold load only — the
      one case the prerenderer always got right, which is why this shipped — and
      now navigates in-app too, confirmed to fail with the fix disabled. —
      *IA critique · `9f93566`*

- [x] `PM-25` **The four fastest-lap rows were two shared fastest laps rendered
      as one name.** The question was what `stored_value` and `derived_value`
      meant per row, and answering it turned four rows into two facts. The
      1960 Belgian Grand Prix article credits Brabham, Ireland and Phil Hill
      jointly at 3:51.9, which is Hill's sixth; the 1969 Canadian Grand Prix
      article credits Brabham with the 1:18.1 both harvests credit to Ickx,
      which is Brabham's twelfth, and Ickx keeps his 14. `SHARED_FASTEST_LAPS`
      in `data/harvest.py` restores both and refuses to apply if the harvest
      row ever changes. The 1970 South African row stays with Brabham alone:
      the article footnotes that some sources credit Surtees, but his
      reference total of 10 excludes it and was corrected to 10 once already
      on that evidence — but the article records that sources differ, so
      that row stays **open** with the reasoning attached rather than being
      closed on the strength of another figure. The two shares are resolved
      rows on the record; Ireland's 1 and Ickx's 14 are now held as reference
      totals so all three restored names sit under the external cross-check;
      and the prerenderer lists every setter of a shared lap, as the app did.
      — *project record · `621c49a`*

- [x] `PM-05` **Pole is its own flag.** `grid = 1` carried two meanings — the
      car that started from the front and the driver credited with pole — and
      they differ in three completed races: 1996 r9 and 2021 r5, where the
      pole-sitter never started, and 2022 r21, where the sprint winner started
      first and pole stayed with the fastest qualifier, which the old rule
      recorded as a row with grid 1 and grid text 8. `race_entries.pole` is fed
      by the season record, `grid` is F1DB's, and the fastest qualifier stays
      in `qualifying`. The thirteen pole-versus-fastest-qualifier rows are gone
      from `discrepancies`, because neither source was wrong about what it
      describes; `verify.py` pins all three counts instead, and
      `discrepancies` goes from eighteen open rows to one. A pole the build
      credits from F1DB's grid 1 while the harvest catches up is now
      distinguishable by its source and refused outside the current season.
      `VERSION` is 2.21, because a new column and six changed views should
      not ship under the released schema's number. The
      front-end review caught the car page selecting its columns by name and
      so rendering every car's poles as zero; the smoke test now asserts the
      MP4/4's fifteen and was confirmed to fail without the fix. —
      *project record · `621c49a`*

- [x] `CD-13` **The race page no longer states a cause.** "Started P4, after a
      grid penalty" is now "started P4"; where a sprint set the grid, which
      `races.sprint` does hold, it still says so. Both renderers, one wording.
      Rode with `PM-05`. — *content critique · `621c49a`*

- [x] `UR-01` **The 2025 and 2026 championship positions render.** 65
      end-of-season rows carry `position` and no `position_text`; the tables
      fall back to `position`, `fold()` carries both across sources, and the
      driver chart's own table does the same — the review caught that one.
      Smoke: the 2025 champion is P1. — *user research · `f632fd4`*

- [x] `UR-02` **A winless season reads 0, not an em dash.** `COALESCE` in
      both `BY_SEASON` queries; Best and Championship stay dashed because
      those are genuinely not established. Smoke: a winless season reads 0.
      — *user research · `f632fd4`*

- [x] `UR-10` **The poles caption states the pole rule.** One string. —
      *user research · `f632fd4`*

- [x] `UR-11` **Bahrain at Sepang is explained on the page.** The authored
      field is the race's note and its lede. Smoke asserts it. —
      *user research · `f632fd4`*

- [x] `UR-08` **The SQL console shows 1950, not 1,950.** `raw` on
      `DataTable`. — *user research · `f632fd4`*

- [x] `IX-12` **The footer sentence naming a button below it is gone.** —
      *interaction critique · `f632fd4`*

- [x] `AX-03` **The heading takes focus on in-app navigation.** `tabIndex={-1}`
      in `Page`, on `pathname` change after the first render. —
      *accessibility critique · `f632fd4`*

- [x] `AX-04` **Result counts are announced.** `role="status"` on the SQL
      console's count and on the registers' — the latter after typing
      settles, because a live region per keystroke is worse than none. —
      *accessibility critique · `f632fd4`*

- [x] `AX-05` **`--ink-faint` clears 4.5:1 on all four light surfaces**
      (5.30 / 4.81 / 4.56 / 4.98), and the token comment says which surface
      each figure was measured on. — *accessibility critique · `f632fd4`*

- [x] `AX-08` **`scroll-padding-top` under the sticky masthead.** —
      *accessibility critique · `f632fd4`*

- [x] `VD-04` **A true zero renders faint in the registers**, so careers
      surface. — *visual critique · `f632fd4`*

- [x] `VD-05` **The constructor wins chart plots every season on whole-number
      ticks.** A drought is a gap; the subtitle that excused it is gone. —
      *visual critique · `f632fd4`*

- [x] `VD-06` **The dot plot labels P1.** — *visual critique · `f632fd4`*

- [x] `VD-09` **Title years read "2008, 2014–15, 2017–20"** from one shared
      rule in both renderers, and no longer break mid-number. Unit-tested;
      the review caught two-year runs not collapsing. —
      *visual critique · `f632fd4`*

- [x] `IX-01` **The boot state is a strip pinned to the foot of the viewport**
      while the static page is showing, named and bounded, with one live
      region and one `h1`. Measured at 4 Mbps: on screen at 2 s. Closes the
      same finding's other faces, `VD-02`, `UR-04` and `AX-01`. —
      *interaction critique · `6a3269d`*

- [x] `VD-02` **With `IX-01`.** — *visual critique · `6a3269d`*

- [x] `UR-04` **With `IX-01`.** — *user research · `6a3269d`*

- [x] `AX-01` **With `IX-01`**: progressbar named by the phase sentence,
      `aria-valuemin/max/valuetext`, phase words in one `role="status"`, and
      focus moved to the heading at handover. — *accessibility critique · `6a3269d`*

- [x] `IX-02` **A click during the download is a route change, not a
      restart.** Same-origin clicks on the static page go to `pushState`;
      the strip says what is pending; the router picks the route up at
      ready. Measured: one `f1.db.gz` request, ready at 12.6 s on the clicked
      route, where it was two requests and 14.9 s. Closes `UR-03`. —
      *interaction critique · `6a3269d`*

- [x] `UR-03` **With `IX-02`.** — *user research · `6a3269d`*

- [x] `IX-03` **Scroll position survives the handover and the heading takes
      focus.** — *interaction critique · `6a3269d`*

- [x] `IX-13` **A failed boot offers Try again.** `retryOpen()` drops the
      cached promise and the dead worker. — *interaction critique · `6a3269d`*

- [x] `IX-14` **"Works offline" now says what is true**: an open tab keeps
      working without a network. — *interaction critique · `6a3269d`*

- [x] `UR-06` **The static footer carries the version and build date** from
      `meta`, so a search arrival's figures are dated. Smoke asserts it. —
      *user research · `6a3269d`*

- [x] `CR-02` **`f1_compat.json`'s 2026 snapshot is 23 rows, not 333.** Root
      cause fixed as `DA-01`'s first two rungs: `v_standings_final` (one row
      per entity per season, same columns as the table) and
      `ux_standings_identity` (the table's inert `UNIQUE` made real, with
      `position_text` in the key). Both compat queries, the full export, the
      CLI and the three pages read the view; the exporter refuses a snapshot
      listing an entity twice; `lib/standings.js` is gone. Two fresh reviews
      each failed once — count-only tests, and no check on the half of the
      fold that keeps entries — and both gaps are closed by value-level and
      row-level checks that were confirmed to fail on a broken copy. The
      second review also found the view's "larger total is newer" premise
      false for nine 2026 entities where the sources disagree at the same
      round; the build now files each as an open `discrepancies` row shown
      on the driver's or constructor's page, and a check refuses an unfiled
      one. Costs 1.5 MB in `f1.db`, 373 KB gzipped. — *code review · #39*

- [x] `CR-11` **Every view is selected from in `verify.py`.** A view over a
      missing column now fails a check, not a reader's query. —
      *code review · #39*

- [x] `CR-18` **Both unfailable assertions can fail.** The views loop is
      real; the multi-engine warning is a check that the view keeps as many
      multi-engine constructor-seasons as the table. — *code review · #39*

- [x] `SD-02` **A season the calendar does not hold is refused, not skipped.**
      One `race_for()` on the build object replaces six silent `continue`s
      in the F1DB loaders: a round inside a known season with no race yet is
      skipped and counted (the summary line now says how many), a year the
      season register lacks stops the build and names the fix. The
      standings loader, keyed by year, refuses the same way. A copy with one
      synthetic 2027 result refuses to build. `meta.coverage_seasons` is
      derived from `seasons` rather than typed. — *service critique · #40*

- [x] `CR-05` **A failed build leaves the committed databases untouched.**
      `build.py` writes `f1.db.tmp` and `f1-geometry.db.tmp` and moves each
      into place only after every stage ran and the header is pinned.
      Observed the day it was fixed: #40's first commit carried a 581 KB
      fragment. On a copy a refused build exits 1 with `f1.db` byte-identical.
      — *code review · #41*

- [x] `CR-01` **Every bulk table has a floor.** Eight tables and two bulk
      columns are checked against their count at v2.22 in `verify.py`; a
      database built with `f1db_pit_stops.txt` or `fastest_laps.txt`
      deleted, which passed every gate on `main`, now fails (the standings
      floor from #39 already caught that one). Fastest laps are checked per
      race rather than by count. Raise a floor when a harvest legitimately
      adds rows, never lower it. `car_specs.txt` and `article_images.txt`
      fill columns rather than tables and remain unfloored: `CR-21`. —
      *code review · #42*

- [x] `CR-04` **`./f1` opens the database read-only.** `./f1 sql "CREATE
      TABLE …"` used to persist into the committed file. — *code review · #42*

- [x] `DA-12` **`race_entries.source` names who established the finishing
      position.** The pole harvest ran first and created a bare row citing
      the season article; F1DB's upsert then filled every other column and
      left the citation, so 1,136 pole rows cited Wikipedia for F1DB's whole
      classification. The upsert now takes F1DB's source with the position
      where the row had none, and a season-harvest winner keeps its own. The
      pole and fastest-lap credits' provenance — `harvest/poles.txt`, whatever
      `source` says — is declared on the columns in `schema.sql`; a check
      refuses a non-winner carrying F1DB's laps under another source; the
      inferred-pole check now reads the harvest's coverage rather than the
      source column. The proper fix is still `PM-14`. — *data architecture
      critique · #43*

- [x] `SD-03` **The refresh polls daily.** F1DB publishes within a day or two
      of a race; a weekly poll that missed by four hours left a run race
      shown as unrun for eight days. The job's diff step short-circuits a day
      with nothing new. — *service critique · #44*

- [x] `SD-05` **The refresh builds and tests the site before it commits.** Its
      push is made with `GITHUB_TOKEN`, which starts no workflows, so `ci.yml`
      never ran on the weekly harvest commit while Cloudflare deployed it.
      The web build and the smoke test — which reads its expectations out of
      the refreshed database — now run in the refresh itself, before the
      commit. — *service critique · #44*

- [x] `CR-08` **`meta.coverage_note` is derived from the counts.** The typed
      sentence told a bulk-data consumer the database held no qualifying
      beside 26,997 qualifying rows, and "pole 1950-2024" beside poles to
      2026, in `f1.db`, both exports and the Parquet bundle. Every figure in
      it is now read off the table it describes, and `verify.py` rebuilds the
      same string and compares it whole. `PD-24` is the same finding on the same surface
      and closes with it. — *code review, product critique · #45*

- [x] `PD-24` **With `CR-08`**: the same stale prose on the same surface. —
      *product critique · #45*

- [x] `DA-07` **`known_gaps` #5 no longer calls `pit_stops` empty.** It holds
      22,481 F1DB stops (lap and order, no durations) and `team_radio` six
      quoted exchanges; the gap now says so, the `pit_stops` schema comment
      says both duration columns are NULL in the distributed database and
      why, and a check refuses a table the gap calls empty that is not. —
      *data architecture critique · #45*

- [x] `CR-10` **The compat export's headline facts are derived.** "Lando
      Norris — 2025", "Nino Farina (1950)" and "7 each" were string literals
      in code that CI compared only against itself; they now come off
      `seasons` and `drivers`, so the day the 2026 title is decided the file
      says so. The duplicate `grands_prix`/`grands_prix_register` key is left:
      a v1 consumer may read either. — *code review · #46*

- [x] `CR-06` **The pole and venue harvests are pinned to the calendar.**
      `applied != 1161` in two places had to be bumped by hand after every
      Grand Prix or the build refused, and caught a truncated file only by
      being the right number. One function now asserts the rule it stood in
      for: one row for every completed race up to the harvest's last, none
      twice. A race after the last row is the week the harvest has not caught
      up yet, which the F1DB vacancy fills cover and `verify.py` counts. —
      *code review · #48*

- [x] `CR-09` **No document states a check count.** It was stated seven
      ways and none was right; `verify.py` prints the live figure and nothing
      else claims one. The two figures in `BUILD-NOTES.md` are release history
      and stay. — *code review · #49*

- [x] `CR-16` **The Node requirement is declared.** `prerender.js`,
      `smoke.mjs` and `prepare-assets.js` import `node:sqlite` unflagged,
      which is Node 22.13; `engines` in `web/package.json` says so before the
      second build step does. `web/.nvmrc` joins the root `.node-version`
      Cloudflare reads — two files because two tools read them. —
      *code review · #49*

- [x] `CR-13` **The Parquet step installs nothing on a laptop, and CI reads
      its result.** `pip install` runs only where `CI`, `CF_PAGES`,
      `WORKERS_CI` or `LAPLEDGER_PARQUET` is set; elsewhere the step reports
      that pyarrow is absent and how to allow the install. `ci.yml` prints
      `build-status.txt` and fails if the bundle did not build. —
      *code review · #50*

- [x] `SD-06` **`/build-status.txt` is a heartbeat.** Deploy commit, database
      version and build date, the round the data is complete through, and
      the F1DB version the harvest came from — on success and on failure —
      so a deploy that has been failing for a month is one fetch from a
      diagnosis. — *service critique · #50*

- [x] `SD-09` **The download paragraph says the file documents itself.** Three
      clauses — `sqlite_master` for the commented schema, `meta` for version,
      build date and what is held, `source_registry` for the licence of every
      row — shared with the static page through `lib/site.js`. Found in
      passing: the app's SQL page never carried `IA-15`'s download paragraph
      at all; it does now, and a smoke check holds both renderers to it. —
      *service critique · #52*

- [x] `CR-14` **`make ci` does what `ci.yml`'s Python job does**, in its
      order, including the redistribution gate on the committed database and
      the artefact comparison that neither `check` nor `all` ran. `CLAUDE.md`
      points at it. — *code review · #53*

- [x] `IX-05` **Search ranks equal matches by prominence.** The index carries
      wins (or races, for a circuit); "hamilton" offers Sir Lewis before
      Duncan, "schumacher" Michael before Ralf. The rule lives in
      `lib/search.js`, unit-tested; a smoke check holds the palette to it. —
      *interaction critique · #54*

- [x] `IX-06` **Search folds diacritics both ways.** "raikkonen" finds
      Räikkönen and "Räikkönen" finds Raikkonen, whichever spelling the
      register holds. — *interaction critique · #54*

- [x] `IX-07` **Search takes the words in any order.** "monaco 1996" finds
      the 1996 Monaco Grand Prix; every word typed must appear, and the rank
      is the best-placed one. — *interaction critique · #54*

- [x] `IA-05` **A car is found by the name anyone types.** The index carries
      `chassis.full_name` — "Ferrari 312/67" — not the bare model number. —
      *IA critique · #54*

- [x] `UR-09` **The records caveat sits above the figures it caveats**, not
      1,900 px below them. This was the sentence that already existed, moved;
      `PD-03`'s derivation (#68) then replaced it with the sentence that no
      longer needs to caveat anything. — *user research · #55*

- [x] `VD-10` **A badge that never varies is said once.** `/records`' thirty
      identical `medium` badges and `/reference/eras`' ten are one sentence
      each; the column and the per-row badge return only where tiers differ.
      — *visual critique · #55*

- [x] `VD-13` **`/records` no longer right-aligns phrases as if they were
      figures.** Left-aligned; the split into a number and a qualifier came
      with `PD-03` (#68) as `value_num` and `unit` beside the display
      `value`. — *visual critique · #55*

- [x] `IX-08` **The atlas marker travels the racing direction.** The stitched
      ring is reversed where its signed area disagrees with
      `circuits.direction`; Baku and Long Beach walked backwards against the
      direction stated beside them. The origin stays arbitrary, so the
      readout says "along the trace" rather than implying a lap position. —
      *interaction critique · #56*

- [x] `IX-09` **The scrubber says what is under the marker** — the corner
      band and its radius — so it teaches the colour key instead of counting
      up a distance the drawing already shows. — *interaction critique · #56*

- [x] `CD-10` **The confidence pill goes to the ladder.** A link to
      `/reference/quality` with the tier in its title, in the app and in the
      static facts lists, so "medium" is a word with a definition one click
      away rather than a bare word. — *content critique · #57*

- [x] `AX-11` **Section headings have a space before their count**, in the
      accessible name and not only in the CSS: "Classification 20 entries",
      not "Classification20 entries". The Spa layout headings and the error
      box are the same defect on other components and stay open under
      `AX-11`'s reasoning. — *accessibility critique · #57*

- [x] `AX-14` **Chip filter groups have a name.** `role="group"` and a label
      saying what the chips filter, at all nine call sites. —
      *accessibility critique · #57*

- [x] `IX-04` **A runaway console query can be cancelled.** sql.js has no
      interrupt, so Cancel terminates the worker, reopens the database (from
      IndexedDB on a return visit) and re-sends every page query that was
      waiting; console statements are never re-sent, and the console runs one
      at a time — the first cut replayed the runaway itself, and the review
      caught it. Leaving the page stops its statement. The smoke suite runs a
      three-way self-join, refuses a second Run, cancels, and checks the
      console and a register both work afterwards, then leaves the console
      mid-runaway and checks the register fills. The re-send of a waiting
      page query is covered by reading, not by the suite: nothing on the
      console page queries while a statement runs. No timeout: a slow honest
      query is the reader's to wait for or stop. — *interaction critique · #58*

- [x] `VD-07` **The rail's middle bands separate by lightness.**
      `--rail-classified` darkened in light and lightened in dark; points
      against classified is 2.1:1 in both themes, measured in the script
      that made the change. — *visual critique · #61*

- [x] `VD-08` **The racing-colour sentence is prose**: `--sans`, 13 px, under
      the swatch, within the measure. — *visual critique · #61*

- [x] `VD-11` **The confidence ladder has rungs.** High is a 2 px border,
      reference 1 px, medium dashed; the ends keep their colour. — *visual
      critique · #61*

- [x] `VD-15` **Column headers are 10.5 px.** — *visual critique · #61*

- [x] `VD-16` **Prose cells keep to 60ch.** — *visual critique · #61*

- [x] `VD-17` **The pale end of the ramp clears 3:1 on the stage** (3.2:1 in
      light; the ramp re-spaced so each step stays at least 1.3:1 from the
      next). The continuous legend bar is not done; `AX-07`'s contrast half
      is. — *visual critique · #61*

- [x] `VD-18` **The fastest-lap mark is the accent**, the one cell where
      "this was fastest" is literally what it marks. `AX-12` still owns the
      markup half. — *visual critique · #61*

- [x] `VD-19` **The console's textarea fits the query it was given.** —
      *visual critique · #61*

- [x] `VD-21` **`web/README.md` describes the mark that ships**: four by four,
      one accent cell. — *visual critique · #61*

- [x] `WK-02` **The cost cap is a schedule.** Seven `regulation_limits`
      rows — the headline figure for 2021, 2022, 2023–2025 and 2026, and the
      per-Competition adjustment for each — every one read from the FIA
      Financial Regulations issue for that year and citing it; a 2026
      `regulation_changes` row for the US$215m figure. `verify.py` refuses
      overlapping spans of one limit and a missing cap year. — *Wikipedia
      survey · #59*

- [x] `VD-12` **The circuit page draws its lap with the atlas's renderer.**
      One component, `LapFigure`, called by the atlas and by `/circuits/:id`:
      corner-radius bands, the direction of travel as an arrow, the marker
      where a caller walks the lap. `TrackMap` and its second stitcher are
      gone. No start marker — neither database holds that coordinate, and
      where the trace closes the caption says the arrow is the direction, not
      the start; where it does not close (Monaco, Las Vegas, Montjuïc) there
      is no arrow and no claim of one — the first cut said it anyway, and the
      review caught it. 3D stays
      declined; an elevation strip waits on `PD-23`. — *visual critique · #62*

- [x] `PD-07` **The README states what the database holds.** Every figure it
      gives about the current database is a `<!-- fig:name -->` span that
      `tools/readme_figures.py` computes from `f1.db` (and `f1-geometry.db`
      for the centrelines) with one expression per name; `make all` rewrites
      them, and a `verify.py` section recomputes each and fails the build
      where the text disagrees. 39 tables / 34 views / ~8,400 rows became
      46 / 39 / 119,265; "qualifying, not held at all" became 26,997 rows;
      "standings cover 2025–26 only", "sprint results not held", "podiums
      hand-entered" and "every Monday" were false and are fixed. Prose that
      could not be derived — check counts, refusal tallies that live in harvest
      logs, the way-end distances — was deleted rather than left to drift. The
      version log moved to `docs/BUILD-NOTES.md`; `PM-04` stays open with the
      proposed text on it. — *product critique · #60*

- [x] `PM-02` **`BUILD-NOTES.md` runs to v2.22.** v2.16–v2.22 folded in from
      the README's log, newest first, dated from the tags and the version-bump
      commits, nothing dropped; the two facts the README's header carried that
      the v2.1 and v2.3 entries did not are in them now. — *project record · #60*

- [x] `PM-03` **"Next, in order" is gone.** `BUILD-NOTES.md` now says
      `docs/BACKLOG.md` is the only queue, and why a second list that can go
      stale is worse than none. — *project record · #60*

- [x] `VD-14` **A table wider than its box says so.** A fade at the right
      edge while there is more table to the right, set by `DataTable` from
      the scroll position, and the scroll region takes a tab stop only then.
      Smoke checks the driver register at 375 px. — *visual critique · #63*

- [x] `IA-14` / `IX-15` **The masthead wraps on a phone.** Two rows rather
      than a strip with a hidden scrollbar; smoke checks every item is on
      screen at 375 px. — *IA and interaction critiques · #63*

- [x] `VD-20` **A loading photograph, a failed one and an arrived one look
      different.** `CommonsImage` tracks the three states: the sunk box
      breathes while the thumbnail is on its way (still under
      `prefers-reduced-motion`), and a failed load collapses to a sentence
      with the link to the file page. The other half — the three redirects
      per thumbnail, and whether to hold the resolved `upload.wikimedia.org`
      URL in the harvest — is a data change and stays open as `VD-23`. —
      *visual critique · #63*

- [x] `UR-13` **A season still running opens with who leads, by how much,
      after how many rounds** — in the app's stats and the static facts list,
      and in the page description a search engine shows. Found on the way:
      the static standings table read the raw `standings` table and listed
      every 2026 driver twice (formula1.com and F1DB rows after the same
      round); it now reads `v_standings_final`, as the app does — for every
      season, not only a running one: the review of #64 found 2025's static
      table gained its team column, which the raw snapshot left blank. — *user
      research · #64*

- [x] `IA-07` **The SQL console has a permalink.** `?q=` carries the
      query: written on every run, read and run on arrival, so a query can
      be shared, bookmarked or cited. — *IA critique · #65*

- [x] `IX-11` **An example no longer destroys the reader's query.** Not
      through `execCommand('insertText')` — a controlled textarea and the
      browser's undo stack do not agree — but by keeping what was replaced
      and offering it back in one click. — *interaction critique · #65*

- [x] `CR-21` **The two column-filling harvests have a floor.** `verify.py`
      requires `chassis.weight_kg` and `chassis.wheelbase_mm` to be filled at
      least as often as at v2.22 and `article_images` to hold at least its
      602 rows, so deleting `car_specs.txt` or `article_images.txt` no longer
      builds clean. — *code review of #42 · #66*

- [x] `LV-01` **Live session data — decided.** The weekend timetable and
      after-the-fact session classifications go ahead as `LV-02` and `LV-03`;
      a live feed is declined unless a licence is obtained, because session
      timing is FOM's data. — *request · decided 2026-09-12*

- [x] `PM-04` **The GitHub repository description** now states what the
      database is and where to browse it. — *product management · applied
      2026-09-12*

- [x] `PD-03` **`/records` is derived, not published.** The thirty authored
      rows — at `medium`, twenty-four spellings of `as_of`, nothing in
      `verify.py` reading them, Hamilton on 105 wins beside a `drivers.wins`
      of 106 — are gone. `build.py` derives 29 records in `derive_records()`,
      each one query over the tables the leaderboards read, with its rule,
      exclusions and runners-up in `detail`, every holder of a tie, and
      `as_of` read off the last completed race. Five the old table carried
      cannot be derived and are declared in `known_gaps` #12 rather than
      typed: youngest and oldest champion (the clinching round), closest
      finish and longest race (no race times), the only woman to score
      points (no gender attribute). Three derived figures differ from the
      authored rows they replace (`data/technical.py` before #68): Arrows'
      382 merged the Footwork years, and counting under one constructor name
      as `constructors.wins` does gives Sauber 547; McLaren's 15 of 16 in 1988
      is beaten outright by Red Bull's 21 of 22 in 2023; and 833 was
      qualified "under the current points system", a qualifier the derivation
      does not apply, so 860 (2023) stands. `verify.py` recomputes nine of
      them by a different route. — *product critique · #68*

- [x] `DA-19` **`records` can be joined, compared and checked.** `key`,
      `holder_table` + `holder_id` (NULL exactly when shared), `value_num` +
      `unit` beside the display `value`, one ISO `as_of` that `verify.py`
      holds to the coverage. — *data architecture critique · #68*

- [x] `IA-02` **`Reference` leaves the masthead; `Data` takes the slot.** The
      masthead stays at eight: Seasons · Races · Drivers · Constructors ·
      Circuits · Cars · Records · Data. `/data` is the database's own front
      door; `quality`, `sources` and `sql` sit under it at `/data/quality`,
      `/data/sources` and `/data/sql`, summarised on the front door and kept
      as the pages they were — merging two long pages was a rewrite, and this
      was a move. `eras` and `glossary` keep `/reference/eras` and
      `/reference/glossary`, lose the slot, and are reached from the pages
      about the sport: Seasons, Cars and Circuits already led to the eras;
      Races now leads to the glossary and the home page to the eras; the two
      carry an "About the sport" nav of their own. The four old addresses
      answer in the app with a `<Navigate replace>` that carries the search —
      `/reference/sql?q=…` is #65's permalink and still runs — and in the
      static output with a redirecting page each (meta refresh, canonical to
      the new address, `noindex`, the query carried by script), written
      outside the sitemap. The smoke test asserts the eight, the version on
      `/data`, both redirects with the query intact, and the sitemap naming
      the new addresses only. — *IA critique · #67*

- [x] `PD-11` **Give the bulk data a front door, and a claim.** `/data`, in
      the app and prerendered: the version and build date from `meta`, the
      two database files with sizes and the manifest's digests, the Parquet
      bundle — linked from a page for the first time — the two JSON exports
      named as release assets rather than linked, since nothing serves them,
      the confidence ladder, the counts of disagreements, open disagreements,
      gaps and sources read live, the three licence classes with their
      counts, the four empty tables stated as a licence decision, and the SQL
      console. The claim is `PD-14`'s wording — *cross-checked against
      independent sources, with every disagreement and every gap published in
      the data* — in one string in `site.js` shared by `Data.jsx` and
      `prerender.js`, so the app and the crawlable page cannot say different
      things. The static page carries `schema.org/Dataset` markup with a
      `DataDownload` per served file. `CD-07`'s adversarial sentence is still
      open; the sizes and digests come from `db-manifest.json`, not yet the
      release body's which-copy-wins sentence or the publisher block
      (`UR-05`/`SD-15`). — *product critique · #67*

- [x] `PD-09` **Rework `/reference`.** Landed as `IA-02` and `PD-11`, which
      made the naming decision this was waiting on: the database drawer is
      `/data` in the masthead, the sport drawer kept its addresses, and the
      redirects were the work. — *product critique · #67*

- [x] `CD-02` **111 driver ledes open with how the row got into the database.**
      `drivers.notes` was doing two jobs — the page lede and meta description,
      and the record of how a harvest put the row there. Split: the provenance
      sentence moves to a new `drivers.provenance` column, shown in the driver
      page's "On the record" fields in the app and the prerendered HTML alike,
      and kept out of the meta description; `notes` keeps only what the string
      already said about the driver, so the 62 podium-harvest rows now have no
      lede and their description falls back to the stored wins and poles (a derived summary is `CD-20`). `verify.py`
      refuses a note that opens with "Added " or mentions a harvest.
      — *content critique · #70*

- [x] `UR-12` **Amon's page gives three answers to "how many races".** The prose
      no longer states a figure the strip derives: "96 starts" and "eleven
      podiums" leave Amon's note, and the same rule takes the typed starts,
      races and podiums out of twelve more — Heidfeld's 183, de Cesaris's 208,
      Barrichello's 322 among them. Amon's 96 cited no source, so it leaves
      rather than becoming a `discrepancies` row. `verify.py` refuses a bare
      integer before starts, races, wins, poles, podiums or points in any
      driver note. — *user research · #70*

- [x] `PD-06` **The drivers register's first screen answers a question.**
      Most wins first, in the app and the static page; `Entries` and
      `Starts` — published figures held for 38 and 31 of 862 drivers, so two
      columns of em dashes — are gone from the register and stay on the
      driver's page labelled as stored; `Races` is counted from the race
      records. Also pins the front-end reviewer agent to Opus, as every other
      reviewer already was. — *product critique · #69*

- [x] `PD-05` **`known_gaps` carries a state, and the site counts only the
      open ones.** `state` is `open`, `closed` or `position`, and `reader` is
      the one-paragraph version a reader is shown; the description and
      resolution the rows always carried are the maintainer's note, kept
      whole behind a disclosure. `/data/quality` and its prerendered page
      show three groups — Open, Positions, Closed — and a closed gap is
      recorded as closed, never deleted. The homepage, `/data` and the
      README figure all count `v_open_gaps`; `verify.py` holds the view to
      the table, requires a reader sentence on every row and a version or PR
      in every closed row's resolution. — *product critique · #72*

- [x] `CD-06` **The count is seven, not six, and the twelve rows are placed.**
      #1 and #2 closed (the fastest-lap harvest, the full classification),
      #5, #8 and #10 positions (no redistributable lap timing, a race in
      which no lap was set, no historic centrelines), and #3, #4, #6, #7, #9,
      #11 and #12 open — #12 arrived with `PD-03` in #68, after the critique
      counted. The critique's six reader sentences are used where they still
      fit the row; the others are written from the row's own text. The 2021
      Belgium note stays in the register as a position rather than moving to
      the race page. — *content critique · #72*

- [x] `PD-10` **A citation block on every page.** One sentence — the
      database version and build date and the page's permanent address —
      from one function in `site.js`, rendered by `Page` in the app and by
      `chrome()` in the static page, so a crawler sees it. The page is named
      by its address, not its title: the two renderers title routes
      differently, and the review caught the drift. Pages that do not exist
      (the not-found route and the six "No such …"/"No season" shells) offer none. The
      reader's own access date is left to the reader; the build date is what
      fixes the figures. — *product critique · #71*

- [x] `CD-20` **81 driver pages describe themselves in fifty characters.**
      Every driver's meta description is now one sentence counted from the
      race records — the entries, first and last year, constructors, wins,
      podiums, poles and best finish the strip derives — and never a column
      the page labels "(published)": "Entered 88 championship Grands Prix
      across 1979–1986 for Arrows, Brabham and 3 other constructors; best
      finish fourth." A career with no classified finish says so. The lede
      follows where a whole sentence of it fits; where it would be cut
      mid-thought the derived sentence stands alone, so all 862 end at a
      sentence and none reads "0 wins". The smoke suite checks the first
      lede-less driver's description against the entry count in `f1.db`.
      — *review of #70 · #75*

- [x] `CD-18` **"Races" on the register, "Entries (stored)" on the page.**
      One word, "Entries", for the count of `race_entries` rows — a row is an
      entry, not a start — on the register (app and static, column and
      footer), in the strip and season table on the driver's page, and in
      the static page's facts and seasons table. The published figures are
      labelled for what they are, "Entries (published)" and "Starts
      (published)", in the app and the static HTML alike; the static facts
      gain the derived Entries the app's strip already showed.
      — *review of #69 · #75*

- [x] `WK-05` **The season's grid is counted.** `v_season_grid` — drivers
      entered (from the race entries; a DNQ is an entry, and no source says
      who started), constructors by their F1DB key so the Indianapolis
      builders of 1950–1960 count, engine makers, races run — one row per
      season, pinned by `verify.py` to direct counts for four seasons; a line
      on every season page and a fact on the static one. The first cut
      counted the curated constructor key (1950 read eight, not
      twenty-three), said "started", and bounded the view by identities; the
      review caught all three. — *Wikipedia survey · #73*

- [x] `CD-19` **Driver ledes no longer spell a figure the strip derives.**
      `verify.py`'s check reads spelled cardinals (one to twenty, thirty to
      hundred, compounds), digit and spelled ordinals above "first" ("300th
      start", "eighth start"), and "Grand Prix" between the number and the
      noun, before starts, races, entries, wins, poles, podiums, points,
      fastest laps or titles; a year before "title" and a margin ("by two
      points") are not figures. It caught sixteen notes, and stripping the
      figure exposed five that the race records contradict — Hulkenberg's
      pole came on his eighteenth start, Bottas was runner-up twice not four
      times, Ricciardo never won for Renault, Stroll's pole was Istanbul 2020
      not Monza 2017, Rindt had three races left not four — and one false
      record: 2025's top three were 13 points apart against 2007's one, so
      "the closest top three ever" leaves Piastri's note and, though no
      regex reached it, Norris's. Each note keeps what its string already
      said; "Ten podiums." simply goes. — *review of #70 · #74*

- [x] `CR-22` **The static `/records` page is not the app's `/records`.**
      Narrowed by #68: both renderers open with the same one-sentence claim
      and the static table carries the derivation column. What remained was
      the tier: the app said once that every row is `reference`, the static
      page said nothing about it. The static page now says it in the app's
      sentence, from the app's query, in `web/src/queries/records.js`. —
      *review · #77*

- [x] `CR-23` **The static `/records` table has a `Category` column the app
      never shows.** Predates #68; the review of #68 measured it. The static
      table is now drawn from the app's column list, so it cannot carry a
      column the app does not. — *review · #77*

- [x] `CR-24` **The static drivers register is not the app's.** Eight
      columns against nine, Poles before Podiums against Podiums before
      Poles, no Fastest laps. Same defect as `CR-22`/`CR-23`. The register is
      now the app's query and column list, from `web/src/queries/drivers.js`;
      the driver page's strip and its season table follow the same way.
      Found by the review of #69. — *review · #77*

- [x] `WK-04` **The new-team entry fee is a press figure, and the database
      says so.** A `known_gaps` row: the anti-dilution fund is a term of a
      private contract, the US$200m and US$450m figures are reported, not
      published, and no `governance` row carries them. Closes if the FIA or
      Formula One publishes the figure. — *Wikipedia survey · #78*

- [x] `PM-20` **The two data warnings are read, and neither was data to
      sit.** The two qualifying rows without a race entry are the HRTs that
      failed the 107 per cent rule at Melbourne in 2011: F1DB's qualifying
      holds them, its classification omits them (its 2012 classification
      records the same case as DNQ). Not added by hand — the classification
      is loaded whole from a harvest file the fetch rewrites, and there is no
      curated path for a classification entry — but declared: an open
      `known_gaps` row, and the warning is now a check pinned to the pair by
      identity, whose detail says which way it failed. The three chassis
      entered after their car's works career are real privateer entries (de
      Tomaso 1957, Dochnal and Blokdyk 1963, Courage and Irwin 1967), which
      the warning's own comment already said; that check is pinned to the
      three by identity too. — *project record · #80*

- [x] `CD-21` **The lede check allows an adjective before the noun.** Up to
      two lower-case words may sit between the number and the noun ("three
      straight wins"); a capitalised word names a subset the page never
      totals ("Six Monaco wins", verified 6, and Hill's 5) and stays; "GP"
      qualifies the noun like "Grand Prix". Re-run, it found five: Ascari's,
      Vettel's and Schumacher's streaks were right and are now dated rather
      than counted, Surtees's seven motorcycle titles are counted as times
      rather than titles, and Montoya's "fourth GP start" was wrong — the pass on
      Schumacher at Interlagos 2001 was his third. — *review of #74 · #79*

- [x] `PM-27` **The fetch tool reads F1DB's licence before it writes a
      row.** `licence_check()` in `tools/f1db_fetch.py` requires the deed in
      the checkout to be titled Attribution 4.0 International and to name no
      NonCommercial, ShareAlike or NoDerivatives element, and exits
      otherwise — so `refresh.yml` fails at the fetch and commits nothing,
      and reclassifying the source in `SOURCE_LICENCE` becomes a decision
      someone makes rather than a header a constant stamped; the message
      asks for the file to be read, since the check cannot tell a relicence
      from a reformatted deed. Eight unit tests, offline; the live deed
      passes. — *project record · #83*

- [x] `PD-13` **The upstream dependency is written down.** `docs/UPSTREAM.md`:
      what F1DB supplies (115,161 of 119,280 rows at v2.23, table by table),
      how it arrives (a committed snapshot, refreshed daily by `refresh.yml`
      and committed only on a full pass), the four cross-checks that refuse a
      bad load, what happens if it stops (staleness, not breakage; the
      replacements in cost order, with formula1.com kept at the check scale
      its facts-only classification covers) and if it relicenses (the grant
      is irrevocable, section 2(a)(1); the one unsafe path is `PM-27`).
      Linked from the README's Staying current section. The review of #82
      caught the first draft overstating the project's independence from
      F1DB in three places and mis-citing a gap and a licence section; the
      README's "known_gaps #1" for the Jolpica decision was the same
      mis-cite and is #2 now. — *product critique · #82*

- [x] `CD-22` **Where the register's seasons are not the race records', the
      page says which is which.** The Seasons note on the driver strip, in
      both renderers, reads "1969–1973 in the race records, 1970–1973
      published" where the spans differ; two drivers do (Cevert's 1969
      German Grand Prix in a Formula 2 car, Rossi's practice-only 2014), each
      side right about something, and `verify.py` pins the pair. An open
      span — a driver still driving — makes no claim about its last year,
      which the first cut missed and the review caught on 23 current
      drivers. — *review of #75 · #81*

- [x] `IX-17` **The grid filter keeps the grid, and derives it.** It tested
      `last_season` against 2026, a year the register's open span never
      holds, and matched nobody. The shared `DRIVERS` query now derives
      `on_grid` — an entry in the latest completed season — and the season
      itself, so the chip names the year from the data; `verify.py` fails an
      active driver with no entry and reports a mid-season replacement (the
      review of #84 found Doohan in 2025 would have failed a two-way pin);
      the smoke test pins the exact count and that it is above zero. In
      pre-season, when the calendar holds a year with nothing completed, the
      register check is only reported — the second review found a
      name-based exemption covered a debutant and not a returning signing. —
      *review of #81 · #84*

- [x] `CD-23` **The lede check is one tested pattern.** `tools/lede_figures.py`
      holds it, with its reasons; `tests/test_lede_figures.py` makes both
      interpreters prove 18 catches and 12 leave-alones. Career qualifiers
      (`F1`, `Formula One`, `World`, `World Championship`, `Championship`,
      `Drivers'`, `career`) no longer hide a total; "of", "his", "the" and
      kin no longer bridge the gap; "Six Formula One wins" is reported whole
      and "Formula One wins" alone is not a figure; eleventh to nineteenth
      join the ordinals, which had skipped them — the comment's own
      Hülkenberg example never matched — and so does twenty-first and kin,
      which the review of #85 found the same way. No note needed rewriting;
      three stale open lines are gone from the queue, each a duplicate of
      a landed entry — `CD-21` (#79), `CR-23` and `CR-24` (both #77) — the
      first two by a block edit the review of #85 caught as unrecorded. — *review
      of #79 · #85*

- [x] `CD-24` **Subset figures in a driver note are counted.**
      `subset_figures()` in `tools/lede_figures.py` finds the "<N> <Place>
      wins/victories/poles/podiums" form — and only that form; "six wins at
      Monaco" is not read; `verify.py` counts each from `race_entries`, the
      table the strip derives from, where the place is a Grand Prix (Senna
      6, Hill 5, Trintignant 2 at Monaco) and requires the rest to be
      declared — Ickx's six Le Mans wins are, and an undeclared place fails.
      — *review of #79 · #88*

- [x] `PM-29` **The build reads the season in progress from the entry
      lists.** `b.current_season` is the latest year anybody entered; the
      admitted drivers' `status` and the admitted constructors' `active`
      flag compare against it instead of a typed 2026 that would have kept a
      2026-only driver active after the rollover; the curated registers'
      typed statuses are untouched. The build stops if the entry lists ever
      reach a season the classification has not, which is the assumption
      the derivation rests on. Byte-identical database today. — *review of
      #84 · #86*

- [x] `PM-28` **Nine gap citations name the gap they mean.** Three code
      comments that meant the Jolpica licence decision now say `known_gaps`
      #2 and four that meant the abandoned chassis-per-race harvest say #3
      (one of them in `schema.sql`); the `article_images` provenance note
      and the `table_provenance` schema comment said #10, the centrelines,
      for #11, whether a photograph shows the car — and those two ship in
      `f1.db`, so this is a rebuild, not a comment edit. The review of #87
      found the three the `.py`-only grep missed. — *review of #82 · #87*

- [x] `CD-25` **The reason two spans differ sits beside the fact.**
      `EXPLAINED_SPANS` in `data/harvest.py` puts a `discrepancies` row for
      Cevert (a Formula 2 class at the 1969 German Grand Prix) and Rossi
      (two 2014 entries, no start), status "explained - each side is right about
      something"; both renderers show it through the disagreement aside,
      introduced as two readings rather than a disagreement to settle, and
      `verify.py` derives the pair it pins from those rows, so the pin and
      the explanation cannot drift apart. The review of #89 caught the first
      Rossi wording claiming a practice-only 2014 when F1DB's entry lists
      name him as entered for two rounds; the row now says what the data
      says. The symmetric-predicate clause is `CD-26`. — *review of #81 ·
      #89*

- [x] `PM-30` **A gap's id is written, not counted.** Every `KNOWN_GAPS`
      tuple carries its id, so filing a gap mid-list no longer renumbers the
      citations after it; `verify.py` requires the ids to be 1..N with no
      gap or repeat, and walks the tree for every `known_gaps #N` to fail
      one that names a row that does not exist. Which existing row a
      citation should name stays a reader's judgement, as `PM-28` was. —
      *review of #87 · #90*

- [x] `LV-02` **The weekend timetable, as data.** `sessions`: 115 rows, every
      session of the 23 2026 weekends with its start in UTC and the
      circuit's IANA zone, read from formula1.com's race pages (a start time
      is a fact). `verify.py` holds each weekend to the five sessions its
      sprint flag implies, in running order, with a valid zone, and holds
      each race's local day to the last day of the calendar's weekend — the
      test that proves the UTC reading and the zone together (Las Vegas
      races on a Saturday evening that is Sunday in UTC). Starts carry a Z
      so a browser reads them as UTC. The FIA's per-event timetable PDFs are
      not yet read by tool; `known_gaps` #15 records that every start has
      one source behind it until they are. The page work stays open as
      `LV-02`. — *request · #91*

- [x] `PD-12` **The timing constraint is a position.** The shared `NOT_HELD`
      sentence on `/data`, in both renderers, opens with what the absence
      means — nobody publishes Formula One race timing under a licence that
      permits passing it on, so this database holds none of it, and
      everything here may be passed on under the licence shown beside it —
      before it names the four empty tables. The first cut said "no one may
      lawfully redistribute lap timing", which the review of #94 showed was
      a claim about the law rather than the licences and collided with the
      27,000 qualifying lap times F1DB publishes under CC BY; `known_gaps`
      #5 carries the same words. — *product critique · #94*

- [x] `PM-31` **The commercial-readiness figures are spans the build writes.**
      `tools/readme_figures.py` now writes every document in `DOCUMENTS` —
      the README and `docs/COMMERCIAL-READINESS.md` — and counts the licence
      position the way `./f1 licences` does: class shares, the two facts-only
      domains, and each listed table's rows; `verify.py` checks them all.
      The class table had said 539 against 552 held. The writer refuses a
      facts-only row in a table the statement does not itemise, and every
      listed table's figure must be stated or the build fails — the review
      of #92 found the first cut's span would have rewritten itself around
      an unread row, and a second cut's sum check that could not fail. —
      *review of #91 · #92*

- [x] `CD-26` **The span comparison is symmetric, and either end can be
      declared.** A NULL at either end of the register's span is no claim
      about that end and the other is still compared, in `seasonsNote()`
      and the `verify.py` pin alike; an `EXPLAINED_SPANS` row may name
      `last_season`, and its figures are checked against the records' MAX
      year as a first-season row's are against MIN. No row needed it today.
      — *review of #81 · #93*

- [x] `PD-26` **`/records` holders are links.** `holderPath()` in the
      shared records module resolves a driver, constructor, circuit or race
      holder to its page — a race by year and round, which the query now
      carries — and both renderers link it; a shared record, which names
      two holders and carries no id, stays text. The wins and poles
      leaderboards link their drivers as well; the champions, decade and
      constructor tables are `PD-27`, because their views carry no id. —
      *product critique · #96*

- [x] `CD-27` **The aside and the strip agree: the register's figure is
      "published".** The explained aside says "the published span and the
      one the race records give differ", from a footer string both renderers
      share and a unit test pins. The quality page's column is "Recorded",
      not "Published" — the review of #97 found thirteen of its rows hold
      this project's own authored claim, which nobody published. The
      assessments inside `f1.db` still say "the register's" and "the stored
      figure"; that is database prose, `CD-28`. — *review of #89 · #97*

- [x] `LV-02` **The weekend timetable, on the page.** Every race page carries
      a Timetable — each session on the circuit's clock and in UTC, both
      derived through Intl from one stored instant and zone — in the app and
      the static page from the shared `web/src/queries/sessions.js`; the app
      adds the reader's zone and "Next: … in 11 days", and the 2026 season
      page names the next session with a link to its race, computed in the
      browser, which is the only place "now" exists. — *request · #95*

- [x] `PM-32` **The loop is a skill, not the default.**
      `.claude/skills/backlog-loop/`: the procedure (`SKILL.md`), the CI
      waiter that treats
      empty output as pending, the merge helper that resolves only the
      backlog's predictable conflict and a moved figure span, rebuilding the
      artefacts rather than hand-merging them and stopping on any source
      conflict, the reviewer brief, and a `precheck.sh` that refuses the slips
      a reviewer used to find. Three review rounds in the 2026-09-12 run were
      lost to retyping these by hand. Model policy decided 2026-09-13:
      Opus for a first pass, Sonnet to confirm a fix or review wording, one
      reviewer unless a source is reclassified, and a documentation-only fix
      merges without a further pass (`PM-33`). Invoked with `/backlog-loop`
      through `.claude/commands/backlog-loop.md`; `CLAUDE.md` says so. —
      *project record · #98*

- [x] `CD-28` **The assessments say "published" too.** The two explained
      span rows and the nine 2026 points rows in `discrepancies` no longer
      say "the register's" or "the stored figure"; every surface on a driver
      page now uses the one word. — *review of #97 · #99*

- [x] `PM-34` **The fourteen stale open lines are gone.** `CD-18`, `CD-19`,
      `CD-24`, `IA-02`, `PD-03`, `PD-05`, `PD-10`, `PD-11`, `PM-29`, `PM-31`,
      `VD-07`, `VD-08`, `VD-11`, `VD-12` — each confirmed against its *Landed*
      entry and its open line removed in the 2026-09-13 re-rank; the merge
      helper's duplicate check is the guard from here. — *review of #98 ·
      [#100](https://github.com/Alex-Farley/formula-1-data/pull/100)*

- [x] `IA-17` **The season in progress is labelled as concluded.** The
      headings turn on whether a round is still scheduled — *The title race*
      and *Drivers' standings after round 13* while one is, *How the title
      was decided* and *Final drivers' standings* once none is — from one
      rule in `queries/season.js` that the app, the prerenderer and the smoke
      test all read, so the static page fixed itself in the same change
      (`UR-13`'s other renderer). On `/seasons` the live row carries its
      leader, the leader's points and wins so far, the driver second, the gap
      and *13 of 23* rounds, each marked *so far*, from `queries/seasons.js`;
      `/races` opens on the last race run, the rounds to come following every
      race that has been; the next session is a tile among the others, and
      only in the app, since only a browser knows how long until it. Rung two
      of `PD-02` shipped with it, because the fix and the sharing were one
      edit. — *IA critique · #102*

- [x] `PD-02` **The prerenderer calls the page components' own queries.**
      Every table the app draws is defined once, in `web/src/queries/*.js`
      — SQL, column list, footers and any heading rule — and read by the
      page and by `scripts/prerender.js`, so the static half prints the
      app's tables by construction: drivers, driver and records (#77);
      seasons, season and races, with `IA-17` (#102); the constructors,
      circuits and cars registers (#103); the race page (#104); the
      constructor and circuit pages (#105); the car page and the eras,
      glossary, sources and quality pages (#106). `smoke.mjs` compares the
      tables on the routes it visits — 28 comparisons — static against app:
      header, row count and every shown row. Not tables, so not shared and
      still the static half's own shapes: the known-gaps sections, the eras,
      lineage and layout timelines, the circuit atlas; and the static half
      has no eras Safety timeline, chassis-coverage figure or photograph
      stats at all (`VD-01`). The riders stand as
      their own items: `VD-01` (the static half's design), `AX-17`
      (captions), `CD-04` (the rules for reading the numbers), `IA-03`
      (breadcrumb and onward band). — *product critique · #77, #102–#106*

## Declined

Measured, decided, and on the record. Each may be re-raised — the reason is what
a critique has to argue against.

- **Moving `/records` out of the masthead.** The IA critique (`IA-16`) examined
  the slot and endorsed it: seven of the eight current nav items map 1:1 to a
  table, and Records is the only one cut by question rather than by storage, as
  well as the highest-intent fan destination. `PD-03` is a content problem, as
  filed. The escalation is recorded on `PD-03`, not here. — `IA` critique

- **Building full-text or site-wide search.** It already exists. `Search.jsx` is
  good work that is mislabelled and indexes the wrong column; `IA-05` and
  `IA-06` are the fix. — `IA` critique
  **Re-raised 2026-09-13 as natural-language search.** The position holds for
  full-text: the fix for a question is not indexing more text. What is filed
  instead is `IA-20` — a wider needle, an intent grammar and a question
  library, no model — with generated SQL held as a decision.

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

- **Interactive 3D circuits with elevation.** Raised by the author on
  2026-09-11; declined by four disciplines independently (`PD-23`, `VD-12`,
  `IX-10`, `UR` Q3). The reasons that bind: it would be the only figure in the
  database with no cross-check and no honest confidence tier; the free DEMs
  are surface models that return rooftops on the seven street circuits; a
  WebGL canvas cannot be prerendered, cannot carry `Figure.jsx`'s table of its
  own numbers and cannot be read by a screen reader, on the one page type that
  already has no static content; three.js would double the bundle the
  code-splitting decision rests on; and a perspective view makes the one
  comparison the shape supports *harder*. The Lap Ledger-shaped versions are
  filed and small: `elevation_change_m` as a sourced column (`PD-23`), the
  atlas renderer on the circuit page (`VD-12`), and a profile strip under the
  plan map if a source is ever classified. Re-raise with a sampled SRTM
  profile of Monaco that looks like Monaco. — `PD`, `VD`, `IX`, `UR`

- **A formula1.com-style hero portrait on driver pages.** formula1.com's
  pages are a marketing surface for ~20 licence-holder drivers; this register
  has 862, and 302 of them would have no portrait, clustered in the pre-1970
  half that is most this project's own. Across 22 simulated tasks no persona
  was blocked by the absence of a photograph; five were blocked by a false
  or missing figure. An *identification* portrait beside the heading remains
  open as `PD-18`, after `PD-16` and `PD-19`. — `PD`, `VD`, `UR`
  **Checked 2026-09-13:** `PD-28`'s season page keeps to this — no portrait,
  the season's figures lead.

- **Changing `race_entries`' grain to (race, driver, car).** The known loss
  from one row per driver per race was measured: two positions in 27,482 rows
  (1955 Argentina P3, 1956 Monaco P4) where a co-driver already has a row in
  that race. Changing the grain would touch every view, both exporters,
  `verify.py` and the front end to fix two rows. Record the two in
  `discrepancies` with the arithmetic; move the grain statement into an
  inline schema comment that ships (`DA-06`). — `DA` critique

- **The whole-download architecture**, re-examined a third time on
  2026-09-11 by the product, interaction and user-research critics with the
  network available, and cleared again: the second visit is 0.8 s, and the
  cold window is a content-and-signalling problem (`IX-01`, `IX-02`, `PD-02`,
  `PD-22`), not an architecture one. — `PD`, `IX`, `UR`

- **Making the repository public.** Declined 2026-09-11, **reversed
  2026-09-14**. `PD-14` and `SD-01` raised it and were right about the
  consequence — the pipeline half of the "audited" claim (the ~200 checks,
  the source literals, "rebuild and compare") was readable by nobody, and the
  release page's stable links were 404. They were declined anyway, on the
  author's preference rather than on a fault in the argument. What reversed it
  was not that argument but a cost: Actions on a Free private repository
  allows 2,000 minutes a month, a day of the backlog loop bills about 320, and
  on 2026-09-14 every job stopped starting mid-item. Public repositories are
  unmetered, so the choice was between rationing the loop and publishing the
  code the critiques wanted published. The reason they gave is what made the
  second one easy.

  What the reversal buys: the claim `PD-14` asked for becomes true and
  `AF-02`'s three follow-ons stop being workarounds; the release page's links
  resolve; `pages.yml` becomes usable; and branch protection, which a Free
  private repository cannot have, can finally enforce the three green checks
  that until now were convention. What it costs is read before it was done —
  `COMMERCIAL-READINESS.md` under *Still open* and *Decided: the pre-split
  history stands*, and `LICENSE-DATA` under *Circuit geometry*. — the author

- **Telemetry replays.** Re-raised by the maintainer on 2026-09-13 and
  declined again, on the licences alone: Jolpica-F1 and OpenF1 are CC
  BY-NC-SA 4.0 (OpenF1 now declares it on its own site — `PD-29` corrects the
  stale *FOM's data* cell), FastF1 is FOM live-timing data, F1DB has no lap
  times. What may be drawn is drawn: `PD-30`'s grid-to-flag, stint windows and
  gap-to-pole from CC BY 4.0 tables. Re-raise only with a source that both has
  the data and permits passing it on. — `PD` critique, the design review

- **A ninth masthead item for the current season.** The taxonomy is eight cuts
  by entity plus `Data`; the season is the one cut by time and already has a
  slot at `/seasons/:year`. `IA-18`'s `/now` redirect and `PD-28`'s page that
  knows it is in progress do the job; the nav already overflows at 720 px
  (`IA-14`). — `IA` critique

- **A new visual identity.** The Pit Wall system is measured and coherent;
  the flatness is density and what the accent is spent on (`VD-26`, `VD-28`,
  `VD-34`, `PD-34`). A repaint would change none of the pages whose problem is
  what is on them. Keep the tokens; spend them differently. — `PD`, `VD`
  critiques

- **Livery colours inside `f1.db`.** `PD-31` is upheld for the database: no
  F1DB field, no Wikidata value, nothing here can check a hex, and a livery is
  per-season and often mid-season. The front-end palette `AF-04` is the form
  the maintainer chose instead, on 2026-09-13, over the critic's
  recommendation to decline liveries everywhere. — `PD` critique, the
  maintainer
