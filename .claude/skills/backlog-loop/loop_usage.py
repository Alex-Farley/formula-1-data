#!/usr/bin/env python3
"""Read the plan's usage before an item, and say whether the loop should start one.

    python3 .claude/skills/backlog-loop/loop_usage.py [--loop]

    `--loop` is what the driver's step 2 passes: it says the run is the
    loop's own, and its line in progress.log goes under the id `usage`. A
    run without it is somebody checking by hand, and goes under `usage
    (manual)`, so the two cannot be read as the loop contradicting itself
    (2026-10-27, AF-148). The decision and the exit status are the same.

    python3 .claude/skills/backlog-loop/loop_usage.py --start <ID> --size <S> --implementer <M>
    python3 .claude/skills/backlog-loop/loop_usage.py --end <ID> <WORD> --size <S> --implementer <M>
    python3 .claude/skills/backlog-loop/loop_usage.py --costs

    What a fork costs (AF-150). The `usage` lines the driver writes between
    forks measure an item only when both fall in one 5-hour window and both
    are readable, and an item that crossed a reset or started on an
    unreadable window had no figure (#1205). So each fork reads the session window itself
    when it chooses its item (`--start`) and again when it returns (`--end`,
    with its contract word), and each reading is a line in progress.log
    under the fork's id. The end line carries the start reading beside its
    own, so the window either side of a reset is named in one line, and the
    points it cost: exact within one window; a range across one reset, since
    what the old window reached before it reset was not read; a lower bound
    across more than one. The start an end line pairs with is the earliest
    under the same head id and implementer that no end line has closed, so
    a fork the session limit killed before its end line - most of them,
    since a killed fork returns nothing - is counted in the range of the
    fork that finishes the item, not lost from it. A reading that is not
    whole is written `unreadable` with why, never a figure. Neither changes
    a decision, and whatever they read they exit as progress.sh does: 1
    only when the line could not be written. `--costs` reads the end lines
    back and prints each item's cost per implementer, its forks summed,
    then the items by size and implementer, and names any start no end line
    has closed.

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
    ALARM    (exit 4) start only the refresh alarm the line names:
             `ALARM <ID> until <ISO time> - <why>`, or `ALARM <ID> #<PR> ...`
             when the item is an alarm fork's open pull request to land. The
             time is when ordinary work may start again. The driver gives
             the fork that one id and looks again after it.
    UNKNOWN  (exit 0) usage could not be read - no CLI, an API-key login, a
             wording this does not know. Carry on as before AF-108, reacting
             to a limit when one arrives, and say so.

    The 5-hour window, by what is left of it (points of 100):
      at least M_LEFT      GO - any size; 70 (AF-148)
      at least SMALL_LEFT  SMALL - an S item costs about 73,000 fork tokens
                           and an M about 188,000 (AF-88, UR-14), each with
                           reviewer passes of 40,000-130,000 [D-24]
      less                 WAIT until the window resets

    M_LEFT replaced ANY_LEFT (20), which let an M item start with 20 points
    left. Three M forks hit the session limit mid-item: AF-90 (2026-10-14)
    from 45 points left, PM-75 (2026-10-26) from 37 and AF-132 (2026-10-27)
    from 58. M items that finished cost 10 (at least) to 31 points each between the
    `usage` lines either side, and a group of two M items 67, interactive
    use of the same window included. 70 is set above every recorded
    overrun and every recorded cost, and is an estimate from nine figures:
    LOOP_USAGE_M_LEFT moves it, and docs/DECISIONS.md D-55 has the table.
    Nothing here knows an item's size before the fork picks it, so the gate
    is on the whole band: below M_LEFT only an XS or S item starts. An L
    item may want a higher bar of its own, but no L item has run since the
    `usage` lines began (the last two, AF-47 and AF-42, are earlier), so
    there are no figures to set an L_LEFT from, and none is set. A fork
    finishing an open pull request it inherited is not capped by size, as
    before: the cap governs what is started.

    A session window that is not readable is GO, as before. Of the 24 such
    readings in progress.log, the nine since 2026-10-24 were all taken one
    minute after a 5-hour boundary (the latest 20:01 on 2026-10-27), and
    D-58 records a window's first reading as often not readable: a window
    that has just rolled over has no line yet, and all of it is left. The
    line says so.

    The weekly window is spread evenly over the seven days to its reset: the
    loop may have used the elapsed fraction of the week's allowance, plus
    SLACK points, and no more. Ahead of that pace it waits until the pace
    catches up. While a race falls between two days ago and the weekly
    reset, RESERVE points come off the allowance first, for the refresh work
    a race weekend brings - the sessions table in f1.db says when the next
    race is; when f1.db cannot be read the reserve is kept, the cautious
    side. The stricter window wins, and of two waits the later.

    The reserve is spent on a refresh alarm and on nothing else (AF-130).
    While it is held and the week says wait, but less than 100 % of the week
    is used and the 5-hour window allows an item, `next.py --alarm` is asked
    for the one item it may go on: an alarm fork's open pull request, or an
    alarm at the head of the queue with no refresh run under way. One found
    is ALARM; none is WAIT, and that wait is cut to ALARM_LOOK minutes (15
    at the least), so an alarm opened on race night is picked up at the next
    look and not at the weekly reset. A lookup that fails finds none, and
    with the 5-hour window unread none is looked for: no alarm starts
    without SMALL_LEFT points of it known to be left.

    The thresholds are starting values, not measurements: every decision is
    written to .claude/loop/progress.log with the figures it used, so a week
    of them is what calibrates them. Each can be set in the environment:
    LOOP_USAGE_M_LEFT, LOOP_USAGE_SMALL_LEFT, LOOP_USAGE_SLACK,
    LOOP_USAGE_RESERVE, LOOP_USAGE_ALARM_LOOK. A pause is always allowed, and nothing here touches
    a control: no check, permission mode or review is changed by a figure.
"""
import datetime as dt
import json
import math
import os
import re
import shutil
import sqlite3
import statistics
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
# ALARM_LOOK is in minutes, and never under ALARM_LOOK_FLOOR; the others
# are points of 100.
DEFAULTS = {"M_LEFT": 70, "SMALL_LEFT": 7, "SLACK": 10, "RESERVE": 10, "ALARM_LOOK": 60}
ALARM_LOOK_FLOOR = 15
EXIT = {"GO": 0, "UNKNOWN": 0, "SMALL": 3, "ALARM": 4, "WAIT": 5}
# What `next.py --alarm` prints: an id, and an open pull request's number.
ALARM_TARGET = re.compile(r"(?:[A-Z]{2}-\d+|#\d+)(?: #\d+)?")


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


def reserve_alarm(timeout=120):
    """(target, note): what `next.py --alarm` names the reserve may be
    spent on, or None and why not. Never raises; a lookup that fails is
    none found, the cautious side."""
    try:
        run = subprocess.run([sys.executable, os.path.join(HERE, "next.py"), "--alarm"],
                             stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, text=True,
                             timeout=timeout, check=False)
    except (OSError, subprocess.TimeoutExpired) as e:
        return None, f"the alarm lookup did not answer ({type(e).__name__})"
    if run.returncode == 1:
        return None, "no refresh alarm to spend it on"
    if run.returncode != 0:
        return None, f"the alarm lookup failed (next.py exit {run.returncode})"
    target = (run.stdout or "").strip()
    if not ALARM_TARGET.fullmatch(target):
        return None, "the alarm lookup printed nothing readable"
    return target, None


def settings(env=None):
    env = os.environ if env is None else env
    out = {}
    for key, default in DEFAULTS.items():
        try:
            out[key] = float(env.get(f"LOOP_USAGE_{key}", default))
        except ValueError:
            out[key] = float(default)
        if not math.isfinite(out[key]):
            out[key] = float(default)
    # A look every minute would be /usage and two gh reads a minute.
    out["ALARM_LOOK"] = max(out["ALARM_LOOK"], ALARM_LOOK_FLOOR)
    return out


def iso(when):
    return when.astimezone(dt.timezone.utc).isoformat(timespec="minutes")


def decide(windows, now, race=None, conf=None, alarm=None):
    """(word, until, reasons, target). `windows` is parse()'s answer; `race`
    is next_race()'s; `alarm` is reserve_alarm or a stand-in, called only
    when the reserve could be spent, and None to look for no alarm at all.
    `until` is set for WAIT (when to look again), for SMALL (the session's
    reset, the pause if nothing small is open) and for ALARM (when ordinary
    work may start again). `target` is the alarm, for ALARM alone."""
    conf = conf or settings({})
    if not windows:
        return "UNKNOWN", None, ["usage not readable"], None
    word, until, why = "GO", None, []

    if "session" in windows:
        used, reset = windows["session"]
        left = 100 - used
        why.append(f"session {used}% used, resets {iso(reset)}")
        if left < conf["SMALL_LEFT"]:
            word, until = "WAIT", reset
            why.append(f"under {conf['SMALL_LEFT']:g} points left: too little for any item")
        elif left < conf["M_LEFT"]:
            word, until = "SMALL", reset
            why.append(f"under {conf['M_LEFT']:g} points left: an XS or S item only")
    else:
        why.append("session window not readable (a window just rolled over shows none)")

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
                # The reserve may go on a refresh alarm and on nothing else,
                # and never past the whole week, with the 5-hour window too
                # low for an item, or with that window unread (AF-130).
                spendable = held and used < 100 and alarm is not None
                if spendable and word != "WAIT" and "session" in windows:
                    target, note = alarm()
                    if target:
                        why.append(f"the reserve goes on the refresh alarm {target} alone")
                        return "ALARM", catch, why, target
                    why.append(note)
                if spendable:
                    look = now + dt.timedelta(minutes=conf["ALARM_LOOK"])
                    if look < catch:
                        catch = look
                        why.append(f"looking again for a refresh alarm in {conf['ALARM_LOOK']:g} minutes")
                until = max(until, catch) if word == "WAIT" else catch
                word = "WAIT"
    else:
        why.append("weekly window not readable")

    return word, until, why, None


def line(word, until, why, target=None):
    if word == "ALARM":
        return f"ALARM {target} until {iso(until)} - " + "; ".join(why)
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
    word, until, why, target = decide(windows, now, next_race(now), settings(), reserve_alarm)
    return line(word, until, why, target), EXIT[word]


def log_id(argv):
    """The id a run's line goes under in progress.log: `usage` for the
    loop's own (`--loop`), `usage (manual)` for anyone else's."""
    return "usage" if argv == ["--loop"] else "usage (manual)"


# What a fork reports, in its own lines (AF-150).
SIZES = ("XS", "S", "M", "L", "?")
IMPLEMENTERS = ("opus", "sonnet")
WORDS = ("MERGED", "SKIPPED", "PAUSE", "DECIDE", "STOP", "LIMIT", "REROUTE")
# Two readings name one window when their resets agree to within this; the
# same window has been read a minute apart (01:59 and 02:00, 2026-10-28).
SAME_WINDOW = dt.timedelta(hours=1)
# A window is five hours, and the next one opens on the first use after the
# last closes, so a second reset cannot fall less than ten hours after the
# first reading's.
TWO_RESETS = dt.timedelta(hours=10)
READING = r"session (?:(\d{1,3})% resets ([^\s;]+)|unreadable)"
START_LINE = re.compile(r"^\d\d:\d\d:\d\d (\S+) usage start: size \S+, implementer ([^\s,]+), ")
END_LINE = re.compile(
    r"^\d\d:\d\d:\d\d (\S+) usage end: ([A-Z]+), size (\S+), implementer ([^\s;]+); "
    r"from (?:" + READING + r"|start not logged)[^;]*; to " + READING)


def session_reading(now=None, claude=None):
    """(used, reset) for the 5-hour window, or (None, why). Read as check()
    reads it, with the same parser and no model turn; never raises."""
    now = now or dt.datetime.now(dt.timezone.utc)
    claude = claude or os.environ.get("CLAUDE_BIN") or shutil.which("claude")
    text, problem = read_text(claude)
    if text is None:
        return None, problem
    windows = parse(text, now)
    if "session" not in windows:
        return None, ("no session line, as a window just rolled over shows"
                      if "week" in windows else "/usage named no window this can read")
    return windows["session"], None


def describe(reading):
    if reading is None:
        return "session unreadable"
    used, reset = reading
    return f"session {used}% resets {iso(reset)}"


def cost(start, end):
    """(low, high) points of the 5-hour window used between two readings,
    each (used, reset) or None. Within one window the two agree; across one
    reset the old window's last figure was not read, so the cost is at least
    the new window's use and at most that plus what the old had left; across
    more than one, high is None. (None, None) when either reading is
    missing, or the two cannot both be true."""
    if start is None or end is None:
        return None, None
    (u0, r0), (u1, r1) = start, end
    if abs(r1 - r0) < SAME_WINDOW:
        return (u1 - u0, u1 - u0) if u1 >= u0 else (None, None)
    if r1 < r0:
        return None, None
    if r1 - r0 < TWO_RESETS:
        return u1, 100 - u0 + u1
    return u1, None


def show(low, high):
    if low is None:
        return "unreadable"
    if high is None:
        return f"at least {low}"
    return str(low) if low == high else f"{low}-{high}"


def log_path():
    """progress.log beside the main checkout, found as progress.sh finds it,
    from this script's own directory so a worktree's copy finds the same."""
    try:
        common = subprocess.run(["git", "rev-parse", "--git-common-dir"], cwd=HERE, stdout=subprocess.PIPE,
                                stderr=subprocess.DEVNULL, text=True, check=True).stdout.strip()
    except (OSError, subprocess.CalledProcessError):
        common = os.path.join(ROOT, ".git")
    return os.path.join(os.path.dirname(os.path.join(HERE, common)), ".claude", "loop", "progress.log")


def read_log(path):
    try:
        with open(path, encoding="utf-8") as f:
            return f.read().splitlines()
    except OSError:
        return []


def open_starts(lines):
    """{(head, implementer): [start lines no end line has closed]}, in log
    order. A group's id is its head's and its companions', joined by +, and
    its start was written under the head alone."""
    out = {}
    for text in lines:
        m = START_LINE.match(text)
        if m:
            out.setdefault((m.group(1), m.group(2)), []).append(text)
            continue
        m = END_LINE.match(text)
        if m:
            out.pop((m.group(1).split("+")[0], m.group(4)), None)
    return out


def started(lines, item, implementer):
    """The start reading an end line pairs with: the earliest start under
    the item's head id and implementer that no end line has closed, so a
    fork killed before its end line is inside the range, not dropped.
    (reading, found, how many starts it spans)."""
    starts = open_starts(lines).get((item.split("+")[0], implementer), [])
    if not starts:
        return None, False, 0
    found = starts[0]
    m = re.search(READING, found)
    if not m or m.group(1) is None:
        return None, True, len(starts)
    try:
        reset = dt.datetime.fromisoformat(m.group(2))
    except ValueError:
        return None, True, len(starts)
    return (int(m.group(1)), reset), True, len(starts)


def fork_line(kind, item, word, size, implementer, reading, why, lines):
    """The progress.log stage for a fork's start or end reading."""
    here = describe(reading) + (f" ({why})" if why else "")
    if kind == "start":
        return f"usage start: size {size}, implementer {implementer}, {here}"
    before, found, spans = started(lines, item, implementer)
    low, high = cost(before, reading)
    crossed = before is not None and reading is not None and abs(reading[1] - before[1]) >= SAME_WINDOW
    return (f"usage end: {word}, size {size}, implementer {implementer}; "
            f"from {describe(before) if found else 'start not logged'}"
            + (f" (the earliest of {spans} starts)" if spans > 1 else "") + f"; to {here}; "
            f"cost {show(low, high)}" + (" points" if low is not None else "")
            + ("; the window reset mid-item" if crossed and low is not None else ""))


def fork_main(argv, now=None, claude=None, path=None):
    kind = argv[0][2:]
    rest = argv[1:]
    try:
        item = rest.pop(0)
        word = rest.pop(0) if kind == "end" else None
        opts = dict(zip(rest[::2], rest[1::2]))
        size, implementer = opts["--size"], opts["--implementer"]
    except (IndexError, KeyError):
        raise SystemExit(f"loop_usage.py --{kind} <ID>{' <WORD>' if kind == 'end' else ''} "
                         "--size <XS|S|M|L|?> --implementer <opus|sonnet>") from None
    if (len(rest) != 4 or set(opts) != {"--size", "--implementer"} or size not in SIZES
            or implementer not in IMPLEMENTERS or (word is not None and word not in WORDS)
            or not re.fullmatch(r"[^\s;,]+", item)):
        raise SystemExit(f"loop_usage.py --{kind}: an id without spaces, size one of {', '.join(SIZES)}, "
                         f"implementer one of {', '.join(IMPLEMENTERS)}"
                         + (f", word one of {', '.join(WORDS)}" if kind == "end" else ""))
    reading, why = session_reading(now, claude)
    text = fork_line(kind, item, word, size, implementer, reading, why, read_log(path or log_path()))
    print(f"{item} {text}")
    wrote = subprocess.run(["bash", os.path.join(HERE, "progress.sh"), item, text],
                           cwd=HERE, stdout=subprocess.DEVNULL, check=False)
    return 0 if wrote.returncode == 0 else 1


def costs(lines):
    """The report --costs prints, from progress.log's end lines."""
    items = {}
    for text in lines:
        m = END_LINE.match(text)
        if not m:
            continue
        item, word, size, implementer = m.group(1, 2, 3, 4)
        readings = []
        for used, reset in (m.group(5, 6), m.group(7, 8)):
            try:
                readings.append((int(used), dt.datetime.fromisoformat(reset)) if used is not None else None)
            except ValueError:
                readings.append(None)
        low, high = cost(*readings)
        entry = items.setdefault((item, implementer), {"words": [], "low": 0, "high": 0})
        entry.update(size=size, implementer=implementer)
        entry["words"].append(word)
        if low is None or entry["low"] is None:
            entry["low"] = entry["high"] = None
        else:
            entry["low"] += low
            entry["high"] = None if high is None or entry["high"] is None else entry["high"] + high
    unclosed = sorted(f"{head} ({implementer})" for head, implementer in open_starts(lines))
    tail = (["Started, with no end line yet - running, or killed before it wrote one: "
             + ", ".join(unclosed)] if unclosed else [])
    if not items:
        return "\n".join(["No fork end lines in progress.log yet (AF-150 began writing them on 2026-10-29)."]
                         + tail)
    out = ["Per item - points of the 5-hour window, its forks summed; a range where a reset fell "
           "mid-item, since the old window's last figure was not read:"]
    for (item, _), e in items.items():
        out.append(f"  {item:<22} {e['size']:<3} {e['implementer']:<7} {'+'.join(e['words']):<16} "
                   f"{show(e['low'], e['high'])}")
    out.append("By size and implementer:")
    groups = {}
    for e in items.values():
        groups.setdefault((SIZES.index(e["size"]) if e["size"] in SIZES else len(SIZES), e["size"],
                           e["implementer"]), []).append(e)
    for (_, size, implementer), es in sorted(groups.items()):
        exact = sorted(e["low"] for e in es if e["low"] is not None and e["low"] == e["high"])
        bounded = [e for e in es if e["low"] is not None and e["low"] != e["high"]]
        unread = len(es) - len(exact) - len(bounded)
        part = (f"{len(exact)} exact, median {statistics.median(exact):g}, mean {statistics.mean(exact):.1f}"
                if exact else "0 exact")
        out.append(f"  {size:<3} {implementer:<7} {len(es)} item{'s' if len(es) != 1 else ''}: {part}; "
                   f"{len(bounded)} across a reset"
                   + (f" ({', '.join(show(e['low'], e['high']) for e in bounded)})" if bounded else "")
                   + f"; {unread} unreadable")
    return "\n".join(out + tail)


def main(argv):
    if argv[:1] in (["--start"], ["--end"]):
        return fork_main(argv)
    if argv == ["--costs"]:
        print(costs(read_log(log_path())))
        return 0
    if argv not in ([], ["--loop"]):
        raise SystemExit("loop_usage.py takes --loop, --start, --end or --costs; "
                         "the thresholds are LOOP_USAGE_* in the environment")
    text, code = check()
    print(text)
    # The log a person watches, under an id that says whose run it was; a
    # line that cannot be written is said, not hidden, and does not change
    # the decision.
    subprocess.run(["bash", os.path.join(HERE, "progress.sh"), log_id(argv), text[:300]],
                   stdout=subprocess.DEVNULL, check=False)
    return code


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
