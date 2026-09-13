#!/usr/bin/env python3
"""
Merge origin/main into the current branch, resolving only the conflicts this
repository can resolve safely, and leaving every other one to a person.

    python3 .claude/skills/backlog-loop/merge-main.py

What it resolves:
- f1.db, f1-geometry.db, f1_compat.json: fully generated. Main's copy is
  taken and `make all` rebuilds them (CLAUDE.md: take either side, rebuild,
  commit the rebuild).
- README.md, docs/COMMERCIAL-READINESS.md: half-generated. A conflict whose
  two sides differ only inside `<!-- fig:name -->value<!-- /fig -->` spans is
  a figure moving, and either side will do because `make all` rewrites the
  spans. A conflict in the prose is a person's, and the script stops.

Everything else - code, schema, data, tests - stops the script with the file
named. Concatenating two versions of a source file produces a file that
often still builds (two VERSION lines; two JSX blocks that both render), and
the review of #98 showed the build and verify.py passing on both.

The script exits non-zero whenever a merge did not complete. A merge with
no conflicts is committed by git itself; a resolved one is left staged and
uncommitted: run the web tests, then `git add -A && make ci`, then commit.
"""
import re
import subprocess
import sys

GENERATED = {"f1.db", "f1-geometry.db", "f1_compat.json"}
HALF = {"README.md", "docs/COMMERCIAL-READINESS.md"}
# The queue was docs/BACKLOG.md until 2026-09-13 and its both-sides-appended
# conflict was resolved here; it is GitHub Issues now, and nothing in the
# tree carries the queue, so that resolution is gone.
MARK = re.compile(r"^<<<<<<< [^\n]*\n(.*?)^=======\n(.*?)^>>>>>>> [^\n]*\n", re.S | re.M)
SPAN = re.compile(r"(<!-- fig:[a-z0-9_]+ -->)(.*?)(<!-- /fig -->)", re.S)


def sh(cmd, check=True):
    return subprocess.run(cmd, shell=True, capture_output=True, text=True, check=check)


def spans_only(text):
    """True when every conflict's two sides are identical once span values are blanked."""
    for m in MARK.finditer(text):
        a = SPAN.sub(r"\1\3", m.group(1))
        b = SPAN.sub(r"\1\3", m.group(2))
        if a != b:
            return False
    return True


def main():
    sh("git fetch -q origin")
    merged = sh("git merge --no-edit origin/main", check=False)
    conflicted = [p for p in sh("git diff --name-only --diff-filter=U", check=False).stdout.split() if p]
    if merged.returncode and not conflicted:
        sys.exit(f"git merge did not start:\n{merged.stderr.strip() or merged.stdout.strip()}")
    if not conflicted:
        print("already up to date" if "Already up to date" in merged.stdout else "merged cleanly")
        return

    stop = []
    rebuild = False
    for path in conflicted:
        if path in GENERATED:
            sh(f"git checkout --theirs -- '{path}'")
            print(f"theirs, then rebuilt   {path}")
            rebuild = True
        elif path in HALF:
            text = open(path, encoding="utf-8").read()
            if spans_only(text):
                sh(f"git checkout --theirs -- '{path}'")
                print(f"theirs, spans rewritten {path}")
                rebuild = True
            else:
                stop.append(f"{path}: the conflict is in the prose, not only in figure spans")
        else:
            stop.append(f"{path}: a source file; resolve it by hand")

    if stop:
        print("stopped - resolve by hand, then `git add`, rebuild and test:", file=sys.stderr)
        for line in stop:
            print("  " + line, file=sys.stderr)
        sys.exit(1)

    sh("git add -A .")
    if rebuild:
        built = sh("make all", check=False)
        if built.returncode:
            print(built.stdout[-1500:], file=sys.stderr)
            sys.exit("make all failed after the merge")
        sh("git add -A .")
    print("resolved; now run the web tests, then `git add -A && make ci` and commit the merge")


if __name__ == "__main__":
    main()
