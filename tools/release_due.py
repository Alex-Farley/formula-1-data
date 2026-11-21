#!/usr/bin/env python3
"""
Whether a release is due: the last release's f1.db against this checkout's.

Releases are cut only when someone remembers to tag one, so the published
database falls behind the site without anything saying so. At v2.26 (tagged
16 Oct 2026), measured on 2026-11-21, main's f1.db held results for three
races the release did not, four new tables, twelve new columns (six on
circuit_outlines and the same six on circuit_geometry), and 29 of the 53
shared tables had changed as this file compares them - while both
databases said meta.version = 2.26, so one version number named two
different databases (AF-183). Before that, VERSION sat at 2.23 for 141
commits (AF-39), which is when the first form of this reminder was written:
a count of commits since the tag. Commits are not what a reader cites; the
database is. So this compares the two databases themselves.

THE FOUR CRITERIA

    new results   more races have results in race_entries than the release
                  held
    schema        a table or a column has been added or removed. Columns
                  are read from PRAGMA table_info, never listed by hand
                  ([D-02])
    corrections   rows the release held in a core fact table (CORE) are no
                  longer there as they were: changed or removed, not only
                  new rows added. Drivers' and constructors' career figures
                  move with a new result, so on a release with new results
                  this can count those rows too; its line names the count
                  per table so a reader can tell the two apart
    age           the release is more than MAX_AGE_DAYS old and anything at
                  all has changed: a table's rows, or the schema

What a row is compared on. An integer `id` is a surrogate the build hands out
in insert order, which meta.id_stability_stable says is stable only in the
tables it names - in both copies, since a table named only since the
release may have been renumbered before it was; elsewhere a row inserted
early renumbers every row after it, which is not a change to any of them.
So an integer primary key named `id`, outside that list, is left out of the
comparison, and so is any column that references one (`source_id` ->
source_registry.id), both read from the schema; an integer primary key with
a name of its own, seasons.year, is a natural key and is compared. A text id is a natural key and is compared like any other column.
meta's `built`, `verification_date` and `version` rows are left out too: they
move when a build is dated or a version bumped, not when the data does.

Nothing here reads the clock. The build's date is a constant ([D-01]) and is
left out as above; the release's age is the time between the tag's commit
and this checkout's HEAD commit, so the same repository gives the same
answer whenever it is asked.

A REMINDER AND A SIGNAL, NEVER A GATE
    Exit 0 when nothing fires, 1 when any criterion does, 2 when there is
    nothing to compare against (no v* tag, or the tag's f1.db cannot be
    read - a shallow clone need not hold it). `make all` prints it and goes
    on whatever it says, because whether a body of work is worth a release
    is the maintainer's judgement; refresh.yml reads the same verdict and
    keeps one `release-due` issue open while it fires
    (.github/scripts/refresh_alarm.py release). Neither tags nor publishes
    anything: a release is the maintainer's push of a tag.

    python3 tools/release_due.py            print the verdict
    python3 tools/release_due.py --quiet    print only when a release is due
"""
import os
import re
import sqlite3
import subprocess
import sys
import tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# The tables a reader cites a result, a standing or a person from. A new race
# only adds rows to the session tables and to standings, so a row of the
# release's that is gone from one of them is a correction.
CORE = ("races", "race_entries", "qualifying", "sprint_qualifying", "sprint_results",
        "practice", "pit_stops", "standings", "drivers", "constructors", "circuits")

# Days a release may stand before anything having changed is reason enough.
MAX_AGE_DAYS = 28

# meta rows that record the build rather than the data: dated by the refresh,
# bumped for a release. Left out of every comparison.
META_IGNORED = ("built", "verification_date", "version")

CRITERIA = ("new results", "schema", "corrections", "age")


# ------------------------------------------------------------------ the diff

def _q(name):
    return '"' + name.replace('"', '""') + '"'


def _tables(con, schema):
    return sorted(r[0] for r in con.execute(
        f"SELECT name FROM {schema}.sqlite_master WHERE type = 'table' "
        "AND name NOT LIKE 'sqlite_%'"))


def _columns(con, schema, table):
    """[(name, declared type, pk position)] from PRAGMA table_info."""
    return [(r[1], (r[2] or "").upper(), r[5])
            for r in con.execute(f"PRAGMA {schema}.table_info({_q(table)})")]


def _surrogate(con, schema, table):
    """'id' where it is the table's integer primary key, else None. Only the
    column meta.id_stability calls a surrogate: an integer primary key with
    a name of its own - seasons.year - is a natural key, compared like any
    other column."""
    pk = [(name, kind) for name, kind, pos in _columns(con, schema, table) if pos]
    return "id" if pk == [("id", "INTEGER")] else None


def _stable(con):
    """The tables meta.id_stability_stable names in both copies; a table the
    release did not name may have been renumbered before the undertaking
    was given. An empty set where either names none, which compares no
    surrogate at all."""
    found = []
    for schema in ("old", "main"):
        try:
            row = con.execute(f"SELECT value FROM {schema}.meta "
                              "WHERE key = 'id_stability_stable'").fetchone()
        except sqlite3.Error:
            row = None
        found.append({t.strip() for t in row[0].split(",") if t.strip()} if row and row[0] else set())
    return found[0] & found[1]


def _compared(con, table, shared, stable):
    """The shared columns a row of `table` is compared on: all of them but a
    surrogate id the build may renumber, and any column that references one."""
    unstable = set() if table in stable else {_surrogate(con, "main", table)}
    for fk in con.execute(f"PRAGMA main.foreign_key_list({_q(table)})"):
        target, src, dest = fk[2], fk[3], fk[4]
        if target in stable:
            continue
        surrogate = _surrogate(con, "main", target)
        if surrogate is not None and dest in (None, surrogate):
            unstable.add(src)
    return [c for c in shared if c not in unstable]


def _gone(con, table, cols, older, newer):
    """How many distinct rows of `older`.table, on `cols`, `newer` lacks."""
    sel = ", ".join(_q(c) for c in cols)
    where, params = "", ()
    if table == "meta" and "key" in cols:
        where = " WHERE key NOT IN (" + ", ".join("?" * len(META_IGNORED)) + ")"
        params = META_IGNORED * 2
    sql = (f"SELECT COUNT(*) FROM (SELECT {sel} FROM {older}.{_q(table)}{where} "
           f"EXCEPT SELECT {sel} FROM {newer}.{_q(table)}{where})")
    return con.execute(sql, params).fetchone()[0]


def _races_with_results(con, schema):
    if "race_entries" not in _tables(con, schema):
        return 0
    return con.execute(f"SELECT COUNT(DISTINCT race_id) FROM {schema}.race_entries").fetchone()[0]


def compare(old_path, new_path):
    """What moved between the release's database and this one, as plain data."""
    con = sqlite3.connect(f"file:{new_path}?mode=ro", uri=True)
    try:
        con.execute("ATTACH DATABASE ? AS old", (f"file:{old_path}?mode=ro",))
        old_t, new_t = set(_tables(con, "old")), set(_tables(con, "main"))
        stable = _stable(con)
        cols_added, cols_removed, changed, corrections = [], [], [], {}
        for table in sorted(old_t & new_t):
            before = [c[0] for c in _columns(con, "old", table)]
            after = [c[0] for c in _columns(con, "main", table)]
            cols_added += [f"{table}.{c}" for c in after if c not in before]
            cols_removed += [f"{table}.{c}" for c in before if c not in after]
            cols = _compared(con, table, [c for c in before if c in after], stable)
            if not cols:
                continue
            gone = _gone(con, table, cols, "old", "main")
            if gone or _gone(con, table, cols, "main", "old"):
                changed.append(table)
            if gone and table in CORE:
                corrections[table] = gone
        return dict(
            results=(_races_with_results(con, "old"), _races_with_results(con, "main")),
            tables_added=sorted(new_t - old_t), tables_removed=sorted(old_t - new_t),
            columns_added=cols_added, columns_removed=cols_removed,
            changed=changed, shared=len(old_t & new_t), corrections=corrections)
    finally:
        con.close()


# --------------------------------------------------------------- the verdict

def _some(names, most=4):
    shown = ", ".join(names[:most])
    return shown + (f" and {len(names) - most} more" if len(names) > most else "")


def _counted(sign, names, noun):
    return f"{sign}{len(names)} {noun}{'s' if len(names) != 1 else ''} ({_some(names)})"


def criteria(diff, age):
    """[(criterion, fired, what it found)], one per CRITERIA, in that order.
    `age` is the release's age in whole days, or None where it could not be
    read, which leaves the age criterion quiet."""
    out = []
    before, after = diff["results"]
    out.append(("new results", after > before,
                f"{after:,} races with results, {before:,} in the release"
                + (f" ({after - before:+,})" if after != before else "")))

    moved = [_counted(sign, names, noun) for sign, names, noun in (
        ("+", diff["tables_added"], "table"), ("-", diff["tables_removed"], "table"),
        ("+", diff["columns_added"], "column"), ("-", diff["columns_removed"], "column"))
        if names]
    out.append(("schema", bool(moved), "; ".join(moved) or "no table or column added or removed"))

    fixed = diff["corrections"]
    out.append(("corrections", bool(fixed),
                (f"{sum(fixed.values()):,} of the release's rows changed or gone: "
                 + ", ".join(f"{t} {n:,}" for t, n in sorted(fixed.items())))
                if fixed else "no row the release held in a core table has changed"))

    anything = bool(diff["changed"] or moved)
    what = (f"{len(diff['changed'])} of {diff['shared']} shared tables changed"
            + ("; the schema moved" if moved else "")) if anything else "nothing has changed"
    if age is None:
        out.append(("age", False, f"the release's age could not be read; {what}"))
    else:
        out.append(("age", age > MAX_AGE_DAYS and anything,
                    f"{age} days old, against {MAX_AGE_DAYS}; {what}"))
    return out


def next_version(version, tag):
    """The version a release should carry: VERSION where it has already been
    bumped past the tag, else the tag's with its last part moved on one; None
    where VERSION's last part is not a number."""
    if tag != f"v{version}":
        return version
    head, _, last = version.rpartition(".")
    if not last.isdigit():
        return None
    return f"{head}.{int(last) + 1}" if head else str(int(last) + 1)


def advice(version, tag):
    """What to do about a release that is due, in one sentence."""
    to = next_version(version, tag)
    if to == version:
        return (f"VERSION is already {version} and the last tag is {tag}: `make all`, "
                f"merge, then `git tag v{version} && git push origin v{version}`")
    to = to or "<next>"
    return (f"bump VERSION in build.py to {to}, `make all`, merge, then "
            f"`git tag v{to} && git push origin v{to}`")


# ---------------------------------------------------------------- the effects

def _git(*args):
    """A git command's stdout, or None where git cannot answer."""
    try:
        done = subprocess.run(("git", "-C", ROOT) + args, capture_output=True, text=True,
                              check=False)
    except OSError:
        return None
    return done.stdout.strip() if done.returncode == 0 else None


def last_tag():
    """The newest v* tag reachable from HEAD, or None."""
    return _git("describe", "--tags", "--abbrev=0", "--match", "v*")


def age_days(tag):
    """Whole days from the tag's commit to HEAD's, or None."""
    then = _git("log", "-1", "--format=%ct", f"{tag}^{{commit}}")
    now = _git("log", "-1", "--format=%ct", "HEAD")
    if not (then and now and then.isdigit() and now.isdigit()):
        return None
    return (int(now) - int(then)) // 86400


def tag_database(tag, into):
    """Write the f1.db committed at `tag` to the path `into`; False if git
    cannot give it. Read as bytes, since it is binary."""
    try:
        raw = subprocess.run(("git", "-C", ROOT, "show", f"{tag}:f1.db"),
                             capture_output=True, check=False)
    except OSError:
        return False
    if raw.returncode != 0 or not raw.stdout:
        return False
    with open(into, "wb") as out:
        out.write(raw.stdout)
    return True


def version_in(path):
    """VERSION as build.py assigns it, read without importing the build, so
    a workflow can ask with build.py and nothing it imports checked out."""
    with open(path, encoding="utf-8") as f:
        m = re.search(r'^VERSION = "([^"]+)"$', f.read(), re.M)
    return m.group(1) if m else None


def check(db=None):
    """(version, tag, found): `found` is criteria()'s list, or a string
    saying why there is nothing to compare against."""
    version = version_in(os.path.join(ROOT, "build.py"))
    tag = last_tag()
    if tag is None:
        return version, None, "no v* tag in this checkout, so there is nothing to compare against"
    handle, temp = tempfile.mkstemp(suffix=".db")
    os.close(handle)
    try:
        if not tag_database(tag, temp):
            return version, tag, f"git cannot give the f1.db committed at {tag} (a shallow clone?)"
        try:
            diff = compare(temp, db or os.path.join(ROOT, "f1.db"))
        except sqlite3.Error as e:
            return version, tag, f"the two databases could not be compared: {e}"
        return version, tag, criteria(diff, age_days(tag))
    finally:
        try:
            os.unlink(temp)
        except OSError:
            pass


def report(version, tag, found):
    """The lines main() prints for a comparison that ran."""
    lines = [f"release: VERSION {version}, last tag {tag}"]
    lines += [f"  {name:<12} {'fires' if fired else 'quiet'}: {what}"
              for name, fired, what in found]
    due = any(fired for _, fired, _ in found)
    lines.append(f"release due: {advice(version, tag)}" if due else "release: not due")
    return lines


def main(argv):
    quiet = "--quiet" in argv
    version, tag, found = check()
    if isinstance(found, str):
        if not quiet:
            print(f"  release: {found}")
        return 2
    due = any(fired for _, fired, _ in found)
    if due or not quiet:
        print("\n".join(f"  {line}" for line in report(version, tag, found)))
    return 1 if due else 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
