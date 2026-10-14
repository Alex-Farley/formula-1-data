#!/usr/bin/env python3
"""
The two halves of a loop merge that are not the merge itself.

    python3 .claude/skills/backlog-loop/merge-step.py before <PR>
    gh pr merge <PR> --merge
    python3 .claude/skills/backlog-loop/merge-step.py after <PR>

`gh pr merge` stays the fork's own command, in the open, between the two:
auto mode reads it for a recorded verdict `[D-23]`, and a script that ran it
would put the merge where that check cannot see it.

`before` exits
    0  clear to merge: no refresh is ahead of this PR, and GitHub reports the
       branch up to date with main.
    3  main moved under the branch (BEHIND or DIRTY), or a refresh merged
       while this waited: `merge-main.py`, the web tests, `make ci`, push,
       `ci-wait.sh`, then `before` again.
    5  a refresh PR is still open after this call's wait: run `before` again.
    1  anything else GitHub reports - BLOCKED, DRAFT, UNKNOWN after retries,
       or this PR not open - with GitHub's word for it.
    4  gh cannot do this job at all.

`after` exits 0 only when the PR reads MERGED and every cleanup step did what
it should, 1 when the PR is not merged or its state could not be read (and
nothing was touched), 4 when gh cannot answer at all, and 2 when
the PR merged but a cleanup step failed - the step is named, and `after` can
be run again: every step it takes is idempotent but the refresh run, and a
second one of those only queues behind the first (`concurrency: refresh`).

WHY `after` EXISTS (AF-99)
    On 2026-10-14 `gh pr merge` on #979 was refused because main had moved,
    and the fork's post-merge steps ran anyway: they deleted the remote
    branch, which closed a reviewed, green PR unmerged, and set its issue to
    Done. The procedure listed the steps without gating them on a merge
    having happened. Here they are gated on the PR's own state, read back
    from GitHub, and never on the merge command's exit status.

    The remote branch is never deleted here. The repository deletes a head
    branch on merge (`delete_branch_on_merge`), and only on merge; a fork
    that deletes one by hand can only ever delete the branch of a PR that
    did not merge, which closes it.

WHY `before` WAITS FOR A REFRESH (AF-105)
    On 2026-10-14 UR-14 (#973) merged while the refresh's PR (#975) was open
    with Singapore 2026 in it. Both carry the committed artefacts, so #975
    went CONFLICTING, its auto-merge stalled, and the results waited for a
    second refresh run started by hand. Fresh data outranks any loop item:
    an open `refresh/f1db` PR merges first (it merges itself once its checks
    pass), and the loop PR then takes main and goes round CI again.

    A refresh not merged an hour after its last push is not waited on. It is
    stuck - its checks failed, or its auto-merge did - and refresh.yml's own
    alarm is the place that is reported; holding every loop merge behind it
    would stop the loop for nothing. `before` says so and lets the merge
    through, and `after` leaves one comment on that refresh PR naming the
    merge that went past it, so a person reading it knows its branch is now
    behind. refresh.yml rewrites the branch from main on its next run.
"""
import datetime as dt
import importlib.util
import json
import os
import re
import shutil
import subprocess
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))
REFRESH = "refresh/f1db"
STALE = dt.timedelta(hours=1)
# One call waits at most this long for a refresh, under the Bash tool's
# 600-second ceiling; `before` is run again for longer, as ci-wait.sh is.
WAIT = 540
POLL = 30
ALARMS = {"refresh-failing", "results-late"}
CLOSING = re.compile(r"^\s*(?:close[sd]?|fix(?:e[sd])?|resolve[sd]?)\s+#(\d+)\b", re.I | re.M)
# `Refs #n` is the alarm's form `AF-89`; a colon or a place mid-line is the
# same reference, and missing one would leave the alarm at *In progress*.
REFS = re.compile(r"\brefs?:?\s+#(\d+)\b", re.I)
CLEAR = {"CLEAN", "UNSTABLE", "HAS_HOOKS"}
MOVED = {"BEHIND", "DIRTY"}


def _sibling(name):
    spec = importlib.util.spec_from_file_location(f"_loop_{name.replace('-', '_')}",
                                                  os.path.join(HERE, f"{name}.py"))
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


class GhFailed(Exception):
    """A gh call that failed, with gh's own message."""


def gh(*args):
    """gh's stdout parsed as JSON; GhFailed with gh's message otherwise."""
    r = subprocess.run(["gh", *args], capture_output=True, text=True, check=False)
    if r.returncode:
        raise GhFailed(r.stderr.strip() or f"gh {' '.join(args)} failed")
    return json.loads(r.stdout) if r.stdout.strip() else None


def run(cmd, cwd=None):
    r = subprocess.run(cmd, cwd=cwd, capture_output=True, text=True, check=False)
    return r.returncode, (r.stdout + r.stderr).strip()


def issues_in(body):
    """(closed, referenced): the issue numbers a PR body closes, and those it
    only refers to with `Refs #n` - an alarm's form `AF-89`."""
    closed = sorted({int(n) for n in CLOSING.findall(body or "")})
    refs = sorted({int(n) for n in REFS.findall(body or "")} - set(closed))
    return closed, refs


def parse_time(stamp):
    return dt.datetime.fromisoformat(stamp.replace("Z", "+00:00"))


def pushed_at(pr):
    """When the refresh PR's head was last pushed: its newest commit's date.
    The PR itself may be days old, because refresh.yml rewrites one branch
    and edits the open PR rather than opening another."""
    dates = [parse_time(c["committedDate"]) for c in pr.get("commits") or [] if c.get("committedDate")]
    return max(dates) if dates else parse_time(pr["createdAt"])


def stuck(pr, now):
    return now - pushed_at(pr) >= STALE


def open_refresh(exclude=None):
    rows = gh("pr", "list", "--head", REFRESH, "--base", "main", "--state", "open",
              "--json", "number,url,createdAt,commits") or []
    return [r for r in rows if r["number"] != exclude]


def merge_state(n):
    """mergeStateStatus, asked again while GitHub is still computing it."""
    for _ in range(6):
        pr = gh("pr", "view", str(n), "--json", "state,mergeStateStatus,isDraft")
        if pr["state"] != "OPEN":
            return pr["state"]
        if pr["mergeStateStatus"] != "UNKNOWN":
            return pr["mergeStateStatus"]
        time.sleep(5)
    return "UNKNOWN"


def before(n, now=None, sleep=time.sleep):
    deadline = time.monotonic() + WAIT
    waited = False
    while True:
        moment = now or dt.datetime.now(dt.timezone.utc)
        rows = open_refresh(exclude=n)
        ahead = [r for r in rows if not stuck(r, moment)]
        late = [r for r in rows if stuck(r, moment)]
        if not ahead:
            break
        if time.monotonic() >= deadline:
            r = ahead[0]
            print(f"refresh PR #{r['number']} is still open (pushed {pushed_at(r):%H:%M} UTC): "
                  f"it merges first. Run `merge-step.py before {n}` again.")
            return 5
        if not waited:
            print(f"refresh PR #{ahead[0]['number']} is open: waiting for it to merge first")
            waited = True
        sleep(POLL)
    for r in late:
        print(f"refresh PR #{r['number']} has been open over an hour since its last push "
              f"({pushed_at(r):%Y-%m-%d %H:%M} UTC): stuck, not waited on. `after` will "
              f"note on it that #{n} merged past it.")
    state = merge_state(n)
    if state in CLEAR:
        print(f"PR #{n} is clear to merge ({state})")
        if state == "UNSTABLE":
            # Every required check is green under strict protection, so a
            # failure here is CodeQL or the Workers build - and a Workers
            # build that fails on the PR may fail on the deploy too.
            print("UNSTABLE: a check that is not required failed - read `gh pr checks "
                  f"{n}` before merging; a failed Workers build is a deploy that may fail")
        return 0
    if state in MOVED:
        print(f"PR #{n} is {state}: main moved under the branch. From the worktree: "
              f"merge-main.py, the web tests, `git add -A && make ci`, commit, push, "
              f"ci-wait.sh {n}, then `merge-step.py before {n}` again.")
        return 3
    if state in ("MERGED", "CLOSED"):
        print(f"PR #{n} is {state}, not open: there is nothing to merge.")
    else:
        print(f"PR #{n} is {state}: GitHub will not merge it as it stands. BLOCKED is most "
              f"often a required check not yet green - ci-wait.sh {n}, then `lint`.")
    return 1


def worktree_of(branch, porcelain):
    """(primary checkout, the worktree holding refs/heads/<branch> or None)."""
    blocks = [b for b in porcelain.strip().split("\n\n") if b.strip()]
    paths = []
    for b in blocks:
        fields = dict(line.split(" ", 1) if " " in line else (line, "") for line in b.splitlines())
        paths.append((fields.get("worktree"), fields.get("branch")))
    primary = paths[0][0] if paths else None
    held = next((p for p, ref in paths if ref == f"refs/heads/{branch}"), None)
    return primary, held


def after(n):
    pr = gh("pr", "view", str(n), "--json", "state,headRefName,body")
    if pr["state"] != "MERGED":
        print(f"PR #{n} is {pr['state']}, not MERGED: nothing cleaned up - no status moved, "
              f"no branch or worktree touched. A refused merge is `merge-step.py before {n}`'s "
              f"case, not this one.")
        return 1
    branch = pr["headRefName"]
    failed = []
    closed, refs = issues_in(pr["body"])
    filer = os.path.join(HERE, "file.py")
    for i in closed:
        code, out = run([sys.executable, filer, "status", str(i), "Done"])
        print(out)
        if code:
            failed.append(f"status #{i} Done")
    alarms = []
    for i in refs:
        try:
            issue = gh("issue", "view", str(i), "--json", "labels,state")
        except GhFailed as e:
            print(e)
            failed.append(f"read #{i}'s labels")
            continue
        if issue["state"] == "OPEN" and {lab["name"] for lab in issue["labels"]} & ALARMS:
            alarms.append(i)
    for i in alarms:
        code, out = run([sys.executable, filer, "status", str(i), "Now"])
        print(out)
        if code:
            failed.append(f"status #{i} Now")
    if alarms:
        code, out = run(["gh", "workflow", "run", "refresh.yml"])
        print(out or "refresh.yml started: the run that proves the fix")
        if code:
            failed.append("gh workflow run refresh.yml")
    moment = dt.datetime.now(dt.timezone.utc)
    try:
        late = [r for r in open_refresh() if stuck(r, moment)]
    except GhFailed as e:
        print(e)
        late = []
        failed.append("list open refresh PRs")
    mark = f"<!-- merged-past #{n} -->"
    for r in late:
        try:
            said = gh("pr", "view", str(r["number"]), "--json", "comments") or {}
        except GhFailed as e:
            print(e)
            failed.append(f"read refresh PR #{r['number']}'s comments")
            continue
        if any(mark in (c.get("body") or "") for c in said.get("comments", [])):
            continue
        code, out = run(["gh", "pr", "comment", str(r["number"]), "--body",
                         f"{mark}\nThe loop merged #{n} past this refresh, which had been open over "
                         f"an hour since its last push, so this branch is now behind main. "
                         f"refresh.yml rewrites it from main on its next run."])
        if code:
            failed.append(f"comment on refresh PR #{r['number']}")
    code, porcelain = run(["git", "worktree", "list", "--porcelain"])
    primary, held = worktree_of(branch, porcelain if code == 0 else "")
    if held and held != primary:
        code, out = run(["git", "worktree", "remove", held], cwd=primary)
        print(out or f"worktree removed: {held}")
        if code:
            failed.append(f"git worktree remove {held}")
    if primary and run(["git", "rev-parse", "--verify", "--quiet", f"refs/heads/{branch}"], cwd=primary)[0] == 0:
        code, out = run(["git", "branch", "-D", branch], cwd=primary)
        print(out)
        if code:
            failed.append(f"git branch -D {branch}")
    if primary:
        code, head = run(["git", "symbolic-ref", "--short", "HEAD"], cwd=primary)
        if code == 0 and head == "main":
            code, out = run(["git", "pull", "-q", "--ff-only"], cwd=primary)
            if code:
                print(out)
                failed.append("git pull in the primary checkout")
        else:
            print(f"primary checkout is not on main ({head}): not pulled")
    if failed:
        print(f"PR #{n} merged; these cleanup steps failed, and `after {n}` can be run again: "
              + "; ".join(failed))
        return 2
    print(f"PR #{n} merged and cleaned up")
    return 0


def main(argv):
    if len(argv) != 2 or argv[0] not in ("before", "after") or not argv[1].isdigit():
        print("usage: merge-step.py before|after <PR number>", file=sys.stderr)
        return 1
    preflight = _sibling("gh_preflight")
    if shutil.which("gh") is None:
        sys.stderr.write(preflight.note(preflight.MISSING))
        return 4
    n = int(argv[1])
    try:
        return before(n) if argv[0] == "before" else after(n)
    except GhFailed as e:
        # Before the merge, or before `after` has read the PR's state: so
        # nothing has been touched either way.
        print(e, file=sys.stderr)
        if preflight.unauthenticated():
            sys.stderr.write(preflight.note(preflight.UNAUTH))
            return 4
        return 1


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
