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

<!-- fig:yes_share -->99.6%<!-- /fig --> of the <!-- fig:sourced_rows -->171,695<!-- /fig --> sourced rows carry a licence that permits
redistribution outright. The remaining <!-- fig:facts_only_share -->0.4%<!-- /fig --> cite an official source as the
**authority for a fact** and hold none of that source's prose. Nothing in the
committed database may not be published.

| Class | Rows | Share |
|---|---:|---:|
| `yes` — redistributable on the terms given | <!-- fig:yes_rows -->170,953<!-- /fig --> | <!-- fig:yes_share -->99.6%<!-- /fig --> |
| `facts-only` — the facts, not the expression | <!-- fig:facts_only_rows -->742<!-- /fig --> | <!-- fig:facts_only_share -->0.4%<!-- /fig --> |
| `no` — not redistributable | <!-- fig:no_rows -->0<!-- /fig --> | <!-- fig:no_share -->0.0%<!-- /fig --> |

---

## What was read

<!-- fig:facts_only_rows -->742<!-- /fig --> rows cite `formula1.com` (<!-- fig:facts_only_formula1 -->645<!-- /fig -->) or `fia.com` (<!-- fig:facts_only_fia -->97<!-- /fig -->), the two sources whose
licences are "FOM copyright; no reuse licence" and "FIA copyright; published
for reference, not redistribution". Every one was examined and classified as
either

- **(a) a bare fact citing an authority** — keep. Facts are not
  copyrightable, and restating one is not redistribution; or
- **(b) text following the source's expression** — rewrite.

**All <!-- fig:facts_only_rows -->742<!-- /fig --> are (a). None is (b).** The breakdown, across <!-- fig:facts_only_tables -->12<!-- /fig --> tables — every
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
| `regulation_limits` | <!-- fig:fo_regulation_limits -->25<!-- /fig --> | fia.com | numeric limits | `note` |
| `qualifying_formats` | <!-- fig:fo_qualifying_formats -->19<!-- /fig --> | fia.com, formula1.com | how each grid was set from 1996: the period, format, sessions counted and whether a 107% limit applied | `note` |
| `sessions` | <!-- fig:fo_sessions -->115<!-- /fig --> | formula1.com | 2026 session start times (UTC) and circuit zone | — |
| `claims` | <!-- fig:fo_claims -->20<!-- /fig --> | formula1.com | career wins, poles and podiums of seven 2026 drivers, one figure a row, as their driver pages gave them on the fetch `drivers.stats_as_of` dates — the figures `drivers` carries as `*_external`, with the source of each | — |

The prose columns in the right-hand column are **written for this project**,
not taken from FOM or the FIA — `ATTRIBUTION.md` records regulations, safety,
technical and glossary text as "written for this project from general
knowledge", and the `qualifying_formats` notes are written for it from the
regulations and the history they cite. They carry a separate obligation, from Wikipedia and not from
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

## Measured: the prose pass

The written fields — car histories, circuit and driver notes, glossary
definitions, regulation details and the rest — are this project's own prose
wherever nothing says otherwise, but the release had never said which of them
follow Wikipedia, so the licence statement covered them all to be safe.
**They may ship, and they do.** The database is released under CC BY-SA and
every row carries its source. The pass is a closer description, not
permission. It is `PM-17`, #249, and it relicenses nothing.

`tools/prose_pass.py` measured each written field in its scope against the Wikipedia
articles a writer would have had open: the row's own article where it names
one, the top three search results for its subject, and the general articles
for its table. It measured two things: the longest run of words the field
shares with an article, and the share of its four-word sequences the article
also holds. Those two numbers are a screen. Every field the screen flagged
was then read, and the reading is declared in the tool with its reason: a
name, a result in the ordinary words for it, a points scale or a stock phrase
of the sport is not the article's expression. `docs/prose_pass.tsv` holds one
line per field with its evidence and the article revision measured. On
2026-09-28, against v2.24:

| | Fields |
|---|---:|
| Written fields measured (33 columns, 23 tables) | 1,208 |
| Flagged by the screen and read | 151 |
| **Original** — none of an article's expression found | 1,197 |
| **Paraphrased** — an article's way of putting something, rearranged | 10 |
| **Close to source** — a clause of an article reproduced | 1 |

The one close field is `circuits.characteristics` for `jacarepagua`, whose long
pit straight and longer back straight are the article's phrase. The ten
paraphrased fields are three driver notes (Amon, Baghetti, Susie Wolff), the
Brabham constructor note, four car fields (Lotus 78 and 88 concepts, Ferrari
312T and Lotus 25 innovations), the 2003 team-orders rule in
`regulation_changes`, and the fan-car entry in `technical_innovations`.
On 2026-10-01 `CR-60` (#693) rewrote Baghetti's note, which overstated his
record, and the pass now reads the new wording as original, so nine are
paraphrased. Rewriting the other nine is its own item, `PM-62` (#692). It would take out
the Wikipedia wording the pass found, but it would not change the licence on
its own.

Of the twelve tables `source_registry` entry 18 records as written for this
project (381 fields), one field is paraphrased and none is close. That is
the evidence `PM-49` (#573) waited for. Whether any of those tables takes the
CC BY 4.0 grant is still the maintainer's decision, table by table, and until
it is taken they stay CC BY-SA.

The earlier figure here, 552 fields, was counted on 2026-09-08 against a
smaller database, and its scope was never written down. The 1,208 above is
this pass's own count, and the tool's docstring names what it leaves out and
why: the columns already granted CC BY 4.0, the text the build writes, the
radio quotations and the short specification values. It is typed, not written by the build: it is a dated
measurement, and `python3 tools/prose_pass.py --check` reports how far the
database has moved from it without fetching anything.

| | |
|---|---|
| May the data ship? | Yes, and it does |
| What the pass changed | The statement can name the fields the share-alike reaches, not the permission |
| What it found | One field close to source, ten paraphrased (nine since `CR-60` reworded one) |

---

## Decided: the Wikipedia-cited race rows are bare facts

**Decided by the maintainer on 2026-09-30** (`PD-41`, #481), on the reading
below, which was written for that decision and is kept as what it rests on
([D-51] in `docs/DECISIONS.md`):

- The <!-- fig:wp_race_rows -->2,253<!-- /fig --> race rows that cite a Wikipedia season article — <!-- fig:wp_races -->1,125<!-- /fig --> of
  `races` and <!-- fig:wp_race_entries -->1,128<!-- /fig --> of `race_entries` — are **bare facts**, on the same reading
  *What was read* gives the <!-- fig:facts_only_formula1 -->645<!-- /fig --> formula1.com rows: results, dates and
  positions are not the expression CC BY-SA protects. The ruling's count was
  wider than these two tables: it took in every other row citing Wikipedia
  outside `claims` and `driver_note_sources` — <!-- fig:wp_drivers -->64<!-- /fig --> of `drivers`, <!-- fig:wp_cars -->29<!-- /fig --> of
  `cars`, <!-- fig:wp_regulation_limits -->16<!-- /fig --> of `regulation_limits` and <!-- fig:wp_radio -->6<!-- /fig --> of `team_radio`. The
  first three are bare facts on the same reading, their prose fields aside.
  The radio rows are quotations, and expression stays share-alike (*What
  stays share-alike in any case*, below).
- The Wikipedia-derived prose fields are **not** facts, and keep CC BY-SA 4.0.
  The ruling counted them as roughly 552, a figure that matches the earlier
  count *Measured: the prose pass* records and says never had its scope
  written down; that pass is the measurement of which fields follow an
  article.
- A **CC BY 4.0 facts artefact** is to be published beside `f1.db`, on the
  pattern of [D-07], leaving out everything that stays share-alike. `f1.db`
  itself stays CC BY-SA 4.0. Relicensing `f1.db` whole was rejected, because
  it waits on the prose pass (`PM-17`, #249); stating CC BY-SA as permanent
  was rejected, because it leaves this project strictly less usable than F1DB,
  its principal upstream.

**What the ruling does not decide.** The database-right reading below is
unchanged by it: whether a right reaching these rows subsists stays
unsettled, and the choice of route under *A CC BY 4.0 facts edition,
counted* — the race rows stored as they are, or rebuilt from F1DB — turns on
it. Which of the other Wikipedia-touched sets counted there the artefact may
carry (`claims` and `driver_note_sources` among them) is open too. Both are
measured first, under `PD-53` (#741). **Nothing is offered under CC BY 4.0
yet.** The artefact does not exist until `PD-53` (#741), `PD-54` (#742) and
`PD-55` (#743) ship; until then every row in `f1.db` ships under CC BY-SA 4.0
as before, and `LICENSE-DATA` is unchanged.

### The reading it was decided on

Written as `PD-51` (#662), step 1 of `PD-41`, for the maintainer to decide
on, and for a solicitor to check if they choose to ask one. **It is an
analysis, not legal advice.** It relicenses nothing, releases nothing and
changes nothing in `LICENSE-DATA`; the ruling above is what it informed.

<!-- fig:wp_race_rows -->2,253<!-- /fig --> rows — <!-- fig:wp_races -->1,125<!-- /fig --> of `races` and <!-- fig:wp_race_entries -->1,128<!-- /fig --> of `race_entries`, every
championship race from <!-- fig:wp_first_season -->1950<!-- /fig --> to <!-- fig:wp_last_season -->2024<!-- /fig --> and its winner — cite a Wikipedia season article.
Wikipedia is a `yes` source, so they ship today under CC BY-SA and the class
table counts them as redistributable. The question here is narrower: whether
the share-alike actually reaches them, so that a file carrying them could be
offered under CC BY 4.0 as F1DB's rows are. It is the test *What was read*
applied to the formula1.com rows, plus the one that reading did not need —
the database right.

#### Column by column

A row's `source` names who established its **finishing position**, not every
value on it. The season harvest created each winner row and F1DB's
classification then filled its gaps, keeping the season article as the
source — the upsert in `build.py` says so where it does it. A row citing
Wikipedia is part Wikipedia and part F1DB:

| Column | Came from | What it is |
|---|---|---|
| `races.year`, `round`, `name_used` | season article, `harvest/races.txt` | bare fact: which round, under the name it ran as |
| `races.gp_id`, `circuit_id` | the article's race name and venue (`harvest/venues.txt`), resolved to this project's registers | bare fact, keyed by this project |
| `races.date_iso`, `f1db_layout_id`, `sprint` | F1DB | bare fact, CC BY 4.0 |
| `races.layout_key`, `status`, `confidence` | this project | this project's classification |
| `race_entries.driver_id`, `constructor_id`, `finish_position`, `shared_drive` | season article | bare fact: who won, and for whom |
| `race_entries.entrant` | season article | bare fact: the chassis-engine name as published |
| `race_entries.pole`, `fastest_lap`, `fastest_lap_shared` | season article, `harvest/poles.txt`, and the race article for a shared fastest lap (`SHARED_FASTEST_LAPS`, `data/harvest.py`) | bare fact: a credit of the record — <!-- fig:wp_poles -->483<!-- /fig --> poles and <!-- fig:wp_fastest_laps -->404<!-- /fig --> fastest laps on these rows |
| `race_entries.grid`, `grid_text`, `position_text`, `classified`, `status`, `laps_completed`, `points` | F1DB, on all <!-- fig:wp_winners_f1db -->1,128<!-- /fig --> rows | bare fact, CC BY 4.0 |
| `race_entries.chassis_id`, `car_id` | F1DB's entry lists; this project's car linkage | bare fact; this project's classification |
| `races.note`, `race_entries.note` | — | NULL on every one of these rows |

No column carries prose, and none carries expression: a name is not a work,
and a result is the sport's, not an editor's. The one judgement near
selection — which races count as championship rounds, the Indianapolis 500 of
1950–60 among them — is the championship's own, which Wikipedia records and
does not make. None of Wikipedia's arrangement survives either: its season
tables are grids of rounds against drivers, and these are rows re-keyed to
this schema.

**Copyright is therefore not what binds them.** In UK law a database has
copyright only where its selection or arrangement is its author's own
intellectual creation (CDPA 1988 s.3A, implementing art. 3 of Directive
96/9/EC), and effort spent creating or collecting the data does not count
towards that (*Football Dataco v Yahoo!*, C-604/10, 2012). These rows take no
selection and no arrangement, and a single result is a fact. On copyright
they are bare facts, on exactly the reading the formula1.com rows were given.

#### The database right

The sui generis right is the harder question, and the one that decides this.
It protects a database whose maker made a substantial investment in
obtaining, verifying or presenting its contents, against extraction or
re-utilisation of all or a substantial part of them — and against repeated,
systematic extraction of insubstantial parts that adds up to the same
(Directive art. 7; in UK law the Copyright and Rights in Databases
Regulations 1997, regs. 13–16). Three steps:

1. **Is the investment the kind that counts?** Investment in *creating* data
   does not (*British Horseracing Board v William Hill*, C-203/02, and the
   *Fixtures Marketing* cases decided with it, 2004): the FIA running and
   classifying a race is not an investment in anybody's database.
   Transcribing those classifications into tables and checking them is
   investment in obtaining and verifying existing material, which is the kind
   that does count. Whether volunteers' edits amount to a *substantial*
   investment is unsettled, and no case settles it for a wiki.
2. **Is there a maker the right protects?** The right needs a maker who is a
   national or resident of, or a body established in, the territory whose law
   applies — since the UK left the EU, the UK right for UK makers and the EU
   right for EEA ones (reg. 18, as amended in 2019). The Wikimedia Foundation
   is a US non-profit, and the United States has no database right; if the
   editors are the makers, they are an unnamed group across many
   jurisdictions. Whether any of them is a qualifying maker of these tables
   is a question of fact that nobody holds the facts for.
3. **If a right subsists, is the take substantial?** Almost certainly. The
   harvest took the winner, constructor, venue, pole and fastest-lap entries
   of every season article's race summary from <!-- fig:wp_first_season -->1950<!-- /fig --> to <!-- fig:wp_last_season -->2024<!-- /fig -->: the
   whole of that content, not a sample. Substantiality is measured against
   the investment in the part taken (*BHB*), and the part taken is the part
   the investment went into.

The answer turns on steps 1 and 2, not on how much was taken. **The reading
is: whether a right reaching these rows subsists is unsettled, and depends on
facts about Wikipedia's makers that are not established; if one does, this
project's take was substantial.** That is weaker ground than the formula1.com
reading, which rested on nothing more contestable than that facts are not
copyright.

**The same facts are held independently.** The right is against extraction
from the protected database, not against the facts. F1DB classifies
<!-- fig:wp_races_f1db -->1,125<!-- /fig --> of these <!-- fig:wp_races -->1,125<!-- /fig --> races, and the winner cross-check in `build.py`
refuses a race whole where the two disagree, so every winner on these rows is
one F1DB states too, under CC BY 4.0. The rows as stored were still taken
from Wikipedia: it is the facts, not these rows, that have a second source.

#### What CC BY-SA 4.0 §4 changes

Wikipedia's text is CC BY-SA 4.0, and its §4 says what happens where the
licensed rights include a database right. It permits extracting all or a
substantial portion of the contents (§4(a)) and requires attribution when a
substantial portion is shared (§4(c)). The clause that matters is §4(b):
where a substantial portion goes into a database in which *you* hold a
database right, that database — "but not its individual contents" — is
Adapted Material and takes the share-alike.

Two consequences follow. §4 never makes an individual fact share-alike:
F1DB's rows inside `f1.db` stay CC BY 4.0 row by row whatever is decided. And
what it reaches is this project's own database right in the file holding the
rows. `f1.db` may well carry one — the investment in verifying it is the
cross-checks, and its maker's qualification is the same question as the database right's second step,
asked of this project — so *if* Wikipedia's right subsists, `f1.db`'s database
right is share-alike by §4(b), and so would be any facts edition carrying a
substantial portion of these rows. Where no right subsists, §4 adds nothing:
the licence's conditions attach only to *Licensed Rights* that apply to the
use (§1(i)).

#### A CC BY 4.0 facts edition, counted

On the pattern of [D-07] — a second file published beside `f1.db`, each
carrying its own licence — the edition holds every sourced row that does not
cite Wikipedia: <!-- fig:edition_rows -->166,825<!-- /fig --> of the <!-- fig:sourced_rows -->171,695<!-- /fig -->. That is F1DB's <!-- fig:f1db_rows -->166,083<!-- /fig --> and the
<!-- fig:facts_only_rows -->742<!-- /fig --> facts-only rows, which are bare facts on the reading above and put
nothing of FOM's or the FIA's under anyone's licence. *Collective Database*
is ODbL's term, not CC BY-SA's; the separation works for CC BY-SA only
because §4(b) reaches the database holding the substantial portion and no
other.

It leaves out the <!-- fig:wp_rows -->4,870<!-- /fig --> rows that cite Wikipedia:

| Rows | Table | What they are |
|---:|---|---|
| <!-- fig:wp_races -->1,125<!-- /fig --> | `races` | the race register to <!-- fig:wp_last_season -->2024<!-- /fig --> |
| <!-- fig:wp_race_entries -->1,128<!-- /fig --> | `race_entries` | the winners |
| <!-- fig:wp_claims -->2,449<!-- /fig --> | `claims` | race, win, pole and fastest-lap totals as per-car and per-driver articles publish them, and the article the *List of Formula One circuits* links for each circuit |
| <!-- fig:wp_drivers -->64<!-- /fig --> | `drivers` | <!-- fig:wp_drivers_seasons -->15<!-- /fig --> winners a season article introduced, and <!-- fig:wp_drivers_polesitters -->49<!-- /fig --> drivers who took pole and never won, from *List of Formula One polesitters* |
| <!-- fig:wp_cars -->29<!-- /fig --> | `cars` | design families citing their per-car article |
| <!-- fig:wp_regulation_limits -->16<!-- /fig --> | `regulation_limits` | limits cited to the history of the regulations |
| <!-- fig:wp_radio -->6<!-- /fig --> | `team_radio` | the radio quotations |
| <!-- fig:wp_note_sources -->53<!-- /fig --> | `driver_note_sources` | the driver articles the Friday drivers' notes were checked against (LV-08); each is a citation, and the note it backs is this project's writing, measured against the article in `docs/prose_pass.tsv` |

— and five sets a count by `source` cannot see, because the value is
Wikipedia's while the row cites something else: `circuits.article` and
`circuits.article_section`, the article the *List of Formula One circuits*
links for each circuit, on rows citing formula1.com (each value a claim, so
counted in `claims` above, but not by the circuit row's `source`); the per-car specifications
on <!-- fig:wp_chassis_specs -->804<!-- /fig --> `chassis` rows citing F1DB (`spec_source`); the <!-- fig:wp_layouts -->51<!-- /fig --> rows of
`circuit_layouts`, whose source `table_provenance` declares for the whole
table; the pole and fastest-lap credits, which came from the season harvest
wherever it names one, including on rows citing F1DB for their
classification (`schema.sql` declares it on the columns); and the seasons
after <!-- fig:wp_last_season -->2024<!-- /fig -->, whose races cite formula1.com while the venue and pole
harvests read those seasons' articles too — `races.circuit_id` and the pole
and fastest-lap credits there are the harvest's.

The <!-- fig:wp_drivers_polesitters -->49<!-- /fig --> pole-only drivers raise the database-right question of
one more article, a single list rather than a season's table. What they take
from it is a name and a nationality each, bare facts; the `notes` line some
of them carry is this project's writing and belongs to the prose pass. The
three steps above apply to the list unchanged.

The race rows cannot simply be dropped: <!-- fig:wp_dependent_rows -->121,421<!-- /fig --> further rows —
the rest of every classification in `race_entries`, and qualifying, sprints
and pit stops — are keyed to them, and an edition without them has no
spine. So a facts edition has two
routes. The ruling above chose the edition and left the route open, for
`PD-53` (#741) to measure:

- **Re-source the race rows to F1DB** for the edition: build them from
  F1DB's own races and classifications, which state every one of these
  facts, and keep the season harvest as the cross-check it already is rather
  than as the source. Nothing Wikipedia made is then in the file and §4 has
  nothing to attach to; the other sets above are left out or NULL. The route
  rests on F1DB's CC BY 4.0, whose statement `PM-61` (#680) has open, and the
  repository's `harvest/` files stay CC BY-SA — the edition is the artefact,
  not the repository.
- **Keep the rows**, on the reading that no database right reaches them.
  That rests on the maker question above, the least certain step in this
  note.

#### What stays share-alike in any case

Expression, which neither reading of the database right frees: the prose
fields the pass above counts, and the <!-- fig:wp_radio -->6<!-- /fig --> radio quotations (`PM-19`, #251,
and *Decided: the six radio quotations stay*). They are CC BY-SA under the
ruling above, and the facts artefact leaves them out.

**What this note does not establish.** Whether any Wikipedia editor is a
qualifying maker; whether F1DB's own compilation drew on Wikipedia, which is
F1DB's to represent and is represented by its licence; and anything outside
UK and EU law — in the United States there is no database right, and the
copyright reading above is the whole question.

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
