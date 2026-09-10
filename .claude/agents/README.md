# The agents

Two families, with opposite postures. Keep them apart.

## Conformance reviewers

`licence-reviewer`, `data-integrity-reviewer`, `frontend-reviewer`.

They enforce **this project's own rules** on a diff, and each carries a list of
things not to propose because they were measured and rejected. Read-only. Used
on a change, in a terminal or by `.github/workflows/review.yml`.

They are project-specific by design, and will not transplant.

## Critics

`accessibility-critic`, `interaction-design-critic`, `visual-design-critic`,
`content-design-critic`, `information-architecture-critic`,
`data-architecture-critic`, `service-design-critic`, `product-design-critic`,
and `user-research-simulator`.

They assess the **whole project from outside** and may reopen any closed
decision, including the rejected list — provided they engage with the recorded
reason. Invoked deliberately, not on a diff.

Each is a discipline and nothing else. All the project context lives in
**`.claude/CRITIQUE-BRIEF.md`**, which every critic reads first: what the thing
is, who uses it, the three licence constraints that are not open to argument,
the pressure points, how to drive the running site, and the output contract.

**So a critic transplants to another project by copying the file and writing a
new brief.** If you change what the project is, change the brief — not nine
agents.

## Adding to either family

A new conformance reviewer needs the rule *and* the reason, and a "do not
propose" section — that section is what stops it generating noise.

A new critic should contain no project nouns at all. If you find yourself naming
a page, a table or a component in one, it belongs in the brief instead.
