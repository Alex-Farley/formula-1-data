# Claude Code

The rules for this repository are in `AGENTS.md`, the rules file other agent
tools read, and this file imports it whole:

@AGENTS.md

What follows is only what is particular to Claude Code — its adapter notes
for the backlog loop, whose procedure (`.claude/skills/backlog-item/`) names
actions and leaves how an agent performs them to notes like these. A rule
for every agent goes in `AGENTS.md`, never here; another agent's notes go
in a file of its own, not here.

## The loop, in Claude Code

- The loop is a skill, invoked on purpose rather than run by default:
  `/backlog-loop next`, `/backlog-loop <ITEM-ID>` or `/backlog-loop
  until-paused`, with an optional pace. Every item runs in a forked context,
  because the driving session — not the reviewers — was 75–85 % of the
  loop's tokens `[D-16]`.
- Unattended, from any checkout and any Claude account, it is `make loop
  ARGS="until-paused"`: the `backlog-manager` agent under `supervise.py`,
  which restarts it after a usage limit, because nothing the loop depends on
  may live in one account's memory or session `[D-42]`.
- **A reviewer is launched with the Agent tool, with
  `run_in_background: false`, and waited for.** The Agent tool backgrounds
  by default, and a fork that backgrounds a reviewer and ends its turn has
  returned. Two reviewers on one PR are launched in one message, both
  foreground.
- **In auto mode the merge is refused as *Merge Without Review*** until a
  verdict is a comment on the PR, which `[D-23]` already puts there; a
  refusal means the record is missing, and the answer is to record it, never
  to route around it.

## Measured and rejected, in Claude Code — do not re-propose

Restricting the fork's tools through skill frontmatter `[D-32]`, and lowering
its effort the same way `[D-35]` — for both, re-probe before re-proposing;
the keys were inert when tested, and `[D-35]` names the probe that would
settle it.
