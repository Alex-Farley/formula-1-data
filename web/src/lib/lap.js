/**
 * The weekend as a lap (AF-156): the next round's sessions as stops spaced
 * evenly round its circuit's outline, in the order they are run, and the
 * track drawn in as each one starts. Shared by the app (components/
 * Outline.jsx's WeekendLap) and scripts/prerender.js, which draw the same
 * marks from the same layout at their own clocks - the reader's, and the
 * build's day - so what the static page prints is what the app would at that
 * clock, and only the marks' state changes when the app takes over.
 *
 * The outline is F1DB's drawing (lib/outline.js): no scale, no start line,
 * no direction of travel. So the stops are spaced by order, not by time, and
 * counted from wherever the drawing's path begins, and LAP_NOTE says both
 * under every lap. A round with no drawing - none named, or one this
 * module cannot read - is laid out on a plain strip of stops instead, with
 * the same rule: the race closes it.
 *
 * Nothing here reads a clock of its own: `clock` is given, in milliseconds,
 * so units.mjs holds every state on fixed clocks.
 */
import { outlineLabel } from './outline.js'

/** A session's place on the lap: started, the next to start, or to come. */
export const LAP_RUN = 'run'
export const LAP_NEXT = 'next'
export const LAP_TO_COME = 'to-come'

/** The words a reader is given for each, in the list beside the lap. */
export const LAP_WORDS = { [LAP_RUN]: 'started', [LAP_NEXT]: 'next', [LAP_TO_COME]: 'to come' }

/** The strip a round with no drawing is laid out on: a line across a short box. */
export const STRIP_VIEWBOX = '0 0 500 48'
export const STRIP_PATH = 'M24 24H476'

/** A stop's radius, and the next one's, in the drawing's 500-unit box. */
export const STOP_R = 11
export const NEXT_R = 14

/** Under the lap: what the spacing and the start are, and are not. */
export const LAP_NOTE =
  'The weekend’s sessions in the order they are run, spaced evenly round the outline from where F1DB’s drawing begins, and drawn in as each one starts: the spacing is not time, and the drawing has no start line or direction.'

/** Under the strip, for a round with no drawing. */
export const STRIP_NOTE = 'The weekend’s sessions in the order they are run, drawn in as each one starts. No outline of this round’s layout is held.'

/** Before the next session's name, in the words under the lap. */
export const NEXT_WORD = 'Next: '

/** The words under the lap once every session has started. */
export const ALL_STARTED = 'Every session has started'

const NUMBER = /[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/y
const COMMAND = /[MmLlHhVvCcSsQqTtAaZz]/

/**
 * An SVG path as polylines, one per subpath: lines kept, curves and arcs cut
 * into `steps` chords each, which at F1DB's sizes puts a stop within a
 * fraction of a unit of the curve it sits on. Every command SVG has is read,
 * flags written without separators ("a7 7 0 011 2") included, since F1DB's
 * paths are minified. Throws on anything else, which lapLayout() turns into
 * the strip.
 */
export function flatten(d, steps = 12) {
  const s = String(d ?? '')
  const runs = []
  let run = null
  let i = 0
  let x = 0
  let y = 0
  let startX = 0
  let startY = 0
  // The last control point, for S and T, and the command that set it.
  let ctrlX = 0
  let ctrlY = 0
  let last = ''

  const skip = () => {
    while (i < s.length && (s[i] === ',' || s[i] === ' ' || s[i] === '\n' || s[i] === '\t' || s[i] === '\r')) i++
  }
  const num = () => {
    skip()
    NUMBER.lastIndex = i
    const m = NUMBER.exec(s)
    if (!m) throw new Error(`lap.js: no number at ${i} of the path`)
    i = NUMBER.lastIndex
    return Number(m[0])
  }
  const flag = () => {
    skip()
    const c = s[i]
    if (c !== '0' && c !== '1') throw new Error(`lap.js: no arc flag at ${i} of the path`)
    i++
    return c === '1'
  }
  const more = () => {
    skip()
    return i < s.length && /[-+.\d]/.test(s[i])
  }
  const lineTo = (nx, ny) => {
    if (!run) {
      run = [[x, y]]
      runs.push(run)
    }
    run.push([nx, ny])
    x = nx
    y = ny
  }
  const cubic = (x1, y1, x2, y2, ex, ey) => {
    const [x0, y0] = [x, y]
    for (let k = 1; k <= steps; k++) {
      const t = k / steps
      const u = 1 - t
      lineTo(
        u * u * u * x0 + 3 * u * u * t * x1 + 3 * u * t * t * x2 + t * t * t * ex,
        u * u * u * y0 + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t * t * t * ey,
      )
    }
    ctrlX = x2
    ctrlY = y2
  }
  const quadratic = (x1, y1, ex, ey) => {
    const [x0, y0] = [x, y]
    for (let k = 1; k <= steps; k++) {
      const t = k / steps
      const u = 1 - t
      lineTo(u * u * x0 + 2 * u * t * x1 + t * t * ex, u * u * y0 + 2 * u * t * y1 + t * t * ey)
    }
    ctrlX = x1
    ctrlY = y1
  }
  // SVG 1.1 appendix F.6.5: from the endpoints to the centre, then chords.
  const arc = (rx0, ry0, degrees, large, sweep, ex, ey) => {
    const [x1, y1] = [x, y]
    if (x1 === ex && y1 === ey) return
    let rx = Math.abs(rx0)
    let ry = Math.abs(ry0)
    if (!rx || !ry) {
      lineTo(ex, ey)
      return
    }
    const phi = (degrees * Math.PI) / 180
    const cos = Math.cos(phi)
    const sin = Math.sin(phi)
    const dx = (x1 - ex) / 2
    const dy = (y1 - ey) / 2
    const xp = cos * dx + sin * dy
    const yp = -sin * dx + cos * dy
    const lambda = (xp * xp) / (rx * rx) + (yp * yp) / (ry * ry)
    if (lambda > 1) {
      rx *= Math.sqrt(lambda)
      ry *= Math.sqrt(lambda)
    }
    const num2 = rx * rx * ry * ry - rx * rx * yp * yp - ry * ry * xp * xp
    const den = rx * rx * yp * yp + ry * ry * xp * xp
    const co = (large === sweep ? -1 : 1) * Math.sqrt(Math.max(0, num2 / den))
    const cxp = (co * rx * yp) / ry
    const cyp = (-co * ry * xp) / rx
    const cx = cos * cxp - sin * cyp + (x1 + ex) / 2
    const cy = sin * cxp + cos * cyp + (y1 + ey) / 2
    const angle = (ux, uy, vx, vy) => Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy)
    const ux = (xp - cxp) / rx
    const uy = (yp - cyp) / ry
    const theta = angle(1, 0, ux, uy)
    let delta = angle(ux, uy, (-xp - cxp) / rx, (-yp - cyp) / ry)
    if (!sweep && delta > 0) delta -= 2 * Math.PI
    if (sweep && delta < 0) delta += 2 * Math.PI
    for (let k = 1; k < steps; k++) {
      const t = theta + (delta * k) / steps
      lineTo(cos * rx * Math.cos(t) - sin * ry * Math.sin(t) + cx, sin * rx * Math.cos(t) + cos * ry * Math.sin(t) + cy)
    }
    lineTo(ex, ey)
  }

  for (;;) {
    skip()
    if (i >= s.length) break
    const c = s[i]
    if (!COMMAND.test(c)) throw new Error(`lap.js: no command at ${i} of the path`)
    i++
    const rel = c !== c.toUpperCase()
    const ox = () => (rel ? x : 0)
    const oy = () => (rel ? y : 0)
    let op = c.toUpperCase()
    if (op === 'Z') {
      if (run) lineTo(startX, startY)
      run = null
      x = startX
      y = startY
      last = 'Z'
      continue
    }
    do {
      if (op === 'M') {
        x = num() + ox()
        y = num() + oy()
        startX = x
        startY = y
        run = null
        // A moveto's further pairs are linetos (SVG 1.1 section 8.3.2).
        op = 'L'
        last = 'M'
        continue
      }
      if (op === 'L') {
        const nx = num() + ox()
        lineTo(nx, num() + oy())
      } else if (op === 'H') {
        lineTo(num() + ox(), y)
      } else if (op === 'V') {
        lineTo(x, num() + oy())
      } else if (op === 'C') {
        const [ax, ay, bx, by] = [num() + ox(), num() + oy(), num() + ox(), num() + oy()]
        cubic(ax, ay, bx, by, num() + ox(), num() + oy())
      } else if (op === 'S') {
        const [ax, ay] = last === 'C' || last === 'S' ? [2 * x - ctrlX, 2 * y - ctrlY] : [x, y]
        const [bx, by] = [num() + ox(), num() + oy()]
        cubic(ax, ay, bx, by, num() + ox(), num() + oy())
      } else if (op === 'Q') {
        const [ax, ay] = [num() + ox(), num() + oy()]
        quadratic(ax, ay, num() + ox(), num() + oy())
      } else if (op === 'T') {
        const [ax, ay] = last === 'Q' || last === 'T' ? [2 * x - ctrlX, 2 * y - ctrlY] : [x, y]
        quadratic(ax, ay, num() + ox(), num() + oy())
      } else if (op === 'A') {
        const [rx, ry, degrees] = [num(), num(), num()]
        const [large, sweep] = [flag(), flag()]
        arc(rx, ry, degrees, large, sweep, num() + ox(), num() + oy())
      }
      last = op
    } while (more())
  }
  return runs.filter((r) => r.length > 1)
}

/** Each chord of the polylines, with the distance along the drawing at which it starts. */
function chords(runs) {
  const out = []
  let total = 0
  runs.forEach((run, r) => {
    for (let k = 1; k < run.length; k++) {
      const [ax, ay] = run[k - 1]
      const [bx, by] = run[k]
      const length = Math.hypot(bx - ax, by - ay)
      out.push({ r, a: run[k - 1], b: run[k], from: total, length })
      total += length
    }
  })
  return { list: out, total }
}

const round = (v) => Math.round(v * 10) / 10

/** The point `share` (0 to 1) of the way along the drawing. */
function pointAt({ list, total }, share) {
  const at = Math.min(Math.max(share, 0), 1) * total
  const chord = list.find((c) => at <= c.from + c.length) ?? list[list.length - 1]
  const t = chord.length ? (at - chord.from) / chord.length : 0
  return [round(chord.a[0] + (chord.b[0] - chord.a[0]) * t), round(chord.a[1] + (chord.b[1] - chord.a[1]) * t)]
}

/**
 * The drawing from its start to `share` of the way along, as path data, a
 * subpath of its own for each subpath crossed; null for none of it.
 */
function partPath({ list, total }, share) {
  if (share <= 0 || !list.length) return null
  const at = Math.min(share, 1) * total
  const parts = []
  let r = -1
  for (const chord of list) {
    if (chord.from >= at) break
    if (chord.r !== r) {
      parts.push(`M${round(chord.a[0])} ${round(chord.a[1])}`)
      r = chord.r
    }
    const end = chord.from + chord.length
    const b =
      end <= at
        ? chord.b
        : [chord.a[0] + ((chord.b[0] - chord.a[0]) * (at - chord.from)) / chord.length, chord.a[1] + ((chord.b[1] - chord.a[1]) * (at - chord.from)) / chord.length]
    parts.push(`L${round(b[0])} ${round(b[1])}`)
  }
  return parts.join('')
}

/**
 * The lap at `clock`: one stop per session, the k-th of n at k/n of the way
 * round, so the race - the last session - closes the lap where the drawing
 * began; each stop's state; the part of the track drawn in, from the start
 * to the last session started; and the next session to start, or null once
 * every one has.
 *
 * `path` is the outline, or null for the strip. A session counts as started
 * from its `start_utc`: the database holds no session's length, so "run"
 * means begun, and the words beside the lap say "started".
 *
 * Null where there are no sessions: a weekend with no timetable has nothing
 * to lay round it, and the panel keeps its words.
 */
export function lapLayout(path, sessions, clock) {
  const list = sessions ?? []
  if (!list.length) return null
  let runs = null
  if (path) {
    try {
      runs = flatten(path)
    } catch {
      runs = null
    }
  }
  const strip = !runs?.length
  const along = chords(strip ? flatten(STRIP_PATH) : runs)
  if (!along.total) return null
  const starts = list.map((s) => Date.parse(s.start_utc ?? ''))
  const started = starts.map((t) => Number.isFinite(t) && clock >= t)
  const ran = started.lastIndexOf(true) + 1
  const nextAt = started.findIndex((done, k) => !done && Number.isFinite(starts[k]) && k >= ran)
  const n = list.length
  return {
    strip,
    viewBox: strip ? STRIP_VIEWBOX : null,
    total: n,
    ran,
    next: nextAt === -1 ? null : list[nextAt],
    run: partPath(along, ran / n),
    stops: list.map((s, k) => {
      const [x, y] = pointAt(along, (k + 1) / n)
      const state = k < ran ? LAP_RUN : k === nextAt ? LAP_NEXT : LAP_TO_COME
      return { key: s.kind, name: s.name, x, y, state, r: state === LAP_NEXT ? NEXT_R : STOP_R }
    }),
  }
}

/** The lap's accessible name: the outline's, and where the weekend stands. */
export function lapLabel(circuit, layoutId, lap) {
  const where =
    lap.ran === 0
      ? 'none has started'
      : lap.ran === lap.total
        ? 'every one has started'
        : `${lap.ran} of them started${lap.next ? `, ${lap.next.name} next` : ''}`
  const what = `the weekend’s ${lap.total} session${lap.total === 1 ? '' : 's'}`
  return lap.strip
    ? `A strip of ${what}, in order: ${where}`
    : `${outlineLabel(circuit, layoutId)}, with ${what} marked round it in order: ${where}`
}
