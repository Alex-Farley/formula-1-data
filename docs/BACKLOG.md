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
| `CR-n` | code review (whole-codebase engineering review) |

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

This is also the **only** queue. An agent working unattended starts here,
reassesses an item against the repository as it is now before touching it —
items go stale, land under other IDs, or get superseded — and files anything it
discovers back here under these conventions. The process around that is in
`CONTRIBUTING.md` under *Working autonomously*.

---

## Now

Short enough to be a decision rather than a list. Each item is a surface
contradicting something this project states in its own words.

*Re-ranked 2026-09-11 after eight reviews in one day — code, product (second
run), visual, interaction, data architecture, service, accessibility and a
user-research walkthrough — filed in `docs/critiques/2026-09-11-*.md`, 142
findings. Their agreement was unusual: every discipline that looked at the
cold first visit found the same defect, every one that looked at 3D circuits
declined it, and four of them independently found that the site states
something false rather than merely something thin. Those come first.*

**The one decision is made.** The repository stays private (`PD-14`, decided
2026-09-11 — see *Declined*). The claim therefore changes from *audited, and
you can audit the audit* to *cross-checked against independent sources, with
every disagreement and every gap published in the data* — which the artefact
supports on its own. `AF-02` carries the three follow-ons.

**The false statements** the reviews found are all landed: `UR-01`, `UR-02`,
`UR-10`, `UR-11` in #36, `CR-02`/`DA-01` in #39, `SD-02` in #40; the cold
first visit (`IX-01`, `IX-02`, `IX-03`, `IX-13`) landed in #37. `PD-02` is still the
largest single fix and still has its riders.

- [ ] `IX-04` **One careless query in the SQL console kills the site for the
      session.** A three-way self-join occupies the single worker forever; no
      cancel, no timeout; navigate away and every register shows a skeleton
      that never fills, with no message. A Cancel button that terminates the
      worker and reopens from IndexedDB (0.8 s measured). —
      *interaction critique · M*

- **Four accessibility fixes in under an hour** (`AX-08`, `AX-05`, `AX-03`,
      `AX-04`), filed individually under *Next* and gathered here because they
      are the cheapest AA failures on the site: `scroll-padding-top`, one line
      (Shift+Tab hides the focused link behind the masthead); one token
      (`--ink-faint` fails 4.5:1 on three of the four light surfaces it sits
      on — the entire automated finding); focus the `h1` on navigation, one
      line in `Page`; `role="status"` on the two result counts. —
      *accessibility critique · S*

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
      **Now seven riders**, all the same defect on other faces: `VD-01` (the
      static half is a *different design*, 126 lines of its own CSS), `UR-06`
      (no prerendered page carries the version or build date), `UR-13` (the
      2026 season's static page opens with five em dashes), `AX-17` (no static
      table has a caption), plus `CD-04`, `IA-03` and `PD-06` as before.

- [ ] `PD-07` **Stop the README lying.** It claims 39 tables, 34 views, ~8,400
      rows against an actual 46 / 38 / 119,271, and says qualifying is "not held
      at all" when 26,997 rows are. Move the version log to `BUILD-NOTES.md`,
      then generate every count from the database and add a `verify.py` check
      that fails when a stated figure disagrees — the discipline
      `f1_compat.json` already gets. **`PM-02`, `PM-03` and `PM-04` ride with
      it:** the version log this moves into `BUILD-NOTES.md` is exactly what
      `PM-02` needs folded and `PM-03` needs repointed, and `PM-04` is the same
      front-door-is-wrong job one surface over. — *product critique · M*
      **`PD-24`/`CR-08` landed in #45**: `meta.coverage_note` is now derived from
      the counts and compared whole by `verify.py`; the README is the surface
      left, and the check count is still stated seven ways (`CR-09`).

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
      **`UR-09` adds the cheap half**: the caveat sentence sits 1,900 px below
      the figure it caveats; move it above the published table today. `VD-10`
      and `VD-13` are the same page's badge column and misaligned values.

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
      **Now the canonical distribution surface** (`SD-08`): all four served
      artefacts, sizes, digests from `db-manifest.json`, the build date, the
      release body's which-copy-wins sentence, `schema.org/Dataset` markup
      (`SD-11` — the one search surface built for this audience), and the
      publisher block `UR-05`/`SD-15` ask for. The disagreements claim in
      `CD-07` must change: 45 found, 44 resolved on the record, one open
      (`PD-25`).

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
      from its two small siblings. The open-`discrepancies` warning that
      used to sit beside them reads one row rather than eighteen since
      `PM-05` and `PM-25` (1970 r1, a genuine source disagreement); of the
      warnings left after these two, only that one, the Nürburgring
      Südschleife, the unrun 2026 r17 sprint and `PM-26`'s centrelines are
      expected. — *project record · S*

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

- [ ] `AF-01` **Say when a race ends and whether it happened.** Search Console
      (11 Sep 2026) reports seven non-critical *Events* issues against the
      `SportsEvent` markup every race page emits at `prerender.js:499`, and
      names five: `endDate`, `eventStatus`, `organizer`, `performer`, `offers`.
      Two are facts the database already holds and should simply be emitted.
      `endDate` is the same `date_iso` that already feeds `startDate` — a Grand
      Prix is a one-day event, and the weekend range in `dates` is the display
      value the comment there rightly refuses to parse. `eventStatus` is
      `EventScheduled` on every row, because `races.status` only distinguishes
      run from not-yet-run and neither is cancelled or postponed. `organizer`
      is also true — the FIA sanctions every championship round — but is held
      nowhere in the database, so if it goes in it is a documented constant,
      not a string typed into the prerenderer. **Decline `performer` and
      `offers`.** Nothing here sells a ticket, and an invented offer is false
      structured data, which Google treats as a policy violation rather than a
      warning; and naming the drivers as `performer` is a reading of the schema
      no reader of a 1950 results page would recognise. Google's Event rich
      result exists for upcoming ticketed events, so of 1,172 pages only the
      ten scheduled 2026 rounds can ever earn one, and the warnings do not
      affect ranking — which is why this is S and *Next*, not *Now*. Two things
      to check while in there: Las Vegas 2026 carries `dates` "19–21 Nov" but
      `date_iso` 2026-11-22, so the ISO date sits outside the display range on
      the one page a ticket-holder would search; and `smoke.mjs:866` asserts
      JSON-LD on a driver page only, so a race page's markup has no test. —
      *Search Console report · S*

### Filed 2026-09-11 — the eight reviews

Compact by design: the reasoning and the evidence are in `docs/critiques/2026-09-11-*.md` under the same ID. Items already in *Now* are not repeated.

- [ ] `CR-21` **Two harvest files fill columns and have no floor.** Deleting
      `harvest/car_specs.txt` (649 lines) or `harvest/article_images.txt`
      (607) builds and verifies clean. Found by the review of `CR-01`, which
      floored the seven bulk tables. A floor on the count of non-NULL
      `chassis.weight_kg` and of `article_images` rows would do. — *code
      review of #42 · S*

- [ ] `AF-02` **Keep the audit claim honest with a private repository.** Three
      S pieces. (1) Publish the checks' *results*, not the code: a served
      `checks.txt` or `/reference/checks` listing each `verify.py` check by its
      sentence-length name and its PASS/WARN on the deployed build — the names
      already read as claims. (2) Serve `schema.sql`, `ATTRIBUTION.md`,
      `LICENSE-DATA` and `SHA256SUMS` from lapledger.org, since the release page
      is unreachable and the artefacts are published from the site; the digest
      still lets a reader confirm the file they hold is the one published, even
      without a rebuild. (3) Reword: drop "anyone can rebuild and compare" from
      the release body and README; say on `/data` that the data is CC BY-SA, the
      build is not published, and here is what can be checked and how. `SD-01`'s
      two follow-ons fold in here. — *yours · S each*

**Code review**

- [ ] `CR-03` **Nothing tests the checks.** 184 assertion sites in `verify.py`, zero tests that any fires on bad data; `tests/` covers six pure functions. `tests/test_verify.py`: build once to a temp path, one mutation per test, assert the *named* check fails. Six tests cover the licence gate. — *code review · M*

- [ ] `CR-07` **The season is a magic number in nine files.** `2026` 158 times; no `CURRENT_SEASON`. S for the constant, then one file per sitting. `SD-12` is the service face. — *code review · M*

- [ ] `CR-09` **The check count is stated seven ways, none right.** 121, 133, 143, 158, 170, 171, ~170; runtime 209. Remove every number or print it from `verify.py`. — *code review · S*

- [ ] `CR-13` **`npm run build` runs `pip install` on any machine, and CI never checks the Parquet result.** Gate the install behind `CI`/`CF_PAGES`; `cat dist/build-status.txt && test -s dist/f1-parquet.zip` in `ci.yml`. Answers half of `PM-24`. — *code review · S*

- [ ] `CR-14` **No local command reproduces CI.** `make ci` doing what `ci.yml` does, diff included; point `CLAUDE.md` at it. — *code review · S*

- [ ] `CR-16` **`node:sqlite` needs Node ≥ 22.5 and nothing says so.** `engines` in `web/package.json`, or `.nvmrc`. — *code review · S*

**Product critique, second run**

- [ ] `PD-15` **The driver stat strip is designed for a champion and rendered for a privateer.** 625 of 862 pages show four zeros. Show Wins/Podiums/Poles/FL only where one is non-zero; fill from Best grid, Starts, Retirements, Laps, Constructors — all one `SELECT` away. One tile per sitting. — *product critique · M*

- [ ] `PD-16` **618 driver pages have no opening sentence.** `notes` on 244 of 862. Generate a lede from the entry record in both renderers from one expression; keep `notes` as the override. The largest "look nicer" available and it is SQL. — *product critique · M*

- [ ] `PD-17` **F1DB publishes six driver fields the harvest discards.** `placeOfBirth`, `abbreviation`, `permanentNumber`, `bestStartingGridPosition`, `totalRaceLaps`, `familyRelationships` — CC BY 4.0, already fetched in part. The last two arrive as cross-checks. — *product critique · S*

- [ ] `PD-19` **731 chassis pages carry a photograph and no static page carries an `<img>`.** Emit the image from `prerender.js` with `CommonsCredit`'s fail-closed rule honoured, and extend `smoke.mjs`. `UR` found the app already places it second on the page; the static half has none. — *product critique · S*

- [ ] `PD-20` **No `og:image` on any of 3,515 pages.** Every shared link renders as a grey box. Confirmed car photo where `name_matches = 1`; a generated SVG card elsewhere; `summary_large_image`. Four of six personas arrive this way (`UR`). — *product critique · S*

- [ ] `PD-21` **`PD-08` answered: the atlas is a comparison surface, arranged as the opposite.** Three S pieces: address it (`/circuits/atlas/:id` — all 25 inbound links land on Spa today); invert the page so the true-scale wall leads, at a width where the cells can be read (`UR`: 29–97 px today); state the selection rule (Silverstone, 61 races, untraced; Donington, 1, traced). — *product critique · M*

- [ ] `PD-22` **The atlas is the only page type with no prerendered content.** Prerender the 25 shapes as static SVG; the geometry is already read by `prerender.js`. `AX-09`'s banded-runs table answers 1.1.1 at the same time. — *product critique · S*

- [ ] `PD-23` **Elevation as a fact, not a rendering.** Add `elevation_change_m` to `circuits` from the Wikipedia article each already cites, for the ~20 venues that state one. The Lap Ledger-shaped answer to the 3D instinct — see *Declined*. — *product critique · S*

- [ ] `PD-25` **The disagreements claim is now one open row, and that is the better claim.** 45 found, 44 resolved on the record, one open. Change `CD-07`'s wording before `/data` ships. — *product critique · S*

**Visual design**

- [ ] `VD-01` **The static half is a different design.** 126 lines of `#prerendered` CSS, a second `h1` treatment, tiles versus a key/value table. Rides with `PD-02`: emit the components' shapes, not just their numbers. — *visual critique · M*

- [ ] `VD-03` **No type scale and no spacing scale in the token file.** Nineteen literal font sizes, twenty-seven spacing values. Add `--size-n`/`--space-n` and convert one file per sitting. — *visual critique · M*

- [ ] `VD-07` **The result rail's middle two bands are the same lightness.** `--rail-points` vs `--rail-classified` 1.05:1 in light, 1.07:1 in dark — measured against the panel, never against each other. Separate by lightness. — *visual critique · S*

- [ ] `VD-08` **The livery-band explanation is 10.5 px mono across 175 characters.** The sentence that carries the racing-colour decision, set smaller than a footnote. `--sans`, 13 px, under the swatch, within `--measure`. — *visual critique · S*

- [ ] `VD-10` **Thirty identical `MEDIUM` badges on `/records`, ten on `/reference/eras`.** `/cars` already states the rule against this. Say the tier once in the note and drop the column. — *visual critique · S*

- [ ] `VD-11` **The confidence ladder is drawn without rungs.** Three middle tiers pixel-identical. Step them on border weight, not hue. — *visual critique · S*

- [ ] `VD-12` **The circuit page shows the flattest drawing of the best asset.** Render `/circuits/:id` with the atlas's renderer — radius bands, start marker, direction. One component, one call site; most of the "look nicer" the author wants, and every pixel a fact. Declines 3D (see *Declined*); an elevation *profile strip* under the plan map if `PD-23` ever yields a source. — *visual critique · M*

- [ ] `VD-13` **`/records` right-aligns scalars and phrases in one column.** Split into numeric and qualifier, or left-align. After `PD-03`. — *visual critique · S*

- [ ] `VD-14` **Wide tables clip at the container edge on a phone with no affordance.** Seven of nine `/drivers` columns invisible at 375 px. A right-edge fade on `.table-scroll` when scrollable. — *visual critique · S*

- [ ] `VD-15` **Column headers are 9.5 px.** Uppercase mono at 9.5 px carries the sort control. 10.5–11 px; pin it in `VD-03`'s scale. — *visual critique · S*

- [ ] `VD-16` **Prose in table cells ignores the measure.** 128-character lines on `/reference/sources`. `max-width: 60ch` on prose cells. — *visual critique · S*

- [ ] `VD-17` **The pale end of the sequential ramp is 1.99:1 against its stage.** Darken `--seq-1` in light; make the legend a continuous bar. `AX-07` is the same finding as a WCAG failure. — *visual critique · S*

- [ ] `VD-18` **The fastest-lap mark ignores the accent's stated meaning.** `tokens.css` says accent means *this was fastest*; the FL bullet is body ink. `AX-12` owns the markup half. — *visual critique · S*

- [ ] `VD-19` **The SQL console clips its own example query.** Size the textarea to the loaded query's lines. — *visual critique · S*

- [ ] `VD-20` **A loading photograph and an absent one look the same.** And each thumbnail is three redirects. Distinguish the states; consider the resolved `upload.wikimedia.org` URL in the harvest. — *visual critique · S*

- [ ] `VD-21` **`web/README.md` describes a mark the site does not ship.** 3×2 in the doc, 4×4 in `index.html`. Fix the paragraph. — *visual critique · S*

**Interaction design**

- [ ] `IX-05` **Search ranks by name length, so 11 of the 25 winningest drivers are not the first hit for their surname.** Duncan over Lewis Hamilton, Ralf over Michael Schumacher; Enter opens the first. Add a prominence term (`wins`, `races`) before the length tie-break. — *interaction critique · S*

- [ ] `IX-06` **Accented names are findable by one spelling only, in both directions.** "frere" finds nothing; "Räikkönen" finds nothing. Fold diacritics on both sides. Ship with `IX-05`/`IX-07`. — *interaction critique · S*

- [ ] `IX-07` **Search wants the reader's words in the database's order.** "monaco 1996" finds nothing; "1996 monaco" works. Tokenise the needle. — *interaction critique · S*

- [ ] `IX-08` **The atlas marker travels the wrong way round two circuits and starts nowhere.** Baku and Long Beach walk against `circuits.direction`; `0 m` is an arbitrary OSM way boundary. Reverse the ring on shoelace sign; say "along the trace", not a lap position. — *interaction critique · S*

- [ ] `IX-09` **Dragging the scrubber says nothing the page has not said.** Put the band at the marker into the `<output>` — "1,240 m · hairpin, 38 m" — from an array the component already holds. — *interaction critique · S*

- [ ] `IX-11` **Clicking a worked example destroys the reader's query with no undo.** Write through `execCommand('insertText')` so ⌘Z works. — *interaction critique · S*

- [ ] `IX-15` **`IA-14` measured.** Four of eight nav items off-screen on an iPhone 13, five on an SE; keyboard reaches them, pointer has no affordance. Size `IA-14` as filed. — *interaction critique · S*

- [ ] `IX-16` **`IA-08` escalated: Back restores the scroll and not the filter.** France filter, sort by wins, scroll, open a driver, Back — same pixel, 862 unfiltered rows. Do `/drivers` first. — *interaction critique · M*

**Data architecture**

- [ ] `DA-01` **`standings` has no key and `as_of` carries four meanings.** Rungs one and two ship with `CR-02`. Rung three: a `basis` column (`running`/`final`) and `after_round` filled on every row. Rung four is a decision: retire `as_of`. **Rungs one and two landed in #39** — the view and the expression index — with checks on both halves of the fold. Two things the review found for the rungs still open: the fill takes `MIN(id)` from the other source, so if a multi-source season ever holds a two-entry source (2018 Force India's shape, in 2026's situation) one entry would vanish — unreachable today, and the row-count check would refuse it; and on a points tie the view keeps formula1.com, so 2026's `as_of` column mixes `current` with the dated snapshot. — *data architecture critique · M, then a decision*

- [ ] `DA-02` **Constructor lineage has no time dimension.** 283 entries land in chains whose timelines exclude them — Renault's 1977–85 turbo wins on Enstone. `constructor_id` on `constructor_lineage` (54 of 66 match by name), a `verify.py` interval check that fails today, then deprecate `constructors.lineage_chain`. — *data architecture critique · M*

- [ ] `DA-03` **"May I publish this row?" is not a query.** No `source_id` on any fact table; resolution is Python regexes. Add `source_id` to the 22 tables with `source`, then `v_row_licence`. `PM-14`'s first column, worth shipping alone. — *data architecture critique · M, S first*

- [ ] `DA-04` **Surrogate ids moved on 17% of `race_entries` between v2.20 and v2.21, and nothing declares which ids are stable.** A decision: publish the policy (natural keys stable, surrogates not) — S — or order inserts deterministically and check against the previous release — M. `known_gaps` needs a stable `key` either way. — *data architecture critique · decision*

- [ ] `DA-05` **The `reference` tier's published definition is wrong for 96% of its rows.** Says Wikipedia; 91,407 of 94,957 are F1DB. 0.16 bits of information in the column. Rewrite the definition; check named sources against cited ones. The primitive question is `PM-15`/`PM-16`, in that order after `DA-03`. — *data architecture critique · S*

- [ ] `DA-06` **Two-thirds of the schema's prose does not ship.** SQLite keeps the text from `CREATE`; 298 of 448 comment lines — including this week's `WHAT 'POLE' MEANS HERE` — are above it and lost. Move each block inside the parentheses. Confirm byte-stability after. — *data architecture critique · S*

- [ ] `DA-08` **Nothing scores zero, except in the one table where everything does.** 8,107 classified finishers with NULL `points`, zero rows with `points = 0`; `standings` has 3,489 zeros. A data decision: write `0` where the era's system paid nothing. `CD-01`'s defect one column over. — *data architecture critique · S, decision first*

- [ ] `DA-09` **`discrepancies` is the least-modelled table and the one the project originates.** Four subject formats, three field vocabularies, free-text status, the string `'NULL'` on 23 rows; 152 chassis published-vs-derived differences recorded nowhere. `(tbl, row_key, field)` and a constrained `status` — `PM-14` rehearsed on 45 rows. — *data architecture critique · S*

- [ ] `DA-10` **`standings.entity_id` is a polymorphic key over two colliding namespaces.** Four ids exist in both `drivers` and `constructors`; the naive join returns 517 wrong rows; `entity` disagrees with `full_name` on five. Split into `driver_id`/`constructor_id` with a CHECK. Rides with `DA-01`. — *data architecture critique · S*

- [ ] `DA-11` **`standings.engine_id` is F1DB's namespace under this project's column name.** 10% resolve against `engine_manufacturers` by coincidence. Rename to `f1db_engine_manufacturer_id` or add the curated id beside it. — *data architecture critique · S*

- [ ] `DA-13` **One CHECK constraint in forty-six tables, and the vocabularies have drifted.** `anticlockwise` beside `anti-clockwise`; 18 `personnel.role` values for four documented; a licence guard on `article_images.repository` in prose only. Eight CHECKs and one data fix. **Eight of the vocabularies landed as `CHECK` constraints in #47** — `authority`, `drivers.status`, `table_type`, `circuit_type`, `direction`, `article_images.repository`, `races.status`, `regulation_changes.category` — and Jacarepagua's `anticlockwise` is fixed. Left open: `aspiration` (four tables, two vocabularies), `personnel.role` and `team_radio.speaker` (multi-valued in the data), and the lookup-table question for `authority` and `circuit_type`. — *data architecture critique · S*

- [ ] `DA-14` **The views reach 29% of the rows and ship in one of three formats.** No view over `standings`, `qualifying`, `sprint_results`, `pit_stops` or provenance; Parquet and JSON carry no views. `v_standings_final`, `v_race_classification`, `views.sql` in the zip, a which-download table on `/data`. — *data architecture critique · M*

- [ ] `DA-15` **`dates` is a display column for 2% of rows and a duplicate for 98%.** Replace with `date_from`/`date_to`; makes `AF-01`'s Las Vegas mismatch checkable. — *data architecture critique · S*

- [ ] `DA-16` **Fourteen columns are NULL in every row, and `known_gaps.races_affected` is 0 on 10 of 11.** Drop or document the structural empties; mark derived columns in `drivers`; fill or delete `races_affected`. `PD-06` and `CD-03` ride. — *data architecture critique · S*

- [ ] `DA-17` **A season's points live in two tables and nothing says so.** 40 driver-seasons disagree until `sprint_results` is added; Verstappen 2023 by 21. One view or one inline comment. — *data architecture critique · S*

- [ ] `DA-18` **`points_systems` holds two grains under one interval.** Sprint rows distinguished by a `SPRINT:` prefix; `'None'` the string beside SQL NULL. A `session` column. — *data architecture critique · S*

- [ ] `DA-19` **`records` cannot be joined, compared or checked.** 24 forms of `as_of` in 30 rows. Only after `PD-03`: `holder_id`, a numeric `value`, an ISO `as_of`. — *data architecture critique · S*

- [ ] `DA-20` **`constructors.last_entry` says NULL means still competing; ten NULLs last raced 1951–1997.** Fill the ten or fix the comment. The seven spellings of a validity interval are the M and optional. — *data architecture critique · S*

**Service design**

- [ ] `SD-01` **The data is published; everything that explains it is not.** The service face of `PD-14`. Its two S follow-ons — serve the licence files from the site; set `homepageUrl` and topics — stand whichever way the decision goes. — *service critique · S*

- [ ] `SD-04` **There is no inbound channel.** No contact, no report link, zero issues ever. One footer line; then the 18 pages showing an open disagreement get the link specifically. — *service critique · S*

- [ ] `SD-06` **Nothing distinguishes a current service from a frozen one.** Build logs off, last-good deploy kept, `build-status.txt` written by the build that failed to replace it, 3,515 identical `lastmod`s. Build date in the *static* footer; make `build-status.txt` a heartbeat. — *service critique · S*

- [ ] `SD-07` **`meta.version` does not identify the data.** From the first refresh, `2.21` names three different databases. Bump the patch on refresh, or declare digest + `built` the identity and say so in the citation block. — *service critique · decision, S*

- [ ] `SD-08` **The documented channel is stale and the fresh one is undocumented.** Folded into `PD-11`. — *service critique · S*

- [ ] `SD-09` **The artefacts document themselves and no public surface says so.** Three clauses after "open it with any SQLite client": `sqlite_master`, `meta`, `source_registry`. Highest value per word here; cannot go stale. — *service critique · S*

- [ ] `SD-10` **The only public mention of the Parquet bundle is a `Disallow:` line.** Rides with `PD-11`; one comment line in `robots.txt` today. — *service critique · S*

- [ ] `SD-11` **No `schema.org/Dataset` markup.** Every field is held. On `/data`. The one discovery surface built for the bulk audience. — *service critique · S*

- [ ] `SD-12` **"1950–2026" is typed 29 times across four channels.** Derive one string at build time into `meta.coverage_seasons`; read it in both renderers. Removes 12 of 29; the rest is `SD-15`'s runbook. The build half landed with `SD-02`: `meta.coverage_seasons` is read off the season register. — *service critique · M*

- [ ] `SD-13` **The advisory review check has been red through four merges.** Known cause: the other account is out of tokens. `continue-on-error: true` so the plumbing is not the signal. — *service critique · S*

- [ ] `SD-14` **GitHub will disable the schedule in the winter break.** 60 days idle; the break is ~90. Season-start runbook, item one. — *service critique · S*

- [ ] `SD-15` **No public surface says who runs this, how often, or what happens if he stops.** Four paragraphs; the fourth has an unusually good answer (pure function of public sources, `SHA256SUMS`). `PD-13`'s reader-facing half; `UR-05` is the same gap from use. — *service critique · S*

- [ ] `SD-16` **The licence statement does not follow the file.** `LICENSE-DATA` omits the Parquet zip; `robots.txt` leaves the one ODbL file crawlable; `meta.apply` names an unreachable tool. Folds into `PM-23`. — *service critique · S*

- [ ] `SD-17` **`docs/GITHUB-SETUP.md` documents a repository that no longer exists.** Delete, or reduce to the description and topics `SD-01` needs; add a six-line `docs/README.md`. — *service critique · S*

**Accessibility** — each marked WCAG failure (criterion) or usability.

- [ ] `AX-02` **The search palette is not modal and not a listbox. 4.1.2, 2.4.3.** Shift+Tab leaves it despite `aria-modal`; no `activedescendant`; Escape drops focus to `<body>`. Three S pieces. — *accessibility critique · M*

- [ ] `AX-06` **White on `--accent` is 3.34:1 in dark — the Run button. 1.4.3.** Dark foreground on the fill. — *accessibility critique · S*

- [ ] `AX-07` **The atlas ramp and one light chart series are under 3:1. 1.4.11.** `--seq-1` 1.99:1; no two bands 2:1 apart; `--series-3` 2.65:1. Same fix as `VD-17`. — *accessibility critique · S*

- [ ] `AX-09` **The atlas is the one graphic with no table of its numbers. 1.1.1.** A banded-runs table from `cornerRadius`/`stitch`; answers `PD-22` too. — *accessibility critique · M*

- [ ] `AX-10` **Three routes scroll the body sideways at 320 px. 1.4.10.** Atlas 107 px, Spa's layouts table 41 px, SQL example 24 px. — *accessibility critique · S*

- [ ] `AX-11` **Heading names concatenate without spaces. 2.4.6, 1.3.1.** "Original road circuit1950–197014.1 kmmedium". A space, or move the count out of the heading. — *accessibility critique · S*

- [ ] `AX-12` **The FL column is a bullet with no alternative; the rail is an empty cell named "Result" on every row. 1.1.1.** `sr-only` text and an `<abbr>`; `aria-hidden` on the rail. — *accessibility critique · S*

- [ ] `AX-13` **Photograph `alt` is the file name, ".jpg" included. 1.1.1.** `Cars.jsx` already does it right. — *accessibility critique · S*

- [ ] `AX-14` **Chip filter groups have no name. 1.3.1, 4.1.2.** `role="group"` + `aria-label` on `Chips`. — *accessibility critique · S*

- [ ] `AX-15` **`/` is a global single-key shortcut with no off switch. 2.1.4.** Drop it for ⌘/Ctrl+K, or add a toggle. — *accessibility critique · S*

- [ ] `AX-16` **A dropped end label leaves one line identified by colour alone. 1.4.1.** Stroke-dash per series, echoed in the legend. — *accessibility critique · S*

- [ ] `AX-17` **Five registers and the SQL console render their table with no caption; the static half has none anywhere.** A `caption` prop at six call sites and in `prerender.js`. — *accessibility critique · S*

- [ ] `AX-18` **The sticky column headers do not stick.** `.table-scroll` never scrolls vertically. Make it work or delete the rule. — *accessibility critique · S*

- [ ] `AX-19` **The scrubber announces "5" and has a 3 px pointer target.** `aria-valuetext`; 24 px hit area; `aria-disabled` instead of `disabled`. 2.5.8 passes. — *accessibility critique · S*

- [ ] `AX-20` **No skip link; eleven tab stops before content on every page.** 2.4.1 passes via landmarks. Fifteen minutes. — *accessibility critique · S*

- [ ] `AX-21` **No table has a row header.** A `rowHeader` flag on `DataTable`'s column spec. — *accessibility critique · S*

- [ ] `AX-22` **Each car card is two adjacent links to one page.** `tabIndex={-1} aria-hidden` on the image link. — *accessibility critique · S*

**User research walkthrough** — simulated, and says so.

- [ ] `UR-05` **Nothing on 3,515 pages says who publishes this or how to tell them they are wrong.** No About, no contact, no corrections route; a Wikipedia editor cannot satisfy WP:RS. One page; `SD-15` is the same gap. — *user research · S*

- [ ] `UR-07` **The obvious standings query returns 333 rows, and the console hides the comment that prevents it.** Show `sqlite_master` SQL in the schema browser; add a worked example for the current championship. `CR-02`'s reader face. — *user research · S*

- [ ] `UR-09` **On `/records` the caveat sits 1,900 px below the figure.** Rides with `PD-03`; move the sentence above the table today. — *user research · S*

- [ ] `UR-12` **Amon's page gives three answers to "how many races".** 96 (lede), 108 (strip), `—` (starts). Where `notes` states a figure the page computes, show them adjacent or drop the prose. Apply during `CD-02`. — *user research · S*

- [ ] `UR-13` **The 2026 season's static page opens with five em dashes.** `Runner-up — — —` on the most-searched page in September. Lead with who leads, by how much, after how many rounds. Rides with `PD-02`. — *user research · S*

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

- [ ] `PD-08` **Decide what the atlas is for.** **Superseded by `PD-21`**,
      which decides it: a comparison surface, and only that. Three critics and
      the walkthrough agreed from structure and from use; the one number that
      would end the residual argument (does anyone open it) is `PD-Ø`'s. —
      *product critique · answered*
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

- [ ] `PD-Ø` **Measure something.** Re-raised 2026-09-11 at higher severity,
      with two free partial answers: Cloudflare's own request counts for
      lapledger.org and `/f1.db` (no tracker), and — once `PD-14` is settled —
      GitHub's per-asset release download counts, which F1DB's most recent
      release shows at ~1,800 across formats in five days. The user-research
      walkthrough ranks this first among the things only real research can
      settle, because every other ranking here assumes an arrival pattern
      nobody has observed. One of three: read Cloudflare monthly; make the
      repository public and read the download counts; or decide measurement is
      not wanted and write that here. — *product critique, user research · ?*
### Filed 2026-09-11

- [ ] `CR-12` **The stage pipeline is the right shape and a mechanical split of it.** Truncated names, an empty `_stage_31`, a stage doing nine things, file order disagreeing with run order. Rename by what each does; a final `_stage_99_finish`. — *code review · M*

- [ ] `CR-15` **A fact is a position in a 36-field tuple.** 831 rows across seven files; swapping two plausible numbers is invisible. `NamedTuple` per table, one regex — or a decision not to. — *code review · M or decision*

- [ ] `CR-17` **70% of the 8.6 s build is one stage.** `executemany` with a pre-fetched constructor set would halve it. Nine seconds is fine; noted so nobody optimises the other 29. — *code review · S*

- [ ] `CR-19` **`# noqa` and `eslint-disable` with no linter; Python 3.9 in the matrix.** Add ruff to CI or delete the markers; say why 3.9 stays. — *code review · S*

- [ ] `CR-20` **The history the project leans on starts on 2026-09-04.** Everything before v2.6 is `BUILD-NOTES.md` and comments, which makes `PM-02` weightier than an S. — *code review · ?*

- [ ] `PD-18` **Driver photographs: available for ~65%, fourth in the queue.** Sampled n=160: 55% pre-1970 to 98% modern, all on Commons. An *identification* portrait beside the `h1`, never a hero; the template must work without one (302 pages). Decide after `PD-16` and `PD-19` have shipped. `VD-22` sizes the data side L (a `drivers.article` equivalent, a name-match rule for people); `UR` found no persona blocked by its absence. — *product critique · decision*

- [ ] `VD-22` **What the formula1.com ask should buy.** `PD-18`'s visual half: 96–120 px, tile rhythm, `CommonsCredit`. Circuits would serve a reader more than drivers if only one image programme is ever done. — *visual critique · M*

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

- **Making the repository public.** Decided 2026-09-11 by the author: it
  stays private. Raised by `PD-14` and `SD-01`, which are right about the
  consequence — the pipeline half of the "audited" claim (the ~200 checks,
  the source literals, "rebuild and compare") is not readable by anyone, and
  the release page's stable links are 404. What remains checkable from the
  artefact alone is kept and is the claim now made: `discrepancies` (45
  conflicts, 44 resolved on the record, 1 open), `known_gaps`, a source on
  every row with its licence in `source_registry`, the schema's comments
  inside the file, and stored-versus-derived figures shown side by side.
  `AF-02` carries the three follow-ons that keep most of the ground. Re-raise
  only with a reason the author has not weighed: the code is private by
  choice, not by oversight. — the author
