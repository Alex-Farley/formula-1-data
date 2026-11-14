/**
 * Small multiples drawn inside a table, one per row: two in a register's own
 * table (VD-54), the title race on /seasons and the seasons raced on
 * /constructors, and one in the season-by-season tables of a driver's and a
 * constructor's page (VD-106), each season's races by round.
 *
 * The geometry and the words only, as plain numbers and strings, so that both
 * renderers draw the one picture - charts/Spark.jsx in the app and sparkSvg()
 * in scripts/prerender.js - as charts/stints.js is drawn by both.
 *
 * WHY A COLUMN AND NOT A GRID
 *     The visual-design critique (2026-09-21, E2) asked for the whole set at
 *     once. The what-leads critique (2026-10-05) settled the form: these
 *     registers are rightly table-led, and a grid of 78 or 150 above a table
 *     of the same 78 or 150 draws the set twice. So each picture is a cell,
 *     and sorting the table by any other column re-sorts the pictures with it.
 *
 * WHAT A CELL SAYS
 *     Each picture carries its reading as words - its <title>, which is the
 *     column's `text` - so a screen reader hears the sentence, a pointer gets
 *     it on hover, and the two renderers' cells compare equal as text in
 *     smoke.mjs. The picture adds the shape; it is never the only place the
 *     fact is.
 */
import { EMPTY, missing } from '../lib/format.js'
import { linear } from './scales.js'

/**
 * The size of each picture, in both renderers. The heights are the row's; the
 * widths are what each table has room for. /seasons fitted the 1,230 px page
 * at 1440 with 84 px to spare before this column, and a title race no wider
 * than that keeps its last column on the screen - 64 px is still 2.7 px a
 * round across 24 of them. /constructors already scrolled by 24 px, and its
 * bars need room for 77 seasons, so they take 96: 1.25 px a season, which
 * leaves a one-season gap visible.
 */
export const SPARK_HEIGHT = 24
export const TITLE_RACE_WIDTH = 64
export const SEASONS_RACED_WIDTH = 96

/**
 * The season-by-season tables' picture is shorter than the registers': those
 * tables are at the reference density (VD-95), whose line is about 15.5 px
 * from 1180, and a row is never more than its line and its padding - a
 * 24 px picture would have taken the row from 24.5 px to 33. 14 px sits
 * inside the line at either density. 72 px is 3 px a round across 24 of them.
 */
export const ROW_SPARK_HEIGHT = 14
export const BY_ROUND_WIDTH = 72

// Inside the box, so a stroke at the edge of its range is not clipped.
const PAD = 2
// The bar on /constructors: its height, and the narrowest a run is drawn, so
// a single season is never thinner than a hairline.
const BAR = 8
const MIN_RUN = 1.5

const round = (value) => Math.round(value * 10) / 10

// ---------------------------------------------------------------- title race

/**
 * The champion's lead over the runner-up after each round, from the query's
 * `title_race` - "round:champion:runner-up" triples, space-separated, in no
 * promised order (group_concat promises none), so they are sorted here.
 *
 * A side with no row after a round keeps the total it last had, and before
 * its first row it has nought: the running table lists a driver from their
 * first points, not always from their first race. Without that, 2014 would
 * start on Rosberg alone, since Hamilton had no points after Melbourne.
 */
export function titleRaceOf(value) {
  if (missing(value)) return null
  const rounds = String(value)
    .trim()
    .split(/\s+/)
    .map((triple) => triple.split(':'))
    .map(([round, champion, second]) => ({
      round: Number(round),
      champion: champion === '' ? null : Number(champion),
      second: second === '' ? null : Number(second),
    }))
    .filter((r) => Number.isFinite(r.round))
    .sort((a, b) => a.round - b.round)
  if (!rounds.length) return null
  let champion = 0
  let second = 0
  return rounds.map((r) => {
    if (r.champion !== null && Number.isFinite(r.champion)) champion = r.champion
    if (r.second !== null && Number.isFinite(r.second)) second = r.second
    // To a thousandth: a shared drive's points are sevenths, and a gap of
    // 1e-15 is not a lead.
    return { round: r.round, gap: Math.round((champion - second) * 1000) / 1000 }
  })
}

/**
 * The words for one season's line, which are also the cell's text.
 *
 * The round the champion went ahead of the runner-up and stayed ahead - level
 * on points is not ahead - out of the rounds the line covers. Ahead of the
 * runner-up, never "led": in 1968 Graham Hill was ahead of Stewart after
 * every round, and Jim Clark led the championship after the first of them.
 * The season still running compares its leader with second place, since its
 * line is a leader's and not a champion's (IA-17). The season not yet raced
 * has no line and a dash, as its Points, Runner-up and Margin have: the "not
 * yet run" its champion's cells carry already says why the row is empty.
 */
export function titleRaceText(value, row) {
  const series = row.not_started ? null : titleRaceOf(value)
  if (!series) return EMPTY
  const last = series[series.length - 1]
  const other = row.running ? 'second place' : 'the runner-up'
  if (last.gap === 0) return `Level with ${other} after the last round`
  if (last.gap < 0) return `Behind ${other} after the last round`
  let from = series.length - 1
  while (from > 0 && series[from - 1].gap > 0) from -= 1
  // "of 16 run" while the season is: of 16 alone would read as its length.
  if (from === 0) return `Ahead of ${other} after every round${row.running ? ' so far' : ''}`
  return `Ahead of ${other} from round ${series[from].round} of ${last.round}${row.running ? ' run' : ''}`
}

/**
 * The line, in a box TITLE_RACE_WIDTH by SPARK_HEIGHT: rounds left to right from
 * the start of the season, the lead up and a deficit down, with the line at
 * nought drawn across it.
 *
 * Each season is scaled to itself, on both axes. Seventy years of points
 * systems put a 1950 lead of 3 beside a 2023 lead of 290, and on one scale
 * every season before 2010 would be a flat line; the Margin column beside
 * this one is where the sizes compare. So the picture is the shape of the
 * race - when the lead came, whether it was ever lost - and the axis at
 * nought is what makes a lead and a deficit readable as such.
 */
export function titleRaceLayout(value) {
  const series = titleRaceOf(value)
  if (!series) return null
  const points = [{ round: 0, gap: 0 }, ...series]
  const gaps = points.map((p) => p.gap)
  let lo = Math.min(0, ...gaps)
  let hi = Math.max(0, ...gaps)
  // Never apart: nought in the middle rather than on the floor.
  if (lo === hi) {
    lo = -1
    hi = 1
  }
  const x = linear([0, series[series.length - 1].round], [PAD, TITLE_RACE_WIDTH - PAD])
  const y = linear([lo, hi], [SPARK_HEIGHT - PAD, PAD])
  const at = points.map((p) => [round(x(p.round)), round(y(p.gap))])
  const [endX, endY] = at[at.length - 1]
  return {
    width: TITLE_RACE_WIDTH,
    height: SPARK_HEIGHT,
    line: `M${at.map(([px, py]) => `${px},${py}`).join('L')}`,
    zero: round(y(0)),
    end: { x: endX, y: endY },
  }
}

// ---------------------------------------------------------- seasons raced

/** The seasons a constructor has a race entry in, sorted, from `seasons_raced`. */
export function seasonsRacedOf(value) {
  if (missing(value)) return []
  return [
    ...new Set(
      String(value)
        .split(',')
        .map(Number)
        .filter((year) => Number.isInteger(year)),
    ),
  ].sort((a, b) => a - b)
}

/** Consecutive seasons as one run: [[1950, 1951], [1979, 1985]]. */
export function runsOf(years) {
  const runs = []
  for (const year of years) {
    const last = runs[runs.length - 1]
    if (last && year === last[1] + 1) last[1] = year
    else runs.push([year, year])
  }
  return runs
}

/** "1950–1951, 1979–1985": the runs as words, which are the cell's text. */
export function seasonsRacedText(value) {
  const runs = runsOf(seasonsRacedOf(value))
  if (!runs.length) return 'No race entries'
  return runs.map(([a, b]) => (a === b ? String(a) : `${a}–${b}`)).join(', ')
}

/**
 * The runs as bars on one axis shared by every row - the first championship
 * season at the left edge, the current one at the right - so a column of them
 * reads as the register's history: who came when, who left, who came back.
 * A year is the width of its season, so a run ends at the end of its last
 * year rather than at its start.
 */
export function seasonsRacedLayout(value, first, last) {
  if (missing(first) || missing(last) || last < first) return null
  const x = linear([first, last + 1], [0, SEASONS_RACED_WIDTH])
  const top = (SPARK_HEIGHT - BAR) / 2
  return {
    width: SEASONS_RACED_WIDTH,
    height: SPARK_HEIGHT,
    track: round(SPARK_HEIGHT / 2),
    bar: { y: top, height: BAR },
    runs: runsOf(seasonsRacedOf(value).filter((year) => year >= first && year <= last)).map(([a, b]) => {
      const start = round(x(a))
      const width = Math.max(MIN_RUN, round(x(b + 1) - start))
      // Widened to the minimum, the current season's run is kept in the box.
      return { x: round(Math.min(start, SEASONS_RACED_WIDTH - width)), width }
    }),
  }
}

// ---------------------------------------------------------------- by round

/*
 * A season's races, round by round (VD-106): a bar a round classified and a
 * tick a round entered and not, on the season's own calendar, so a row reads as the season's shape and a column
 * of them as a career's - the seasons near the top of the box, the seasons
 * at its foot, and where in a season the rounds were missed.
 *
 * The value is the query's `by_round`, "round:code" pairs, space-separated,
 * in no promised order. The code is the entry's position_text on a driver's
 * page - its finishing place, or the source's own DNF, DNQ, NC and the rest -
 * and on a constructor's the best place any of its cars was classified in,
 * empty where none was.
 */

// The place the shortest bar stands for, and every place below it: a field
// of 33 at Indianapolis would otherwise put every other season's twentieth
// near the top. The words carry the place itself.
const BY_ROUND_FLOOR = 20
const BAR_LOW = 3
const BAR_HIGH = 12
// A round entered and not classified is a tick on the line, never a bar.
const TICK = 1

/** The rounds of `by_round`, sorted: [{ round, place, code }]. */
export function byRoundOf(value) {
  if (missing(value)) return []
  return String(value)
    .trim()
    .split(/\s+/)
    .map((pair) => {
      const at = pair.indexOf(':')
      const round = Number(at < 0 ? pair : pair.slice(0, at))
      const code = at < 0 ? '' : pair.slice(at + 1)
      const place = /^\d+$/.test(code) ? Number(code) : null
      return { round, place, code }
    })
    .filter((r) => Number.isInteger(r.round))
    .sort((a, b) => a.round - b.round)
}

/**
 * The words for one season's bars, which are also the cell's text: every
 * round entered, in order, with its place - "R1 P3, R2 DNF, R4 P1". A code
 * that is not a place is the source's own, as the Result column prints it;
 * an empty one, a constructor's round with no car classified, is said so.
 */
export function byRoundText(value) {
  const rounds = byRoundOf(value)
  if (!rounds.length) return EMPTY
  return rounds
    .map((r) => `R${r.round} ${r.place !== null ? `P${r.place}` : r.code || 'not classified'}`)
    .join(', ')
}

/**
 * The bars, in a box BY_ROUND_WIDTH by ROW_SPARK_HEIGHT: a slot for every
 * round of the season's calendar, left to right, and a bar in each slot
 * entered, tallest for a win and shortest for BY_ROUND_FLOOR and below, on a
 * line the width of the season. One scale for every season, so the rows of
 * a table compare. `rounds` is the calendar's length; a season whose
 * calendar is not known is drawn to its last round entered.
 */
export function byRoundLayout(value, rounds) {
  const entered = byRoundOf(value).filter((r) => r.round >= 1)
  if (!entered.length) return null
  const length = Math.max(Number.isInteger(rounds) ? rounds : 0, ...entered.map((r) => r.round))
  const slot = BY_ROUND_WIDTH / length
  const base = ROW_SPARK_HEIGHT - 1
  const bar = Math.max(1, slot - 1)
  const height = (place) =>
    BAR_LOW + ((BY_ROUND_FLOOR - Math.min(place, BY_ROUND_FLOOR)) / (BY_ROUND_FLOOR - 1)) * (BAR_HIGH - BAR_LOW)
  const at = (r) => round((r.round - 1) * slot + (slot - bar) / 2)
  return {
    width: BY_ROUND_WIDTH,
    height: ROW_SPARK_HEIGHT,
    track: base + 0.5,
    bars: entered
      .filter((r) => r.place !== null)
      .map((r) => {
        const h = round(height(r.place))
        return { x: at(r), y: round(base - h), width: round(bar), height: h }
      }),
    ticks: entered
      .filter((r) => r.place === null)
      .map((r) => ({ x: at(r), y: base - TICK, width: round(bar), height: TICK })),
  }
}
