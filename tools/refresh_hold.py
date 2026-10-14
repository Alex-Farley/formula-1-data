#!/usr/bin/env python3
"""
Rebuild and verify a refresh, holding back one race's new rows if they alone
fail (AF-90, [D-56]).

    python3 tools/refresh_hold.py        refresh.yml, once the fetch has
                                         rewritten harvest/ and BUILT is dated

WHY
    One failing check used to hold back the whole refresh. From 2026-10-11 to
    2026-10-14 Singapore 2026's race result, sprint result and standings
    passed every check and still went unpublished, because one row of its
    sprint qualifying sheet failed one (#965). Each new race can meet an edge
    case the checks have not seen, so that will recur, and every recurrence
    held back the whole race. The maintainer ruled on #969: publish the rest,
    and hold back only failures attributable exactly to one race's newly
    fetched rows in one table; anything that cannot be so attributed still
    fails the whole run.

WHAT IT DOES
    1. Empties harvest/held.txt - every refresh starts holding nothing - and
       runs build.py, tools/readme_figures.py --write and verify.py, the
       three commands refresh.yml ran here before. If they pass, that is the
       refresh, held.txt stays empty, and nothing below runs.
    2. If they fail, it lists the candidates: for each file in HOLDABLE
       (data/harvest.py), each race for which the fetch ADDED rows to what
       the commit the run started from holds, and removed or changed none.
       A race whose committed rows moved is not a candidate - those are not
       new rows - and neither is a line with no round.
    3. For each candidate, alone: leave exactly its added rows out of its
       file, write the hold to held.txt (so the build records it as an open
       known_gaps row), and run the three commands again.
    4. If EXACTLY ONE candidate passes, that is the refresh: its rows stay
       out, held.txt names them and the checks they failed. If none passes,
       the failure is not one race's rows in one file; if more than one
       does, it is not attributable to one of them. Either way the harvest
       is put back as fetched and the run fails whole, as it always did.

    So the attribution is by experiment, not by reading failure messages:
    whatever is published has passed every check in verify.py, unchanged,
    against the database that goes out. The only allowance the checks make
    for a hold is that a race named in held.txt need not have rows of the
    file it is held from, and verify.py holds every such line to an open
    known_gaps row, rebuilt from it and compared whole.

WHEN THE HOLD IS ALL THERE IS
    A refresh after a hold fetches the held rows again. If they still fail
    and nothing else moved, the harvest ends where the commit it started
    from left it, so everything the build rewrote is put back - the dated
    BUILT line included - except the check date in web/src/lib/refresh.js,
    and the run lands as a quiet morning. Nothing is opened every three
    hours for a rebuild that changed nothing but its date.

OUTPUT
    Two lines to $GITHUB_OUTPUT (printed when it is not set):
    changed=true|false - whether the harvest still differs from the commit,
    which is what every later step of the job keys on - and held=<one line>,
    empty when nothing is held, which the `report` job reads to keep the
    failure alarm open until the rows land. Exit 0 when the refresh may go
    on, 1 when it fails whole.

Every write here is to a path refresh_tree.py already lets a refresh land.
"""
import collections
import os
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)
from data import harvest as HV  # noqa: E402  (HOLDABLE, and the held.txt the build reads)

HELD = "harvest/held.txt"
HEADER = (
    "# Written by tools/refresh_hold.py on every refresh that rebuilds (AF-90). "
    "Do not edit by hand.\n"
    "# The rows F1DB had just published for one race in one file that failed a "
    "check here, left out\n"
    "# of that file so the rest of the refresh could be published. No line: "
    "nothing is held back.\n"
    "# file|year|round|rows|failed   (rows: how many were left out; failed: the "
    "checks they failed)\n")
# The three commands refresh.yml's `Rebuild and verify` step ran before AF-90, in its order.
STEPS = (("build.py",), ("tools/readme_figures.py", "--write"), ("verify.py", "--quiet"))
# Each candidate is a full build and verify, about twenty seconds. A fetch
# that added rows for more races than this is not a race weekend's - F1DB
# filling in a column across history, say - and is left to fail whole
# rather than spend the job's time trying each.
MAX_CANDIDATES = 12
# The one file a run that ends up changing nothing still lands: the check
# date, stamped before the build (refresh.yml, SD-25).
STAMPED = "web/src/lib/refresh.js"


# ------------------------------------------------------------- the decisions

def data_lines(text):
    return [line for line in text.splitlines() if line.strip() and not line.startswith("#")]


def by_race(lines):
    """(year, round) -> Counter of the lines for that race. A line whose
    first two fields are not both whole numbers - an end-of-season standing,
    with no round - belongs to no race and is never a candidate."""
    out = collections.defaultdict(collections.Counter)
    for line in lines:
        year, round_ = (line.split("|") + ["", ""])[:2]
        if year.isdigit() and round_.isdigit():
            out[(int(year), int(round_))][line] += 1
    return out


def candidates(committed, fetched):
    """[((year, round), Counter of added lines)] for each race the fetch
    added rows to and took none from, in race order."""
    before, after = by_race(data_lines(committed)), by_race(data_lines(fetched))
    out = []
    for race in sorted(after):
        old = before.get(race, collections.Counter())
        added = after[race] - old
        if added and not (old - after[race]):
            out.append((race, added))
    return out


def without(text, added):
    """`text` with each line in `added` taken out as many times as it
    counts, and every other line - the header included - as it was."""
    left = collections.Counter(added)
    out = []
    for line in text.splitlines(keepends=True):
        key = line.rstrip("\n")
        if not key.startswith("#") and left.get(key, 0) > 0:
            left[key] -= 1
            continue
        out.append(line)
    if +left:
        raise ValueError(f"{sum((+left).values())} line(s) to leave out are not in the file")
    return "".join(out)


def one_line(text, limit=600):
    """`text` safe for a field of held.txt and for a $GITHUB_OUTPUT value:
    no pipe, no line break, and bounded."""
    flat = " ".join(str(text).replace("|", "/").split())
    return flat if len(flat) <= limit else flat[:limit - 1] + "…"


def held_line(file_, race, added, failed):
    year, round_ = race
    return (f"{file_}|{year}|{round_}|{sum(added.values())}|"
            f"{one_line('; '.join(failed)) or 'unknown'}\n")


def failures(script, returncode, stdout, stderr):
    """What failed, as names: verify.py's own list of failed checks, or the
    line a build step refused on."""
    if script == "verify.py":
        lines = stdout.splitlines()
        if any("CHECK(S) FAILED:" in line for line in lines):
            start = next(i for i, line in enumerate(lines) if "CHECK(S) FAILED:" in line)
            names = [line.strip()[2:] for line in lines[start + 1:]
                     if line.strip().startswith("- ")]
            if names:
                return names
        return [f"verify.py exited {returncode}"]
    last = [line for line in (stderr or stdout).splitlines() if line.strip()]
    return [f"{script} refused: {one_line(last[-1] if last else f'exit {returncode}', 300)}"]


# ---------------------------------------------------------------- the effects

def path(rel):
    return os.path.join(ROOT, rel)


def read(rel):
    with open(path(rel), encoding="utf-8") as f:
        return f.read()


def write(rel, text):
    with open(path(rel), "w", encoding="utf-8") as f:
        f.write(text)


def git(*args, check=True):
    return subprocess.run(["git", *args], cwd=ROOT, capture_output=True, text=True, check=check)


def committed(rel):
    """The file as the commit the run started from has it, or None."""
    out = git("show", f"HEAD:{rel}", check=False)
    return out.stdout if out.returncode == 0 else None


def attempt():
    """(passed, what failed, the log) for one run of STEPS."""
    log = []
    for step in STEPS:
        r = subprocess.run([sys.executable, *step], cwd=ROOT, capture_output=True, text=True,
                           check=False)
        log.append(f"$ python3 {' '.join(step)}\n{r.stdout}{r.stderr}")
        if r.returncode:
            return False, failures(step[0], r.returncode, r.stdout, r.stderr), "\n".join(log)
    return True, [], "\n".join(log)


def settle():
    """True when the harvest differs from the commit; otherwise put back
    everything the build rewrote, bar the check date, and say False."""
    if git("diff", "--quiet", "HEAD", "--", "harvest/", check=False).returncode:
        return True
    moved = [p for p in git("diff", "--name-only", "-z", "HEAD").stdout.split("\0")
             if p and p != STAMPED]
    if moved:
        git("checkout", "HEAD", "--", *moved)
        print(f"The harvest is the commit's once the hold is applied; put back {', '.join(moved)}.")
    return False


def emit(changed, held):
    lines = f"changed={'true' if changed else 'false'}\nheld={held}\n"
    out = os.environ.get("GITHUB_OUTPUT")
    if out:
        with open(out, "a", encoding="utf-8") as f:
            f.write(lines)
    print(lines, end="")


def main():
    fetched = {f: read(f"harvest/{f}") for f in HV.HOLDABLE}
    write(HELD, HEADER)
    ok, failed, log = attempt()
    print(log)
    if ok:
        emit(settle(), "")
        return 0

    found = []
    for f in HV.HOLDABLE:
        before = committed(f"harvest/{f}")
        if before is not None:
            found += [(f, race, added) for race, added in candidates(before, fetched[f])]
    print(f"The refresh fails: {'; '.join(failed)}")
    if not found:
        print("::error::the refresh fails, and the fetch added rows for no race to a file a "
              "race's rows can be held back from, so nothing can be held. It fails whole.")
        return 1
    if len(found) > MAX_CANDIDATES:
        print(f"::error::the refresh fails, and the fetch added rows for {len(found)} races "
              f"across the files a race's rows can be held back from - more than the "
              f"{MAX_CANDIDATES} a race weekend accounts for - so none is tried. It fails whole.")
        return 1

    passing = []
    for f, race, added in found:
        write(f"harvest/{f}", without(fetched[f], added))
        write(HELD, HEADER + held_line(f, race, added, failed))
        ok, _, _ = attempt()
        print(f"  leaving out {sum(added.values())} new row(s) of {f} for {race[0]} round "
              f"{race[1]}: {'everything else passes' if ok else 'still fails'}")
        if ok:
            passing.append((f, race, added))
        write(f"harvest/{f}", fetched[f])
        write(HELD, HEADER)

    if len(passing) != 1:
        why = ("no one race's new rows in one file account for it" if not passing else
               f"{len(passing)} different sets of new rows each account for it, so it is "
               "not attributable to one")
        print(f"::error::the refresh fails, and {why}. It fails whole.")
        return 1

    f, race, added = passing[0]
    write(f"harvest/{f}", without(fetched[f], added))
    line = held_line(f, race, added, failed)
    write(HELD, HEADER + line)
    ok, again, log = attempt()
    print(log)
    if not ok:
        # The same sources passed a moment ago; a second answer means the
        # build is not the function of its sources it must be.
        print(f"::error::the hold passed and then failed on the same harvest: {'; '.join(again)}")
        return 1
    held = (f"harvest/{f}, {race[0]} round {race[1]}: {sum(added.values())} row(s) held back; "
            f"they failed: {one_line('; '.join(failed))}")
    print(f"::warning::{held}")
    emit(settle(), one_line(held, 900))
    return 0


if __name__ == "__main__":
    sys.exit(main())
