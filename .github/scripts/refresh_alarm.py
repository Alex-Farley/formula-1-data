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

    failure    opened by a run in which any job failed or timed out, or
               which finds the refresh's own pull request refused by CI;
               closed by the first run after it whose `land` job passes
               while that pull request has no refused CI run. A run the
               gate stopped, or one a person cancelled, says nothing about
               the pipeline either way and leaves the issue as it is.
    freshness  refresh_health.py's verdict on what is committed, on every
               run, including the runs the gate stops: open while it finds
               a race late, closed when it finds none. It reads no output of
               the refresh, so a refresh that never runs at all - disabled,
               or broken before its first step - is still caught here as
               soon as a race goes unreported.

THE PULL REQUEST CI REFUSES (SD-36)
    `land` passing means only that the refresh reached its pull request,
    which merges itself once ci.yml's required checks pass ([D-45]). When
    CI refuses it the pull request stays open and every refresh run is
    green, so nothing above fired: the only signal left was a race going
    three days unreported. So `failure` also reads the open pull request
    from refresh/f1db and the latest ci.yml run on it that has finished,
    and a refused one counts as a failing refresh.

    ci.yml's runs, not the pull request's checks, because `land` rewrites
    the branch on every run that goes ahead - eight a day on a race weekend
    - and the checks on a head pushed a minute ago are still pending. Read
    off the head, a refusal would be replaced by a pending check before any
    run saw it. ci.yml's jobs are main's required checks, all four of them.
    A cancelled CI run is one a newer push superseded (ci.yml cancels in
    progress on pull requests) and says nothing, unless nothing is newer,
    in which case it is a job that hit its timeout.

    Only this repository's own: a branch name is not an identity. Anyone
    can open a pull request from a fork's `refresh/f1db`, and ci.yml runs
    on it from the fork's copy of the workflow, so matched by name a
    stranger's run could raise the alarm, hide a real refusal, or write
    its own job names into the issue (security review on #812).

Needs GH_TOKEN (the workflow's own token, with issues: write, actions: read
and pull-requests: read - never the refresh App's), GH_REPO, RUN_ID, RUN_URL
and OWNER; for `failure`, the three jobs' results as GATE, REFRESH and LAND.
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
# What land-refresh.sh pushes and opens its pull request from, and the
# workflow whose jobs are main's required checks.
BRANCH = "refresh/f1db"
CI = "ci.yml"
REFUSED = ("failure", "timed_out", "startup_failure")

LATE = dict(label="results-late", colour="D93F0B",
            description="A race has gone unreported past its date; opened and closed by refresh.yml",
            title="Results are behind the calendar")


# ------------------------------------------------------------- the decisions

def failure_action(results, is_open, refused=False):
    """'open', 'update', 'close' or None, from the three jobs' results and
    whether CI is refusing the refresh's pull request.

    `cancelled` counts as failing. The report job does not run in a run a
    person cancelled (`!cancelled()`), so a job cancelled in a run it does
    run in is one that hit its timeout-minutes - a hung fetch is a failure.
    A `land` that passed does not close the issue while CI refuses what it
    landed: it reached a pull request that will never merge."""
    if refused or {"failure", "cancelled"} & set(results.values()):
        return "update" if is_open else "open"
    if results.get("land") == "success" and is_open:
        return "close"
    return None


def own_runs(repo, api_runs):
    """The REST API's workflow runs reduced to the fields refused_run()
    reads, keeping only those whose head is in `repo`."""
    return [dict(databaseId=r["id"], status=r.get("status"), conclusion=r.get("conclusion"),
                 createdAt=r.get("created_at", ""), url=r.get("html_url"))
            for r in api_runs
            if (r.get("head_repository") or {}).get("full_name") == repo]


def refused_run(pr, runs):
    """The ci.yml run that settles whether CI refuses the pull request,
    if it does, else None.

    `runs` newest first, as `gh run list` gives them. Only runs since the
    pull request was opened count: the branch is deleted on merge and
    reused by the next refresh, so older runs belong to a pull request that
    has already merged. The first finished run decides, skipping a
    cancelled one that a newer run superseded."""
    newer = False
    for run in runs:
        if run.get("createdAt", "") < pr["createdAt"]:
            break
        if run.get("status") != "completed":
            newer = True
            continue
        conclusion = run.get("conclusion")
        if conclusion == "cancelled" and newer:
            continue
        if conclusion in REFUSED or conclusion == "cancelled":
            return run
        return None
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


def bullets(items):
    return "\n".join(f"- {i}" for i in items)


def failure_body(failing, run_url, when, count, first, refusal=None):
    """`failing` is this run's failed steps, or None when this run passed
    and only the pull request is failing; `refusal` is (where, steps): the
    pull request and the CI run refusing it, and that run's failed steps."""
    parts = [
        "The scheduled refresh of the harvest from F1DB is failing. Until it lands, "
        "nothing new reaches the database and lapledger.org keeps the last snapshot "
        "that did."]
    if failing is not None:
        parts.append("**What failed in the latest run:**\n"
                     + (bullets(failing) or "- (the run's jobs could not be read)"))
    if refusal:
        where, steps = refusal
        parts.append("**CI is refusing the refresh's pull request, which will not merge "
                     f"until it passes:** {where}\n"
                     + (bullets(steps) or "- (the CI run's jobs could not be read)"))
    parts += [
        f"**Latest run to find it failing:** {run_url} ({when})",
        f"**Failing runs since this was opened:** {count}, the first on {first}.",
        "This issue is kept by refresh.yml's `report` job: it is updated on every "
        "failing run, commented on when what is failing changes, and closed by the "
        "first run after it that hands its change to the pull request that merges "
        "itself once CI passes, while CI is not refusing that pull request. The run's "
        "log says why; `docs/UPSTREAM.md` says how to check the sync by hand."]
    return "\n\n".join(parts)


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


def failed_steps(jobs, only_failed=False):
    """['`job`: step'] for every failed step of these jobs.

    With `only_failed`, a cancelled job is named only when none failed: a
    matrix cancels its sibling when one leg fails, and naming the sibling
    would send whoever reads it to a job that did nothing wrong."""
    def name(text):
        return str(text).replace("`", "'")   # cannot close the code span
    bad = ("failure", "cancelled")
    if only_failed and any(j.get("conclusion") == "failure" for j in jobs):
        bad = ("failure",)
    found = []
    for job in jobs:
        if job.get("conclusion") not in bad:
            continue
        steps = [name(s["name"]) for s in job.get("steps", []) if s.get("conclusion") in bad]
        found += [f"`{name(job['name'])}`: {s}" for s in steps] or [f"`{name(job['name'])}`"]
    return found


def failing_steps(run_id, only_failed=False):
    """failed_steps() for a run by id, or [] if unreadable."""
    out = gh("run", "view", str(run_id), "--json", "jobs", check=False)
    if out.returncode:
        return []
    return failed_steps(json.loads(out.stdout)["jobs"], only_failed)


class Unreadable(Exception):
    pass


def read_json(*args):
    out = gh(*args, check=False)
    if out.returncode:
        raise Unreadable(f"gh {' '.join(args[:2])}: {out.stderr.strip()}")
    return json.loads(out.stdout)


def refusal():
    """(where, steps, signature) when CI is refusing the refresh's open
    pull request, else None. Raises Unreadable when the pull request or
    its CI runs cannot be read: a check that cannot see is not a check
    that found nothing."""
    prs = [p for p in read_json("pr", "list", "--head", BRANCH, "--base", "main",
                                "--state", "open", "--limit", "20",
                                "--json", "number,url,createdAt,isCrossRepository")
           if not p.get("isCrossRepository")]
    if not prs:
        return None
    pr = prs[0]
    # The REST API, because `gh run list` does not say whose head a run is.
    api = read_json("api", f"repos/{{owner}}/{{repo}}/actions/workflows/{CI}/runs"
                           f"?branch={BRANCH}&event=pull_request&per_page=30")
    run = refused_run(pr, own_runs(os.environ["GH_REPO"], api.get("workflow_runs", [])))
    if not run:
        return None
    steps = failing_steps(run["databaseId"], only_failed=True)
    where = f"#{pr['number']} ({pr['url']}), in {run['url']}"
    return where, steps, f"#{pr['number']} " + (" / ".join(steps) or "unknown")


def now_utc():
    return refresh_health.dt.datetime.now(refresh_health.dt.timezone.utc)


def failure():
    results = {k.lower(): os.environ.get(k, "") for k in ("GATE", "REFRESH", "LAND")}
    print(f"job results: {results}")
    issue = find(FAILING)
    # Unreadable, the rest still runs - this run's own failure is recorded -
    # but nothing is closed on a question that went unanswered, and the step
    # fails at the end so the run says so.
    unreadable = None
    try:
        refused = refusal()
    except Unreadable as e:
        refused, unreadable = None, str(e)
    print(f"refresh pull request: {unreadable or ('refused by CI' if refused else 'not refused')}")
    action = failure_action(results, issue is not None, refused is not None)
    if unreadable and action == "close":
        action = None
    run_url = os.environ["RUN_URL"]
    if action == "close":
        gh("issue", "close", str(issue["number"]), "--comment",
           f"{run_url} passed, as far as handing its change to the pull request that "
           "merges itself once CI passes, and CI is not refusing that pull request. Closing.")
    elif action:
        run_failed = bool({"failure", "cancelled"} & set(results.values()))
        failing = failing_steps(os.environ["RUN_ID"]) if run_failed else None
        state = read_mark(issue["body"]) if issue else {}
        when = now_utc().strftime("%Y-%m-%d %H:%M UTC")
        first = state.get("first", when[:10])
        count = state.get("count", 0) + 1
        # No run URL in the signature: a pull request refused the same way
        # run after run is one failure, and comments only when it changes.
        signature = " | ".join(
            ([" / ".join(failing) or "unknown"] if failing is not None else [])
            + ([refused[2]] if refused else []))
        body = with_mark(failure_body(failing, run_url, when, count, first,
                                      refused[:2] if refused else None),
                         dict(signature=signature, count=count, first=first))
        if action == "open":
            open_issue(FAILING, body)
        else:
            gh("issue", "edit", str(issue["number"]), "--body", body)
            if signature != state.get("signature"):
                changed = (failing or []) + (
                    [f"CI on the refresh's pull request: {s}" for s in refused[1]] if refused else [])
                gh("issue", "comment", str(issue["number"]), "--body",
                   f"What is failing has changed, as of {run_url}:\n\n"
                   + (bullets(changed) or "- (the jobs could not be read)"))
    print(f"failure issue: {action or 'nothing to do'}")
    if unreadable:
        sys.exit(f"::error::could not read the refresh's pull request or its CI: {unreadable}")


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
