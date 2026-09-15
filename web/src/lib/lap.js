/**
 * A traced circuit, turned into a lap that can be drawn and measured.
 *
 * `circuit_geometry.centreline` is a GeoJSON MultiLineString: the ways of an
 * OpenStreetMap relation, in no particular order. Drawing it needs nothing
 * more than that — every segment is a line — but measuring along it needs the
 * ways stitched end to end into one ordered ring first.
 *
 * build.py does the same analysis when the row is admitted and stores the
 * verdict (`closes`, `loose_ends`, `segment_count`); verify.py re-derives it
 * from the geometry on every build. So this module is not deciding anything —
 * it is reproducing a result the database already guarantees, and a caller can
 * check its own work against `measured_km`.
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

/**
 * Project a ring to metres east and south of its own centre.
 *
 * Every circuit ends up in the same units, which is what lets two of them be
 * drawn at one scale and compared honestly. Equirectangular with longitude
 * scaled by the cosine of the mid-latitude: over the couple of kilometres a
 * track spans that is indistinguishable from a proper projection.
 */
export function project(ring) {
  const lats = ring.map((p) => p[1])
  const lons = ring.map((p) => p[0])
  const lat0 = (Math.min(...lats) + Math.max(...lats)) / 2
  const lon0 = (Math.min(...lons) + Math.max(...lons)) / 2
  const k = Math.cos(lat0 * RAD)

  const x = lons.map((lon) => (lon - lon0) * k * RAD * EARTH_M)
  // SVG y grows downward, so north has to become negative.
  const y = lats.map((lat) => -(lat - lat0) * RAD * EARTH_M)

  const cum = [0]
  for (let i = 1; i < ring.length; i += 1) {
    cum.push(cum[i - 1] + metresBetween(ring[i - 1], ring[i]))
  }

  return {
    x,
    y,
    cum,
    length: cum[cum.length - 1],
    bounds: {
      x0: Math.min(...x),
      x1: Math.max(...x),
      y0: Math.min(...y),
      y1: Math.max(...y),
    },
  }
}

/**
 * Twice the signed area of a projected ring, by the shoelace formula.
 *
 * SVG's y grows downward, so a ring walked clockwise on screen comes out
 * POSITIVE here. That is the test for whether the stitched walk runs the way
 * the cars do: stitch() begins at whichever OpenStreetMap way happened to
 * come first and follows it in whichever direction that way was drawn, so
 * two of twenty-two closed traces walked backwards against the direction the
 * page stated beside them. The caller reverses the ring when the sign and
 * `circuits.direction` disagree.
 */
export function signedArea(shape) {
  let twice = 0
  for (let i = 0; i < shape.x.length - 1; i += 1) {
    twice += shape.x[i] * shape.y[i + 1] - shape.x[i + 1] * shape.y[i]
  }
  return twice
}

/** The point a given fraction of the way round, and the metres to reach it. */
export function pointAt(shape, fraction) {
  const want = Math.max(0, Math.min(1, fraction)) * shape.length
  let i = 1
  while (i < shape.cum.length - 1 && shape.cum[i] < want) i += 1
  const span = shape.cum[i] - shape.cum[i - 1] || 1
  const r = (want - shape.cum[i - 1]) / span
  return {
    x: shape.x[i - 1] + (shape.x[i] - shape.x[i - 1]) * r,
    y: shape.y[i - 1] + (shape.y[i] - shape.y[i - 1]) * r,
    metres: want,
  }
}

/** An SVG path through a run of projected points. */
export function pathOf(x, y, from = 0, to = x.length) {
  let d = `M${x[from].toFixed(1)},${y[from].toFixed(1)}`
  for (let i = from + 1; i < to; i += 1) d += `L${x[i].toFixed(1)},${y[i].toFixed(1)}`
  return d
}

/** The width, in screen pixels, a traced lap is drawn at — one line, one colour. */
export const LINE_WIDTH = 4

/** A square viewBox around a circuit's own extent. */
export function fitted(shape, pad = 40) {
  const { x0, x1, y0, y1 } = shape.bounds
  const w = x1 - x0 + pad * 2
  const h = y1 - y0 + pad * 2
  const side = Math.max(w, h)
  return `${x0 - pad - (side - w) / 2} ${y0 - pad - (side - h) / 2} ${side} ${side}`
}

/**
 * One traced circuit, ready to draw: the projected shape and its path.
 *
 * The stitched ring runs whichever way its first OpenStreetMap way was drawn;
 * where that disagrees with the direction the register states, the ring is
 * reversed so the drawing runs the way the cars do. The origin stays
 * arbitrary - no start/finish coordinate exists in either database.
 *
 * `row` is a circuit_geometry row joined to the circuit's `direction`; null
 * where the centreline cannot be stitched at all.
 */
export function buildLap(row) {
  const walk = stitch(row.centreline)
  if (!walk) return null
  let shape = project(walk.ring)
  if (walk.complete && row.direction) {
    const clockwise = signedArea(shape) > 0
    if (clockwise !== (row.direction === 'clockwise')) {
      walk.ring.reverse()
      shape = project(walk.ring)
    }
  }
  return {
    row,
    shape,
    complete: walk.complete,
    path: pathOf(shape.x, shape.y),
  }
}

/** The lap, as one path in body ink. Kept as an array for LapFigure to map over. */
export function runsFor(lap) {
  if (!lap) return []
  return [{ d: lap.path, stroke: 'var(--ink)', width: LINE_WIDTH }]
}
