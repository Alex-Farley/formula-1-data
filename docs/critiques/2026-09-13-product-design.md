# Product design critique — 2026-09-13

**Critic:** `product-design-critic`, third run.
**Subject:** Lap Ledger at v2.23, `main` at `aed5fb5`; the committed `f1.db`
and `f1-geometry.db` queried; `CLAUDE.md`, `README.md`,
`docs/TIMING-ARCHITECTURE.md`, `docs/BACKLOG.md`, `web/src/lib/racingColours.js`
read; openf1.org, api.jolpi.ca and F1DB's release API reached.
**Brief:** the maintainer's seven asks of 2026-09-13 — a more exciting design
language; better track visualisation including telemetry replays; a focused
current-season area with driver, car and track profiles; correct constructor
colours; user-configurable tables; natural-language search; what a
subject-matter expert would add. Judge each against what the product is for
and who it serves; where an ambition collides with the licence position, say so
and propose what is achievable instead.
**Prior:** `docs/critiques/2026-09-10-product-design.md`,
`docs/critiques/2026-09-11-product-design.md`, `docs/BACKLOG.md`.

**How this was evidenced.** Tagged per finding: *queried the database*, *read
the source*, *read the docs*, *reached the network*. The critic did not drive
the built site; the 2026-09-11 critiques did, and their rendered observations
are taken as given. **The repository was not modified.**

**Re-checked by the author before filing:** `sessions` holds 115 rows, all
2026; `standings` for 2026 reaches `after_round` 13 of 23; `Season.jsx:325`
heads the table *Final drivers' standings*; `pit_stops` carries `lap_number`
on 22,481 rows; `racingColours.js` records the Wikidata/F1DB/Wikipedia search
as described. The F1DB download figure and the OpenF1 `schema.org` block were
not re-fetched and stand at the critic's stated evidence level. One finding
below (`PD-31`) is **superseded in part** by the maintainer's pointer the same
day to F1DB's circuit SVG assets — see `2026-09-13-design-review.md` — and by
the maintainer's direction that a presentation-layer livery palette is wanted
(`AF-04`); the critic's reasoning about the *database* stands, and its
recommendation about the *front end* is overruled and recorded as such.

---

## Verdict on the seven ambitions

**The three that matter**

1. **Only one of the seven ambitions changes who this is for, and it is the
   one already half-built and unlabelled.** `sessions` holds 115 rows, 2026
   only; `standings` holds `after_round` 13 of 23 rounds; nothing has a page.
   `Season.jsx:325` heads a mid-season table **"Final drivers' standings."**
   That is a false label on the most-visited season page, today.
2. **Telemetry replays are barred twice over, and the project's own table
   understates it.** `docs/TIMING-ARCHITECTURE.md` lists OpenF1 as "FOM's
   data"; openf1.org's own `schema.org` block now declares **CC BY-NC-SA 4.0**
   and "non-commercial fan engagement". Jolpica is live (2026 r13 returns) and
   equally NC. There is no public-domain F1 telemetry and there will not be.
   Refuse it in writing on `/data` as a position — the current silence reads
   as an unfinished feature.
3. **The achievable race visualisation is already in the database.** 22,481
   pit stops carry `lap_number`, covering **610 of 614 races since 1994
   (99.3%)**, and 26,756 qualifying rows carry a time, back to 1950, including
   3,993 Q3 times. A stint-window chart and a gap-to-pole strip are
   lap-referenced race visualisations built entirely from CC BY 4.0 F1DB data.
   Nobody has drawn them.

---

### PD-28 — A current-season area, with the one thing no rival derives — M, in S pieces

**Observation** (queried the database): 2026 has 13 completed and 10 scheduled
rounds, 23 drivers, 115 timetable rows, and no route of its own. `Season.jsx`
renders 2026 with the same template as 1950, including the "Final" labels.

**Why it matters:** this is the only ambition serving the fan and the casual
reader — the two audiences with no current job here. It is also where the 9
open `discrepancies` rows sit (mostly 2026 points), which is the verifiability
claim made visible on live data rather than on 1970.

**Do:** `/2026` in the masthead *(overruled by `IA-18`: a `/now` redirect and no
ninth slot)*; derive "after round 13" from `max(after_round)`; render the
weekend timetable from `sessions`; and add **championship permutations** — who
can still win, derived from `points_systems` (10 systems) and rounds remaining.
That last is pure SQL, is the most-asked question of September, and is a claim
formula1.com does not make and Wikipedia updates by hand.

**Trade-off:** it makes the site depend on a weekly harvest it does not
control, and puts it head-on against a broadcaster that will always win on
imagery. Win on arithmetic instead. **Defect** (the "Final" label);
**preference** (the rest).

### PD-29 — Write the telemetry refusal where a reader meets it — S

**Observation** (read the docs, network): `web/README.md`'s *What it does not
do* is accurate and buried in the repository; the site says nothing. `CD-05`
already asks for the three lengths.

**Do:** ship the one-liner on `/data`, `/races/:id` and the season page: *"No
lap-by-lap timing. No source publishes it under a licence that permits passing
it on — see what we do publish instead."* Correct the OpenF1 row to CC BY-NC-SA
4.0 while there.

**Trade-off:** stating it invites the comparison. Worth it — a stated
constraint is positioning; an empty section is an apology. **Defect** (stale
licence cell).

### PD-30 — Draw the lap-referenced things you may ship — M

**Observation:** as above. `Figure.jsx`'s convention (every chart carries a
table of its own numbers) already fits both.

**Do:** (a) a stint-window strip per race, 1994–, from `pit_stops.lap_number`
+ `race_entries.laps_completed`; (b) a gap-to-pole bar per qualifying session
with Q1/Q2/Q3 where held. *The author adds (c), from the same tables: grid
position against finish position with retirements falling out at the lap they
stopped, for every race since 1950.* All prerender as static SVG.

**Trade-off:** (a) is not a replay and 47% of races (pre-1994) have nothing;
say so in the empty state rather than hiding the section. **Preference.**

### PD-31 — Constructor colours: decline liveries permanently, and promote what replaces them — S

**Observation** (read the source): `racingColours.js` records a genuine
search — Wikidata P465 absent on every constructor sampled, no F1DB field, FOM
copyright on formula1.com. The reasoning holds and I am endorsing it, not
softening it. A livery is per-season and often mid-season: 150 constructors ×
77 seasons of hexes nothing here can check.

**Why it matters:** the ambition is stated as a gap and it is an asset.
National racing colours across 77 seasons is something no competitor does,
and 1950–1968 is the half of the record this project most owns. `VD-08`
reports that the sentence carrying this decision is set at **10.5 px mono
across 175 characters** *(landed in #61 before this run; the critic worked from
the earlier critique)*.

**Do:** `VD-08`, plus a short `/eras`-level page — "Why the cars are these
colours" — linked from every swatch.

**Trade-off:** a 2020s fan will read a grey Mercedes as a bug until they click.
Accept it. **Preference.**

**Author's note, same day:** the maintainer's direction is the opposite for the
sponsor era, and the two positions are compatible: the critic is right that no
livery may enter `f1.db`, and the front end already holds a presentation
palette. `AF-04` files a per-constructor-season palette, 2026 first and back
to 2010, each value sourced to the team's own brand material, as a *second map
beside the first*. The national convention stays for 1950–1967. This critique's
"decline permanently" is therefore **overruled for the front end and upheld for
the database.**

### PD-32 — Natural-language search collides with the architecture; ship the cookbook instead — S

**Observation** (read the source): `Search.jsx` indexes 3,494 entity rows
locally, one query, no round trip. NL search needs either a server call — which
ends "nothing you look at is sent anywhere", the strongest sentence on the
homepage — or a local model measured in tens of MB against a 4.5 MB payload
the project already defends carefully.

**Do:** 12 worked queries on `/data`, one click into the SQL console ("Most
wins at one circuit", "Every shared drive"). Same job, for the journalist and
the analyst, no model. Fix `IA-05`/`IA-06` first so the palette earns its
label. *Folded into `IA-20`, which sets the rungs.*

**Trade-off:** does not serve the casual reader, who wants a sentence box. That
reader is better served by PD-28. **Preference.**

### PD-33 — Configurable tables are an analyst feature the console already covers; the real gap is linkability — S/M

**Observation** (read the source): `DataTable.jsx` sorts, paginates at 250,
nulls-last. `IA-08` records **zero** uses of `useSearchParams`/`URLSearchParams`
across `web/src` — no sort, filter or page is linkable.

**Do:** `IA-08`. Decline column pickers: per-page configuration UI on ~3,500
pages, to serve the one audience holding SQL, Parquet and a 20 MB download.
*Overruled in part by `IA-23` and `IX-27`: the picker is wanted, and pays first
on a phone, where 632 px of every register row is off screen; but `IA-08` goes
first, as this finding says.*

**Trade-off:** a journalist wanting a custom CSV still has to write SQL. That
is the correct division. **Preference.**

### PD-34 — "More exciting" is a density problem, not a token problem — no new work

**Observation** (read the docs): the Pit Wall system is coherent and measured.
The excitement deficit is that **73% of driver pages show four zeros**
(`PD-15`), **618 have no opening sentence** (`PD-16`), no static page carries an
`<img>` (`PD-19`), and no page has an `og:image` (`PD-20`). A new visual
language repaints those pages without changing them.

**Do:** nothing new. `VD-12` (landed), `PD-19`, `PD-20` are the whole of the
available "looks better" and are already filed and small. *The visual critique
the same day adds ten specific findings (`VD-24`–`VD-34`) that are also not a
new language: an accent spent on decoration, tiles that do not rank, charts
that never take the entity's colour. The conclusion stands; the list is
longer.* **Preference.**

### PD-35 — What a subject-matter expert would add, cheapest first — S each

Tyre compound allocation per weekend (FIA/Pirelli selections, facts-only);
grid penalties as a column on the race page; `WK-01`'s qualifying-format
history, already filed. Each is a sourced fact in a table that exists; none
needs a new licence class. *The author adds: F1DB publishes free-practice
results, the fastest-lap table and driver of the day per race under CC BY 4.0,
and Lap Ledger's `sessions` table is a timetable only — `LV-03` is the item,
already decided.*

---

**Which audience should win:** the journalist and the Wikipedia editor. They
are the ones for whom "cross-checked, with the disagreements published" is
worth more than imagery, and they are the route to citation, which is what the
author says he wants. The fan is served as a consequence of PD-28; the analyst
is already served by the Parquet bundle and needs only `PD-11`'s front door.
F1DB's latest release took **2,623 downloads in seven days** — that is the bulk
audience's size, and this project's edition claims something F1DB's does not.

**What I did not examine:** the rendered site, mobile, performance, the
prerenderer, and whether the 2026 harvest keeps pace between rounds — PD-28 is
worthless if it does not. The Wikidata/livery search in `racingColours.js` I
accepted from the file rather than re-running; if a CC0 livery set exists that
the author missed, PD-31 reverses.
