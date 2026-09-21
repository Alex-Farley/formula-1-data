#!/usr/bin/env python3
"""Why a `gh` call failed, said once, in the place a reader can act on.

WHY THIS EXISTS
    The queue scripts shell out to `gh`, and on 2026-09-14 a web session ran
    `next.py` and got a bare `FileNotFoundError` traceback - which names the
    missing binary but not the reason, and not the fix. `ci-wait.sh` was
    worse: it discarded gh's stderr, read the empty answer as "no check has
    registered yet", and slept thirty seconds forty times, so an
    unauthenticated CLI cost twenty minutes of silence before it timed out.

    Both now stop on the first call with the text below.

WHAT NEEDS THE CREDENTIAL
    Everything these scripts do, because they reach GitHub only through
    `gh`, and `gh` refuses without one: `gh issue list` against this public
    repository answers "please run: gh auth login" and makes no request at
    all (verified 2026-09-14). The REST API does serve public reads
    anonymously; gh does not use it that way, so "the repository is public"
    buys these scripts nothing.

    The board needs it twice over: ranking the queue is a ProjectsV2 read,
    which is GraphQL, and GraphQL refuses an unauthenticated call even
    against a public repository. No amount of falling back reaches it.

    AND IN A CLAUDE CODE SESSION THE BOARD IS UNREACHABLE ANYWAY. The agent
    proxy refuses GraphQL outright - "GitHub GraphQL is not available from
    Claude Code sessions; use the REST API" - and ProjectsV2 has no REST
    equivalent. Verified 2026-09-14 on a request carrying no credential at
    all, so it is a blanket block and not an authentication failure: a valid
    PAT does not lift it. REST is unaffected, so issues, pull requests and
    check runs are reachable there with a credential; the ranking is not.

WHY THIS EXITS RATHER THAN DEGRADING
    `file.py` moves an item to *In progress*, and that is a board write. A
    loop that cannot claim an item cannot stop two sessions taking the same
    one, which is the collision the status exists to prevent. Carrying on
    with a queue that has no ranking and no claim would weaken that control
    to keep going, which `CLAUDE.md` rules out by name. An unscoped queue is
    also indistinguishable from a correct one in the output, which is the
    failure worth refusing: a traceback is honest, a plausible wrong answer
    is not.
"""
import re
import subprocess
import shutil
import sys

MISSING = "gh is not on PATH"
UNAUTH = "gh ran but could not confirm a working credential"
TOO_OLD = "gh is on PATH but too old for these scripts"
LIMITED = "GitHub refused the call, and calling again extends the refusal"

# Two questions, and they are not the same question.
#
# LIMITER: this is the secondary rate limiter. It is not a bucket
# `gh api rate_limit` reports - every one of those read full while it was
# active, on 2026-09-14 and again on 2026-09-21 - it refuses every GraphQL
# call while it lasts, and each further attempt extends it `[D-27]`. It
# clears on its own, so waiting is the answer and `LIMIT_HELP` says so.
LIMITER = r"rate limit|secondary|abuse detection"
# DO_NOT_RETRY: anything a second attempt cannot improve on, which is the
# limiter plus the authorisation refusals. `file.py` decides with this
# whether an `item-edit` is worth retrying, and the answer for both halves
# is no.
#
# `next.py` asks the narrower question instead, and must: an OAuth App
# access restriction says "forbidden" and never clears, so telling an
# operator to wait it out would be telling them to wait for ever, and
# would suppress the one diagnosis that names it. Found in review. The
# union is built from LIMITER rather than written out again, so the two
# cannot drift apart. Both lived in `file.py` until `PM-44`.
DO_NOT_RETRY = re.compile(rf"{LIMITER}|forbidden|not authoriz", re.I)
LIMITER = re.compile(LIMITER, re.I)

# Matched against `gh auth status` only - its own wording, not an arbitrary
# command's stderr, which is why this is a pattern at all. See
# `unauthenticated`.
REFUSED = re.compile(r"failed to log in|not logged in|invalid|expired", re.I)


HELP = """
These scripts need a `gh` that is both current and authenticated, and the
credential is for everything, not only the board: `gh` refuses every call
without one, on this public repository as much as a private one. The board
needs it twice over, being a ProjectsV2 read and so GraphQL. Separately,
`ci-wait.sh` needs the newer CLI whether or not a token is present.

The container a Claude Code web session ran in on 2026-09-14 had no `gh` on
PATH, and the GH_TOKEN it sets is not one GitHub accepts - `gh auth status`
reports it invalid. Installing `gh` on its own does not fix that; it
produces a CLI that looks authenticated and fails on every call.

In such a session the board is out of reach whatever you do about that: the
agent proxy refuses GraphQL outright ("GitHub GraphQL is not available from
Claude Code sessions; use the REST API"), ProjectsV2 has no REST form, and
the refusal arrives on a request carrying no credential, so a PAT does not
lift it. Do not spend one expecting the loop to run there.

Where GraphQL IS reachable - a machine with direct network access - the
loop needs both of these:
  1. A current gh, from GitHub's own apt repository or a release tarball -
     NOT `apt-get install gh`, which gave 2.45 on that image and has no
     `--json` on `pr checks`, the flag `ci-wait.sh` reads. Put it in the
     environment's setup script so it survives the container being reclaimed.
  2. A classic PAT with `repo`, `project` and `workflow` scope, set as
     GH_TOKEN in the environment's variables. `project` is what the board
     read needs; `workflow` is what GitHub requires before it will accept a
     push that changes anything under `.github/workflows/`, which some
     items do. Grant all three rather than find out which is missing from
     a rejected push half way through an item.

Short of that these scripts do not run at all, not even for an item named
by hand: `next.py` reads the issue through gh as well as the board. Work
such an item from the issue itself; the loop stays off.
"""


LIMIT_HELP = """
This is a refusal to wait out, not a defect in the queue scripts and not
something to poll through: the limiter extends while calls keep arriving,
and `gh api rate_limit` will look untouched throughout because this is not
one of the buckets it reports. Stop calling GitHub.

For the loop this is a stop rather than an ordinary blocker: a blocker is
recorded on its issue and worked around, and recording it is itself a board
write, which is the call that cannot be made. No fork can choose an item
while the board is unreadable, so the run ends and is resumed later.
"""


def note(reason):
    """The reason and the standing explanation, ready for stderr."""
    return f"backlog-loop: {reason}.\n{HELP}"


def limit_note():
    """The same shape for a refusal, whose fix is not a credential."""
    return f"backlog-loop: {LIMITED}.\n{LIMIT_HELP}"


def unauthenticated():
    """True when `gh auth status` does not confirm a working credential.

    Not a pattern against gh's stderr: an invalid token makes
    `gh project item-list` fail with `unknown owner type`, which names
    neither authentication nor the board, and the wording of the messages
    that do name it has changed between gh versions. Asking gh is the only
    answer that stays true.

    It cannot tell a rejected token from an API it could not reach: a
    secondary rate limit fails `auth status` too, and that is the incident
    `loop_cache.py` exists for. So this decides whether to ADD the note,
    never whether to print gh's own message - every caller writes gh's
    stderr first, and the note follows it.

    Costs one `gh auth status`, a network call. Every caller is already on
    a failing path bar one: `ci-wait.sh` spends it once per run when no
    check has registered yet, beside the forty `pr checks` calls that run
    can make anyway."""
    try:
        r = subprocess.run(["gh", "auth", "status"],
                           capture_output=True, text=True, check=False)
    except FileNotFoundError:
        return True
    # gh 2.45, which is what `apt-get install gh` gives on this image, exits
    # 0 from `auth status` even when it has just printed that the token is
    # invalid; later versions exit 1. Read both, so neither version is
    # believed when it is wrong.
    return r.returncode != 0 or bool(
        REFUSED.search(f"{r.stdout}\n{r.stderr}"))


def require():
    """Exit 2 with the note if `gh` is not even on PATH. The version and the
    credential are asked separately - see `too_old`, which is local, and
    `unauthenticated`, which spends a network call, in the order
    `--diagnose` runs them."""
    if shutil.which("gh") is None:
        sys.stderr.write(note(MISSING))
        sys.exit(2)


def too_old():
    """True when `gh pr checks` has no `--json`, which `ci-wait.sh` needs.

    A capability check rather than version arithmetic, because the flag is
    what matters and the number that introduced it is easy to get wrong.
    `apt-get install gh` on this image gives 2.45, which does not have it:
    the call then fails with `unknown flag`, prints usage to stderr, and the
    empty result reads to `ci-wait.sh` as a check that has not registered -
    the same twenty minutes of sleeping as an invalid token. Local, so no
    API call is spent on it."""
    try:
        r = subprocess.run(["gh", "pr", "checks", "--help"],
                           capture_output=True, text=True, check=False)
    except FileNotFoundError:
        return False  # MISSING is the better answer, and require() gives it
    return "--json" not in f"{r.stdout}\n{r.stderr}"


if __name__ == "__main__":
    # `--diagnose` is how the shell scripts ask, on a call that already
    # returned nothing: exit 2 with the note when gh is too old or cannot
    # authenticate, 0 when the empty answer means something else.
    if "--diagnose" in sys.argv[1:]:
        require()
        # `too_old` first: it is local, deterministic and free, and it is the
        # more specific answer for the case that bites hardest - a 2.45 with
        # a perfectly good token, which `unauthenticated` would clear and
        # leave the caller none the wiser.
        if too_old():
            sys.stderr.write(note(TOO_OLD))
            sys.exit(2)
        if unauthenticated():
            sys.stderr.write(note(UNAUTH))
            sys.exit(2)
        sys.exit(0)
    require()
