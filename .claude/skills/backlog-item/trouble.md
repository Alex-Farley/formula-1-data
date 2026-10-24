# A rate limit, a failed check, main moved under the branch

Part of the backlog-item procedure. `.claude/skills/backlog-item/SKILL.md`
says when to read this file; it binds as that file does, and sits apart from
it only so that a fork which never takes this path does not carry it on
every turn (AF-125).

## Keeping the cost down

- **A rate limit is an ordinary blocker, and retrying extends it** `[D-27]`.
  A `gh` failure naming a limit while `gh api rate_limit` looks untouched is
  the secondary limiter. Record it, stop calling, come back. `precheck.sh`
  tells it from a real "not an open issue" FAIL, which you can trust.
- **The limiter refusing the board read is a `STOP`, not a skip.** `next.py`
  exits **3** on it and names it, distinctly from the 2 that means `gh`
  failed for some other reason. Recording a blocker is itself a board write,
  so the skip path needs the call that is being refused; and no fork can
  choose an item while the board is unreadable. Do not poll it — a poll every
  45 seconds keeps it closed `[D-27]`. Return `STOP` and let the run be
  picked up later.

## Waiting and merging

- **A 2 on a check the diff cannot reach is rerun once, and recorded first**
  `AF-106`: `file.py flake "<the failing test's line, as the job printed
  it>" <the failed run's URL>`, then `gh run rerun <run-id> --failed`, then
  `ci-wait.sh` again. The record names the test that failed — a smoke
  check's `FAIL [Section] message` line, a unit test's name — never the job
  (`web`, `check (3.12)`) it failed in. `CONTRIBUTING.md` under *The queue*
  says what the record does. A check the diff can reach is not a flake but a
  finding, and a second failure on the rerun is read as one too.
- **Main moved under the branch:** `python3
  .claude/skills/backlog-loop/merge-main.py` from the worktree. It resolves
  only what it can safely — the generated artefacts with a rebuild, and a
  README or licence-statement conflict that is only figure spans moving. A
  conflict in a source file or in prose stops it with the file named, for a
  person. Rerun the web tests before pushing. Merge PRs one at a time.
