/**
 * The pure functions, tested directly.
 *
 * WHY THIS FILE EXISTS
 *     smoke.mjs drives the built site in a real browser and is the better test
 *     of whether the thing works. What it cannot do is put an awkward value
 *     through a function and look at the answer: it can only reach the values
 *     that happen to be in f1.db, on the pages it happens to open. Every rule
 *     these functions encode — a blank is not a zero, a hyphenated venue is not
 *     two words, a hole in a trace is not a join — is a rule that reads as
 *     working right up until the one row that breaks it appears.
 *
 * node:test and node:assert. No new dependency: the front end has four, and a
 * test runner is not going to be the fifth.
 *
 *     npm run test:units
 */
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  EMPTY,
  classificationOrder,
  missing,
  number,
  percent,
  points,
  result,
  span,
  text,
  yearList,
} from '../src/lib/format.js'
import { BANDS, bandIndex, metresBetween, runsFor, signedArea, stitch } from '../src/lib/lap.js'
import { fold, rank } from '../src/lib/search.js'
import { trackPath } from '../src/lib/track.js'
import { DRIVER_COLUMNS } from '../src/queries/drivers.js'
import { allExplained } from '../src/lib/disagreement.js'
import { holderPath } from '../src/queries/records.js'
import { SEASON_COLUMNS, derivedAndPublished, pointsDiffer, record, seasonRows, seasonsNote, strip } from '../src/queries/driver.js'
import { recordColumns, tiersOf } from '../src/queries/records.js'

// A square about 111 m on a side, as [lon, lat] — the order the geometry uses.
const P0 = [0, 0]
const P1 = [0.001, 0]
const P2 = [0.001, 0.001]
const P3 = [0, 0.001]
const DEGREE_M = (Math.PI / 180) * 6371008.8   // 111 195.080 m

const ring = (lines) => ({ type: 'MultiLineString', coordinates: lines })

describe('missing, and the em dash', () => {
  it('treats null, undefined and empty string as unestablished', () => {
    for (const value of [null, undefined, '']) assert.equal(missing(value), true)
  })

  it('does NOT treat zero or false as unestablished', () => {
    // The central convention of this database: a blank is a fact nobody has
    // established, and zero is a fact. Folding them loses the difference
    // between "never scored" and "nobody has counted".
    assert.equal(missing(0), false)
    assert.equal(missing(false), false)
    assert.equal(text(0), '0')
    assert.equal(number(0), '0')
    assert.equal(points(0), '0')
  })

  it('renders an unestablished value as an em dash', () => {
    assert.equal(text(null), EMPTY)
    assert.equal(number(null), EMPTY)
    assert.equal(points(undefined), EMPTY)
  })
})

describe('number and points', () => {
  it('separates thousands', () => {
    assert.equal(number(5201), '5,201')
  })

  it('keeps at most three decimal places', () => {
    assert.equal(number(127.33), '127.33')
    assert.equal(number(1 / 3), '0.333')
  })

  it('does not print points as 25.000', () => {
    assert.equal(points(25), '25')
    assert.equal(points(25.5), '25.5')
    assert.equal(points(0.5), '0.5')
  })

  it('refuses a value that is not a number rather than coercing it', () => {
    assert.equal(number('12'), EMPTY)
    assert.equal(number(Number.NaN), EMPTY)
    assert.equal(number(Number.POSITIVE_INFINITY), EMPTY)
  })
})

describe('percent', () => {
  it('divides', () => {
    assert.equal(percent(1, 4), '25.0%')
  })

  it('does not divide by zero', () => {
    // 0 of 0 races is not 0% and not NaN%; nobody has established it.
    assert.equal(percent(0, 0), EMPTY)
  })
})

describe('yearList', () => {
  it('collapses consecutive years to a range, two-year runs included', () => {
    assert.equal(yearList('2008,2014,2015,2017,2018,2019,2020'), '2008, 2014–15, 2017–20')
  })

  it('spaces the commas so the list wraps between years, never inside one', () => {
    assert.equal(yearList('1994,1995,2000,2001,2002,2003,2004'), '1994–95, 2000–04')
  })

  it('leaves a single year alone', () => {
    assert.equal(yearList('1975'), '1975')
  })

  it('is an em dash for nothing', () => {
    assert.equal(yearList(null), EMPTY)
  })
})

describe('corner bands', () => {
  it('puts a radius in the band its edges say, straights last', () => {
    assert.equal(bandIndex(30), 0)
    assert.equal(bandIndex(BANDS[0]), 1)
    assert.equal(bandIndex(150), 2)
    assert.equal(bandIndex(399), 3)
    assert.equal(bandIndex(Infinity), BANDS.length)
  })
  it('splits a lap into one path per run of the same band', () => {
    const lap = {
      path: 'M0 0',
      shape: { x: [0, 1, 2, 3, 4, 5], y: [0, 0, 0, 0, 0, 0] },
      radius: [30, 30, 500, 500, 30, 30],
    }
    assert.equal(runsFor(lap, true).length, 3)
    assert.equal(runsFor(lap, false).length, 1)
    assert.equal(runsFor({ ...lap, radius: null }, true).length, 1)
  })
})

describe('signedArea', () => {
  it('is positive for a ring walked clockwise on screen, where y grows downward', () => {
    // Top-left, top-right, bottom-right, bottom-left, back: clockwise as drawn.
    const cw = { x: [0, 1, 1, 0, 0], y: [0, 0, 1, 1, 0] }
    assert.ok(signedArea(cw) > 0)
    const acw = { x: [0, 0, 1, 1, 0], y: [0, 1, 1, 0, 0] }
    assert.ok(signedArea(acw) < 0)
  })
})

describe('search', () => {
  const entry = (label, weight = 0) => ({ label, needle: fold(label), weight })

  it('folds letters that have no combining mark to strip', () => {
    assert.equal(fold('Tom Belsø'), 'tom belso')
    assert.equal(fold('Robert Kubica'), fold('robert kubica'))
    assert.ok(rank(entry('Tom Belsø'), 'belso') >= 0)
    assert.ok(rank(entry('Jo Siffert'), 'siffert') >= 0)
  })

  it('offers the winningest driver first among equal matches', () => {
    const lewis = entry('Sir Lewis Hamilton', 106)
    const duncan = entry('Duncan Hamilton', 0)
    assert.ok(rank(lewis, 'hamilton') > rank(duncan, 'hamilton'))
  })

  it('finds an accented name from an unaccented search and the other way round', () => {
    assert.ok(rank(entry('Kimi Räikkönen'), 'raikkonen') > 0)
    assert.ok(rank(entry('Kimi Raikkonen'), 'Räikkönen') > 0)
    assert.ok(rank(entry('Paul Frère'), 'frere') > 0)
  })

  it('takes the words in any order', () => {
    assert.ok(rank(entry('1996 Monaco Grand Prix'), 'monaco 1996') > 0)
    assert.ok(rank(entry('1996 Monaco Grand Prix'), 'british gp') === -1)
  })

  it('still puts a start-of-label match above a start-of-word one', () => {
    assert.ok(rank(entry('Hill'), 'hill') > rank(entry('Damon Hill'), 'hill'))
  })

  it('finds a car by the name anyone types, once the index carries it', () => {
    assert.ok(rank(entry('Ferrari 312/67'), 'ferrari 312') > 0)
  })
})

describe('span', () => {
  it('writes a range with an en dash', () => {
    assert.equal(span(1950, 2026), '1950–2026')
  })

  it('writes an open range for a career still running', () => {
    assert.equal(span(2007, null), '2007–')
  })

  it('writes one year rather than a range of one', () => {
    assert.equal(span(1970, 1970), '1970')
  })

  it('is an em dash when neither end is known', () => {
    assert.equal(span(null, null), EMPTY)
  })
})

describe('result, as a classification prints it', () => {
  it('prefers what the source actually printed', () => {
    assert.equal(result({ position_text: 'DNF', finish_position: null }), 'DNF')
    assert.equal(result({ position_text: '7', finish_position: 7 }), '7')
  })

  it('falls back to the number where there is no text', () => {
    assert.equal(result({ position_text: null, finish_position: 3 }), '3')
  })

  it('is an em dash where there is neither', () => {
    assert.equal(result({ position_text: null, finish_position: null }), EMPTY)
  })
})

describe('classificationOrder', () => {
  it('puts finishers in order', () => {
    assert.ok(classificationOrder({ finish_position: 1 }) < classificationOrder({ finish_position: 2 }))
  })

  it('puts every retirement after every finisher', () => {
    // SQLite sorts NULL first, so ordering on finish_position alone leads a
    // classification with the retirements. This is what stops that.
    const last = classificationOrder({ finish_position: 22 })
    const dnf = classificationOrder({ finish_position: null, laps_completed: 50 })
    assert.ok(dnf > last)
  })

  it('orders retirements by how far they got', () => {
    const far = classificationOrder({ finish_position: null, laps_completed: 60 })
    const near = classificationOrder({ finish_position: null, laps_completed: 3 })
    assert.ok(far < near)
  })

  it('puts a driver who completed no laps last of all', () => {
    const none = classificationOrder({ finish_position: null, laps_completed: null })
    const some = classificationOrder({ finish_position: null, laps_completed: 0 })
    assert.ok(none > some)
  })
})

describe('metresBetween', () => {
  it('measures a degree of latitude', () => {
    assert.ok(Math.abs(metresBetween([0, 0], [0, 1]) - DEGREE_M) < 0.01)
  })

  it('agrees with build.py, which measures the same traces independently', () => {
    // build.py's _haversine returns 111195.080234 m for the same degree, and
    // tests/test_geometry.py pins it there. The two are deliberately separate
    // implementations — the point of re-measuring at build time is to check
    // the tool's arithmetic, not to share it — so the figure is asserted on
    // both sides. If one of them ever moved, the site and the database would
    // disagree about how long a lap is.
    assert.ok(Math.abs(metresBetween([0, 0], [0, 1]) - 111195.080234) < 1e-4)
  })

  it('is zero to itself', () => {
    assert.equal(metresBetween([9.28, 45.62], [9.28, 45.62]), 0)
  })
})

describe('stitch', () => {
  it('walks unordered ways into one ring', () => {
    // An OSM relation's members are unordered. This is the whole job.
    const out = stitch(ring([[P2, P3], [P0, P1], [P3, P0], [P1, P2]]))
    assert.equal(out.complete, true)
    assert.equal(out.walked, 4)
    assert.equal(out.ways, 4)
  })

  it('reverses a way that runs against the direction of travel', () => {
    const out = stitch(ring([[P0, P1], [P2, P1], [P2, P3], [P3, P0]]))
    assert.equal(out.complete, true)
    assert.equal(out.walked, 4)
  })

  it('does not close a trace with a hole in it', () => {
    const gap = [0, 0.00097] // 3.3 m short of P3
    assert.equal(stitch(ring([[P0, P1], [P1, P2], [P2, P3], [gap, P0]])).complete, false)
  })

  it('does not read a 3 m hole as a join at the default tolerance', () => {
    // At 30 m two of the real traces held here read as whole when they are not.
    const gap = [0, 0.00097]
    const lines = ring([[P0, P1], [P1, P2], [P2, P3], [gap, P0]])
    assert.equal(stitch(lines).complete, false)
    assert.equal(stitch(lines, 30).complete, true)
  })

  it('accepts the JSON string the database actually stores', () => {
    const out = stitch(JSON.stringify(ring([[P0, P1, P2, P3, P0]])))
    assert.equal(out.complete, true)
  })

  it('returns null rather than throwing on rubbish', () => {
    assert.equal(stitch('not json'), null)
    assert.equal(stitch(null), null)
    assert.equal(stitch(ring([])), null)
  })
})

describe('trackPath', () => {
  it('draws a path and reports the aspect it needs', () => {
    const out = trackPath(ring([[P0, P1, P2, P3, P0]]))
    assert.ok(out.path.startsWith('M'))
    assert.equal(out.segments, 1)
    assert.equal(out.nodes, 5)
  })

  it('returns null rather than throwing on rubbish', () => {
    assert.equal(trackPath('not json'), null)
    assert.equal(trackPath(ring([])), null)
    assert.equal(trackPath(ring([[P0]])), null)
  })
})

describe('record holders', () => {
  it('links every holder that resolves, and leaves a shared record as text', () => {
    assert.equal(holderPath({ holder_table: 'drivers', holder_id: 'senna' }), 'drivers/senna')
    assert.equal(holderPath({ holder_table: 'constructors', holder_id: 'ferrari' }), 'constructors/ferrari')
    assert.equal(holderPath({ holder_table: 'circuits', holder_id: 'monza' }), 'circuits/monza')
    assert.equal(holderPath({ holder_table: 'races', holder_id: '142', race_year: 1966, race_round: 2 }), 'races/1966/2')
    assert.equal(holderPath({ holder_table: 'races', holder_id: '142', race_year: null, race_round: null }), null)
    assert.equal(holderPath({ holder_table: 'drivers', holder_id: null, holder: 'Michael Schumacher, Sir Lewis Hamilton' }), null)
  })
})

describe('the disagreement aside', () => {
  it('introduces a set of explained rows as readings, and anything else as a disagreement', () => {
    const explained = { status: 'explained - each side is right about something' }
    const open = { status: 'open - needs official check' }
    assert.equal(allExplained([explained]), true)
    assert.equal(allExplained([explained, explained]), true)
    assert.equal(allExplained([open]), false)
    assert.equal(allExplained([explained, open]), false)
    assert.equal(allExplained([]), false)
  })
})

describe('the queries a page and the prerenderer share', () => {
  const by = (columns) => Object.fromEntries(columns.map((c) => [c.key, c]))

  it('lays the seasons out latest first, with the championship joined on', () => {
    const rows = seasonRows(
      [{ year: 1988, entries: 16 }, { year: 1989, entries: 16 }],
      [{ year: 1989, position: 2, position_text: '2', points: 60 }],
    )
    assert.deepEqual(rows.map((r) => r.year), [1989, 1988])
    assert.equal(rows[0].championship, 2)
    assert.equal(rows[0].championship_points, 60)
    assert.equal(rows[1].championship, null)
    assert.equal(rows[1].championship_text, null)
  })

  it('formats a cell the same string for both renderers', () => {
    const season = by(SEASON_COLUMNS)
    assert.equal(season.best.text(null), EMPTY)
    assert.equal(season.best.text(3), 'P3')
    assert.equal(season.championship_text.text(null, { championship: 4 }), '4')
    assert.equal(season.championship_text.text('DSQ', { championship: null }), 'DSQ')
    assert.equal(season.championship_text.text(null, { championship: null }), EMPTY)
    assert.equal(season.points.text(25.5), '25.5')
    assert.equal(season.points.text(null), EMPTY)
    assert.equal(by(DRIVER_COLUMNS).first_season.text(null, { first_season: 1963, last_season: 1976 }), '1963–1976')
    assert.equal(by(DRIVER_COLUMNS).first_season.text(null, { first_season: 2024, last_season: null }), '2024–')
  })

  it('shows Titles only where there is one, and Best finish only where a finish was classified', () => {
    const none = strip({ first_season: 1963, last_season: 1976, titles: 0 }, { entries: 96, seasons: 13, best: null })
    assert.deepEqual(
      none.map((i) => i.label),
      ['Seasons', 'Entries', 'Wins', 'Podiums', 'Poles', 'Fastest laps', 'Best finish'],
    )
    assert.equal(none.find((i) => i.label === 'Best finish').value, null)
    // A driver with no classified finish has zero wins, not an unknown number.
    assert.equal(none.find((i) => i.label === 'Wins').value, '0')
    assert.equal(none.find((i) => i.label === 'Seasons').note, '13 with an entry')
    // The register's span and the race records' agree for all but two drivers;
    // where they differ, the note says which years are the records'.
    assert.equal(
      seasonsNote({ first_season: 1970, last_season: 1973 }, { seasons: 5, first_year: 1969, last_year: 1973 }),
      '5 with an entry; 1969–1973 in the race records, 1970–1973 published',
    )
    assert.equal(seasonsNote({ first_season: 1970, last_season: 1973 }, { seasons: 4, first_year: 1970, last_year: 1973 }), '4 with an entry')
    assert.equal(seasonsNote({ first_season: null, last_season: null }, { seasons: 1, first_year: 2015, last_year: 2015 }), '1 with an entry')
    // A NULL first season is no claim about the first year; the last is still compared (CD-26).
    assert.equal(
      seasonsNote({ first_season: null, last_season: 1973 }, { seasons: 5, first_year: 1969, last_year: 1975 }),
      '5 with an entry; 1969–1975 in the race records, 1973 published',
    )
    assert.equal(seasonsNote({ first_season: null, last_season: 1975 }, { seasons: 5, first_year: 1969, last_year: 1975 }), '5 with an entry')
    // An open span - a driver still driving - makes no claim about the last
    // year, so it never differs on it.
    assert.equal(seasonsNote({ first_season: 2007, last_season: null }, { seasons: 20, first_year: 2007, last_year: 2026 }), '20 with an entry')
    assert.equal(
      seasonsNote({ first_season: 2014, last_season: null }, { seasons: 1, first_year: 2015, last_year: 2015 }),
      '1 with an entry; 2015 in the race records, 2014– published',
    )
    const some = strip({ titles: 3, title_years: '1969,1971,1973' }, { best: 1, seasons: 1 })
    assert.deepEqual(some.find((i) => i.label === 'Titles'), { label: 'Titles', value: '3', note: '1969, 1971, 1973' })
    assert.equal(some.find((i) => i.label === 'Best finish').value, 'P1')
  })

  it('labels the stored figures as published, and dashes what nobody published', () => {
    const pairs = Object.fromEntries(record({ wins: 8, wins_external: 8, poles: 5, poles_external: null, entries: null }))
    assert.equal(pairs['Entries (published)'], EMPTY)
    assert.equal('Entries (stored)' in pairs, false)
    assert.equal(pairs.Wins, '8 derived · 8 published')
    assert.equal(pairs.Poles, '5 derived')
    assert.equal('Provenance' in pairs, false)
    assert.equal(Object.fromEntries(record({ provenance: 'harvest' })).Provenance, 'harvest')
    assert.equal(derivedAndPublished(null, 3), '— derived · 3 published')
  })

  it('does not call a rounding difference two totals', () => {
    assert.equal(pointsDiffer({ career_points: 100 }, { points: 100.005 }), false)
    assert.equal(pointsDiffer({ career_points: 100 }, { points: 101 }), true)
    assert.equal(pointsDiffer({ career_points: null }, { points: 101 }), false)
  })

  it('adds a Confidence column only where the records differ on it', () => {
    const shared = [{ confidence: 'reference' }, { confidence: 'reference' }]
    assert.deepEqual(tiersOf(shared), ['reference'])
    assert.deepEqual(
      recordColumns(shared).map((c) => c.label),
      ['Record', 'Holder', 'Value', 'How it is derived', 'As of'],
    )
    assert.equal(recordColumns([{ confidence: 'reference' }, { confidence: 'high' }]).at(-1).key, 'confidence')
  })
})
