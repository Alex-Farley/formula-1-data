#!/usr/bin/env python3
"""
Print the next item of the queue, or one named item, and nothing else.

    python3 .claude/skills/backlog-loop/next.py               # first open item, queue order
    python3 .claude/skills/backlog-loop/next.py PD-02         # that item, wherever it sits
    python3 .claude/skills/backlog-loop/next.py PD-02 VD-26   # several items in full, for a group
    python3 .claude/skills/backlog-loop/next.py --group       # the next item, and what could ride with it
    python3 .claude/skills/backlog-loop/next.py --group AF-09 # a named item, and what could ride with it
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

`--group` prints a second block under the item: the open items, **of any
size**, in the item's own status or the next one down, that share a file
path, a route or a cross-reference with it, best score first. It **proposes;
it never groups.** A companion earns its place only by being cheaper because
it rides with the head - the same file, the same query, the same component,
the same test - and the pull request says why each one is there. Two items
that share nothing but a `source:` label are not a theme, and the score
cannot reach the threshold on that alone. Size is printed beside each
candidate and gates nothing: what is linked to the head rides with it
whatever it is sized, so the file gets opened once and the queue reduces
instead of returning to it item by item (decided 2026-09-14 by the
maintainer, replacing an S-only rule and a per-pace count). A path or route
that occurs in more than a few open items is dropped as noise before
scoring, so `f1.db` and `/drivers` never group anything by themselves.

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
from collections import Counter

sys.path.append(os.path.dirname(os.path.abspath(__file__)))  # behind the stdlib
import gh_preflight  # noqa: E402  (a sibling script, not an installed package)
import loop_cache  # noqa: E402

REPO = "Alex-Farley/formula-1-data"
OWNER = "Alex-Farley"
PROJECT = "1"
QUEUE = ("Now", "Next", "Someday")
# How stale the queue may be for a call that already names its items. Picking
# the next item never reads the cache - see loop_cache's docstring.
CACHE_TTL = 120
ID = re.compile(r"^([A-Z]{2}-[0-9Ø]+): ")
# The three signals a group is proposed on, read out of a title and body.
# A path or a route is a claim about where the work lands; a cross-reference
# is one item's author saying the two belong together. Nothing else scores
# enough to list a candidate on its own.
# The extensions this project keeps as files. A "/name.ext" is a filename
# when ext is one of these and a served path when it is not: /f1.db is the
# database, /build-status.txt is an address CLAUDE.md tells a reader to open.
SOURCE_EXT = "py|js|mjs|jsx|ts|tsx|css|json|sql|md|sh|yml|yaml|html|db"
PATH = re.compile(rf"(?:[\w.-]+/)*[\w.-]+\.(?:{SOURCE_EXT})\b")
# The lookbehind keeps the tail of a path out - the "/drivers" inside
# web/src/pages/drivers.jsx is preceded by a word character - and must not
# exclude a backtick: every route in this queue is written `/drivers`, and
# excluding it made the whole route signal dead text (found in review). The
# lookbehind's "." stops "./f1 gaps". Any extension is matched rather than
# excluded, so the route is captured whole and `signals` decides by what the
# extension is: "/f1.db" is a filename and goes, "/build-status.txt" is an
# address and stays. Dropping every extension lost the second (found in
# review); trimming instead of dropping would have turned "/f1.db" into the
# pseudo-route "/f1", walking the queue's noisiest token past a noise counter
# that cannot see it under that spelling. A route at the end of a sentence -
# "shown on /drivers." - keeps no full stop, because an extension needs a
# character after the dot.
# The extension is matched case-insensitively and up to eight characters so
# that "/f1.DB" and "/f1.database" are captured whole. Matching only four
# lowercase characters left both of them yielding the pseudo-route "/f1".
# This narrows that class rather than closing it: the group is optional, so
# "/f1.databases" and a bare "/f1." still fall back to "/f1". Those are
# affinity noise in a proposal rather than a wrong answer, and the spellings
# that actually occur are covered.
ROUTE = re.compile(r"(?<![\w/.])/[a-z][a-z0-9-]*(?:/[a-z0-9:<>-]+)*(?:\.(?i:[a-z0-9]{1,8})\b)?")
IS_FILE = re.compile(rf"\.(?:{SOURCE_EXT})$", re.I)
IDREF = re.compile(r"\b[A-Z]{2}-[0-9]+\b")
# There is no cap on how many candidates are listed. The group is what is
# linked to the head, so a cap would hide exactly the item it exists to
# take; the noise counter below is what stops a hot file proposing a crowd.
THRESHOLD = 3        # below this a candidate is not worth a fork's attention
NOISE = 4            # see below
# A signal more items than this name is noise, dropped before scoring.
# Measured over the 157 open items on 2026-09-14, the queue is bimodal: 149
# bodies name docs/backlog.md and contributing.md (a footer every issue
# carries), prerender.js names 10 and verify.py 8 - big files a dozen
# unrelated items each touch for their own reason - and every signal that
# means anything names two or three: cars.jsx, liveries.js, datatable.jsx,
# race.jsx, smoke.mjs. It is a constant and not a fraction of the queue
# because a file is named by the few items about it however long the queue
# grows. Five prerender.js items were proposed as one group before this.
# Those 2026-09-14 counts predate `AF-36`, which filled in the 99 bodies that
# named no path at all, and they are not what the queue reads now: build.py
# 46, prerender.js 27, app.css 13 on 2026-09-16 `[D-34]`. The constant held
# under that - raising it was measured and rejected - but the sentence above
# it did not: a hot file is named by a quarter of the queue, not by a few.
# What a signal costing nothing below the cliff and everything above it
# should be instead is open, and filed.


def gh(*args):
    try:
        r = subprocess.run(["gh", *args], capture_output=True, text=True, check=False)
    except FileNotFoundError:
        # A web session has no gh at all. The bare traceback this used to
        # raise named the binary and nothing else.
        sys.stderr.write(gh_preflight.note(gh_preflight.MISSING))
        sys.exit(2)
    if r.returncode:
        # gh's own message first, always: `unauthenticated()` cannot tell a
        # rejected token from an API it could not reach, so a secondary rate
        # limit would otherwise be answered with "go and fetch a new PAT".
        sys.stderr.write(r.stderr)
        if gh_preflight.unauthenticated():
            sys.stderr.write(gh_preflight.note(gh_preflight.UNAUTH))
        sys.exit(2)
    return json.loads(r.stdout)


def load(allow_cache=False):
    """Open issues in board order: [(status, number, ident, title, labels, body, url)].

    Two GraphQL reads, both `--limit 1000`, the first of them a ProjectsV2
    query - the expensive kind, and what tripped GitHub's secondary rate
    limiter on 2026-09-14. `allow_cache` is passed only by a call that names
    the items it wants, never by one choosing the next item."""
    if allow_cache:
        hit = loop_cache.read("queue", CACHE_TTL)
        if isinstance(hit, dict) and {"ranked", "in_progress", "unplaced"} <= hit.keys():
            return hit["ranked"], hit["in_progress"], hit["unplaced"]
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
    loop_cache.write("queue", {"ranked": ranked, "in_progress": in_progress, "unplaced": unplaced})
    return ranked, in_progress, unplaced


def show(row):
    print(f"## {row['status'] or 'no status'}  #{row['number']}  {row['url']}\n")
    print(row["title"])
    print("Labels: " + (", ".join(row["labels"]) or "none") + "\n")
    print(row["body"].rstrip() + "\n")


def footers(decisions, in_progress, unplaced):
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


def size_of(row):
    return next((lb[6:] for lb in row["labels"] if lb.startswith("size: ")), "?")


def eligible(row, skip):
    return (row["ident"] not in skip
            and "decision" not in row["labels"] and "blocked" not in row["labels"])


def first_eligible(ranked, skip):
    """The queue's own next item. `ranked` already excludes In progress."""
    return next((r for r in ranked if eligible(r, skip)), None)


def norm(path):
    """A path as the queue's two spellings of it agree.

    `lstrip("./")` strips a character *set*, so it took the leading dot off
    `.claude/...` and `.github/...` and left `claude/...`. Harmless while
    both sides of a comparison were mangled alike, and not harmless once
    `tree()` began matching a bare name against `git ls-files`, which keeps
    the dot: every dotfile path would have missed its own basename.
    """
    p = path.lower()
    return p[2:] if p.startswith("./") else p


def tree():
    """basename -> the one tracked file with that name, lowercased.

    A body writes a file either way - `prerender.js` in ten items, and
    `web/scripts/prerender.js` in seventeen more since `AF-36` filled the
    bodies in. Those were two signals that never matched each other, so the
    ten and the seventeen did not group and the noise counter saw neither
    count whole (measured 2026-09-16: 32 such splits across the open queue,
    `datatable.jsx` against `web/src/components/datatable.jsx` among them).
    A bare name resolves to its full path here so the two spellings are one
    signal `[D-34]`.

    Only a basename unique in the tree resolves. `README.md` is three
    different files and stays three - guessing which one an item meant is
    how a group is proposed on a file the item never mentioned.
    """
    if not hasattr(tree, "_map"):
        root = os.path.dirname(os.path.dirname(os.path.dirname(
            os.path.dirname(os.path.abspath(__file__)))))
        try:
            out = subprocess.run(["git", "ls-files"], capture_output=True, text=True,
                                 check=False, cwd=root).stdout.split()
        except OSError:
            # No git, or not a checkout. Every name then stays as written,
            # which is what this did before the map existed.
            out = []
        seen = Counter(norm(f).rsplit("/", 1)[-1] for f in out)
        tree._map = {norm(f).rsplit("/", 1)[-1]: norm(f) for f in out
                     if seen[norm(f).rsplit("/", 1)[-1]] == 1}
    return tree._map


def signals(row):
    """(paths, routes, ids) named anywhere in the item's title or body."""
    text = row["title"] + "\n" + row["body"]
    full = tree()
    paths = {full.get(m, m) for m in (norm(x) for x in PATH.findall(text))}
    routes = {m for m in ROUTE.findall(text) if not IS_FILE.search(m)}
    return paths, routes, set(IDREF.findall(text)) - {row["ident"]}


def bands(head):
    """The statuses a companion may be drawn from: the head's and the one
    below it. A head named by hand can be In progress or unplaced, and the
    search starts at the top of the queue for it."""
    i = QUEUE.index(head["status"]) if head["status"] in QUEUE else 0
    return QUEUE[i:i + 2]


def companions(head, ranked, skip, taken):
    """Score every open item that could ride with the head; best first.

    Size is not a filter, at either end: a head of any size may carry
    companions, and a companion of any size may ride, because what makes one
    cheap is the reading it shares with the head and not how big it is. What
    still filters is the head's own status band or the one below it - a
    companion from lower down is being promoted past everything between,
    which only a shared file pays for, and the fork has to say so in the pull
    request. A signal shared with more than a few open items says nothing
    about these two, so it is dropped before anything is scored."""
    allowed = bands(head)
    tok = {r["number"]: signals(r) for r in ranked}
    tok.setdefault(head["number"], signals(head))
    df_path, df_route = Counter(), Counter()
    for paths, routes, _ in tok.values():
        df_path.update(paths)
        df_route.update(routes)
    common = NOISE
    hp, hr, hi = tok[head["number"]]
    rank = {r["number"]: i for i, r in enumerate(ranked)}
    head_rank = rank.get(head["number"])
    out = []
    for row in ranked:
        if row["number"] == head["number"] or row["number"] in taken or not eligible(row, skip):
            continue
        if row["status"] not in allowed:
            continue
        cp, cr, ci = tok[row["number"]]
        score, why = 0, []
        if head["ident"] in ci:
            score += 4
            why.append(f"names {head['ident']}")
        elif row["ident"] in hi:
            score += 4
            why.append(f"named by {head['ident']}")
        shared_paths = sorted(p for p in hp & cp if df_path[p] <= common)
        shared_routes = sorted(t for t in hr & cr if df_route[t] <= common)
        if shared_paths:
            # A shared prose file is where two items would each add a
            # paragraph, not where the work is: on the first live run it
            # proposed a Cloudflare settings item as a companion to a livery
            # one because both name web/README.md. One is worth a third of a
            # source file, so a single shared prose file cannot reach the
            # threshold alone; three of them can, and two items that edit the
            # same three documents are a theme.
            score += min(6, sum(1 if p.endswith(".md") else 3 for p in shared_paths))
            why.append("shares " + ", ".join(shared_paths[:3]))
        if shared_routes:
            score += min(4, 2 * len(shared_routes))
            why.append("both on " + ", ".join(shared_routes[:3]))
        if row["ident"].split("-")[0] == head["ident"].split("-")[0]:
            score += 1
            why.append("same source")
        if head_rank is not None and abs(rank[row["number"]] - head_rank) <= 3:
            score += 1
            why.append("ranked beside it")
        if score >= THRESHOLD:
            out.append((score, row, why))
    out.sort(key=lambda t: (-t[0], rank[t[1]["number"]]))
    return out


def show_companions(head, ranked, skip, taken):
    print(f"## Companions for {head['ident']} (size {size_of(head)}) — proposals, not a group\n")
    rows = companions(head, ranked, skip, taken)
    if not rows:
        print(f"None: no open item under {' or '.join(bands(head))} shares a file, a route or a"
              f"\ncross-reference with {head['ident']}. One item, one PR.\n")
        return
    for score, row, why in rows:
        title = row["title"][len(row["ident"]) + 2:] if row["title"].startswith(row["ident"] + ": ") else row["title"]
        print(f"  #{row['number']:<4} {row['ident']:<6} {size_of(row):<2} {row['status']:<7} {score:>2}  "
              f"{'; '.join(why)}\n        {title[:76]}")
    print("\nA score is a hint. A companion joins only if it is cheaper because it rides"
          "\nwith the head - the same file, the same query, the same component - and the PR"
          "\nsays why each one is there; a shared source label is not a theme. Size is shown"
          "\nbecause it is a cost to weigh, not a gate: take what is linked, and drop the last"
          "\none added if the diff stops reading as one change. Full bodies before you decide:"
          f"\n  python3 .claude/skills/backlog-loop/next.py {head['ident']} "
          + " ".join(r["ident"] for _, r, _ in rows) + "\n")


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
    group = "--group" in argv
    if group:
        argv = [a for a in argv if a != "--group"]
    if argv[:1] == ["--next-id"]:
        if len(argv) != 2 or not re.fullmatch(r"[A-Z]{2}", argv[1]):
            sys.exit("--next-id needs a two-letter prefix, e.g. PD")
        print(next_id(argv[1]))
        return

    # A call that names its items is reading bodies it has already chosen, so
    # it may use the cache the previous call wrote. Anything that chooses
    # reads GitHub: `next.py`, and `--group` in both its forms - `--group` is
    # stripped from argv above, so without the `not group` clause
    # `next.py --group AF-09` would score every candidate against a snapshot.
    ranked, in_progress, unplaced = load(
        allow_cache=bool(argv) and not group and argv[0] != "--list")
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

    if argv:
        heads = []
        for wanted in argv:
            row = next((r for r in everything if r["ident"] == wanted or f"#{r['number']}" == wanted), None)
            if row is None:
                sys.exit(f"{wanted} is not an open issue on the board "
                         "(landed, declined, never filed, or not yet auto-added)")
            heads.append(row)
    else:
        head = first_eligible(ranked, skip)
        if head is None:
            sys.exit(f"no open item under {', '.join(QUEUE)} that is not a decision, blocked or in progress"
                     + (f"; {len(unplaced)} unplaced (--list unplaced)" if unplaced else ""))
        heads = [head]

    for row in heads:
        show(row)
    if group:
        show_companions(heads[0], ranked, skip, {r["number"] for r in heads})
    footers(decisions, in_progress, unplaced)


if __name__ == "__main__":
    main(sys.argv[1:])
