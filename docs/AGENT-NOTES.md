# Notes for an agent working this repository

Everything this project *requires* is in `CLAUDE.md` and `CONTRIBUTING.md`.
This file is narrower and less important: traps that have already cost a
session time, and that nothing in the code would warn you about. Each one is
here because it happened, with the date it happened.

It is in the repository rather than in one machine's notes because a trap
recorded where a single session can read it will be met again by every other
session, on every other machine and account.

## The queue is GitHub Issues, and nothing else

There is no backlog file. `docs/LANDED.md` records what landed and what was
declined *before* the queue moved to Issues on 2026-09-13, and stops there.
`next.py` in `.claude/skills/backlog-loop/` prints the next item; `file.py`
files one. The reasoning behind a decision is the comment on its issue, so a
fresh session reads the issue rather than looking for a document about it.

An item can be stale, already landed under another ID, or superseded. Reread
one against the code as it is now before starting it.

## `git rev-list <ref> -- <path>` counts versions, not commits

*2026-09-14.* History simplification: with a pathspec, `git rev-list` and
`git log` report only the commits where the blob **changed**, hiding every
commit that carries the file forward unchanged.

It matters because the number looks like a commit count and is not. Counting
the commits whose `f1.db` carried ODbL geometry gave **ten**; the answer is
**thirty-five**, across ten distinct versions of the file. That figure went
into `LICENSE-DATA` as part of a licensing offer, which therefore covered ten
of the thirty-five and left the rest under a statement this project cannot
make for ODbL content. It was caught in review, not in testing.

To count commits, enumerate with `git rev-list <ref>` and test each commit's
blob, or pass `--full-history`. **Prefer a rule written by content** — *every
commit whose `f1.db` has rows in `circuit_geometry`* — and put the count
beside the rule rather than in place of it.

Two relatives of the same mistake, both found the same day:

- `git log --format='%ae|%ce'` counts the **author and committer fields
  separately**. Two commits read as four.
- A boundary stated as *predates commit X* can be false on the clock while
  true in ancestry. For work done on a parallel branch, the **merge** is the
  boundary, not the branch's own commit.

## A green `review` check is not a review

*2026-09-14.* `CLAUDE.md` says a failing `review.yml` is infrastructure rather
than a defect — it runs on a credential that is periodically exhausted. What
it does not yet say is that the job can also report **success without
reviewing**: on #312 it finished in 1m 3s, exited green, and its own checklist
stopped two items short of posting any findings.

So the check carries no information in either direction. Run the reviewer from
`.claude/agents/` yourself, which `CLAUDE.md` already requires. Tracked as
#313.

## The smoke suite reuses a server already on port 4179

`web/test/smoke.mjs` will attach to whatever is already listening rather than
starting its own. A line reading *Reusing the server already on 4179* means
the suite may be testing another checkout's `dist`, and a green run proves
nothing about the working tree. Kill the orphan and rerun.

## Never put a heredoc mid-chain before `git commit`

A heredoc or a pipe-to-`grep` in the middle of a `&&` chain has twice let a
`git commit` run after a step that had actually failed, committing a broken
build. Run the validation, read the result, then commit as a separate step.

## A background loop outlives the agent that started it

*2026-09-14.* A subagent that backgrounds a wait-loop and then returns leaves
the loop running; nothing reaps it, and it appears in no agent's output. Two
spent forty-nine minutes polling a file that had stopped being written the
moment their agent finished. If a session reports background work you did not
ask for, look in the process table rather than the task list.

## What is specific to one machine, and is not written here

Toolchain facts do not generalise and are deliberately absent: where Node is
installed, whether `ruff` is on `PATH`, whether `make lint` can run locally at
all. These differ between a laptop and a cloud container, and a note that was
true on one is a false lead on the other. Establish them where you are.
