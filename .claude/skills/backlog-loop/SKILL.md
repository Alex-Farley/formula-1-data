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

Why: the driving session, not the reviewers, was 75-85 % of the loop's
tokens, because everything it had ever read stayed in context for the rest of
the run (`docs/DECISIONS.md` `[D-16]`). A fork per item is what makes the
driving context stop growing.

The rules are in `CLAUDE.md`; the per-item procedure, the pace table and
what never slides are in `.claude/skills/backlog-item/SKILL.md`, which is
their only normative copy; the scripts the fork uses are in this folder: `next.py` (reads the queue), `file.py` (writes to
it), `precheck.sh`, `ci-wait.sh`, `merge-main.py`, `review-prompt.md`, and
`progress.sh`, which the fork calls at each stage to append one line to
`.claude/loop/progress.log` - the only view of the fork a person has.

## Arguments

Two words, either order, both optional.

- **Target**: `next` takes the first open item in the queue's own order;
  an item id takes that item; `until-paused` repeats `next` until told to
  stop or the fork reports a stop condition. Default `next`.
- **Pace**: `fast`, `balanced` or `thorough`. Default `balanced`. The pace
  is passed to the fork unchanged; the table there says what each position
  may relax. Nothing in this file changes with the pace.

## Procedure

1. Write one line: `Loop: <target> at <pace>.` Then make the fork
   watchable: `mkdir -p .claude/loop && touch .claude/loop/progress.log`,
   so the file exists before anyone tails it; if the desktop app's
   `show_pane` tool is available, open it in the Files pane; either way
   add one line saying that this session will show no activity until the
   fork returns, and that the fork's stages appear in that file -
   `tail -f .claude/loop/progress.log` from a terminal. Nothing else
   before the fork: a fork that looks stalled gets killed `[D-17]`.
2. Invoke the Skill tool: skill `backlog-item`, args `<pace> <target>`
   where target is `next` or the item id, followed by `--skip <ids>` when
   this run has skipped any. Do not do any of the fork's work
   here, and do not read the board or the issue list to "check" first -
   `next.py` inside the fork does that for a few hundred tokens.
3. Read the **first line** of the result and act on it:
   - `MERGED #<N> <ID>`, or `MERGED #<N> <ID>+<ID>` when the fork grouped
     items that shared a file into one pull request (*Grouping* in the item
     skill; one fork is still one PR and one line back): with
     `until-paused`, go to step 2 with `next`; otherwise stop and print the
     stock-take the fork returned.
   - `SKIPPED <ID>: <reason>`: the fork recorded an ordinary blocker on the
     issue (label `blocked`, a comment saying what) and left the repository
     clean. Add the id to this run's skip
     list; with `until-paused`, go to step 2 with `next --skip <the list>`,
     so the next fork passes over it rather than meeting it again. Two
     consecutive skips of different items stop the loop: a blocker that
     hits two unrelated items is the environment, not the items.
   - `STOP: <reason>`: a stop condition or a person's decision. Stop; print
     the stock-take.
   - `LIMIT: resets <time>`, **or the Skill tool returning an error that
     names a usage or session limit** (`You've hit your session limit ·
     resets 1:30pm (Europe/London)` was the wording on 2026-09-13; a fork
     the limit kills writes no contract line, so this error is the usual
     form and the `LIMIT:` line the rarer one, written by a fork that saw a
     reviewer it launched die on the limit). Take the reset time from
     whichever arrived. Schedule a wake-up for one minute after it (a
     one-shot `CronCreate`, or `ScheduleWakeup` inside a `/loop`) that
     reinvokes this skill with the same arguments, then stop. The fork is
     relaunched fresh, never resumed. A PR or worktree it left open is
     picked up by the next fork, which checks `gh pr list` and
     `git worktree list` before starting.
   - Anything else - no contract line, an empty result, an error that names
     no limit, a fork that says it is waiting for a reviewer or for CI - is
     not a merge and not a PASS. Run `gh pr list --state open` and
     `git worktree list`, report what is open in two lines, and stop.
     Never merge from this skill. A reviewer verdict that arrives here as a
     background-task notification came from a fork that has already
     returned: record it on the PR as a comment so the next fork finds it,
     and never act on it here.
4. Between items, nothing else: no summary of the fork's work, no reviewer
   report pasted back, one line per item. The PR comment is the record.

## When the loop stops

End with the stock-take, once, in at most five lines: merged this run, open
PRs, decisions needed, what `next.py` says is next. Then stop.

## Running it cheaply

- **Start the loop in a session with the connectors off.** Every MCP
  server's tool schemas sit in the fixed prefix of every turn - about 74,000
  tokens in the measured sessions - and they ride on the fork and on every
  reviewer it launches `[D-18]`. The loop uses none of them.
- The implementer's effort is the session's: set `CLAUDE_CODE_EFFORT_LEVEL`
  or `effortLevel` before starting, not during a run, because a change of
  effort mid-session breaks the prompt cache. The pace does not set it; the
  Agent tool overrides a model per call but not an effort, so a pace picks
  reviewer *agents*, whose effort and turn cap are in their frontmatter.
- `fast` is for a run of small, well-specified items while a person is
  around to look at the result: it relaxes the first-pass reviewer for a
  small front-end change and how many routes the brief names, and nothing
  else. `thorough` is for a data change or anything that touches a
  publishing path. `balanced` is the default `[D-19]`.
