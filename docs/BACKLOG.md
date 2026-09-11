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

Short enough to be a decision rather than a list. Each item is a surface
contradicting something this project states in its own words.

Seven items, but **five jobs**: `PM-05` and `PM-25` are one investigation, and
`IA-02` and `PD-11` are one decision. Read it that way before concluding the
section has stopped being a decision.

Three of those jobs are also one defect wearing three faces: **an authored
figure that drifted from the database.** The README's table counts (`PD-07`),
the `records` leaderboards (`PD-03`) and the prerenderer's totals (`PD-02`)
each state a number a live query would supersede. The cure is the same every
time — derive the figure, then add a `verify.py` check so it cannot drift
again — so write that check pattern once and the third is nearly free.

`PM-05` sits beside them and is **not** one of them. Its fourteen rows are not
a figure that drifted: both sources are right about what they measure, and the
schema conflates *started first* with *was quickest*. That is a modelling fix —
one column split — and it **retires** a `verify.py` warning rather than adding
one. Do not expect the derive-and-check pattern to carry it.

*Re-checked against the committed `f1.db` on 2026-09-10 and all still true:*
`PM-05`'s 18 open discrepancies and the 14 that are one question (13 `pole
position` + 1 `grid position 1`); `PD-07`'s 46 tables / 38 views against a
README claiming 39 / 34, and 26,997 `qualifying` rows it calls absent;
`PD-03`'s Hamilton on 105 in `records` against 106 in `drivers`, all 30 rows at
`medium`, and no `verify.py` check reading the table. `PD-02`'s and the CD/IA
findings' counts were not re-checked.

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
      **Do it in one sitting with `PM-25`,** which is the same investigation
      seen from the other end: both turn on what `stored_value` and
      `derived_value` mean per row, and together they close all eighteen and
      retire a `verify.py` warning. — *project record · M*

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

- [ ] `PD-02` **Make the prerenderer call the page components' own queries.**
      Static and app emit different numbers under the same label — 14 of 38
      drivers with a stored `entries` disagree with the derived count, and the
      other 824 show an em dash statically and a real figure in the app. Then
      make `smoke.mjs` assert the *static* output against the database as it
      already does the app's, which is what would have caught this on the day it
      shipped. Two later findings have the same root cause and should ship
      with it rather than as separate passes: `CD-04` (the static half prints
      the numbers and deletes the rules for reading them) and `IA-03` (the app
      has no breadcrumb, the static page has no onward band). A third,
      `PD-06`, shares the *query* rather than the render: both turn on deriving
      `entries` and `starts`, so the register's two empty columns and the
      static/app mismatch are one fix seen from two ends. —
      *product critique · M*

- [ ] `PD-07` **Stop the README lying.** It claims 39 tables, 34 views, ~8,400
      rows against an actual 46 / 38 / 119,271, and says qualifying is "not held
      at all" when 26,997 rows are. Move the version log to `BUILD-NOTES.md`,
      then generate every count from the database and add a `verify.py` check
      that fails when a stated figure disagrees — the discipline
      `f1_compat.json` already gets. **`PM-02`, `PM-03` and `PM-04` ride with
      it:** the version log this moves into `BUILD-NOTES.md` is exactly what
      `PM-02` needs folded and `PM-03` needs repointed, and `PM-04` is the same
      front-door-is-wrong job one surface over. — *product critique · M*

- [ ] `PD-03` **Derive `/records`, or stop shipping it.** All 30 rows are
      authored, sit at `medium`, and nothing in `verify.py` reads the table; the
      page says Hamilton has 105 wins while `drivers.wins` says 106. Derive the
      leaderboards; keep only what genuinely cannot be derived, in a block that
      says so. `IA-16` examined the nav slot and endorsed keeping it — the page
      is the only cut by question rather than by table — and adds one thing: if
      the authored block survives as *Published, not derived*, it belongs
      **below** the derived leaderboards, because the derived ones are the
      demonstration and the authored ones are the caveat. —
      *product critique · M*

- [ ] `IA-02` **`Reference` leaves the masthead; `Data` takes the slot.**
      `/reference` is two drawers with no reader in common: a *database* drawer
      (`quality`, `sources`, `sql`) and a *sport* drawer (`eras`, `glossary`).
      The first one **is** the `/data` page `PD-11` wants, so these are one
      decision and the masthead stays at eight — Seasons · Races · Drivers ·
      Constructors · Circuits · Cars · Records · Data. `quality` and `sources`
      merge and move under it, `sql` moves under it; `eras` and `glossary` keep
      their URLs and lose the slot, their problem being that they are terminal
      rather than that they are drawered. Supersedes `PD-09`, which filed the
      same problem as an L: the redirects are the work, and the naming decision
      this costs at M is the one `PD-09` was waiting on. — *IA critique · M
      (decision first)*

- [ ] `PD-11` **Give the bulk data a front door, and a claim.** The Parquet
      bundle now builds and serves (`PM-01`) and is linked from nothing. A
      `/data` page in the masthead leading with the audited edition — 60 recorded
      disagreements, a confidence tier per row, a gap register, ~170
      cross-checks — which is a claim the upstream does not make.
      One implementation note: `prerender.js` writes `Disallow:` lines for
      `f1.db`, `f1.db.gz` and `f1-parquet.zip`, which is right — a crawler
      pulling 20 MB helps nobody — but it means the `/data` page itself has to
      be the crawlable surface that carries the claim, since the files it links
      never will be. Do `IA-02` first — it settles where the page goes and
      what it displaces — and take the claim from `CD-07`, which writes it. —
      *product critique · M*

## Next

Worth doing, not yet urgent.

- [ ] `PD-05` **Split `known_gaps` into open and closed.** Four of the eleven are
      closed or not gaps, and the homepage counts all eleven. Add a `state`
      column, filter the public page, and split each row into a reader sentence
      and a maintainer note — it currently renders commit messages.
      **`CD-06` makes it five, not four** — #1 and #2 are closed, #5 and #10 are
      positions rather than gaps, #8 is a true null belonging on one race page —
      so six genuine gaps remain and the homepage should read six. `CD-06` also
      carries the reader sentences and the maintainer notes this entry asks for.
      — *product critique · S*

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

- [ ] `PM-20` **Clear the two actionable `verify.py` data warnings.** Two
      qualifying rows have no matching race entry; three chassis are claimed as
      entered after their car's authored life ends (`ferrari-500`,
      `cooper-t51`, `lotus-25`). Both are genuinely small and can ride along
      with any data sitting. The centreline warning that used to sit here is
      now `PM-26`, because it is upstream data repair and was borrowing an S
      from its two small siblings. Of the three warnings left after those two,
      the 18-open-`discrepancies` one is not permanently expected either —
      `PM-05` and `PM-25` retire it; only the Nürburgring Südschleife and the
      unrun 2026 r17 sprint are. — *project record · S*

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

- [ ] `IA-01` **`grands_prix` has 53 rows, a view, and no page anywhere.**
      `Race.jsx:17` joins the table and `Race.jsx:440` prints the name as dead
      text, because there is nowhere to link it: no route, no prerendered page,
      no sitemap entry, no search row. The circuit page is not a substitute —
      **17 of the 53 Grands Prix used more than one circuit, covering 773 of
      1,172 races (66%)**, so the French Grand Prix is spread across seven
      circuit pages and reassembled nowhere. The clearest case on the site of
      the structure following the storage model rather than the reader. Goes at
      level two, reached from `/races`, the race page's Grand Prix field and the
      circuit page — three ways in, not a ninth nav item. — *IA critique · M*

- [ ] `CD-04` **The static half of the site prints the numbers and deletes the
      rules for reading them.** Every convention lives in a `DataTable` footer
      or a `Note`; `prerender.js` has neither construct. So the search arrival,
      the no-JS reader and the first seconds of every cold visit get shared
      drives with no note, em dashes with the explanation removed, and
      `Confidence: reference` as a bare fact on 695 driver pages. Three strings,
      one of which already exists at `App.jsx:88` and was simply not copied
      across. Ship with `PD-02`. — *content critique · M*

- [ ] `IA-03` **The app has no breadcrumb; the static page has no onward band.**
      Each renderer holds half the wayfinding and neither holds the other half,
      so orientation trades sideways the moment React takes over from the
      prerendered HTML. Ship with `PD-02`. — *IA critique · S*

- [ ] `CD-02` **111 driver ledes open with how the row got into the database.**
      `drivers.notes`, 111 of 244 rows, consumed as the page lede
      (`Driver.jsx:169`) and as the meta description (`prerender.js:645`):
      *"Added to the register from the podium harvest…"*. Chris Amon's meta
      description spends three sentences on provenance and truncates at 300
      characters exactly on *"Widely held to be the fi…"*. A data edit, not a
      code one — the good sentence usually already exists at the end of the
      string, and the provenance clause belongs in the "Where this comes from"
      section `Driver.jsx:373` already renders. — *content critique · S*

- [ ] `CD-03` **1,172 race pages have no standfirst.** `races.note` is NULL on
      every one of the 1,172 rows, so `lede={race.note}` is dead code and the
      largest page type opens with no sentence — while `prerender.js:480-482`
      already composes a serviceable one for the meta description and does not
      put it on the page. Render it in both, from the same expression. —
      *content critique · S*

- [ ] `CD-05` **`PD-12` answered.** The lap-timing position is written, in three
      lengths, with the four places each goes. Lands with `PD-12`; no research
      left in it. — *content critique · S*

- [ ] `CD-06` **`PD-05` answered, and the count corrected.** `PD-05` says four of
      the eleven `known_gaps` are closed or not gaps; the content critique makes
      it **five** (#1 and #2 closed, #5 and #10 are positions rather than gaps,
      #8 is a true null belonging on one race page), leaving six genuine open
      gaps — so the homepage's "11 known gaps" (`Home.jsx:233`) should read six.
      Six reader sentences and eleven maintainer notes are written out. —
      *content critique · S*

- [ ] `CD-07` **`PD-11` answered: what `/data` claims.** One adversarial
      sentence that survives the reader thinking *"I already have F1DB"* —
      **The Formula One record, audited** — with the supporting block. Lands
      with `PD-11`/`IA-02`. — *content critique · S*

- [ ] `CD-08` **`PD-10` answered: the citation block, verbatim.** It belongs
      inside the "Where this comes from" section that `Race.jsx:437` and
      `Driver.jsx:334` already render, not as a new component at the foot of the
      page. Lands with `PD-10`. — *content critique · S*

- [ ] `CD-09` **The glossary defines the sport's vocabulary and not the
      product's.** 44 terms — Apex, Bargeboard, Porpoising — all correct, none
      of them the words a newcomer trips on *here*. DNQ, NC, FL and the
      confidence tiers appear in table cells with no definition anywhere on the
      site. — *content critique · M*

- [ ] `CD-10` **The confidence pill is a bare word on 13 pages.**
      `Page.jsx:110-115` renders `<span class="pill">{value}</span>` with no
      `title`, no link, no explanation, while the ladder that defines it is one
      nav item and two clicks away. Reach without a definition at the point of
      use is how a reader learns that "medium" means the site is unsure of
      itself rather than that an exact figure may have drifted. —
      *content critique · S*

- [ ] `CD-13` **The site states a cause the database does not hold.**
      `Race.jsx:204` and `prerender.js:543` render *"started P4, after a grid
      penalty"* wherever the fastest qualifier did not start first. The database
      records that the two differ, not why. — *content critique · S*

- [ ] `CD-15` **`./f1 gaps` prints "what the data does not yet cover", then
      three entries beginning "CLOSED".** `CD-06`'s defect on the surface the
      bulk-data audience actually touches; must filter on `PD-05`'s `state`
      column when it lands. — *content critique · S*

- [ ] `CD-16` **The README's first sentence defines the product by its own
      history.** *"An expansion of the original single-file JSON into…"* — a
      reader arriving at the repository does not know there was a single-file
      JSON and does not care. `PD-07` already moves the version log out; this is
      what should replace it, in `CD-07`'s claim in repository voice. —
      *content critique · S*

- [ ] `IA-05` **Search cannot find a car by the name anyone would type.**
      `Search.jsx:29` indexes chassis on `chassis.name`, which is the bare model
      number, so "Ferrari 312" returns nothing. Fix what it indexes; do not
      build full-text. — *IA critique · S*

- [ ] `IA-06` **Six of the most famous cars in F1 have two URLs each and are
      absent from search.** Six `cars` ids that no chassis owns — `alfa-158`,
      `brawn-bgp001`, `lotus-72`, `mercedes-w05`, `mercedes-w11` and one more —
      reachable at two paths, indexed at neither. — *IA critique · S*

- [ ] `IA-07` **The SQL console has no permalink.** `Sql.jsx` holds the query in
      `useState` — no `useSearchParams`, no hash — so a query cannot be shared,
      bookmarked or cited on a site whose stated ambition is to be cited. —
      *IA critique · S*

- [ ] `IA-12` **The glossary is terminal.** 44 terms, linked from three places
      in `web/`, and the terms it should serve are undefined at the point they
      appear. Content design owns the wording (`CD-09`); this is the placement
      half. — *IA critique · S*

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

- [ ] `PM-26` **Three centrelines do not close into a loop.** Monaco has 4
      loose ends, Montjuïc 2, Las Vegas 1 — genuine 5.4–63.4 m holes in the OSM
      trace, so this is upstream data repair rather than a check to satisfy.
      Split out of `PM-20`, which was sized S on the strength of its two small
      siblings and could not carry this. Sits beside `PM-08`: both are geometry
      work the existing guard rails already constrain once rows exist. —
      *project record · M*

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
      provenance page to the masthead. Needs redirects and a naming decision.
      **Superseded by `IA-02`**, which makes the naming decision this was
      waiting on and costs the rework at M. — *product critique · L*

- [ ] `PD-08` **Decide what the atlas is for.** Genuinely excellent, covers 25 of
      80 circuits, has no named audience, and nothing measures whether anyone
      opens it. Not a task until there is a way to answer the question. —
      *product critique · ?*

- [ ] `IA-08` **No filter or sort state is in any URL, anywhere.** Zero hits for
      `useSearchParams`, `URLSearchParams` or `location.search` across
      `web/src/`, so no register's filters, chips, sort column, direction or
      page can be linked or restored. Sized M and worth doing after `IA-02`
      settles the structure it would encode. — *IA critique · M*

- [ ] `IA-09` **The eyebrow above every `h1` means four different things.** One
      slot in one position on every page, carrying four unrelated kinds of
      value. — *IA critique · S*

- [ ] `IA-10` **One label for four destinations.** `back={{ label: 'The
      register' }}` on drivers, constructors, circuits and cars — four
      destinations, one string, none of them naming where it goes; and "Car" has
      three referents. — *IA critique · S*

- [ ] `IA-11` **The two longest registers are the two with no time axis.** —
      *IA critique · S*

- [ ] `IA-13` **`/reference/eras` renders nine tables under a two-word label.**
      Eras, engine formulae, scoring systems, regulation changes and limits,
      technical innovations and more. Falls out of `IA-02` if that is done
      properly. — *IA critique · S*

- [ ] `IA-14` **The masthead nav overflows silently on a phone, tail-first.**
      `app.css:302-319` makes it a horizontally scrolling strip with the
      scrollbar hidden below 720px, so the last items are reachable only by a
      gesture with no affordance. The measurement is inference — confirm on a
      device before sizing. — *IA critique · S*

- [ ] `CD-11` **Meta descriptions at scale read as schema output.** Generated at
      `prerender.js:645`: *"Adolf Brudes, Germany, Formula One 1952-1952. 0
      wins, 0 poles."* — and "0 wins, 0 poles" on 618 pages, where the site's own
      convention is that a blank is not a zero. — *content critique · S*

- [ ] `CD-12` **One concept, several words.** Out/Status is the instance where
      the two renderers actually disagree; the rest is consistency. —
      *content critique · M*

- [ ] `CD-14` **The homepage explains four conventions and there are seven.**
      `Home.jsx:204-238` covers the em dash, disagreements, the ladder and the
      gaps, and omits the three most often read as bugs: a repeated finishing
      position, a pre-1991 margin, and a stored figure shown beside a derived
      one. Not three more panels — six is a wall — but a change of framing so
      the section is a door. — *content critique · S*

- [ ] `CD-17` **Error and empty states: an inventory.** Written out in the
      critique with a verdict each. Two worth acting on: the boot-failure copy
      addresses the wrong audience, and `DataTable`'s default *"Nothing
      recorded."* is a strong claim to make by default on a site where a blank
      means *not established*. — *content critique · S each*

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
      `/data`, which is `IA-02` and does not exist yet. — *IA critique ·
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
