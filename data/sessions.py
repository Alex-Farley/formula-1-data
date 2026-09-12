"""
The weekend timetable of the current season: every session, with its start
in UTC and the circuit's time zone (LV-02, decided 2026-09-12 from LV-01).

Read from formula1.com's race pages, which show each session's start in the
reader's zone; read from a UTC client, so the times here are UTC. The FIA's
own timetable is a per-event "Event & Timing Information" PDF, which this
project has not yet read by tool; when it is, this file is what it checks.
A start time is a fact, and may be re-stated (SOURCE_LICENCE, facts-only);
nothing else on those pages is copied. The pages also carry the same starts
as schema.org subEvent startDate values in UTC, which is how the review of
#91 reproduced all 115 by machine.

One tuple per session: round, kind, start_utc (YYYY-MM-DDTHH:MMZ), zone (IANA
tz database name, so a browser can show the circuit's local time with Intl).
Kinds: fp1 fp2 fp3 sprint_qualifying sprint qualifying race. A sprint weekend
has fp1, sprint_qualifying, sprint, qualifying, race; any other has fp1, fp2,
fp3, qualifying, race - verify.py checks each weekend's set against
races.sprint, and that the race's local day is the last day of races.dates.
Las Vegas is the reason the zone travels with the row: its Saturday-evening
race is Sunday in UTC.
"""

SESSIONS_SOURCE = "https://www.formula1.com/en/racing/2026/{slug}"

# round -> (formula1.com slug, IANA zone)
WEEKENDS_2026 = {
    1:  ("australia", "Australia/Melbourne"),
    2:  ("china", "Asia/Shanghai"),
    3:  ("japan", "Asia/Tokyo"),
    4:  ("miami", "America/New_York"),
    5:  ("canada", "America/Toronto"),
    6:  ("monaco", "Europe/Monaco"),
    7:  ("barcelona-catalunya", "Europe/Madrid"),
    8:  ("austria", "Europe/Vienna"),
    9:  ("great-britain", "Europe/London"),
    10: ("belgium", "Europe/Brussels"),
    11: ("hungary", "Europe/Budapest"),
    12: ("netherlands", "Europe/Amsterdam"),
    13: ("italy", "Europe/Rome"),
    14: ("spain", "Europe/Madrid"),
    15: ("azerbaijan", "Asia/Baku"),
    16: ("bahrain", "Asia/Kuala_Lumpur"),   # the Bahrain Grand Prix of 2026 is at Sepang
    17: ("singapore", "Asia/Singapore"),
    18: ("united-states", "America/Chicago"),
    19: ("mexico", "America/Mexico_City"),
    20: ("brazil", "America/Sao_Paulo"),
    21: ("las-vegas", "America/Los_Angeles"),
    22: ("qatar", "Asia/Qatar"),
    23: ("united-arab-emirates", "Asia/Dubai"),
}

def _weekend(rnd, *starts):
    """The five sessions of a weekend from their UTC starts, in running order."""
    kinds = (("fp1", "sprint_qualifying", "sprint", "qualifying", "race")
             if rnd in SPRINT_ROUNDS_2026 else
             ("fp1", "fp2", "fp3", "qualifying", "race"))
    assert len(starts) == 5, rnd
    # The Z is load-bearing: JavaScript reads "2026-03-08T04:00" as the
    # reader's local time and "2026-03-08T04:00Z" as the instant it is.
    return [(rnd, k, f"2026-{s}Z", WEEKENDS_2026[rnd][1]) for k, s in zip(kinds, starts)]

SPRINT_ROUNDS_2026 = {2, 4, 5, 9, 12, 17}

SESSIONS_2026 = (
    _weekend(1,  "03-06T01:30", "03-06T05:00", "03-07T01:30", "03-07T05:00", "03-08T04:00")
    + _weekend(2,  "03-13T03:30", "03-13T07:30", "03-14T03:00", "03-14T07:00", "03-15T07:00")
    + _weekend(3,  "03-27T02:30", "03-27T06:00", "03-28T02:30", "03-28T06:00", "03-29T05:00")
    + _weekend(4,  "05-01T16:00", "05-01T20:30", "05-02T16:00", "05-02T20:00", "05-03T17:00")
    + _weekend(5,  "05-22T16:30", "05-22T20:30", "05-23T16:00", "05-23T20:00", "05-24T20:00")
    + _weekend(6,  "06-05T11:30", "06-05T15:00", "06-06T10:30", "06-06T14:00", "06-07T13:00")
    + _weekend(7,  "06-12T11:30", "06-12T15:00", "06-13T10:30", "06-13T14:00", "06-14T13:00")
    + _weekend(8,  "06-26T11:30", "06-26T15:00", "06-27T10:30", "06-27T14:00", "06-28T13:00")
    + _weekend(9,  "07-03T11:30", "07-03T15:30", "07-04T11:00", "07-04T15:00", "07-05T14:00")
    + _weekend(10, "07-17T11:30", "07-17T15:00", "07-18T10:30", "07-18T14:00", "07-19T13:00")
    + _weekend(11, "07-24T11:30", "07-24T15:00", "07-25T10:30", "07-25T14:00", "07-26T13:00")
    + _weekend(12, "08-21T10:30", "08-21T14:30", "08-22T10:00", "08-22T14:00", "08-23T13:00")
    + _weekend(13, "09-04T10:30", "09-04T14:00", "09-05T10:30", "09-05T14:00", "09-06T13:00")
    + _weekend(14, "09-11T11:30", "09-11T15:00", "09-12T10:30", "09-12T14:00", "09-13T13:00")
    + _weekend(15, "09-24T08:30", "09-24T12:00", "09-25T08:30", "09-25T12:00", "09-26T11:00")
    + _weekend(16, "10-02T04:30", "10-02T08:00", "10-03T04:30", "10-03T08:00", "10-04T07:00")
    + _weekend(17, "10-09T08:30", "10-09T12:30", "10-10T09:00", "10-10T13:00", "10-11T12:00")
    + _weekend(18, "10-23T17:30", "10-23T21:00", "10-24T17:30", "10-24T21:00", "10-25T20:00")
    + _weekend(19, "10-30T18:30", "10-30T22:00", "10-31T17:30", "10-31T21:00", "11-01T20:00")
    + _weekend(20, "11-06T15:30", "11-06T19:00", "11-07T14:30", "11-07T18:00", "11-08T17:00")
    + _weekend(21, "11-20T00:30", "11-20T04:00", "11-21T00:30", "11-21T04:00", "11-22T04:00")
    + _weekend(22, "11-27T13:30", "11-27T17:00", "11-28T14:30", "11-28T18:00", "11-29T16:00")
    + _weekend(23, "12-04T09:30", "12-04T13:00", "12-05T10:30", "12-05T14:00", "12-06T13:00")
)

SESSION_NAMES = {
    "fp1": "Practice 1", "fp2": "Practice 2", "fp3": "Practice 3",
    "sprint_qualifying": "Sprint qualifying", "sprint": "Sprint",
    "qualifying": "Qualifying", "race": "Race",
}
