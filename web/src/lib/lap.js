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

/**
 * Where each band of corner radius ends, in metres.
 *
 * These are the categories a corner falls into rather than quantiles of a
 * distribution, because a radius means something on its own: 30 m is a
 * hairpin whatever the rest of the lap looks like. They were checked against
 * the geometry before being fixed here — measured over all 7,224 sample
 * points of the 25 traced laps, the five bands take 14%, 17%, 25%, 20% and
 * 24% of the traced distance, so naming them costs nothing in how well the
 * picture reads.
 *
 *     < 50 m   hairpin
 *   50-100 m   slow corner
 *  100-200 m   medium
 *  200-400 m   fast
 *    > 400 m   straight or kink
 *
 * The ramp runs the other way from the bands: tightest gets the strongest
 * colour, because the corners are the subject and the straights are the rest.
 */
export const BANDS = [50, 100, 200, 400]
export const BAND_NAMES = ['hairpin', 'slow', 'medium', 'fast', 'straight']
export const bandIndex = (r) => {
  const i = BANDS.findIndex((edge) => r < edge)
  return i === -1 ? 4 : i
}
export const bandVar = (r) => `var(--seq-${5 - bandIndex(r)})`

/** A square viewBox around a circuit's own extent. */
export function fitted(shape, pad = 40) {
  const { x0, x1, y0, y1 } = shape.bounds
  const w = x1 - x0 + pad * 2
  const h = y1 - y0 + pad * 2
  const side = Math.max(w, h)
  return `${x0 - pad - (side - w) / 2} ${y0 - pad - (side - h) / 2} ${side} ${side}`
}

/**
 * One traced circuit, ready to draw: the projected shape, its path, and the
 * corner radius at every point where the trace closes.
 *
 * The stitched ring runs whichever way its first OpenStreetMap way was drawn;
 * where that disagrees with the direction the register states, the ring is
 * reversed so the walk runs the way the cars do. The origin stays arbitrary -
 * no start/finish coordinate exists in either database.
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
    // Colouring is only meaningful along an ordered lap; on a trace that does
    // not close, the walk stops early and the rest is unvisited.
    radius: walk.complete ? cornerRadius(walk.ring, shape.cum) : null,
  }
}

/**
 * One path per run of same-band points, so a 330-point lap draws as about
 * eighty paths rather than 330 - and the colour still changes exactly where
 * the radius crosses a band edge. Uncoloured, or without a radius, the lap is
 * one path in body ink.
 */
export function runsFor(lap, colour = true) {
  if (!lap) return []
  if (!colour || !lap.radius) return [{ d: lap.path, stroke: 'var(--ink)' }]
  const { x, y } = lap.shape
  const out = []
  let start = 0
  let current = bandVar(lap.radius[0])
  for (let i = 1; i <= x.length; i += 1) {
    const next = i < x.length ? bandVar(lap.radius[i]) : null
    if (next !== current) {
      out.push({ d: pathOf(x, y, start, Math.min(i + 1, x.length)), stroke: current })
      start = i
      current = next
    }
  }
  return out
}
