# Reviewer brief

Before launching a pass, open it against the head it reviews:

    bash .claude/skills/backlog-loop/verdict.sh new <N> <sha>          # or: ... <sha> quick

`quick` for `frontend-reviewer-quick`, whose verdict must carry its applied
items. It prints the pass id; put it in the brief where `<id>` stands. One id
per pass: a confirmation or a respawn opens a new one.

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

    Record your verdict by running, in <path>, once, when the review is done:
    `bash .claude/skills/backlog-loop/verdict.sh record <id> PASS` or
    `... record <id> FAIL`<, followed by your applied items for the quick
    variant, e.g. `... record <id> PASS 2,5,9`>. That command is the verdict;
    nothing in your reply is read for one. Then reply with the findings,
    file:line, worst first, one or two sentences each. Do not narrate what
    you verified; if everything held, say so in one line.

Keep the "try to disprove" list inside the diff. Ask for an isolated rebuild
only when an artefact changed. Do not ask for a site-wide enumeration or a
live fetch unless the item is about one.

Then, after a fix, open a new pass on the new head and give it to a fresh
Sonnet agent (never the agent that already reviewed):

    PR #<N> follow-up: <what changed and why> in commit <sha> on `<branch>`
    (same worktree, <path>). Please inspect `git diff <old>..<new>`. Record
    your verdict by running, in <path>, once:
    `bash .claude/skills/backlog-loop/verdict.sh record <id> PASS` or
    `... record <id> FAIL`. That command is the verdict; nothing in your
    reply is read for one. Then reply with anything you found, file:line.

## Reading the verdict

    bash .claude/skills/backlog-loop/verdict.sh read <id>

prints `PASS` or `FAIL` (with `applied <items>` for a quick pass) and exits 0,
or exits 1 when the pass recorded none. The exit and the printed word are the
verdict. The reply is read for findings only: a reply that says PASS over a
pass that recorded FAIL is a FAIL, and a reply that says anything at all over
a pass that recorded nothing is no review `[D-40]`.

A pass that recorded no verdict — the reviewer ran out of turns, forgot the
command, or the command refused it — gets one respawn: a new pass id and the
**same brief** to a fresh agent of the same kind, with only the id changed.
Everything goes across — the worktree, the task, the routes, the "try to
disprove" list and the constraints, `Do NOT run npm test` among them — so the
pass that settles the item is briefed no more thinly than the one it replaces.
If the respawn records nothing either, the item has no review, as
`.claude/skills/backlog-item/SKILL.md` sets out under *Review*.
