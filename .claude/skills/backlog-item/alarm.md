# An alarm or a security alert

Part of the backlog-item procedure. `.claude/skills/backlog-item/SKILL.md`
says when to read this file; it binds as that file does, and sits apart from
it only so that a fork which never takes this path does not carry it on
every turn (AF-125).

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
