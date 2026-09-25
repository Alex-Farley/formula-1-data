#!/usr/bin/env python3
"""Run the backlog loop unattended, from any checkout and any Claude account.

    python3 .claude/skills/backlog-loop/supervise.py [next | <ITEM-ID> | until-paused] [fast | balanced | thorough]
    make loop ARGS="until-paused balanced"

WHY THIS EXISTS
    Until this, the loop's manager was whichever interactive session typed
    /backlog-loop, and two of the things that kept it running lived outside
    the repository: the restart after a usage limit was a CronCreate task,
    which dies with the session and does not exist in another account, and
    several of the rules the loop depended on were in one person's
    auto-memory, which no other account reads. Both are now here: the rules
    moved into the skills (docs/DECISIONS.md D-42), and this script is the
    restart. It is deliberately a plain process and not a session, because a
    process is the one thing that outlives a session hitting its limit.

WHAT IT DOES
    Runs the `backlog-manager` agent (.claude/agents/backlog-manager.md)
    headless, with no MCP servers (D-18), reads the first line of what it
    returns - the driver's contract, MERGED / SKIPPED / STOP / LIMIT - and on
    a usage limit sleeps until the reset and starts a fresh session with the
    same target and the run's skip list. Everything else ends the run: a STOP
    is a person's, and a result with no contract line is not a merge.

    It never merges, reviews or edits anything. The manager drives, the fork
    (backlog-item) does the item, and this only decides whether to start the
    manager again.

ENVIRONMENT
    CLAUDE_BIN            the Claude Code CLI; default `claude` on PATH
    LOOP_PERMISSION_MODE  passed to --permission-mode; default `auto`.
                          `bypassPermissions` is refused: auto mode's refusal
                          to merge without a recorded review is one of the
                          loop's controls (D-42), and the loop may not
                          switch off a control to keep going.
    LOOP_MAX_RESTARTS     restarts after a usage limit before giving up; default 12
    LOOP_KEEP_MCP=1       keep the account's MCP servers (off by default, D-18)

EXIT
    0  the run ended on a merge, or `until-paused` ended on its own terms
    1  a result with no contract line, or the CLI failed - look at open PRs
    2  STOP: a person's decision or a condition no fork can work around
    3  SKIPPED: the one item asked for was recorded as blocked
    4  the environment: no CLI, a refused permission mode, too many restarts
"""
import datetime as dt
import json
import os
import re
import shutil
import subprocess
import sys
import time

try:
    from zoneinfo import ZoneInfo, ZoneInfoNotFoundError
except ImportError:  # pragma: no cover - Python 3.8 and older
    ZoneInfo = None
    ZoneInfoNotFoundError = Exception

HERE = os.path.dirname(os.path.abspath(__file__))
AGENT = "backlog-manager"
PACES = ("fast", "balanced", "thorough")
REFUSED_MODES = ("bypassPermissions",)
CONTRACT = re.compile(r"^(MERGED #\d+ \S+|SKIPPED \S+:.*|STOP:.*|LIMIT:.*)$")
SKIPS = re.compile(r"^Skipped:\s*(\S.*)$", re.M)
ITEM_ID = re.compile(r"^[A-Z]{2,4}-\d+$")
# "You've hit your session limit · resets 1:30pm (Europe/London)" was the
# wording on 2026-09-13; a fork's own line is "LIMIT: resets <the same>".
# A date appears when the reset is not today: "resets Sep 27, 3am (...)".
RESET = re.compile(
    r"resets\s+(?:(?P<mon>[A-Z][a-z]{2})\s+(?P<day>\d{1,2}),?\s+(?:at\s+)?)?"
    r"(?P<h>\d{1,2})(?::(?P<m>\d{2}))?\s*(?P<ap>[ap]m)\b(?:\s*\((?P<tz>[^)]+)\))?",
    re.I,
)
LIMIT_WORDS = re.compile(r"\b(usage|session|rate|weekly)\s+limit\b|\blimit\b.*\bresets\b", re.I)
MONTHS = {m: i for i, m in enumerate(
    ("jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"), 1)}
FALLBACK_WAIT = 30 * 60
JUST_PASSED = dt.timedelta(minutes=15)


def parse_args(argv):
    """Two words, either order, both optional - the driver's own arguments."""
    target, pace = "next", "balanced"
    for word in argv:
        if word in PACES:
            pace = word
        elif word in ("next", "until-paused") or ITEM_ID.match(word):
            target = word
        else:
            raise SystemExit(f"supervise: {word!r} is neither a target (next, until-paused, an item id) "
                             f"nor a pace ({', '.join(PACES)})")
    return target, pace


def zone(name):
    if name and ZoneInfo is not None:
        try:
            return ZoneInfo(name.strip())
        except (ZoneInfoNotFoundError, ValueError):
            pass
    return dt.datetime.now().astimezone().tzinfo


def reset_at(text, now=None):
    """The moment a limit message says the allowance comes back, or None.

    `now` is an aware datetime (tests pass one). A time with no date is the
    next time that clock reading comes round in the named zone, except that
    one up to fifteen minutes past is now; a reading that would put the
    reset more than eight days out is not trusted."""
    m = RESET.search(text or "")
    if not m:
        return None
    tz = zone(m.group("tz"))
    now = (now or dt.datetime.now(dt.timezone.utc)).astimezone(tz)
    hour = int(m.group("h")) % 12 + (12 if m.group("ap").lower() == "pm" else 0)
    minute = int(m.group("m") or 0)
    if hour > 23 or minute > 59:
        return None
    if m.group("mon"):
        month = MONTHS.get(m.group("mon").lower())
        if not month:
            return None
        try:
            when = now.replace(month=month, day=int(m.group("day")), hour=hour, minute=minute,
                               second=0, microsecond=0)
        except ValueError:
            return None
        if when < now - dt.timedelta(days=1):
            when = when.replace(year=when.year + 1)
    else:
        when = now.replace(hour=hour, minute=minute, second=0, microsecond=0)
        if now - when > JUST_PASSED:
            when += dt.timedelta(days=1)
        elif when < now:
            # Read a few minutes after it was written - a session that
            # returned just after its own reset. That is now, not tomorrow.
            when = now
    if when - now > dt.timedelta(days=8):
        return None
    return when


def classify(stdout, returncode):
    """(kind, line, skips) from what `claude -p --output-format json` printed.

    kind is MERGED, SKIPPED, STOP, LIMIT or NONE. A usage limit arrives in
    one of two forms, as it does for the driver: the manager's own LIMIT
    line, or the CLI reporting an error whose text names a limit and a reset
    time, which is what a session the limit killed leaves behind."""
    try:
        data = json.loads(stdout)
        text = data.get("result") or ""
        is_error = bool(data.get("is_error"))
    except (ValueError, AttributeError):
        text, is_error = stdout or "", returncode != 0
    skips = []
    s = SKIPS.search(text)
    if s:
        skips = [x for x in re.split(r"[,\s]+", s.group(1)) if x]
    first = next((ln.strip() for ln in text.splitlines() if ln.strip()), "")
    if CONTRACT.match(first):
        return first.split()[0].rstrip(":"), first, skips
    if (is_error or returncode != 0) and LIMIT_WORDS.search(text) and RESET.search(text):
        return "LIMIT", first, skips
    return "NONE", first or f"(no result; exit {returncode})", skips


def command(claude, target, pace, skips, mode, keep_mcp=False):
    prompt = f"{target} {pace}" + (f" --skip {','.join(skips)}" if skips else "")
    cmd = [claude, "--agent", AGENT, "-p", prompt, "--output-format", "json", "--permission-mode", mode]
    if not keep_mcp:
        # No --mcp-config beside it, so no servers at all: the loop uses none (D-18).
        cmd.append("--strict-mcp-config")
    return cmd


def progress(stage):
    """One line in the log a person watches; the supervisor is an id of its own."""
    subprocess.run(["bash", os.path.join(HERE, "progress.sh"), "supervisor", stage], check=False)


def sleep_until(when):
    # In short steps against the wall clock, so a laptop that slept through
    # the reset wakes up and goes, rather than serving out a stale timer.
    while True:
        left = (when - dt.datetime.now(dt.timezone.utc)).total_seconds()
        if left <= 0:
            return
        time.sleep(min(left, 60))


def main(argv):
    target, pace = parse_args(argv)
    # Line by line, so its output interleaves with progress.sh's in order.
    sys.stdout.reconfigure(line_buffering=True)
    claude = os.environ.get("CLAUDE_BIN") or shutil.which("claude")
    if not claude:
        print("supervise: no Claude Code CLI - put `claude` on PATH or set CLAUDE_BIN", file=sys.stderr)
        return 4
    mode = os.environ.get("LOOP_PERMISSION_MODE", "auto")
    if mode in REFUSED_MODES:
        print(f"supervise: refusing --permission-mode {mode}: auto mode's refusal to merge without a "
              "recorded review is one of the loop's controls (docs/DECISIONS.md D-42)", file=sys.stderr)
        return 4
    max_restarts = int(os.environ.get("LOOP_MAX_RESTARTS", "12"))
    keep_mcp = os.environ.get("LOOP_KEEP_MCP") == "1"

    # The fork runs this too; running it here first costs nothing and saves
    # starting a whole session only for its first command to refuse.
    if subprocess.run(["bash", os.path.join(HERE, "start-check.sh")], check=False).returncode != 0:
        print("STOP: start-check.sh refused the primary checkout (above) - a person's to clear")
        return 2

    skips, restarts = [], 0
    # Where progress.sh writes: beside the main checkout, even from a worktree.
    common = subprocess.run(["git", "rev-parse", "--path-format=absolute", "--git-common-dir"],
                            stdout=subprocess.PIPE, text=True, check=False).stdout.strip()
    log = os.path.join(os.path.dirname(common), ".claude", "loop", "progress.log") if common \
        else ".claude/loop/progress.log"
    print(f"Loop: {target} at {pace}, supervised. The manager shows nothing until it returns; "
          f"its forks' stages appear in {log} - `tail -f` it from another terminal.")
    while True:
        progress(f"manager started: {target} {pace}" + (f" --skip {','.join(skips)}" if skips else ""))
        run = subprocess.run(command(claude, target, pace, skips, mode, keep_mcp),
                             stdout=subprocess.PIPE, text=True, check=False)
        kind, line, more = classify(run.stdout, run.returncode)
        skips = sorted(set(skips) | set(more))
        try:
            session = json.loads(run.stdout).get("session_id")
        except (ValueError, AttributeError):
            session = None
        print(line)
        if session:
            print(f"  manager session {session} (claude --resume {session} to read it)")
        progress(f"manager returned: {line[:120]}")

        if kind == "LIMIT":
            if restarts >= max_restarts:
                print(f"supervise: {restarts} restarts after usage limits; stopping", file=sys.stderr)
                return 4
            restarts += 1
            when = reset_at(line) or reset_at(run.stdout)
            if when is None:
                when = dt.datetime.now(dt.timezone.utc) + dt.timedelta(seconds=FALLBACK_WAIT)
                note = f"reset time not readable; trying again in {FALLBACK_WAIT // 60} minutes"
            else:
                when += dt.timedelta(minutes=1)
                note = f"resuming at {when.isoformat(timespec='minutes')}"
            print(f"supervise: usage limit - {note} (restart {restarts} of {max_restarts})")
            progress(f"usage limit - {note}")
            sleep_until(when)
            continue
        if kind == "MERGED":
            return 0
        if kind == "SKIPPED":
            return 0 if target == "until-paused" else 3
        if kind == "STOP":
            return 2
        print("supervise: no contract line - not a merge and not a PASS. Check `gh pr list --state open` "
              "and `git worktree list` before starting again.", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
