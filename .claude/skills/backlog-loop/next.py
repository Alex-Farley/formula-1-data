#!/usr/bin/env python3
"""
Print the next item of the queue, or one named item, and nothing else.

    python3 .claude/skills/backlog-loop/next.py               # first open item, queue order
    python3 .claude/skills/backlog-loop/next.py PD-02         # that item, wherever it sits
    python3 .claude/skills/backlog-loop/next.py --list Now    # one line per open item in a status
    python3 .claude/skills/backlog-loop/next.py --next-id PD  # the next unused number for a prefix
    python3 .claude/skills/backlog-loop/next.py --skip AF-03,VD-26   # the next item after those

The queue is GitHub Issues on Alex-Farley/formula-1-data, ranked on the Lap
Ledger project (users/Alex-Farley/projects/1). Since 2026-09-13; before that
it was docs/BACKLOG.md, and this script read that file. What it reads now:

- the project's *Status* field: *Now* before *Next* before *Someday*, and
  within a status the board's own order, top to bottom, which is what a
  person drags. *In progress* is a fork's or a person's open worktree and is
  never returned as next; *Done* is closed.
- the issue's labels: `decision` is a person's, printed as a reminder and
  never returned as next; `blocked` is an ordinary blocker a fork recorded
  (the comment says what) and is passed over, as `--skip` passes over ids
  the driver names.
- open issues only. A closed issue stays on the board as *Done*. An open
  issue with no Status (filed in the web UI and auto-added) or with *Done*
  while still open is not lost: it is listed under every item as
  *unplaced*, `--list unplaced` prints them, and `next.py <ID>` finds it.

Why a script and not `gh issue list`: the ranking lives on the board, not in
the issue list, and reading it is two `gh` calls and a join. The output is
one item - title, labels, body, the open decisions - for a few hundred
tokens, which is what the fork should read before it opens anything.

`--next-id PD` reads every issue, open and closed, and prints the first
number after the highest `PD-n` in use, so a new finding continues the
critique's own sequence and no id is reused (`file.py` calls this).

Exit 0 with the item on stdout; 1 when there is no open item (or the named
one is not open), with the reason on stderr; 2 when `gh` fails.
"""
import json
import os
import re
import subprocess
import sys

REPO = "Alex-Farley/formula-1-data"
OWNER = "Alex-Farley"
PROJECT = "1"
QUEUE = ("Now", "Next", "Someday")
ID = re.compile(r"^([A-Z]{2}-[0-9Ø]+): ")


def gh(*args):
    r = subprocess.run(["gh", *args], capture_output=True, text=True, check=False)
    if r.returncode:
        sys.stderr.write(r.stderr)
        sys.exit(2)
    return json.loads(r.stdout)


def load():
    """Open issues in board order: [(status, number, ident, title, labels, body, url)]."""
    board = gh("project", "item-list", PROJECT, "--owner", OWNER, "--format", "json", "--limit", "1000")["items"]
    open_issues = {i["number"]: i for i in gh("issue", "list", "--repo", REPO, "--state", "open",
                                              "--limit", "1000", "--json", "number,title,labels,body,url")}
    rows = []
    for item in board:
        c = item.get("content") or {}
        n = c.get("number")
        if c.get("type") != "Issue" or n not in open_issues:
            continue
        issue = open_issues[n]
        m = ID.match(issue["title"])
        rows.append(dict(status=item.get("status") or "", number=n, ident=m.group(1) if m else f"#{n}",
                         title=issue["title"], labels=sorted(lb["name"] for lb in issue["labels"]),
                         body=issue["body"] or "", url=issue["url"]))
    ranked = [r for s in QUEUE for r in rows if r["status"] == s]
    in_progress = [r for r in rows if r["status"] == "In progress"]
    # Open, on the board, and in no queue status: no Status at all, or Done
    # while still open. Never silently dropped - the loop's rule is that an
    # item goes missing only by a person's hand.
    unplaced = [r for r in rows if r["status"] not in QUEUE + ("In progress",)]
    return ranked, in_progress, unplaced


def show(row, decisions, in_progress, unplaced):
    print(f"## {row['status'] or 'no status'}  #{row['number']}  {row['url']}\n")
    print(row["title"])
    print("Labels: " + (", ".join(row["labels"]) or "none") + "\n")
    print(row["body"].rstrip() + "\n")
    if decisions:
        print("Decisions needed, still open — work around them, never take them:")
        for d in decisions:
            print(f"  #{d['number']}  {d['title']}")
    if in_progress:
        print("In progress elsewhere — an open worktree or PR; finish or reset it, do not start it again:")
        for d in in_progress:
            print(f"  #{d['number']}  {d['title']}")
    if unplaced:
        print("Unplaced — open, on the board, no queue status; give each one with `file.py status <n> <Now|Next|Someday>`:")
        for d in unplaced:
            print(f"  #{d['number']}  {d['title']}  (status: {d['status'] or 'none'})")


def next_id(prefix):
    """The number after the highest in use for a prefix - on any issue, open
    or closed, and in docs/LANDED.md, whose entries predate the issues and
    run higher than the open ones for some prefixes (CD, LV, UR)."""
    titles = [i["title"] for i in gh("issue", "list", "--repo", REPO, "--state", "all",
                                     "--limit", "1000", "--json", "title")]
    used = [int(m.group(1)) for t in titles for m in [re.match(rf"^{prefix}-(\d+): ", t)] if m]
    # Resolved from this file, not the cwd: a miss here would hand out a
    # landed id again, so a missing archive stops rather than falls back.
    archive_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "..", "docs", "LANDED.md")
    try:
        archive = open(archive_path, encoding="utf-8").read()
    except FileNotFoundError:
        sys.exit(f"{os.path.normpath(archive_path)} not found; the archive is needed to avoid reusing an id")
    used += [int(n) for n in re.findall(rf"^- \[[ x]\] `{prefix}-(\d+)`", archive, re.M)]
    return f"{prefix}-{(max(used) + 1 if used else 1):02d}"


def main(argv):
    skip = set()
    if "--skip" in argv:
        at = argv.index("--skip")
        if at + 1 >= len(argv):
            sys.exit("--skip needs a comma-separated list of ids")
        skip = {s.strip() for s in argv[at + 1].split(",") if s.strip()}
        argv = argv[:at] + argv[at + 2:]
    if argv[:1] == ["--next-id"]:
        if len(argv) != 2 or not re.fullmatch(r"[A-Z]{2}", argv[1]):
            sys.exit("--next-id needs a two-letter prefix, e.g. PD")
        print(next_id(argv[1]))
        return

    ranked, in_progress, unplaced = load()
    decisions = [r for r in ranked if "decision" in r["labels"]]
    everything = ranked + in_progress + unplaced

    if argv[:1] == ["--list"]:
        name = " ".join(argv[1:]) or "Now"
        if name not in QUEUE + ("In progress", "unplaced"):
            sys.exit(f"no status '{name}'; one of {', '.join(QUEUE)}, In progress, unplaced")
        rows = unplaced if name == "unplaced" else [r for r in everything if r["status"] == name]
        for r in rows:
            flags = "".join(f" [{f}]" for f in ("decision", "blocked") if f in r["labels"])
            if name == "unplaced":
                flags += f" (status: {r['status'] or 'none'})"
            size = next((lb[6:] for lb in r["labels"] if lb.startswith("size: ")), "-")
            title = r["title"][len(r["ident"]) + 2:] if r["title"].startswith(r["ident"] + ": ") else r["title"]
            print(f"#{r['number']:<4} {r['ident']:<6} {size:<2} {title}{flags}")
        return

    wanted = argv[0] if argv else None
    if wanted is None:
        for r in ranked:
            if r["ident"] in skip or "decision" in r["labels"] or "blocked" in r["labels"]:
                continue
            show(r, decisions, in_progress, unplaced)
            return
        sys.exit(f"no open item under {', '.join(QUEUE)} that is not a decision, blocked or in progress"
                 + (f"; {len(unplaced)} unplaced (--list unplaced)" if unplaced else ""))
    for r in everything:
        if r["ident"] == wanted or f"#{r['number']}" == wanted:
            show(r, decisions, in_progress, unplaced)
            return
    sys.exit(f"{wanted} is not an open issue on the board (landed, declined, never filed, or not yet auto-added)")


if __name__ == "__main__":
    main(sys.argv[1:])
