"""Whether this run of refresh.yml goes ahead: prints `run=true` or `run=false`.

The workflow is scheduled every three hours so that it can follow a race
weekend, and this is what keeps the other runs down to a sparse checkout.
A run goes ahead when any of these holds:

- it was started by hand (EVENT=workflow_dispatch);
- the check has not yet run today - LAST_CHECKED in web/src/lib/refresh.js
  is not today's UTC date - which is the daily check, and still happens on
  the day however late GitHub starts the job;
- a session began in the last 72 hours, by the `sessions` table in f1.db:
  formula1.com's published start times, FP1 on Friday to the race, so the
  window runs to the Monday or Tuesday after, which is when F1DB publishes.

    EVENT=schedule python3 .github/scripts/refresh_gate.py [--now ISO] [--root DIR]
"""
import argparse
import datetime as dt
import os
import re
import sqlite3
import sys

WINDOW = dt.timedelta(hours=72)


def decide(event, last_checked, now, sessions_started):
    """The reason to run, or None. `sessions_started` is how many sessions
    began in (now - WINDOW, now]."""
    if event == "workflow_dispatch":
        return "started by hand"
    if last_checked != now.strftime("%Y-%m-%d"):
        return f"not yet checked today (last checked {last_checked})"
    if sessions_started:
        return f"{sessions_started} session(s) began in the last 72 hours"
    return None


def sessions_started(db, now):
    stamp = "%Y-%m-%dT%H:%MZ"
    con = sqlite3.connect(f"file:{db}?mode=ro", uri=True)
    try:
        return con.execute(
            "SELECT COUNT(*) FROM sessions WHERE start_utc > ? AND start_utc <= ?",
            ((now - WINDOW).strftime(stamp), now.strftime(stamp))).fetchone()[0]
    finally:
        con.close()


def last_checked(path):
    m = re.search(r"^export const LAST_CHECKED = '(.*)'$", open(path).read(), re.M)
    if not m:
        raise SystemExit(f"LAST_CHECKED not found in {path}; has the line changed shape?")
    return m.group(1)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--now", help="ISO time in UTC, for testing")
    ap.add_argument("--root", default=".")
    args = ap.parse_args()
    now = (dt.datetime.fromisoformat(args.now).replace(tzinfo=dt.timezone.utc)
           if args.now else dt.datetime.now(dt.timezone.utc))
    why = decide(os.environ.get("EVENT", ""),
                 last_checked(os.path.join(args.root, "web", "src", "lib", "refresh.js")),
                 now, sessions_started(os.path.join(args.root, "f1.db"), now))
    print(f"Run: {why}." if why else
          "Checked today, and no session began in the last 72 hours. Stopping.",
          file=sys.stderr)
    print(f"run={'true' if why else 'false'}")


if __name__ == "__main__":
    main()
