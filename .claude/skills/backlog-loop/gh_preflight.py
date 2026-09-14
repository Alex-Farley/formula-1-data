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

WHAT NEEDS THE CREDENTIAL, AND WHAT DOES NOT
    The board, and nothing else. `next.py` ranks the queue on the Lap Ledger
    project board - a ProjectsV2 read, which is GraphQL, and GraphQL refuses
    an unauthenticated call even against a public repository. Issues, pull
    requests and check runs are all readable with no credential at all now
    that the repository is public; the board is not, and no amount of
    falling back reaches it.

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
UNAUTH = "gh ran but GitHub rejected its credential"
TOO_OLD = "gh is on PATH but too old for these scripts"

# Matched against `gh auth status` only - its own wording, not an arbitrary
# command's stderr, which is why this is a pattern at all. See
# `unauthenticated`.
REFUSED = re.compile(r"failed to log in|not logged in|invalid|expired", re.I)


HELP = """
These scripts need a `gh` that is both current and authenticated. The board
is the only thing the credential is for - issues, pull requests and check
runs all read fine without one now that the repository is public - and
`ci-wait.sh` needs the newer CLI whether or not a token is present.

In a Claude Code web session there is no `gh` on PATH, and the GH_TOKEN the
container sets is not one GitHub accepts - measured 2026-09-14, `gh auth
status` reports it invalid. Installing `gh` on its own does not fix that; it
produces a CLI that looks authenticated and fails on every call.

To run the loop here, both of these:
  1. A current gh, from GitHub's own apt repository or a release tarball -
     NOT `apt-get install gh`, which gives 2.45 on this image and has no
     `--json` on `pr checks`, the flag `ci-wait.sh` reads. Put it in the
     environment's setup script so it survives the container being reclaimed.
  2. A classic PAT with `repo` and `project` scope, set as GH_TOKEN in the
     environment's variables. `project` is the scope the board read needs;
     `repo` alone returns an empty board and looks like an empty queue.

Until then, name an item rather than asking for the next one: reading and
working one issue needs no board. `/backlog-loop next` and `until-paused` do.
"""


def note(reason):
    """The reason and the standing explanation, ready for stderr."""
    return f"backlog-loop: {reason}.\n{HELP}"


def unauthenticated():
    """True when `gh auth status` refuses the stored credential.

    Not a pattern against gh's stderr: an invalid token makes
    `gh project item-list` fail with `unknown owner type`, which names
    neither authentication nor the board, and the wording of the messages
    that do name it has changed between gh versions. Asking gh is the only
    answer that stays true. Called only on a path that has already failed
    and is about to exit, so the extra call costs nothing that matters."""
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
    """Exit 2 with the note if `gh` is not even on PATH. The authenticated
    case cannot be checked without spending an API call, so it is diagnosed
    from the first real failure instead - see `looks_unauthenticated`."""
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
    # returned nothing: exit 2 with the note when gh cannot authenticate,
    # 0 when the empty answer means something else.
    if "--diagnose" in sys.argv[1:]:
        require()
        if unauthenticated():
            sys.stderr.write(note(UNAUTH))
            sys.exit(2)
        if too_old():
            sys.stderr.write(note(TOO_OLD))
            sys.exit(2)
        sys.exit(0)
    require()
