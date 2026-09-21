# Product design critique — 2026-09-21

**Critic:** `product-design-critic`, fourth run.
**Subject:** Lap Ledger at v2.24, `main` at `dda5afb`, driven at
http://localhost:4179 (prerendered HTML and the app, Chromium 1280×900, and
with JavaScript disabled); `f1.db` queried directly; `CLAUDE.md`,
`README.md`, `docs/COMMERCIAL-READINESS.md`, `LICENSE-DATA`,
`docs/critiques/2026-09-1{0,1,3}-product-design.md`,
`docs/critiques/2026-09-13-design-review.md` and 181 open issues read.
**Reached on the network:** github.com/f1db/f1db (release API), openf1.org,
api.jolpi.ca, statsf1.com, forix.autosport.com. **Not reached:**
chicanef1.com (DNS), motorsportstats.com (403).
**Brief:** the maintainer's three additions of 2026-09-21 — reliable F1 data
in one place for someone who is not the author; commercialisation; and "it is
all a bit dull" — plus a pass over the whole open backlog.
**The repository was not modified.** No issues were filed.

---

## The three findings that matter

### 1. There are two homepages, they make different claims, and the weaker one is the one machines read

With JavaScript off, `lapledger.org/` is headed **"Formula One, 1950–2027,
with its sources attached"**, carries seven counts and a table of the last ten
champions, and its most recent fact is *Lando Norris, 2025*. With JavaScript
on, the same URL is headed **"Every Formula One race since 1950"** and opens
with the last race run (Madrid, 11–13 Sep 2026), the next on the calendar
(Azerbaijan, round 15), eight destination cards, a chart and a block teaching
the four reading conventions. Measured: **1,974 characters static against
3,874 in the app**, and they share almost no content.

Two consequences, and the second is the serious one. First, in September 2026
a crawler, an answer engine, a no-JS reader and every human for the first
0.5–1.6 s is told this site's newest fact is the 2025 champion. Second, the
two front doors lead with **different positioning**: the static one leads with
the differentiator ("with its sources attached"), the app leads with coverage
("every race since 1950") — which is the claim Wikipedia, StatsF1, F1DB and
formula1.com all make. The page that states the thing nobody else can state is
the page no person reads, and the page people read states the thing everybody
else already says.

`SD-21` (#392) argues that static HTML read by machines is this project's best
distribution channel. The homepage is the page that decides what a machine
thinks the site *is*, and it is the one page where the static half is least
like the real product.

### 2. The published licence is stricter than the licence 97.4 % of the data arrives under, and that blocks "depended on" and "paid for" at the same time

**115,422 of 118,485 sourced rows (97.4 %) cite F1DB, which is CC BY 4.0.**
2,368 rows (2.0 %) cite Wikipedia — 1,125 in `races`, 1,128 in `race_entries`,
plus 64 drivers, 29 cars, 16 regulation limits and the 6 radio quotations. On
top of that sit ~552 short prose fields. Because of those, the whole database
ships **CC BY-SA 4.0**, whose §4(b) reaches a downstream database that
incorporates a substantial portion — the same reach the project reasoned about
carefully for ODbL and solved with a second file `[D-07]`.

So a commercial builder choosing an F1 dataset finds that Lap Ledger is
**strictly less usable than its own principal upstream source**. Whatever
Lap Ledger adds — the cross-checks, the 58 discrepancies, the 10 gaps, the
confidence tier — is exactly what a paying user would value, and exactly the
part they cannot take without share-alike reaching their own product. That is
the central commercial fact about this project and nothing in the queue names
it.

It is also a one-way door that gets more expensive every week the harvest
runs, because every new Wikipedia-cited row adds to what would have to be
re-sourced.

### 3. The product is reference-complete and return-empty. That is what "dull" is

The 2026-09-13 review answered "a more exciting design language" with
"Reshape, keep Pit Wall", and it was right: `VD-25`–`VD-34`, `AF-03`,
`AF-04`, `AF-46/47` have landed and the pages are materially better than the
critiques describe. The 2026 season page now carries title permutations, a
next-session countdown and a calendar strip; the driver page carries a
team-coloured championship chart. None of that is the gap.

The gap is that **there is no reason to come back**. The site holds 1,163
dated races and 27,504 classifications and derives not one recurring fact from
them. StatsF1 — the nearest free competitor, reached today — opens its
homepage with *"8th win for Kimi Antonelli · 250th win Mercedes engine · 19th
pole position for Lando Norris · 180th pole position for McLaren"*, all of
which Lap Ledger could derive and none of which it does. There is no
on-this-day, no driver-versus-driver comparison, one `og:image` shared by all
3,545 prerendered pages, and a change feed whose entries are *"Database v2.24,
built 2026-09-16"* rather than what happened in the sport.

For a reference product, "engaging" is not motion. It is: a reason to return,
something surprising per visit, and something to argue with. This product has
none of the three, and all three are derivable from data already held and
already licence-clean.

---

## The rest, by consequence

Evidence tag on each: *drove the site*, *read the source*, *read the docs*,
*queried the database*, *reached the network*, *inference*.

### PD-40 — One homepage, not two — **defect** — S/M

**Observed** (*drove the site*, JS on and off; *read the source*,
`web/scripts/prerender.js:1187–1235`, `web/src/pages/Home.jsx`). As finding 1.
The prerenderer writes a bespoke homepage — seven `[label, value]` counts and
a `SELECT … FROM seasons … LIMIT 10` champions table — that shares its
headline, its subhead and almost none of its body with `Home.jsx`.

**Who it hurts.** The deep-arriving reader is not the problem here; the
homepage is. It hurts (a) the answer engine `SD-21` (#392) is written about,
(b) anyone who shares the root URL, and (c) the announcement `SD-18` (#389)
proposes, whose single moment of attention lands on this page.

**Why it happened.** Unrecorded. `PD-02`'s two-renderers rule and the smoke
suite's static-versus-app table comparison exist precisely to stop this, and
`PD-39` (#459) records that the comparison does not reach a facts list. It
also does not reach the homepage, because the two homepages have no tables in
common to compare.

**Do:** make the prerendered homepage render the same sections as `Home.jsx` —
at minimum the season-at-both-ends pair, the eight destination cards and the
conventions block. The champions table is the one static-only element worth
keeping; put it in both. Then extend the smoke suite's renderer comparison to
the homepage's section headings, which is the cheap guard that stops it
recurring.

**Trade-off:** the prerenderer is a second implementation by design and every
section added to it is code to keep in step. That cost is already accepted on
21 other page types; the homepage is the one where it was not paid.

### PD-41 — Decide the licence before another week of harvest — **decision, not a defect** — ?

**Observed** (*queried the database*; *read the docs*, `LICENSE-DATA`,
`docs/COMMERCIAL-READINESS.md`; the reading of CC BY-SA 4.0 §4(b) is
*inference* and not legal advice). As finding 2. `LICENSE-DATA` records the
reason plainly: *"Rather than draw a line field-by-field, the whole data
release is licensed CC BY-SA 4.0."* That was a reasonable convenience when the
project's purpose was a personal artefact. It is now the thing standing
between the project and both of its stated goals.

**Three options, in cost order.**

- **(a) Keep CC BY-SA and say so as a position.** Then the bulk-data
  developer is not an audience this product serves, and every item ranked for
  that audience — the Parquet bundle's discoverability, `DA-04`, `SD-11` —
  should be re-ranked as serving citation rather than integration. Cost: a
  paragraph. Honest, and it closes a door.
- **(b) Relicense the project's own writing today.** `source_registry` #18,
  "Written for this project from general knowledge" — the glossary, the era and
  engine periodisations, governance and safety timelines, constructor lineage,
  the points-system table — is currently offered under share-alike by the
  convenience quoted above, not by any obligation. Offering it under CC BY 4.0
  or CC0 costs nothing and is free to take back later only in the sense that
  it is not. Cost: **S**, and it is the cheap first step.
- **(c) Split the share-alike out, the way ODbL was split.** Re-source the
  1,125 Wikipedia-cited `races` rows and 1,128 `race_entries` rows to F1DB,
  which covers both; move the remaining Wikipedia-derived prose into a second
  file distributed alongside, exactly as `f1-geometry.db` is; publish the
  factual core as CC BY 4.0. Cost: **M–L**, and `PM-17` (#249) is its
  prerequisite because nobody yet knows which of the 552 prose fields actually
  carries the obligation.

**Do:** take (b) this month regardless; decide (a) or (c) deliberately and
write the decision into `docs/DECISIONS.md`. Do not let it be settled by
accretion.

**Trade-off on (c):** it spends the cleanest thing about this project — a
licence position that is fully reasoned and fully enforced — on a gain that
only pays if an audience appears. Do not start it before `SD-18` (#389).

### PD-42 — Build the return mechanic: milestones and on-this-day — **preference, strongly held** — M in two S pieces

**Observed** (*reached the network*, statsf1.com/en/default.aspx;
*queried the database*; *drove the site*). As finding 3.

**Do, in two shippable pieces.**
1. **Milestones after each round.** From `race_entries` alone: *"Antonelli's
   8th win", "McLaren's 180th pole", "the 250th win for a Mercedes engine",
   "Hamilton's 400th entry"*. Derive them at build time, show four or five on
   the homepage and on the race page, each linked to the page that proves it.
   This is Lap Ledger's claim applied to the only content readers actually
   share, and it is the one place where "every figure is traceable" is a
   feature rather than a disclaimer. **S/M.**
2. **On this day.** 1,163 races carry `date_iso`. A strip of "on this date in
   1976, 1988, 2003" on the homepage costs one query and is the oldest
   return mechanic in reference publishing. **S.**

**Trade-off:** both need the daily build to be the source of truth, which it
already is, and both create a surface where a wrong figure is embarrassing
rather than merely wrong. That is the right kind of pressure for this project.

**Whose fix:** mine for the decision, visual design's for the treatment.

### PD-43 — The 5 MB is spent on behalf of readers who mostly never use it — **decision** — M, blocked on `PD-Ø`

**Observed** (*drove the site*, Chromium with CDP throttling; *read the docs*,
`CLAUDE.md`'s *measured and rejected*). Cold load of `/drivers/hamilton`:
static HTML painted at **475 ms** on 9 Mbps and **1,594 ms** on 1.6 Mbps; the
app replaced it at **6,051 ms** and **31,401 ms** respectively, after ~6.0 MB.
Across nine sampled routes the static page carries **65–170 % of the app
page's text** — median about 1.25× — so for a single fact-check the static
page is already the answer on every page type I measured.

**Engaging the recorded reasons.** `[D-12]` rejects route-level code splitting
and `[D-13]` rejects an HTTP range-request VFS. Both compare *implementations
of the download*. Neither asks whether the download should start at all for an
arrival that will read one prerendered page and leave. That question is
unasked, and on a 3,545-page site with one front door it is the larger one.

**Do:** not now. Defer until `PD-Ø` (#261) returns two weeks of Cloudflare
data. Then, if the overwhelming majority of sessions are one page with no
interaction, change the *trigger*: fetch the database on first intent — a
search, a sort, a filter, a second navigation, or an explicit "load the full
record" control on the sections the static page truncates. That is neither
rejected decision; it is roughly twenty lines and one new affordance.

**Trade-off:** the app's extra content (the full 394-entry table on Hamilton,
the charts) would stop appearing unbidden, so the affordance has to be
visible or the site quietly loses its depth. This is why it is a decision and
not a task.

### PD-44 — Head-to-head is the fan's actual job, and it is buried as one clause of a five-part S — **defect of ranking** — M

**Observed** (*read the source*, no `compare` route in `web/src/pages/`;
*read the docs*, `PD-35` #158). The brief's first named audience is *"a fan
settling an argument"*. The arguments fans have are comparative: Hamilton
versus Schumacher, Senna versus Prost, this team-mate versus that one. There
is no comparison surface anywhere on the site, and the only mention of one in
181 open issues is eight words inside `PD-35` — *"the team-mate head to head
on every driver page, derived"* — an issue sized **S** that contains five
unrelated proposals and sits in *Next*.

**Do:** split `PD-35`. Promote the team-mate head-to-head to its own item
(**S**: it is one query against `race_entries` grouped by race and
constructor) and file driver-versus-driver comparison as a route (**M**:
`/compare/:a/:b`, prerenderable for a curated list of ~40 famous pairs, with
the app handling arbitrary pairs). The rest of `PD-35` — grid penalties, tyre
allocation, the lap-record sentence — keeps its place.

**Trade-off:** a comparison page invites a "who was better" reading the data
cannot support. Answer it the way this project answers everything else: show
the figures, name what each does not account for, and refuse the verdict.

### PD-45 — 3,545 pages share one share image, on a project whose measured constraint is that nobody knows it exists — **defect** — M

**Observed** (*drove the site*; `curl` of `/drivers/hamilton`). `og:image` is
present on every page and is `https://lapledger.org/share-card.png` on every
page, with `og:image:alt` reading *"Lap Ledger: a chequered field with one
cell marked in red"*. The `og:description` **is** per-page and is excellent.

`SD-18` (#389) measures the whole distribution problem at **1 asset download
across six releases** against F1DB's 4,013 for its 2026-09-13 release (I
re-fetched: 1,791 JSON-split, 1,519 CSV, **419 SQLite**, published 8 days
ago). Against that, a generated per-entity card — name, the four headline
figures, the team colour `AF-04` already holds — is the cheapest distribution
lever this product has, because it applies to every link anyone ever shares
without anyone doing anything.

**Do:** generate cards for the entity page types only (drivers, constructors,
circuits, races, seasons) at build time. ~3,000 PNGs at build time is a
minute of CI and a few MB on the origin.

**Trade-off:** a build step that can fail silently, which `[D-10]` has a
pattern for. **Whose fix:** mine for the case, visual design's for the card.

### PD-46 — `DA-04` is the dependency contract, not a data-architecture nitpick — **re-rank** — S

**Observed** (*read the docs*, #200). "Surrogate ids moved on 17 % of
`race_entries` between v2.20 and v2.21, and nothing declares which ids are
stable." It sits in **Someday**, labelled data architecture, sized S.

For the audience the maintainer says he wants — people who *depend* on this —
that sentence is disqualifying. Nobody builds anything on identifiers that
move 17 % between releases with no published stability policy, and nobody pays
for one. It is the single item most under-ranked relative to the project's
stated goal, and the fix is a paragraph in `/data` plus a check: declare which
keys are stable across versions, and make `verify.py` fail if a declared-stable
key changes.

**Do:** move to *Next*, immediately behind `PD-Ø`.

### PD-47 — The commercial prerequisites are three open S items nobody has connected — **observation** — S each

**Observed** (*read the docs*, #222, #223, #238; *read the source*,
`.github/workflows/refresh.yml`). "Good enough to pay for" for this product
does not mean better data. Nobody pays for facts published under a CC licence.
They pay for **not having to run it**, for **being told when something
changed**, and for **someone answering for it**. All three are continuity
promises, and all three are currently unmakeable:

- `SD-14` (#222) — GitHub disables a scheduled workflow after 60 days of
  repository inactivity. The winter break is 1 December to late February. The
  auto-refresh that keeps the site correct **will stop**, on a date that can be
  put in a diary, and the site will silently claim a 2026 calendar is current
  through 2027 testing. This is the only item on the board that turns the
  product from incomplete into *wrong*. It is an S, and it is in *Next*.
- `SD-15` (#223) and `UR-05` (#238) — nothing anywhere names the publisher,
  the refresh cadence, or what happens if he stops. These are the same gap
  filed twice.
- There is **no `.github/FUNDING.yml`**, no sponsors button, no contact other
  than a GitHub issue template. The repository has **2 stars and 0 forks**.

**Do:** re-rank `SD-14` to *Now* — it has a deadline. Merge `UR-05` into
`SD-15` and keep it in *Now*, because it gates `SD-18`. Add a `FUNDING.yml`
when `SD-15` lands; it is a four-line file and it is the only money surface
that costs nothing and risks nothing.

### PD-48 — `COMMERCIAL-READINESS.md` asserts a position the maintainer no longer holds, and that assertion is load-bearing — **defect** — S

**Observed** (*read the docs*). The document's closing section states: *"What
has been decided is the scope, not the law: this stays free and
non-commercial."* It is cited, in the radio-quotations section, as part of why
six verbatim exchanges were kept: *"Revisit it if the project is ever
commercialised in a form that reproduces them prominently."*

The maintainer's stated intent of 2026-09-21 is that the project should
eventually make money. The document is therefore stating as decided something
that is now open, in a file whose whole purpose is to be the record of what
was decided and why.

**Do:** change the sentence to say what is actually true — commercialisation
is wanted and unspecified; the trademark question (`PM-18`, #250) becomes live
when there is a payment or sponsorship surface rather than "if money ever
appears"; and `PM-19` (#251, revisit the six radio quotations) moves from
*Someday* to *blocked on the commercial form*. The rows can stay; the trigger
needs to be a real one.

**Endorsement while there:** `PM-18` is correctly sized and correctly
deferred. The trademark position is in better shape than the issue implies —
the product name is clean, "a Formula One database" is descriptive use, and
every page already carries *"Unaffiliated with Formula One, the FIA or any
team."* Do not spend a solicitor's fee before there is a form to describe.

### PD-49 — The product is Lap Ledger; the repository is `formula-1-data` — **defect** — S

**Observed** (*reached the network*, `gh repo view`). `github.com/Alex-Farley/
formula-1-data`, 2 stars, 0 forks, created 2026-09-04, description beginning
"Formula One, 1950–2026" (the site says 1950–2027). Topics are set correctly.
The comparator, `f1db/f1db`, has 621 stars and takes 4,013 downloads a release.

The repository is the distribution channel for the bulk-data audience and the
target of the "Report it" link on all 3,545 pages. It is named after a
category, not a product, so nothing about it says it is the thing at
lapledger.org, and a search for "lap ledger" on GitHub finds it by neither name
nor description. GitHub redirects renamed repositories permanently, so the cost
is close to zero and every day of delay adds inbound links to the old name.

**Do:** rename to `lap-ledger` before `SD-18`'s announcement, and open the
first line of the description with the product name.

### PD-50 — The change feed talks about the artefact, not about the sport — **preference** — S

**Observed** (*drove the site*, `/changes`; `curl /feed.xml`). Every feed entry
is a version: *"Database v2.24, built 2026-09-16: 1,163 races run of 1,196 …
11 open disagreements and 10 known gaps."* A reader who subscribes learns when
the file changed, not what changed in Formula One.

This is the only push channel the product has, and `SD-23` (#412) already
notes the record of what moved is not durable. Combined with `PD-42`'s
milestones, the same build could emit an entry that says *"Madrid: Antonelli's
8th win, Mercedes' 8th of 2026; the title is now open to nine drivers"* — which
is a thing a person subscribes to and a thing an answer engine can cite.

**Do:** after `PD-42`. One entry per data change, written from the diff rather
than from the version bump.

### PD-51 — What could actually be sold, and what would have to be true first — **the commercial map**

*Inference throughout, calibrated against two reached comparables.*

**What cannot be sold.** Access to the data. CC BY-SA 4.0 is irrevocable for
everything published, so there is no version of this where paying is the way to
get the facts. Any plan that starts with a paywall on `f1.db` is dead on
arrival, and pretending otherwise would waste a year.

**What the market does.** OpenF1 — reached today — gives all historical data
away free forever and charges **€9.90/month for a "Sponsor" tier** whose only
functional benefit is live data, explicitly framed as *"Helps keep the project
alive"*. That is patronage with a token benefit, and it is the working model in
this exact niche. The one benefit OpenF1 sells, live timing, is the one thing
Lap Ledger may never sell. Forix, the paid historical archive, has been
absorbed into Motorsport Stats and sells to businesses, not readers.

**The three plausible forms here, ranked by what they need.**

1. **Patronage.** GitHub Sponsors / Ko-fi, on the strength of the artefact.
   *Needs:* a named publisher (`SD-15`), an announced project (`SD-18`),
   a `FUNDING.yml`. Realistic ceiling: tens of pounds a month. Cost: hours.
   **This is the only one that can start this quarter.**
2. **A hosted query service.** `api.lapledger.org` — versioned, always-fresh,
   JSON over HTTP, with an SLA. The data stays free; the *service* is the
   product. This is what every commercial consumer actually wants and cannot
   get from a 21 MB download, and Ergast's shutdown plus Jolpica's and
   OpenF1's CC BY-NC-SA terms mean there is currently **no licence-clean,
   commercially-usable, hosted F1 history API**. *Needs:* `PD-41` resolved
   toward CC BY (or at least a clear statement that the API's output is not
   share-alike-encumbered), `DA-04`'s stable ids, a continuity statement, and
   a server — which the site does not have and, on `lapledger.org`, should
   never have. Put it on a different hostname so the "nothing you look at is
   sent anywhere" promise stays literally true. Cost: **L**, and a different
   kind of project.
3. **Bespoke work.** Answering newsroom data questions, custom extracts. Needs
   only a named publisher and a contact address, converts at almost nothing,
   and is worth mentioning only because it costs the same as (1).

**What is not worth doing:** merchandise (trademark exposure for pennies), a
paid app (nothing to charge for), ads (destroys the one claim the product
has).

**The honest verdict.** There is nothing here a person would pay for today,
and the reason is not packaging — it is that the product has one measured
user. "A good enough product will find the money" is true only if "good
enough" includes "found". Every commercial question is downstream of `PD-Ø`
(#261) and `SD-18` (#389), with one exception: **`PD-41`, the licence, is the
only commercial decision with a clock on it**, because it gets more expensive
every week and it determines whether form (2) is ever available at all.

### PD-52 — `PD-29`'s telemetry refusal is half-landed, and the unshipped half is the half a reader meets — **defect** — S

**Observed** (*drove the site*). `/data` now carries it well: *"Nobody
publishes Formula One race timing under a licence that permits passing it on,
so this database holds none of it: lap times, stints, race timing and race
control messages ship as four empty tables, on purpose."* The race page
(`/races/2026/14`) and the season page say nothing. Grep for "lap time",
"timing", "no source publishes" on both returns nothing.

A reader looking for lap times goes to a race page, not to `/data`. The
constraint-as-position is currently stated only where the people who already
believe it will read it. Keep `PD-29` open, note the `/data` half is done.

---

## What is genuinely good, and should not be touched while fixing the rest

- **`/data` and `/data/quality` are the asset.** 76,223 characters of static
  HTML on the quality page, a six-rung ladder with "safe to quote" stated per
  rung, 10 gaps each with what would close it, and the distribution of rows
  across the ladder drawn and tabulated. No F1 source anywhere publishes this.
  If the project ever needs one page to argue its case from, it is this one.
- **The current-season area delivered.** `PD-28` asked for it on 2026-09-13
  and what shipped is better than what was asked for: nine drivers named as
  able to win, 233 points still available, the arithmetic shown and the
  tie-break caveat stated, a next-session tile that counts in days. This is the
  one thing on the site formula1.com does not do and Wikipedia does by hand.
  Defend it.
- **The ODbL split `[D-07]`.** Reading it again against the CC BY-SA question
  it is plainly right, and it is the proof that the harder split in `PD-41` is
  buildable.
- **The auto-refresh commits to `main`.** A daily job that fetches, rebuilds,
  verifies, and pushes only on a clean build is exactly the right shape for
  "reliable data in one place", and it is rarer than the maintainer seems to
  think. Protect it from `SD-14`.
- **Per-page `og:description`.** Genuinely per-entity, genuinely readable, and
  the reason `PD-45` is about the image only.

---

## Backlog verdicts

### Product design — every open `PD-*`

| # | ID | Verdict | Why |
|---|---|---|---|
| 459 | PD-39 | **keep** — *Next* | The mechanism that would have caught PD-40. Extend its scope to the homepage's section headings while there. |
| 432 | PD-38 | **keep** — *Now*; **re-size** M → 4×S | The four bullets are independently shippable and the body says so. Ship the `v_current_grid` one first; it is the one a fan opens. |
| 424 | PD-37 | **keep** — *Next* | Same family as PD-40 and PD-39: the two renderers disagree. Group the three. |
| 267 | PD-18 | **keep** — *Next*; **re-rank up**, **re-scope** | Narrow to the 23 current-grid drivers (98 % Commons coverage, one season page shows them all). Its stated gates — PD-16, PD-19 — have shipped. Cheapest thing that makes the season area feel alive. |
| 261 | PD-Ø | **keep** — *Now*, first | Decided 2026-09-20 and correctly ranked. One addition: it commits to four instruments and **no target**. Write down what number would count as working before the data arrives, or the data will be read to fit. |
| 196 | PD-27 | **keep** — *Next* | Cheap, obviously right, unblocks nothing but costs nothing. |
| 195 | PD-25 | **close — landed** | `Data.jsx:208–210` derives the figure from `shape.open_discrepancies`; the page reads "58, 11 still open" and matches the database. Verify and close. |
| 194 | PD-23 | **decline** | ~20 of 80 venues would carry it. It was proposed as the sober answer to a 3D instinct that was itself declined, and a column NULL for 75 % of rows is `DA-16`'s complaint arriving by the front door. Re-open only if a source reaches >50 venues. |
| 158 | PD-35 | **split** | Five unrelated proposals under one S. Team-mate head-to-head → its own S and *Now* (see PD-44). Grid penalties → S, *Next*. Tyre allocation, the lap-record sentence → *Someday*. Title permutations: already landed, strike it. |
| 155 | PD-29 | **keep** — *Next* | Half-landed; the `/data` sentence shipped, the race and season pages did not. See PD-52. |
| 127 | PD-30 | **split**, **re-rank down** | (a) grid-vs-finish is the only one of the three a reader looks at twice — keep as S/M in *Next*. (b) stint windows and (c) gap-to-pole are analyst charts on a site whose analysts have SQL — hold in *Someday* until PD-Ø says a reader looks at (a). |
| 120 | PD-17 | **keep** — *Next*; **re-rank up** | `permanentNumber` and `abbreviation` are prerequisites for PD-38's grid. Put it immediately in front of PD-38. |

### Other prefixes I have a view on

| # | ID | Verdict | Why |
|---|---|---|---|
| 222 | SD-14 | **re-rank to *Now*** | The only board item with a real deadline (the winter break) and the only one that makes the product *wrong* rather than incomplete. S. |
| 223 | SD-15 | **keep — *Now***; **merge #238 (UR-05) into it** | Same gap filed twice. Gates SD-18, gates any sponsorship, and is the whole of "reliable" that a reader can check. |
| 389 | SD-18 | **keep — *Now***; **unblock** | Its three blocking questions are answered by the maintainer's 2026-09-21 statement: an audience is wanted. The remaining gate is readiness, and readiness now means **PD-40 and PD-49 first** — the announcement's link lands on the static homepage, which today says 2025. |
| 392 | SD-21 | **keep**; **re-rank to *Now*** | Adopt the positioning. It is the one channel where "publishes its own reliability" is the ranking factor rather than a footnote, and the baseline probe is an afternoon. |
| 200 | DA-04 | **re-rank *Someday* → *Next*** | See PD-46. Filed as a schema nitpick; it is the dependency contract. |
| 249 | PM-17 | **re-scope L → M**; **re-rank *Someday* → *Next*** | Scoped as "classify each of 552 fields original / paraphrased / close-to-source" — *without* rewriting — it is an M and it is the input to PD-41, the biggest open decision. The rewriting half stays *Someday*. |
| 250 | PM-18 | **keep — *Someday***; **rewrite the trigger** | Correctly sized and deferred. Trigger becomes "a payment or sponsorship surface exists", not "money appears". |
| 251 | PM-19 | **keep**; **re-label blocked** | The radio quotations' reason for staying is explicitly conditional on non-commercial scope. Block it on PD-48. |
| 267, 241, 242, 244–247 | PM-07/08/09/10/11/15 | **hold — *Someday*** | Six L/M data-deepening items. Every one improves a product nobody has been told about; none of them changes who it is for. Do not start any before PD-Ø reports. |
| 218 / #119 | — | **verify closed** | `og:image` and `share-card.png` are present on every page; the generic-image half is now PD-45. |

---

## The top ten for the whole project, as product sees it

| # | Item | New? | Size | Why this, now |
|---|---|---|---|---|
| 1 | **PD-Ø** (#261) — measure, *with a target written first* | existing | S | Every other ranking is a guess until it reports. Decided; just do it. |
| 2 | **PD-40** — one homepage | **new** | S/M | The front door machines read says the newest thing here is 2025, and leads with the wrong claim. Must precede any announcement. |
| 3 | **SD-14** (#222) — the winter cron | existing | S | Has a date. Turns "reliable" into false. |
| 4 | **SD-15** (#223) + **UR-05** (#238) — name the publisher | existing, merge | S | Precondition for citation, announcement and every form of money. |
| 5 | **PD-41** — the licence decision | **new** | ? (decision; step (b) is S) | The only commercial decision with a clock. Relicense the project's own writing now; decide the rest deliberately. |
| 6 | **SD-18** (#389) — announce | existing | M | The measured constraint. After 2 and 4. |
| 7 | **PD-42** — milestones and on-this-day | **new** | M in 2×S | The answer to "dull" that a reference product can give. The competitor does it; the data is already here. |
| 8 | **PD-38** (#432) — finish the current-season area | existing | 4×S | The only surface that serves the fan, and half-built. |
| 9 | **PD-44** — head-to-head | **new** (split from #158) | S + M | The named first audience's actual job, absent from the product and from the queue. |
| 10 | **DA-04** (#200) — declare which ids are stable | existing, re-rank | S | The dependency contract for the audience the project says it wants. |

Just outside, and deliberately: **PD-45** (per-entity share cards, M) is the
cheapest distribution lever and only misses because it should follow the
announcement; **PD-43** (defer the download) is a genuine architectural
question that must wait for item 1; **SD-21** (#392) belongs at 6.5 and is
folded into the announcement.

**What I would stop doing.** There are 181 open issues and roughly 120 of them
are S-sized improvements to pages that, on the only measurement taken, nobody
has visited. The board's output rate is not the problem; its demand signal is.
Until item 1 reports, I would cap work on `DA-*`, `CR-*`, `VD-*` and `IX-*`
polish and spend the time on items 2–6, all of which are about being found and
being trusted rather than being better.

---

## What I did not examine

- **Mobile.** Everything above was driven at 1280×900. `IX-27` reports 632 px
  of every register row off screen on a phone; I did not confirm it, and if
  most arrivals are mobile then `IX-27` outranks several items in my ten.
- **The 21 page components individually.** I drove nine routes and read three.
  Findings about page types I did not open are not in here.
- **Two competitors.** chicanef1.com would not resolve and motorsportstats.com
  returned 403 from here. My competitive picture rests on F1DB (release API),
  StatsF1 (fetched), OpenF1 (fetched), Jolpica (fetched) and Forix (a landing
  page only). **If StatsF1 or a paid comparable already publishes a
  verifiability claim like this project's, finding 1's positioning argument and
  PD-51's form (2) both weaken considerably.** I saw no sign of it — StatsF1
  publishes no licence, no confidence model and no gap register — but I did not
  read it deeply.
- **The legal reading in PD-41.** I read CC BY-SA 4.0's database clause and
  compared it to the project's own ODbL reasoning. That is an informed reading,
  not advice, and the whole of PD-41 option (c) depends on it being right.
- **Whether the 2026 harvest keeps pace between rounds.** The build I drove was
  five days old with no race in between, so I could not observe a refresh.
- **Accessibility, contrast, microcopy, schema keys.** Other critics'.
