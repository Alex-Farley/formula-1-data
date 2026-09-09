/**
 * A traced circuit, turned into a lap you can walk.
 *
 * `circuit_geometry.centreline` is a GeoJSON MultiLineString: the ways of an
 * OpenStreetMap relation, in no particular order. Drawing it needs nothing
 * more than that — every segment is a line — but measuring along it, or
 * putting a marker a given distance round, needs the ways stitched end to end
 * into one ordered ring first.
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
 * The radius of the arc the track is following, in metres, at every point.
 *
 * WHY RADIUS AND NOT G-FORCE
 *     Lateral acceleration is v² / r, and this database holds no v. The lap
 *     tables are declared and empty: no telemetry, no speed trace, not even a
 *     speed-trap figure. So a g figure here would be a number invented from a
 *     speed nobody recorded, which is the one thing this project will not do.
 *
 *     Assuming a constant lateral limit would not rescue it either, and would
 *     be wrong in an interesting way: a wing car makes downforce in proportion
 *     to v², so its grip rises with speed and its sustainable g is not a
 *     constant of the car at all. A single figure applied across a lap would
 *     overstate the hairpins and understate the fast curves.
 *
 *     Radius is the honest half of that equation — the half the geometry
 *     actually contains. It is what a corner IS, independent of who drives it
 *     and what they drive, and it reads directly: 30 m is a hairpin, 500 m is
 *     a bend you would not lift for.
 *
 * The turn is measured across a window either side of each point rather than
 * between neighbouring nodes, because OSM node spacing is irregular and a
 * two-node angle is mostly a measure of how finely somebody traced that
 * stretch. `windowM` is the half-width in metres.
 *
 * A perfectly straight stretch has infinite radius; it is returned as
 * Infinity rather than clamped, so a caller bands it rather than being handed
 * a large number that looks measured.
 */
export function cornerRadius(ring, cum, windowM = 25) {
  const bearing = (a, b) => {
    const p1 = a[1] * RAD
    const p2 = b[1] * RAD
    const dl = (b[0] - a[0]) * RAD
    const y = Math.sin(dl) * Math.cos(p2)
    const x = Math.cos(p1) * Math.sin(p2) - Math.sin(p1) * Math.cos(p2) * Math.cos(dl)
    return Math.atan2(y, x) / RAD
  }

  const out = new Array(ring.length).fill(Infinity)
  let lo = 0
  let hi = 0
  for (let i = 0; i < ring.length; i += 1) {
    while (lo < i && cum[i] - cum[lo] > windowM) lo += 1
    while (hi < ring.length - 1 && cum[hi] - cum[i] < windowM) hi += 1
    // Near the end of the ring `hi` runs out of room and stops at i. bearing()
    // of a point against itself is 0, so the turn became the track's absolute
    // heading and every lap grew one fabricated hairpin at the start/finish.
    // A curvature sample needs a point on BOTH sides; without one there is
    // nothing to measure and Infinity (straight) is the honest answer.
    if (hi <= i || lo >= i || hi - lo < 2) continue
    const turn = (((bearing(ring[i], ring[hi]) - bearing(ring[lo], ring[i])) % 360) + 540) % 360 - 180
    const span = cum[hi] - cum[lo]
    // Degrees swept over the window, converted to the radius of the arc that
    // would sweep them: r = s / θ, with θ in radians.
    const radians = Math.abs(turn) * RAD
    out[i] = span > 0 && radians > 1e-9 ? span / radians : Infinity
  }
  return out
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
