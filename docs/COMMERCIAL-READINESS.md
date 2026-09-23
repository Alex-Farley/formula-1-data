# Commercial readiness

Whether every row in the committed database is one this project may publish,
and what the answer rests on.

`ATTRIBUTION.md` records where the data came from and what each source's
licence requires. This file records the *reading* — which rows were examined,
what they were found to contain, and which of those findings are now enforced
by the build rather than by anyone's memory.

**This is a description of the licences involved, not legal advice.**

---

## The short answer

    ./f1 licences

<!-- fig:yes_share -->99.4%<!-- /fig --> of the <!-- fig:sourced_rows -->120,911<!-- /fig --> sourced rows carry a licence that permits
redistribution outright. The remaining <!-- fig:facts_only_share -->0.6%<!-- /fig --> cite an official source as the
**authority for a fact** and hold none of that source's prose. Nothing in the
committed database may not be published.

| Class | Rows | Share |
|---|---:|---:|
| `yes` — redistributable on the terms given | <!-- fig:yes_rows -->120,196<!-- /fig --> | <!-- fig:yes_share -->99.4%<!-- /fig --> |
| `facts-only` — the facts, not the expression | <!-- fig:facts_only_rows -->715<!-- /fig --> | <!-- fig:facts_only_share -->0.6%<!-- /fig --> |
| `no` — not redistributable | <!-- fig:no_rows -->0<!-- /fig --> | <!-- fig:no_share -->0.0%<!-- /fig --> |

---

## What was read

<!-- fig:facts_only_rows -->715<!-- /fig --> rows cite `formula1.com` (<!-- fig:facts_only_formula1 -->638<!-- /fig -->) or `fia.com` (<!-- fig:facts_only_fia -->77<!-- /fig -->), the two sources whose
licences are "FOM copyright; no reuse licence" and "FIA copyright; published
for reference, not redistribution". Every one was examined and classified as
either

- **(a) a bare fact citing an authority** — keep. Facts are not
  copyrightable, and restating one is not redistribution; or
- **(b) text following the source's expression** — rewrite.

**All <!-- fig:facts_only_rows -->715<!-- /fig --> are (a). None is (b).** The breakdown, across <!-- fig:facts_only_tables -->11<!-- /fig --> tables — every
figure here is a span `tools/readme_figures.py` writes from the database and
`verify.py` checks. Two guards hold the list to the database: the writer
refuses to run while a facts-only row sits in a table not listed here, and
every listed table's figure must appear in this document or the build
fails — so a row nobody has read cannot be counted as read:

| Table | Rows | Source | What the row holds | Prose |
|---|---:|---|---|---|
| `drivers` | <!-- fig:fo_drivers -->118<!-- /fig --> | formula1.com | names, dates, career totals | `notes` |
| `circuits` | <!-- fig:fo_circuits -->80<!-- /fig --> | formula1.com | length, turns, GP count | `notes`, `characteristics` |
| `seasons` | <!-- fig:fo_seasons -->78<!-- /fig --> | formula1.com | champion, points, rounds | `notes` |
| `standings` | <!-- fig:fo_standings -->65<!-- /fig --> | formula1.com | 2025 final, 2026 current | — |
| `constructors` | <!-- fig:fo_constructors -->55<!-- /fig --> | formula1.com | register facts | `notes` |
| `races` | <!-- fig:fo_races -->71<!-- /fig --> | formula1.com | 2025–27 calendar | — |
| `race_entries` | <!-- fig:fo_race_entries -->36<!-- /fig --> | formula1.com | 2025–26 race winners | — |
| `regulation_changes` | <!-- fig:fo_regulation_changes -->60<!-- /fig --> | fia.com | year, category | `detail`, `impact` |
| `regulation_limits` | <!-- fig:fo_regulation_limits -->17<!-- /fig --> | fia.com | numeric limits | `note` |
| `sessions` | <!-- fig:fo_sessions -->115<!-- /fig --> | formula1.com | 2026 session start times (UTC) and circuit zone | — |
| `claims` | <!-- fig:fo_claims -->20<!-- /fig --> | formula1.com | career wins, poles and podiums of seven 2026 drivers, one figure a row, as their driver pages gave them on the fetch `drivers.stats_as_of` dates — the figures `drivers` carries as `*_external`, with the source of each | — |

The prose columns in the right-hand column are **written for this project**,
not taken from FOM or the FIA — `ATTRIBUTION.md` records regulations, safety,
technical and glossary text as "written for this project from general
knowledge". They carry a separate obligation, from Wikipedia and not from
these sources, and are the subject of the prose pass rather than this one.

### The timetable: a whole season from one source, read as facts-only

`sessions` holds the start time of every 2026 session, read from
formula1.com's 23 race pages (`LV-02`, #91). It is the first facts-only use
that takes the whole of one upstream set rather than single facts each
cross-checked elsewhere, and the class's own limit — no substantial
extraction of the source's database — was read for it, by the maintainer on
2026-09-12 (`LV-04`): a race weekend's session times are a public schedule
that the sport's promoter and the FIA both publish for every event, not a
compilation whose value lies in the collecting; each start is a single fact
the FIA's own event timetable states in the same terms; and the per-season
refresh reads the schedule as published, five rows an event, nothing else
from the pages. On that reading the rows are facts restated, and the FIA
timetable is the independent check still owed (`known_gaps` #15). If the
reading is ever doubted, the fallback is the FIA's per-event documents, which
carry the same figures.

### The <!-- fig:fo_current_season_rows -->172<!-- /fig --> rows that look redundant and are not

`races` (<!-- fig:fo_races -->71<!-- /fig -->), `race_entries` (<!-- fig:fo_race_entries -->36<!-- /fig -->) and `standings` (<!-- fig:fo_standings -->65<!-- /fig -->) cover 2025 and 2026,
with the announced 2027 calendar adding a `races` row an event and nothing
else, and F1DB covers both run seasons under CC BY 4.0. It is tempting to read these as
a redundant hand-maintained copy and delete them.

That would remove a check rather than a liability. Wikipedia's harvest —
`harvest/races.txt` — **stops at 2024**. For 2025 and 2026 there is no second
opinion on who won a race except these rows. They are what makes F1DB's two
most recent seasons checkable at all, and the winner cross-check that refuses
a race whole on disagreement depends on them.

They stay, and the reason they stay is worth stating: a `facts-only` source
used as an independent check is doing the job this project's verification
model is built around.

---

## What is enforced, and where

The reading above is a snapshot. These are the parts that survive it.

| Rule | Where | Fails on |
|---|---|---|
| Every registry entry has a licence class | `build.py` | an unclassified source |
| Entries sharing a host agree on terms | `verify.py` | two classes for one domain |
| Every cited source is classified | `verify.py` | a source nobody has judged |
| No row cites a `no` source | `verify.py` | a CC BY-NC or FOM citation |
| Four FOM tables are empty | `verify.py` | committed timing data |
| Pit stops and radio are by source | `verify.py` | a `fastf1` or `jolpica` row |
| `f1.db` carries no ODbL geometry | `verify.py` | a merged local copy published |
| The committed database, before rebuild | CI | any of the above, committed |
| Only one component renders an image | `web` smoke test | an `<img>` bypassing the credit |
| Renderer and build agree on attribution | `web` smoke test | credit shown as anonymous |

`verify.py --redistribution-only` runs the licence section against any
database in about a second. CI runs it against the **committed** `f1.db`
before `build.py` overwrites it, which is the only moment a bad commit can be
caught.

`F1_LOCAL_TIMING=1` downgrades the FOM-owned checks to warnings for anyone
who has deliberately loaded timing onto a local copy. The load is legitimate;
the resulting file is not theirs to publish. Never set it in CI.

---

## Decided: ODbL is a separate file

**The centrelines are no longer in `f1.db`.**

ODbL 1.0 is share-alike *and* carries a database right, and — unlike every
other licence here — it reaches the **whole database** its data lands in. A
database derived from an ODbL one is a *Derivative Database* and must itself
be published under ODbL. Confining the rows to a single table was never
enough, because the table is inside the database: twenty-five centrelines
would have set the licence of 117,000 rows that have nothing to do with them.

`build.py` now writes them to **`f1-geometry.db`**, published beside `f1.db`.
ODbL draws exactly this line: two independent databases distributed alongside
each other are a *Collective Database*, which it explicitly does not treat as
derivative, so the obligation follows the file it belongs to and stops there.

| | |
|---|---|
| `f1.db` | no OpenStreetMap data of any kind. CC BY-SA, as before |
| `f1-geometry.db` | the 25 centrelines, ODbL 1.0, © OpenStreetMap contributors |
| Want the maps locally? | `python3 tools/geometry_overlay.py --apply` |
| The website | merges the two **in the reader's browser** |

Nothing was weakened to achieve it. The re-measurement that catches Monaco's
relation reading 12% long still runs on every build — `verify.py` attaches the
overlay and checks it exactly as it did when the rows shipped inside `f1.db`.
A copy with the overlay merged *is* a Derivative Database, which is a perfectly
ordinary thing to hold and simply not the file to publish; `verify.py` says so
if you try.

---

## Decided: the six radio quotations stay

`team_radio` holds six exchanges quoted verbatim. They were kept, deliberately
and on the record.

| | |
|---|---|
| How much | Six rows. The longest is 88 characters |
| What they are | Utterances broadcast live on the world feed, quoted in Wikipedia race articles |
| What they document | The team-orders ban and Massa at Hockenheim 2010, Multi-21 at Sepang 2013, "GP2 engine" at Suzuka 2015, and three exchanges from Abu Dhabi 2021 |
| Attribution | Speaker, role, race and channel on every row |

Two things make this the ordinary case rather than a close one. Spontaneous
short utterances generally lack the originality to attract copyright in their
own right; and quoting brief excerpts to document an event is what the
quotation exceptions exist for. They are attributed, they are short, and each
one is the subject of the historical claim around it rather than decoration.

Against that: they are the most quotable-back item in a commercial product,
and six rows would not be much to lose. That was weighed and the rows stay.
Revisit it if the project is ever commercialised in a form that reproduces
them prominently — a marketing surface is not a database row.

The `context` prose beside each quotation is this project's own writing and
belongs to the prose pass, not here.

---

## Still open: the prose pass

552 short fields — averaging barely a sentence — carry a CC BY-SA obligation
that comes from Wikipedia rather than from FOM. **They may ship, and they do.**
The database is released under CC BY-SA and every row carries its source; what
those fields need is not permission but a closer description. (The count
matched the facts-only row total when both were written; that is coincidence.
This one counts prose fields, is typed, and is not a figure the build writes.)

What is unfinished is finer than whether the data may ship. Each field needs
marking original, paraphrased, or close to source, so the licence statement
can say which parts of the prose the share-alike actually reaches rather than
covering the lot to be safe. Only the third class needs rewriting, and the
pass is `PM-17`, #249.

| | |
|---|---|
| May the data ship? | Yes, and it does |
| What the pass changes | How exactly the statement can be put, not the permission |
| What it would find | Fields close enough to source to be worth rewriting |

---

## Decided: the history before the split stands

Thirty-five commits carry the 25 centrelines inside `f1.db`, in ten distinct
versions of the file, dated 2026-09-05 to 2026-09-09. The boundary is the
merge `6610b6da`, not the split commit `5a70558`: the split was parallel work,
eight of the thirty-five are later than it by the clock, and it reached the
trunk only when it was merged. Every one of the thirty-five is an ancestor of
that merge, and no commit from the merge onward has a row in
`circuit_geometry` in `f1.db`.

Read all of it before deciding, across every ref rather than the first-parent
view: **76 distinct versions of `f1.db`, of which ten hold geometry, and the
four FOM-owned tables hold zero rows in all 76 without exception.** Counting
by `git rev-list <ref> -- f1.db` gives 69 and ten, which is the count of
versions and not of commits — history simplification hides every commit that
carries a file forward without changing it. That undercount was made here
first and is why the rule below is written by content rather than by number.

By the reasoning two sections above, each of those ten files is a Derivative
Database, and `LICENSE-DATA` offers them as ODbL 1.0, © OpenStreetMap
contributors, **in addition to** CC BY-SA rather than instead of it — the
share-alike on the Wikipedia-derived rows in the same file is not this
project's to drop. They stay: rewriting every commit since 2026-09-05 to lift
25 rows would spend the history to buy very little, and the record of a
project getting a licence question right is worth more than the appearance of
never having had to ask.

What is published is the current file, and the current file's table is empty.

---

## Trademark: the position, and where it ends

Not a data question, not addressed here, and no build check reaches it.
"Formula 1", "F1" and "Grand Prix" are Formula One Licensing BV's. This
project is unaffiliated, says so on every page, and uses the names to say
which races these are.

What has been decided is the scope, not the law: this stays free and
non-commercial, and no argument about trademark is advanced here because that
is not this document's business. If money ever appears the question changes,
and it is a solicitor's question rather than a build check. Asking it then is
the plan rather than an omission now.
