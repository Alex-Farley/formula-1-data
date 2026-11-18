#!/usr/bin/env python3
"""
Fit a circuit's OpenStreetMap centreline to its aerial photograph (AF-96).

WHAT THIS IS
    The circuit page draws the track over the circuit's aerial photograph.
    The photographs are not georeferenced: a Commons SkySat file is a cropped,
    often rotated image with no corner coordinates. So each one is placed by
    this project, as its own derivation (source 18):

    1.  Points are given on the photograph that lie on the middle of the
        track, spread round the whole lap - pixels in the frame article_images
        stores (`width` x `height`), never a coordinate - by eye, or as the
        middle of the asphalt across the track at stations round it, found
        by a script outside the build (the comment over PHOTO_TRACE in
        data/harvest.py says which, and how). No point is given twice.
        They go into PHOTO_TRACE with that frame.
    2.  This script fits the affine transform that carries the centreline's
        longitudes and latitudes onto those pixels - iterative closest point,
        a similarity first from a sweep of rotations, then a full affine, with
        the stored transform as one more start where there is one - and
        prints it, with each point's distance from the fitted line.
    3.  The transform is pasted into PHOTO_TRACE beside its points. build.py
        measures every point's distance from the drawn line again, and drops
        the transform (the photograph is shown plain) where any is beyond
        PHOTO_TRACE_TOLERANCE_PX, or where a stretch of the lap lies further
        than PHOTO_TRACE_MAX_GAP from every point; verify.py checks what was
        stored.

    The fit is not run by the build: it is a search, and a search that lands
    somewhere slightly different on another machine would move the artefact.
    What the build runs is the check, which is arithmetic.

USE
    python3 tools/photo_trace.py monza          fit, and print the transform
    python3 tools/photo_trace.py --check        each stored transform's errors

Standard library only, like the build.
"""
import json
import math
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))

from data import harvest as HV  # noqa: E402

# Metres per degree, near enough for a fit that is then expressed in degrees:
# the metres only condition the search, and the stored transform maps
# degrees to pixels directly.
M_PER_DEG_LAT = 110_574.0
M_PER_DEG_LON_EQUATOR = 111_320.0


def centreline(circuit_id):
    """The circuit's centreline as the harvest holds it: a list of lines of
    (lon, lat)."""
    for g in HV.load_circuit_geometry():
        if g["circuit_id"] == circuit_id:
            return [[tuple(p) for p in line]
                    for line in json.loads(g["centreline"])["coordinates"]]
    raise SystemExit(f"{circuit_id}: no centreline in the harvest.")


def _solve(m, v):
    """Solve the small linear system m x = v by Gaussian elimination."""
    n = len(v)
    a = [row[:] + [v[i]] for i, row in enumerate(m)]
    for c in range(n):
        p = max(range(c, n), key=lambda r: abs(a[r][c]))
        a[c], a[p] = a[p], a[c]
        if abs(a[c][c]) < 1e-12:
            raise ValueError("singular")
        for r in range(n):
            if r != c:
                f = a[r][c] / a[c][c]
                for k in range(c, n + 1):
                    a[r][k] -= f * a[c][k]
    return [a[i][n] / a[i][i] for i in range(n)]


def _nearest(pt, segs):
    """The point on the polyline segments nearest pt, and its distance."""
    best, at = float("inf"), None
    px, py = pt
    for (ax, ay), (bx, by) in segs:
        dx, dy = bx - ax, by - ay
        L = dx * dx + dy * dy
        t = 0.0 if L == 0 else max(0.0, min(1.0, ((px - ax) * dx + (py - ay) * dy) / L))
        qx, qy = ax + t * dx, ay + t * dy
        d = (px - qx) ** 2 + (py - qy) ** 2
        if d < best:
            best, at = d, (qx, qy, t)
    return math.sqrt(best), at


def _similarity(src, dst):
    """Least-squares x' = s R x + t from src to dst (no reflection)."""
    n = len(src)
    mx = sum(p[0] for p in src) / n
    my = sum(p[1] for p in src) / n
    ux = sum(p[0] for p in dst) / n
    uy = sum(p[1] for p in dst) / n
    sxx = sxy = ss = 0.0
    for (x, y), (u, v) in zip(src, dst):
        x, y, u, v = x - mx, y - my, u - ux, v - uy
        sxx += x * u + y * v
        sxy += x * v - y * u
        ss += x * x + y * y
    a, b = sxx / ss, sxy / ss          # s cos, s sin
    return (a, -b, ux - a * mx + b * my, b, a, uy - b * mx - a * my)


def _affine(src, dst):
    """Least-squares x' = A x + t from src to dst."""
    m = [[0.0] * 3 for _ in range(3)]
    vx = [0.0] * 3
    vy = [0.0] * 3
    for (x, y), (u, v) in zip(src, dst):
        r = (x, y, 1.0)
        for i in range(3):
            for j in range(3):
                m[i][j] += r[i] * r[j]
            vx[i] += r[i] * u
            vy[i] += r[i] * v
    a, b, c = _solve(m, vx)
    d, e, f = _solve(m, vy)
    return (a, b, c, d, e, f)


def _apply(t, x, y):
    return (t[0] * x + t[1] * y + t[2], t[3] * x + t[4] * y + t[5])


def _icp(points, local, t, fit, rounds):
    """Iterate closest-point correspondences: return the transform, the rms."""
    rms = float("inf")
    for _ in range(rounds):
        segs = []
        for line in local:
            q = [_apply(t, x, y) for x, y in line]
            segs.extend(zip(q, q[1:]))
        src = []
        err = 0.0
        for p in points:
            d, (qx, qy, _) = _nearest(p, segs)
            err += d * d
            # Carry the image-space foot back to the local frame through the
            # current transform's inverse, so the next fit has pairs.
            a, b, c, dd, e, f = t
            det = a * e - b * dd
            x = (e * (qx - c) - b * (qy - f)) / det
            y = (-dd * (qx - c) + a * (qy - f)) / det
            src.append((x, y))
        new_rms = math.sqrt(err / len(points))
        t = fit(src, points)
        if abs(rms - new_rms) < 1e-6:
            rms = new_rms
            break
        rms = new_rms
    return t, rms


def fit(points, lines, seed=None):
    """The affine transform carrying (lon, lat) onto the points' pixels.

    `seed`, a transform in the stored form, is one more start for the search
    beside the sweep of rotations, so a re-run after the points change keeps
    the stored placing where it still fits best. A stored transform is then
    a fixed point of this script - a re-run on its points prints it again -
    and not always what the sweep alone would find: on Paul Ricard's points
    the sweep alone lands in a worse fit (3.81 px worst, against 0.89 px).

    Returned in the stored form: {"origin": [lon0, lat0], "x": [a, b, c],
    "y": [d, e, f]}, meaning x = a (lon - lon0) + b (lat - lat0) + c, and y
    likewise - pixels in the photograph's stored frame, y downwards.
    """
    lon0 = round(sum(p[0] for ln in lines for p in ln) / sum(len(ln) for ln in lines), 6)
    lat0 = round(sum(p[1] for ln in lines for p in ln) / sum(len(ln) for ln in lines), 6)
    kx = M_PER_DEG_LON_EQUATOR * math.cos(math.radians(lat0))
    ky = M_PER_DEG_LAT
    # East and SOUTH in metres, so an unmirrored photograph is a rotation of
    # this frame, never a reflection.
    local = [[((lon - lon0) * kx, -(lat - lat0) * ky) for lon, lat in ln] for ln in lines]
    flat = [p for ln in local for p in ln]
    cx = sum(p[0] for p in flat) / len(flat)
    cy = sum(p[1] for p in flat) / len(flat)
    rl = math.sqrt(sum((p[0] - cx) ** 2 + (p[1] - cy) ** 2 for p in flat) / len(flat))
    ux = sum(p[0] for p in points) / len(points)
    uy = sum(p[1] for p in points) / len(points)
    rp = math.sqrt(sum((p[0] - ux) ** 2 + (p[1] - uy) ** 2 for p in points) / len(points))
    tries = []
    for deg in range(0, 360, 5):
        th = math.radians(deg)
        s = rp / rl
        a, b = s * math.cos(th), s * math.sin(th)
        t0 = (a, -b, ux - a * cx + b * cy, b, a, uy - b * cx - a * cy)
        t, rms = _icp(points, local, t0, _similarity, 12)
        tries.append((rms, deg, t))
    tries.sort()
    starts = [t for _, _, t in tries[:4]]
    if seed and tuple(seed["origin"]) == (lon0, lat0):
        (sa, sb, sc), (sd, se, sf) = seed["x"], seed["y"]
        starts.append((sa / kx, -sb / ky, sc, sd / kx, -se / ky, sf))
    best = None
    for t in starts:
        t, rms = _icp(points, local, t, _similarity, 60)
        t, rms = _icp(points, local, t, _affine, 200)
        if best is None or rms < best[0]:
            best = (rms, t)
    a, b, c, d, e, f = best[1]
    return {"origin": [lon0, lat0],
            "x": [round(a * kx, 3), round(-b * ky, 3), round(c, 3)],
            "y": [round(d * kx, 3), round(-e * ky, 3), round(f, 3)]}


def report(cid, entry, lines):
    errors = HV.photo_trace_errors(entry["transform"], entry["points"], lines)
    worst = max(errors)
    print(f"{cid}: {len(errors)} points, worst {worst:.2f} px, "
          f"rms {math.sqrt(sum(e * e for e in errors) / len(errors)):.2f} px "
          f"(tolerance {HV.PHOTO_TRACE_TOLERANCE_PX} px)")
    print("  " + " ".join(f"{i}:{e:.1f}" for i, e in enumerate(errors)))


def main(argv):
    if argv and argv[0] == "--check":
        for cid, entry in sorted(HV.PHOTO_TRACE.items()):
            report(cid, entry, centreline(cid))
        return 0
    if len(argv) != 1:
        print(__doc__)
        return 2
    cid = argv[0]
    entry = HV.PHOTO_TRACE.get(cid)
    if not entry:
        raise SystemExit(f"{cid}: no points in data/harvest.py PHOTO_TRACE.")
    lines = centreline(cid)
    t = fit([tuple(p) for p in entry["points"]], lines, entry.get("transform"))
    print(json.dumps(t))
    report(cid, {**entry, "transform": t}, lines)
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
