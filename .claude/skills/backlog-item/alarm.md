# An alarm or a security alert

Part of the backlog-item procedure. `.claude/skills/backlog-item/SKILL.md`
says when to read this file; it binds as that file does, and sits apart from
it only so that a fork which never takes this path does not carry it on
every turn (AF-125).

## Started on the reserve (`--alarm`)

The driver adds `--alarm` when its usage check found the race-weekend
reserve held and this alarm the one thing it may go on `AF-130` `[D-55]`.
The reserve is spent on the alarm alone:

- **No companions and no tidy batch.** Read the item with `next.py <ID>`,
  never `--group`: the group is the alarm alone, whatever `grouping.md`
  would let ride.
- **An open `claude/` PR or a worktree that is not this alarm's is left as
  it is** — not landed, not reviewed, not touched. The one PR landed is
  the alarm's own: the `claude/<id>-` branch's, saying `Refs #<n>`, which
  the driver's `ALARM <ID> #<N>` line names and `land.md` lands. That breaks *one PR open at a time*
  for the alarm's sake, and the trade is deliberate: an ordinary item landed
  on the reserve is what the reserve is held against. The other PR may then
  need `main` merged into it once the alarm's fix lands, which the fork that
  inherits it does as `trouble.md` says.
- **A worktree that is this alarm's** — a fork stopped before it opened the
  PR, which `next.py --alarm` finds by its `claude/<id>-` branch — is
  inherited and finished from where it stopped, as *Starting* says.

## Doing the item

*Doing the item* gives every issue in the group a `Closes #<n>` line of
its own in the PR body. These two kinds of item are worked differently:

**Except an alarm** — an issue labelled `refresh-failing` or `results-late`,
which refresh.yml opens as an item and closes itself on the first run that
proves the fix: the PR says `Refs #<n>`, never a closing keyword, and its
body says how to work it `AF-89`.

**A security alert** — an issue labelled `source: security`, which
security.yml files — is an ordinary item and closes by `Closes #<n>` when
the alert is real. One that is a false positive or in test code is never
dismissed by a fork: only the maintainer dismisses an alert, so it is held
as *Stop conditions* (`hold-or-stop.md`) says, the `file.py decision` naming
each alert, the reason and the `gh api` command its body gives. A secret is
held the same way, real or not, and nothing about it goes in a PR `AF-121`.
