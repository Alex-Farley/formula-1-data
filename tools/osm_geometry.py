# -*- coding: utf-8 -*-
"""
Harvest circuit centrelines from OpenStreetMap, checked against the lengths
this database already holds.

    python3 tools/osm_geometry.py --resolve   # find Wikidata ids, check them
    python3 tools/osm_geometry.py             # fetch geometry for admitted ids

Reads:   data/circuits.py     CIRCUITS, LAYOUTS, and the admitted WIKIDATA map
Writes:  harvest/circuit_wikidata.txt  (--resolve) candidate ids and their checks
         harvest/circuit_geometry.txt  the accepted centrelines
         harvest/circuit_geometry.log  every circuit, and why it was refused

Not Overpass
------------
Every Overpass mirror tried - overpass-api.de, overpass.kumi.systems,
overpass.private.coffee - is unreachable from the environment this was
written in. The plain OSM API is not, so a circuit is addressed by its
*relation id* rather than by a bounding-box query. That is the better shape
anyway: a bbox returns whatever happens to be inside a rectangle, while a
relation id names one object and returns it reproducibly.

The relation id comes from Wikidata (P402), which is CC0 and places no
obligation on anything. Wikidata brokers the identifier; OSM supplies the
geometry; this database supplies the number that decides whether to keep it.

Why the length check is the whole point
---------------------------------------
A circuit relation is not an ordered ring. Its members include the pit lane,
and summing them naively double-counts. Monaco, relation 148194:

    all 42 member ways                    3.745 km   +12.2%
    excluding role=pit_lane (0.357 km)    3.388 km    +1.5%
    published, already in this database   3.337 km

A naive implementation stores 3.745 and is wrong by 408 metres, and nothing
about the number looks wrong on its own. What catches it is `length_km`,
which this database held before OSM was ever consulted. So the rule is:
exclude the pit lane, measure, compare, and refuse anything outside
tolerance rather than storing it with a caveat.

Geometry belongs to a layout, not to a circuit
----------------------------------------------
Monza 1955 is not Monza 2026, and `circuit_layouts` already keeps them apart
with their own lengths. OSM maps what is on the ground now, so a trace can
only ever be the CURRENT layout. Wikidata does model historic layouts as
separate entities - "Circuit de Monaco Grand Prix Circuit (1929-1972)" is
Q66712049, with its own length and date range - but those entities carry no
coordinates and no relation id. There is no geometry source for a layout that
no longer exists.

So a trace is attached to the layout that covers the present day where the
circuit has a layout timeline, and to the circuit alone where it does not.
Historic layouts get nothing, which is the correct answer rather than a gap.
"""
import argparse
import json
import math
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
HARVEST = os.path.join(ROOT, "harvest")
sys.path.insert(0, ROOT)

WD_API = "https://www.wikidata.org/w/api.php"
OSM_REL = "https://api.openstreetmap.org/api/0.6/relation/{}/full.json"
UA = ("formula-1-data/2.14 (https://github.com/Alex-Farley/formula-1-data; "
      "circuit centreline harvest)")

DELAY = 1.0

# Wikidata units for P2043 (length). Anything else and the stated length
# cannot be compared, so the candidate is refused rather than guessed at.
UNITS = {"Q11573": 0.001,      # metre
         "Q828224": 1.0,       # kilometre
         "Q253276": 1.609344}  # mile

# How far a measured or stated length may sit from the published figure.
# 2% accepts Monaco's pit-lane-excluded 3.388 against a published 3.337 and
# rejects the naive 3.745. It is deliberately not looser than that: the
# failure this guards against overshot by 12%.
TOLERANCE = 0.02

# The identity check on a Wikidata candidate is stated length and country.
# Length alone would admit any circuit of about the right size; country alone
# would admit any circuit in the right nation. Together they constrain which
# circuit the entity is, which is the thing being decided.
IDENT_TOLERANCE = 0.02

GEOM_COLUMNS = ["circuit_id", "layout_key", "wikidata_id", "osm_relation",
                "measured_km", "published_km", "delta_pct", "node_count",
                "osm_timestamp", "centreline"]


# ------------------------------------------------------------------ http

def _get(url, delay=DELAY, timeout=60):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    for attempt in range(6):
        try:
            with urllib.request.urlopen(req, timeout=timeout) as r:
                data = r.read()
            time.sleep(delay)
            return data
        except urllib.error.HTTPError as e:
            if e.code == 404:
                return None
            if e.code in (429, 503) and attempt < 5:
                time.sleep(5 * (attempt + 1))
                continue
            return None
        except Exception:
            if attempt < 5:
                time.sleep(5 * (attempt + 1))
                continue
            return None
    return None


def wd(**params):
    params.setdefault("format", "json")
    url = WD_API + "?" + urllib.parse.urlencode(params)
    raw = _get(url)
    return json.loads(raw.decode("utf-8")) if raw else {}


# ------------------------------------------------------------- geometry

def haversine(a, b):
    """Metres between two (lat, lon) pairs on the IUGG mean-radius sphere."""
    R = 6371008.8
    p1, p2 = math.radians(a[0]), math.radians(b[0])
    dp = p2 - p1
    dl = math.radians(b[1] - a[1])
    h = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * R * math.asin(math.sqrt(h))


def way_length(coords):
    return sum(haversine(coords[i], coords[i + 1])
               for i in range(len(coords) - 1))


def relation_geometry(relation_id):
    """(centreline, metres, node_count, timestamp) for an OSM circuit relation.

    The pit lane is excluded by member role. It is tagged highway=raceway like
    the track itself, so nothing about the way distinguishes it - only its
    role in the relation does, which is why this reads members rather than
    ways.
    """
    raw = _get(OSM_REL.format(relation_id))
    if raw is None:
        return None, 0.0, 0, None
    doc = json.loads(raw.decode("utf-8"))
    els = doc.get("elements", [])
    rels = [e for e in els if e["type"] == "relation"]
    if not rels:
        return None, 0.0, 0, None
    rel = rels[0]
    nodes = {e["id"]: (e["lat"], e["lon"]) for e in els if e["type"] == "node"}
    ways = {e["id"]: e for e in els if e["type"] == "way"}

    lines, total = [], 0.0
    for m in rel.get("members", []):
        if m["type"] != "way" or m.get("role") == "pit_lane":
            continue
        w = ways.get(m["ref"])
        if not w:
            continue
        coords = [nodes[n] for n in w["nodes"] if n in nodes]
        if len(coords) < 2:
            continue
        lines.append(coords)
        total += way_length(coords)

    if not lines:
        return None, 0.0, 0, None

    geo = {"type": "MultiLineString",
           # GeoJSON is lon,lat. Writing lat,lon here would put every circuit
           # in the wrong hemisphere and still measure the right length, so
           # nothing downstream would catch it.
           "coordinates": [[[round(lon, 6), round(lat, 6)]
                            for lat, lon in line] for line in lines]}
    n = sum(len(l) for l in lines)
    return geo, total, n, rel.get("timestamp")


# ------------------------------------------------------------- data side

def load_circuits():
    from data import circuits as C
    out = {}
    for row in C.CIRCUITS:
        out[row[0]] = {"id": row[0], "name": row[1], "official": row[2],
                       "country": row[4], "length_km": row[8],
                       "last_gp": row[7]}
    return out


def current_layout(circuit_id):
    """The layout_key covering the present day, or None if there is no timeline.

    A trace is only ever of what is on the ground now, so it may only be
    attached to a layout that is still current. A circuit whose timeline ends
    in the past gets no layout key and no geometry.
    """
    from data import circuits as C
    best = None
    for row in C.LAYOUTS:
        cid, key, name, frm, to = row[0], row[1], row[2], row[3], row[4]
        by_year = row[5] if len(row) > 5 else 1
        if cid != circuit_id or not by_year:
            continue
        if to is None:                       # open-ended: still in use
            return key
        if best is None or (frm or 0) > best[0]:
            best = ((frm or 0), key)
    return None                              # a closed timeline is historic


# -------------------------------------------------------------- resolve

def resolve():
    """Find a Wikidata entity for each circuit and check it. Writes candidates."""
    circuits = load_circuits()
    rows, log = [], []

    for cid, c in sorted(circuits.items()):
        terms = [t for t in (c["official"], c["name"]) if t]
        seen, best = [], None
        for term in terms:
            d = wd(action="wbsearchentities", search=term, language="en",
                   limit=5, type="item")
            for hit in d.get("search", []):
                if hit["id"] not in seen:
                    seen.append(hit["id"])
        if not seen:
            log.append(f"{cid}\tno Wikidata search hit")
            continue

        d = wd(action="wbgetentities", ids="|".join(seen[:10]),
               props="claims|labels", languages="en")
        countries = {}
        ents = d.get("entities", {})
        # Resolve country items to labels in one batch rather than per entity.
        cids = set()
        for e in ents.values():
            for cl in (e.get("claims", {}).get("P17") or []):
                v = cl["mainsnak"].get("datavalue", {}).get("value", {})
                if v.get("id"):
                    cids.add(v["id"])
        if cids:
            cd = wd(action="wbgetentities", ids="|".join(sorted(cids)),
                    props="labels", languages="en")
            for q, e in cd.get("entities", {}).items():
                countries[q] = e.get("labels", {}).get("en", {}).get("value")

        for qid in seen[:10]:
            e = ents.get(qid)
            if not e:
                continue
            claims = e.get("claims", {})
            label = e.get("labels", {}).get("en", {}).get("value")

            rel = None
            for cl in (claims.get("P402") or []):
                rel = cl["mainsnak"].get("datavalue", {}).get("value")

            stated_km, unit_ok = None, False
            for cl in (claims.get("P2043") or []):
                v = cl["mainsnak"].get("datavalue", {}).get("value", {})
                unit = (v.get("unit") or "").rsplit("/", 1)[-1]
                if unit in UNITS:
                    stated_km = abs(float(v["amount"])) * UNITS[unit]
                    unit_ok = True
                    break

            country = None
            for cl in (claims.get("P17") or []):
                v = cl["mainsnak"].get("datavalue", {}).get("value", {})
                country = countries.get(v.get("id"))
                break

            # The two identity checks. Both must pass.
            len_ok = (unit_ok and stated_km and c["length_km"]
                      and abs(stated_km - c["length_km"]) / c["length_km"]
                      <= IDENT_TOLERANCE)
            country_ok = (country or "").lower() == (c["country"] or "").lower()

            rows.append({
                "circuit_id": cid, "wikidata_id": qid, "label": label,
                "osm_relation": rel or "", "stated_km": stated_km or "",
                "our_km": c["length_km"], "country": country or "",
                "our_country": c["country"],
                "length_ok": int(bool(len_ok)),
                "country_ok": int(bool(country_ok)),
                "admissible": int(bool(len_ok and country_ok and rel)),
            })
        print(f"  {cid}: {len(seen)} candidates", flush=True)

    out = os.path.join(HARVEST, "circuit_wikidata.txt")
    cols = ["circuit_id", "wikidata_id", "label", "osm_relation", "stated_km",
            "our_km", "country", "our_country", "length_ok", "country_ok",
            "admissible"]
    with open(out, "w", encoding="utf-8") as f:
        f.write("# Generated by tools/osm_geometry.py --resolve on "
                + time.strftime("%Y-%m-%d") + ". Do not edit by hand.\n")
        f.write("# Source: Wikidata (CC0). CANDIDATES ONLY - an id is not "
                "used until it is admitted in data/circuits.py.\n")
        f.write("# admissible = the entity states a length matching ours, a "
                "country matching ours, and an OSM relation.\n")
        f.write("# " + "|".join(cols) + "\n")
        for r in rows:
            f.write("|".join(str(r[c]) for c in cols) + "\n")
    ok = sum(r["admissible"] for r in rows)
    print(f"\n{len(rows)} candidates, {ok} admissible, over "
          f"{len(circuits)} circuits")
    print(f"wrote {out}")


# --------------------------------------------------------------- harvest

def harvest():
    from data import circuits as C
    admitted = getattr(C, "WIKIDATA_CIRCUITS", {})
    if not admitted:
        raise SystemExit(
            "data/circuits.py has no WIKIDATA_CIRCUITS map. Run --resolve, "
            "read harvest/circuit_wikidata.txt, and admit the ids you accept.")

    circuits = load_circuits()
    rows, log = [], []

    for cid, qid in sorted(admitted.items()):
        c = circuits.get(cid)
        if not c:
            log.append(f"{cid}\tREFUSED\tnot a circuit in this database")
            continue

        d = wd(action="wbgetentities", ids=qid, props="claims")
        e = (d.get("entities") or {}).get(qid)
        if not e:
            log.append(f"{cid}\tREFUSED\tWikidata {qid} not found")
            continue
        rel = None
        for cl in (e.get("claims", {}).get("P402") or []):
            rel = cl["mainsnak"].get("datavalue", {}).get("value")
        if not rel:
            log.append(f"{cid}\tREFUSED\t{qid} states no OSM relation (P402)")
            continue

        geo, metres, nodes, ts = relation_geometry(rel)
        if geo is None:
            log.append(f"{cid}\tREFUSED\tOSM relation {rel} unreadable "
                       f"or has no member ways")
            continue

        layout_key = current_layout(cid)
        published = c["length_km"]
        # Where a layout timeline names the current configuration, its length
        # is the one to check against - it is the figure for the shape OSM
        # actually maps, and circuits.length_km may be a different era.
        if layout_key:
            for row in C.LAYOUTS:
                if row[0] == cid and row[1] == layout_key and row[6]:
                    published = row[6]
                    break
        if not published:
            log.append(f"{cid}\tREFUSED\tno published length to check against")
            continue

        measured = metres / 1000.0
        delta = (measured - published) / published
        if abs(delta) > TOLERANCE:
            log.append(f"{cid}\tREFUSED\tmeasured {measured:.3f} km against "
                       f"published {published:.3f} km, {delta * 100:+.1f}% "
                       f"- outside {TOLERANCE * 100:.0f}%")
            continue

        rows.append({
            "circuit_id": cid,
            "layout_key": layout_key or "",
            "wikidata_id": qid,
            "osm_relation": rel,
            "measured_km": round(measured, 4),
            "published_km": published,
            "delta_pct": round(delta * 100, 2),
            "node_count": nodes,
            "osm_timestamp": ts or "",
            "centreline": json.dumps(geo, separators=(",", ":")),
        })
        print(f"  {cid}: {measured:.3f} km vs {published:.3f} "
              f"({delta * 100:+.1f}%)", flush=True)

    out = os.path.join(HARVEST, "circuit_geometry.txt")
    with open(out, "w", encoding="utf-8") as f:
        f.write("# Generated by tools/osm_geometry.py on "
                + time.strftime("%Y-%m-%d") + ". Do not edit by hand.\n")
        f.write("# Source: OpenStreetMap via api.openstreetmap.org, "
                "ODbL 1.0. Relation ids from Wikidata (CC0).\n")
        f.write("# Pit lane excluded by member role. Every row was measured "
                "and checked against the published length before it was "
                "written.\n")
        f.write("# " + "|".join(GEOM_COLUMNS) + "\n")
        for r in rows:
            f.write("|".join(str(r[c]) for c in GEOM_COLUMNS) + "\n")

    with open(os.path.join(HARVEST, "circuit_geometry.log"), "w",
              encoding="utf-8") as f:
        f.write("# Every admitted circuit, and why it was refused.\n")
        for line in sorted(log):
            f.write(line + "\n")
        for r in rows:
            f.write(f"{r['circuit_id']}\tACCEPTED\trelation "
                    f"{r['osm_relation']}\t{r['measured_km']} km "
                    f"({r['delta_pct']:+}%)\n")

    print(f"\naccepted {len(rows)} of {len(admitted)} admitted circuits")
    print(f"refused  {len(log)}  (see harvest/circuit_geometry.log)")
    print(f"wrote {out}")


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[1])
    ap.add_argument("--resolve", action="store_true",
                    help="find and check Wikidata candidates, then stop")
    args = ap.parse_args()
    if args.resolve:
        resolve()
    else:
        harvest()


if __name__ == "__main__":
    main()
