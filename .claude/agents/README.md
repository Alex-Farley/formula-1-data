# The agents

Two families, with opposite postures. Keep them apart. A third file,
the loop's manager, is neither, and has a section of its own.

## Conformance reviewers

`licence-reviewer`, `data-integrity-reviewer`, `frontend-reviewer`.

They enforce **this project's own rules** on a diff, and each carries a list of
things not to propose because they were measured and rejected. Read-only. Used
on a change, by the backlog loop or from a terminal.

They are project-specific by design, and will not transplant.

Each carries an `effort` and a `maxTurns` in its frontmatter; read the files
rather than this paragraph for the values, which change. The cap is a runaway
stop, not a budget: a reviewer that hits it returns without recording a
verdict through `verdict.sh`, and the backlog loop treats that as no review — so a cap set too low wastes a pass
rather than saving one.

The two front-end reviewers run at `effort: medium` and the licence and data
reviewers at `effort: high`, because the consequences are asymmetric: a missed
front-end finding is a cosmetic regression the suite or the next item catches,
a missed licence or data finding is a published database that cannot be
withdrawn (`docs/DECISIONS.md` D-33). `frontend-reviewer-quick` is the same
checklist, read from `frontend-reviewer.md` so the rules stay in one file, on
Sonnet with a smaller cap; the loop uses it only at pace `fast` for a small
front-end change that does not touch the prerenderer. Which agent a pace
may use is set in `.claude/skills/backlog-item/SKILL.md`, and
`tests/test_conventions.py` checks every agent's and skill's frontmatter parses
and carries only keys Claude Code documents.

## Critics

`accessibility-critic`, `interaction-design-critic`, `visual-design-critic`,
`content-design-critic`, `information-architecture-critic`,
`data-architecture-critic`, `service-design-critic`, `product-design-critic`,
and `user-research-simulator`.

They assess the **whole project from outside** and may reopen any closed
decision, including the rejected list — provided they engage with the recorded
reason. Invoked deliberately, not on a diff.

**Never on a pull request**, and `tests/test_conventions.py` keeps one out of
the loop's reviewer list. A critic exists to find things and always will,
which is right against `main`, where what it finds becomes ranked issues, and
wrong inside a merge gate, where it turns a sound change into fix-and-confirm
rounds — `AF-16` spent five agent launches on one item that way
(`docs/DECISIONS.md` D-31).

Each is a discipline and nothing else. All the project context lives in
**`.claude/CRITIQUE-BRIEF.md`**, which every critic reads first: what the thing
is, who uses it, the three licence constraints that are not open to argument,
the pressure points, how to drive the running site, and the output contract.

**So a critic transplants to another project by copying the file and writing a
new brief.** If you change what the project is, change the brief — not nine
agents.

## The loop manager

`backlog-manager`.

Not a reviewer and not a critic: it reads nothing for findings and judges no
change. It is the backlog loop's driver, run as the **main thread** of a
session — `claude --agent backlog-manager`, or unattended by
`.claude/skills/backlog-loop/supervise.py` through `make loop` — so that the
loop is defined here rather than in whichever session or account starts it
(`docs/DECISIONS.md` D-42). It is never launched through the Agent tool and
never sits on the merge path; the forks it invokes launch the reviewers.

## Adding to either family

A new conformance reviewer needs the rule *and* the reason, and a "do not
propose" section — that section is what stops it generating noise.

A new critic should contain no project nouns at all. If you find yourself naming
a page, a table or a component in one, it belongs in the brief instead.
