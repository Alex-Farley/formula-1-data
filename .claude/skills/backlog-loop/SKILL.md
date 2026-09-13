---
name: backlog-loop
description: Drive the autonomous development loop through the issue queue - one item per forked context, a fresh independent review, merge on PASS and green CI, next item. Invoke as /backlog-loop next, /backlog-loop <ITEM-ID> or /backlog-loop until-paused, with an optional pace - fast, balanced (the default) or thorough.
argument-hint: "[next | <ITEM-ID> | until-paused] [fast | balanced | thorough]"
disable-model-invocation: true
---

# The backlog loop: the driver

This skill stays in the session a person started and stays small. It does
not read the queue, open an issue, run the build or launch a reviewer. Every
item runs in **`backlog-item`**, a forked skill in
`.claude/skills/backlog-item/`, whose context is discarded when the item is
merged, skipped or stopped. What comes back here is one contract line and a
stock-take of at most five lines.

Why, measured 2026-09-13 from the session transcripts: the session driving
the loop was 75-85 % of the loop's tokens, not the reviewers. It ran 190-440
turns per session at a median context of 230,000-356,000 tokens a turn,
peaking at 612,000, because every slice of the backlog, every build log and
every reviewer report it had ever read stayed in context for the rest of the
run. The reviewers ran at 46,000-67,000. A fork per item is what makes the
driving context stop growing.

The rules are in `CLAUDE.md` under *Working autonomously* and in
`CONTRIBUTING.md`; the per-item procedure, the pace table and what never
slides are in `.claude/skills/backlog-item/SKILL.md`; the scripts the fork
uses are in this folder: `next.py` (reads the queue), `file.py` (writes to
it), `precheck.sh`, `ci-wait.sh`, `merge-main.py`, `review-prompt.md`.

## Arguments

Two words, either order, both optional.

- **Target**: `next` takes the first open item in the queue's own order;
  an item id takes that item; `until-paused` repeats `next` until told to
  stop or the fork reports a stop condition. Default `next`.
- **Pace**: `fast`, `balanced` or `thorough`. Default `balanced`. The pace
  is passed to the fork unchanged; the table there says what each position
  may relax. Nothing in this file changes with the pace.

## Procedure

1. Write one line: `Loop: <target> at <pace>.` Nothing else before the fork.
2. Invoke the Skill tool: skill `backlog-item`, args `<pace> <target>`
   where target is `next` or the item id, followed by `--skip <ids>` when
   this run has skipped any. Do not do any of the fork's work
   here, and do not read the board or the issue list to "check" first -
   `next.py` inside the fork does that for a few hundred tokens.
3. Read the **first line** of the result and act on it:
   - `MERGED #<N> <ID>`: with `until-paused`, go to step 2 with `next`;
     otherwise stop and print the stock-take the fork returned.
   - `SKIPPED <ID>: <reason>`: the fork recorded an ordinary blocker on the
     issue (label `blocked`, a comment saying what) and left the repository
     clean. Add the id to this run's skip
     list; with `until-paused`, go to step 2 with `next --skip <the list>`,
     so the next fork passes over it rather than meeting it again. Two
     consecutive skips of different items stop the loop: a blocker that
     hits two unrelated items is the environment, not the items.
   - `STOP: <reason>`: a stop condition or a person's decision. Stop; print
     the stock-take.
   - `LIMIT: resets <time>`: a usage or session limit ended the fork.
     Schedule a wake-up for one minute after the reset (a one-shot
     `CronCreate`, or `ScheduleWakeup` inside a `/loop`) that reinvokes this
     skill with the same arguments, then stop. The fork is relaunched fresh,
     never resumed. A PR it left open is picked up by the next fork, which
     checks `gh pr list` and `git worktree list` before starting.
   - Anything else - no contract line, an empty result, an error - is not a
     merge and not a PASS. Run `gh pr list --state open` and
     `git worktree list`, report what is open in two lines, and stop. Never
     merge from this skill.
4. Between items, nothing else: no summary of the fork's work, no reviewer
   report pasted back, one line per item. The PR comment is the record.

## When the loop stops

End with the stock-take, once, in at most five lines: merged this run, open
PRs, decisions needed, what `next.py` says is next. Then stop.

## Running it cheaply

- Start the loop in a session with the connectors off. Every MCP server's
  tool schemas sit in the fixed prefix of every turn - about 74,000 tokens
  before any work in the measured sessions - and the loop uses none of them.
- The implementer's effort is the session's: set `CLAUDE_CODE_EFFORT_LEVEL`
  or `effortLevel` before starting, not during a run, because a change of
  effort mid-session breaks the prompt cache. The pace does not set it; the
  Agent tool overrides a model per call but not an effort, so a pace picks
  reviewer *agents*, whose effort and turn cap are in their frontmatter.
- `fast` is for a run of small, well-specified items while a person is
  around to look at the result; `thorough` for a data change or anything
  that touches a publishing path. `balanced` is the default because it is
  what the 2026-09-13 review-cost decisions describe.
