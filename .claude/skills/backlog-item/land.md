# Landing (`--land <N>`)

Part of the backlog-item procedure. `.claude/skills/backlog-item/SKILL.md`
says when to read this file; it binds as that file does, and sits apart from
it only so that a fork which never takes this path does not carry it on
every turn (AF-125).

## Handing over at the pull request

### Landing (`--land <N>`)

Run `start-check.sh` as *Starting* says, then skip *Before an item* and *Doing
the item*: the item was chosen, claimed and built. Read, in this order, and
nothing else first: the PR body and its comments (`gh pr view <N>
--comments`); the diff, in the PR's worktree, which `start-check.sh` lists —
`git fetch origin <branch> && git worktree add <scratchpad>/wt-<slug>
<branch>` when it is gone; and the issue only for what a comment names. Then
go on from *Review* where the verdict comment left it — fix, precheck,
confirmation, CI, merge. Every rule there applies as written: the fix is to
this diff, the confirmation is a fresh agent on the model the pace table
names, and nothing merges without a recorded `PASS`. A landing fork does not
hand over again; it returns any line *The result* allows except `OPENED`.
