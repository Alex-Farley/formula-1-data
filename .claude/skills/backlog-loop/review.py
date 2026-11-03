#!/usr/bin/env python3
"""
A reviewer started as a separate process, from its brief in .claude/agents/.

    python3 .claude/skills/backlog-loop/review.py <reviewer> <pass-id> <brief-file> <worktree>

The fork opens the pass with `verdict.sh new` as for any review, writes the
brief from review-prompt.md to a file, and runs this in place of launching
the agent in its own session. The prompt is the reviewer's file with its
frontmatter taken off, then the brief. It goes to whatever command
LOOP_REVIEW_CMD holds, on standard input, run by `sh -c` in the worktree,
with these in its environment:

    LOOP_REVIEW_PROMPT_FILE  the same prompt, as a file
    LOOP_REVIEW_AGENT        the reviewer's name
    LOOP_REVIEW_MODEL        its frontmatter `model` (opus, sonnet...), unless
                             the caller set one: a confirmation on the model
                             the pace table names
    LOOP_REVIEW_EFFORT       its frontmatter `effort`
    LOOP_REVIEW_MAX_TURNS    its frontmatter `maxTurns`
    LOOP_REVIEW_PASS         the pass id
    LOOP_REVIEW_WORKTREE     the worktree, absolute

The command is configuration, never code here: which agent, which vendor and
how a model name maps onto it are the operator's to say (AF-114). One
example, for Claude Code:

    LOOP_REVIEW_CMD='claude -p --model "$LOOP_REVIEW_MODEL" --allowedTools "Read Grep Glob Bash"'

Another vendor's command-line agent goes in the same way, reading the prompt
from standard input or from $LOOP_REVIEW_PROMPT_FILE.

The reviewer records its verdict with `verdict.sh record`, as the brief tells
it to, and the fork reads it with `verdict.sh read`. This script's exit status
is the command's and is never a verdict: the reply, which the command prints,
is read for findings only (D-40).

Until server-side review enforcement lands (AF-115, #1050), nothing checks
that the command starts an independent reviewer at all rather than something
that records PASS unread, so a pass started here is advisory, and a person
merges. Before the command runs it is marked twice: the pull request gets the
label ADVISORY on GitHub, which every checkout and every later fork reads,
and the pass gets a `.external` file beside it, which makes `verdict.sh read`
print `advisory` after the verdict. `merge-step.py before` refuses a PR with
either. The command runs as the same user and could remove both; once it has
exited, both are put back, and a `.external` found gone or a label that could
not be put back is reported, exit 3 (a removed label is re-added, not
detected). That catches a command that tampers and then exits, which is the
most a local script can do: a control the working agent cannot reach is
AF-115's.

Exits 2 on a usage error, a reviewer that is not on the merge path, or a pass
that was never opened or already has a verdict; 4 when LOOP_REVIEW_CMD is
not set or the label could not be put on the PR. Nothing is run in any of
these cases. Otherwise it exits with the command's status, or 3 as above.
"""
import os
import re
import subprocess
import sys
import tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(HERE)))
# The merge path's five agents and no others: a critic never reviews a pull
# request (D-31). tests/test_conventions.py holds this to LOOP_REVIEWERS.
REVIEWERS = ("frontend-reviewer", "frontend-reviewer-quick", "data-integrity-reviewer",
             "licence-reviewer", "security-reviewer")
FRONTMATTER = re.compile(r"---\n(.*?)\n---\n", re.S)
# verdict.sh's form, <PR>-<sha7>-<n>; the PR is what the label goes on.
PASS_ID = re.compile(r"(\d+)-[0-9a-f]{7}-\d+")
ADVISORY = "review: advisory"


def agent(name):
    """(frontmatter as {key: value}, body) for .claude/agents/<name>.md."""
    with open(os.path.join(ROOT, ".claude", "agents", f"{name}.md"), encoding="utf-8") as f:
        text = f.read()
    m = FRONTMATTER.match(text)
    if not m:
        return {}, text
    keys = {}
    for line in m.group(1).splitlines():
        key, sep, value = line.partition(":")
        if sep:
            keys[key.strip()] = value.strip()
    return keys, text[m.end():]


def verdicts_dir(worktree):
    """.claude/loop/verdicts beside the main checkout, as verdict.sh finds it."""
    r = subprocess.run(["git", "rev-parse", "--git-common-dir"], cwd=worktree,
                       capture_output=True, text=True, check=False)
    if r.returncode or not r.stdout.strip():
        return None
    common = os.path.join(worktree, r.stdout.strip())
    return os.path.join(os.path.dirname(os.path.abspath(common)), ".claude", "loop", "verdicts")


def label(pr):
    """Put ADVISORY on the PR; True when gh says it did."""
    r = subprocess.run(["gh", "pr", "edit", pr, "--add-label", ADVISORY],
                       capture_output=True, text=True, check=False)
    if r.returncode:
        print(f"review.py: gh could not label PR #{pr}: {r.stderr.strip()}", file=sys.stderr)
    return r.returncode == 0


def fail(code, message):
    print(f"review.py: {message}", file=sys.stderr)
    return code


def main(argv):
    if len(argv) != 4:
        return fail(2, "usage: review.py <reviewer> <pass-id> <brief-file> <worktree>")
    name, pass_id, brief_file, worktree = argv
    worktree = os.path.abspath(worktree)
    if name not in REVIEWERS:
        return fail(2, f"{name!r} is not a merge-path reviewer: one of {', '.join(REVIEWERS)}")
    m = PASS_ID.fullmatch(pass_id)
    if not m:
        return fail(2, f"{pass_id!r} is not a pass id")
    pr = m.group(1)
    command = os.environ.get("LOOP_REVIEW_CMD", "").strip()
    if not command:
        return fail(4, "LOOP_REVIEW_CMD is not set: launch the reviewer in the session instead")
    vdir = verdicts_dir(worktree)
    if vdir is None:
        return fail(2, f"{worktree} is not a git checkout")
    if not os.path.isfile(os.path.join(vdir, f"{pass_id}.pass")):
        return fail(2, f"no review pass {pass_id} was opened: verdict.sh new first")
    if os.path.exists(os.path.join(vdir, f"{pass_id}.verdict")):
        return fail(2, f"pass {pass_id} already has a verdict; open a new pass")
    with open(brief_file, encoding="utf-8") as f:
        brief = f.read()
    keys, body = agent(name)
    prompt = body.rstrip("\n") + "\n\n---\n\n" + brief
    # The marks first, so the pass is advisory before anything reviews it.
    if not label(pr):
        return fail(4, f"PR #{pr} has no {ADVISORY!r} label, so nothing ran; "
                       f"`gh label create {ADVISORY!r}` if the label is missing")
    mark = os.path.join(vdir, f"{pass_id}.external")
    with open(mark, "w", encoding="utf-8") as f:
        f.write(f"{name}\n")
    with tempfile.NamedTemporaryFile("w", encoding="utf-8", suffix=".md",
                                     prefix=f"review-{pass_id}-", delete=False) as f:
        f.write(prompt)
        prompt_file = f.name
    env = dict(os.environ,
               LOOP_REVIEW_PROMPT_FILE=prompt_file, LOOP_REVIEW_AGENT=name,
               LOOP_REVIEW_MODEL=os.environ.get("LOOP_REVIEW_MODEL") or keys.get("model", ""),
               LOOP_REVIEW_EFFORT=keys.get("effort", ""),
               LOOP_REVIEW_MAX_TURNS=keys.get("maxTurns", ""), LOOP_REVIEW_PASS=pass_id,
               LOOP_REVIEW_WORKTREE=worktree)
    try:
        with open(prompt_file, encoding="utf-8") as stdin:
            code = subprocess.run(["sh", "-c", command], cwd=worktree, env=env,
                                  stdin=stdin, check=False).returncode
    finally:
        os.unlink(prompt_file)
    # Put back whatever the command took away, and say so.
    gone = not os.path.exists(mark)
    with open(mark, "w", encoding="utf-8") as f:
        f.write(f"{name}\n")
    if not label(pr) or gone:
        return fail(3, f"the advisory mark on pass {pass_id} was removed, or the label on PR #{pr} "
                       f"could not be put back: treat this pass as no review, and a person merges")
    print(f"review.py: the command exited {code}, which is not a verdict: "
          f"`verdict.sh read {pass_id}` is", file=sys.stderr)
    return code


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
