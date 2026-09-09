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

99.5% of the 117,391 sourced rows carry a licence that permits
redistribution outright. The remaining 0.5% cite an official source as the
**authority for a fact** and hold none of that source's prose. Nothing in the
committed database may not be published.

| Class | Rows | Share |
|---|---:|---:|
| `yes` — redistributable on the terms given | 116,852 | 99.5% |
| `facts-only` — the facts, not the expression | 539 | 0.5% |
| `no` — not redistributable | 0 | 0% |

---

## What was read

539 rows cite `formula1.com` (478) or `fia.com` (61), the two sources whose
licences are "FOM copyright; no reuse licence" and "FIA copyright; published
for reference, not redistribution". Every one was examined and classified as
either

- **(a) a bare fact citing an authority** — keep. Facts are not
  copyrightable, and restating one is not redistribution; or
- **(b) text following the source's expression** — rewrite.

**All 539 are (a). None is (b).** The breakdown:

| Table | Rows | Source | What the row holds | Prose |
|---|---:|---|---|---|
| `drivers` | 118 | formula1.com | names, dates, career totals | `notes` |
| `circuits` | 80 | formula1.com | length, turns, GP count | `notes`, `characteristics` |
| `seasons` | 77 | formula1.com | champion, points, rounds | `notes` |
| `standings` | 65 | formula1.com | 2025 final, 2026 current | — |
| `constructors` | 55 | formula1.com | register facts | `notes` |
| `races` | 47 | formula1.com | 2025–26 calendar | — |
| `race_entries` | 36 | formula1.com | 2025–26 race winners | — |
| `regulation_changes` | 58 | fia.com | year, category | `detail`, `impact` |
| `regulation_limits` | 3 | fia.com | numeric limits | `note` |

The prose columns in the right-hand column are **written for this project**,
not taken from FOM or the FIA — `ATTRIBUTION.md` records regulations, safety,
technical and glossary text as "written for this project from general
knowledge". They carry a separate obligation, from Wikipedia and not from
these sources, and are the subject of the prose pass rather than this one.

### The 148 rows that look redundant and are not

`races` (47), `race_entries` (36) and `standings` (65) cover 2025 and 2026,
and F1DB covers both seasons under CC BY 4.0. It is tempting to read these as
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

## Still open

**The prose pass.** 552 short fields — averaging barely a sentence — carry the
CC BY-SA obligation that comes from Wikipedia, not from FOM. Each needs
marking as original, paraphrased, or close to source; only the third needs
rewriting. This is about knowing what the licence statement must say, not
about whether the data may ship. It may.

**Trademark.** Not a data question and not addressed here. "Formula 1", "F1"
and "Grand Prix" are Formula One Licensing BV's, this project is unaffiliated
and says so, and the exposure rises the moment money appears. If it ever
does, that is a question for a solicitor rather than for a build check.
