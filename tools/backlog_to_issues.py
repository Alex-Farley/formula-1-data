#!/usr/bin/env python3
"""
Move the open items of docs/BACKLOG.md into GitHub Issues, once.

Ran on 2026-09-13 against commit 1ab78c1: 157 open items became issues
#112-#268 on the Lap Ledger project, and docs/BACKLOG.md was retired
(its Landed and Declined sections are docs/LANDED.md). Kept as the record
of how each issue was derived - title, body, labels, status - and of the
id-to-issue mapping it wrote. It is not part of the build and it will not
create an issue whose id already has one.

    python3 backlog_to_issues.py docs/BACKLOG.md --dry-run      # the plan, nothing created
    python3 backlog_to_issues.py docs/BACKLOG.md --create       # issues + project items
    python3 backlog_to_issues.py docs/BACKLOG.md --link         # `ID` -> `ID` (#n) in bodies

One issue per open item, in the file's own order (Now, Next, Someday, top to
bottom), so issue numbers follow the ranking. Title `ID: title`; body the
item's text with a footer naming its source, size and the section it sat in;
labels `size: X` and `source: <discipline>` from the id's prefix, `decision`
where the size says so or the item is an open entry under *Decisions needed*.
Each issue is added to the Lap Ledger project with Status Now / Next /
Someday from its section. A mapping file is written as it goes, so a rerun
resumes rather than duplicating; an issue whose title already carries the id
is never created twice.
"""
import json
import os
import re
import subprocess
import sys
import time

REPO = "Alex-Farley/formula-1-data"
OWNER = "Alex-Farley"
PROJECT = 1
MAP_FILE = "docs/backlog_issue_map.json"
COMMIT = "1ab78c1"
DATE = "2026-09-13"

ITEM_RE = re.compile(r"^- \[( |x)\] `([A-Z]{2}-[0-9Ø]+)` (.*)$")
DECISION_OPEN_RE = re.compile(r"^- `([A-Z]{2}-\d+)` ")
SOURCE_BY_PREFIX = {
    "PD": "product design", "AX": "accessibility", "IX": "interaction design",
    "VD": "visual design", "CD": "content design", "IA": "information architecture",
    "DA": "data architecture", "SD": "service design", "UR": "user research",
    "PM": "project record", "AF": "maintainer", "CR": "code review",
    "LV": "live data", "WK": "Wikipedia survey",
}
STATUS_BY_SECTION = {"Now": "Now", "Next": "Next", "Someday, or maybe never": "Someday"}


def parse(path):
    lines = open(path, encoding="utf-8").read().split("\n")
    section = subsection = None
    items, open_decisions = [], set()
    i = 0
    while i < len(lines):
        ln = lines[i]
        if ln.startswith("## "):
            section, subsection = ln[3:].strip(), None
        elif ln.startswith("### "):
            subsection = ln[4:].strip()
        if section == "Decisions needed":
            d = DECISION_OPEN_RE.match(ln)
            if d:
                open_decisions.add(d.group(1))
        m = ITEM_RE.match(ln)
        if not m:
            i += 1
            continue
        block = [ln]
        j = i + 1
        while j < len(lines) and lines[j].startswith("      "):
            block.append(lines[j])
            j += 1
        done, iid, rest = m.group(1) == "x", m.group(2), m.group(3)
        body = "\n".join([rest] + [b[6:] for b in block[1:]])
        items.append(dict(id=iid, done=done, section=section, subsection=subsection, body=body, line=i + 1))
        i = j
    return items, open_decisions


def split_item(body):
    """title, text (without the title and the source/size tail), source, size, notes."""
    flat = body
    t = re.match(r"\*\*(.+?)\*\*\s*", flat, re.S)
    title = re.sub(r"\s+", " ", t.group(1)).strip() if t else None
    text = flat[t.end():] if t else flat
    # the item's own paragraph ends at the first dated note, if any
    parts = re.split(r"(?=^\*\*\d{4}-\d{2}-\d{2} [^*]+:\*\*)", text, maxsplit=1, flags=re.M)
    para, notes = parts[0], (parts[1] if len(parts) > 1 else "")
    src = size = None
    spans = list(re.finditer(r"—\s*\*([^*]+?)\*\s*$", para, re.M))
    if spans:
        tail = re.sub(r"\s+", " ", spans[-1].group(1)).strip()
        if "·" in tail:
            src, size = [x.strip() for x in tail.rsplit("·", 1)]
        else:
            src = tail
        para = para[: spans[-1].start()].rstrip()
    return title, para.strip(), notes.strip(), src, size


def labels_for(iid, size, open_decisions):
    out = ["source: " + SOURCE_BY_PREFIX[iid.split("-")[0]]]
    m = re.search(r"(?<![A-Za-z])([SML?])(?![A-Za-z])", size or "")
    if m:
        out.append("size: " + m.group(1))
    # `decision` when the item IS a decision, or a decision comes first; an
    # "M, then a decision" is M work first, and the loop may take the M.
    s = size or ""
    if s.startswith("decision") or "decision first" in s or "or decision" in s or iid in open_decisions:
        out.append("decision")
    return out


def plan(path):
    items, open_decisions = parse(path)
    out = []
    for it in items:
        if it["done"]:
            continue
        title, para, notes, src, size = split_item(it["body"])
        status = STATUS_BY_SECTION[it["section"]]
        where = it["section"] + (" › " + it["subsection"] if it["subsection"] else "")
        body = para
        if notes:
            body += "\n\n" + notes
        body += (
            f"\n\n---\n**Source:** {src} · **Size:** {size} · **Was under:** {where}\n"
            f"Filed in `docs/BACKLOG.md` until {DATE} (commit {COMMIT}), when the queue moved to "
            f"GitHub Issues; the conventions are in `CONTRIBUTING.md` under *The queue*. "
            f"A critique's full reasoning is in `docs/critiques/`."
        )
        out.append(dict(id=it["id"], title=f"{it['id']}: {title}", body=body, status=status,
                        labels=labels_for(it["id"], size, open_decisions), size=size, source=src, where=where))
    return out


def sh(args, retries=6):
    for attempt in range(retries):
        r = subprocess.run(args, capture_output=True, text=True, check=False)
        if r.returncode == 0:
            return r.stdout.strip()
        err = (r.stderr + r.stdout).lower()
        if any(k in err for k in ("rate limit", "abuse", "secondary", "try again", "502", "503")) and attempt < retries - 1:
            wait = 60 * (attempt + 1)
            print(f"    rate-limited; sleeping {wait}s", file=sys.stderr)
            time.sleep(wait)
            continue
        raise RuntimeError(f"{' '.join(args)}\n{r.stderr}")
    raise RuntimeError("unreachable")


def load_map():
    return json.load(open(MAP_FILE)) if os.path.exists(MAP_FILE) else {}


def save_map(m):
    json.dump(m, open(MAP_FILE, "w"), indent=1, sort_keys=True)


def existing_by_id():
    raw = sh(["gh", "issue", "list", "--repo", REPO, "--state", "all", "--limit", "1000", "--json", "number,title,url"])
    out = {}
    for x in json.loads(raw):
        m = re.match(r"([A-Z]{2}-[0-9Ø]+): ", x["title"])
        if m:
            out[m.group(1)] = x
    return out


def project_ids():
    proj = json.loads(sh(["gh", "project", "view", str(PROJECT), "--owner", OWNER, "--format", "json"]))
    fields = json.loads(sh(["gh", "project", "field-list", str(PROJECT), "--owner", OWNER, "--format", "json"]))["fields"]
    status = next(f for f in fields if f["name"] == "Status")
    return proj["id"], status["id"], {o["name"]: o["id"] for o in status["options"]}


def create(path):
    todo = plan(path)
    mapping = load_map()
    existing = existing_by_id()
    proj_id, status_id, options = project_ids()
    for n, it in enumerate(todo, 1):
        iid = it["id"]
        rec = mapping.get(iid, {})
        if "number" not in rec:
            if iid in existing:
                rec.update(number=existing[iid]["number"], url=existing[iid]["url"])
            else:
                args = ["gh", "issue", "create", "--repo", REPO, "--title", it["title"], "--body", it["body"]]
                for lb in it["labels"]:
                    args += ["--label", lb]
                url = sh(args).splitlines()[-1]
                rec.update(number=int(url.rsplit("/", 1)[1]), url=url)
                time.sleep(0.8)
            mapping[iid] = rec
            save_map(mapping)
        if "item" not in rec:
            # The board may already hold the issue (an auto-add workflow, or a
            # retried request): then find its item rather than fail.
            try:
                added = json.loads(sh(["gh", "project", "item-add", str(PROJECT), "--owner", OWNER, "--url", rec["url"], "--format", "json"]))
                rec["item"] = added["id"]
            except RuntimeError as e:
                if "already exists" not in str(e):
                    raise
                # The auto-add is eventually consistent: the add is refused
                # before the item is listed. Look again, a few times.
                for _ in range(6):
                    board = json.loads(sh(["gh", "project", "item-list", str(PROJECT), "--owner", OWNER, "--format", "json", "--limit", "1000"]))["items"]
                    found = [i["id"] for i in board if (i.get("content") or {}).get("number") == rec["number"]]
                    if found:
                        rec["item"] = found[0]
                        break
                    time.sleep(5)
                else:
                    raise
            save_map(mapping)
            time.sleep(0.5)
        if not rec.get("status"):
            sh(["gh", "project", "item-edit", "--project-id", proj_id, "--id", rec["item"],
                "--field-id", status_id, "--single-select-option-id", options[it["status"]]])
            rec["status"] = it["status"]
            save_map(mapping)
            time.sleep(0.5)
        print(f"{n:3}/{len(todo)} #{rec['number']} {it['status']:8} {iid}")


def link(path):
    """Second pass: every `ID` that names another migrated item becomes `ID` (#n)."""
    mapping = load_map()
    todo = plan(path)
    ids = "|".join(re.escape(k) for k in mapping)
    pat = re.compile(rf"`({ids})`(?! \(#)")
    for it in todo:
        rec = mapping[it["id"]]
        if rec.get("linked"):
            continue
        body = json.loads(sh(["gh", "issue", "view", str(rec["number"]), "--repo", REPO, "--json", "body"]))["body"]
        new = pat.sub(lambda m: f"`{m.group(1)}` (#{mapping[m.group(1)]['number']})" if m.group(1) != it["id"] else m.group(0), body)
        if new != body:
            sh(["gh", "issue", "edit", str(rec["number"]), "--repo", REPO, "--body", new])
            time.sleep(0.8)
            print(f"linked #{rec['number']} {it['id']}")
        rec["linked"] = True
        save_map(mapping)


if __name__ == "__main__":
    path, mode = sys.argv[1], sys.argv[2]
    if mode == "--dry-run":
        p = plan(path)
        from collections import Counter
        print(len(p), "issues;", Counter(x["status"] for x in p), Counter(tuple(sorted(l for l in x["labels"] if not l.startswith("source"))) for x in p))
        for x in p:
            print(f"{x['status']:8} {x['title'][:100]}  [{', '.join(x['labels'])}]")
        print("\n=== sample bodies ===")
        for x in p:
            if x["id"] in ("VD-26", "AX-13", "PM-37", "PD-28", "IA-19", "AX-07"):
                print(f"\n##### {x['title']}\n{x['body']}")
    elif mode == "--create":
        create(path)
    elif mode == "--link":
        link(path)
