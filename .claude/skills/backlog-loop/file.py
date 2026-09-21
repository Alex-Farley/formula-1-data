#!/usr/bin/env python3
"""
Write to the queue: file an item, move one between statuses, mark one.

    python3 .claude/skills/backlog-loop/file.py new PD "Title." --size S --status Next --body-file note.md
    python3 .claude/skills/backlog-loop/file.py new AF "Title." --size M --body "one paragraph" --decision
    python3 .claude/skills/backlog-loop/file.py new CR "Title." --size S --body "..." --where "web/src/pages/Glossary.jsx, web/src/queries/glossary.js"
    python3 .claude/skills/backlog-loop/file.py status 123 "In progress"     # or Now, Next, Someday, Done
    python3 .claude/skills/backlog-loop/file.py blocked 123 "why, in one clause"
    python3 .claude/skills/backlog-loop/file.py decision 123 "what a person must decide"
    python3 .claude/skills/backlog-loop/file.py decline 123 "why, in one line"

The queue is GitHub Issues ranked on the Lap Ledger project; the conventions
are in CONTRIBUTING.md under *The queue*. Filing an item by hand is four
`gh` calls with three opaque ids; this does them in the right order and
prints `#n ID`. Nothing here merges, closes a landed item (the pull request
does that with `Closes #n`) or reorders the board (a person drags). The
board auto-adds every new issue of the repository, so `status` finds the
item before it adds one.

`--where` names the file paths the work would touch and appends them as a
`**Where:**` line, the spelling this project writes them in; `next.py --group`
reads a path wherever it appears in the body, so the line is a convention and
not a requirement of the grouping. A token the checkout does not track is a
warning and not a refusal - it may be a file the item creates. A token with a
space in it is prose, not a path, and is not checked, so the `not known yet`
the form advertises passes in silence. An item filed without `--where` is
filed, and simply cannot be grouped on a path `[D-34]`.

`new` takes the prefix and the title, gives it the next unused number in
that prefix (`next.py --next-id`), the `source:` label the prefix implies,
the `size:` label, and puts it on the board under the status given
(`Someday` by default) at the foot of that status: filing is not ranking, and
a discovered item joins the queue where nobody has judged it yet rather than
above everything a person has already ranked below it `[D-36]`. `--decision`
adds the label that keeps the loop off it.

`decline` closes an open issue as *not planned* with the reason as a comment
and refuses a closed one, so a landed record cannot be turned into a
declined one by a wrong number; `blocked` and `decision` add the label and a comment, so the record of why
is on the item, not in a fork's context that is about to be discarded.
"""
import argparse
import importlib.util
import json
import os
import re
import subprocess
import sys

sys.path.append(os.path.dirname(os.path.abspath(__file__)))  # behind the stdlib
import gh_preflight  # noqa: E402  (a sibling script, not an installed package)
import loop_cache  # noqa: E402


def _sibling(name):
    """Load a sibling script by path.

    `sys.path.append` puts this directory *last*, so `import next` would lose
    to any installed package of that name - and `next` is a plausible one.
    The two imports above predate this and keep their distinctive names;
    anything loaded here is loaded by its file.
    """
    here = os.path.dirname(os.path.abspath(__file__))
    spec = importlib.util.spec_from_file_location(f"_loop_{name}",
                                                  os.path.join(here, f"{name}.py"))
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


next_py = _sibling("next")  # the one normaliser - see tracked()

REPO = "Alex-Farley/formula-1-data"
OWNER = "Alex-Farley"
PROJECT = "1"
SOURCE = {
    "PD": "product design", "AX": "accessibility", "IX": "interaction design",
    "VD": "visual design", "CD": "content design", "IA": "information architecture",
    "DA": "data architecture", "SD": "service design", "UR": "user research",
    "PM": "project record", "AF": "maintainer", "CR": "code review",
    "LV": "live data", "WK": "Wikipedia survey",
}
STATUSES = ("Now", "Next", "Someday", "In progress", "Done")
HERE = os.path.dirname(os.path.abspath(__file__))
# The board's ids change only when a person edits the project; an item's id is
# stable while it is on the board. Both are re-read the moment they disagree
# with GitHub, so the only cost of a stale one is a wasted call.
BOARD_TTL = 3600
ITEMS_TTL = 900
# A failure that is not a stale id: retrying it wastes calls, and against the
# secondary limiter it extends the block. The pattern moved to gh_preflight
# with `PM-44`, so `next.py` can name the same failure without a second copy
# of it going quietly out of step with this one.
REFUSED = gh_preflight.DO_NOT_RETRY


def gh(*args, as_json=False):
    try:
        r = subprocess.run(["gh", *args], capture_output=True, text=True, check=False)
    except FileNotFoundError:
        sys.exit(gh_preflight.note(gh_preflight.MISSING))
    if r.returncode:
        said = r.stderr.strip() or f"gh {' '.join(args)} failed"
        # gh's own message first, always - see next.py's gh() for why.
        if gh_preflight.unauthenticated():
            sys.exit(f"{said}\n{gh_preflight.note(gh_preflight.UNAUTH)}")
        sys.exit(said)
    return json.loads(r.stdout) if as_json else r.stdout.strip()


def gh_try(*args):
    """(succeeded, stderr), for the one call allowed to fail: an `item-edit`
    against a cached id GitHub may no longer recognise. The caller decides,
    because most failures are not staleness and must not be retried."""
    try:
        r = subprocess.run(["gh", *args], capture_output=True, text=True, check=False)
    except FileNotFoundError:
        sys.exit(gh_preflight.note(gh_preflight.MISSING))
    return r.returncode == 0, r.stderr.strip()


def board(fresh=False):
    """(project id, Status field id, {status name: option id})."""
    if not fresh:
        hit = loop_cache.read("board", BOARD_TTL)
        if isinstance(hit, dict) and {"project", "field", "options"} <= hit.keys():
            return hit["project"], hit["field"], hit["options"]
    proj = gh("project", "view", PROJECT, "--owner", OWNER, "--format", "json", as_json=True)
    fields = gh("project", "field-list", PROJECT, "--owner", OWNER, "--format", "json", as_json=True)["fields"]
    status = next(f for f in fields if f["name"] == "Status")
    options = {o["name"]: o["id"] for o in status["options"]}
    loop_cache.write("board", {"project": proj["id"], "field": status["id"], "options": options})
    return proj["id"], status["id"], options


def item_ids(fresh=False):
    """{issue number: project item id} for everything on the board. This is
    the expensive read - a ProjectsV2 item-list of up to 1000 items - and it
    used to run once per status change, so a group of four paid it eight
    times."""
    if not fresh:
        hit = loop_cache.read("items", ITEMS_TTL)
        if isinstance(hit, dict) and all(
                str(n).isdigit() and isinstance(i, str) for n, i in hit.items()):
            return {int(n): i for n, i in hit.items()}
    items = gh("project", "item-list", PROJECT, "--owner", OWNER, "--format", "json", "--limit", "1000",
               as_json=True)["items"]
    ids = {c["number"]: i["id"] for i in items for c in [i.get("content") or {}] if c.get("number")}
    loop_cache.write("items", {str(n): i for n, i in ids.items()})
    return ids


def set_status(number, status):
    if status not in STATUSES:
        sys.exit(f"status must be one of {', '.join(STATUSES)}")
    # Two attempts. The first may answer from the cache; the second reads
    # GitHub for everything, so a stale id costs one wasted call and can
    # never write the wrong field or the wrong item.
    for fresh in (False, True):
        proj_id, field_id, options = board(fresh)
        if status not in options:
            if fresh:
                sys.exit(f"the board has no status {status!r}; it has {', '.join(sorted(options))}")
            continue
        item = item_ids(fresh).get(number)
        if item is None:
            url = f"https://github.com/{REPO}/issues/{number}"
            item = gh("project", "item-add", PROJECT, "--owner", OWNER, "--url", url, "--format", "json",
                      as_json=True)["id"]
            loop_cache.drop("items")
        ok, err = gh_try("project", "item-edit", "--project-id", proj_id, "--id", item,
                         "--field-id", field_id, "--single-select-option-id", options[status])
        if ok:
            # The queue cache holds the status this call just changed, and the
            # *In progress elsewhere* footer an inheriting fork reads is built
            # from it.
            loop_cache.drop("queue")
            return
        # Only staleness is worth a second attempt. A rate limit is the
        # failure this cache exists to avoid, and retrying extends it, so it
        # ends the run at the first refusal the way the uncached code did.
        if fresh or REFUSED.search(err):
            sys.exit(err or "gh project item-edit failed")
        loop_cache.drop("board")
        loop_cache.drop("items")


def where_line(body, where):
    """`body` with the paths `where` names appended as the `**Where:**` line.

    `next.py --group` scores a companion on the file paths a body names
    `[D-34]`, and `signals()` reads a path wherever it appears and looks for
    no marker - so the line is this project's house spelling and not
    something the grouping requires. What the marker is load-bearing for is
    the guard here, which keeps a second `--where` from appending a second
    line. Whitespace is not a `--where`: `--where "   "` is truthy and used
    to write the junk line `**Where:** .`

    A token the checkout does not track is a warning and not a refusal, since
    it may be a file the item will create; a wrong one costs a fork a
    worktree to discover, so it is said out loud rather than swallowed. A
    token holding a space is prose rather than a path and is not checked -
    that is what lets `not known yet` through without a warning.
    """
    where = (where or "").strip().rstrip(". ").strip()
    if not where or "**Where:**" in body:
        return body
    # A token with a space in it is prose - `not known yet`, the answer the
    # form advertises - and is not checked. Everything else is meant as a
    # path, including a directory or an extension-less one, which `signals()`
    # cannot read either and which the filer should hear about.
    unknown = [q for q in (t.strip() for t in where.split(","))
               if q and not re.search(r"\s", q) and not tracked(q)]
    if unknown:
        print("warning: not tracked in this checkout: " + ", ".join(unknown),
              file=sys.stderr)
    return body.rstrip() + "\n\n**Where:** " + where + "."


def tracked(path):
    """Is `path` a file of this checkout? False also when git cannot answer.

    The normalising and the bare-name resolution are `next.py`'s, imported
    rather than re-derived: the `lstrip("./")` defect was one rule kept by
    hand in two places, and a `--where` written `prerender.js` has to be
    judged by the same rule that will score it.
    """
    if not hasattr(tracked, "_files"):
        root = os.path.dirname(os.path.dirname(os.path.dirname(HERE)))
        try:
            out = subprocess.run(["git", "ls-files"], capture_output=True, text=True,
                                 check=False, cwd=root).stdout.split()
        except OSError:
            out = []
        tracked._files = {next_py.norm(f) for f in out}
    q = next_py.norm(path)
    return next_py.tree().get(q, q) in tracked._files


def new(a):
    if a.prefix not in SOURCE:
        sys.exit(f"unknown prefix {a.prefix}; one of {', '.join(sorted(SOURCE))}")
    if a.size not in ("S", "M", "L", "?"):
        sys.exit("--size is S, M, L or ?")
    ident = subprocess.run([sys.executable, os.path.join(HERE, "next.py"), "--next-id", a.prefix],
                           capture_output=True, text=True, check=True).stdout.strip()
    body = open(a.body_file, encoding="utf-8").read() if a.body_file else (a.body or "")
    if not body.strip():
        sys.exit("an item needs a body: what is wrong, where, and what would fix it")
    body = where_line(body, a.where)

    labels = [f"source: {SOURCE[a.prefix]}", f"size: {a.size}"] + (["decision"] if a.decision else [])
    args = ["issue", "create", "--repo", REPO, "--title", f"{ident}: {a.title}", "--body", body]
    for lb in labels:
        args += ["--label", lb]
    url = gh(*args).splitlines()[-1]
    number = int(url.rsplit("/", 1)[1])
    set_status(number, a.status)
    print(f"#{number} {ident}")


def mark(a, label, comment_prefix):
    gh("issue", "edit", str(a.number), "--repo", REPO, "--add-label", label)
    gh("issue", "comment", str(a.number), "--repo", REPO, "--body", f"**{comment_prefix}:** {a.reason}")
    print(f"#{a.number} {label}")


def decline(a):
    # Only an open issue is declined. A closed one is a record already - a
    # landed item or an earlier decline - and one wrong digit here would
    # rewrite it; that is a person's to undo, not this script's to make.
    issue = gh("issue", "view", str(a.number), "--repo", REPO, "--json", "state,stateReason,title", as_json=True)
    if issue["state"] != "OPEN":
        sys.exit(f"#{a.number} is already closed ({issue.get('stateReason') or issue['state']}): "
                 f"{issue['title']} - not declining a closed item")
    gh("issue", "close", str(a.number), "--repo", REPO, "--reason", "not planned",
       "--comment", f"**Declined:** {a.reason}")
    print(f"#{a.number} declined")


def main():
    p = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    sub = p.add_subparsers(dest="cmd", required=True)
    n = sub.add_parser("new")
    n.add_argument("prefix")
    n.add_argument("title")
    n.add_argument("--size", required=True)
    n.add_argument("--status", default="Someday")
    n.add_argument("--body")
    n.add_argument("--body-file")
    n.add_argument("--where", help="comma-separated file paths the work would touch")
    n.add_argument("--decision", action="store_true")
    s = sub.add_parser("status")
    s.add_argument("number", type=int)
    s.add_argument("status")
    for name in ("blocked", "decision", "decline"):
        q = sub.add_parser(name)
        q.add_argument("number", type=int)
        q.add_argument("reason")
    a = p.parse_args()
    if a.cmd == "new":
        new(a)
    elif a.cmd == "status":
        set_status(a.number, a.status)
        print(f"#{a.number} {a.status}")
    elif a.cmd == "blocked":
        mark(a, "blocked", "Blocked")
    elif a.cmd == "decision":
        mark(a, "decision", "Decision needed")
    elif a.cmd == "decline":
        decline(a)


if __name__ == "__main__":
    main()
