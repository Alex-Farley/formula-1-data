---
name: backlog-item-sonnet
description: The backlog-item procedure run on Sonnet, for the AF-144 trial - one XS or S item that names no protected path. Invoked only by the backlog-loop driver when `next.py --implementer` says sonnet; never chosen by hand.
argument-hint: "<balanced | thorough> <ITEM-ID> --max-size S [--skip A,B]"
context: fork
# Live in a fork, unlike `effort`: probed 2026-10-27 by the per-model usage
# a headless session reports, an Opus session's fork of a skill naming
# sonnet ran on Sonnet and one naming nothing ran on Opus. D-60.
model: sonnet
# Kept for the reason backlog-item keeps it: probed and apparently inert,
# and deleting it would drop the fork's effort if it is live. D-35.
effort: high
---

# One backlog item, on Sonnet

You are the forked context for one item, run on Sonnet under the trial
AF-144 (#1150) agreed with the maintainer: Sonnet implements XS and S items,
the review is unchanged, and the trial is reverted if the review finds the
work worse `[D-60]`.

**Read `.claude/skills/backlog-item/SKILL.md` now and follow it exactly**,
with the arguments you were given. It is the procedure; this file adds only
what the trial needs, and where the two seem to differ, that file wins except
on the four points below.

1. **Only the item you were given, and nothing on a protected path.** The
   driver chose it with `next.py --implementer`, which keeps an item on Opus
   when its body names a data path (`build.py`, `verify.py`, `schema.sql`,
   `data/`, `harvest/`, `tools/`) or a publishing one (`.github/`,
   `export_json.py`, the deploy chain under `web/`, the licence texts, the
   committed artefacts, the files of the loop's own controls) -
   `.claude/skills/backlog-loop/implementer.py` holds the list. A body is a
   claim about where the work lands, so when you reread the item against the
   code, before anything is claimed: if the work needs a protected path
   after all, put nothing in progress, open no worktree, and return
   `REROUTE <ID>: <the path, in one clause>`. The driver hands the item to
   the ordinary Opus fork. A companion or a tidy-batch item that needs one
   does not ride - leave it in the queue, which is not a drop, since it was
   never taken.
2. **Label the pull request**: `gh pr create ... --label "implementer: sonnet"`.
   The label is how the trial is counted (`next.py --implementer` stops
   choosing Sonnet at ten) and how it is measured (AF-146, #1175). A pull
   request implemented here and not labelled is lost to the trial.
3. **Run the precheck as `LOOP_IMPLEMENTER=sonnet bash
   .claude/skills/backlog-loop/precheck.sh <ID>...`.** It refuses a pull
   request implemented here that touches a protected path, or that is not
   labelled. Never take the label off, or run it without the variable, to
   pass it. A missing label is fixed by adding it (`gh pr edit <N>
   --add-label "implementer: sonnet"`). On a protected path, close the pull
   request unmerged with a comment naming the path (`gh pr close <N>
   --comment "..." --delete-branch`), remove the worktree, put every status
   back, and return `REROUTE <ID>: <the path>`; the Opus fork starts the item
   again from the issue.
4. **Write `implementer: sonnet` in the progress line for *item chosen***,
   so `.claude/loop/progress.log` can attribute the `usage` lines around it.

Everything else - the pace table, the review on the models it names, the
four checks, the stop conditions and the result lines - is the procedure's,
unchanged. `REROUTE` is the one result line this file adds.
