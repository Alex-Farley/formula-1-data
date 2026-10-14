#!/usr/bin/env python3
"""Carry a refresh from the job that builds it to the job that lands it (AF-78).

    refresh_tree.py pack  <dir>    refresh.yml's `refresh` job, before npm
    refresh_tree.py apply <dir>    its `land` job, on a fresh checkout

The job that builds and tests a refresh runs npm, and code from npm can do
anything the job can: plant a git hook, rewrite a script a later step runs,
append to $GITHUB_ENV, redirect the remote. So that job holds no token that
writes to this repository, and the one that does, `land`, runs no npm. What
crosses between them is files, and this is the whole of what may cross.

`pack` copies every file the refresh changed into <dir>/tree and lists them
in <dir>/paths.txt. It runs before npm does, and it refuses a change to any
path a refresh does not write, so a refresh that starts writing somewhere
new fails loudly instead of having its change dropped on the way across.
A run that changed nothing - any quiet run after the day's first, whose
heartbeat is already on main - still writes paths.txt, listing no path and
with no tree beside it, and `apply` lands that as nothing (CR-78).

`apply` treats <dir> as untrusted: everything in it went through a job that
ran npm, however early it was packed. It copies a file into the checkout
only if the path is one a refresh writes and the content is the kind of
change a refresh makes:

- harvest/*.txt and the three built artefacts, whole. ci.yml rebuilds the
  artefacts from the sources on the pull request and refuses any byte that
  differs, and verify.py gates the harvest; and no harvest file that is code
  (harvest/append.py) is on the list.
- build.py and web/src/lib/refresh.js only where the one dated line differs
  and the rest of the file is the checkout's, byte for byte.
- the documents tools/readme_figures.py writes only where the text outside
  its figure spans is unchanged; verify.py checks what is inside them.

Anything else, a symlink, or a file in the tree that paths.txt does not
list, and nothing is applied.
"""
import os
import re
import shutil
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
sys.path.insert(0, os.path.join(ROOT, "tools"))
import readme_figures  # noqa: E402  (the documents it writes, and its span syntax)

ARTEFACTS = ("f1.db", "f1-geometry.db", "f1_compat.json")
HARVEST = re.compile(r"harvest/[A-Za-z0-9_-]+\.txt")
DOCUMENTS = tuple(os.path.relpath(p, readme_figures.ROOT).replace(os.sep, "/")
                  for p in readme_figures.DOCUMENTS)
# The one line each of these may change, as it must read afterwards. These
# are the lines refresh.yml's sed steps write and assert, in ASCII digits
# (`\d` would also take any other script's).
ONE_LINE = {
    "build.py": re.compile(r'BUILT = "[0-9]{4}-[0-9]{2}-[0-9]{2}"'),
    "web/src/lib/refresh.js": re.compile(r"export const LAST_CHECKED = '[0-9]{4}-[0-9]{2}-[0-9]{2}'"),
}
LIST = "paths.txt"
TREE = "tree"


def allowed(path):
    return (path in ARTEFACTS or path in DOCUMENTS or path in ONE_LINE
            or HARVEST.fullmatch(path) is not None)


def _blank_spans(text):
    return readme_figures.SPAN.sub(lambda m: f"<!-- fig:{m.group(1)} --><!-- /fig -->", text)


def problem(path, new, old):
    """Why `new` (bytes) may not replace `old` (bytes, or None for a file
    the checkout does not have) at `path`, or None if it may."""
    if not allowed(path):
        return "is not a path a refresh writes"
    if path not in ONE_LINE and path not in DOCUMENTS:
        return None
    if old is None:
        return "is new, and a refresh only rewrites it"
    try:
        new_text, old_text = new.decode("utf-8"), old.decode("utf-8")
    except UnicodeDecodeError:
        return "is not UTF-8"
    if path in ONE_LINE:
        line = ONE_LINE[path]
        a, b = old_text.split("\n"), new_text.split("\n")
        if len(a) != len(b) or any(x != y and not (line.fullmatch(x) and line.fullmatch(y))
                                   for x, y in zip(a, b)):
            return f"changes more than the line {line.pattern}"
        return None
    if _blank_spans(old_text) != _blank_spans(new_text):
        return "changes text outside its figure spans"
    return None


def _read(path):
    with open(path, "rb") as f:
        return f.read()


def changed_paths(root):
    """Every path `git status` reports as changed under `root`, or exit on
    a change that is not a modification or a new file."""
    out = subprocess.run(["git", "status", "--porcelain=v1", "-z", "--untracked-files=all"],
                         cwd=root, check=True, capture_output=True).stdout.decode("utf-8")
    paths, odd = [], []
    for entry in filter(None, out.split("\0")):
        code, path = entry[:2], entry[3:]
        if code in (" M", "??"):
            paths.append(path)
        else:
            odd.append(entry)
    if odd:
        sys.exit("::error::a refresh only modifies and adds files; git status also shows "
                 + ", ".join(odd))
    return sorted(paths)


def pack(out, root=ROOT):
    paths = changed_paths(root)
    bad = []
    for path in paths:
        tracked = subprocess.run(["git", "cat-file", "-e", f"HEAD:{path}"], cwd=root,
                                 check=False, capture_output=True).returncode == 0
        old = subprocess.run(["git", "show", f"HEAD:{path}"], cwd=root, check=True,
                             capture_output=True).stdout if tracked else None
        why = problem(path, _read(os.path.join(root, path)), old)
        if why:
            bad.append(f"{path} {why}")
    if bad:
        sys.exit("::error::the refresh wrote what it cannot land: " + "; ".join(bad))
    # Here, not only in the loop below: with no path to copy the loop never
    # runs, and paths.txt had no directory to go in (CR-78).
    os.makedirs(out, exist_ok=True)
    for path in paths:
        dest = os.path.join(out, TREE, path)
        os.makedirs(os.path.dirname(dest), exist_ok=True)
        shutil.copyfile(os.path.join(root, path), dest)
    with open(os.path.join(out, LIST), "w", encoding="utf-8") as f:
        f.write("# What the refresh changed, one path a line (refresh_tree.py)\n")
        f.writelines(p + "\n" for p in paths)
    print(f"packed {len(paths)} file(s): {', '.join(paths) or 'none'}")


def apply(src, root=ROOT):
    with open(os.path.join(src, LIST), encoding="utf-8") as f:
        listed = [line.rstrip("\n") for line in f if line.strip() and not line.startswith("#")]
    tree = os.path.join(src, TREE)
    bad, found = [], set()
    for dirpath, dirnames, filenames in os.walk(tree):
        for name in dirnames + filenames:
            full = os.path.join(dirpath, name)
            rel = os.path.relpath(full, tree).replace(os.sep, "/")
            if os.path.islink(full):
                bad.append(f"{rel} is a symlink")
            elif name in filenames:
                if os.path.isfile(full):
                    found.add(rel)
                else:
                    bad.append(f"{rel} is not a regular file")
    if len(set(listed)) != len(listed):
        bad.append("paths.txt lists a path twice")
    for rel in sorted(found - set(listed)):
        bad.append(f"{rel} is in the tree but not in paths.txt")
    for rel in sorted(set(listed) - found):
        bad.append(f"{rel} is in paths.txt but not in the tree")
    for path in listed:
        if path not in found:
            continue
        target = os.path.join(root, path)
        if os.path.islink(target):
            bad.append(f"{path} is a symlink in the checkout")
            continue
        why = problem(path, _read(os.path.join(tree, path)),
                      _read(target) if os.path.isfile(target) else None)
        if why:
            bad.append(f"{path} {why}")
    if bad:
        sys.exit("::error::not applying the refresh: " + "; ".join(bad))
    for path in listed:
        target = os.path.join(root, path)
        os.makedirs(os.path.dirname(target), exist_ok=True)
        shutil.copyfile(os.path.join(tree, path), target)
    print(f"applied {len(listed)} file(s): {', '.join(listed) or 'none'}")


if __name__ == "__main__":
    if len(sys.argv) != 3 or sys.argv[1] not in ("pack", "apply"):
        sys.exit("usage: refresh_tree.py pack|apply <dir>")
    (pack if sys.argv[1] == "pack" else apply)(sys.argv[2])
