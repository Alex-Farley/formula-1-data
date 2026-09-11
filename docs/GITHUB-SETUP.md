# Getting this onto GitHub

The archive already contains a git repository with one commit on `main`, so
there is nothing to initialise.

## 1. Unpack

```bash
tar -xzf f1db-v2.6.tar.gz
cd f1db
git log --oneline        # should show one commit
```

## 2. Check it builds on your machine

No dependencies — Python 3.9 or newer is all you need.

```bash
make all
```

That rebuilds `f1.db` from `data/*.py`, runs the checks, and regenerates the
JSON exports. It should end with `All checks passed.` followed by the live warning count and leave
`git status` clean — the build is deterministic, so a fresh build reproduces
the committed artefacts exactly.

## 3. Decide on licensing

**Read `ATTRIBUTION.md` first.** Short version: the factual data is yours to
license, but the prose fields (car design histories, circuit descriptions,
some notes) follow Wikipedia articles closely enough to carry CC BY-SA's
share-alike requirement. Three options are laid out there. I have not chosen
for you and there is no `LICENSE` file — GitHub will nag you for one, and that
nag is the right moment to make the decision rather than default into it.

If the repository is private, none of this matters yet.

## 4. Create the remote and push

Either with the GitHub CLI:

```bash
gh repo create f1db --private --source=. --remote=origin --push
```

...or by hand, after creating an empty repository on github.com with no
README, licence or .gitignore (the archive has all three questions already
answered):

```bash
git remote add origin git@github.com:<you>/f1db.git
git push -u origin main
```

## 5. What happens next

`.github/workflows/ci.yml` runs on every push and pull request. It rebuilds
the database on Python 3.9 and 3.12, runs `verify.py` and `audit.py`,
regenerates the JSON, and **fails if the committed exports do not match a
fresh build** — so a data edit that is not accompanied by a rebuild is caught
rather than merged. It also smoke-tests the query tool.

There are no secrets to configure and nothing to enable; Actions will pick the
workflow up on the first push.

## Notes on what is and is not committed

**Committed:** the built `f1.db` and both JSON exports. They are small (1.6 MB
and 2.9 MB), they are the point of the project, and committing them means
someone can clone and query without building. The build is deterministic, so
they never drift — CI enforces it.

**Not committed** (see `.gitignore`): the FastF1 HTTP cache, and any Parquet
telemetry dumps. Keep the cache locally — a warm one turns an hours-long load
into minutes.

**Never commit:** anything `tools/fastf1_load.py` writes into `laps`, `stints`,
`pit_stops`, `race_control_messages` or non-notable `team_radio`. That is
Formula One Management's data, it is large, and it is meant to be loaded
locally. Those tables are empty in a fresh build, so rebuilding before you
commit is enough to keep them out.

## Suggested repository description

> A normalised, queryable SQLite database of Formula One 1950–2026 — every
> race winner, pole and fastest lap, every circuit, 29 landmark cars — built
> from readable source modules and checked by its integrity tests.

Topics: `formula1`, `f1`, `motorsport`, `sqlite`, `dataset`, `open-data`,
`sports-data`.
