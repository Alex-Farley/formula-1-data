# -*- coding: utf-8 -*-
"""
Fetch F1DB's published career totals - wins, poles, fastest laps - for every
driver it holds.

    python3 tools/f1db_totals_fetch.py                     # the harvest's release
    python3 tools/f1db_totals_fetch.py --release v2026.14.0
    python3 tools/f1db_totals_fetch.py --check             # regenerate and diff only

Source:  https://github.com/f1db/f1db   (CC BY 4.0), the release artefact
         f1db-csv.zip, file f1db-drivers.csv
Writes:  harvest/f1db_driver_totals.txt

Why a second route into the same source
---------------------------------------
The totals are the named source the career figures typed into data/drivers.py
are checked against (PM-57, #624): a claim is the value a source gave, and the
reference records those figures were typed from were never named. F1DB
publishes a total per driver, but not in the source tree tools/f1db_fetch.py
reads: its Gradle build computes them, and they exist only in the released
artefacts (the same limit PD-45, #520, found for two other driver fields). So
this reads a release, not a clone.

A total computed here from F1DB's race files would not do. It would be this
project's count, not F1DB's claim, and for fastest laps it would silently take
F1DB's reading of every tied lap - which is what the figures are compared on.

What pins it
------------
- The release is, by default, the one the committed harvest was read from:
  the version stamped in harvest/f1db_drivers.txt. A refresh that moves the
  harvest past a release does not move this file; the totals stay the ones
  that release published until somebody fetches another on purpose.
- The tag must resolve to a commit, and that commit is stamped in the header.
- The zip must match the digest the release's own checksums_sha256.txt gives.
- The deed at that commit must be CC BY 4.0, read by the same licence_check()
  tools/f1db_fetch.py applies to a clone.

Nothing in the build reads the network: build.py reads the text file this
writes, like every other harvest file.
"""
import argparse
import csv
import hashlib
import io
import os
import re
import sys
import tempfile
import urllib.request
import zipfile

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from f1db_fetch import HARVEST, HEADER, licence_check, run  # noqa: E402
from f1db_fetch import write as write_harvest  # noqa: E402

RELEASES = "https://github.com/f1db/f1db/releases/download"
RAW = "https://raw.githubusercontent.com/f1db/f1db"
REPO = "https://github.com/f1db/f1db.git"
ASSET = "f1db-csv.zip"
MEMBER = "f1db-drivers.csv"
OUT = "f1db_driver_totals.txt"
# F1DB's column for each figure, in the order the file writes them.
FIELDS = (("wins", "totalRaceWins"), ("poles", "totalPolePositions"),
          ("fastest_laps", "totalFastestLaps"))


def fetch(url):
    with urllib.request.urlopen(url, timeout=60) as r:
        return r.read()


def harvest_release():
    """The F1DB version harvest/f1db_drivers.txt was read from."""
    with open(os.path.join(HARVEST, "f1db_drivers.txt"), encoding="utf-8") as f:
        for line in f:
            m = re.match(r"# Source: F1DB (\S+) \(", line)
            if m:
                return m.group(1)
    sys.exit("harvest/f1db_drivers.txt names no F1DB version")


def tag_commit(tag):
    out = run(["git", "ls-remote", REPO, f"refs/tags/{tag}^{{}}", f"refs/tags/{tag}"])
    refs = dict(reversed(line.split("\t")) for line in out.splitlines() if line)
    sha = refs.get(f"refs/tags/{tag}^{{}}") or refs.get(f"refs/tags/{tag}")
    if not sha:
        sys.exit(f"F1DB has no release tagged {tag}. The totals are published only "
                 f"in a release; name one with --release.")
    return sha


def total_rows(zipped):
    with zipfile.ZipFile(io.BytesIO(zipped)) as z:
        text = z.read(MEMBER).decode("utf-8")
    reader = csv.DictReader(io.StringIO(text))
    missing = [c for _f, c in FIELDS if c not in (reader.fieldnames or [])]
    if missing:
        sys.exit(f"{MEMBER} has no {', '.join(missing)} column")
    rows = []
    for r in reader:
        values = [r[c] for _f, c in FIELDS]
        if not all(v.isdigit() for v in values):
            sys.exit(f"{MEMBER}: {r['id']} has a total that is not a count: {values}")
        rows.append("|".join([r["id"], *values]))
    return sorted(rows)


def write(rows, version, commit, check):
    """tools/f1db_fetch.py's writer, under this tool's own name in the header."""
    return write_harvest(
        OUT, "driver_id|wins|poles|fastest_laps   (F1DB's own career totals, "
        f"from the release artefact {ASSET}, {MEMBER})",
        rows, version, commit, check,
        header=HEADER.replace("tools/f1db_fetch.py", "tools/f1db_totals_fetch.py"))


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--release", help="the F1DB release tag to read (default: the "
                                      "one harvest/f1db_drivers.txt names)")
    ap.add_argument("--check", action="store_true",
                    help="regenerate in memory and report whether the committed "
                         "file still matches; write nothing")
    args = ap.parse_args()

    tag = args.release or harvest_release()
    sha = tag_commit(tag)
    with tempfile.TemporaryDirectory() as tmp:
        with open(os.path.join(tmp, "LICENSE"), "wb") as f:
            f.write(fetch(f"{RAW}/{sha}/LICENSE"))
        licence_check(tmp)
    sums = dict(reversed(line.split(None, 1)) for line in
                fetch(f"{RELEASES}/{tag}/checksums_sha256.txt").decode().splitlines()
                if line.strip())
    zipped = fetch(f"{RELEASES}/{tag}/{ASSET}")
    digest = hashlib.sha256(zipped).hexdigest()
    if sums.get(ASSET, "").strip() != digest:
        sys.exit(f"{ASSET} from {tag} does not match the release's checksum")
    print(f"F1DB {tag} ({sha[:8]}), {ASSET} sha256 {digest[:12]}")
    ok = write(total_rows(zipped), tag, sha[:8], args.check)
    if args.check and not ok:
        sys.exit(f"harvest/{OUT} is out of date with F1DB {tag}")


if __name__ == "__main__":
    main()
