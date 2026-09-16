/**
 * A traced circuit, measured the way the build measures it.
 *
 * `circuit_geometry.centreline` is a GeoJSON MultiLineString: the ways of an
 * OpenStreetMap relation, in no particular order. Measuring along it needs
 * the ways stitched end to end into one ordered ring first.
 *
 * build.py does the same analysis when the row is admitted and stores the
 * verdict (`closes`, `loose_ends`, `segment_count`); verify.py re-derives it
 * from the geometry on every build. So this module is not deciding anything —
 * it is a second implementation of a result the database already guarantees,
 * and units.mjs pins its metre to the figure build.py's own haversine returns.
 * The two are deliberately separate: the point of re-measuring is to check the
 * arithmetic, not to share it.
 *
 * It drew, until AF-23 made F1DB's outline the picture of a circuit and left
 * the trace as the measurement beside it. What the pages print now is what the
 * build measured — `measured_km` against `published_km`, `closes`,
 * `loose_ends` — so the projection, the path and the fitted box went with the
 * drawing they existed for.
 */

const EARTH_M = 6371008.8
const RAD = Math.PI / 180

/** Great-circle metres between two [lon, lat] points. */
export function metresBetween(a, b) {
  const p1 = a[1] * RAD
  const p2 = b[1] * RAD
  const dp = p2 - p1
  const dl = (b[0] - a[0]) * RAD
  const h =
    Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2
  return 2 * EARTH_M * Math.asin(Math.sqrt(h))
}

/**
 * Walk the ways end to end into a single ordered ring.
 *
 * The one-metre join is not a fudge factor: ways in a relation share their
 * junction nodes exactly, so a real join measures 0.000 m. Across the 25
 * traces held here only seven way ends are further than a metre from another,
 * and each of those is a genuine hole — the smallest is 5.4 m. A looser
 * tolerance stops measuring the same thing: at 30 m two broken traces read as
 * whole. The figure is the same one build.py uses.
 */
export function stitch(centreline, joinM = 1) {
  let lines
  try {
    const geo = typeof centreline === 'string' ? JSON.parse(centreline) : centreline
    lines = geo?.coordinates
  } catch {
    return null
  }
  if (!Array.isArray(lines) || lines.length === 0) return null

  const near = (a, b) => metresBetween(a, b) <= joinM
  const used = new Array(lines.length).fill(false)
  const ring = [...lines[0]]
  used[0] = true

  for (;;) {
    const tail = ring[ring.length - 1]
    let step = null
    for (let i = 0; i < lines.length && !step; i += 1) {
      if (used[i]) continue
      if (near(tail, lines[i][0])) step = [i, lines[i]]
      else if (near(tail, lines[i][lines[i].length - 1])) step = [i, [...lines[i]].reverse()]
    }
    if (!step) break
    used[step[0]] = true
    ring.push(...step[1].slice(1))
  }

  const walked = used.filter(Boolean).length
  return {
    ring,
    ways: lines.length,
    walked,
    complete: walked === lines.length && near(ring[0], ring[ring.length - 1]),
  }
}
