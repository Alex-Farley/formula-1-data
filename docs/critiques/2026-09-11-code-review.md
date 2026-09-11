# Code review — 2026-09-11

**Critic:** senior-engineer whole-codebase code review (not a diff review), first run.
**Subject:** Lap Ledger at v2.21, `main` at `c4026ca`, 2026-09-11. Python build and checks first, `web/` second, per the brief's scope. *(The critic's own header named `c8aa3cf`, the pre-#33 head; corrected here — the review ran against the v2.21 tree.)*
**Brief:** `.claude/CRITIQUE-BRIEF.md`. Read `CLAUDE.md`, `docs/BACKLOG.md`, and `docs/critiques/2026-09-10-product-design.md` finding 1 (`PD-02`) before starting.

**Status of the claims below.** The review ran read-only against the repository; every experiment ran on a copy under the session scratchpad, and the working tree was left unmodified (`git status` clean before and after). Each finding carries an evidence tag: `ran it` means the number came out of a command run today; `queried the database` means it came out of the committed `f1.db`; `read the source` means it is a reading of the code with a file and line; `inference` means it is reasoned, not observed. Nothing tagged `ran it` has been independently re-checked by anyone else yet.

**How the queue reads this.** Findings are filed `CR-01` to `CR-20`. Where one overlaps a filed item the ID is cited and the overlap is said in one line. Sizes are the brief's: S one sitting, M a few sittings shippable in pieces, L a decision first.

**Measured today, for orientation** (`ran it`, on a copy): `python3 build.py` 8.6 s wall, of which 6.2 s is one stage; `verify.py` 0.42 s, 202 PASS / 7 WARN / 0 FAIL; 32 unit tests in 0.002 s; `audit.py` 0.19 s; `export_json.py --compat` 0.77 s. Rebuilt `f1.db`, `f1-geometry.db` and `f1_compat.json` were byte-identical to the committed copies, on a Mac against the CI-built originals. The whole local check cycle is about nine seconds, which is the single best fact about this codebase and the reason most of what follows is cheap to fix.

---

## The three that matter

### 1. Three of the seven bulk harvest files can disappear and the build and every check pass (`CR-01`)

`data/harvest.py:1046-1083` (`_read_named`) returns `[]` when a generated harvest file is absent, by design: "these files are optional and the build must work without them". That was right when the files were a local extra. Now they are 93% of the rows, and nothing downstream puts a floor under them. On a copy I deleted each file in turn and rebuilt (`ran it`):

| removed | build | `verify.py` | what caught it |
|---|---|---|---|
| `race_results.txt` (27,577 rows) | exit 0 | exit 1, 3 FAIL | three pole/grid checks, by side effect — not a "results are held" check |
| `qualifying.txt` (26,997) | exit 0 | exit 1, 1 FAIL | the pole-vs-fastest-qualifier pin of 13 |
| `standings.txt` (34,498) | exit 0 | **exit 0, 0 FAIL** | nothing |
| `f1db_pit_stops.txt` (22,481) | exit 0 | **exit 0, 0 FAIL** | nothing |
| `fastest_laps.txt` | exit 0 | **exit 0, 0 FAIL** | nothing |
| `race_dates.txt` | exit 0 | exit 1, 2 FAIL | date checks |
| `sprint_results.txt` | exit 0 | exit 1, 2 FAIL | sprint checks |

`verify.py`'s `the_full_classification` section guards its standings and qualifying checks with `if nqual:` and `if nstand:`, so an empty table is a section that does not run rather than a section that fails. CI's byte-compare would catch a *committed* database built this way only if the committer had not also committed the rebuild, which is exactly what a contributor who lost a file would do. **A database that silently drops 34,498 championship standings passes every gate this project has.** Defect. **S**: one check per bulk table, "held, and at least N where N is the last committed count" — the same pin pattern the project already uses for `1161` — or, better, make `_read_named` refuse a missing file for the files `TABLE_PROVENANCE` says are the source of a table.

### 2. `f1_compat.json` has shipped a corrupt 2026 standings snapshot in seven released versions, and CI blessed each one (`CR-02`)

`export_json.py` (`--compat`, the `driver_standings_snapshot_2026` and `teams_2026` queries) selects `FROM standings WHERE year=2026 AND table_type='drivers'` with no `after_round IS NULL`. Since v2.15 loaded F1DB's after-every-round standings, that returns 333 rows for 23 drivers and 165 for 11 teams; the first three rows of the committed file are Antonelli P1 242 pts, Russell P1 25 pts, Russell P1 51 pts (`queried the database`, `ran it`). Every committed `f1_compat.json` from v2.15 (2026-09-05) to v2.21 carries 310 or 333 rows where v2.14 carried 23 (`ran it`, `git show` across 23 commits). The "committed artefacts are current" step in `ci.yml` compares the file against a fresh build of the same code, so it cannot see this — it certifies reproducibility, not correctness, and `CLAUDE.md` calls the file "the v1 key layout other things were written against". Defect. **S**: add `AND after_round IS NULL AND as_of IN ('current','final')` (or take the larger-points row the way `web/src/lib/standings.js` `finalStandings` already does); add one `verify.py`-style assertion in the exporter that a snapshot has one row per entity. Owner of the root cause is the data-architecture critic (`as_of` is free text carrying three meanings); the fix here is one clause.

### 3. Nothing tests the checks (`CR-03`)

`CLAUDE.md` says the build is the test. It is a test *of the data*. Nothing tests the *build or the checks*: `verify.py` has 184 assertion call sites (`ran it`: 163 `check(`, 16 `warn(`, 5 `verdict(`; 209 at runtime through loops) and there is no test anywhere that any one of them fires on bad data. `tests/` (32 tests) covers six pure functions — `_norm`, `split_names`, `_vnorm`, `parse_rounds`, `_haversine`, `_lap_topology` — and none of: `_read_pipe`/`_read_named`, `constructor_for_f1db` (the year-dependent mapping whose failure "nothing caught" per its own docstring), `resolve_f1db_drivers` (the Piquet/Piquet Jr collision, "learned the hard way" twice), `venue_circuit_id`, `normalise_countries`, `split_geometry`, `pin_sqlite_header`, either exporter, or any `verify.py` section. A check whose SQL quietly stopped constraining anything — the failure mode `data-integrity-reviewer.md` is written to look for — passes forever, and finding 1 above is that failure mode observed. The mutation experiment in finding 1 *is* the missing test. Defect (of coverage). **M**, shippable in pieces: `tests/test_verify.py` that builds once to a temp path (`verify.py --db` already exists for this), applies one mutation per test — empty `standings`, a duplicate `(race_id, finish_position)` without `shared_drive`, a `source` citing `api.jolpi.ca`, a driver with `wins_external ≠ wins` and no declaration — and asserts the *named* check fails. Six tests would already cover the licence gate, which is the one that matters most and today has zero tests.

---

## The full set, by consequence

### `CR-01` — the bulk tables have no floor. *See above.* `ran it`. Defect. **S**.

### `CR-02` — the compat export's 2026 snapshot. *See above.* `ran it`, `queried the database`. Defect. **S**.

### `CR-03` — nothing tests the checks. *See above.* `read the source`, `ran it`. Defect. **M**.

### `CR-04` — `./f1 sql` can alter the committed database

`f1:67` opens `sqlite3.connect(DB)` read-write and `f1:818` runs the argument verbatim. On a copy, `./f1 sql "CREATE TABLE zzz_probe(a)"` persisted and changed the file's bytes; an `UPDATE` happened to be rolled back only because Python's legacy transaction handling never committed it (`ran it`). DDL, `VACUUM`, `PRAGMA` and `ATTACH` all run in autocommit. The brief and `CLAUDE.md` both describe the command as read-only, and `CLAUDE.md`'s first rule is never to edit `f1.db` by hand; the browser worker (`web/src/data/worker.js`, `queryReadOnly`) gets exactly this right with BEGIN/ROLLBACK and the CLI does not. Defect. **S**: `sqlite3.connect(f"file:{DB}?mode=ro", uri=True)`.

### `CR-05` — a failed build leaves a partial `f1.db` in the working tree

`build.py:162-164` deletes the database and opens the new one in place before any stage runs. When I corrupted one line of `harvest/chassis.txt`, the build exited 1 at stage 10 and left a 577,536-byte `f1.db` with 46 tables and zero drivers where the committed 20 MB file had been (`ran it`). `git status` then shows `f1.db` modified; `verify.py` run afterwards checks the fragment. CI would catch a commit of it, but the contributor has already lost the file they had. Defect. **S**: build to `f1.db.tmp`, `os.replace` on success, and do the same for `f1-geometry.db`; `pin_sqlite_header` runs after the rename.

### `CR-06` — two hand-bumped constants, and a per-race manual tax

`build.py:1240` and `:1301` require `applied == 1161` for the pole and venue harvests; `harvest/poles.txt` and `harvest/venues.txt` are hand-written and each has exactly 1,161 lines, through 2026 round 12 (`ran it`). After every Grand Prix the F1DB refresh lands on its own (`refresh.yml`), and then a person must append a line to two harvest files *and* change two literals in `build.py`, or the build refuses. Stage 23 (`build.py:1644-1667`) exists to paper over the week in which that has not happened. The pin is doing real work — it is what catches a truncated file — but it is pinning the wrong thing. Defect (maintainability). **S**: assert "every race with `status='completed'` before the harvest's last `(year, round)` has exactly one pole row and one venue row", and drop the literal.

### `CR-07` — the season is a magic number in nine files

The literal `2026` appears 26 times in `build.py`, 29 in `verify.py`, 58 in `data/current.py`, 11 in `export_json.py`, 10 in `data/harvest.py`, 9 in `prerender.js`, 5 in `smoke.mjs`, 10 across `web/src` (`ran it`). Some are data (`CALENDAR_2026`), but many are logic: `"active" if max(yrs) >= 2026` at `build.py:361` and `:598`; `verify.py:728,731,800,803` pin "23 rounds", "six sprint events", "22 race seats", "11 teams"; `verify.py:311` pins "2025 win tally sums to 24". There is no `CURRENT_SEASON` and no list of what a season rollover touches. Some of these pins are the project's deliberate style and should stay pins; what is missing is one constant they derive from and one place that says which literals are season facts. `read the source`. Defect where it is logic, preference where it is a pin. **M** (S for the constant, the rest can follow one file at a time).

### `CR-08` — `meta.coverage_note` is stale prose shipped inside the artefact

`build.py:213-225` writes a hand-written coverage paragraph into `meta`, and it goes into `f1.db`, `f1_database.json`, `f1_compat.json` (as `"coverage"`) and `meta.parquet`. Today it says "qualifying, grid and lap-by-lap data (not held)" beside 26,997 qualifying rows, "pole position 1950-2024" beside poles through 2026, and "full finishing order … partial by design" beside a full classification (`queried the database`). This is `PD-07`'s defect — an authored figure drifted from the database — but on a surface `PD-07` does not name, and the one a bulk-data consumer reads first. Two smaller siblings: `schema.sql:3` reads "Version 2.0 (2026-09-04)" against `VERSION = "2.21"`, and `schema.sql:7` enumerates confidence as four values while `:13` defines a fifth. Defect. **S**: derive the sentence from counts, or delete it and point at `known_gaps`; cite `PD-07` when doing it so the `verify.py` check written there covers this too.

### `CR-09` — the number of checks is stated seven ways and none is right

121 (`CONTRIBUTING.md:17`, `docs/GITHUB-SETUP.md:22`), 133 (`docs/DERIVED-CONFIDENCE.md`, three times), 143 (`wrangler.jsonc:19`), 158 and 170 (`docs/BUILD-NOTES.md`), 171 (`ci.yml:21`), "~170" (the brief and `BACKLOG.md`). The runtime figure today is 209 assertions from 184 call sites (`ran it`). `CLAUDE.md` already records learning this exact lesson about the `discrepancies` count ("nothing checks a number in this file") and then did not apply it to the check count. Defect. **S**: remove every number, or have `verify.py` print it in its summary and `CONTRIBUTING.md` say "run `verify.py --list`".

### `CR-10` — `export_json.py` hand-types facts and exports one table twice

The `history_baseline` block in `--compat` carries `"most_recent_champion": "Lando Norris — 2025"`, `"most_driver_titles": "Lewis Hamilton and Michael Schumacher — 7 each"`, `"first_world_champion": "Nino Farina (1950)"` as string literals in code, in a file whose CI check compares it only against itself. The first will be wrong on the day the 2026 title is decided and nothing will say so. `grands_prix` is exported under both `"grands_prix"` and `"grands_prix_register"`. `read the source`. Defect. **S**: derive the three strings from `seasons`/`drivers`; drop one key (a v1 consumer may read either — check which before deleting).

### `CR-11` — 28 of 38 views are never exercised by the checks

SQLite accepts `CREATE VIEW v AS SELECT nosuchcol FROM t` and only fails on `SELECT` (`ran it`). `verify.py:1994-2003` counts rows in six views and marks four "queryable" with a `check(…, True, …)` that cannot fail; the other 28 are exercised only where the CLI, the app or the prerenderer happens to use them, and `v_car_lineage` is referenced by nothing in the repository (`ran it`). All 38 are queryable today. A schema change that breaks a view will surface in a reader's SQL console or a smoke-test route, not in `verify.py`. Defect. **S**: one loop, `SELECT COUNT(*)` over `sqlite_master WHERE type='view'`; decide whether `v_car_lineage` is a product or a leftover.

### `CR-12` — the stage pipeline is the right shape and a mechanical split of it

The `_Build` object and the `STAGES` list (`build.py:126-155`, `:2755-2791`) are the correct design: a sequence with declared shared state, provably byte-identical to the monolith it replaced. What a new contributor trips on is that the split was done by machine and not finished by hand (`read the source`):

- Names are truncated comment fragments. `_stage_13_a_regulation_figure_is_not_a` and `_stage_14_a_regulation_figure_is_not_a` share a stem; `_stage_07_cars_inserted_in_file_order_so` and `_stage_21_the_full_classification_qualifying_and_stand` are cut mid-word; docstrings are the same fragments (`"""drivers admitted from the F1DB register (data/drivers.py"""`).
- `_stage_31_figures_derivable_from_the_race_records` (`:2032-2034`) is empty. `_stage_20` reads `harvest/podiums.txt`, which does not exist in the repository, and runs `build_driver_map` every build to load zero rows.
- `_stage_34_link_race_entries_to_the_curated` (`:2215-2430`) does nine things its name does not say: car linkage, chassis and car counts, circuit and Grand Prix counts, constructor poles, `normalise_countries`, the authored ceiling, the commit, the geometry split and the `VACUUM`. It is the stage everything depends on and the one whose name says least.
- `_stage_28` is defined at `:2652`, after `build()` at `:2637` and after the comment "In order, because the build is a sequence"; file order and run order disagree.
- The `_Build` docstring says a stage's inputs "can be seen from its first … lines". `_stage_07:501-502` reads `b.known_cons` and `b.seen_cars` and then assigns both from scratch; `_stage_16:355-357` reads `race_key`, `lookup`, `driver_id` and rebuilds all three. The first lines show what the extractor found referenced, not what the stage consumes.
- `X_engine_eras()` (`:2633`) is a shim that returns `T.ENGINE_ERAS`; the name says technical, the source is teams.

None of this is wrong; all of it costs the next reader. Mostly preference, the empty stage and the false-inputs claim are defects. **M**: rename stages by what they do; move commit/split/vacuum into a final `_stage_99_finish`; delete `_stage_31`; make `_stage_20`'s file explicit or remove it; drop the read-then-overwrite lines so the docstring becomes true.

### `CR-13` — `npm run build` runs `pip install` on whoever's machine it is on, and CI never checks the result

`web/scripts/parquet-bundle.mjs` runs on every `npm run build` and, when `pyarrow` is missing, tries `pip install`, then `ensurepip`, then a cross-interpreter `--target` install (`read the source`). That is a JavaScript build step mutating the Python environment of any contributor who builds the site, with no flag to opt out; the design reason (Cloudflare's image) is sound for the deploy and unexpected on a laptop. It is non-fatal by design and reports to `public/build-status.txt`, which is right for the deploy — but `ci.yml`'s `web` job runs the same chain and never asserts `dist/f1-parquet.zip` exists or prints `build-status.txt`, so a Parquet regression is invisible in CI too, and `PM-24` will stay unanswerable from a CI log. Defect. **S**: gate the install behind `CI`/`CF_PAGES` (or `LAPLEDGER_PARQUET=1`), and in `ci.yml` `cat dist/build-status.txt && test -s dist/f1-parquet.zip`. `inference` on what happens on a fresh laptop; the local `build-status.txt` here says "pyarrow already present", so it either installed once or was there first.

### `CR-14` — no local command reproduces CI

`make check` is build, verify, test. `make all` is build, verify, export — no tests. CI is build, tests, verify, audit, export, `git diff --quiet` on three artefacts, four CLI smoke commands. `CLAUDE.md` has to warn contributors that `check` leaves `f1_compat.json` stale, which is the symptom. `read the source`. Preference. **S**: `make ci` that does what `ci.yml` does, including the diff, and point `CLAUDE.md` at it.

### `CR-15` — a fact is a position in a tuple

Adding a car means writing a 36-field positional tuple (`data/cars.py:35`, unpacked at `build.py:508-511`); a champion is 20 fields; a chassis insert is 39 placeholders. There are 831 such rows across the seven data files (`ran it`). Swapping `track_front_mm` and `track_rear_mm`, or `wheelbase_mm` and `weight_kg` where both are plausible numbers, is invisible to the build and to every check. The build's discipline is on *values*; the data files' shape has none on *positions*. `read the source`. Preference, bordering on defect for the 36-field rows. **M** or a decision: `typing.NamedTuple` per table with keyword construction is mechanical and keeps the build stdlib-only; the diff is large but it is a one-time regex.

### `CR-16` — `node:sqlite` is required and nothing says so

`prerender.js`, `smoke.mjs` and `prepare-assets.js` import `node:sqlite` (Node ≥ 22.5). `web/package.json` has no `engines` field and there is no `.nvmrc`; CI pins `'22'`, this machine has 24 (`ran it`). A contributor on Node 20 LTS gets `ERR_UNKNOWN_BUILTIN_MODULE` from the second build step with no hint. Defect. **S**.

### `CR-17` — build time is fine, and 70% of it is one stage

8.6 s wall; `cProfile` puts 7.37 s in 243,776 `cursor.execute` calls and 6.24 s in `_stage_21` alone (`ran it`), which does a per-row `SELECT 1 FROM constructors WHERE id=?` and a 13-index upsert for each of 27,577 results. `executemany` with a pre-fetched constructor set would roughly halve the build. It is not worth much — nine seconds is a good number — and I note it so nobody spends time on the other 29 stages. Preference. **S**.

### `CR-18` — two assertions that cannot fail

`verify.py:2003` `check("view … is queryable", True, …)` and `:1685` `warn("constructors entered under more than one engine are kept apart", True, …)`. Both print a PASS whatever the data says; the first would surface a broken view only as a traceback that aborts the run. These are the "check that does not constrain the value it guards" that `data-integrity-reviewer.md` names. `read the source`. Defect, tiny. **S**: fold into `CR-11`; make the second a real `HAVING` assertion or a plain `print`.

### `CR-19` — tooling markers without tooling, and one EOL interpreter

21 `# noqa` markers and 2 `eslint-disable` comments in a repository with no flake8/ruff/eslint configuration anywhere (`ran it`). Either add the linter to `ci.yml` (ruff is one line and finds real things in 2,800-line files) or delete the markers, which currently assert a discipline nothing applies. `ci.yml` matrixes Python 3.9, EOL since October 2025; keeping it is a legitimate choice for "stdlib only, runs anywhere", but say so in the comment, because the other reading is that nobody noticed. Actions are pinned by major tag, which is the common practice and not a finding. Preference. **S**.

### `CR-20` — the history the project leans on starts on 2026-09-04

`git log` has 140 commits between 2026-09-04 and 2026-09-11; the first two are "Initial commit" and "Add F1 Verified Facts Database v2.6" (`ran it`). `review.yml` fetches full depth because "several conventions here are only legible from the commit that introduced them", and `CLAUDE.md` says each declared deviation is "a decision on the record". For everything up to v2.6 the record is `docs/BUILD-NOTES.md` and the comments, not the commits — which makes `PM-02` (the notes stop at v2.15) more important than an S suggests. Observation, not a defect. **?** — a decision about where the record lives, already partly in the queue.

---

## Examined and cleared

These were worth the time to disprove, and the reader should not spend more on them.

- **Committing `f1.db` does not bloat the repository.** `release.yml` says the database and the JSON "neither delta-compresses"; that is true of the JSON and false of the database. Thirty distinct `f1.db` blobs pack to 7.2 MB in total; each rebuild costs 0.1–0.4 MB of pack, and `.git` is 24 MB after 140 commits (`ran it`, `git verify-pack`). Keep committing it; correct the comment.
- **The build is byte-stable.** Rebuilt here against a different SQLite than CI's and matched all three artefacts (`ran it`). `pin_sqlite_header` (`build.py:2819-2825`) is a small, correct hack and its comment says why. `BUILT` as a constant, with `refresh.yml` moving it on the only day the data changes, is the right compensating control — endorsed.
- **The confidence vocabulary is constrained.** Every `confidence` column carries `REFERENCES provenance(confidence)` and `provenance.confidence` is the primary key; with foreign keys on, `'mediun'` is refused, and `verify.py` runs `PRAGMA foreign_key_check` (`ran it`). `confidence_distribution` checking only `drivers` is therefore harmless.
- **Page query cost is irrelevant.** Every statement in `web/src/pages/*.jsx` runs in under 14 ms natively; no page's total exceeds 19 ms (`ran it`, parameterised ones sampled with `hamilton`, `2021`, `ferrari`). Even at a several-fold wasm penalty this is invisible beside the download. The `useQuery` cache and the worker/rollback design are sound.
- **The `circuit_geometry` column rule holds everywhere.** `build.py:2573`, `tools/geometry_overlay.py:45,51`, `tools/parquet_export.py:125-`, `web/src/data/worker.js` (`pragma_table_info`) all derive the list (`read the source`).
- **The licence gate is in the right place.** `ci.yml` runs `verify.py --redistribution-only` against the committed database *before* the rebuild, which is the only moment that can catch it, and the comment says so. `SOURCE_LICENCE` refusing an unclassified source at build time is the right default. `CR-03` is that none of this has a test, not that it is wrong.
- **Both exporters refuse to forget a table.** `NOT_EXPORTED` with a completeness check in `export_json.py` and `tools/parquet_export.py` is the pattern `CR-01` should copy.
- **The measured-and-rejected list.** Route-level code splitting: the bundle measurement is the right comparison and the browser confirms it (116 KB JS on the wire against a 4.5 MB database). Range-request VFS: agreed, for the recorded reason. Deploy-time rebuild: agreed; `CR-13` asks only that CI look at what the deploy chain already writes.

## What is genuinely good

- **The comments are load-bearing.** Almost every non-obvious line in `build.py`, `verify.py`, the workers and the workflows says what went wrong without it, with a case (Farina's 1955 pole, Zhou's Alfa Romeo, Aitken's `rounds`). This is rare and it is why a stranger can review 5,000 lines of Python in a day.
- **Refuse rather than repair.** `raise SystemExit` at the point of admission, sets compared not scalars (`build.py:1460-1474`), a whole race refused on one disagreement, disagreements written to `discrepancies` rather than resolved. The cross-check design is right and the code follows it.
- **`_read_named` reads by header, not position** (`harvest.py:1046`), and says why. `smoke.mjs` reads its expectations out of `f1.db` rather than hard-coding them, and its "shapes by query" section is the best-designed test in the repository.
- **The worker's `queryReadOnly`** (`worker.js`) solves the SQL-console problem the correct way and explains the wrong way it replaced.
- **`ci.yml`'s ordering and comments**, the `permissions: contents: read`, the timeouts, and `review.yml`'s "say which of the four happened" step: every non-fatal outcome reports somewhere readable, which is the rule `CLAUDE.md` states and the workflows actually follow.

## What I did not examine

The network harvest tools (`tools/ergast_load.py`, `fastf1_load.py`, `osm_geometry.py`, `wikispec_fetch.py`, `wikimedia_images.py`) beyond their headers and how they open the database; `tools/f1db_fetch.py` beyond confirming it sorts its output and stamps the F1DB commit. `web/src/styles/app.css` (2,291 lines), the four chart components, `Page.jsx`, `DataTable.jsx`, `Search.jsx`. The SQL console's escape surface beyond the rollback wrapper (`ATTACH`, `PRAGMA`, multi-statement input) — that is `frontend-reviewer`'s checklist. I did not run `prerender.js` or the smoke test, and did not rebuild `web/dist`, per the brief; the browser check was one warm-cache page load at `localhost:4180` (no console errors, app replaced the static block by 7 s). The `f1` CLI's other 45 subcommands. `review.yml`'s action behaviour on a real pull request. Cloudflare's build environment. The truth of any fact in `data/*.py`.

## Which critics should run next

- **`data-architecture-critic`** — first. `CR-02` is a symptom of `standings.as_of` carrying "final", "current", "round N" and a date-string in one free-text column; `race_entries` one-row-per-driver-per-race and the five encodings of uncertainty (`PM-14`) are its territory, and it can judge whether `claims`/`checks` is the right consolidation.
- **`service-design-critic`** — the refresh workflow commits to `main` unreviewed every Monday, the Parquet status lives in a file nobody reads (`CR-13`), and the README, the release page, `meta.coverage_note` (`CR-08`) and the compat file (`CR-02`) each describe the product differently; that is the gap-between-channels question.
- **`interaction-design-critic`** — the cold first visit is measured once (`PD` critique) and never re-measured; the static-to-app handover and what fills the download are its job, and `PD-02` needs a second opinion on what the reader should see in those seconds.
- **`accessibility-critic`** — nobody has driven the SQL console, the atlas scrubber or the four SVG charts with a keyboard or a screen reader; this review touched none of them.
- **`user-research-simulator`** — the brief's own finding is that nobody has asked a user anything; a data-scientist persona opening `f1_compat.json` today would find `CR-02` in under a minute, which is the kind of thing this project's checks structurally cannot.
