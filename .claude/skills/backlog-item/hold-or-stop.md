# Stop conditions, and holding instead

Part of the backlog-item procedure. `.claude/skills/backlog-item/SKILL.md`
says when to read this file; it binds as that file does, and sits apart from
it only so that a fork which never takes this path does not carry it on
every turn (AF-125).

## Stop conditions, and holding instead

**Stop on a decision only when it cannot be held.** Where rule 4 of *Before an
item* and this section seem to pull apart, that sentence settles it `[D-52]`.

**Hold** the item when the only thing in its way is a person's call: a
licence reading, a scope change, a trade the item does not settle, a change
that would weaken a check or a workflow if it were made, or the permission
classifier refusing an edit — on a licence record or a control, say. A hold
is five steps, in this order:

1. **The change does not happen.** Nothing routes around a refusal: not the
   same edit reworded, split, made with another tool or through another
   file. The question waits on the issue, and a person answers it.
2. `file.py decision <n> "<what must be decided, and what the item does
   under each answer>"`.
3. **Its dependants wait for it.** The candidates are the items `--group`
   printed as naming the head or named by it, and — because `--group` looks
   only at the head's status and the one below, and leaves out a `blocked`
   item — any line of `next.py --list Now`, `Next` and `Someday` whose
   title names the head. Read their bodies with `next.py <ID>...`; each that
   says it builds on the head's outcome gets `file.py blocked-by <n>
   [<n>...] --on <head>`. `next.py` passes over an item blocked by an open
   one, and the block lifts on its own when the head closes. An item that
   only mentions the head does not wait.
4. **The repository is left clean, and nothing is lost:** no worktree, no
   open PR, no half-edited file. Commits worth keeping are pushed to their
   branch and the branch is named in a comment on the issue; an open PR is
   closed with a comment saying why, never merged.
5. Status back, for the head and each companion. Return
   `DECIDE <ID>: <the question in one clause>`.

A companion that needs a decision is dropped from the group and held on its
own issue by steps 1 to 3, status back, and the head carries on. Only the
head being held is a `DECIDE`.

**Stop**, and say why, when the danger is one a hold cannot leave behind:
something already done — merged, on `main`, written to a published artefact
— that could corrupt data, breach a licence, weaken a check or lose history;
a change to production infrastructure other than by merging; a state that
cannot be left clean, such as a conflict in a source file or in prose that
`merge-main.py` hands to a person; a hold whose own record could not be
written, because a question that exists only in this context is lost with
it; and when the user asks to pause.

Stop, too, when `start-check.sh` refuses the primary checkout, and when
`next.py` exits 3 because the secondary limiter is refusing the board: both
are conditions no fork can work around, and the second cannot even be
recorded.

Skip and record an ordinary blocker — network, a service, a missing
non-critical credential — with `file.py blocked <n> "<what>"`, and leave the
repository clean: no worktree, no open PR, no half-edited file.
