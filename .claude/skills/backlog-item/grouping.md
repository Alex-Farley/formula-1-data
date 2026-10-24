# Grouping: companions and the tidy lane

Part of the backlog-item procedure. `.claude/skills/backlog-item/SKILL.md`
says when to read this file; it binds as that file does, and sits apart from
it only so that a fork which never takes this path does not carry it on
every turn (AF-125).

## Grouping

A reviewer pays a fixed cost on every pull request — the rules, the
surroundings of the diff, the build — before it reads a line of the change.
Two items that touch the same file pay it twice for nothing. `next.py
--group` is how a group is found.

**The head is the queue's next item, always.** Grouping decides what rides
with it, never which item comes first.

**What a companion must earn:** it is cheaper *because* it rides with the
head — the same file, query, component or test, so one reading of the
surrounding code serves both. A shared `source:` label or subject is not a
theme. If you cannot write the one sentence saying why these are one change,
they are not one change, and that sentence goes in the pull request.

- **How many is whatever is linked to the head**, at any size and at every
  pace `[D-20]`. The bound is the diff, not a number.
- **Size is a cost to weigh, not a gate.** An `M` companion is worth having.
  An `L` is the one to look at twice: `CONTRIBUTING.md` sizes it as needing a
  plan first, and if that plan is not the head's it is a head of its own. A
  `?` is sized by the reread — if it is an `L` in disguise, treat it as one
  and label it on the way past. **The rungs of one M item are still one PR**
  `[D-21]`.
- `--group`'s score is a hint: it reads titles and bodies, not code. Read the
  full bodies before taking any.
- **A companion from the status below the head** is being promoted past
  everything between. Say in the pull request why.
- **Two items that are the same defect** — one PR closes both and says they
  were one finding. That is a good outcome.
- **Drop, never grow.** If the diff stops reading as one change, drop the
  last companion added and **put its status back**. A group is an economy,
  not a target.
- A companion that does not survive the reread is declined like any other
  item; one that turns into a blocker is dropped and recorded on its own
  issue, status back, and the head carries on. Only the head being blocked is
  a `SKIPPED`.

**The tidy lane** `[D-54]` is the one place unrelated items share a pull
request. When the head is labelled `size: XS` — about thirty changed lines
or fewer: a wording fix, a comment, one data row, one declared exception —
up to four more `XS` items from the head's status or the one below ride with
it in a *tidy batch*, five at most, linked to it or not. `next.py --group`
lists them under the head's companions, in queue order. The rest of this
section still applies to a batch except the one-change test, which a batch
replaces with this:

- **Every gate is unchanged.** One review pass for the batch, by the
  reviewer *Review* and the pace table name for what the whole diff touches:
  the Opus first pass where any item is in an area that needs one, a fresh
  Sonnet where the whole batch is docs or wording, `frontend-reviewer-quick`
  at `fast` where every item is under `web/` and none touches
  `scripts/prerender.js`. A batch that spans `web/` and `data/` gets both
  areas' reviewers, launched in one message. The licence and security
  triggers are read against the whole diff, the precheck names every id, and
  all four checks are green before the merge.
- **The diff reads as a list of separate small changes**, one section per
  item in the PR body, each with its own `Closes` line. It does not have to
  read as one change; it does have to read item by item.
- **An item that grows past the limit leaves the batch**, status back, and
  is relabelled with its real size on the way past. So does one that turns
  out to need a decision or a source the batch cannot wait for. The batch
  never waits for its slowest member.
- **A linked `XS` item is simply a member of the batch.** A linked
  companion larger than `XS` still rides with an `XS` head under `[D-20]`,
  and then the PR is a group and not a tidy batch, because a batch is only
  `XS` items: take the group, and leave the unlinked `XS` items in the queue.
