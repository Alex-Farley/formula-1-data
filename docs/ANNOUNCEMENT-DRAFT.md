# The first announcement: drafts

**Status: a draft for the maintainer to edit. Nothing here has been posted,
tagged or published, and the loop will not do any of those.** SD-18 (#389),
re-scoped 2026-09-24: the loop drafts, the maintainer publishes.

There are two drafts below: the release notes for the next release, and the
first post, which is for the bulk-data audience. The engineering-story post is
a second beat and is not drafted here.

## Before either goes out

The maintainer's steps, in the order the 2026-09-24 ruling set:

1. **Run the assistant-citation baseline first** (SD-21, #392, run inside
   PD-Ø). The announcement is what that baseline is measured against, so it
   has to be taken before the post exists.
2. **Choose where to post.** Not chosen here, on purpose.
3. **Recheck every figure** against the database being released. The ones
   below are from the committed `f1.db` at `main` `dfa576b`, which still
   says `meta.version` 2.24 but holds rows the v2.24 release does not. The
   table at the end gives the query for each.
4. **Recheck the licence paragraph.** PD-41 (#481) is an open decision on the
   data licence: a CC BY 4.0 facts artefact, or CC BY-SA stated as permanent.
   If it is decided before the post goes out, that paragraph changes. CR-55
   (#674) and PM-61 (#680) are open against the licence text a reader will
   click through to.
5. **Check the correction route.** The route a reader is given is the GitHub
   form `report.yml` (SD-04). UR-15 (#515), a route that does not need a
   GitHub account, is still an open decision. The post invites corrections,
   so whichever route is live when it goes out is the one it should name.
6. **Publish in your own name.**

The post leaves out the six radio quotations and anything taken from them.
`COMMERCIAL-READINESS.md` holds those back, and a post is closer to a
marketing surface than a database row is.

---

## Draft 1: release notes

For the body of the next release, in place of the list of pull-request
titles that `generate_release_notes: true` puts there, or above it. The file
table and the licence paragraphs that `release.yml` already writes stay as
they are. This goes before them.

> **Lap Ledger v2.NN — the Formula One record that says how much it can be
> trusted.**
>
> The world championship from 1950 to the calendar still to run: every race,
> entry, qualifying session and standings table so far, in one SQLite file.
> It is rebuilt from its sources and checked against independent sources on
> every build.
>
> What makes it different from other copies of the same results:
>
> - **Rows say how far they were checked.** Almost every fact table has a
>   `confidence` column, on a six-step scale: `verified` (checked against
>   fia.com or formula1.com), `high`, `reference` (a published secondary
>   record, compared with a second source where one is held), `medium`,
>   `unverified` and `catalogued`. Most rows are `reference`, and the file
>   says so rather than calling them official. The one large table without
>   it is `pit_stops`, which is all F1DB and names that source on every
>   row.
> - **Disagreements are published, not settled quietly.** The
>   `discrepancies` table holds every case where two sources disagree, what
>   each one says, an assessment, and whether it is still open.
> - **What is missing is published too.** `known_gaps` lists what the
>   database does not hold and why, and what would close each gap.
> - **Every row can be passed on.** Each sourced row names its source, and
>   each source is classified by what its licence allows. The build refuses a
>   source nobody has classified and fails on any row that cites a source whose
>   licence does not allow redistribution. There is no race timing: nobody
>   publishes it under a licence that allows it to be passed on.
>
> **Download**, in three formats:
>
> ```
> https://github.com/Alex-Farley/formula-1-data/releases/latest/download/f1.db
> https://github.com/Alex-Farley/formula-1-data/releases/latest/download/f1_database.json.gz
> https://github.com/Alex-Farley/formula-1-data/releases/latest/download/f1-parquet.zip
> ```
>
> Swap `latest` for `v2.NN` to pin this version. The build is reproducible,
> so `SHA256SUMS` can be checked by rebuilding from the tag.
>
> **What moved in the data since v2.24:** *(one line, by hand, until SD-26
> (#487) derives it: the season change, and the races added since the last
> release)*
>
> Browse it at <https://lapledger.org>. The quality pages are at
> <https://lapledger.org/data/quality>. Something wrong? *(the correction
> route live at the time; see step 5)*

---

## Draft 2: the first post, for the bulk-data audience

Written to be cut. The headline and the first two paragraphs are the post.
Everything after them is for a place that allows length.

> **An open Formula One database that tells you which of its facts to
> trust**
>
> Lap Ledger is the world championship from 1950 onwards as one SQLite file,
> with JSON and Parquet copies. It covers every race, entry, qualifying
> session and standings table, under an open licence. Other open F1 datasets
> give you the results. This one also gives you its own reliability: how far
> its rows were checked, every place its sources disagree, and everything it
> does not hold.
>
> - `confidence`: a level on 97,171 rows. 324 are `verified` against the FIA
>   or Formula 1, 326 are `high` and 95,241 are `reference`. 538 are
>   `medium`, 623 say plainly that they are `unverified`, and 119 are
>   `catalogued`, which means filed by a third party rather than checked.
> - `discrepancies`: 61 recorded disagreements between sources, each with
>   both values and an assessment. 44 are resolved, 3 explained and 14 still
>   open.
> - `known_gaps`: 17 entries for what is missing and why.
> - A licence audit the build enforces. All 121,260 sourced rows cite a source
>   whose licence allows them to be passed on, and a row that did not would
>   fail the build. The lap-timing tables are empty on purpose, because
>   nobody publishes timing under terms that allow it.
>
> It is rebuilt when F1DB, the main upstream source, publishes, and that is
> checked every morning. Each release is reproducible from its tag.
>
> SQLite: `…/releases/latest/download/f1.db` · JSON:
> `…/f1_database.json.gz` · Parquet: `…/f1-parquet.zip` · Browse:
> lapledger.org
>
> If you find a figure that is wrong, *(route; see step 5)*. A report that
> holds up becomes a row in `discrepancies` or `known_gaps` rather than a
> quiet edit.

Why the post is written this way, from the 2026-09-20 rulings on #389. Row
counts are not the claim, because every F1 dataset has those. Provenance is
the claim, because the bulk-data audience chooses a source on provenance, and
this is the one thing no other F1 source publishes. That is why the four
provenance bullets come before the downloads and no total row count appears.

---

## The figures, and where each comes from

Every figure in the drafts is from the committed `f1.db` at `main`
`dfa576b`. That is not the v2.24 release asset, which predates about 3,000 of
its rows. Rerun these against the database being released and change the
drafts to match.

| Figure in the draft | At `dfa576b` | Query |
|---|---|---|
| rows by `confidence` | 97,171 total; 95,241 `reference`, 326 `high`, 324 `verified`, 538 `medium`, 623 `unverified`, 119 `catalogued` (the six sum to the total) | sum of `SELECT confidence, count(*) … GROUP BY 1` over every table with a `confidence` column except `provenance` (derive the list from `pragma_table_info`) |
| `discrepancies` | 61: 44 resolved, 3 explained, 14 open | `SELECT status, count(*) FROM discrepancies GROUP BY 1` |
| `known_gaps` | 17 | `SELECT count(*) FROM known_gaps` |
| sourced rows, all passable | 121,260, 100 % `yes` or `facts-only` | `./f1 licences` |
