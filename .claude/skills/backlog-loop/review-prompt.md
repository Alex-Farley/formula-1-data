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

The respawn changes what is asked for, not what is reviewed. Restating the
format requirement — even in capitals, with the consequence spelled out — was
measured not to work `[D-38]`, so **send the same brief the discarded result
was given, to a fresh agent of the same kind, with its last paragraph (`Return
exactly one verdict line first...`) replaced by this one**. Everything else
goes across unchanged: the worktree, the task, the routes, the "try to
disprove" list and the constraints, `Do NOT run npm test` among them. A
respawn is the pass that settles the item, so it is briefed no more thinly
than the one it replaces.

    This replaces the report contract above, and it overrides the *How to
    report* section of your agent file for this pass only. Your entire reply
    is ONE line, and it is the verdict: exactly `PASS — safe to merge` or
    `FAIL — changes required`. No summary, no preamble, no findings, no
    closing note, nothing above it and nothing below it. Do the review in
    full; report only its conclusion — the review is not shortened, the
    report is.

For `frontend-reviewer-quick`, whose `Applied:` line is the evidence that the
rules were read and without which the loop has no review, the reply is those
two lines and nothing else:

    ...Your entire reply is TWO lines: the verdict, exactly
    `PASS — safe to merge` or `FAIL — changes required`, and below it your
    `Applied: items <n, n, ...> of frontend-reviewer.md` line. Nothing above
    them, nothing below them, no findings and no summary.

**A respawned pass returns no findings at all, and the discarded result's may
not be read back.** On a `FAIL`, spawn a fresh full pass to learn what is
wrong. On a `PASS`, there is nothing to fix under `[D-22]` and nothing to list
under `[D-23]` — a non-blocking finding this pass would have made is lost, and
that is the price of the second attempt settling the item. Both costs are
`[D-38]`.
