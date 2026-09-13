# Reviewer brief

Fill in and pass to a fresh `.claude/agents/<reviewer>` with `model: "opus"`.

    Independent review of PR #<N> on Alex-Farley/formula-1-data, branch
    `<branch>` at <sha>, checked out as a git worktree at <path> (node_modules
    installed; web/dist built from this head). Compare with
    `git diff origin/main...HEAD`. Read CLAUDE.md and
    `.claude/agents/<reviewer>.md`. Do NOT run `npm test` (the smoke port is
    shared; units and smoke passed on this head); you may run
    `node --test web/test/units.mjs`, sqlite3 and node scripts against
    web/dist and f1.db. Node is at ~/.local/node/bin. `make ci` green.

    Task <ID>: <what the item asked for, in one or two sentences>.
    Change: <what was done, file by file, in plain terms; name every claim
    the change makes that a reviewer could check>.

    Try to disprove: <numbered list of the specific ways this could be wrong -
    NULL handling, a check that cannot fail, a source or licence claim, a
    figure copied rather than computed, the backlog entry's accuracy and PR
    number>. Static-against-app parity of every table on the routes named,
    header and every shown row, is proven by `npm test` on this head; do not
    rebuild that comparison - name a row or a route the suite does not reach
    if you believe one exists.

    Return exactly one verdict line first: `PASS — safe to merge` or
    `FAIL — changes required`, then findings with file:line, worst first,
    one or two sentences each. Do not narrate what you verified; if
    everything held, say so in one line.

Keep the "try to disprove" list inside the diff. Ask for an isolated rebuild
only when an artefact changed. Do not ask for a site-wide enumeration or a
live fetch unless the item is about one.

Then, after a fix, to a fresh Sonnet agent (never the agent that already reviewed):

    PR #<N> follow-up: <what changed and why> in commit <sha> on `<branch>`
    (same worktree). Please inspect `git diff <old>..<new>` and return one
    line: `PASS — safe to merge` or `FAIL — changes required`.
