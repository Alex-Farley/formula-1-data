# A pass that recorded no verdict

Part of the backlog-item procedure. `.claude/skills/backlog-item/SKILL.md`
says when to read this file; it binds as that file does, and sits apart from
it only so that a fork which never takes this path does not carry it on
every turn (AF-125).

## Review

**One respawn when a pass records no verdict**, whatever the reason — it ran
out of turns, forgot the command, or the command refused it. Open a new pass
id and send the **same brief** to a fresh agent of the same kind with only the
id changed; everything else goes across, so the pass that settles the item is
briefed no more thinly than the one it replaces. The respawn's findings are
read like any pass's. If it records nothing either, the item has no review and
the *Not a PASS* rule below applies. Interpreting a reply instead is how the
rule rots: the fork that reads a verdict out of prose today is the fork that
reads past a FAIL phrased as a sentence tomorrow `[D-37]`.

- **Not a PASS**, and no respawn is owed: a rate limit or an unavailable
  account. Retrying a limit extends it `[D-27]`.
- **Not a PASS after its one respawn**, and one respawn is the whole of it:
  a pass for which `verdict.sh read` exits 1 — silence, a reviewer that hit
  its turn cap, one that never ran the command, or one whose command was
  refused. The second pass settles the item, whichever of those the first
  was.
  If the agent dies on a session limit, return `LIMIT: resets <time>` at
  once; you cannot outlive the reset.
