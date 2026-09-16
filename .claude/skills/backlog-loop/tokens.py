#!/usr/bin/env python3
"""What an item cost, read from Claude Code's own transcripts.

The loop's whole argument is about tokens, and until now every figure in
`docs/DECISIONS.md` came from reading a session by hand. This reads the
per-message `usage` Claude Code already writes to
`~/.claude/projects/<project>/*.jsonl` and totals it for a window.

Three things run and they are told apart by where they write. The **driver**
is the session's top-level `<uuid>.jsonl`. Everything else writes
`<uuid>/subagents/agent-<id>.jsonl` with its `agentType` in the `.meta.json`
beside it - and that is where the care is needed, because the **fork** runs
as a subagent too, as `general-purpose` with no description. Treating every
subagent as a reviewer reported review at 94 % of one real run when it was
nearer a quarter. So a reviewer is an agentType that names a file in
`.claude/agents/`, derived rather than listed; anything else is
implementation. (Do not reach for `isSidechain`: it is present and always
false.)

    tokens.py --since 14:48                 everything since 14:48 today
    tokens.py --item AF-23                  the window that item held, from progress.log
    tokens.py --since 14:48 --json          same, machine-readable

These are the raw figures the API returned, and they are NOT the weighted
number the Agent tool reports as `subagent_tokens`, nor a plan percentage.
Checked against five reviewer passes on 2026-09-16: the tool reported 105,784
where the transcript holds 27,654 input+output and 253,072 including
cache-writes, and the ratio is not constant across agents. Use this to compare
one item with another, which is what it is for; do not present a figure from
it as what something cost on the bill.

No third-party dependencies, like everything else here.
"""
import argparse
import datetime as dt
import glob
import json
import os
import re

HOME = os.path.expanduser("~")


def project_dir(cwd):
    """Claude Code slugifies the working directory to name its project folder."""
    return os.path.join(HOME, ".claude", "projects", "-" + re.sub(r"[^A-Za-z0-9]", "-", cwd).strip("-"))


def parse_clock(s, day):
    """`14:48` or `14:48:07` on `day`, in the local zone, as an aware UTC time."""
    for fmt in ("%H:%M:%S", "%H:%M"):
        try:
            t = dt.datetime.strptime(s, fmt).time()
        except ValueError:
            continue
        return dt.datetime.combine(day, t).astimezone().astimezone(dt.timezone.utc)
    raise SystemExit("could not read a time from %r - use HH:MM or HH:MM:SS" % s)


def window_for_item(item, day):
    """First and last progress.log stamp for an item, as a UTC window.

    The log is `HH:MM:SS ITEM stage` and carries no date, so the day is
    assumed - which is what `--day` is for when reading an older run."""
    path = os.path.join(".claude", "loop", "progress.log")
    if not os.path.exists(path):
        raise SystemExit("no .claude/loop/progress.log to read")
    stamps = []
    with open(path) as fh:
        for line in fh:
            m = re.match(r"^(\d{2}:\d{2}:\d{2})\s+(\S+)", line)
            if m and item.lower() in m.group(2).lower():
                stamps.append(m.group(1))
    if not stamps:
        raise SystemExit("no progress lines name %r" % item)
    # A fork's last stage is written before its final turn lands, so give the
    # tail a few minutes rather than cutting the merge off the total.
    return parse_clock(stamps[0], day), parse_clock(stamps[-1], day) + dt.timedelta(minutes=5)


def reviewer_types(cwd):
    """The agent types that are reviews, from the files themselves.

    Derived rather than listed, so an agent added to .claude/agents/ is counted
    without editing this script - the same reason build.py reads
    PRAGMA table_info instead of writing the columns out (D-02)."""
    d = os.path.join(cwd, ".claude", "agents")
    return {os.path.basename(f)[:-3] for f in glob.glob(os.path.join(d, "*.md"))
            if os.path.basename(f) != "README.md"}


def transcripts(pdir, reviewers):
    """Every transcript in the project, tagged with what wrote it.

    The driver is the top-level `<uuid>.jsonl`. Subagents each get
    `<uuid>/subagents/agent-<id>.jsonl`; the fork is one of them, appearing as
    `general-purpose`, so only an agentType naming a file in .claude/agents/
    counts as review."""
    for f in sorted(glob.glob(os.path.join(pdir, "*.jsonl"))):
        yield f, "driver", "driver", os.path.basename(f)[:-len(".jsonl")]
    for f in sorted(glob.glob(os.path.join(pdir, "*", "subagents", "agent-*.jsonl"))):
        kind = None
        meta = f[:-len(".jsonl")] + ".meta.json"
        try:
            with open(meta, encoding="utf-8") as fh:
                kind = json.load(fh).get("agentType")
        except (OSError, ValueError):
            pass
        kind = kind or "unknown"
        session = os.path.basename(os.path.dirname(os.path.dirname(f)))
        yield f, kind, ("review" if kind in reviewers else "work"), session


def collect(pdir, start, end, reviewers, only=None):
    rows = []
    for f, side, role, session in transcripts(pdir, reviewers):
        if only and not session.startswith(only):
            continue
        try:
            fh = open(f, encoding="utf-8")
        except OSError:
            continue
        with fh:
            for line in fh:
                try:
                    d = json.loads(line)
                except ValueError:
                    continue
                if d.get("type") != "assistant":
                    continue
                u = (d.get("message") or {}).get("usage")
                ts = d.get("timestamp")
                if not u or not ts:
                    continue
                try:
                    when = dt.datetime.fromisoformat(ts.replace("Z", "+00:00"))
                except ValueError:
                    continue
                if not (start <= when <= end):
                    continue
                rows.append({
                    "model": (d.get("message") or {}).get("model") or "unknown",
                    "side": side,
                    "role": role,
                    "session": session,
                    "input": u.get("input_tokens", 0),
                    "output": u.get("output_tokens", 0),
                    "cache_read": u.get("cache_read_input_tokens", 0),
                    "cache_write": u.get("cache_creation_input_tokens", 0),
                })
    return rows


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    g = p.add_mutually_exclusive_group(required=True)
    g.add_argument("--since", metavar="HH:MM", help="count from this local time today")
    g.add_argument("--item", metavar="ID", help="the window this item held in progress.log")
    p.add_argument("--until", metavar="HH:MM", help="stop here (default: now)")
    p.add_argument("--day", metavar="YYYY-MM-DD", help="read an older run (default: today)")
    p.add_argument("--cwd", default=os.getcwd(), help=argparse.SUPPRESS)
    p.add_argument("--json", action="store_true", help="machine-readable")
    p.add_argument("--brief", action="store_true",
                   help="one short line, for stamping onto a progress line")
    p.add_argument("--session", metavar="UUID",
                   help="only this session and its subagents (a prefix will do)")
    a = p.parse_args()

    day = dt.date.fromisoformat(a.day) if a.day else dt.date.today()
    if a.item:
        start, end = window_for_item(a.item, day)
    else:
        start = parse_clock(a.since, day)
        end = parse_clock(a.until, day) if a.until else dt.datetime.now(dt.timezone.utc)

    end = min(end, dt.datetime.now(dt.timezone.utc))

    pdir = project_dir(a.cwd)
    if not os.path.isdir(pdir):
        raise SystemExit("no transcripts at %s" % pdir)
    rows = collect(pdir, start, end, reviewer_types(a.cwd), a.session)
    if not rows:
        if a.brief:
            return
        raise SystemExit("no assistant turns between %s and %s"
                         % (start.astimezone().strftime("%H:%M:%S"), end.astimezone().strftime("%H:%M:%S")))

    by = {}
    for r in rows:
        k = (r["role"], r["side"], r["model"])
        b = by.setdefault(k, {"turns": 0, "input": 0, "output": 0, "cache_read": 0, "cache_write": 0})
        b["turns"] += 1
        for f in ("input", "output", "cache_read", "cache_write"):
            b[f] += r[f]

    def fresh(b):
        """Everything the window actually sent or generated, cache reads apart.
        Cache reads are reported separately because they are billed differently
        and dwarf the rest - a total that buries them is the wrong headline."""
        return b["input"] + b["output"] + b["cache_write"]

    sessions = sorted({r["session"] for r in rows})
    mixed = len(sessions) > 1

    if a.brief:
        # Stamped onto a progress line while the fork runs, so it has to be
        # short and it has to say which number it is. `k` is thousands of new
        # tokens - input + output + cache-write - with cache reads left out;
        # they are an order larger and would drown the line.
        def k(role):
            s = sum(b["input"] + b["output"] + b["cache_write"]
                    for kk, b in by.items() if kk[0] == role)
            return "%dk" % round(s / 1000.0)
        note = " (%d sessions)" % len(sessions) if mixed else ""
        print("work %s review %s driver %s%s" % (k("work"), k("review"), k("driver"), note))
        return

    if a.json:
        print(json.dumps({
            "from": start.isoformat(), "to": end.isoformat(),
            "groups": [dict(side=k[0], model=k[1], **v) for k, v in sorted(by.items())],
        }, indent=1))
        return

    print("%s -> %s" % (start.astimezone().strftime("%H:%M:%S"), end.astimezone().strftime("%H:%M:%S")))
    print()
    print("%-24s %-16s %6s %9s %10s %12s %13s" % ("who", "model", "turns", "input", "output", "cache-write", "cache-read"))
    tot = {"turns": 0, "input": 0, "output": 0, "cache_read": 0, "cache_write": 0}
    for (role, side, model), b in sorted(by.items()):
        print("%-24s %-16s %6d %9d %10d %12d %13d"
              % (side, model, b["turns"], b["input"], b["output"], b["cache_write"], b["cache_read"]))
        for f in tot:
            tot[f] += b[f]
    print("%-24s %-16s %6d %9d %10d %12d %13d"
          % ("total", "", tot["turns"], tot["input"], tot["output"], tot["cache_write"], tot["cache_read"]))
    print()
    for role in ("driver", "work", "review"):
        s = {f: sum(b[f] for k, b in by.items() if k[0] == role) for f in tot}
        if not s["turns"]:
            continue
        print("%-24s %9d new tokens (input + output + cache-write), %11d cache reads, %4d turns"
              % (role, fresh(s), s["cache_read"], s["turns"]))
    rev = {f: sum(b[f] for k, b in by.items() if k[0] == "review") for f in tot}
    imp = {f: sum(b[f] for k, b in by.items() if k[0] != "review") for f in tot}
    if rev["turns"] and imp["turns"]:
        print()
        print("review is %.0f%% of new tokens (%d of %d)"
              % (100.0 * fresh(rev) / max(fresh(rev) + fresh(imp), 1), fresh(rev), fresh(rev) + fresh(imp)))
    print()
    print("Raw API usage, for comparing one item with another. Not the Agent")
    print("tool's weighted `subagent_tokens`, and not a plan percentage.")
    if mixed:
        print()
        print("WARNING: %d sessions wrote in this window, so these totals are not"
              % len(sessions))
        print("one item's cost. Another loop or a chat session running alongside is")
        print("counted too. Re-run with --session <uuid> to scope it:")
        for s in sessions:
            print("    %s" % s)


if __name__ == "__main__":
    main()
