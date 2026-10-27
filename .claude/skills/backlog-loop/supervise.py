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
    returns - the driver's contract, MERGED / SKIPPED / DECIDE / STOP / LIMIT
    - and on a usage limit sleeps until the reset and starts a fresh session
    with the same target and the run's skip list. A PAUSE is the same without
    the dead session: the manager's usage check (loop_usage.py) found too
    little left for an item, so this sleeps until the time it names and
    starts again. Everything else ends the run: a STOP is a person's, and a result with no contract line is not a
    merge. A DECIDE reaches this script only as the result of a one-item run,
    because under `until-paused` the manager carries on past it (D-52).

    Before each session it runs the same usage check itself, and sleeps
    through a WAIT rather than start a session only to pause it (D-55). An
    ALARM - the race-weekend reserve is held but may go on the refresh
    alarm it names - starts the session, whose own check gives the fork
    that one item, when the target is `next`, `until-paused` or that alarm;
    a run given some other item sleeps through it as through a WAIT, since
    the reserve goes on nothing else (AF-130).

    It never merges, reviews or edits anything. The manager drives, the fork
    (backlog-item, or backlog-item-sonnet under the AF-144 trial, D-60 - the
    manager chooses per item, so no model is set here) does the item, and this only decides whether to start the
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
    LOOP_USAGE_*          the usage check's thresholds; loop_usage.py says which

EXIT
    0  MERGED - the one item (`next` or an id) landed
    1  a result with no contract line, or the CLI failed - look at open PRs
    2  STOP - a person's decision, a condition no fork can work around, or
       the way an `until-paused` run ends when the manager stops it
    3  SKIPPED - the one item asked for was recorded as blocked
    4  the environment: no CLI, or limits that did not lift
    5  DECIDE - the one item asked for is held on a person's decision,
       labelled, with the repository left clean
"""
import datetime as dt
import json
import os
import re
import shutil
import subprocess
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.append(HERE)  # behind the stdlib
# The reset reading is shared with the usage check, which reads the same
# "resets Oct 19, 2:59pm (Europe/London)" out of /usage.
import loop_usage  # noqa: E402  (a sibling script, not an installed package)
from loop_usage import EPOCH, RESET, reset_at  # noqa: E402,F401  (reset_at: tests and callers read it here)

AGENT = "backlog-manager"
PACES = ("fast", "balanced", "thorough")
PERMISSION_MODE = "auto"
CONTRACT = re.compile(r"^(MERGED #\d+ \S+|SKIPPED \S+:.*|DECIDE \S+:.*|STOP:.*|LIMIT:.*|PAUSE:.*)$")
SKIPS = re.compile(r"^Skipped:\s*(\S.*)$", re.M)
ITEM_ID = re.compile(r"^[A-Z]{2,4}-\d+$")
# The manager's own pause: "PAUSE: until 2026-10-14T21:59+00:00 - <why>",
# the time loop_usage.py printed in its WAIT line.
UNTIL = re.compile(r"\buntil\s+(\d{4}-\d\d-\d\dT\d\d:\d\d(?::\d\d)?(?:[+-]\d\d:\d\d)?)")
LIMIT_WORDS = re.compile(r"\b(usage|session|weekly|5-hour)\s+limit\b|\blimit reached\b", re.I)
FALLBACK_WAIT = dt.timedelta(minutes=30)
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


def alarm_is_for(target, usage):
    """Whether an ALARM line may start a session of this run: one choosing
    its items, or one given that alarm by id."""
    if target in ("next", "until-paused"):
        return True
    words = usage.split()
    return len(words) > 1 and words[1] == target


def until_at(text, now):
    """The time a PAUSE line names, or None. One with no zone is UTC, and a
    time already past is now."""
    m = UNTIL.search(text or "")
    if not m:
        return None
    try:
        when = dt.datetime.fromisoformat(m.group(1))
    except ValueError:
        return None
    if when.tzinfo is None:
        when = when.replace(tzinfo=dt.timezone.utc)
    if when - now > dt.timedelta(days=8):
        return None
    return max(when, now)


def classify(stdout, returncode):
    """(kind, line, skips) from what `claude -p --output-format json` printed.

    kind is MERGED, SKIPPED, DECIDE, STOP, LIMIT, PAUSE or NONE. A usage limit arrives in
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
        # Look before starting: a session started with too little left would
        # only pause, or die mid-item on the limit (D-55).
        now = dt.datetime.now(dt.timezone.utc)
        usage, code = loop_usage.check(now, claude)
        progress(f"usage: {usage[:200]}")
        if code == loop_usage.EXIT["WAIT"] or (code == loop_usage.EXIT["ALARM"]
                                                 and not alarm_is_for(target, usage)):
            when = until_at(usage, now) or now + FALLBACK_WAIT
            print(f"supervise: {usage}")
            sleep_until(when + dt.timedelta(minutes=1))
            continue
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
        if kind == "PAUSE":
            # The manager stopped before a fork because the usage check said
            # wait: no limit was hit, so this is not one of the limits
            # LOOP_MAX_RESTARTS counts - and no work was done either, so it
            # leaves the count of those as it found it.
            now = dt.datetime.now(dt.timezone.utc)
            when = until_at(line, now)
            note = "pause" if when else "pause, time not readable"
            when = (when or now + FALLBACK_WAIT) + dt.timedelta(minutes=1)
            note = f"{note} - resuming at {when.astimezone().isoformat(timespec='minutes')}"
            print(f"supervise: usage {note}")
            progress(f"usage {note}")
            sleep_until(when)
            continue
        if kind == "MERGED":
            return 0
        if kind == "SKIPPED":
            return 3
        if kind == "DECIDE":
            return 5
        if kind == "STOP":
            return 2
        print("supervise: no contract line - not a merge and not a PASS. Check `gh pr list --state open` "
              "and `git worktree list` before starting again.", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
