# Reviewer brief

Fill in and pass to a fresh `.claude/agents/<reviewer>` with `model: "opus"`,
or to `frontend-reviewer-quick` where the pace table in
`.claude/skills/backlog-item/SKILL.md` allows it.

    Independent review of PR #<N> on Alex-Farley/formula-1-data, branch
    `<branch>` at <sha>, checked out as a git worktree at <path> (node_modules
    installed; web/dist built from this head). Compare with
    `git diff origin/main...HEAD`. Read CLAUDE.md and
    `.claude/agents/<reviewer>.md`, including its "Already enforced" list —
    those items are tests that passed on this head; do not re-check them.
    Do NOT run `npm test` (the smoke port is shared; units, conventions and
    smoke passed on this head); you may run `npm run test:units` in web/,
    `python3 verify.py --quiet`, sqlite3 and node scripts against web/dist
    and f1.db. Node is whatever `which node` reports. `make ci` green.

    Task <ID>: <what the item asked for, in one or two sentences>. <For a
    group, one such line per item, and one sentence saying what makes them
    one change - the file or component they share.>
    Routes to spot-check: <the routes the pace allows - three at fast, ten
    chosen for edge cases at balanced, every touched route at thorough>.
    Change: <what was done, file by file, in plain terms; name every claim
    the change makes that a reviewer could check>.

    Try to disprove: <numbered list of the specific ways this could be wrong -
    NULL handling, a check that cannot fail, a source or licence claim, a
    figure copied rather than computed, the PR body's `Closes #n` naming the
    right issue, one line per item of a group; for a group, whether one
    item's change quietly breaks another's, and whether each item is
    actually done rather than the easiest of them standing for all>.
    Static-against-app parity of every table on the routes named,
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
    (same worktree). Please inspect `git diff <old>..<new>`. Your first line
    is the verdict and nothing goes above it: exactly `PASS — safe to merge`
    or `FAIL — changes required`, with no summary sentence, preamble or
    restated finding in front of it. Anything you want to say goes after it.

A confirmation that leads with a sentence instead of a verdict is not a verdict
and is not interpreted as one: discard it and spawn the pass again, as
`.claude/skills/backlog-item/SKILL.md` sets out under *Review*.

The respawn does not repeat the brief that produced the preamble — restating
the format requirement, even in capitals with the consequence spelled out, was
measured not to work `[D-38]`. It asks for the verdict and nothing else, to a
fresh agent of the same kind:

    PR #<N>, branch `<branch>` at <sha>, worktree <path>. Review
    `git diff <old>..<new>` against CLAUDE.md and
    `.claude/agents/<reviewer>.md` exactly as that file sets out, including
    its "Already enforced" list.

    Your entire reply is ONE line, and it is the verdict: exactly
    `PASS — safe to merge` or `FAIL — changes required`. No summary, no
    preamble, no findings, no closing note, nothing above it and nothing
    below it. Do the review in full; report only its conclusion.

A `FAIL` from this pass arrives without findings, because the discarded result's
were never read. Spawn a fresh full pass to get them — do not go back to the
result you discarded.
