#!/usr/bin/env python3
"""The refresh fixer's boundaries (AF-91, fix-refresh.yml, [D-57]).

    fix_refresh.py gate            the `gate` job: is there an alarm to work?
    fix_refresh.py claim           the `gate` job: its one unattended attempt
    fix_refresh.py check           the fixer, before it says it is done
    fix_refresh.py pack  <dir>     the `fix` job, once the harvest is restored
    fix_refresh.py apply <dir>     the `open` job, on a fresh checkout
    fix_refresh.py message <dir> <issue>
                                   the `open` job: the pull request's text
    fix_refresh.py findings <execution file> <out>
                                   the `review` job: the reviewer's reply
    fix_refresh.py report          the `report` job: what came of it

fix-refresh.yml runs Claude Code on an open `refresh-failing` alarm, in a job
that holds no token that writes. What it changed crosses to the job that
does hold one, `open`, as files, through refresh_tree.py's pack and apply,
with the rule below in place of a refresh's. An unattended fix is held to
what a refresh failure warrants, the item says: a declared exception with a
cited source, a `discrepancies` or `known_gaps` row, or a fix to a fetch or
a test fault - never a change to a check's logic, a workflow's controls or
the licence classification. Paths decide most of that; what they cannot,
the two Python files below decide by syntax tree:

- verify.py may change only in its comments and in the literal values of
  the declared-exception sets, the names ending `_EXCEPTIONS`, and each of
  those may only grow: an exception is added, never quietly taken away.
- data/current.py may change anywhere but SOURCE_LICENCE, the licence
  classification.

Everything else a fix needs - build.py, the workflows, the loaders in
data/harvest.py, a test that guards a control, the web - is a person's,
and the fixer holds the item instead.
"""
import ast
import json
import os
import re
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import refresh_tree  # noqa: E402  (the pack format, and the documents with figure spans)

ROOT = refresh_tree.ROOT
ALARM = "refresh-failing"
BRANCH = "claude/fix-refresh-{}"
MARK = "<!-- fix-refresh -->"
# Labels under which an alarm waits for a person rather than a fixer.
WAITING = ("decision", "blocked")

VERIFY = "verify.py"
LICENCE_FILE = "data/current.py"
LICENCE = "SOURCE_LICENCE"
DATA = re.compile(r"data/[a-z][a-z0-9_]*\.py")
FETCHERS = ("tools/f1db_fetch.py", "tools/f1db_totals_fetch.py")
TESTS = re.compile(r"tests/test_[a-z0-9_]+\.py")
# Code in data/, and the tests that guard a control: the conventions, the
# boundary between the refresh's jobs, this file's own, the loop's, and the
# checks verify.py is held to refuse.
NOT_DATA = ("data/harvest.py",)
CONTROL_TESTS = re.compile(r"tests/test_(conventions|refresh_tree|fix_refresh|verify_refuses"
                           r"|backlog_[a-z_]+|merge_step|loop_[a-z_]+)\.py")
# GitHub's closing keywords: an alarm is closed by the run that proves the
# fix, never by a pull request (AF-89).
CLOSING = re.compile(r"\b(close[sd]?|fix(e[sd])?|resolve[sd]?)\b:?\s+"
                     r"(?:[\w.-]+/[\w.-]+)?#\d+", re.I)
TITLE_MAX = 120
TEXT_MAX = 20000


# ------------------------------------------------------- what may change

def exception_values(tree):
    """{name: literal} for every assignment to a name ending _EXCEPTIONS,
    and the tree with each such value blanked to None, as ast.dump text.
    A value that is not a literal is refused: blanking an expression would
    let a call through unseen."""
    values, bad = {}, []

    class Blank(ast.NodeTransformer):
        def visit_Assign(self, node):
            names = [t.id for t in node.targets if isinstance(t, ast.Name)]
            if names and len(names) == len(node.targets) and all(n.endswith("_EXCEPTIONS") for n in names):
                try:
                    value = ast.literal_eval(node.value)
                except (ValueError, TypeError, SyntaxError):
                    bad.append(names[0])
                    return node
                for n in names:
                    if n in values:
                        bad.append(n)
                    values[n] = value
                node.value = ast.Constant(value=None)
            return node

    blanked = Blank().visit(tree)
    return values, ast.dump(blanked), bad


def _contains(new, old):
    """Every member of `old` is in `new`: a set's elements, a list's or a
    tuple's items, a dict's items."""
    if isinstance(old, dict):
        return isinstance(new, dict) and all(k in new and new[k] == v for k, v in old.items())
    if isinstance(old, (set, frozenset, list, tuple)):
        return isinstance(new, (set, frozenset, list, tuple)) and all(x in new for x in old)
    return new == old


def verify_problem(new_text, old_text):
    try:
        new_values, new_dump, new_bad = exception_values(ast.parse(new_text))
    except SyntaxError as e:
        return f"does not parse ({e.msg}, line {e.lineno})"
    old_values, old_dump, _ = exception_values(ast.parse(old_text))
    if new_bad:
        return "declares an exception that is not a literal, or twice: " + ", ".join(new_bad)
    if new_dump != old_dump:
        return "changes more than its comments and its _EXCEPTIONS sets"
    shrunk = [n for n in old_values if not _contains(new_values.get(n), old_values[n])]
    if shrunk:
        return "takes a declared exception away: " + ", ".join(shrunk)
    return None


def licence_value(text):
    for node in ast.parse(text).body:
        if isinstance(node, ast.Assign) and any(isinstance(t, ast.Name) and t.id == LICENCE
                                                for t in node.targets):
            return ast.dump(node.value)
    return None


def problem(path, new, old):
    """Why `new` (bytes) may not replace `old` (bytes, or None for a file
    the checkout does not have) at `path` in an unattended fix, or None."""
    if path in refresh_tree.ARTEFACTS:
        return None          # ci.yml rebuilds them and refuses any byte that differs
    if path in refresh_tree.DOCUMENTS:
        return refresh_tree.problem(path, new, old)
    code = path == VERIFY or (DATA.fullmatch(path) and path not in NOT_DATA) \
        or path in FETCHERS or (TESTS.fullmatch(path) and not CONTROL_TESTS.fullmatch(path))
    if not code:
        return "is not a path an unattended fix may change"
    if old is None:
        return "is new, and an unattended fix only edits what is there"
    try:
        new_text, old_text = new.decode("utf-8"), old.decode("utf-8")
    except UnicodeDecodeError:
        return "is not UTF-8"
    try:
        ast.parse(new_text)
    except SyntaxError as e:
        return f"does not parse ({e.msg}, line {e.lineno})"
    if path == VERIFY:
        return verify_problem(new_text, old_text)
    if path == LICENCE_FILE:
        if licence_value(new_text) != licence_value(old_text):
            return f"changes {LICENCE}, the licence classification"
    return None


def check(root=ROOT):
    """The fixer's own look at its change, before it writes its outcome.
    The harvest is left out: the workflow restores it before packing."""
    paths = [p for p in refresh_tree.changed_paths(root) if not p.startswith("harvest/")]
    bad = []
    for path in paths:
        old = subprocess.run(["git", "show", f"HEAD:{path}"], cwd=root, check=False,
                             capture_output=True)
        with open(os.path.join(root, path), "rb") as f:
            why = problem(path, f.read(), old.stdout if old.returncode == 0 else None)
        if why:
            bad.append(f"{path} {why}")
    for line in bad:
        print(line)
    print(f"{len(paths)} changed path(s), {len(bad)} an unattended fix may not land")
    return 1 if bad else 0


# ------------------------------------------------- the pull request's text

def message(src, issue):
    """The title and body for the pull request from <src>/pr.md - a title
    line, a blank line, the body - with the alarm referred to and never
    closed. Exits on anything that is not that."""
    with open(os.path.join(src, "pr.md"), encoding="utf-8") as f:
        text = f.read()
    title, _, body = text.partition("\n")
    title, body = title.strip().lstrip("#").strip(), body.strip()
    if not title or len(title) > TITLE_MAX:
        sys.exit(f"::error::pr.md's title is empty or over {TITLE_MAX} characters")
    if not body or len(body) > TEXT_MAX:
        sys.exit(f"::error::pr.md's body is empty or over {TEXT_MAX} characters")
    if CLOSING.search(title) or CLOSING.search(body):
        sys.exit("::error::pr.md uses a closing keyword; an alarm is closed by the run that "
                 "proves the fix, so the fixer says Refs (AF-89)")
    return title, f"{body}\n\nRefs #{issue}"


# ----------------------------------------------------------------- the gate

def gh(*args):
    return subprocess.run(["gh", *args], check=True, capture_output=True, text=True).stdout


def decide(issue, prs, dispatched):
    """(run, why) for one alarm. `issue` is gh's JSON for it, or None;
    `prs` the numbers of open pull requests that name it."""
    if issue is None:
        return False, f"no open {ALARM} issue"
    labels = {lb["name"] for lb in issue.get("labels") or []}
    n = issue["number"]
    if issue.get("state", "OPEN") != "OPEN" or ALARM not in labels:
        return False, f"#{n} is not an open {ALARM} issue"
    waiting = sorted(labels & set(WAITING))
    if waiting:
        return False, f"#{n} is labelled {', '.join(waiting)}: it waits for a person"
    if prs:
        return False, f"#{n} is already named by open pull request #{prs[0]}"
    tried = any(MARK in (c.get("body") or "") for c in issue.get("comments") or [])
    if tried and not dispatched:
        return False, (f"#{n} has had its one unattended attempt; start another by hand "
                       "(Actions, fix a failing refresh, Run workflow)")
    return True, f"#{n}"


def gate():
    """Writes run=, issue= and ident= for $GITHUB_OUTPUT on stdout."""
    dispatched = os.environ.get("EVENT") == "workflow_dispatch"
    wanted = os.environ.get("ISSUE", "").strip()
    fields = "number,title,state,labels,comments"
    if os.environ.get("HAS_CREDENTIAL") != "true":
        print("::notice::No CLAUDE_CODE_OAUTH_TOKEN secret and no ANTHROPIC_FEDERATION_RULE_ID "
              "variable, so the fixer is off.", file=sys.stderr)
        print("run=false")
        return
    if wanted:
        if not wanted.isdigit():
            sys.exit(f"::error::the issue input is a number, not {wanted!r}")
        issue = json.loads(gh("issue", "view", wanted, "--json", fields))
    else:
        found = json.loads(gh("issue", "list", "--label", ALARM, "--state", "open",
                              "--json", "number", "--limit", "1"))
        issue = json.loads(gh("issue", "view", str(found[0]["number"]), "--json", fields)) \
            if found else None
    prs = []
    if issue is not None:
        # An open pull request whose body names the alarm: a person, the
        # loop, or an earlier run is already on it.
        listed = json.loads(gh("pr", "list", "--state", "open", "--search",
                               f"{issue['number']} in:body", "--json", "number,body,headRefName"))
        ref = re.compile(rf"#{issue['number']}\b")
        prs = [p["number"] for p in listed
               if ref.search(p.get("body") or "") or p["headRefName"] == BRANCH.format(issue["number"])]
    run, why = decide(issue, prs, dispatched)
    print(f"::notice::{'Working' if run else 'Not running'}: {why}", file=sys.stderr)
    if not run:
        print("run=false")
        return
    n = str(issue["number"])
    m = re.match(r"([A-Z]{2,4}-\d+):", issue["title"])
    print("run=true")
    print(f"issue={n}")
    print(f"ident={m.group(1) if m else '#' + n}")


def claim():
    """The comment that marks the alarm's one unattended attempt as spent."""
    gh("issue", "comment", os.environ["ISSUE"], "--body",
       f"**Fixer:** {os.environ['RUN_URL']} is working this alarm (AF-91). It opens a pull "
       "request, reviewed in the same run before anything merges, or puts the question here "
       "and labels the issue `decision`.\n\n" + MARK)


# ------------------------------------------------------ what came of it

def findings(log, out):
    """The reviewer's last reply, from the action's execution file, as the
    text of the verdict comment. Never the verdict: that is verdict.sh's."""
    text = "The reviewer's reply could not be read from the run's execution file."
    try:
        with open(log, encoding="utf-8") as f:
            messages = json.load(f)
        replies = [m["result"] for m in messages
                   if isinstance(m, dict) and m.get("type") == "result" and isinstance(m.get("result"), str)]
        if replies and replies[-1].strip():
            text = replies[-1].strip()
    except (OSError, ValueError, TypeError, KeyError):
        pass
    with open(out, "w", encoding="utf-8") as f:
        f.write(text[:TEXT_MAX] + "\n")


def report_text(env, hold_text=None):
    """(comment, label to add or None) for the alarm, from the jobs'
    results and outputs as the workflow passes them."""
    run, pr = env.get("RUN_URL", "this run"), env.get("PR", "")
    head = f"**Fixer:** {run}"
    if env.get("FIX") != "success":
        return (f"{head} did not finish (`fix`: {env.get('FIX') or 'not run'}). Nothing was "
                "opened, and the alarm is the loop's or a person's.", None)
    if env.get("OPEN") != "success":
        return (f"{head} made a fix that was not opened as a pull request (`open`: "
                f"{env.get('OPEN') or 'not run'}) - most often a path or a change an unattended "
                "fix may not make, which `open` names in its log. Nothing merged.", None)
    if env.get("OUTCOME") == "hold":
        if not hold_text or not hold_text.strip():
            return (f"{head} held the item on a question it did not write down. Nothing merged.", None)
        return (f"**Decision needed:** {hold_text.strip()[:TEXT_MAX]}\n\n(The refresh fixer, {run}.)",
                "decision")
    if not pr:
        return f"{head} opened no pull request, and said nothing of why. Nothing merged.", None
    if env.get("REVIEW") != "success":
        return (f"{head} opened #{pr}, and its review did not run to the end (`review`: "
                f"{env.get('REVIEW') or 'not run'}). Not merged: it has no review.", None)
    verdict = env.get("VERDICT")
    if verdict == "PASS" and env.get("LAND") == "success":
        return (f"{head} opened #{pr}, and its review recorded PASS. Auto-merge is on for the "
                "reviewed head, so it merges when the four required checks pass; this alarm "
                "closes on the first refresh that lands after it.", None)
    if verdict == "PASS":
        return (f"{head} opened #{pr}, and its review recorded PASS, but recording that and "
                f"turning auto-merge on failed (`land`: {env.get('LAND') or 'not run'}). "
                "Not merged.", None)
    if verdict == "FAIL":
        return (f"{head} opened #{pr}, and its review recorded FAIL; the findings are on the pull "
                "request. Not merged: a recorded FAIL is fixed, and confirmed by a fresh "
                "reviewer, by the loop or a person.", None)
    return (f"{head} opened #{pr}, and neither review pass recorded a verdict. Not merged: it "
            "has no review.", None)


def report():
    env = os.environ
    hold = None
    if env.get("OUTCOME") == "hold" and os.path.isfile(env.get("HOLD", "")):
        with open(env["HOLD"], encoding="utf-8") as f:
            hold = f.read()
    text, label = report_text(env, hold)
    if label:
        gh("issue", "edit", env["ISSUE"], "--add-label", label)
    gh("issue", "comment", env["ISSUE"], "--body", text)


if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else ""
    if cmd == "gate" and len(sys.argv) == 2:
        gate()
    elif cmd == "claim" and len(sys.argv) == 2:
        claim()
    elif cmd == "check" and len(sys.argv) == 2:
        sys.exit(check())
    elif cmd in ("pack", "apply") and len(sys.argv) == 3:
        (refresh_tree.pack if cmd == "pack" else refresh_tree.apply)(sys.argv[2], problem=problem)
    elif cmd == "findings" and len(sys.argv) == 4:
        findings(sys.argv[2], sys.argv[3])
    elif cmd == "report" and len(sys.argv) == 2:
        report()
    elif cmd == "message" and len(sys.argv) == 4 and sys.argv[3].isdigit():
        title, body = message(sys.argv[2], sys.argv[3])
        with open(os.path.join(sys.argv[2], "title.txt"), "w", encoding="utf-8") as f:
            f.write(title)
        with open(os.path.join(sys.argv[2], "body.md"), "w", encoding="utf-8") as f:
            f.write(body)
    else:
        sys.exit(__doc__.split("\n\n")[1])
