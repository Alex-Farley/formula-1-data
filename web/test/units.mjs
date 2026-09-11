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
import { metresBetween, stitch } from '../src/lib/lap.js'
import { fold, rank } from '../src/lib/search.js'
import { trackPath } from '../src/lib/track.js'

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

describe('search', () => {
  const entry = (label, weight = 0) => ({ label, needle: fold(label), weight })

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
