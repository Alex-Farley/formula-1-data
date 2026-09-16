# Working on this database

## The one rule

**Never edit `f1.db` directly.** It is generated. `build.py` drops and rebuilds
it from scratch every run, so a hand-edit lasts until the next build and then
vanishes silently.

The source of truth is `data/*.py` and `harvest/*.txt`. Edit there.

```
data/*.py  +  harvest/*.txt          the sources you edit
        |
        v  python3 build.py          drops and rebuilds f1.db
     f1.db
        |
        v  python3 verify.py         the checks; exit 1 on failure
        v  python3 audit.py          structural health report
        v  python3 export_json.py --compat
     f1_compat.json
```

Or just `make all`.

## Where things live

| File | Holds |
|---|---|
| `data/seasons.py` | Champions, runners-up, season summaries |
| `data/drivers.py` | Driver register, verified career figures |
| `data/teams.py` | Constructors and lineage chains |
| `data/circuits.py` | Circuit register, layout timelines, race-layout overrides |
| `data/cars.py` | Car register, specs, `CAR_SEASONS`, `EXPECTED` |
| `data/events.py` | The canonical 53 Grands Prix, aliases, single-circuit map |
| `data/technical.py` | Regulations, innovations, engine eras, safety, points systems |
| `data/current.py` | The current season: entry list, standings, calendar |
| `data/people.py` | Designers, principals, officials |
| `data/radio.py` | The curated notable team radio |
| `data/harvest.py` | Loaders and name-resolution for the harvest files |
| `harvest/races.txt` | `year\|round\|gp\|winner\|constructor` |
| `harvest/poles.txt` | `year\|round\|pole\|fastest_lap\|winner` |
| `harvest/venues.txt` | `year\|round\|venue\|winner` |

Four more harvest files are **generated, not written**. They carry a header
saying so, and editing one by hand is the same mistake as editing `f1.db`:

| File | Holds | Written by |
|---|---|---|
| `harvest/chassis.txt` | Every chassis that has raced | `tools/f1db_fetch.py` |
| `harvest/engines.txt` | Every engine, with capacity/config/aspiration | `tools/f1db_fetch.py` |
| `harvest/f1db_constructors.txt` | Constructor names, for the spec cross-check | `tools/f1db_fetch.py` |
| `harvest/entrants.txt` | Season → entrant → constructor → chassis/engine/tyre | `tools/f1db_fetch.py` |
| `harvest/car_specs.txt` | Chassis specifications off the per-car articles | `tools/wikispec_fetch.py` |
| `harvest/car_specs.log` | Every chassis refused, and why | `tools/wikispec_fetch.py` |

`python3 tools/f1db_fetch.py --check` regenerates in memory and tells you
whether the committed files still match F1DB.

Harvest files are plain pipe-delimited text on purpose: they diff cleanly, so
a data correction shows up as one readable line in a pull request.
`harvest/append.py` adds rows, checks the field count and flags duplicate
`(year, round)` pairs:

```bash
python3 harvest/append.py venues.txt 4 < new_rows.txt
```

## Adding data

**Every fact needs a `confidence` and, where there is one, a `source`.** The
ladder is `verified` > `high` > `reference` > `medium` > `unverified`.
`verified` means an official FIA or formula1.com source — nothing is promoted
to it without one.

If you cannot establish a figure, leave it `None`. A NULL means "not
established". It never means zero, and it is always better than a guess.

## Harvesting

The method that has caught every error in this project:

1. Harvest a structured table that **also contains a fact you already hold** —
   the race winner.
2. Reject any row whose known fact disagrees with what is stored. The build
   fails; it does not warn.
3. Reconcile the derived aggregates against independently held totals.

**The cross-checked fact must actually constrain the value you are
harvesting.** The winner constrains which race a row describes. It does not
constrain the chassis: a trial harvest of 1952 returned "Ferrari 125 F2" for
races Ascari won in a Ferrari 500, and every winner matched. Where your check
does not constrain the value, find a second table that does, or do not store
the value.

That is what F1DB's per-season entry lists now provide for the chassis, and
they show what a constraining check looks like in practice — including where
it stops. They say which chassis a constructor ran in a *season*, never which
it ran in a *round*, so they settle a constructor-season that used one design
and settle nothing at all about one that used two. Ferrari in 1952 entered
five different chassis and gets no link. **A check that constrains the value
in some cases and not others must be applied case by case, not in aggregate**
— the temptation to link 1952 anyway, because you happen to know Ascari drove
a 500, is exactly the inference the rule exists to stop.

The same rule kills a whole class of modern figure. A weight quoted for a
2023 car is almost always the season's regulation minimum: it describes the
rule, not the car, and no cross-check can turn it into a measurement. Those
go in `regulation_limits`, and the car field stays NULL.

## Never move bulk data by hand

Harvest files are for data you can read and check line by line. Thousands of
rows from an API are not that, and must come through a loader —
`tools/ergast_load.py` or `tools/fastf1_load.py` — which fetches and writes
without a human in the middle.

This is not a style preference. During v2.7 an API harvest was relayed by
hand and rows were typed from memory to fill gaps between paged requests.
Four of five sampled 2008 third places were fabricated. The only reason it
was caught is that the derived podium counts were reconciled against official
figures and Hamilton came out one short. If you find yourself typing result
rows into a heredoc, stop and write a loader.

## Adding checks

`verify.py` is the point of the project. If you add data that can be
cross-checked against something else in the database, add the check. Use
`check()` for a hard failure and `warn()` for something to keep an eye on.

The strongest checks here compare two things derived by different routes:
every driver's wins against the race records, every car's derived wins against
its published career total, every circuit's authored first/last GP against the
races stored at it.

## When sources disagree

Do not pick one silently. Record the disagreement in
`data/harvest.py: DECLARED_DISCREPANCIES`, and if you resolve it, record the
resolution in `CORRECTIONS` with the reasoning. `./f1 gaps` prints both.

## Before opening a pull request

```bash
make all        # build, verify, export
python3 audit.py
make lint       # Ruff, Biome, actionlint — what CI's lint job runs; see ruff.toml
```

Add `QUIET=1` to any make target — `make ci QUIET=1` — for failures, warnings
and a count instead of one line per check; the front end's equivalents are
`npm test -- --quiet` and, for one page's smoke sections, `npm run test:page
-- /drivers`. Same checks, same exit codes, a fortieth of the output.

`verify.py` must exit 0. Commit the regenerated `f1.db` and `f1_compat.json` —
CI fails if the committed export does not match a fresh build. `f1_database.json`
is **not** committed: it is 21 MB, it does not delta-compress, and it
regenerates in about a second, so it goes out as a release asset instead.

## The queue

Open work is [GitHub Issues](https://github.com/Alex-Farley/formula-1-data/issues),
one issue per item, ranked on the
[Lap Ledger project](https://github.com/users/Alex-Farley/projects/1). It is
the **only** queue: a finding from a critique, an item the project has carried
in its own documents for versions, an idea you had in the car — they compete
for the same time, so they belong in one place and are ranked against each
other rather than by who raised them. Until 2026-09-13 that place was
`docs/BACKLOG.md`; what landed and what was declined before then is
`docs/LANDED.md`, unchanged, and a later critique still argues against a
*Declined* entry there before re-raising it.

Every item has an **ID** in its title, a **source** label and a **size**
label. Nothing else is required.

    VD-26: The accent is not reserved, and the racing colour collides with it.
    labels: source: visual design · size: S

**IDs** are a prefix and a number, and they never get reused:

| Prefix | Label | Source |
|---|---|---|
| `PD-n` | `source: product design` | product design critique |
| `AX-n` | `source: accessibility` | accessibility critique |
| `IX-n` | `source: interaction design` | interaction design critique |
| `VD-n` | `source: visual design` | visual design critique |
| `CD-n` | `source: content design` | content design critique |
| `IA-n` | `source: information architecture` | information architecture critique |
| `DA-n` | `source: data architecture` | data architecture critique |
| `SD-n` | `source: service design` | service design critique |
| `UR-n` | `source: user research` | user research walkthrough |
| `PM-n` | `source: project record` | the project's own record — `known_gaps`, `discrepancies`, a *still open* in `docs/`, a `verify.py` warning |
| `AF-n` | `source: maintainer` | the maintainer's own — an idea, a defect, a want |
| `CR-n` | `source: code review` | code review (whole-codebase engineering review) |
| `LV-n` | `source: live data` | live and current-season data |
| `WK-n` | `source: Wikipedia survey` | what Wikipedia tabulates and the database cannot yet |

A critique's own numbering carries straight over: finding 4 of the product
critique is `PD-04`, and stays `PD-04` however the board is ordered. A second
product critique continues the sequence rather than restarting it;
`python3 .claude/skills/backlog-loop/next.py --next-id PD` prints the next
free number, counting closed issues and `docs/LANDED.md` too.

**Size** is what it costs, not how much it matters:

- `size: S` — one sitting. A component, a query, a copy change.
- `size: M` — a few sittings, shippable in pieces.
- `size: L` — needs a plan first, and probably a decision that is not obvious.
- `size: ?` — not costed yet. An honest state, and better than a guessed size.

Time here is bursty and unpredictable, so **an L that cannot be broken into
shippable pieces should be a decision to make, not a task to start.**

**Status**, on the project board, is the ranking: *Now*, *Next*, *Someday*,
top to bottom within each, and a person drags an item to rank it. *In
progress* means a worktree is open on it. The loop takes the first item under
*Now*, then *Next*, then *Someday*, and passes over two labels: `decision` —
a person's call, put on an issue with what must be decided, worked around
and never taken by an autonomous run — and `blocked` — an ordinary blocker a
run met, with a comment saying what.

**Landing.** The pull request body carries `Closes #n` on its own line, so
the merge closes the issue and the board moves it to *Done*. The PR is the
record of what was done; the issue is not edited to say so. **Declining** is
a normal outcome: the issue is closed as *not planned* with one comment
saying why, because what was declined and why is what a later critique has
to argue against. Nothing is deleted.

**Filing.** `python3 .claude/skills/backlog-loop/file.py new <prefix>
"<title>" --size <S|M|L|?> --body "<what is wrong, where, and what would fix
it>"` numbers the item, labels it and puts it on the board (under *Next*,
unless `--status` says otherwise; `--decision` for a question). Filing by
hand works too — the title, the two labels and the board status are all
there is — and the critique's full reasoning stays in `docs/critiques/`; the
issue is the queue, not the argument.

**Naming another item's ID in a body is how the two get proposed together.**
`next.py --group` reads those cross-references, and the file paths and routes
a body names, to suggest which items — of any size — could land in one pull
request instead of one each; the body that says where the work lands is the
one that gets grouped well.

## Working autonomously

The same rules apply when an agent works through the queue unattended, and
the per-item procedure that carries them is in **one** place:
`.claude/skills/backlog-item/SKILL.md`. It holds the pace table, grouping,
the review policy, the stop conditions and what never slides at any pace.
Nothing restates it — three copies of a rule is how two of them end up wrong,
which is what this section used to be.

What a person needs to know about it:

- **The queue is GitHub Issues**, as *The queue* above describes. `next.py`
  prints the next item, `file.py` files one, and an item is reassessed
  against the repository as it is now before it is started: the code may have
  moved, the fix may have landed under another ID, a later critique may have
  superseded it.
**What the queue scripts need.** All four shell out to `gh`, and it has to
be both current and authenticated. The credential is for everything they
do, not only the board: these scripts reach GitHub only through `gh`, and
`gh` refuses every call without one — `gh issue list` against this public
repository answers "please run: gh auth login" and makes no request at all.
The REST API does serve public reads anonymously; gh does not use it that
way, so the repository being public buys the loop nothing. The board needs
it twice over, ranking being a ProjectsV2 read and so GraphQL, which
refuses an unauthenticated call whatever the repository's visibility.

The container a Claude Code web session ran in on 2026-09-14 had neither:
no `gh` on PATH, and a `GH_TOKEN` that GitHub rejects. **A session like
that cannot run the loop at any price**, because the agent proxy refuses
GraphQL outright — *"GitHub GraphQL is not available from Claude Code
sessions; use the REST API"* — and ProjectsV2 has no REST equivalent. That
refusal came back on a request carrying no credential, so it is a blanket
block rather than an authentication failure, and a PAT does not lift it.
Do not spend one expecting otherwise. REST is untouched, so issues, pull
requests and check runs are reachable there with a credential; the ranking
the queue turns on is not.

Where GraphQL is reachable, the loop needs both — a current `gh` from
GitHub's own apt repository or a release tarball (the distribution package
was 2.45 on that image and has no `--json` on `pr checks`, which
`ci-wait.sh` reads), and a classic PAT with `repo`, `project` and
`workflow` scope — `project` is what the board read needs, and `workflow`
what GitHub requires before it will accept a push that changes anything
under `.github/workflows/`, which some items do. `gh_preflight.py` says
which of the three is wrong at the first failed call, alongside gh's own
message rather than in place of it, and in place of the traceback
`next.py` used to raise and the twenty minutes `ci-wait.sh` used to spend
sleeping on an answer that was never coming. `docs/LOCAL-SETUP.md` is the
step-by-step for setting such a machine up from nothing, written for
someone who has not done it before.

Nothing falls back to cover that gap, and this is deliberate. `file.py`
moves an item to *In progress*, which is a board write, so a loop that
cannot reach the board cannot claim an item and two sessions could take the
same one — the collision that status exists to prevent. A queue with no
ranking also looks exactly like a correctly ranked one in the output. Read
and work a named item without a board if you like; do not let the loop
choose one.

- **Every autonomous pull request gets an independent review from a fresh
  context before it merges**, returning `PASS — safe to merge` or `FAIL —
  changes required`. The agent that made the change never approves it.
  Silence, a rate limit or an unavailable review account is not a PASS. Which
  reviewer, which model, and what happens to a PASS with findings are in the
  skill.
- **A pull request merges** only when the change is complete, `make all`
  succeeded, the review returned PASS and the required checks are green.
  Merging `main` deploys lapledger.org through Cloudflare Workers Builds, so
  a merge is a production change.
- **An ordinary blocker is recorded and worked around**; a dangerous one
  stops the loop — anything that could corrupt data, breach a licence, weaken
  a safeguard, make an irreversible production change or lose history. A CI
  or test failure is told apart from an environmental or credential failure
  before it is acted on.
- **Nothing is changed to make the loop succeed**: not production
  infrastructure, Cloudflare DNS, credentials, branch protection, repository
  visibility, billing, the licence controls, the source classification, the
  redistribution checks, or `review.yml`.

The reasons behind each of these are in `docs/DECISIONS.md`.

## What not to commit

Anything from `tools/fastf1_load.py`. The `laps`, `stints`, `pit_stops`,
`race_control_messages` and non-notable `team_radio` rows are Formula One
Management's data, they are large, and they are meant to be loaded locally.
`.gitignore` covers the cache and the Parquet dumps; the tables themselves are
empty in a fresh build, so as long as you rebuild before committing, you are
fine.
