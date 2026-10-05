#!/usr/bin/env python3
"""Keep one issue open while the refresh is failing, and one while the data
is behind the calendar (SD-35).

    refresh_alarm.py failure     refresh.yml's `report` job, every run
    refresh_alarm.py freshness   the same job, every run

From 2026-10-02 09:00 every run of refresh.yml failed - sixteen of them by
2026-10-05 - and nobody knew for three days, because a failed scheduled run
tells only whoever last touched the workflow, and the check date on the site
tells only someone who goes and looks at it. Both halves here say so where a
person is told without looking: an issue, assigned to the repository's
owner, which GitHub notifies.

ONE ISSUE EACH, NEVER ONE PER RUN
    The refresh runs every three hours, and a failing run does not stamp the
    check date, so the gate lets every one of them through: a failure that
    lasts a day is eight failed runs. Each half finds its issue by label.
    While it stays open a repeat of the same failure only rewrites the body
    (the latest run, and how many have failed); a comment, which notifies,
    is added only when what is failing changes. The state that tells the two
    apart rides in a marker at the foot of the body, not in a file, because
    nothing else survives from one run to the next.

    failure    opened by a run in which any job failed or timed out; closed
               by the first run after it whose `land` job passes. A run the gate stopped,
               or one a person cancelled, says nothing about the pipeline
               either way and leaves the issue as it is.
    freshness  refresh_health.py's verdict on what is committed, on every
               run, including the runs the gate stops: open while it finds
               a race late, closed when it finds none. It reads no output of
               the refresh, so a refresh that never runs at all - disabled,
               or broken before its first step - is still caught here as
               soon as a race goes unreported.

Needs GH_TOKEN (the workflow's own token, with issues: write and actions:
read - never the refresh App's), GH_REPO, RUN_ID, RUN_URL and OWNER; for
`failure`, the three jobs' results as GATE, REFRESH and LAND.
"""
import json
import os
import re
import subprocess
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import refresh_health  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
# Greedy to the ` -->` that closes the marker, so a brace inside a step's
# name cannot end the JSON early. json.dumps writes it on one line.
MARK = re.compile(r"<!-- refresh-alarm (\{.*\}) -->")

FAILING = dict(label="refresh-failing", colour="B60205",
               description="refresh.yml is failing; opened and closed by the workflow",
               title="The refresh from F1DB is failing")
LATE = dict(label="results-late", colour="D93F0B",
            description="A race has gone unreported past its date; opened and closed by refresh.yml",
            title="Results are behind the calendar")


# ------------------------------------------------------------- the decisions

def failure_action(results, is_open):
    """'open', 'update', 'close' or None, from the three jobs' results.

    `cancelled` counts as failing. The report job does not run in a run a
    person cancelled (`!cancelled()`), so a job cancelled in a run it does
    run in is one that hit its timeout-minutes - a hung fetch is a failure."""
    if {"failure", "cancelled"} & set(results.values()):
        return "update" if is_open else "open"
    if results.get("land") == "success" and is_open:
        return "close"
    return None


def freshness_action(problems, is_open):
    if problems:
        return "update" if is_open else "open"
    return "close" if is_open else None


def read_mark(body):
    """The state a previous run left at the foot of the body, or {}."""
    m = MARK.search(body or "")
    try:
        return json.loads(m.group(1)) if m else {}
    except ValueError:
        return {}


def with_mark(text, state):
    return f"{text}\n\n<!-- refresh-alarm {json.dumps(state, sort_keys=True)} -->\n"


def failure_body(failing, run_url, when, count, first):
    lines = "\n".join(f"- {f}" for f in failing) or "- (the run's jobs could not be read)"
    return (
        "The scheduled refresh of the harvest from F1DB is failing. Until a run passes, "
        "nothing new reaches the database and lapledger.org keeps the last snapshot "
        "that did.\n\n"
        f"**What failed in the latest run:**\n{lines}\n\n"
        f"**Latest failed run:** {run_url} ({when})\n\n"
        f"**Failed runs since this was opened:** {count}, the first on {first}.\n\n"
        "This issue is kept by refresh.yml's `report` job: it is updated on every "
        "failed run, commented on when what is failing changes, and closed by the "
        "first run after it that passes, as far as handing its change to the pull "
        "request that merges itself once CI passes. The run's log says why; `docs/UPSTREAM.md` "
        "says how to check the sync by hand.")


def freshness_body(report, run_url):
    return (
        f"{report}\n\n"
        f"**Checked by:** {run_url}\n\n"
        "This is measured against the race dates, not against when the refresh last "
        "ran, so it says the same thing whether or not the refresh is running. It is "
        "kept by refresh.yml's `report` job, which runs "
        "`.github/scripts/refresh_health.py` on every run and closes this issue on the "
        "first run that finds no race late.")


# ---------------------------------------------------------------- the effects

def gh(*args, check=True):
    out = subprocess.run(["gh", *args], capture_output=True, text=True, check=False)
    if check and out.returncode:
        sys.exit(f"gh {' '.join(args[:2])} failed: {out.stderr.strip()}")
    return out


def find(kind):
    gh("label", "create", kind["label"], "--color", kind["colour"],
       "--description", kind["description"], "--force")
    found = json.loads(gh("issue", "list", "--label", kind["label"], "--state", "open",
                          "--json", "number,body", "--limit", "1").stdout)
    return found[0] if found else None


def open_issue(kind, body):
    args = ("issue", "create", "--title", kind["title"], "--label", kind["label"],
            "--body", body)
    # Assigned, so the owner is told whether or not they watch the repository.
    # An owner that cannot be assigned (an organisation) still gets the issue.
    if gh(*args, "--assignee", os.environ["OWNER"], check=False).returncode:
        gh(*args)


def failing_steps(run_id):
    """['job: step'] for every failed step of this run, or [] if unreadable."""
    out = gh("run", "view", run_id, "--json", "jobs", check=False)
    if out.returncode:
        return []
    found = []
    for job in json.loads(out.stdout)["jobs"]:
        if job.get("conclusion") not in ("failure", "cancelled"):
            continue
        steps = [s["name"] for s in job.get("steps", []) if s.get("conclusion") in ("failure", "cancelled")]
        found += [f"`{job['name']}`: {s}" for s in steps] or [f"`{job['name']}`"]
    return found


def now_utc():
    return refresh_health.dt.datetime.now(refresh_health.dt.timezone.utc)


def failure():
    results = {k.lower(): os.environ.get(k, "") for k in ("GATE", "REFRESH", "LAND")}
    print(f"job results: {results}")
    issue = find(FAILING)
    action = failure_action(results, issue is not None)
    run_url = os.environ["RUN_URL"]
    if action == "close":
        gh("issue", "close", str(issue["number"]), "--comment",
           f"{run_url} passed, as far as handing its change to the pull request that "
           "merges itself once CI passes. Closing.")
    elif action:
        failing = failing_steps(os.environ["RUN_ID"])
        state = read_mark(issue["body"]) if issue else {}
        when = now_utc().strftime("%Y-%m-%d %H:%M UTC")
        first = state.get("first", when[:10])
        count = state.get("count", 0) + 1
        signature = " / ".join(failing) or "unknown"
        body = with_mark(failure_body(failing, run_url, when, count, first),
                         dict(signature=signature, count=count, first=first))
        if action == "open":
            open_issue(FAILING, body)
        else:
            gh("issue", "edit", str(issue["number"]), "--body", body)
            if signature != state.get("signature"):
                gh("issue", "comment", str(issue["number"]), "--body",
                   f"What is failing has changed, as of {run_url}:\n\n"
                   + "\n".join(f"- {f}" for f in failing))
    print(f"failure issue: {action or 'nothing to do'}")


def freshness():
    today = refresh_health.today_utc()
    problems, notes = refresh_health.check(os.path.join(ROOT, "f1.db"),
                                           os.path.join(ROOT, "harvest", "race_dates.txt"),
                                           today)
    report = refresh_health.report(problems, notes, today)
    print(report)
    issue = find(LATE)
    action = freshness_action(problems, issue is not None)
    run_url = os.environ["RUN_URL"]
    if action == "close":
        gh("issue", "close", str(issue["number"]), "--comment", f"{report}\n\n({run_url})")
    elif action:
        keys = sorted(k for k, _ in problems)
        body = with_mark(freshness_body(report, run_url), dict(keys=keys))
        if action == "open":
            open_issue(LATE, body)
        else:
            before = read_mark(issue["body"]).get("keys")
            gh("issue", "edit", str(issue["number"]), "--body", body)
            if keys != before:
                gh("issue", "comment", str(issue["number"]), "--body",
                   "What is late has changed:\n\n" + "\n".join(line for _, line in problems))
    print(f"freshness issue: {action or 'nothing to do'}")


if __name__ == "__main__":
    {"failure": failure, "freshness": freshness}[sys.argv[1]]()
