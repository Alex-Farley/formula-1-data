#!/usr/bin/env python3
"""Is the database behind the calendar? (SD-35)

    python3 .github/scripts/refresh_health.py [--now YYYY-MM-DD] [--root DIR]

Prints what it found and exits 1 when the database is behind, 0 when it is
not. It reads only what is committed - f1.db and harvest/race_dates.txt - and
the date, so it says the same thing whether or not the refresh has run, which
is the point of it: from 2026-10-02 every refresh failed for three days and
nothing that depended on the refresh noticed.

THE RULE (decided 2026-10-05, on #786)
    A race is LATE when its date in `races` is more than GRACE_DAYS in the
    past and it still has no result. Staleness is measured against the
    published race dates, not against the last refresh: a summer break or a
    winter passes no race date, so it raises nothing, and a wall-clock "N days
    since the last refresh" would fire through every one of them.

    Within a season F1DB's calendar holds, a round counts only while F1DB
    still lists a race on that day. F1DB holds a season's calendar ahead of
    it (harvest/race_dates.txt carries every 2026 round, run or not) and
    marks a cancelled round by leaving it out, so a race cancelled or moved
    after it was typed into data/current.py stops counting as soon as the
    harvest says so. It is matched on the day rather than the round number,
    because F1DB renumbers the rounds after one it drops. A season F1DB's
    calendar does not hold at all (2027, today) is not a season of
    cancellations but one the harvest has not reached - and a refresh that
    died over the winter would never reach it - so there every round counts
    on its date in `races`. Nothing typed in data/ can mark a round
    cancelled and so switch this check off.

    build.py carries that half into f1.db as `races.on_f1db_calendar`, and
    verify.py holds it to the harvest, so that lapledger.org says a race is
    late by this same rule and these same GRACE_DAYS at the reader's own
    date (SD-37, web/src/lib/refresh.js). A change to the rule is a change
    to both.

    Separately, and lighter: from 1 February a season with no calendar at all
    in `races` is flagged, since by then the season's calendar has long been
    announced and its first race is weeks away.

Used by refresh.yml's `report` job, which opens one issue while this exits
1 and closes it when it exits 0, and by a person checking the sync by hand
(docs/UPSTREAM.md).
"""
import argparse
import datetime as dt
import os
import sqlite3
import sys

GRACE_DAYS = 3
CALENDAR_BY = (2, 1)    # (month, day): a season's calendar is due by 1 February


def f1db_calendar(path):
    """{(year, 'YYYY-MM-DD')} for every race F1DB's calendar lists."""
    days = set()
    with open(path, encoding="utf-8") as f:
        for line in f:
            if line.startswith("#") or not line.strip():
                continue
            year, _round, day = line.rstrip("\n").split("|")[:3]
            days.add((int(year), day))
    return days


def unresulted(con, today):
    """Rounds dated before `today` with no row in race_entries, oldest
    first: [(year, round, name, date)]. Not `status`: data/current.py can
    author a round `completed` by hand, and that is not a result."""
    return con.execute("""
        SELECT year, round, name_used, date_iso FROM races r
        WHERE date_iso < ?
          AND NOT EXISTS (SELECT 1 FROM race_entries e WHERE e.race_id = r.id)
        ORDER BY date_iso, year, round""", (today.isoformat(),)).fetchall()


def late_races(con, calendar, today):
    """(late, unlisted). `late` is every round more than GRACE_DAYS past its
    date with no result, unless F1DB's calendar holds that season and lists
    no race that day; that is `unlisted`, which raises nothing."""
    seasons = {year for year, _ in calendar}
    late, unlisted = [], []
    for year, rnd, name, day in unresulted(con, today):
        days = (today - dt.date.fromisoformat(day)).days
        if days <= GRACE_DAYS:
            continue
        row = dict(year=year, round=rnd, name=name, date=day, days=days)
        cancelled = year in seasons and (year, day) not in calendar
        (unlisted if cancelled else late).append(row)
    return late, unlisted


def season_without_calendar(con, today):
    """The season whose calendar is due and absent, or None."""
    if (today.month, today.day) < CALENDAR_BY:
        return None
    held = con.execute("SELECT COUNT(*) FROM races WHERE year = ?", (today.year,)).fetchone()[0]
    return None if held else today.year


def check(db, calendar_path, today):
    """(problems, notes). A problem is (key, line of Markdown) - the key
    names it the same way however many days late it is, so the issue that
    reports it can tell a new problem from an old one a day older. Notes are
    lines said beside them that raise nothing."""
    con = sqlite3.connect(f"file:{db}?mode=ro", uri=True)
    try:
        late, unlisted = late_races(con, f1db_calendar(calendar_path), today)
        season = season_without_calendar(con, today)
    finally:
        con.close()
    problems = [(f"{r['year']}/{r['round']}",
                 f"- **{r['year']} round {r['round']}, the {r['name']}**, was run on "
                 f"{r['date']}, {r['days']} days ago, and has no result here.")
                for r in late]
    if season:
        problems.append((f"{season}/calendar",
                         f"- **{season} has no calendar.** It is past 1 February and "
                         f"`races` holds no round of the {season} season."))
    notes = [f"- {r['year']} round {r['round']}, the {r['name']} ({r['date']}), has no "
             f"result either, but F1DB's {r['year']} calendar lists no race that day, so it "
             f"is taken as cancelled or moved and raises nothing. If it was cancelled, "
             f"`data/current.py` still lists it."
             for r in unlisted]
    return problems, notes


def report(problems, notes, today):
    """What a person reads: the verdict, then each problem, then the notes."""
    if problems:
        head = (f"The database is behind the calendar as of {today}. A race is late once "
                f"{GRACE_DAYS} days have passed without a result.\n\n"
                + "\n".join(line for _, line in problems))
    else:
        head = (f"The database is up to date with the calendar as of {today}: no race "
                f"more than {GRACE_DAYS} days past is without a result.")
    return head + ("\n\n" + "\n".join(notes) if notes else "")


def today_utc():
    return dt.datetime.now(dt.timezone.utc).date()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--now", help="today's date, YYYY-MM-DD (default: today in UTC)")
    ap.add_argument("--root", default=".")
    args = ap.parse_args()
    today = dt.date.fromisoformat(args.now) if args.now else today_utc()
    problems, notes = check(os.path.join(args.root, "f1.db"),
                            os.path.join(args.root, "harvest", "race_dates.txt"), today)
    print(report(problems, notes, today))
    sys.exit(1 if problems else 0)


if __name__ == "__main__":
    main()
