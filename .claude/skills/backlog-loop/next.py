#!/usr/bin/env python3
"""
Print the next item of docs/BACKLOG.md, or one named item, and nothing else.

    python3 .claude/skills/backlog-loop/next.py            # first open item, queue order
    python3 .claude/skills/backlog-loop/next.py PD-02      # that item, wherever it sits
    python3 .claude/skills/backlog-loop/next.py --list Now # one line per open item in a section
    python3 .claude/skills/backlog-loop/next.py --skip AF-03,VD-26   # the next item after those

Why this exists: the backlog is 145 KB, half of it Landed and Declined
history, and the loop was reading it in ten- to seventeen-thousand-character
slices to find the first open item — on every item, in a context that then
carried those slices through the rest of the session. The 2026-09-13
measurement put the orchestrating session at 75-85 % of the loop's tokens,
with a median context of 356,000 tokens a turn. This prints the one item the
loop is about to work on, with its section and the open decisions it must
work around, and costs a few hundred tokens to read.

Queue order is the file's own: *Now* before *Next* before *Someday, or maybe
never*, top to bottom within a section. *Decisions needed* is not a queue -
its open entries are printed as a reminder, never as the next item. The
section order is a person's ranking; this script does not reorder anything.

What it does NOT do: the within-section tiebreak the loop's rules keep for a
section nobody has ranked by hand - correctness before integrity and
licensing, functional, security, architecture, accessibility, UX,
throughput - needs a reading of each item, so the fork applies it from
`--list <section>` and says so in the PR. The file's own order is what a
person ranked, and *Now* and *Next* have been ranked by hand since
2026-09-13 (#100).

`--skip A,B` passes over the ids named - the items a run has already skipped
as blocked - so a blocked head-of-queue item does not stall `until-paused`.

Exit 0 with the item on stdout; 1 when there is no open item (or the named
one is not found), with the reason on stderr.
"""
import re
import sys

QUEUE = "docs/BACKLOG.md"
SECTIONS = ("Now", "Next", "Someday, or maybe never")
OPEN = re.compile(r"^- \[ \] `([A-Z]{2}-\d+)`")
HEADING = re.compile(r"^## (.+?)\s*$")
DECISION = re.compile(r"^- `([A-Z]{2}-\d+)` \*\*(.+?)\*\*")


def split_sections(text):
    """{heading: [lines]} in file order, top-level ## headings only."""
    sections, name = {}, None
    for line in text.splitlines():
        m = HEADING.match(line)
        if m:
            name = m.group(1)
            sections[name] = []
        elif name is not None:
            sections[name].append(line)
    return sections


def items(lines):
    """Each open item as (id, paragraph): the entry line and its indented
    continuation lines, up to the next blank line."""
    out, i = [], 0
    while i < len(lines):
        m = OPEN.match(lines[i])
        if not m:
            i += 1
            continue
        block = [lines[i]]
        i += 1
        while i < len(lines) and lines[i].strip() and not OPEN.match(lines[i]):
            block.append(lines[i])
            i += 1
        out.append((m.group(1), "\n".join(block)))
    return out


def open_decisions(lines):
    """Entries under *Decisions needed* not yet struck through."""
    return [(m.group(1), m.group(2)) for m in map(DECISION.match, lines) if m]


def main(argv):
    skip = set()
    if "--skip" in argv:
        at = argv.index("--skip")
        if at + 1 >= len(argv):
            sys.exit("--skip needs a comma-separated list of ids")
        skip = {s.strip() for s in argv[at + 1].split(",") if s.strip()}
        argv = argv[:at] + argv[at + 2:]
    try:
        text = open(QUEUE, encoding="utf-8").read()
    except FileNotFoundError:
        sys.exit(f"{QUEUE} not found - run from the repository root")
    sections = split_sections(text)
    decisions = open_decisions(sections.get("Decisions needed", []))

    if argv[:1] == ["--list"]:
        name = " ".join(argv[1:]) or "Now"
        if name not in sections:
            sys.exit(f"no section '## {name}' in {QUEUE}")
        for ident, para in items(sections[name]):
            # The bold title often wraps onto a second line; join before matching,
            # or a later **figure** in the body is taken for the title.
            flat = " ".join(line.strip() for line in para.splitlines())
            title = re.search(r"\*\*(.+?)\*\*", flat)
            print(f"{ident}  {title.group(1) if title else flat[:90]}")
        return

    wanted = argv[0] if argv else None
    for name in SECTIONS if wanted is None else sections:
        for ident, para in items(sections.get(name, [])):
            if ident in skip:
                continue
            if wanted is None or ident == wanted:
                print(f"## {name}\n\n{para}\n")
                if decisions:
                    print("Decisions needed, still open — work around them, never take them:")
                    for d_id, title in decisions:
                        print(f"  {d_id}  {title}")
                return
    if wanted:
        sys.exit(f"{wanted} is not open anywhere in {QUEUE} (landed, declined, or never filed)")
    sys.exit(f"no open item under {', '.join(SECTIONS)} in {QUEUE}")


if __name__ == "__main__":
    main(sys.argv[1:])
