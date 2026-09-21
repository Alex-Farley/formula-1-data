#!/usr/bin/env bash
# Everything a fork checks before it takes an item, in one call.
#
# WHY THIS EXISTS
#     On 2026-09-21 the primary checkout was found parked on
#     `claude/af-65-filing-default` with its pull request open, left by a
#     session that had worked in the checkout directly instead of in a
#     worktree. The next run's `next.py` returned that same item, so a fork
#     would have opened work on an item already in flight, in a checkout
#     another session was using. Nothing was lost, and only because the other
#     session had committed and pushed before it stopped (`PM-43`).
#
#     The fork already ran `gh pr list` and `git worktree list` at this point
#     and read neither the branch the primary checkout is on nor whether it
#     is clean - the two facts that would have caught it. So this asks for
#     all four at once, and refuses on the two that are somebody else's work
#     in progress.
#
# WHAT IS A REFUSAL AND WHAT IS NOT
#     Not on `main`, or tracked changes against it: refuse. Both mean a
#     session is using this checkout, and a fork that starts anyway shares a
#     working tree with it. An open pull request or a leftover worktree does
#     not refuse - those are the normal inheritance the fork is told to
#     finish from where it stopped, and it needs to see them, not be stopped
#     by them. Untracked files are a warning: a scratch file is not another
#     session's work, and refusing on one would stop the loop over something
#     that cannot be collided with.
#
# EXIT 0  safe to start; whatever is open is printed to be finished first
#      2  the primary checkout is not somewhere a fork may start from
set -u

# The main working tree, wherever this is run from: `--porcelain` lists it
# first and the linked worktrees after it.
primary=$(git worktree list --porcelain 2>/dev/null | awk '/^worktree /{print substr($0, 10); exit}')
if [ -z "${primary}" ]; then
    echo "start-check: not a git checkout (git worktree list said nothing)" >&2
    exit 2
fi

branch=$(git -C "${primary}" symbolic-ref --quiet --short HEAD 2>/dev/null || true)
if [ "${branch}" != "main" ]; then
    echo "start-check: the primary checkout is on '${branch:-a detached HEAD}', not main." >&2
    echo "  ${primary}" >&2
    echo "A session worked in it directly instead of in a worktree, and may still be." >&2
    echo "This is a STOP for the loop, not a blocker to work around: returning it to" >&2
    echo "main is a person's call, because whatever is on that branch is theirs." >&2
    exit 2
fi

tracked=$(git -C "${primary}" status --porcelain --untracked-files=no)
if [ -n "${tracked}" ]; then
    echo "start-check: the primary checkout has uncommitted changes to tracked files." >&2
    echo "  ${primary}" >&2
    printf '%s\n' "${tracked}" >&2
    echo "A fork must not start over another session's edits. This is a STOP." >&2
    exit 2
fi

untracked=$(git -C "${primary}" ls-files --others --exclude-standard)
if [ -n "${untracked}" ]; then
    echo "start-check: untracked files in the primary checkout (a warning, not a stop):"
    printf '%s\n' "${untracked}" | sed 's/^/  /'
fi

echo "start-check: primary checkout on main and clean — ${primary}"
echo
echo "Open pull requests:"
gh pr list --state open || echo "  (gh could not answer; see its message above)"
echo
echo "Worktrees:"
git worktree list
