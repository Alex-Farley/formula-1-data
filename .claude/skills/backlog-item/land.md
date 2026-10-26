# Landing an inherited pull request

Part of the backlog-item procedure. `.claude/skills/backlog-item/SKILL.md`
says when to read this file; it binds as that file does, and sits apart from
it only so that a fork which never takes this path does not carry it on
every turn (AF-125).

## Starting, on an inherited pull request

An open `claude/` PR that an earlier fork left — after a limit or a stall —
is landed, not rebuilt. Run `start-check.sh` as *Starting* says, then skip
*Before an item* and *Doing the item*: the item was chosen, claimed and
built. Read, in this order, and nothing else first: the PR body and its
comments (`gh pr view <N> --comments`); the diff, in the PR's worktree,
which `start-check.sh` lists — `git fetch origin <branch> && git worktree
add <scratchpad>/wt-<slug> <branch>` when it is gone; and the issue only for
what a comment names. Then go on from *Review* where the last verdict
comment left it — fix, precheck, confirmation, CI, merge. Every rule there
applies as written: the fix is to this diff, the confirmation is a fresh
agent on the model the pace table names, and nothing merges without a
recorded `PASS`.
