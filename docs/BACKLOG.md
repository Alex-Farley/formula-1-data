# Backlog

One list, whatever the source. A finding from a critique, an idea you had in the
car, a defect you tripped over — they compete for the same time, so they belong
in the same place and get ranked against each other rather than by who raised
them.

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

**Done** items get ticked, keep their ID, and move to *Landed* at the bottom
with the commit that closed them. They are not deleted: what was declined, and
why, is as useful as what was built — and a later critique that re-raises a
closed item can be answered from here.

**Declining** is a normal outcome. Move it to *Declined*, with one line saying
why. A critic may re-raise it; the reason is what they have to argue against.

New critiques file their findings here as new IDs. `docs/critiques/` keeps the
full reasoning and the evidence — this file is the queue, not the argument.

---

## Now

The next things worth doing, in order. Keep this short enough to be a decision
rather than a list.

- [ ] `PD-02` **Make the prerenderer call the page components' own queries.**
      Static and app currently emit different numbers under the same label — 14
      of 38 drivers with a stored `entries` disagree with the derived count, and
      the other 824 show an em dash statically and a real figure in the app.
      Then make `smoke.mjs` assert the *static* output against the database as
      it already does the app's, which is what would have caught this on the day
      it shipped. — *product critique · M*

- [ ] `PD-07` **Stop the README lying.** It claims 39 tables, 34 views, ~8,400
      rows against an actual 46 / 38 / 119,271, and says qualifying is "not held
      at all" when 26,997 rows are. Move the version log to `BUILD-NOTES.md`,
      then generate every count from the database and add a `verify.py` check
      that fails when a stated figure disagrees — the discipline `f1_compat.json`
      already gets. — *product critique · M*

- [ ] `PD-03` **Derive `/records`, or stop shipping it.** All 30 rows are
      authored, sit at `medium`, and nothing in `verify.py` reads the table;
      the page says Hamilton has 105 wins while `drivers.wins` says 106. Derive
      the leaderboards; keep only what genuinely cannot be derived, in a block
      that says so. — *product critique · M*

- [ ] `PD-11` **Give the bulk data a front door, and a claim.** The Parquet
      bundle is built, served, and linked from nothing. A `/data` page in the
      masthead leading with the audited edition — 60 recorded disagreements, a
      confidence tier per row, a gap register, ~170 cross-checks — which is a
      claim the upstream does not make. — *product critique · M*

## Next

Worth doing, not yet urgent.

- [ ] `PD-05` **Split `known_gaps` into open and closed.** Four of the eleven
      are closed or not gaps, and the homepage counts all eleven. Add a `state`
      column, filter the public page, and split each row into a reader sentence
      and a maintainer note — the page currently renders commit messages. —
      *product critique · S*

- [ ] `PD-06` **Fix the drivers register's first screen.** It opens on Adolf
      Brudes with two columns empty for 96% of rows. Drop `entries` and `starts`,
      add a derived `Races`, and change the default sort to something that
      answers a question. — *product critique · S*

- [ ] `PD-10` **A citation block.** Every ingredient exists — version, build
      date, per-row source, permanent URL — and they are assembled nowhere. One
      component, prerendered so a crawler sees it. Converts a browsable
      reference into a citable one. — *product critique · S*

- [ ] `PD-12` **State the lap-timing constraint as a position.** It currently
      reads as a schema-shaped apology inside a gaps table. "No one may lawfully
      redistribute Formula One lap timing, so this database contains none, and
      every figure here is one you may republish" is a competitive advantage
      over anyone hosting scraped timing. — *product critique · S*

- [ ] `PD-13` **Write down the upstream dependency.** 93.5% of rows come from
      one source refreshed by one cron. Nothing records what happens if it
      changes licence or stops. One page in `docs/`. — *product critique · S*

## Someday, or maybe never

Real, but not costed or not yet decided.

- [ ] `PD-09` **Rework `/reference`.** It holds an audit, an encyclopedia and a
      developer tool behind one nav item. Promote the SQL console and a merged
      provenance page to the masthead. Needs redirects and a naming decision. —
      *product critique · L*

- [ ] `PD-08` **Decide what the atlas is for.** Genuinely excellent, covers 25
      of 80 circuits, has no named audience, and nothing measures whether anyone
      opens it. Not a task until there is a way to answer the question. —
      *product critique · ?*

- [ ] `PD-Ø` **Measure something.** There is no analytics of any kind, so
      progress cannot be told from motion. Deliberately unsized: what to measure
      is a decision about what this is for, and the answer may be "nothing", in
      which case say so here and let critics stop raising it. — *product
      critique · ?*

---

## Landed

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
      silently by design. — *product critique · this commit*

## Declined

Nothing yet. When something lands here it needs one line saying why, because a
later critique will raise it again and this is the answer.
