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
    LOOP_REVIEW_MODEL        its frontmatter `model` (opus, sonnet...)
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

A pass started here is marked advisory before the command runs, so the mark
holds whatever the reviewer does. Until server-side review enforcement lands
(AF-115, #1050), nothing checks that the command starts an independent
reviewer at all rather than something that records PASS unread, so
`verdict.sh read` prints `advisory` after the verdict and `merge-step.py
before` refuses the pull request: a person merges it.

Exits 2 on a usage error, a reviewer that is not on the merge path, or a pass
that was never opened or already has a verdict; 4 when LOOP_REVIEW_CMD is
not set. Nothing is marked or run in either case.
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
PASS_ID = re.compile(r"[A-Za-z0-9-]+")


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
    if not PASS_ID.fullmatch(pass_id):
        return fail(2, f"{pass_id!r} is not a pass id")
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
    # The mark first: a pass run here is advisory whatever its process does.
    with open(os.path.join(vdir, f"{pass_id}.external"), "w", encoding="utf-8") as f:
        f.write(f"{name}\n")
    with tempfile.NamedTemporaryFile("w", encoding="utf-8", suffix=".md",
                                     prefix=f"review-{pass_id}-", delete=False) as f:
        f.write(prompt)
        prompt_file = f.name
    env = dict(os.environ,
               LOOP_REVIEW_PROMPT_FILE=prompt_file, LOOP_REVIEW_AGENT=name,
               LOOP_REVIEW_MODEL=keys.get("model", ""), LOOP_REVIEW_EFFORT=keys.get("effort", ""),
               LOOP_REVIEW_MAX_TURNS=keys.get("maxTurns", ""), LOOP_REVIEW_PASS=pass_id,
               LOOP_REVIEW_WORKTREE=worktree)
    try:
        with open(prompt_file, encoding="utf-8") as stdin:
            code = subprocess.run(["sh", "-c", command], cwd=worktree, env=env,
                                  stdin=stdin, check=False).returncode
    finally:
        os.unlink(prompt_file)
    print(f"review.py: the command exited {code}, which is not a verdict: "
          f"`verdict.sh read {pass_id}` is", file=sys.stderr)
    return code


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
