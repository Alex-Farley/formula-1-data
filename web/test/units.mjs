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
import { holderPath } from '../src/queries/records.js'
import { EXPLAINED_FOOTER, OPEN_FOOTER, allExplained } from '../src/lib/disagreement.js'
import { clock, nextSession, until, utc } from '../src/queries/sessions.js'
import { SEASON_COLUMNS, derivedAndPublished, pointsDiffer, record, seasonRows, seasonsNote, strip } from '../src/queries/driver.js'
import { latestRound, roundName, roundWinner, standingsHeading, stillRunning, titleHeading } from '../src/queries/season.js'
import { SEASONS_COLUMNS, soFar } from '../src/queries/seasons.js'
import { raceWinner } from '../src/queries/races.js'
import { entered } from '../src/queries/constructors.js'
import { traced } from '../src/queries/circuits.js'
import { chassisName } from '../src/queries/cars.js'
import { driverName, fastestLapMark, inClassificationOrder, outcome, position, railOf } from '../src/queries/race.js'
import { raceWinnerHere } from '../src/queries/circuit.js'
import { constructorSeasons } from '../src/queries/constructor.js'
import { NOT_YET_RUN } from '../src/lib/site.js'
import { NEXT, RUN, TO_COME, outlineCaption, outlineFigures, roundShortName, roundStates } from '../src/lib/outline.js'
import { attribution, canShow, fileTitle, thumbUrl } from '../src/lib/commons.js'
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
    assert.equal(holderPath({ holder_table: 'races', holder_id: '142', race_year: 1966, race_round: 1 }), 'races/1966/1')
    assert.equal(holderPath({ holder_table: 'races', holder_id: '142', race_year: null, race_round: null }), null)
    assert.equal(holderPath({ holder_table: 'drivers', holder_id: null, holder: 'Michael Schumacher, Sir Lewis Hamilton' }), null)
  })
})

describe('the weekend timetable', () => {
  const rows = [
    { kind: 'fp1', name: 'Practice 1', start_utc: '2026-11-20T00:30Z', zone: 'America/Los_Angeles' },
    { kind: 'race', name: 'Race', start_utc: '2026-11-22T04:00Z', zone: 'America/Los_Angeles' },
  ]
  it("shows a start on the circuit's clock and in UTC, derived from one instant", () => {
    // Las Vegas races on a Saturday evening that is Sunday in UTC.
    assert.equal(clock('2026-11-22T04:00Z', 'America/Los_Angeles'), 'Sat 21 Nov 20:00')
    assert.equal(utc('2026-11-22T04:00Z'), 'Sun 22 Nov 04:00')
    assert.equal(clock('2026-03-08T04:00Z', 'Australia/Melbourne'), 'Sun 8 Mar 15:00')
  })
  it('finds the next session from now, and says how long', () => {
    const before = Date.parse('2026-11-19T12:00Z')
    assert.equal(nextSession(rows, before).kind, 'fp1')
    assert.equal(nextSession(rows, Date.parse('2026-11-21T00:00Z')).kind, 'race')
    assert.equal(nextSession(rows, Date.parse('2026-11-23T00:00Z')), null)
    assert.equal(until('2026-11-20T00:30Z', before), 'in 13 hours')
    assert.equal(until('2026-11-19T12:40Z', before), 'in 40 minutes')
    assert.equal(until('2026-11-22T04:00Z', Date.parse('2026-09-12T12:00Z')), 'in 71 days')
    assert.equal(until('2026-11-19T11:00Z', before), null)
    assert.equal(until('2026-11-19T12:00:20Z', before), 'in under a minute')
    assert.equal(until('2026-11-19T13:29:45Z', before), 'in 90 minutes')
    assert.equal(until('2026-11-19T13:31:00Z', before), 'in 2 hours')
  })
})

describe('the disagreement aside', () => {
  it('closes with one of two shared sentences, each ending where the quality-page link begins', () => {
    for (const footer of [EXPLAINED_FOOTER, OPEN_FOOTER]) {
      assert.ok(footer.startsWith('Recorded'))
      assert.ok(footer.endsWith(' listed on '))
    }
    assert.ok(EXPLAINED_FOOTER.includes('the published span'))
  })
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

  it('heads a season by whether a round is still to run, and marks the season in progress', () => {
    assert.equal(stillRunning([{ status: 'completed' }, { status: 'scheduled' }]), true)
    assert.equal(stillRunning([{ status: 'completed' }]), false)
    assert.equal(latestRound([{ after_round: 3 }, { after_round: 13 }, { after_round: 7 }]), 13)
    assert.equal(latestRound([]), null)
    assert.equal(titleHeading(true), 'The title race')
    assert.equal(titleHeading(false), 'How the title was decided')
    assert.equal(standingsHeading("Drivers'", true, 13), "Drivers' standings after round 13")
    assert.equal(standingsHeading("Drivers'", true, null), "Drivers' standings")
    assert.equal(standingsHeading("Constructors'", false, 23), "Final constructors' standings")
    assert.equal(roundWinner('Lando Norris', { status: 'completed' }), 'Lando Norris')
    assert.equal(roundWinner(null, { status: 'completed' }), EMPTY)
    assert.equal(roundWinner(null, { status: 'scheduled' }), NOT_YET_RUN)
    assert.equal(roundName('Chinese Grand Prix', { sprint: 1 }), 'Chinese Grand Prix sprint')
    assert.equal(raceWinner('A', { status: 'completed', co_winner_id: 'b' }), 'A shared')
    assert.equal(raceWinner('A', { status: 'scheduled', co_winner_id: null }), NOT_YET_RUN)
    assert.equal(soFar('Antonelli', { undecided: 1 }), 'Antonelli so far')
    assert.equal(soFar('Norris', { undecided: 0 }), 'Norris')
    assert.equal(soFar(null, { undecided: 1 }), EMPTY)
    assert.equal(by(SEASONS_COLUMNS).rounds.text(23, { undecided: 1, run: 13 }), '13 of 23')
    assert.equal(by(SEASONS_COLUMNS).rounds.text(24, { undecided: 0, run: 24 }), '24')
  })

  it('formats the registers the same string for both renderers', () => {
    assert.equal(entered(null, { first_entry: 1950, last_entry: 2026, active: 1 }), '1950–')
    assert.equal(entered(null, { first_entry: 1952, last_entry: 1953, active: 0 }), '1952–1953')
    assert.equal(entered(null, { first_entry: null, last_entry: null, active: 0 }), EMPTY)
    assert.equal(traced(1), '●traced')
    assert.equal(traced(0), EMPTY)
    assert.equal(chassisName('158', { landmark: 'Alfa Romeo 158' }), '158 landmark')
    assert.equal(chassisName('125', { landmark: null }), '125')
    assert.equal(chassisName(null, { landmark: null }), EMPTY)
  })

  it('prints a classification cell the same string in both renderers, and in the same order', () => {
    assert.equal(position(null, { position_text: 'NC', finish_position: null }), 'NC')
    assert.equal(position(null, { position_text: null, finish_position: 4 }), '4')
    assert.equal(position(null, { position_text: null, finish_position: null }), EMPTY)
    assert.equal(outcome(null, { finish_position: 3 }), 'Finished')
    assert.equal(outcome('Engine', { finish_position: null }), 'Engine')
    assert.equal(outcome(null, { finish_position: null }), EMPTY)
    assert.equal(driverName('A', { driver_id: 'a', shared_drive: 1 }), 'A shared')
    assert.equal(driverName(null, { driver_id: 'a', shared_drive: 0 }), 'a')
    assert.equal(driverName(null, { driver_id: null, shared_drive: 1 }), `${EMPTY} shared`)
    assert.equal(fastestLapMark(1), '●fastest lap')
    assert.equal(fastestLapMark(0), '')
    assert.equal(railOf({ finish_position: 2, points: 18 }), 'podium')
    assert.equal(railOf({ finish_position: 7, points: 6 }), 'points')
    assert.equal(railOf({ finish_position: 14, points: 0 }), 'classified')
    assert.equal(railOf({ finish_position: null, points: null }), '')
    // Finishers by position, then retirements by how far they got, then the rest.
    const rows = [
      { id: 'dnf-late', finish_position: null, laps_completed: 50 },
      { id: 'p2', finish_position: 2, laps_completed: 56 },
      { id: 'dns', finish_position: null, laps_completed: null },
      { id: 'p1', finish_position: 1, laps_completed: 56 },
      { id: 'dnf-early', finish_position: null, laps_completed: 3 },
    ]
    assert.deepEqual(inClassificationOrder(rows).map((r) => r.id), ['p1', 'p2', 'dnf-late', 'dnf-early', 'dns'])
    assert.equal(rows[0].id, 'dnf-late', 'the caller’s array is not sorted in place')
  })

  it('joins a constructor’s seasons to their championship position, newest first', () => {
    const joined = constructorSeasons(
      [{ year: 1960, wins: 1 }, { year: 1961, wins: 0 }],
      [{ year: 1960, position: 1, position_text: '1' }, { year: 1960, position: 5, position_text: '5' }],
    )
    assert.deepEqual(joined.map((r) => r.year), [1961, 1960])
    assert.equal(joined[1].championship, 1, 'the first standings row for the year is the one shown')
    assert.equal(joined[0].championship, null)
    assert.equal(raceWinnerHere('A / B', { status: 'completed' }), 'A / B')
    assert.equal(raceWinnerHere(null, { status: 'scheduled' }), NOT_YET_RUN)
    assert.equal(raceWinnerHere(null, { status: 'completed' }), EMPTY)
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

// ------------------------------------------------------------ attribution

describe('attribution: the one rule, with the values the database actually holds', () => {
  // The same rule verify.py applies when it admits a row:
  //   COALESCE(NULLIF(TRIM(artist), ''), NULLIF(TRIM(credit), ''))
  // A renderer that disagreed with it captioned the 1958 Hawthorn photograph
  // as anonymous. These are the shapes of row that admitted it.
  it('credits the artist when there is one', () => {
    assert.equal(attribution({ artist: 'Lothar Spurzem', credit: 'Own work' }), 'Lothar Spurzem')
  })
  it('falls back to credit when artist is missing, empty or only whitespace', () => {
    assert.equal(attribution({ credit: 'Bundesarchiv, Bild 183' }), 'Bundesarchiv, Bild 183')
    assert.equal(attribution({ artist: '', credit: 'Bundesarchiv, Bild 183' }), 'Bundesarchiv, Bild 183')
    assert.equal(attribution({ artist: '   ', credit: ' Bundesarchiv ' }), 'Bundesarchiv')
  })
  it('is null, never an empty string, when nobody can be credited', () => {
    assert.equal(attribution({ artist: '', credit: '  ' }), null)
    assert.equal(attribution({}), null)
    assert.equal(attribution(null), null)
    assert.equal(attribution(undefined), null)
  })
})

describe('canShow: no credit or no licence means no picture', () => {
  const ok = { file_name: 'File:Senna 1988.jpg', artist: 'Someone', licence: 'CC BY-SA 3.0' }
  it('shows a file with a name, someone to credit and a licence', () => {
    assert.equal(canShow(ok), true)
  })
  it('accepts a credit in place of an artist, as the build does', () => {
    assert.equal(canShow({ ...ok, artist: '', credit: 'Bundesarchiv' }), true)
  })
  it('fails closed on a blank or whitespace licence', () => {
    assert.equal(canShow({ ...ok, licence: '' }), false)
    assert.equal(canShow({ ...ok, licence: '   ' }), false)
    assert.equal(canShow({ ...ok, licence: null }), false)
  })
  it('fails closed with nobody to credit', () => {
    assert.equal(canShow({ ...ok, artist: '', credit: '' }), false)
    assert.equal(canShow({ ...ok, artist: undefined }), false)
  })
  it('fails closed without a file name, and on no row at all', () => {
    assert.equal(canShow({ ...ok, file_name: '' }), false)
    assert.equal(canShow(null), false)
    assert.equal(canShow(undefined), false)
  })
})

describe('thumbUrl and fileTitle: the file name is the only thing stored', () => {
  it('strips the File: prefix, underscores the spaces and encodes the rest', () => {
    assert.equal(
      thumbUrl('File:Ayrton Senna 1988 (Canada).jpg', 640),
      'https://commons.wikimedia.org/wiki/Special:FilePath/Ayrton_Senna_1988_(Canada).jpg?width=640',
    )
    assert.equal(thumbUrl('Nürburgring.jpg').includes('N%C3%BCrburgring.jpg?width=800'), true)
  })
  it('is null for no file name rather than a URL to nothing', () => {
    assert.equal(thumbUrl(''), null)
    assert.equal(thumbUrl(null), null)
    assert.equal(thumbUrl('File:'), null)
  })
  it('captions with the name a person would read', () => {
    assert.equal(fileTitle('File:Ayrton_Senna_1988.jpg'), 'Ayrton Senna 1988.jpg')
    assert.equal(fileTitle(undefined), '')
  })
})

describe('the circuit outlines (AF-03)', () => {
  it('states each round from the record, not the clock: run, one next, the rest to come', () => {
    const c = (...statuses) => statuses.map((status) => ({ status }))
    assert.deepEqual(roundStates(c('completed', 'completed', 'scheduled', 'scheduled')), [RUN, RUN, NEXT, TO_COME])
    assert.deepEqual(roundStates(c('completed', 'completed')), [RUN, RUN])
    assert.deepEqual(roundStates(c('scheduled', 'scheduled')), [NEXT, TO_COME])
    assert.deepEqual(roundStates([]), [])
  })
  it('shortens a round to its place and leaves a name that is not a Grand Prix alone', () => {
    assert.equal(roundShortName('Australian Grand Prix'), 'Australian')
    assert.equal(roundShortName('Grand Prix of Europe'), 'Europe')
    assert.equal(roundShortName('Sao Paulo Grand Prix'), 'Sao Paulo')
    assert.equal(roundShortName('Indianapolis 500'), 'Indianapolis 500')
    assert.equal(roundShortName(null), '')
  })
  it("prints F1DB's figures only where F1DB gives them", () => {
    assert.equal(outlineFigures({ length_km: 5.793, turns: 11 }), '5.793 km · 11 turns')
    assert.equal(outlineFigures({ length_km: 5.793, turns: null }), '5.793 km')
    assert.equal(outlineFigures({ length_km: null, turns: 1 }), '1 turn')
    assert.equal(outlineFigures({ length_km: null, turns: null }), '')
  })
  it('captions a layout with what the row knows, and says whose figures they are', () => {
    assert.equal(
      outlineCaption({ f1db_layout_id: 'monza-7', length_km: 5.793, turns: 11, first_year: 2000, last_year: 2025, rounds: 26, scheduled: 1 }),
      'F1DB layout monza-7 · 5.793 km · 11 turns, F1DB’s figures · 2000–2025 · 26 rounds · 1 round to come',
    )
    assert.equal(
      outlineCaption({ f1db_layout_id: 'monza-4', length_km: 5.775, turns: 7, first_year: 1972, last_year: 1972, rounds: 1, scheduled: 0 }),
      'F1DB layout monza-4 · 5.775 km · 7 turns, F1DB’s figures · 1972 · 1 round',
    )
    // A venue that has never held a round: no years, no rounds run, only the one to come.
    assert.equal(
      outlineCaption({ f1db_layout_id: 'madring-1', length_km: 5.47, turns: 22, first_year: null, last_year: null, rounds: 0, scheduled: 1 }),
      'F1DB layout madring-1 · 5.47 km · 22 turns, F1DB’s figures · 1 round to come',
    )
    // A race page's card: no years, no rounds.
    assert.equal(outlineCaption({ f1db_layout_id: 'sepang-1', length_km: 5.543, turns: 15 }), 'F1DB layout sepang-1 · 5.543 km · 15 turns, F1DB’s figures')
    assert.equal(outlineCaption({ f1db_layout_id: 'x-1', length_km: null, turns: null }), 'F1DB layout x-1')
  })
})
