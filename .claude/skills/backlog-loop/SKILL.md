---
name: backlog-loop
description: Drive the autonomous development loop through the issue queue - one item per forked context, a fresh independent review, merge on PASS and green CI, next item. Invoke as /backlog-loop next, /backlog-loop <ITEM-ID> or /backlog-loop until-paused, with an optional pace - fast, balanced (the default) or thorough.
argument-hint: "[next | <ITEM-ID> | until-paused] [fast | balanced | thorough]"
disable-model-invocation: true
---

# The backlog loop: the driver

This skill stays in the session a person started and stays small. It does not
read the queue, open an issue, run the build or launch a reviewer. Every item
runs in **`backlog-item`**, a forked skill in `.claude/skills/backlog-item/` -
or, for the Sonnet trial step 2 describes, `backlog-item-sonnet`, which runs
that same procedure on Sonnet - whose context is discarded when it returns - the item merged, skipped, held or
stopped. What comes back here is one contract line and a stock-take of at most
five lines.

Why: the driving session, not the reviewers, was 75-85 % of the loop's
tokens, because everything it had ever read stayed in context for the rest of
the run (`docs/DECISIONS.md` `[D-16]`). A fork per item is what makes the
driving context stop growing.

The rules are in `CLAUDE.md`; the per-item procedure, the pace table and
what never slides are in `.claude/skills/backlog-item/` (`SKILL.md` and the
passages it says when to read), which is their only normative copy; the scripts the fork uses are in this folder: `start-check.sh` (what it
checks before it starts), `next.py` (reads the queue), `file.py` (writes to
it), `loop_usage.py` (reads the plan's usage before each fork, and in the
fork at its start and end; `--costs` prints per-item cost from those lines),
`precheck.sh`, `ci-wait.sh`, `merge-main.py`, `review-prompt.md`, and
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
2. Read the plan's usage: `python3 .claude/skills/backlog-loop/loop_usage.py --loop`.
   It costs no model turn and a few seconds, and its first word decides
   `[D-55]`. `--loop` files the line under `usage` in the log; a run
   without it is filed as `usage (manual)`:
   - `GO` or `UNKNOWN`: invoke the fork as below. `UNKNOWN` means usage
     could not be read, and the loop reacts to a limit when one arrives, as
     it did before the check existed.
   - `SMALL`: invoke the fork with `--max-size S` added to its args, so it
     takes only an XS or S item. Keep the session reset the line names.
   - `WAIT until <time> - <why>`: start no fork. Interactively, schedule a
     wake-up for one minute after `<time>` that reinvokes this skill with
     the same arguments, as for a limit below, then stop. Run as the
     `backlog-manager` agent, schedule nothing: return
     `PAUSE: until <time> - <why>`, and `supervise.py` sleeps until then.
   - `ALARM <ID> until <time> - <why>`, or `ALARM <ID> #<N> until ...`:
     the race-weekend reserve is what holds the week back, and the one
     thing it may be spent on is open - a refresh alarm at the head of the
     queue, an alarm a fork was stopped on before its pull request, or the
     pull request `#<N>` an alarm fork opened and did not land `AF-130`.
     Invoke the fork with args `<pace> <ID> --alarm`, and no `--skip` or
     `--max-size` - the fork finds the alarm's own pull request itself: `--alarm` keeps
     companions, a tidy batch and any other open pull request off the
     reserve. Whatever it returns,
     nothing else starts until this step has run again, so the reserve
     goes on that item alone. When the target is an item id other
     than `<ID>`, the line is `WAIT until <time>`: a person's chosen item
     does not spend the reserve, and neither does the alarm they did not
     choose.

   Otherwise, **choose the implementer** when the target is `next` or
   `until-paused` and the pace is `balanced` or `thorough`: run
   `python3 .claude/skills/backlog-loop/next.py --implementer`, with the
   `--skip` and `--max-size S` the fork would be given. It costs no model
   turn and one board read. When its output starts `sonnet <ID>`, invoke the
   Skill tool: skill `backlog-item-sonnet`, args `<pace> <ID> --max-size S`,
   with `--skip <ids>` when this run has skipped any. Anything else - `opus`,
   an error, any exit other than 0 - and at `fast` or for an item id a person
   named, invoke the ordinary fork below. This is the Sonnet trial, AF-144
   `[D-60]`: Sonnet implements an XS or S item that names no protected
   path, and the review is unchanged. `fast` stays out of it because its
   quick reviewer is Sonnet too, and the trial leans on the Opus first pass.

   The ordinary fork: invoke the Skill tool: skill `backlog-item`, args `<pace> <target>`
   where target is `next` or the item id, followed by `--skip <ids>` when
   this run has skipped any, and `--max-size S` when the check said
   `SMALL`. Do not do any of the fork's work
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
     hits two unrelated items is the environment, not the items. A hold
     between them neither counts as one nor resets the count.
   - `DECIDE <ID>: <question>`: the fork met a person's decision it could
     hold, so it put the question on the issue (label `decision`), made
     the items that build on it wait for it, and left the repository clean.
     Nothing is half-done and the queue can carry on: with `until-paused`,
     go to step 2 with `next` and the same skip list - `next.py` passes over
     a `decision` label on its own; otherwise stop and print the stock-take.
     Keep the id for the stock-take's decisions line. Two holds in a row
     are two questions for a person, not a broken environment; **three with
     no merge between them stop the loop**, because a classifier or a rule refusing every item
     would otherwise label the whole queue one fork at a time `[D-52]`.
   - `STOP: <reason>`: a stop condition, or a person's decision the fork
     could not hold. Stop; print the stock-take. Two of these are the environment rather than the item,
     and both are a person's to clear: the fork's `start-check.sh` refusing
     because this checkout is on a feature branch or has uncommitted changes
     — a session worked in it directly instead of in a worktree — and
     GitHub's secondary rate limiter refusing the board read, which no fork
     can record around and no poll can shorten `[D-27]`. Neither is worth a
     second fork; say which one it was.
   - `REROUTE <ID>: <path>`: a `backlog-item-sonnet` fork found that the
     item needs a protected path after all, and left nothing claimed. Invoke
     the ordinary fork at once with `<pace> <ID>` and the same `--skip` and
     `--max-size` the check gave, once - its line is the one acted on. Not a
     skip and not a hold, so it counts as neither.
   - `PAUSE: <why>`: the fork was given `--max-size S` and nothing in the
     queue was that small. Nothing is claimed or half-done. Treat it as
     `WAIT until <the session reset the SMALL line named>` in step 2.
   - `LIMIT: resets <time>`, **or the Skill tool returning an error that
     names a usage or session limit** (`You've hit your session limit ·
     resets 1:30pm (Europe/London)` was the wording on 2026-09-13; a fork
     the limit kills writes no contract line, so this error is the usual
     form and the `LIMIT:` line the rarer one, written by a fork that saw a
     reviewer it launched die on the limit). Take the reset time from
     whichever arrived. Schedule a wake-up for one minute after it (a
     one-shot `CronCreate`, or `ScheduleWakeup` inside a `/loop`) that
     reinvokes this skill with the same arguments, then stop. Run as the
     `backlog-manager` agent, schedule nothing: return the line, and
     `supervise.py` restarts the session `[D-42]`. The fork is
     relaunched fresh, never resumed. A PR or worktree it left open is
     picked up by the next fork, which checks `gh pr list` and
     `git worktree list` before starting.
   - **A fork that fails with `Agent stalled: no progress for 600s`** (the
     stream watchdog): the model's response stream went quiet, not the
     fork's tools; every one so far came after a tool had returned
     `[D-50]`. It is the environment, not the item.
     Invoke the fork once more with the same arguments: its `start-check.sh`
     prints the worktree or PR the stalled fork left, and it finishes that
     from where it stopped. A second stall in a row stops the loop - the
     machine needs a person, not a third fork - and leaves the item
     claimed, so report what is open as for anything else: `gh pr list
     --state open` and `git worktree list`, in two lines.
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

## Running it unattended

`make loop ARGS="until-paused balanced"` — or `python3
.claude/skills/backlog-loop/supervise.py until-paused` — runs this procedure
headless as the `backlog-manager` agent (`.claude/agents/`), with no MCP
servers, and starts a fresh session after a usage limit. It works from any
clone, under any Claude account with `gh` signed in, because everything it
reads is in the repository `[D-42]`. It always runs `--permission-mode
auto`, because auto mode's refusal to merge a PR with no recorded verdict is
a control, and an account without auto mode runs the loop by hand. Its own
lines go to `.claude/loop/progress.log` beside the forks', under the id
`supervisor`; it runs the usage check before each session and sleeps through
a `WAIT` rather than start one, and the check's own lines from step 2 appear
under `usage`, with the figures each decision used.

## Running it cheaply

- **Start the loop in a session with the connectors off.** Every connected
  MCP server's tool schemas sit in the fixed prefix of every turn, and the
  fork carries the session's whole tool set `[D-18]`: `allowed-tools` and
  `disallowed-tools` in a skill's frontmatter were both measured inert for a
  forked context `[D-32]`, so turning the connectors off is the lever. The
  reviewers do not: every agent in `.claude/agents/` restricts itself to
  `Read, Grep, Glob, Bash`, so an MCP server costs them nothing.
  The loop uses none of them either way.
- The implementer's model is the session's, except where step 2 chooses
  Sonnet: a forked skill's `model:` key is live where its `effort:` key is
  not, probed by the per-model usage a headless session reports `[D-60]`.
- The implementer's effort is the session's: set `CLAUDE_CODE_EFFORT_LEVEL`
  or `effortLevel` before starting, not during a run, because a change of
  effort mid-session breaks the prompt cache. `backlog-item/SKILL.md`'s
  `effort: high` appears not to override it — probed, well-evidenced, not
  proven `[D-35]`. The pace does not set it; the Agent tool overrides a model
  per call but not an effort, so a pace picks reviewer *agents*, whose effort
  and turn cap are in their frontmatter.
- `fast` is for a run of small, well-specified items while a person is
  around to look at the result: it relaxes the first-pass reviewer for a
  small front-end change and how many routes the brief names, and nothing
  else. `thorough` is for a data change or anything that touches a
  publishing path. `balanced` is the default `[D-19]`.
