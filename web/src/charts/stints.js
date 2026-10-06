/**
 * Stint windows (PD-56): each driver's race, split at their pit stops.
 *
 * The geometry only, as plain numbers and strings, so that both renderers
 * draw the one picture - charts/Stints.jsx in the app and stintsSvg() in
 * scripts/prerender.js - as grid to flag (charts/gridFlag.js) is drawn.
 *
 * WHAT IT DRAWS
 *     One bar per driver who started and has a lap count: from lap 0 to the
 *     last lap they completed, split at the end of each lap they stopped on,
 *     with a tick at the stop. The bars are in the classification's order -
 *     finishers by position, then everyone else by how far they got - so a
 *     retirement's bar stops short where it went out, and ends on a cross.
 *
 * WHAT IT DOES NOT
 *     `pit_stops` holds the lap of each stop (F1DB, from 1994) and nothing
 *     else: its two duration columns are empty because F1DB publishes none,
 *     and lap times and running order are FOM's, which `laps` stays empty
 *     of for licence reasons (docs/TIMING-ARCHITECTURE.md). So the bars say
 *     when each driver stopped and nothing about what a stop gained or
 *     lost, and the pit order beside them (pitPairs) is an order of events.
 *     No wording here may say "undercut" or anything else that needs timing.
 *
 * A stop recorded on the lap a driver retired on - they came in and did not
 * go out again - falls after the last lap they completed, and is marked at
 * the end of their bar rather than past it; the table says the lap.
 */
import { classificationOrder, missing, result } from '../lib/format.js'
import { NOT_STARTED, crossPath, driverLabels, textWidth } from './gridFlag.js'
import { linear, ticks } from './scales.js'

/** The words drawn inside the figure, which both renderers print. */
export const STINT_HEADS = { axis: 'Lap' }

/** The width the static page draws at, and the app's before it has measured. */
export const STINTS_WIDTH = 640

const ROW = 16
const BAR = 8
const TOP = 6
const BOTTOM = 38
const RIGHT = 16
const GAP = 8
// Between a result and its name.
const SPACE = 6
// Half the break in a bar at a stop, so a stint reads as its own piece.
const BREAK = 1

const round = (value) => Math.round(value * 10) / 10

/** Whether an entry has a bar: it started, and its laps are recorded. */
export const barOf = (entry) => !missing(entry.laps_completed) && !NOT_STARTED.has(entry.position_text)

/** Each driver's stop laps, in stop order, keyed by driver. */
const stopLaps = (pits) => {
  const laps = new Map()
  for (const stop of [...pits].sort((a, b) => a.stop_number - b.stop_number || a.lap_number - b.lap_number)) {
    if (missing(stop.lap_number)) continue
    const list = laps.get(stop.driver_id) ?? []
    list.push(stop.lap_number)
    laps.set(stop.driver_id, list)
  }
  return laps
}

/**
 * The drivers drawn, in the order they ended, each with their stop laps -
 * an empty list for a driver with none, which is a driver who did not stop
 * in a race whose stops are recorded.
 */
export function stintRows(entries, pits) {
  const laps = stopLaps(pits)
  return entries
    .filter(barOf)
    .sort((a, b) => classificationOrder(a) - classificationOrder(b))
    .map((entry) => ({ entry, stops: laps.get(entry.driver_id) ?? [], out: missing(entry.finish_position) }))
}

/** Whether a race has a figure to draw: a stop recorded, two drivers, and a lap between them. */
export const stintsShown = (rows) =>
  rows.length >= 2 && rows.some((r) => r.stops.length > 0) && Math.max(...rows.map((r) => r.entry.laps_completed)) > 0

/** Stops recorded on the lap a driver went out on, after the last lap they completed. */
export const lateStops = (rows) => rows.filter((r) => r.stops.some((lap) => lap > r.entry.laps_completed))

/**
 * Entries in the figure's table that are not drawn: they started and have a
 * stop recorded, and no lap count - a car disqualified after the race, which
 * F1DB records without one.
 */
export const unbarredOf = (entries, pits) => {
  const laps = stopLaps(pits)
  return entries.filter((e) => !barOf(e) && !NOT_STARTED.has(e.position_text) && laps.has(e.driver_id))
}

/**
 * The figure's numbers: every driver it draws and every one it cannot with
 * a stop recorded, in the classification's order, with how many times each
 * stopped and on which laps. `stops` is a count over the race's stops, so a
 * driver with none stopped no times.
 */
export function stintTableRows(entries, pits) {
  const laps = stopLaps(pits)
  const unbarred = new Set(unbarredOf(entries, pits))
  return entries
    .filter((e) => barOf(e) || unbarred.has(e))
    .sort((a, b) => classificationOrder(a) - classificationOrder(b))
    .map((entry) => {
      const list = laps.get(entry.driver_id) ?? []
      return { ...entry, stops: list.length, stop_laps: list.join(', ') }
    })
}

/**
 * The figure at `width`, or null where there is nothing to draw. The labels
 * are on the left - the result, then the name, chosen as grid to flag
 * chooses its own (driverLabels) - and lap 0 is where they end.
 */
export function stintLayout(entries, pits, width = STINTS_WIDTH) {
  const rows = stintRows(entries, pits)
  if (!stintsShown(rows)) return null
  const laps = Math.max(...rows.map((r) => r.entry.laps_completed))

  const resultWidth = Math.max(...rows.map((r) => textWidth(result(r.entry))))
  const reserved = resultWidth + SPACE + GAP
  const names = driverLabels(
    rows.map((r) => r.entry),
    width,
    reserved,
  )
  const left = reserved + Math.max(...names.map(textWidth))
  const x = linear([0, laps], [left, width - RIGHT])
  const y = (slot) => TOP + slot * ROW + ROW / 2
  const plotBottom = TOP + rows.length * ROW

  return {
    width,
    height: plotBottom + BOTTOM,
    laps,
    start: round(x(0)),
    finish: round(x(laps)),
    top: TOP,
    bottom: plotBottom,
    resultX: round(resultWidth),
    nameX: round(resultWidth + SPACE),
    bar: BAR,
    ticks: ticks([0, laps], Math.max(2, Math.floor((x(laps) - x(0)) / 70)), { integer: true }).map((value) => ({
      value,
      x: round(x(value)),
    })),
    tickY: plotBottom + 14,
    axisY: plotBottom + 30,
    cars: rows.map((r, i) => {
      const done = r.entry.laps_completed
      const cuts = r.stops.map((lap) => Math.min(lap, done))
      // The laps between stops, leaving out an empty one - the stint after a
      // stop on the last lap - so the bar still runs to its end and is
      // broken only where one stint meets the next.
      const bounds = [0, ...cuts, done]
      const pieces = bounds.slice(1).map((to, k) => [bounds[k], to]).filter(([from, to]) => to > from)
      const stints = pieces
        .map(([from, to], k) => [x(from) + (k > 0 ? BREAK : 0), x(to) - (k < pieces.length - 1 ? BREAK : 0)])
        .filter(([x1, x2]) => x2 > x1)
        .map(([x1, x2]) => ({ x: round(x1), width: round(x2 - x1) }))
      const cy = y(i)
      return {
        key: r.entry.id ?? r.entry.driver_id,
        out: r.out,
        y: round(cy),
        barY: round(cy - BAR / 2),
        stints,
        stops: cuts.map((lap) => round(x(lap))),
        end: round(x(done)),
        // A car the result does not classify ends on a cross, clear of its bar.
        cross: r.out ? crossPath(x(done) + 6, cy) : null,
        result: result(r.entry),
        name: names[i],
      }
    }),
  }
}

/* --------------------------------------------------------------- pit order */

/**
 * Who stopped first, between drivers who started or finished next to each
 * other (PD-56, part 2): pairs of classified drivers with a numbered grid
 * slot and a stop recorded each, whose grid slots or finishing places are
 * consecutive. Each pair is in grid order - the one who started ahead first
 * - so the result column reads as what became of that order.
 *
 * It is the order of events and no more. The record holds the lap each
 * stop was made on, not how long it took or a lap time either side of it,
 * so nothing here can say whether stopping first won or lost a place, and
 * nothing that prints it may say so.
 */
export function pitPairs(entries, pits) {
  const laps = stopLaps(pits)
  const field = entries.filter((e) => !missing(e.finish_position) && !missing(e.grid) && laps.has(e.driver_id))
  const pairs = []
  for (let i = 0; i < field.length; i += 1) {
    for (let j = i + 1; j < field.length; j += 1) {
      const [a, b] = field[i].grid < field[j].grid ? [field[i], field[j]] : [field[j], field[i]]
      const nextOnGrid = b.grid - a.grid === 1
      const nextAtFlag = Math.abs(a.finish_position - b.finish_position) === 1
      if (!nextOnGrid && !nextAtFlag) continue
      const [firstA, firstB] = [laps.get(a.driver_id)[0], laps.get(b.driver_id)[0]]
      pairs.push({
        ahead: a,
        behind: b,
        firstAhead: firstA,
        firstBehind: firstB,
        first: firstA === firstB ? null : firstA < firstB ? a : b,
        swapped: a.finish_position > b.finish_position,
      })
    }
  }
  return pairs.sort(
    (p, q) =>
      Math.min(p.ahead.finish_position, p.behind.finish_position) -
        Math.min(q.ahead.finish_position, q.behind.finish_position) || p.ahead.grid - q.ahead.grid,
  )
}
