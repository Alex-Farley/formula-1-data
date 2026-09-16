#!/usr/bin/env python3
"""
Whether enough has landed since the last release to be worth cutting another.

VERSION sat at 2.23 for 141 commits (AF-39). Over that stretch the database
gained a season and 292 rows, and lapledger.org served all of it while every
page said "Cite this page as Lap Ledger, database v2.23 … The version and
build date fix which figures you saw". They had stopped fixing anything, and
nothing anywhere said so: release.yml refuses a TAG that disagrees with
VERSION, which is the right guard for publishing and silent between releases,
and ci.yml checks the committed artefacts against a fresh build, which is
silent about whether the version they carry still means anything.

This is a REMINDER, not a gate. It prints and exits 0 whatever it finds. A
release is a judgement about whether a body of work is worth a name, and that
is the maintainer's; what was missing was being told the question had come up.

WHAT COUNTS AS ENOUGH, AND WHY IT IS NOT A ROW COUNT

The obvious measure is how much the database moved. It is the wrong one. Read
off the tags:

    v2.17 -> v2.18     +2 rows      no schema change
    v2.18 -> v2.19     +0 rows      no schema change
    v2.19 -> v2.20     +0 rows      no schema change
    v2.20 -> v2.21    -15 rows      6 views changed
    v2.21 -> v2.23   +142 rows      +1 table, 3 views
    v2.23 -> HEAD    +292 rows      +1 table, 3 views, +1 season

Three of those releases carried no new data at all. They were worth cutting
for the site, the checks and the documents, none of which this database can
see. So a threshold on rows would have called half the project's own releases
unjustified, and it would have stayed quiet through the one gap that actually
went wrong until its very last commits.

What separates the gaps is their LENGTH: 2, 2, 13, 45, 100 commits, and then
141 with no release at the end of it. So the measure is commits since the tag,
and REMIND_AFTER sits at 50 - above the median gap, below the two longest, so
it speaks up on a stretch that is already long by this project's own record
rather than on ordinary week-to-week work.

One thing does justify a release on its own, however short the gap: a season
arriving, or a table. Those are what a reader cites and what a consumer of the
JSON export builds against, and shipping them under the previous version's
number is the failure this exists to prevent.

    python3 tools/release_due.py            print the verdict
    python3 tools/release_due.py --quiet    print only when a release is due
"""
import os
import sqlite3
import subprocess
import sys
import tempfile

# Commits since the last tag before this says anything. Chosen from the
# project's own intervals - 2, 2, 13, 45, 100 - not from a round number.
REMIND_AFTER = 50


def _git(*args):
    """A git command's stdout, or None where git cannot answer."""
    try:
        done = subprocess.run(("git",) + args, capture_output=True, text=True, check=False)
    except OSError:
        return None
    return done.stdout.strip() if done.returncode == 0 else None


def last_tag():
    """The newest v* tag reachable from HEAD, or None."""
    return _git("describe", "--tags", "--abbrev=0", "--match", "v*")


def commits_since(tag):
    """How many commits HEAD is ahead of `tag`, or None where git cannot say."""
    out = _git("rev-list", "--count", f"{tag}..HEAD")
    return int(out) if out and out.isdigit() else None


def shape(path="f1.db"):
    """The few figures a release is judged on: rows, tables, views, seasons."""
    con = sqlite3.connect(f"file:{path}?mode=ro", uri=True)
    try:
        tables = [r[0] for r in con.execute(
            "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")]
        views = con.execute(
            "SELECT COUNT(*) FROM sqlite_master WHERE type='view'").fetchone()[0]
        rows = 0
        for table in tables:
            rows += con.execute(f'SELECT COUNT(*) FROM "{table}"').fetchone()[0]
        seasons = con.execute("SELECT COUNT(*) FROM seasons").fetchone()[0]
        return {"rows": rows, "tables": len(tables), "views": views, "seasons": seasons}
    finally:
        con.close()


def shape_at(tag):
    """The shape of the database committed at `tag`, or None if it cannot be read.

    Binary, so it is read as bytes in one pass rather than through _git, which
    decodes as text. A shallow clone need not carry the tag's blob at all, and
    that is not a failure: the commit count still answers the question.
    """
    raw = subprocess.run(("git", "show", f"{tag}:f1.db"), capture_output=True, check=False)
    if raw.returncode != 0 or not raw.stdout:
        return None
    handle, temp = tempfile.mkstemp(suffix=".db")
    try:
        with os.fdopen(handle, "wb") as out:
            out.write(raw.stdout)
        return shape(temp)
    except sqlite3.Error:
        return None
    finally:
        try:
            os.unlink(temp)
        except OSError:
            pass


def verdict(version, tag, commits, now, then):
    """The line to print, and whether a release is due.

    `then` is the shape of the database at `tag`, or None where it could not be
    read - a shallow clone that does not carry the tag's blob is the usual
    reason, and it is not a failure: the commit count still answers the
    question this exists to ask.
    """
    if tag is None:
        return "release: no v* tag in this checkout, so there is nothing to compare against", False
    if tag != f"v{version}":
        # Bumped and not yet published. Nothing to remind about - the bump IS
        # the reminder, and it is already done.
        return (f"release: VERSION is {version} and the last tag is {tag}; "
                f"`git tag v{version} && git push origin v{version}` publishes it"), False
    if commits is None:
        return f"release: at {tag}; git could not count the commits since it", False

    gained = []
    if then is not None:
        for what in ("seasons", "tables"):
            delta = now[what] - then[what]
            if delta:
                gained.append(f"{delta:+d} {what[:-1] if abs(delta) == 1 else what}")
        rows = now["rows"] - then["rows"]
        if rows:
            gained.append(f"{rows:+,} rows")

    # A season or a table is citable on its own; length is the other way in.
    structural = then is not None and (
        now["seasons"] != then["seasons"] or now["tables"] != then["tables"])
    due = commits >= REMIND_AFTER or structural

    moved = f", and the database has {', '.join(gained)}" if gained else ", database unchanged"
    if not due:
        return f"release: {commits} commit(s) since {tag}{moved}", False
    why = "a season or table has arrived" if structural else f"past releases ran {REMIND_AFTER} commits or fewer"
    return (f"release: {commits} commit(s) since {tag}{moved}. "
            f"Worth cutting one? ({why}.) Bump VERSION and BUILT, `make all`, "
            f"then tag v<VERSION>"), True


def main(argv):
    quiet = "--quiet" in argv
    sys.path.insert(0, ".")
    import build

    tag = last_tag()
    then = None
    if tag:
        then = shape_at(tag)

    line, due = verdict(build.VERSION, tag, commits_since(tag) if tag else None,
                        shape(), then)
    if due or not quiet:
        print(f"  {line}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
