#!/usr/bin/env python3
"""Read the plan's usage before an item, and say whether the loop should start one.

    python3 .claude/skills/backlog-loop/loop_usage.py

WHY THIS EXISTS
    Until AF-108 the loop reacted to a usage limit only after hitting one:
    supervise.py read the limit message a dead session left, slept until the
    reset and started again. A fork the limit killed mid-item left a half-done
    worktree or pull request for the next fork to rediscover, and the
    orientation it had paid for was lost; nothing looked ahead, so the loop
    could start an M item with 5 % of the 5-hour window left, or spend a
    week's allowance in its first two days (docs/DECISIONS.md D-55). This
    looks ahead, before each fork: the driver runs it between items and
    supervise.py before each manager session.

WHAT IT READS
    `claude -p /usage --output-format json`, a local command that costs no
    model turn (total_cost_usd 0, probed 2026-10-14 on Claude Code 2.1.299
    under a subscription login). Its `result` is text meant for people:

        Current session: 25% used · resets Oct 14, 10:59pm (Europe/London)
        Current week (all models): 15% used · resets Oct 19, 2:59pm (Europe/London)

    The status line's `rate_limits` and the Agent SDK's usage report carry
    the same figures structured, but neither reaches a headless `claude -p`,
    so the text is what there is. Its wording may change, and the parser
    fails towards "could not read", never towards a number: a line is read
    only whole - the label, a percentage from 0 to 100, and a reset time
    reset_at() accepts - and a window that is not read decides nothing.

WHAT IT DECIDES
    The first word of the first line, and the exit status:

    GO       (exit 0) start any item.
    SMALL    (exit 3) start only an XS or S item: the driver passes
             `--max-size S` to the fork, which passes it to next.py. The
             line names the session's reset, which the driver pauses until
             if nothing in the queue is that small.
    WAIT     (exit 5) start nothing: `WAIT until <ISO time> - <why>`. The
             interactive driver schedules its wake-up for then; the manager
             returns `PAUSE: until <ISO time> - <why>` and supervise.py
             sleeps until it.
    UNKNOWN  (exit 0) usage could not be read - no CLI, an API-key login, a
             wording this does not know. Carry on as before AF-108, reacting
             to a limit when one arrives, and say so.

    The 5-hour window, by what is left of it (points of 100):
      at least ANY_LEFT    GO
      at least SMALL_LEFT  SMALL - an S item costs about 73,000 fork tokens
                           and an M about 188,000 (AF-88, UR-14), each with
                           reviewer passes of 40,000-130,000 [D-24]
      less                 WAIT until the window resets

    The weekly window is spread evenly over the seven days to its reset: the
    loop may have used the elapsed fraction of the week's allowance, plus
    SLACK points, and no more. Ahead of that pace it waits until the pace
    catches up. While a race falls between two days ago and the weekly
    reset, RESERVE points come off the allowance first, for the refresh work
    a race weekend brings - the sessions table in f1.db says when the next
    race is; when f1.db cannot be read the reserve is kept, the cautious
    side. The stricter window wins, and of two waits the later.

    The thresholds are starting values, not measurements: every decision is
    written to .claude/loop/progress.log with the figures it used, so a week
    of them is what calibrates them. Each can be set in the environment:
    LOOP_USAGE_ANY_LEFT, LOOP_USAGE_SMALL_LEFT, LOOP_USAGE_SLACK,
    LOOP_USAGE_RESERVE. A pause is always allowed, and nothing here touches
    a control: no check, permission mode or review is changed by a figure.
"""
import datetime as dt
import json
import os
import re
import shutil
import sqlite3
import subprocess
import sys

try:
    from zoneinfo import ZoneInfo, ZoneInfoNotFoundError
except ImportError:  # pragma: no cover - Python 3.8 and older
    ZoneInfo = None
    ZoneInfoNotFoundError = Exception

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(HERE)))

# "You've hit your session limit · resets 1:30pm (Europe/London)" was the
# wording on 2026-09-13; a fork's own line is "LIMIT: resets <the same>".
# A date appears when the reset is not today: "resets Sep 27, 3am (...)".
# /usage writes its resets the same way: "resets Oct 19, 2:59pm (...)".
RESET = re.compile(
    r"resets\s+(?:(?P<mon>[A-Z][a-z]{2})\s+(?P<day>\d{1,2}),?\s+(?:at\s+)?)?"
    r"(?P<h>\d{1,2})(?::(?P<m>\d{2}))?\s*(?P<ap>[ap]m)\b(?:\s*\((?P<tz>[^)]+)\))?",
    re.I,
)
EPOCH = re.compile(r"limit reached\|(\d{10})\b", re.I)
MONTHS = {m: i for i, m in enumerate(
    ("jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"), 1)}
JUST_PASSED = dt.timedelta(minutes=15)

# One window per line, read whole or not at all. "all models" is the weekly
# figure that binds every model; a per-model line beside it is not read.
WINDOWS = {
    "session": re.compile(r"^\s*Current session:\s*(\d{1,3})% used\b(.*)$", re.M),
    "week": re.compile(r"^\s*Current week \(all models\):\s*(\d{1,3})% used\b(.*)$", re.M),
}
WEEK = dt.timedelta(days=7)
# How long after a race its refresh work is still expected: results late,
# a refresh alarm, the fix for one.
RACE_TAIL = dt.timedelta(days=2)
DEFAULTS = {"ANY_LEFT": 20, "SMALL_LEFT": 7, "SLACK": 10, "RESERVE": 10}
EXIT = {"GO": 0, "UNKNOWN": 0, "SMALL": 3, "WAIT": 5}


def known_zone(name):
    """Whether a zone name resolves. zone() falls back to local time, which
    suits a limit message; a /usage line in a zone not known is not read."""
    if not name or ZoneInfo is None:
        return False
    try:
        ZoneInfo(name.strip())
    except (ZoneInfoNotFoundError, ValueError):
        return False
    return True


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
    # A twelve-hour clock reading: 1 to 12, and a 13pm is not read as 1pm.
    hour, minute = int(m.group("h")), int(m.group("m") or 0)
    if not 1 <= hour <= 12 or minute > 59:
        return None
    hour = hour % 12 + (12 if m.group("ap").lower() == "pm" else 0)
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


def parse(text, now):
    """{"session": (used, reset), "week": (used, reset)} for each window read
    whole. `used` is points of 100; `reset` an aware datetime. A window whose
    percentage is out of range, or whose reset is unreadable or names no zone
    that resolves, is left out."""
    out = {}
    for name, pattern in WINDOWS.items():
        m = pattern.search(text or "")
        if not m:
            continue
        used = int(m.group(1))
        r = RESET.search(m.group(2))
        if used > 100 or not r or not known_zone(r.group("tz")):
            continue
        when = reset_at(m.group(2), now)
        if when is None:
            continue
        out[name] = (used, when)
    return out


def read_text(claude, timeout=90):
    """/usage's text, or (None, why). Never raises: an unreadable report is
    an answer, UNKNOWN, and not a failure of the loop."""
    if not claude:
        return None, "no Claude Code CLI on PATH"
    try:
        run = subprocess.run([claude, "-p", "/usage", "--output-format", "json", "--strict-mcp-config"],
                             stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, text=True,
                             timeout=timeout, check=False)
    except (OSError, subprocess.TimeoutExpired) as e:
        return None, f"/usage did not answer ({type(e).__name__})"
    try:
        data = json.loads(run.stdout)
    except ValueError:
        return None, f"/usage printed no JSON (exit {run.returncode})"
    if not isinstance(data, dict) or data.get("is_error") or not isinstance(data.get("result"), str):
        return None, "/usage returned an error"
    return data["result"], None


def next_race(now, db=None):
    """The start of the first race from RACE_TAIL ago onwards, as an aware
    datetime; None when there is none; False when f1.db cannot be read."""
    db = db or os.path.join(ROOT, "f1.db")
    since = (now - RACE_TAIL).astimezone(dt.timezone.utc).strftime("%Y-%m-%dT%H:%MZ")
    try:
        con = sqlite3.connect(f"file:{db}?mode=ro", uri=True)
        try:
            row = con.execute("SELECT min(start_utc) FROM sessions WHERE kind = 'race' AND start_utc >= ?",
                              (since,)).fetchone()
        finally:
            con.close()
    except sqlite3.Error:
        return False
    if not row or not row[0]:
        return None
    try:
        return dt.datetime.strptime(row[0], "%Y-%m-%dT%H:%MZ").replace(tzinfo=dt.timezone.utc)
    except ValueError:
        return False


def settings(env=None):
    env = os.environ if env is None else env
    out = {}
    for key, default in DEFAULTS.items():
        try:
            out[key] = float(env.get(f"LOOP_USAGE_{key}", default))
        except ValueError:
            out[key] = float(default)
    return out


def iso(when):
    return when.astimezone(dt.timezone.utc).isoformat(timespec="minutes")


def decide(windows, now, race=None, conf=None):
    """(word, until, reasons). `windows` is parse()'s answer; `race` is
    next_race()'s. `until` is set for WAIT (when to look again) and for
    SMALL (the session's reset, the pause if nothing small is open)."""
    conf = conf or settings({})
    if not windows:
        return "UNKNOWN", None, ["usage not readable"]
    word, until, why = "GO", None, []

    if "session" in windows:
        used, reset = windows["session"]
        left = 100 - used
        why.append(f"session {used}% used, resets {iso(reset)}")
        if left < conf["SMALL_LEFT"]:
            word, until = "WAIT", reset
            why.append(f"under {conf['SMALL_LEFT']:g} points left: too little for any item")
        elif left < conf["ANY_LEFT"]:
            word, until = "SMALL", reset
            why.append(f"under {conf['ANY_LEFT']:g} points left: an XS or S item only")
    else:
        why.append("session window not readable")

    if "week" in windows:
        used, reset = windows["week"]
        start = reset - WEEK
        elapsed = min(1.0, max(0.0, (now - start) / WEEK))
        held = race is False or (race is not None and race <= reset)
        reserve = conf["RESERVE"] if held else 0.0
        budget = 100.0 - reserve
        allowed = elapsed * budget + conf["SLACK"]
        note = (f"week {used}% used, {elapsed:.0%} elapsed, pace allows {min(allowed, budget):.0f}%"
                + (f" ({reserve:g} held for the race weekend"
                   + (" - f1.db not readable" if race is False else f" of {iso(race)}") + ")"
                   if held else ""))
        why.append(note)
        if used >= min(allowed, budget):
            # When the pace reaches what has been used; never past the reset,
            # and when the reserve is what binds, no later than its release.
            if used >= budget:
                catch = reset
            else:
                catch = start + WEEK * max(0.0, (used - conf["SLACK"]) / budget)
            catch = min(max(catch, now), reset)
            if held and race not in (None, False):
                catch = min(catch, max(race + RACE_TAIL, now))
            if catch > now:
                why.append("ahead of the weekly pace")
                until = max(until, catch) if word == "WAIT" else catch
                word = "WAIT"
    else:
        why.append("weekly window not readable")

    return word, until, why


def line(word, until, why):
    if word == "WAIT":
        return f"WAIT until {iso(until)} - " + "; ".join(why)
    if word == "SMALL":
        return f"SMALL --max-size S, session resets {iso(until)} - " + "; ".join(why)
    return f"{word} - " + "; ".join(why)


def check(now=None, claude=None):
    """The decision line and its exit status, for the driver and supervise.py."""
    now = now or dt.datetime.now(dt.timezone.utc)
    claude = claude or os.environ.get("CLAUDE_BIN") or shutil.which("claude")
    text, problem = read_text(claude)
    if text is None:
        return f"UNKNOWN - {problem}; carrying on, reacting to a limit when one arrives", EXIT["UNKNOWN"]
    windows = parse(text, now)
    if not windows:
        return ("UNKNOWN - /usage named no window this can read; carrying on, reacting to a limit "
                "when one arrives"), EXIT["UNKNOWN"]
    word, until, why = decide(windows, now, next_race(now), settings())
    return line(word, until, why), EXIT[word]


def main(argv):
    if argv:
        raise SystemExit("loop_usage.py takes no arguments; the thresholds are LOOP_USAGE_* in the environment")
    text, code = check()
    print(text)
    # The log a person watches, under its own id; a line that cannot be
    # written is said, not hidden, and does not change the decision.
    subprocess.run(["bash", os.path.join(HERE, "progress.sh"), "usage", text[:300]],
                   stdout=subprocess.DEVNULL, check=False)
    return code


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
