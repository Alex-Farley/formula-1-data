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

    NOT PROBED: the exact text `claude -p --output-format json` returns when
    a usage limit kills the session headless. The forms read here are the
    interactive wording of 2026-09-13 and an epoch form; anything else that
    is an error naming a limit waits FALLBACK_WAIT and tries again, and
    anything that names no limit ends the run. Both fail towards stopping.

PERMISSIONS
    Always `--permission-mode auto`, and there is no setting to change it.
    Auto mode refuses `gh pr merge` on a pull request with no recorded
    verdict, which is one of the loop's controls; any other mode can be
    combined with an allow rule somewhere in the account's settings that
    skips it, and a supervisor able to switch a control off to keep going is
    the loop weakening a control (D-42). An account without auto mode cannot
    run the loop unattended; it runs /backlog-loop by hand.

ENVIRONMENT
    CLAUDE_BIN            the Claude Code CLI; default `claude` on PATH
    LOOP_MAX_RESTARTS     consecutive limits with no work between them before
                          giving up; default 6
    LOOP_KEEP_MCP=1       keep the account's MCP servers (off by default, D-18)

EXIT
    0  MERGED - the one item (`next` or an id) landed
    1  a result with no contract line, or the CLI failed - look at open PRs
    2  STOP - a person's decision, a condition no fork can work around, or
       the way an `until-paused` run ends when the manager stops it
    3  SKIPPED - the one item asked for was recorded as blocked
    4  the environment: no CLI, or limits that did not lift
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
PERMISSION_MODE = "auto"
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
EPOCH = re.compile(r"limit reached\|(\d{10})\b", re.I)
LIMIT_WORDS = re.compile(r"\b(usage|session|weekly|5-hour)\s+limit\b|\blimit reached\b", re.I)
MONTHS = {m: i for i, m in enumerate(
    ("jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"), 1)}
FALLBACK_WAIT = dt.timedelta(minutes=30)
JUST_PASSED = dt.timedelta(minutes=15)
# A session that returns a limit sooner than this after starting did no work:
# the limit had not lifted. Those are what LOOP_MAX_RESTARTS counts, and each
# one doubles the wait from BACKOFF, so a reset that is late is not retried
# every minute.
NO_WORK = dt.timedelta(minutes=5)
BACKOFF = dt.timedelta(minutes=5)


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
    nearest occurrence of that clock reading in the named zone that is not
    more than fifteen minutes past - one within those fifteen minutes is now,
    read a little after it was written, and that holds across midnight too. A
    reading that would put the reset more than eight days out is not trusted."""
    text = text or ""
    now = now or dt.datetime.now(dt.timezone.utc)
    e = EPOCH.search(text)
    if e:
        when = dt.datetime.fromtimestamp(int(e.group(1)), dt.timezone.utc)
        return max(when, now) if when - now <= dt.timedelta(days=8) else None
    m = RESET.search(text)
    if not m:
        return None
    tz = zone(m.group("tz"))
    now = now.astimezone(tz)
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
        today = now.replace(hour=hour, minute=minute, second=0, microsecond=0)
        when = next(c for c in (today - dt.timedelta(days=1), today, today + dt.timedelta(days=1))
                    if c >= now - JUST_PASSED)
    if when - now > dt.timedelta(days=8):
        return None
    return max(when, now)


def classify(stdout, returncode):
    """(kind, line, skips) from what `claude -p --output-format json` printed.

    kind is MERGED, SKIPPED, STOP, LIMIT or NONE. A usage limit arrives in
    one of two forms, as it does for the driver: the manager's own LIMIT
    line, or text naming a limit and a reset - the CLI's error for a session
    the limit killed, or a manager that repeated the error instead of writing
    the line. An error naming a limit with no readable reset is still a
    limit; reset_at() gives it none and the caller waits FALLBACK_WAIT."""
    try:
        data = json.loads(stdout)
        text = data.get("result") or ""
        is_error = bool(data.get("is_error"))
    except (ValueError, AttributeError):
        text, is_error = stdout or "", returncode != 0
    skips = []
    s = SKIPS.search(text)
    if s:
        skips = [x for x in re.split(r"[,\s]+", s.group(1)) if ITEM_ID.match(x)]
    first = next((ln.strip() for ln in text.splitlines() if ln.strip()), "")
    if CONTRACT.match(first):
        return first.split()[0].rstrip(":"), first, skips
    if LIMIT_WORDS.search(first) and (RESET.search(first) or EPOCH.search(first)):
        return "LIMIT", first, skips
    if (is_error or returncode != 0) and LIMIT_WORDS.search(text):
        return "LIMIT", first, skips
    return "NONE", first or f"(no result; exit {returncode})", skips


def command(claude, target, pace, skips, keep_mcp=False):
    prompt = f"{target} {pace}" + (f" --skip {','.join(skips)}" if skips else "")
    cmd = [claude, "--agent", AGENT, "-p", prompt, "--output-format", "json",
           "--permission-mode", PERMISSION_MODE]
    if not keep_mcp:
        # No --mcp-config beside it, so no servers at all: the loop uses none (D-18).
        cmd.append("--strict-mcp-config")
    return cmd


def log_path():
    """Where progress.sh writes: beside the main checkout, even from a
    worktree. The same derivation as progress.sh, which works on any git."""
    common = subprocess.run(["git", "rev-parse", "--git-common-dir"], stdout=subprocess.PIPE,
                            stderr=subprocess.DEVNULL, text=True, check=False).stdout.strip() or ".git"
    return os.path.join(os.path.dirname(os.path.abspath(common)), ".claude", "loop", "progress.log")


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
    max_restarts = int(os.environ.get("LOOP_MAX_RESTARTS", "6"))
    keep_mcp = os.environ.get("LOOP_KEEP_MCP") == "1"

    # The fork runs this too; running it here first costs nothing and saves
    # starting a whole session only for its first command to refuse.
    if subprocess.run(["bash", os.path.join(HERE, "start-check.sh")], check=False).returncode != 0:
        print("STOP: start-check.sh refused the primary checkout (above) - a person's to clear")
        return 2

    skips, idle = [], 0
    print(f"Loop: {target} at {pace}, supervised. The manager shows nothing until it returns; "
          f"its forks' stages appear in {log_path()} - `tail -f` it from another terminal.")
    while True:
        progress(f"manager started: {target} {pace}" + (f" --skip {','.join(skips)}" if skips else ""))
        started = dt.datetime.now(dt.timezone.utc)
        run = subprocess.run(command(claude, target, pace, skips, keep_mcp),
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
            now = dt.datetime.now(dt.timezone.utc)
            idle = idle + 1 if now - started < NO_WORK else 0
            if idle > max_restarts:
                print(f"supervise: {idle} limits in a row with no work between them; stopping", file=sys.stderr)
                return 4
            when = reset_at(line, now) or reset_at(run.stdout, now)
            if when is None:
                when, note = now + FALLBACK_WAIT, "reset time not readable"
            else:
                when, note = when + dt.timedelta(minutes=1), "reset"
            if idle:
                # The limit had not lifted when the last session started.
                when = max(when, now + BACKOFF * 2 ** (idle - 1))
                note += f", still in force ({idle} of {max_restarts})"
            note = f"{note} - resuming at {when.astimezone().isoformat(timespec='minutes')}"
            print(f"supervise: usage limit, {note}")
            progress(f"usage limit, {note}")
            sleep_until(when)
            continue
        if kind == "MERGED":
            return 0
        if kind == "SKIPPED":
            return 3
        if kind == "STOP":
            return 2
        print("supervise: no contract line - not a merge and not a PASS. Check `gh pr list --state open` "
              "and `git worktree list` before starting again.", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
