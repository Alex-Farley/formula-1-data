#!/usr/bin/env python3
"""
Write to the queue: file an item, move one between statuses, mark one.

    python3 .claude/skills/backlog-loop/file.py new PD "Title." --size S --status Next --body-file note.md
    python3 .claude/skills/backlog-loop/file.py new AF "Title." --size M --body "one paragraph" --decision
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

`new` takes the prefix and the title, gives it the next unused number in
that prefix (`next.py --next-id`), the `source:` label the prefix implies,
the `size:` label, and puts it on the board under the status given
(`Next` by default) at the foot of that status. `--decision` adds the label
that keeps the loop off it.

`decline` closes an open issue as *not planned* with the reason as a comment
and refuses a closed one, so a landed record cannot be turned into a
declined one by a wrong number; `blocked` and `decision` add the label and a comment, so the record of why
is on the item, not in a fork's context that is about to be discarded.
"""
import argparse
import json
import os
import subprocess
import sys

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


def gh(*args, as_json=False):
    r = subprocess.run(["gh", *args], capture_output=True, text=True, check=False)
    if r.returncode:
        sys.exit(r.stderr.strip() or f"gh {' '.join(args)} failed")
    return json.loads(r.stdout) if as_json else r.stdout.strip()


def board():
    proj = gh("project", "view", PROJECT, "--owner", OWNER, "--format", "json", as_json=True)
    fields = gh("project", "field-list", PROJECT, "--owner", OWNER, "--format", "json", as_json=True)["fields"]
    status = next(f for f in fields if f["name"] == "Status")
    return proj["id"], status["id"], {o["name"]: o["id"] for o in status["options"]}


def set_status(number, status):
    if status not in STATUSES:
        sys.exit(f"status must be one of {', '.join(STATUSES)}")
    proj_id, field_id, options = board()
    url = f"https://github.com/{REPO}/issues/{number}"
    items = gh("project", "item-list", PROJECT, "--owner", OWNER, "--format", "json", "--limit", "1000",
               as_json=True)["items"]
    item = next((i["id"] for i in items if (i.get("content") or {}).get("number") == number), None)
    if item is None:
        item = gh("project", "item-add", PROJECT, "--owner", OWNER, "--url", url, "--format", "json",
                  as_json=True)["id"]
    gh("project", "item-edit", "--project-id", proj_id, "--id", item, "--field-id", field_id,
       "--single-select-option-id", options[status])


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
    n.add_argument("--status", default="Next")
    n.add_argument("--body")
    n.add_argument("--body-file")
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
