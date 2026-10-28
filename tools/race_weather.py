# -*- coding: utf-8 -*-
"""
Harvest each race's weather, twice over (AF-136).

    python3 tools/race_weather.py reported            # Wikipedia race articles
    python3 tools/race_weather.py modelled             # ERA5, via Open-Meteo
    python3 tools/race_weather.py modelled --f1db ~/f1db   # a given F1DB checkout

Reads:   f1.db                     the completed races, from the last build
         en.wikipedia.org          each race's article, the infobox's Weather
         the F1DB checkout         each circuit's coordinates
                                   (tools/f1db_fetch.py leaves one in .f1dbcache)
         archive-api.open-meteo.com  ERA5 reanalysis for that point and day
Writes:  harvest/race_weather_reported.txt   one row per race whose article
                                             states the weather
         harvest/race_weather_reported.log   every race that has none, and why
         harvest/race_weather_modelled.txt   one row per race the model covers
         harvest/race_weather_modelled.log   every race it does not, and why

Two sources, each for what it is good at
----------------------------------------
The maintainer's ruling on AF-136 (2026-10-24): a race article's reported
weather decides wet or dry, because it is a report of the race; ERA5's
reanalysis supplies the air temperature, rain and wind, because it is the
only source with a figure for every race back to 1950, and it is labelled
modelled, because it is. A reanalysis is a weather model run over the
observations of the day on a grid - ERA5-Land's is about 9 km, ERA5's about
28 - so its figure is for the grid cell the circuit sits in, not for the
track, and it can miss a shower at one circuit. Where the two cannot both be
true, build.py files a discrepancy (data/harvest.py says when).

The reported half
-----------------
Each race's article is the season's year and the name the race ran under -
"1950 British Grand Prix" - with Wikipedia's redirects followed, so a race
renamed since resolves to the article that holds it. The value read is the
infobox's `| Weather =` line, and nothing else in the article: a phrase like
"Sunny, warm" or "Wet, drying later". The tool keeps its words and takes out
the markup - references, the {{convert}} templates reduced to the figure and
unit they print, links to their text - and writes the revision it read, so
the row is the revision's and can be checked against it. Whether a phrase
means wet or dry is not decided here: data/harvest.py's rule reads the
phrase on every build, so the reading is in the repository and not in a run.

The modelled half
-----------------
One request per race, for the circuit's coordinates as F1DB gives them for
the layout the race ran (CC BY 4.0, the circuit's reference point, not its
centreline) and for the race's LOCAL day: races.date_iso, which is the UTC
day, except at a circuit data/current.py's RACE_DAY_AFTER_WEEKEND names,
whose race starts after midnight UTC, where the local day is the one before.
The model is `era5_seamless` - ERA5-Land where it covers the point, ERA5
elsewhere - fixed, so every race from 1950 to the latest is the same model's
reading and a re-run reproduces it. Asked for daily figures in the
circuit's own time zone:

    temperature_2m_max     the day's highest air temperature, 2 m up, in C
    precipitation_sum      the day's rain (and any snow, as water), in mm
    precipitation_hours    the hours of the day with any
    wind_speed_10m_max     the day's strongest wind, 10 m up, in km/h

A day, not the race's hours: no source here holds a start time before 2023,
and a window chosen without one would claim to be the race when it might
not be. ERA5 runs some days behind the present, so a race run in the last
week is logged as not yet covered and is picked up by the next run.

Licence
-------
Open-Meteo's API data is CC BY 4.0, and its terms let a non-commercial
project with no advertising or subscriptions use the free API; the harvest
is one request per race, far inside its limits. The figures are ERA5's,
which the Copernicus Climate Change Service publishes under CC BY 4.0 too.
source_registry entry 19 classifies it, and ATTRIBUTION.md carries both
credits. Open-Meteo asks for a link beside wherever its data is shown: each
weather discrepancy's assessment carries it in its text, and whatever shows
the figures on a page (AF-142) carries it beside them.
"""
import argparse
import datetime
import glob
import json
import os
import re
import sqlite3
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, ROOT)
from data import current as N  # noqa: E402  (RACE_DAY_AFTER_WEEKEND)
from data import harvest as HV  # noqa: E402  (the file paths, and the URL rules)

DB = os.path.join(ROOT, "f1.db")
F1DB_CACHE = os.path.join(ROOT, ".f1dbcache")
UA = ("LapLedger-harvest/1.0 (https://lapledger.org; "
      "https://github.com/Alex-Farley/formula-1-data)")
WIKI_API = "https://en.wikipedia.org/w/api.php"
WIKI_DELAY = 1.0
METEO_DELAY = 0.3

# The infobox line. Anchored to one line - `[ \t]` and never `\s` - because
# an empty `| Weather =` is otherwise read as the parameter on the line
# after it.
WEATHER_LINE = re.compile(r"^[ \t]*\|[ \t]*[Ww]eather[ \t]*=[ \t]*(.*)$", re.M)
# A second parameter written on the same line: "| Weather = Dry | Attendance = ..."
NEXT_PARAM = re.compile(r"\s\|\s*[A-Za-z_][A-Za-z_ 0-9]*=")
UNITS = {"C": "°C", "°C": "°C", "F": "°F", "°F": "°F"}
RANGE_WORDS = ("to", "-", "–", "and")


def _convert(m):
    """{{convert|17|C|F}} as it prints: 17 °C. A range, {{convert|18|to|19|C|F}},
    as 18–19 °C. Named parameters (order=flip, abbr=on) change only the
    layout of what prints, and are dropped."""
    parts = [p.strip() for p in m.group(2).split("|")]
    parts = [p for p in parts if "=" not in p]
    if len(parts) >= 4 and parts[1] in RANGE_WORDS:
        value, unit = f"{parts[0]}–{parts[2]}", parts[3]
    elif len(parts) >= 2:
        value, unit = parts[0], parts[1]
    else:
        return ""
    return f"{value} {UNITS.get(unit, unit)}"


def clean(text):
    """The infobox phrase without its markup, or None when nothing is left
    or markup this does not know survives - a phrase this cannot read is
    logged, never stored half-read."""
    s = re.sub(r"<!--.*?(-->|$)", "", text, flags=re.S)
    s = re.sub(r"<ref[^>/]*/>", "", s)
    s = re.sub(r"<ref[^>]*>.*?</ref>", "", s, flags=re.S)
    s = re.sub(r"<ref[^>]*>.*$", "", s, flags=re.S)
    # After the references, whose citations have parameters of their own.
    s = NEXT_PARAM.split(s, maxsplit=1)[0]
    for _ in range(3):
        s = re.sub(r"\{\{\s*(convert|cvt)\s*\|([^{}]*)\}\}", _convert, s, flags=re.I)
        s = re.sub(r"\{\{\s*nowrap\s*\|([^{}]*)\}\}", r"\1", s, flags=re.I)
    s = re.sub(r"<br\s*/?>", "; ", s, flags=re.I)
    s = re.sub(r"<[^>]+>", "", s)
    s = re.sub(r"\[\[(?:[^|\]]*\|)?([^\]]*)\]\]", r"\1", s)
    s = re.sub(r"\[https?://\S+\s*([^\]]*)\]", r"\1", s)
    s = s.replace("&nbsp;", " ").replace("'''", "").replace("''", "")
    # The infobox's own closing braces, where it ends on this line.
    if "{{" not in s:
        s = re.sub(r"\}\}\s*$", "", s)
    if ("{{" in s or "}}" in s or "|" in s or "[" in s
            or re.search(r"&#?[A-Za-z0-9]+;", s)):
        return None
    s = re.sub(r"\s+", " ", s)
    s = re.sub(r"\s*([,;])(\s*[,;])+", r"\1", s)
    s = s.strip(" ;,.")
    return s or None


def wiki(**params):
    params.update(format="json", formatversion="2")
    url = WIKI_API + "?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    for attempt in range(6):
        try:
            with urllib.request.urlopen(req, timeout=60) as r:
                data = json.loads(r.read().decode("utf-8"))
            time.sleep(WIKI_DELAY)
            return data
        except (urllib.error.URLError, TimeoutError):
            if attempt < 5:
                time.sleep(5 * (attempt + 1))
                continue
            raise
    raise SystemExit("race_weather: gave up after six attempts")


def read_races(db):
    """(year, round, name_used, date_iso, circuit_id, f1db_layout_id) of every
    completed race, from the last build."""
    if not os.path.exists(db):
        raise SystemExit(f"{db} is missing. Run python3 build.py first.")
    con = sqlite3.connect(db)
    try:
        return con.execute("""SELECT year, round, name_used, date_iso,
                                     circuit_id, f1db_layout_id
                                FROM races WHERE status = 'completed'
                               ORDER BY year, round""").fetchall()
    finally:
        con.close()


def harvest_reported(races, today):
    rows, log = [], []
    for i in range(0, len(races), 50):
        chunk = races[i:i + 50]
        titles = [f"{y} {name}" for y, _, name, *_ in chunk]
        q = wiki(action="query", prop="revisions", rvprop="ids|content",
                 rvslots="main", titles="|".join(titles),
                 redirects="1")["query"]
        normal = {x["from"]: x["to"] for x in q.get("normalized", [])}
        redirect = {x["from"]: x["to"] for x in q.get("redirects", [])}
        pages = {p["title"]: p for p in q["pages"]}
        for (y, rnd, *_), asked in zip(chunk, titles):
            title = normal.get(asked, asked)
            title = redirect.get(title, title)
            page = pages.get(title)
            key = f"{y}|{rnd}"
            if not page or "revisions" not in page:
                log.append(f"{key}\tNO ARTICLE\t{asked}")
                continue
            rev = page["revisions"][0]
            m = WEATHER_LINE.search(rev["slots"]["main"]["content"])
            if not m or not m.group(1).strip() or m.group(1).lstrip().startswith("|"):
                log.append(f"{key}\tNO WEATHER\t{title} (revision {rev['revid']}) "
                           "states none in its infobox")
                continue
            phrase = clean(m.group(1))
            if phrase is None:
                log.append(f"{key}\tUNREAD\t{title} (revision {rev['revid']}): "
                           f"{m.group(1)[:160]!r}")
                continue
            rows.append(f"{y}|{rnd}|{title}|{rev['revid']}|{phrase}")
        print(f"race_weather: reported, {i + len(chunk)} of {len(races)}",
              file=sys.stderr)
    head = [
        f"# Generated by tools/race_weather.py reported on {today}. Do not edit by hand.",
        "# Source: the infobox of each race's English Wikipedia article (CC BY-SA 4.0),",
        "# its `Weather` line with the markup taken out, at the revision named.",
        "# data/harvest.py's rule reads each phrase as wet or dry; nothing here does.",
        "# year|round|article|revision|reported",
    ]
    return head + rows, [
        f"# Generated by tools/race_weather.py reported on {today}. Do not edit by hand.",
        "# Every completed race the harvest holds no reported weather for, and why.",
    ] + log


def f1db_points(path):
    """F1DB layout id -> (circuit id, latitude, longitude), from a checkout."""
    base = os.path.join(path, "src", "data", "circuits")
    files = sorted(glob.glob(os.path.join(base, "*.yml")))
    if not files:
        raise SystemExit(f"{path} has no src/data/circuits. Pass an F1DB "
                         "checkout with --f1db, or run tools/f1db_fetch.py.")
    out = {}
    for f in files:
        with open(f, encoding="utf-8") as fh:
            s = fh.read()
        cid = re.search(r"^id: (\S+)", s, re.M).group(1)
        lat = float(re.search(r"^latitude: (\S+)", s, re.M).group(1))
        lon = float(re.search(r"^longitude: (\S+)", s, re.M).group(1))
        for m in re.finditer(r"^  - id: (\S+)", s, re.M):
            out[m.group(1)] = (cid, lat, lon)
    return out


def harvest_modelled(races, points, release, today):
    rows, log = [], []
    for n, (y, rnd, _, date_iso, circuit_id, layout) in enumerate(races, 1):
        key = f"{y}|{rnd}"
        if layout not in points:
            log.append(f"{key}\tNO POINT\tF1DB holds no layout {layout!r}")
            continue
        f1db_circuit, lat, lon = points[layout]
        day = HV.weather_day(date_iso, circuit_id, N.RACE_DAY_AFTER_WEEKEND)
        url = HV.weather_model_url(lat, lon, day)
        req = urllib.request.Request(url, headers={"User-Agent": UA})
        for attempt in range(5):
            try:
                with urllib.request.urlopen(req, timeout=60) as r:
                    data = json.loads(r.read().decode("utf-8"))
                break
            except (urllib.error.URLError, TimeoutError, ValueError) as e:
                # ValueError: an empty or cut-off body, which a retry clears.
                if attempt == 4:
                    raise SystemExit(f"race_weather: {key}: {e}") from e
                time.sleep(15 * (attempt + 1))
        time.sleep(METEO_DELAY)
        daily = data["daily"]
        if daily["time"] != [day]:
            raise SystemExit(f"race_weather: {key}: asked for {day}, "
                             f"given {daily['time']}")
        values = [daily[v][0] for v in HV.WEATHER_MODEL_DAILY]
        if any(v is None for v in values):
            log.append(f"{key}\tNOT YET\tthe model holds no complete day for {day} "
                       "at this point yet")
            continue
        t_max, rain, hours, wind = values
        rows.append(f"{y}|{rnd}|{day}|{f1db_circuit}|{lat}|{lon}|"
                    f"{data['timezone']}|{t_max}|{rain}|{hours}|{wind}")
        if n % 100 == 0:
            print(f"race_weather: modelled, {n} of {len(races)}", file=sys.stderr)
    head = [
        f"# Generated by tools/race_weather.py modelled on {today}. Do not edit by hand.",
        "# Source: Open-Meteo's historical weather API (CC BY 4.0), model era5_seamless:",
        "# ERA5-Land, else ERA5, from the Copernicus Climate Change Service (CC BY 4.0).",
        f"# The point is F1DB's for the circuit of the layout raced ({release}, CC BY 4.0).",
        "# A reanalysis for that grid cell on the race's local day: modelled, not measured.",
        "# year|round|day|f1db_circuit|latitude|longitude|timezone|air_max_c|rain_mm|rain_hours|wind_max_kmh",
    ]
    return head + rows, [
        f"# Generated by tools/race_weather.py modelled on {today}. Do not edit by hand.",
        "# Every completed race the harvest holds no modelled weather for, and why.",
    ] + log


def f1db_release(path):
    """The release a checkout is at, as tools/f1db_fetch.py names one."""
    from tools import f1db_fetch
    version = f1db_fetch.release_at(path)
    return f"F1DB {version}"


def write(path, lines):
    with open(path, "w", encoding="utf-8", newline="\n") as f:
        f.write("\n".join(lines) + "\n")


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0].strip())
    ap.add_argument("half", choices=("reported", "modelled"))
    ap.add_argument("--db", default=DB)
    ap.add_argument("--f1db", default=F1DB_CACHE,
                    help="an F1DB checkout (default: tools/f1db_fetch.py's cache)")
    args = ap.parse_args()
    races = read_races(args.db)
    today = datetime.date.today().isoformat()
    if args.half == "reported":
        rows, log = harvest_reported(races, today)
        write(HV.WEATHER_REPORTED_FILE, rows)
        write(HV.WEATHER_REPORTED_LOG, log)
    else:
        points = f1db_points(args.f1db)
        rows, log = harvest_modelled(races, points, f1db_release(args.f1db), today)
        write(HV.WEATHER_MODELLED_FILE, rows)
        write(HV.WEATHER_MODELLED_LOG, log)
    print(f"race_weather: {args.half}, {sum(1 for r in rows if not r.startswith('#'))} "
          f"rows, {sum(1 for r in log if not r.startswith('#'))} logged")


if __name__ == "__main__":
    main()
