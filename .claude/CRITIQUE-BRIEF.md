# The critique brief

Read this first if you are one of the `*-critic` agents or the
`user-research-simulator`. It carries everything about *this project* that a
critique needs, so the agent files can be about a discipline rather than about
Lap Ledger. One place to change the context; nine places it takes effect.

**This brief is not a set of rules to conform to.** It is orientation. The one
section you must treat as binding is *Three constraints that are not
preferences*, and that is because those come from outside the project.

---

## What the thing is

**Lap Ledger** (lapledger.org) publishes a SQLite database of Formula One,
1950–2026 — 119,271 rows across 46 tables and 38 views, as of v2.20 — and a
website that queries it. (Check those figures rather than trusting them; the
first version of this brief said 41 tables, which is what the Parquet exporter
writes, not what the database holds.)

The website has no server and no API. It downloads the whole 20 MB database
once (4.5 MB gzipped), keeps it in IndexedDB, and runs real SQL in a Web Worker.
Every one of the ~2,385 routes is also written out as static HTML at build time,
so each page has its own URL, title and content whether or not JavaScript runs.
Nothing a reader queries leaves their tab.

The database is also a product in its own right: a GitHub release carries the
`.db` files, a JSON export and a Parquet bundle, and the site serves a
freshly-built Parquet zip from its own domain.

Its distinguishing claim is **verifiability**. Facts are harvested from sources
that are cross-checked against each other; a row that fails a check is refused
rather than stored; where two sources genuinely disagree the disagreement is
recorded in a `discrepancies` table rather than resolved silently; and what the
project does not know is recorded in `known_gaps` and printed on a page. There
is a confidence ladder, and a documented model for deriving it rather than
declaring it.

## Who appears to use it

Nobody has asked them, which is itself a finding. From the shape of the thing,
the plausible audiences are: a fan settling an argument; a journalist checking a
figure before filing; a data scientist who wants the bulk export and never opens
the site; a developer evaluating whether to build on it; a Wikipedia editor
sourcing a claim; and someone arriving from a search engine on a deep page.

That last one matters more than the homepage. There are 2,385 prerendered pages
and one front door.

## What the author wants it to be

Stated by the author, 2026-09-10, so you are not guessing:

**A public reference that other people depend on.** Readers, citations and
downstream users are wanted. Findings about discoverability, positioning,
measurement and the bulk-data audience are therefore **in scope and should be
pressed hard** — this is not a private craft object that happens to be online,
and you should not soften a finding on the assumption that it is.

**Time is bursty and unpredictable.** Judge cost accordingly: propose work in
independently shippable pieces, and do not make a recommendation whose value only
arrives if a longer programme is finished. A change that pays for itself the week
it ships beats a better change that needs six consecutive weeks. Where you can,
say roughly what a recommendation costs.

## Where to look

| | |
|---|---|
| `README.md` | the database: what is in it, how it is checked, what it deliberately lacks. Also the version log. **Broadly stale — treat no number in it as current.** Some figures are wrong by more than 10×. Read it for intent and check every count against `f1.db` |
| `web/README.md` | the front end: the loading design, the pages, the voice, the Pit Wall look, the charts, the atlas, the testing |
| `CLAUDE.md` | the conventions, and the *measured and rejected* list |
| `docs/` | build notes by version, the commercial-readiness reading, the confidence model and its backlog, the timing architecture decision |
| `schema.sql` | 41 tables, with comments |
| `web/src/pages/` | 22 page components |
| `f1.db` | the actual data. `./f1 sql "…"` or `sqlite3` will answer most questions faster than reading code |

## Three constraints that are not preferences

These come from licences, not from taste, and a recommendation that ignores one
is wasted work. Everything else in this project is open to challenge.

1. **There are no lap times, and there will not be.** No source publishes
   Formula One lap timing under a licence that permits passing it on. The
   `laps`, `stints`, `race_timing` and `race_control_messages` tables are empty
   in the published database and that is the correct permanent state. Do not
   recommend lap charts, telemetry, a live timing view, or an architecture to
   make room for them. `docs/TIMING-ARCHITECTURE.md` has the reasoning and the
   measurements.
2. **Circuit centrelines ship as a separate file.** ODbL's share-alike reaches
   the whole database its data lands in, so merging `f1-geometry.db` into
   `f1.db` would put 117,000 unrelated rows under ODbL. Two files distributed
   together are a Collective Database; the browser merges them at runtime.
3. **There are no team livery colours.** No source publishes them under a
   licence this project can admit, and none can be independently checked. The
   interface uses international racing colours instead, keyed off constructor
   country, and says so.

Anything else — the whole-download architecture, the confidence ladder, the
information architecture, the voice, the visual system, what the product is
*for* — is fair game, including the items on the *measured and rejected* list in
`CLAUDE.md`.

## The posture

**You are outside this project and you owe it nothing.** It documents its own
reasoning unusually well, and that is a trap as much as a help: a decision with
a paragraph of justification attached still reads as justified when the
justification only ever convinced its author.

So:

- **You may reopen any closed decision.** If you think the whole-download
  architecture is wrong, say so.
- **But engage with the recorded reason.** "Consider code splitting" is worth
  nothing when `CLAUDE.md` gives a bundle measurement against a database size.
  "The bundle measurement is the wrong comparison, because *X*" is worth a lot.
  A critique that has plainly not read the reason will be discounted whole, and
  should be.
- **Absence of a reason is itself a finding.** Much here is decided and written
  down. Where something is neither, say so — that is usually where the real
  problems are.
- **Do not grade on a curve for a one-person side project.** Judge it as what it
  presents itself as, and as what its author says he wants it to be: a published
  reference source that other people depend on.
- **Endorsing a closed decision is a valid and valuable output.** Examining
  something contested and concluding it is right is a finding, and one the author
  cannot get any other way. The instruction to be sceptical is not an instruction
  to produce disagreement: a critique that manufactures a dispute to look
  diligent is worse than one that finds little, because it costs the reader the
  time to disprove it. Say what you examined and cleared, and why.

## Pressure points

Starting points, not conclusions. Each is tagged with the disciplines it is
likely to reward — ignore the ones not addressed to you rather than chasing them
to a dead end.

- **The cold first visit.** 4.5 MB downloads before the app can answer anything;
  prerendered HTML paints first and is then replaced. Whoever built this has a
  warm cache and has never seen it. Throttle the network.
  *(interaction, accessibility, product, service)*
- **Deep arrival.** 2,385 prerendered pages, one front door. Most readers land in
  the middle from a search engine, and the prerenderer is a second, independent
  implementation of every page. *(all disciplines)*
- **`/reference/*`** holds three unlike things: methodology, domain reference, and
  a public SQL console. Category or drawer? *(IA, product, content)*
- **Conventions a reader meets cold and will read as bugs.** A blank means *not
  established*, never zero, and renders as an em dash. A repeated finishing
  position is a shared drive. A margin before 1991 is net of dropped scores.
  Where a stored figure and a derived one disagree, both are shown deliberately.
  Some rows are `unverified` on purpose. *(content, interaction, IA)*
- **Overlapping encodings of uncertainty**: a `confidence` tier, a free-text
  `source`, `source_registry` + `source_patterns`, `table_provenance`,
  `discrepancies`, `known_gaps`. `docs/DERIVED-CONFIDENCE.md` proposes
  consolidating onto `claims` and `checks`. *(data architecture only — the
  reader-facing surface is fine, and a product or content critic will find
  nothing here worth saying)*
- **`race_entries` is one row per driver per race**, so a driver who drove two
  cars in one Grand Prix — normal before 1965 — can keep only one result.
  *(data architecture)*
- **The interactive surfaces**: a public SQL console, a track atlas with a lap
  scrubber, and four hand-drawn SVG charts that each carry a table of their own
  numbers. *(interaction, visual, accessibility, product)*
- **Nobody has asked a user anything, and nothing is measured.** *(product,
  service, user research)*

## What has already been critiqued, and what is queued

Two files, and you must read both before starting:

- **`docs/critiques/`** — every previous critique, dated and named by discipline,
  with the full reasoning and evidence.
- **`docs/BACKLOG.md`** — what came out of them, ranked, plus the author's own
  ideas. It carries what has **landed** and what was **declined, with the
  reason**.

You are not there to rediscover any of it. A recorded finding is worth raising
again only if it has got worse, if it was recorded at the wrong severity, or if
your discipline sees a cause the previous critic did not — say which, and cite
the ID. A **declined** item may be re-raised, but the stated reason is what you
have to argue against; ignoring it wastes the entry. A **landed** item is worth
revisiting only to say the fix did not work, and then you must show how.

Everything else in your report should be new.

**File your own findings as backlog IDs.** Use your discipline's prefix, keep
your report's own numbering, and give each a size (S / M / L / ?). Sizes matter
here more than usual: the author's time is bursty, so an L that cannot be broken
into shippable pieces is a decision to be made rather than a task to start, and
should be written as one.

If both files are empty, you are the first.

## Seeing the real thing

**Evidence is not ranked the same way for every discipline.** Two different
things get called "reading the repository":

- **The project's prose** — README, `docs/`, `web/README.md`, release notes, the
  comments in `schema.sql`. This is the product's account of itself, and for
  product, content, service and IA critique it is *strong* evidence: the gap
  between what it claims and what ships is often the finding. Read it early.
- **The project's code** — components, scripts, queries. This tells you what was
  intended, which is weak evidence for what a person experiences. For anything
  about the rendered experience it is the last resort, not the first.

Where your discipline needs the rendered site, drive it.

    ls web/dist/index.html            # already built? then skip the build
    cd web && npm ci && npm run build # ~minutes: vite, then 2,385 prerendered pages
    cd web && npm run preview         # serves the built site locally
    npx playwright install chromium   # once, if the browser is missing

`web/test/smoke.mjs` is a working example of driving this site with Playwright —
copy its setup rather than inventing one. Note that the app needs a moment after
load: the static HTML paints first and React replaces it once the database is
open, so an assertion that fires too early tests the prerendered page instead of
the app. Both are worth looking at, and telling them apart is part of the job.

Write scratch scripts and screenshots to a temporary directory. **Never modify
the repository.** You are critiquing, not contributing; a diff from you would
arrive without the context that makes it reviewable.

Useful without a browser:

    ./f1 gaps                          # the declared gaps
    ./f1 licences                      # the source classification
    ./f1 sql "select …"                # arbitrary read-only SQL
    python3 verify.py                  # the checks, seconds

**There is no `sqlite3` command-line tool here.** Use `./f1 sql`, or
`python3 -c "import sqlite3; …"`, and read `schema.sql` directly rather than
reaching for `.schema`.

## What to hand back

A critique nobody acts on is a critique that failed, and length is the usual
reason. So:

1. **Open with the three findings that matter most**, in a few lines each,
   before any detail. If the reader stops after that, they should have got the
   value.
2. **Then the full set, ordered by consequence.** For each: what you observed,
   where (route, file and line, or the exact interaction), why it matters to a
   named kind of reader, and what you would do instead. A finding without a
   location is an opinion.
3. **Mark each finding's evidence** — `drove the site`, `read the source`,
   `read the docs`, `queried the database`, or `inference`. Inference is
   allowed. Inference dressed as observation is not.
4. **Separate defect from preference.** Say which each one is, in those terms.
   A discipline critique loses its authority the moment a taste call is smuggled
   in as a standard, and this reader will notice.
5. **Say what is genuinely good, briefly and specifically.** Not for balance —
   because it tells the reader which parts not to touch while fixing the rest,
   and a critic who finds nothing good has usually not looked hard.
6. **Name what you did not examine.** Coverage you did not have is not the same
   as an absence of problems.

**Where a finding can carry a measurement, measure it.** A finding with a number
attached is acted on; the same finding without one is discussed. "The static page
is slow" is an opinion; "11.4 s on 4 Mbps, during which it shows a different
figure from the app" is a work item.

**On overlap with the other critics.** Nine disciplines against one product will
find some of the same things. Where a finding is plainly another discipline's —
you are a content critic looking at a schema, or a product critic looking at
contrast ratios — leave it to them. Where it is genuinely shared, raise it, and
say in one line which discipline you think owns the fix. Do not stay silent on a
serious finding because you assume somebody else will catch it.

Do not restate the project back to it. Assume the reader knows what they built
and wants to know what is wrong with it.
