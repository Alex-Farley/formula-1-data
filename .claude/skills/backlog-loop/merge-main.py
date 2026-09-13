#!/usr/bin/env python3
"""
Merge origin/main into the current branch the way this repository resolves
its predictable conflicts, then rebuild.

    python3 .claude/skills/backlog-loop/merge-main.py

- docs/BACKLOG.md: both sides append to *Landed*; keep both hunks in order,
  one `## Declined`, no run of three blank lines.
- f1.db, f1-geometry.db, f1_compat.json, README.md,
  docs/COMMERCIAL-READINESS.md: generated or half-generated; take main's copy
  and let `make all` rewrite them (CLAUDE.md: take either side, rebuild,
  commit the rebuild - never resolve one by hand).
- Any other text file: keep both hunks, then dedupe identical `import` lines
  and run `node --check` on touched scripts, because concatenation has
  duplicated imports and dropped closing braces before. A file that still
  fails to parse is left for a person, and the script exits non-zero.

It does not commit: run the web tests, then `git add -A && make ci` and commit.
"""
import re
import subprocess
import sys

ARTEFACTS = {"f1.db", "f1-geometry.db", "f1_compat.json", "README.md",
             "docs/COMMERCIAL-READINESS.md"}
MARK = re.compile(r"<<<<<<< [^\n]*\n(.*?)=======\n(.*?)>>>>>>> [^\n]*\n", re.S)


def run(cmd, check=True):
    return subprocess.run(cmd, shell=True, capture_output=True, text=True, check=check).stdout


def main():
    run("git fetch -q origin")
    merged = subprocess.run("git merge --no-edit origin/main", shell=True,
                            capture_output=True, text=True)
    if merged.returncode == 0:
        print("merged cleanly" if "Already up to date" not in merged.stdout else "already up to date")
    conflicted = [p for p in run("git diff --name-only --diff-filter=U", check=False).split() if p]
    failures = []
    for path in conflicted:
        if path in ARTEFACTS:
            run(f"git checkout --theirs -- '{path}'")
            print(f"theirs   {path}")
            continue
        text = open(path, encoding="utf-8").read()
        text = MARK.sub(lambda m: m.group(1) + m.group(2), text)
        if "<<<<<<<" in text or ">>>>>>>" in text:
            failures.append(f"{path}: conflict markers survive")
            continue
        if path.endswith(".md"):
            text = re.sub(r"\n\n\n+", "\n\n", text)
            if text.count("\n## Declined\n") > 1:
                failures.append(f"{path}: two '## Declined' headings")
        if path.endswith((".js", ".mjs", ".jsx")):
            seen, out = set(), []
            for line in text.split("\n"):
                if line.startswith("import ") and line in seen:
                    continue
                if line.startswith("import "):
                    seen.add(line)
                out.append(line)
            text = "\n".join(out)
        open(path, "w", encoding="utf-8").write(text)
        print(f"kept both {path}")
        if path.endswith((".js", ".mjs")):
            chk = subprocess.run(f"node --check '{path}'", shell=True, capture_output=True, text=True)
            if chk.returncode:
                failures.append(f"{path}: node --check failed\n{chk.stderr.strip()[:400]}")
    run("git add -A .")
    if failures:
        print("\n".join(failures), file=sys.stderr)
        print("resolve by hand, then rerun the web tests before committing", file=sys.stderr)
        sys.exit(1)
    if conflicted:
        built = subprocess.run("make all", shell=True, capture_output=True, text=True)
        if built.returncode:
            print(built.stdout[-1500:], file=sys.stderr)
            sys.exit("make all failed after the merge")
        run("git add -A .")
        print("rebuilt; now run the web tests, then `git add -A && make ci` and commit the merge")


if __name__ == "__main__":
    main()
