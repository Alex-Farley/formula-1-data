#!/usr/bin/env python3
"""Which model implements the next item: the Sonnet trial's one rule (AF-144).

    python3 .claude/skills/backlog-loop/next.py --implementer [--skip A,B] [--max-size S]
    git diff --name-only origin/main...HEAD | python3 .claude/skills/backlog-loop/implementer.py

THE TRIAL
    On 2026-10-24 `/usage` put the week at Opus 98 %, Sonnet 2 %: every fork
    implemented on the session's model. The maintainer agreed a trial (AF-144,
    #1150): Sonnet implements XS and S items, review unchanged, and the trial
    is reverted if first-pass FAILs or missed findings come out worse over ten
    items than over the last ten XS and S items Opus implemented. D-60.

    The route is a second forked skill, `backlog-item-sonnet`, whose
    frontmatter says `model: sonnet`. That key is live in a fork - probed
    2026-10-27 by the per-model usage `claude -p --output-format json`
    reports, where the effort key was not (D-35) - so the driver chooses the
    model per item by choosing the skill, in the session it already runs, and
    no second process is needed.

WHAT KEEPS AN ITEM ON OPUS
    `choose()` below, in the order it asks, which is cheapest first:
    a `claude/` branch or pull request already open, which the next fork
    finishes whatever it is; no eligible head; an alarm or a security alert;
    a size other than XS or S, `?` included; a protected path named anywhere
    in the title or body; and the trial already holding TRIAL_ITEMS pull
    requests, merged or open, labelled LABEL, so that the trial stops itself
    at ten and waits for the item that measures it (AF-146) rather than
    running on unmeasured.

    A protected path is one where the item says Opus stays whatever the size:
    the data paths and the publishing paths, with the paths D-19 already
    gives an Opus first pass. The body is a claim about where the work lands
    (D-34), so the fork checks again against the code before claiming, and
    `precheck.sh` checks the diff itself: a pull request labelled LABEL that
    touches a protected path is refused there. Run with paths on stdin, this
    script prints the protected ones and exits 1 when there are any.
"""
import re
import sys

LABEL = "implementer: sonnet"
TRIAL_ITEMS = 10
SMALL = ("XS", "S")

# Files by name wherever they sit, and directories by their leading segment.
# A directory is matched only at the start of a path or after a space or a
# backtick, so `web/src/data/` is not `data/`. The item's own list - the data
# paths, the workflows, the release, export_json.py, prepare-assets.js - with
# the rest of what D-19 gives an Opus first pass (schema.sql, prerender.js),
# the rest of the deploy chain CLAUDE.md names (package.json and its lock,
# parquet-bundle.mjs, wrangler.jsonc), and the licence texts, which are what
# make the published database redistributable.
PROTECTED_FILES = ("build.py", "verify.py", "schema.sql", "export_json.py",
                   "prepare-assets.js", "prerender.js", "parquet-bundle.mjs",
                   "package.json", "package-lock.json", "wrangler.jsonc", "ATTRIBUTION.md")
# LICENSE, LICENSE-DATA, LICENSE-GEOMETRY and whatever joins them.
LICENCE = re.compile(r"(?<![\w-])LICEN[CS]E[\w.-]*")
PROTECTED_DIRS = ("data/", "harvest/", "tools/", ".github/workflows/")
# The release is a workflow (release.yml), and so is the refresh; a body names
# one by its file name more often than by its directory.
WORKFLOW = re.compile(r"\b[\w-]+\.ya?ml\b")


def _dir_pattern(d):
    return re.compile(r"(?:^|(?<=[\s`'\"(]))(?:\./)?" + re.escape(d))


DIRS = [_dir_pattern(d) for d in PROTECTED_DIRS]
FILES = [re.compile(r"(?<![\w-])" + re.escape(f) + r"\b") for f in PROTECTED_FILES]


def protected_in_text(text):
    """The protected paths a title or body names, sorted. Over-matching is
    the safe direction: it keeps an item on Opus."""
    found = set()
    for name, rx in zip(PROTECTED_FILES, FILES):
        if rx.search(text):
            found.add(name)
    for name, rx in zip(PROTECTED_DIRS, DIRS):
        if rx.search(text):
            found.add(name)
    found.update(m.group(0) for m in WORKFLOW.finditer(text))
    found.update(m.group(0) for m in LICENCE.finditer(text))
    return sorted(found)


def protected_files(paths):
    """The changed files, as `git diff --name-only` prints them, that are
    protected."""
    out = []
    for p in paths:
        p = p.strip()
        if not p:
            continue
        base = p.rsplit("/", 1)[-1]
        if (base in PROTECTED_FILES or LICENCE.fullmatch(base)
                or any(p.startswith(d) for d in PROTECTED_DIRS)):
            out.append(p)
    return out


def choose(head, open_work, trial_count):
    """("sonnet", why) or ("opus", why) for the item the fork would take.

    head        the queue's next eligible row, or None
    open_work   True when a `claude/` branch or pull request is open
    trial_count a callable returning how many pull requests carry LABEL,
                merged or open; called only when every other test passes,
                because it is the one that costs a GitHub read"""
    if open_work:
        return "opus", "a claude/ branch or pull request is open, and the fork finishes it whatever it is"
    if head is None:
        return "opus", "no eligible item; the fork says why"
    labels = set(head["labels"])
    if labels & {"refresh-failing", "results-late"} or "source: security" in labels:
        return "opus", f"{head['ident']} is an alarm or a security alert"
    size = next((lb[6:] for lb in head["labels"] if lb.startswith("size: ")), "?")
    if size not in SMALL:
        return "opus", f"{head['ident']} is size {size}"
    named = protected_in_text(head["title"] + "\n" + head.get("body", ""))
    if named:
        return "opus", f"{head['ident']} names a protected path: {', '.join(named)}"
    count = trial_count()
    if count >= TRIAL_ITEMS:
        return "opus", f"the trial holds {count} pull requests labelled '{LABEL}'; it waits to be measured (AF-146)"
    return "sonnet", f"{head['ident']} is size {size} and names no protected path ({count} of {TRIAL_ITEMS})"


def main():
    hits = protected_files(sys.stdin.read().splitlines())
    for p in hits:
        print(p)
    return 1 if hits else 0


if __name__ == "__main__":
    sys.exit(main())
