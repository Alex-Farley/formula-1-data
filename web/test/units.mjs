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

import { MIN_ROWS, cellText, shared, sharedLine } from '../src/lib/table.js'
import { captureStaticTables, staticRows } from '../src/lib/handover.js'

import {
  fieldText,
  fileName,
  headerOf,
  toCsv,
  toTsv,
  writtenColumns,
} from '../src/lib/takeaway.js'

import {
  CURRENT_SEASON_SQL,
  anyThisSeason,
  calendarLabel,
  gridLabel,
  seasonOf,
} from '../src/lib/season.js'

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
import { emptyTimingTableRead } from '../src/lib/sql.js'
import { trackPath } from '../src/lib/track.js'
import { DRIVER_COLUMNS } from '../src/queries/drivers.js'
import { holderPath } from '../src/queries/records.js'
import { EXPLAINED_FOOTER, OPEN_FOOTER, allExplained } from '../src/lib/disagreement.js'
import { clock, eventDay, nextSession, raceStage, until, utc } from '../src/queries/sessions.js'
import {
  SEASON_COLUMNS,
  careerSentence,
  derivedAndPublished,
  lede,
  pointsDiffer,
  record,
  seasonRows,
  seasonsNote,
  strip,
} from '../src/queries/driver.js'
import {
  constructorsFooter,
  latestRound,
  noConstructorsNote,
  roundName,
  roundResult,
  roundWinner,
  standingsHeading,
  stillRunning,
  titleHeading,
  titlePermutations,
} from '../src/queries/season.js'
import { SEASONS_COLUMNS, soFar } from '../src/queries/seasons.js'
import { raceWinner } from '../src/queries/races.js'
import { entered } from '../src/queries/constructors.js'
import { traced } from '../src/queries/circuits.js'
import { chassisName } from '../src/queries/cars.js'
import { PIT_COLUMNS, driverName, fastestLapMark, inClassificationOrder, outcome, position, raceLede, raceSentence, railOf, scheduledNote } from '../src/queries/race.js'
import { RACE_COLUMNS, raceWinnerHere } from '../src/queries/circuit.js'
import { SEASON_COLUMNS as TEAM_SEASON_COLUMNS } from '../src/queries/constructor.js'
import { constructorSeasons } from '../src/queries/constructor.js'
import { DIGEST_NOTE, NOT_YET_RUN, citation } from '../src/lib/site.js'
import { seasonComplete, seasonHeading, seasonStrip, stillToRunNote } from '../src/queries/home.js'
import {
  LIVERIES,
  LIVERY_ERA,
  SPONSOR_ERA,
  colourForEntry,
  colourSource,
  inColourEra,
  liveryAccents,
  liveryFor,
  liveryPair,
  liveryPrimary,
  winnerColour,
} from '../src/lib/liveries.js'
import { teamsByDriver } from '../src/queries/season.js'
import {
  NEXT,
  OUTLINE_LEAD_NOTE,
  RUN,
  TO_COME,
  circuitOutlinesNote,
  leadOutline,
  outlineCaption,
  outlineFigures,
  roundShortName,
  roundStates,
} from '../src/lib/outline.js'
import { attribution, canShow, fileTitle, thumbUrl } from '../src/lib/commons.js'
import { recordColumns, tiersOf } from '../src/queries/records.js'
import { clearState, oneOf, readState, writeState } from '../src/lib/urlstate.js'

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

  // AF-01. schema.org reads a bare date in the event's own frame, so the day
  // a race page states is the circuit's day - the Saturday Las Vegas races on,
  // not the Sunday it is in UTC.
  it("states the day the race happens where it happens, not the UTC one", () => {
    assert.equal(eventDay(rows, '2026-11-22'), '2026-11-21')
    assert.equal(eventDay([], '1976-08-15'), '1976-08-15', 'a round with no timetable keeps date_iso')
    assert.equal(
      eventDay([{ kind: 'race', start_utc: 'not a time', zone: 'America/Los_Angeles' }], '2026-11-22'),
      '2026-11-22',
      'and so does one whose timetable cannot be read',
    )
    assert.equal(
      eventDay([{ kind: 'race', start_utc: null, zone: 'America/Los_Angeles' }], '2026-11-22'),
      '2026-11-22',
      'a null start is not the epoch',
    )
    assert.equal(
      eventDay([{ kind: 'race', start_utc: '2026-11-22T04:00Z', zone: 'Mars/Olympus_Mons' }], '2026-11-22'),
      '2026-11-22',
      'and a zone nobody knows falls back rather than throwing',
    )
    assert.equal(
      eventDay([{ kind: 'race', start_utc: '2026-03-08T04:00Z', zone: 'Australia/Melbourne' }], '2026-03-08'),
      '2026-03-08',
      'a race whose two frames agree states the day both of them hold',
    )
  })

  /*
   * AF-01. `status` says whether a classification is held; this says whether
   * the race has happened, which is the question the page was answering wrong
   * for the twenty-three hours between a flag and a harvest.
   */
  it('says whether a scheduled race has happened yet, from the clock and not the record', () => {
    const race = { year: 2026, status: 'scheduled', date_iso: '2026-11-22' }
    assert.equal(raceStage(race, rows, Date.parse('2026-11-22T03:59Z')), 'awaited')
    assert.equal(raceStage(race, rows, Date.parse('2026-11-22T04:00Z')), 'running')
    assert.equal(raceStage(race, rows, Date.parse('2026-11-22T06:59Z')), 'running')
    assert.equal(raceStage(race, rows, Date.parse('2026-11-22T07:00Z')), 'run')
    // No session is held for any round before the current season, so the date
    // alone has to answer - and `date_iso` is not held in one frame: this row
    // is the UTC day of a race run on the Saturday evening before it, while
    // Las Vegas 2027 carries the local Saturday. A full day past the end of
    // that date is after the race on either reading, and never during it.
    assert.equal(raceStage(race, [], Date.parse('2026-11-23T23:58Z')), 'awaited')
    assert.equal(raceStage(race, [], Date.parse('2026-11-24T00:00Z')), 'run')
    assert.equal(
      raceStage({ year: 2027, status: 'scheduled', date_iso: '2027-11-20' }, [], Date.parse('2027-11-21T00:30Z')),
      'awaited',
      'the local-Saturday reading of date_iso does not read as run four hours before the start',
    )
    assert.equal(
      raceStage({ ...race, date_iso: null }, [], Date.parse('2030-01-01T00:00Z')),
      'awaited',
      'an unreadable date is not evidence that anything happened',
    )
    assert.equal(
      raceStage(race, [{ kind: 'qualifying', start_utc: '2026-11-21T04:00Z' }], Date.parse('2026-11-21T12:00Z')),
      'awaited',
      'qualifying being over is not the race being over',
    )
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
    // A career that keeps the four results figures because one of them is
    // non-zero (PD-15): the OTHER three still show their zeros, which is the
    // whole reason the four are tested together rather than one by one.
    const placed = strip(
      { first_season: 1963, last_season: 1976, titles: 0 },
      { entries: 96, seasons: 13, starts: 96, wins: 0, podiums: 3, best: 2 },
    )
    assert.deepEqual(
      placed.map((i) => i.label),
      ['Seasons', 'Entries', 'Wins', 'Podiums', 'Poles', 'Fastest laps', 'Best finish'],
    )
    // A driver with three podiums has zero wins, not an unknown number.
    assert.equal(placed.find((i) => i.label === 'Wins').value, '0')
    assert.equal(placed.find((i) => i.label === 'Seasons').note, '13 with an entry')

    const none = strip(
      { first_season: 1963, last_season: 1976, titles: 0 },
      { entries: 96, seasons: 13, starts: 96, best: null },
    )
    assert.equal(none.find((i) => i.label === 'Best finish').value, null)
    assert.equal(
      none.find((i) => i.label === 'Titles'),
      undefined,
      'no title, no tile',
    )
  })

  it('drops the four results figures where all four are zero, and puts something there instead (PD-15)', () => {
    // Beppe Gabbiani, the smoke test's representative of the 625 driver pages
    // of 862 on which Wins, Podiums, Poles and Fastest laps are all zero, as
    // f1.db counts him: 17 entries, 3 of them starts, 79 laps, 3 retirements,
    // best grid 20, 2 constructors, never classified.
    const winless = strip(
      { first_season: 1978, last_season: 1981, titles: 0 },
      {
        entries: 17,
        seasons: 3,
        starts: 3,
        wins: 0,
        podiums: 0,
        poles: 0,
        fastest_laps: 0,
        best: null,
        best_grid: 20,
        starts_without_grid: 0,
        laps: 79,
        starts_without_laps: 0,
        retirements: 3,
        constructors: 2,
        entries_without_constructor: 0,
      },
    )
    const label = (name) => winless.find((i) => i.label === name)
    assert.deepEqual(
      ['Wins', 'Podiums', 'Poles', 'Fastest laps'].filter(label),
      [],
      'four zeros summarise nothing and are not shown',
    )
    assert.equal(label('Starts').value, '3')
    assert.equal(label('Starts').note, '14 did not start')
    assert.equal(label('Best grid').value, 'P20')
    assert.equal(label('Laps').value, '79')
    assert.equal(label('Retirements').value, '3')
    assert.equal(label('Constructors').value, '2')
    // THE DENOMINATOR IS STARTS, NOT ENTRIES. All three of Gabbiani's starts
    // have a grid and a lap count; the fourteen entries that have neither are
    // the races he did not qualify for, where there is nothing to record. A
    // note here would report an absence as a gap in the data.
    assert.deepEqual(
      ['Best grid', 'Laps', 'Constructors'].map((n) => label(n).note),
      [undefined, undefined, undefined],
    )

    // Andre Pilette and Henry Banks, where there IS a gap: one start with no
    // grid and one with no lap count on the first, and two of three entries
    // naming no constructor at all on the second.
    const gaps = strip(
      { first_season: 1951, last_season: 1964, titles: 0 },
      { entries: 14, seasons: 7, starts: 9, best: 5, best_grid: 8, starts_without_grid: 1,
        laps: 281, starts_without_laps: 1, retirements: 2, constructors: 7, entries_without_constructor: 0 },
    )
    assert.equal(gaps.find((i) => i.label === 'Best grid').note, '1 start with no grid recorded')
    assert.equal(gaps.find((i) => i.label === 'Laps').note, '1 start with no lap count')
    const unnamed = strip(
      { first_season: 1950, last_season: 1952, titles: 0 },
      { entries: 3, seasons: 3, starts: 3, best: 6, best_grid: 12, starts_without_grid: 0,
        laps: 496, starts_without_laps: 0, retirements: 0, constructors: 1, entries_without_constructor: 2 },
    )
    assert.equal(unnamed.find((i) => i.label === 'Constructors').note, 'no constructor on 2 entries')
    assert.equal(unnamed.find((i) => i.label === 'Retirements').value, '0', 'three starts, none retired')
    // The note names the code the table below shows. Under a zero there are
    // no rows to match it to, so it is the source code printed for its own
    // sake - which is what a note is not for.
    assert.equal(unnamed.find((i) => i.label === 'Retirements').note, undefined)
    assert.equal(gaps.find((i) => i.label === 'Retirements').note, 'DNF', 'and it is there where there are rows')

    // Starts restates Entries where no entry failed to become one, so the
    // tile is not there: 417 of the 862 careers.
    const everyStart = strip({ first_season: 2007, last_season: 2012, titles: 1 }, { entries: 100, seasons: 6, starts: 100, wins: 21, best: 1 })
    assert.equal(everyStart.find((i) => i.label === 'Starts'), undefined)
    // ...and a winner keeps the four, so none of the substitutes appears.
    assert.deepEqual(
      ['Best grid', 'Laps', 'Retirements', 'Constructors'].filter((n) => everyStart.find((i) => i.label === n)),
      [],
    )

    // The two drivers in the register with no entry at all: nothing is
    // invented for them. Retirements needs a start, Constructors a
    // constructor, and Best grid a grid - so the strip says what is true and
    // stops, rather than reporting four zeros and three more.
    const noEntry = strip({ first_season: 2012, last_season: 2012, titles: 0 }, { entries: 0, seasons: 0, starts: 0, best: null })
    assert.deepEqual(
      noEntry.filter((i) => i.value !== null).map((i) => i.label),
      ['Seasons', 'Entries'],
    )
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

  it('labels the stored figures as published, and shows a row only where there is a figure or a fact', () => {
    const pairs = Object.fromEntries(record({ wins: 8, wins_external: 8, poles: 5, poles_external: null, entries: null }))
    // A published entry count exists for 38 of the 862 drivers; the rest get
    // no row rather than an em dash claiming nobody established the figure
    // the strip above counts (CD-37).
    assert.equal('Entries (published)' in pairs, false)
    assert.equal('Starts (published)' in pairs, false)
    assert.equal('Entries (stored)' in pairs, false)
    assert.equal(Object.fromEntries(record({ entries: 91, starts: 90 }))['Entries (published)'], '91')
    assert.equal(Object.fromEntries(record({ entries: 91, starts: 90 }))['Starts (published)'], '90')
    // Zero is a published figure, and a published zero is not a blank.
    assert.equal(Object.fromEntries(record({ entries: 0 }))['Entries (published)'], '0')
    assert.equal(pairs.Wins, '8 derived · 8 published')
    assert.equal(pairs.Poles, '5 derived')
    assert.equal('Provenance' in pairs, false)
    assert.equal(Object.fromEntries(record({ provenance: 'harvest' })).Provenance, 'harvest')
    assert.equal(derivedAndPublished(null, 3), '— derived · 3 published')
  })

  it('drops Died where the register says the driver is alive, and keeps it where it does not (CD-37)', () => {
    const died = (driver) => Object.fromEntries(record(driver))
    assert.equal('Died' in died({ status: 'active' }), false)
    assert.equal('Died' in died({ status: 'retired' }), false)
    // A death whose date nobody has established: 10 of the 441 deceased rows,
    // and the one place on this row where the em dash means what it says.
    assert.equal(died({ status: 'deceased', died: null }).Died, EMPTY)
    assert.equal(died({ status: 'deceased', died: '1994-05-01' }).Died, '1994-05-01')
    // 111 rows carry no status at all, and nothing is established either way.
    assert.equal(died({ status: '' }).Died, EMPTY)
    assert.equal(died({}).Died, EMPTY)
  })

  it('opens a driver page on the career the records hold, or on the note where one is written (PD-16)', () => {
    const many = { entries: 88, first_year: 1979, last_year: 1986, wins: 0, podiums: 0, poles: 0, best: 4 }
    assert.equal(
      careerSentence(many, ['Arrows', 'Brabham', 'Ensign', 'Osella', 'RAM', 'Theodore', 'Tyrrell'], 0),
      'Entered 88 championship Grands Prix across 1979–1986 for Arrows, Brabham and 5 other constructors; best finish 4th.',
    )
    // One entry, one season, one constructor: every plural and the span
    // collapse together, and 618 of the 699 pages this writes are short careers.
    assert.equal(
      careerSentence({ entries: 1, first_year: 1952, last_year: 1952, best: null }, ['Veritas'], 0),
      'Entered 1 championship Grand Prix in 1952 for Veritas; no classified finish.',
    )
    // A winner is described by what they won, never by a best finish of 1st.
    assert.equal(
      careerSentence({ entries: 51, first_year: 1950, last_year: 1958, wins: 24, podiums: 35, poles: 29, best: 1 }, ['Alfa Romeo', 'Maserati', 'Mercedes'], 5),
      'Entered 51 championship Grands Prix across 1950–1958 for Alfa Romeo, Maserati and Mercedes; 5 world titles, 24 wins, 35 podiums and 29 poles.',
    )
    assert.equal(
      careerSentence({ entries: 2, first_year: 1960, last_year: 1960, podiums: 1, best: 3 }, [], 0),
      'Entered 2 championship Grands Prix in 1960; 1 podium, best finish 3rd.',
    )
    // `titles` is DEFAULT 0 and the strip never leads a zero; nor does this.
    assert.ok(!careerSentence({ entries: 3, first_year: 1958, last_year: 1958, wins: 1, best: 1 }, ['Cooper'], 0).includes('world title'))
    // 377 entries name no constructor, and two register rows have no entry at all.
    assert.equal(careerSentence({ entries: 0 }, [], 0), 'No championship race entry in the records.')
    assert.equal(careerSentence(undefined, [], 0), 'No championship race entry in the records.')

    // The override, and what counts as one. A note is judgement the SQL does
    // not have; whitespace is not a note.
    const derived = { entries: 1, first_year: 1952, last_year: 1952, best: null }
    assert.equal(lede({ notes: 'Killed at Imola.', titles: 3 }, derived, ['Veritas']), 'Killed at Imola.')
    assert.equal(lede({ notes: '  Killed at Imola.  ', titles: 3 }, derived, ['Veritas']), 'Killed at Imola.')
    for (const notes of [null, undefined, '', '   ']) {
      assert.equal(
        lede({ notes, titles: 0 }, derived, ['Veritas']),
        'Entered 1 championship Grand Prix in 1952 for Veritas; no classified finish.',
        `a ${JSON.stringify(notes)} note falls through to the records`,
      )
    }
  })

  // PD-28. The claim is arithmetic on figures the reader cannot see, so what
  // matters is where it declines to make one: the tests below are mostly the
  // nulls.
  it('works out who can still win, and says nothing where the arithmetic will not carry', () => {
    const live = { races: 2, sprints: 1, run: 21, dropped_scores: 'None', available: 58 }
    const table = [
      { entity: 'Antonelli', position: 1, points: 300 },
      { entity: 'Russell', position: 2, points: 250 },
      { entity: 'Hamilton', position: 3, points: 200 },
      { entity: 'Norris', position: 4, points: 100 },
    ]
    const said = titlePermutations({ drivers: table, remaining: live, afterRound: 21, built: '2026-09-16' })
    // 58 available: Hamilton is exactly 100 behind and out, Russell is 50
    // behind and in. A driver who can only draw level is counted in, because
    // the countback this does not do is what would settle that.
    assert.match(said, /^Who can still win the drivers' title: Antonelli and Russell\./)
    assert.match(said, /2 rounds and 1 sprint still to run, so 58 points are still available/)
    assert.match(said, /Counted after round 21, from the database built 2026-09-16\./)
    assert.match(said, /a tie at the top is settled on wins/)

    // Exactly level with the last available point is still in.
    assert.match(
      titlePermutations({ drivers: [table[0], { entity: 'Level', position: 2, points: 242 }], remaining: live, afterRound: 21 }),
      /: Antonelli and Level\./,
    )
    // One driver left in is the title decided, and it says so rather than
    // printing a list of one.
    assert.equal(
      titlePermutations({ drivers: [table[0], table[3]], remaining: live, afterRound: 21 }).split(' 2 rounds')[0],
      "Only Antonelli can still win the drivers' title: no other driver can now reach that total.",
    )
    // More than ten still in: the count is the answer, not the names.
    const crowd = Array.from({ length: 12 }, (_, i) => ({ entity: `D${i}`, position: i + 1, points: 300 - i }))
    assert.match(
      titlePermutations({ drivers: crowd, remaining: live, afterRound: 21 }),
      /^Every driver who has scored can still reach the leader's total\./,
    )
    // Eleven in and one out: the count, because eleven names is not a sentence.
    assert.match(
      titlePermutations({ drivers: [...crowd, { entity: 'Out', position: 13, points: 1 }], remaining: live, afterRound: 21 }),
      /^12 of the 13 drivers who have scored can still reach the leader's total\./,
    )
    // No round left, a dropped-scores season, and a table too short to have a
    // gap in it: three different reasons to say nothing at all.
    assert.equal(titlePermutations({ drivers: table, remaining: { ...live, races: 0 }, afterRound: 23 }), null)
    assert.equal(
      titlePermutations({ drivers: table, remaining: { ...live, dropped_scores: 'Best 6 of 10' }, afterRound: 8 }),
      null,
    )
    assert.equal(titlePermutations({ drivers: [table[0]], remaining: live, afterRound: 21 }), null)
    assert.equal(titlePermutations({ drivers: table, remaining: null, afterRound: 21 }), null)
    // The calendar and the standings are harvested apart. A table that stands
    // after round 21 while 22 have run would be measured against one race too
    // few, so the claim is withheld rather than made a round out of date - and
    // so it is where no round has been counted at all.
    assert.equal(titlePermutations({ drivers: table, remaining: { ...live, run: 22 }, afterRound: 21 }), null)
    assert.equal(titlePermutations({ drivers: table, remaining: live, afterRound: null }), null)
    // A driver with points and no position was excluded from the
    // classification: not the leader to catch, and not someone to catch.
    assert.equal(
      titlePermutations({
        drivers: [{ entity: 'Excluded', position: null, points: 900 }, table[0], table[1]],
        remaining: live,
        afterRound: 21,
      }).split('.')[0],
      "Who can still win the drivers' title: Antonelli and Russell",
    )
  })

  it('tells a constructor a gap from a chassis-engine pair', () => {
    assert.match(constructorsFooter(false), /^The gap is to the highest points total classified/)
    assert.match(constructorsFooter(false), /before 1991 it is a difference of net totals/)
    assert.match(constructorsFooter(true), /net totals, dropped scores and all\. The championship is contested by a chassis–engine pair/)
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
    // The three result columns beside that cell say nothing rather than
    // dashing a fact about a race nobody has run (CD-37).
    assert.equal(roundResult('Red Bull Racing', { status: 'completed' }), 'Red Bull Racing')
    assert.equal(roundResult(null, { status: 'completed' }), EMPTY)
    assert.equal(roundResult(null, { status: 'scheduled' }), '')
    assert.equal(roundResult('Red Bull Racing', { status: 'scheduled' }), '')
    // Why a constructors' table is empty: before 1958 it did not exist, and
    // on a calendar nobody has raced it has not happened yet (CD-32).
    assert.equal(noConstructorsNote(1952, false).body, 'It was not contested until 1958.')
    assert.equal(noConstructorsNote(2027, true).head, 'Not yet run.')
    assert.match(noConstructorsNote(2027, true).body, /No round of the 2027 calendar/)
    assert.equal(noConstructorsNote(1975, false).head, "No constructors' standings.")
    assert.equal(roundName('Chinese Grand Prix', { sprint: 1 }), 'Chinese Grand Prix sprint')
    assert.equal(raceWinner('A', { status: 'completed', co_winner_id: 'b' }), 'A shared')
    assert.equal(raceWinner('A', { status: 'scheduled', co_winner_id: null }), NOT_YET_RUN)
    assert.equal(soFar('Antonelli', { undecided: 1 }), 'Antonelli so far')
    assert.equal(soFar('Norris', { undecided: 0 }), 'Norris')
    assert.equal(soFar(null, { undecided: 1 }), EMPTY)
    // A season whose calendar is out and whose first round has not run is
    // "not yet run", not an em dash: nobody is missing, nothing has happened.
    assert.equal(soFar(null, { undecided: 0, not_started: 1 }), NOT_YET_RUN)
    assert.equal(soFar('Norris', { undecided: 0, not_started: 1 }), NOT_YET_RUN)
    assert.equal(by(SEASONS_COLUMNS).rounds.text(23, { undecided: 1, run: 13 }), '13 of 23')
    assert.equal(by(SEASONS_COLUMNS).rounds.text(24, { undecided: 0, run: 24 }), '24')
    // Not "0 of 24": the calendar is the whole fact a season not yet run has.
    assert.equal(by(SEASONS_COLUMNS).rounds.text(24, { undecided: 0, not_started: 1, run: 0 }), '24')
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

  // CD-03. The sentence 1,194 race pages open on, and the description every
  // one of them carries. What matters is the cases the run of the mill hides:
  // a shared drive, an entry with no constructor, a round not yet run.
  it('says what happened at a race in one sentence, and lets a written note override it', () => {
    const monza = { year: 1988, status: 'completed', circuit: 'Monza', note: null }
    assert.equal(
      raceSentence(monza, [{ driver: 'Gerhard Berger', constructor_id: 'ferrari', constructor: 'Ferrari' }]),
      'Gerhard Berger won for Ferrari at Monza.',
    )
    // Three races were shared between two drivers in one car; both are
    // classified first, and both are credited here as they are below.
    assert.equal(
      raceSentence({ ...monza, circuit: 'Reims-Gueux' }, [
        { driver: 'Juan Manuel Fangio', constructor_id: 'alfa-romeo', constructor: 'Alfa Romeo' },
        { driver: 'Luigi Fagioli', constructor_id: 'alfa-romeo', constructor: 'Alfa Romeo' },
      ]),
      'Juan Manuel Fangio and Luigi Fagioli shared the win for Alfa Romeo at Reims-Gueux.',
    )
    // The eleven Indianapolis 500s: no constructor row holds the car, and
    // the entrant is what the classification's own column falls back to.
    assert.equal(
      raceSentence({ ...monza, circuit: 'Indianapolis Motor Speedway' }, [
        { driver: 'Johnnie Parsons', constructor_id: null, constructor: null, entrant: 'Kurtis Kraft-Offenhauser' },
      ]),
      'Johnnie Parsons won for Kurtis Kraft-Offenhauser at Indianapolis Motor Speedway.',
    )
    assert.equal(
      raceSentence({ ...monza, circuit: null }, [{ driver: null, driver_id: 'berger', constructor_id: null, constructor: null, entrant: null }]),
      'berger won.',
      'a sentence states only what it holds, rather than an empty clause',
    )
    assert.equal(
      raceSentence({ year: 2027, status: 'scheduled', circuit: 'Istanbul Park', dates: '01-03 Oct 2027', note: null }, []),
      'Scheduled for 01-03 Oct 2027 at Istanbul Park; not yet run.',
    )
    assert.equal(
      raceSentence({ year: 2027, status: 'scheduled', circuit: null, dates: null, note: null }, []),
      'Scheduled; not yet run.',
    )
    // AF-01: once the clock says the race has been run, "not yet run" is the
    // one thing the sentence must not say - the round is still `scheduled`
    // because no classification has been loaded, which is what it says
    // instead. The note below the classification agrees with it.
    assert.equal(
      raceSentence({ year: 2027, status: 'scheduled', circuit: 'Istanbul Park', dates: '01-03 Oct 2027', note: null }, [], 'run'),
      'Scheduled for 01-03 Oct 2027 at Istanbul Park; no result is recorded yet.',
    )
    assert.equal(
      raceLede({ year: 2027, status: 'scheduled', circuit: 'Istanbul Park', dates: '01-03 Oct 2027', note: null }, [], 'running'),
      'Scheduled for 01-03 Oct 2027 at Istanbul Park; no result is recorded yet.',
    )
    const scheduledRound = { year: 2027, status: 'scheduled', circuit: 'Istanbul Park', dates: '01-03 Oct 2027', note: null }
    assert.equal(scheduledNote(scheduledRound).head, 'This race has not been run.')
    assert.equal(scheduledNote(scheduledRound).body, 'It is on the 2027 calendar and carries no result yet.')
    assert.equal(scheduledNote(scheduledRound, 'running').head, 'This race is under way.')
    assert.equal(scheduledNote(scheduledRound, 'run').head, 'This race has been run; the result is not here yet.')
    // No race is in this state today; a round part-way through being loaded
    // would be, and a thrown lede is worse than a plain sentence.
    assert.equal(raceSentence(monza, []), 'No winner is recorded for this round.')

    // The override, and what counts as one. Whitespace is not a note.
    const won = [{ driver: 'Gerhard Berger', constructor_id: 'ferrari', constructor: 'Ferrari' }]
    assert.equal(raceLede({ ...monza, note: 'Held on a Sunday in June.' }, won), 'Held on a Sunday in June.')
    assert.equal(raceLede({ ...monza, note: '  Held on a Sunday in June.  ' }, won), 'Held on a Sunday in June.')
    for (const note of [null, undefined, '', '   ']) {
      assert.equal(
        raceLede({ ...monza, note }, won),
        'Gerhard Berger won for Ferrari at Monza.',
        `a ${JSON.stringify(note)} note falls through to the records`,
      )
    }
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
      // The value is second: the record and its figure are the pair the
      // page is for, and the holder answers the question after that (VD-51).
      ['Record', 'Value', 'Holder', 'How it is derived', 'As of'],
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
  it('leads a circuit page with its latest layout and keeps the rest in order (VD-37)', () => {
    const ids = ({ lead, rest }) => [lead?.f1db_layout_id ?? null, rest.map((r) => r.f1db_layout_id)]
    const row = (id, latest) => ({ f1db_layout_id: id, latest })
    // Chronological in, the latest out in front, the rest untouched.
    assert.deepEqual(ids(leadOutline([row('a-1', 195007), row('a-2', 202609), row('a-3', 199508)])), ['a-2', ['a-1', 'a-3']])
    // One layout: the lead and nothing else.
    assert.deepEqual(ids(leadOutline([row('b-1', 202504)])), ['b-1', []])
    // A tie goes to the later row; a row no race names never beats one a race does.
    assert.deepEqual(ids(leadOutline([row('c-1', 202001), row('c-2', 202001)])), ['c-2', ['c-1']])
    assert.deepEqual(ids(leadOutline([row('d-1', 199001), row('d-2', null)])), ['d-1', ['d-2']])
    assert.deepEqual(ids(leadOutline([row('e-1', null)])), ['e-1', []])
    assert.deepEqual(ids(leadOutline([])), [null, []])
    assert.deepEqual(ids(leadOutline(undefined)), [null, []])
  })
  it('says why one outline is larger only where there is another to compare', () => {
    assert.ok(circuitOutlinesNote(8).endsWith(OUTLINE_LEAD_NOTE))
    assert.ok(!circuitOutlinesNote(1).includes(OUTLINE_LEAD_NOTE))
    assert.ok(circuitOutlinesNote(1).includes('not to scale'))
  })
})


describe('colourForEntry routes a constructor-season by era (AF-04)', () => {
  // Three eras, one call. Before 1968 the national convention; 1968-2009 a
  // declared gap that returns nothing rather than a guess; from 2010 the
  // livery map, or nothing for a constructor-season it does not carry. Each
  // branch is a claim the tooltip has to name, so the kind and the title are
  // checked too.
  it('names the constants the header describes', () => {
    assert.equal(SPONSOR_ERA, 1968)
    assert.equal(LIVERY_ERA, 2010)
  })
  it('a 1955 Ferrari wears rosso corsa as a national colour, through the --racing-* token', () => {
    const c = colourForEntry({ constructorId: 'ferrari', country: 'Italy', year: 1955, team: 'Ferrari' })
    assert.equal(c.kind, 'national')
    assert.equal(c.name, 'Rosso corsa')
    assert.equal(c.base, 'var(--racing-it)')
    assert.equal(c.light, 'var(--racing-it)')
    assert.equal(c.style['--livery'], 'var(--racing-it)')
    assert.match(c.title, /racing colour of Italy/)
  })
  it('a 1955 constructor from a country without a convention gets nothing', () => {
    assert.equal(colourForEntry({ constructorId: 'x', country: 'Argentina', year: 1955 }), null)
  })
  it('1968-2009 is nothing, whatever the country or constructor', () => {
    assert.equal(colourForEntry({ constructorId: 'ferrari', country: 'Italy', year: 1968 }), null)
    assert.equal(colourForEntry({ constructorId: 'mclaren', country: 'United Kingdom', year: 1988 }), null)
    assert.equal(colourForEntry({ constructorId: 'ferrari', country: 'Italy', year: 2009 }), null)
  })
  it('from 2010 the livery, by constructor and season, named as the team names it', () => {
    const c = colourForEntry({ constructorId: 'mclaren', country: 'United Kingdom', year: 2026, team: 'McLaren' })
    assert.equal(c.kind, 'livery')
    assert.equal(c.name, 'Papaya')
    assert.match(c.light, /^#[0-9a-f]{6}$/)
    assert.match(c.claim, /as the team names it/)
    assert.equal(c.named, true)
    const w = colourForEntry({ constructorId: 'haas', country: 'United States', year: 2026, team: 'Haas F1 Team' })
    assert.equal(w.named, false)
    assert.match(w.claim, /as its sources describe it/)
  })
  it('a mark leads with the colour a team is recognised by, and says so; a season that never raced it leads with its primary (AF-45)', () => {
    // Mercedes raced silver in 2014 and is recognised by Petronas green: the
    // band names the livery Silver, the mark leads teal and says whose
    // reading that is, and still says the livery carries it.
    const merc = colourForEntry({ constructorId: 'mercedes', country: 'Germany', year: 2014, team: 'Mercedes' })
    assert.equal(merc.name, 'Silver')
    assert.equal(merc.style['--livery'], '#b5b9be')
    assert.equal(merc.mark['--livery'], '#0f9c94')
    assert.equal(merc.pair.accent.name, 'Silver')
    assert.equal(
      merc.title,
      "Petronas green — the colour Mercedes is recognised by, which is this site's reading rather than a source's; the 2014 livery carries it, as its sources describe it",
    )
    // The season's own shade leads, not the recognition hex.
    const rbr = colourForEntry({ constructorId: 'red-bull', country: 'Austria', year: 2020, team: 'Red Bull' })
    assert.deepEqual([rbr.pair.lead.name, rbr.pair.accent.name], ['Matte navy', 'Red'])
    const rbr26 = colourForEntry({ constructorId: 'red-bull', country: 'Austria', year: 2026, team: 'Red Bull' })
    assert.deepEqual([rbr26.pair.lead.base, rbr26.pair.accent.base], ['#1b2a5e', '#f2f2f2'])
    // McLaren's papaya is the team's own word, and says so.
    const mcl = colourForEntry({ constructorId: 'mclaren', country: 'United Kingdom', year: 2026, team: 'McLaren' })
    assert.match(mcl.title, /^Papaya — the colour McLaren is recognised by, .*the name is the team's own$/)
    // A chrome McLaren is chrome: no papaya on a car that did not race it.
    const chrome = colourForEntry({ constructorId: 'mclaren', country: 'United Kingdom', year: 2012, team: 'McLaren' })
    assert.equal(chrome.mark['--livery'], '#c0c4c9')
    assert.equal(chrome.title, 'Chrome — the colour McLaren raced in 2012, as its sources describe it')
    // Racing Bulls' blue is this project's pick, and borrows no source.
    const rb = colourForEntry({ constructorId: 'racing-bulls', country: 'Italy', year: 2025, team: 'Racing Bulls' })
    assert.equal(rb.mark['--livery'], '#2b4bd8')
    assert.equal(rb.title, "Blue — the colour Racing Bulls is recognised by, which is this site's reading rather than a source's")
    // An accent too near the lead is passed over for the next colour: no
    // real scheme has one yet, so a made-up entry proves the rule holds.
    const near = liveryPair({
      constructor: 'nobody',
      scheme: [
        { name: 'Navy', base: '#1b2a5e' },
        { name: 'Other navy', base: '#1f2c66' },
        { name: 'Red', base: '#d1262f' },
      ],
    })
    assert.deepEqual([near.lead.name, near.accent.name], ['Navy', 'Red'])
    assert.equal(liveryPair({ constructor: 'nobody', scheme: [{ name: 'A', base: '#1b2a5e' }, { name: 'B', base: '#1f2c66' }] }).accent, null)
    // Haas 2023-2024 moves from black to white.
    assert.equal(colourForEntry({ constructorId: 'haas', year: 2023, team: 'Haas' }).mark['--livery'], '#f4f4f4')
    assert.equal(liveryFor('mclaren', 2017).name, 'Tarocco orange')
    assert.equal(liveryFor('mclaren', 2014).name, 'Chrome')
    assert.equal(liveryFor('red-bull', 2026).name, 'Heritage white')
    assert.equal(liveryFor('red-bull', 2025).name, 'Matte navy')
  })
  it('a chart note names the kind of colour it actually drew, and never calls the convention the team\'s (AF-55)', () => {
    // The defect this exists to stop: a chart that mixes 2010+ liveries with
    // pre-1968 national colours told the reader both were "the team's
    // colour", on three of the fifteen constructors on /records and nineteen
    // driver pages. nationalEntry() claims the opposite in the same breath -
    // 'the convention, not the team's own livery' - so the note contradicted
    // the tooltip beside it.
    const livery = colourForEntry({ constructorId: 'ferrari', country: 'Italy', year: 2020, team: 'Ferrari' })
    const national = colourForEntry({ constructorId: 'vanwall', country: 'United Kingdom', year: 1958, team: 'Vanwall' })
    const gap = colourForEntry({ constructorId: 'brabham', country: 'United Kingdom', year: 1985, team: 'Brabham' })
    assert.equal(livery.kind, 'livery')
    assert.equal(national.kind, 'national')
    assert.equal(gap, null)

    // Liveries only: the team's own, and nothing about a convention the
    // chart never drew.
    assert.equal(colourSource([livery, livery]), "the team's own livery")
    // National only: never "the team's", and it says whose it is.
    assert.match(colourSource([national]), /country that entered the car/)
    assert.doesNotMatch(colourSource([national]), /the team's own livery$/)
    // Both: both named, and the national one still disclaimed.
    const both = colourSource([livery, national])
    assert.match(both, /livery of the team's own from 2010/)
    assert.match(both, /rather than one of the team's$/)
    // A hollow mark is a null in the list and changes none of the three
    // answers - the note describes it in a clause of its own.
    assert.equal(colourSource([livery, gap]), colourSource([livery]))
    assert.equal(colourSource([national, gap]), colourSource([national]))
    // No colour at all is the one case the sentence must never be printed
    // for, and both callers guard it: Driver.jsx on finishesInColour and
    // Records.jsx on bars.some(colour), each of which is false here.
    assert.equal([gap, gap].some((c) => c), false)
  })
  it('a livery is a primary and its accents, and the pair renders the mark\'s lead (AF-15, AF-57)', () => {
    // The defect AF-15 names: Haas and Racing Bulls both raced white in
    // 2025 and the mark drew the same grey for both. The primaries are
    // still the same white - AF-16 is what stops rendering it as grey -
    // but the schemes now differ, which is what tells the two apart.
    const haas = liveryFor('haas', 2025)
    const rb = liveryFor('racing-bulls', 2025)
    assert.equal(liveryPrimary(haas).name, 'White')
    assert.equal(liveryPrimary(rb).name, 'White')
    assert.equal(liveryPrimary(haas).base, liveryPrimary(rb).base)
    assert.notDeepEqual(
      liveryAccents(haas).map((c) => c.name),
      liveryAccents(rb).map((c) => c.name),
    )
    // The pair renders the LEAD, untouched by the accents (AF-57). Haas is
    // the case where the two coincide - its recognition colour IS its 2025
    // primary - so the assertion goes through liveryPair rather than
    // liveryPrimary, and says the rule rather than an entry that happens to
    // satisfy both. conventions.mjs holds all 59 entries to it; Racing
    // Bulls, whose 2025 lead is its blue and not its white, is the case
    // where they part.
    assert.equal(haas.light, '#898989')
    assert.equal(haas.dark, liveryPair(haas).lead.base)
    assert.equal(liveryPair(haas).lead.base, liveryPrimary(haas).base)
    assert.notEqual(liveryPair(rb).lead.base, liveryPrimary(rb).base)
  })
  it('a colour no cited page states is marked as this project\'s choice, and cannot also be the team\'s own word (AF-15)', () => {
    // Toro Rosso is navy, red and silver to a reader; the pages cited for
    // the 2010-2016 span name only the navy, so the other two say so. The
    // 2017-2019 entry is the control: the same two colours, both stated by
    // its own sources, both sourced.
    const str = liveryFor('toro-rosso', 2014)
    assert.equal(liveryPrimary(str).sourced, true)
    assert.deepEqual(
      liveryAccents(str).map((c) => [c.name, c.sourced, c.named]),
      [
        ['Red', false, false],
        ['Silver', false, false],
      ],
    )
    assert.equal(
      liveryAccents(liveryFor('toro-rosso', 2018)).every((c) => c.sourced),
      true,
    )
    // Nothing else in the map is unsourced; a new one is a deliberate act.
    assert.deepEqual(
      LIVERIES.flatMap((l) => l.scheme.filter((c) => !c.sourced).map((c) => `${l.constructor} ${l.from} ${c.name}`)),
      ['toro-rosso 2010 Red', 'toro-rosso 2010 Silver'],
    )
    // Audi names both of its own colours, so both are sourced.
    const audi = liveryFor('audi', 2026)
    assert.deepEqual(
      audi.scheme.filter((c) => c.named).map((c) => c.name),
      ['Titanium', 'Audi Red'],
    )
    assert.equal(audi.scheme.every((c) => !c.named || c.sourced), true)
  })
  it('colourForEntry carries the scheme through, and a national colour is a scheme of one (AF-15)', () => {
    const merc = colourForEntry({ constructorId: 'mercedes', country: 'Germany', year: 2024, team: 'Mercedes' })
    assert.deepEqual(
      merc.scheme.map((c) => c.name),
      ['Black', 'Silver', 'Petronas green'],
    )
    const national = colourForEntry({ constructorId: 'ferrari', country: 'Italy', year: 1955, team: 'Ferrari' })
    assert.equal(national.scheme.length, 1)
    assert.equal(national.scheme[0].base, 'var(--racing-it)')
  })
  it('a 2010+ constructor the map does not carry is nothing, not the national colour', () => {
    // This used to prove the fallback with Virgin 2012, a declared gap.
    // AF-09 sourced that season and emptied LIVERY_GAPS, so the unsourced
    // case is now a constructor with no entry at all - and Virgin 2012 is
    // asserted coloured here, so refilling the gap would fail this test.
    assert.equal(colourForEntry({ constructorId: 'nobody', country: 'United Kingdom', year: 2012 }), null)
    assert.equal(liveryFor('nobody', 2020), null)
    assert.equal(liveryFor('ferrari', Number.NaN), null)
    assert.equal(liveryFor('virgin', 2012).name, 'Black and red')
  })
  it('a spacer is drawn only in a season some row of which could carry a colour', () => {
    assert.equal(inColourEra(1955), true)
    assert.equal(inColourEra(1967), true)
    assert.equal(inColourEra(1968), false)
    assert.equal(inColourEra(2009), false)
    assert.equal(inColourEra(2010), true)
    assert.equal(inColourEra(undefined), false)
  })
  it('the strip marks a run round with a recorded winner and nothing else', () => {
    const run = { status: 'completed', winning_team_id: 'ferrari', winning_team_country: 'Italy', winning_team: 'Ferrari' }
    assert.equal(winnerColour(run, 2025).name, 'Rosso corsa')
    // The strip is a mark: a 2014 Mercedes win is Petronas green.
    const merc = { ...run, winning_team_id: 'mercedes', winning_team_country: 'Germany', winning_team: 'Mercedes' }
    assert.equal(winnerColour(merc, 2014).mark['--livery'], '#0f9c94')
    assert.equal(winnerColour(run, 1955).kind, 'national')
    assert.equal(winnerColour(run, 1990), null)
    assert.equal(winnerColour({ ...run, status: 'scheduled' }, 2025), null)
    assert.equal(winnerColour({ ...run, winning_team_id: null }, 2025), null)
  })
  it('teamsByDriver keeps the query order: the team a driver finished the season with comes first', () => {
    const map = teamsByDriver([
      { driver_id: 'a', constructor_id: 'red-bull', last_round: 24 },
      { driver_id: 'a', constructor_id: 'racing-bulls', last_round: 2 },
      { driver_id: 'b', constructor_id: 'ferrari', last_round: 24 },
    ])
    assert.deepEqual(map.get('a').map((t) => t.constructor_id), ['red-bull', 'racing-bulls'])
    assert.deepEqual(map.get('b').map((t) => t.constructor_id), ['ferrari'])
    assert.equal(map.get('c'), undefined)
  })
})

describe('one season, one label, on all four registers (IA-19)', () => {
  // The words. smoke.mjs reads them off the four running registers; what it
  // cannot reach is the branch taken when a register's rows do not carry the
  // season, which is a query that changed without its page.
  it('names the season, and says the concept plainly without one', () => {
    assert.equal(gridLabel(2026), 'On the 2026 grid')
    assert.equal(calendarLabel(2026), 'On the 2026 calendar')
    assert.equal(gridLabel(null), 'On the grid')
    assert.equal(calendarLabel(undefined), 'On the calendar')
  })

  // The season is a global that rides on every row, so the first row answers
  // for all of them - and an empty register has no season rather than a zero.
  it('reads the season off the rows, under either name', () => {
    assert.equal(seasonOf([{ grid_season: 2026 }, { grid_season: 2026 }]), 2026)
    assert.equal(seasonOf([{ calendar_season: 2026 }]), 2026)
    assert.equal(seasonOf([]), null)
    assert.equal(seasonOf([{ wins: 0 }]), null)
  })

  // IX-31: a filter whose only possible outcome is an empty table makes a
  // claim about the database in the database's voice. Between the declaration
  // of a season and its first entry there is nothing to keep, so there is no
  // control either.
  it('offers the control only where the register has rows for that season', () => {
    assert.equal(anyThisSeason([{ on_grid: 0 }, { on_grid: 1 }], 'on_grid'), true)
    assert.equal(anyThisSeason([{ on_grid: 0 }, { on_grid: 0 }], 'on_grid'), false)
    assert.equal(anyThisSeason([], 'on_calendar'), false)
  })

  // The anchor is meta.current_season and nothing else: the register already
  // carries next season's calendar, so a MAX() over the records names a season
  // nobody has run (CR-07).
  it('anchors on the declared season, never a MAX() over the records', () => {
    assert.match(CURRENT_SEASON_SQL, /meta WHERE key = 'current_season'/)
    assert.doesNotMatch(CURRENT_SEASON_SQL, /MAX/i)
  })
})


// ------------------------------------------------- columns holding nothing

describe('a column every row agrees on (VD-29)', () => {
  // Monza: five columns, of which the Grand Prix is "Italian Grand Prix" on
  // every row and the layout is not established on any of them.
  const monza = [
    { year: 1950, name_used: 'Italian Grand Prix', layout_key: null, winner: 'Nino Farina' },
    { year: 1951, name_used: 'Italian Grand Prix', layout_key: null, winner: 'Alberto Ascari' },
    { year: 1952, name_used: 'Italian Grand Prix', layout_key: null, winner: 'Alberto Ascari' },
    { year: 1953, name_used: 'Italian Grand Prix', layout_key: null, winner: 'Juan Manuel Fangio' },
    { year: 1954, name_used: 'Italian Grand Prix', layout_key: null, winner: 'Juan Manuel Fangio' },
  ]
  // As queries/circuit.js declares them: the Grand Prix cell links each row to
  // a different race, so it is not a candidate however alike the rows read.
  const columns = [
    { key: 'year', label: 'Season' },
    { key: 'name_used', label: 'Grand Prix' },
    { key: 'layout_key', label: 'Layout', collapse: true },
    { key: 'winner', label: 'Winner' },
  ]

  it('drops a declared column from the table and states it once', () => {
    const { columns: kept, shared: constants } = shared(columns, monza)
    assert.deepEqual(kept.map((c) => c.key), ['year', 'name_used', 'winner'])
    assert.deepEqual(constants.map((c) => c.column.key), ['layout_key'])
    // An em dash in a cell reads against the cells around it; in a sentence it
    // has nothing to read against, so it is written out.
    assert.equal(sharedLine(constants, monza.length), 'The same on all 5 rows: Layout — not established.')
    assert.equal(
      sharedLine([{ column: columns[1], value: 'Italian Grand Prix' }], 76),
      'The same on all 76 rows: Grand Prix — Italian Grand Prix.',
    )
  })

  // The whole reason the flag is on the column rather than derived by each
  // renderer: the app protects a cell with a React `render` and prerender with
  // an entry in its `links` map, and those are two different lists.
  it('leaves an undeclared column alone however alike its rows read', () => {
    assert.deepEqual(shared(columns, monza).columns.map((c) => c.key), ['year', 'name_used', 'winner'])
    const declared = columns.map((c) => (c.key === 'name_used' ? { ...c, collapse: true } : c))
    assert.deepEqual(shared(declared, monza).shared.map((s) => s.column.key), ['name_used', 'layout_key'])
  })

  it('says nothing about a short table, or about one it would leave a column wide', () => {
    assert.deepEqual(shared(columns, monza.slice(0, MIN_ROWS - 1)).shared, [])
    const pair = monza.map((_, i) => ({ a: i, b: 'same' }))
    assert.deepEqual(
      shared([{ key: 'a' }, { key: 'b', collapse: true }], pair).columns.map((c) => c.key),
      ['a', 'b'],
    )
  })

  // The column's own formatter, not the raw value: two rows can hold the same
  // `first_win` and a different span, and a formatter reads the whole row.
  it('compares what the cell prints, not what the row stores', () => {
    const column = {
      key: 'first_win',
      label: 'Span',
      collapse: true,
      text: (_, row) => `${row.first_win}-${row.last_win}`,
    }
    const rows = [
      { driver: 'Ascari', first_win: 1950, last_win: 1953 },
      { driver: 'Fangio', first_win: 1950, last_win: 1958 },
      { driver: 'Moss', first_win: 1950, last_win: 1960 },
      { driver: 'Brooks', first_win: 1950, last_win: 1961 },
      { driver: 'Hawthorn', first_win: 1950, last_win: 1962 },
    ]
    const columns = [{ key: 'driver', label: 'Driver' }, column, { key: 'first_win', label: 'First', collapse: true }]
    assert.equal(cellText(column, rows[0]), '1950-1953')
    assert.deepEqual(shared(columns, rows).shared.map((s) => s.column.label), ['First'])
  })

  // The columns the repository declares, in the four modules that declare
  // any. That nobody draws one of them is not checkable from here - a
  // `render` is written in a page and a link in prerender's own map - so it
  // is a conventions test and a build failure instead; see
  // test/conventions.mjs and fromColumns() in scripts/prerender.js.
  it('is declared on the columns that are their text, and on no others', () => {
    const declared = [
      ...RACE_COLUMNS,
      ...SEASON_COLUMNS,
      ...TEAM_SEASON_COLUMNS,
      ...PIT_COLUMNS,
      ...recordColumns([{ confidence: 'reference' }]),
    ].filter((c) => c.collapse === true)
    assert.deepEqual(
      declared.map((c) => c.key),
      ['layout_key', 'wins', 'podiums', 'poles', 'fastest_laps', 'wins', 'podiums', 'poles', 'source', 'as_of'],
    )
  })
})
describe('a register in the address bar', () => {
  const DEFAULTS = { q: '', kind: '', traced: false, decade: '2020' }
  const params = (query) => new URLSearchParams(query)

  it('takes each default where the URL is silent', () => {
    assert.deepEqual(readState(params(''), DEFAULTS), {
      q: '',
      kind: '',
      traced: false,
      decade: '2020',
    })
  })

  it('reads a string, and a toggle as present-or-not', () => {
    const state = readState(params('q=senna&kind=winners&traced=1&decade=1970'), DEFAULTS)
    assert.deepEqual(state, { q: 'senna', kind: 'winners', traced: true, decade: '1970' })
    // Anything but "1" is not the toggle being pressed. `?traced=0` and
    // `?traced=false` both read false rather than truthy-string true.
    assert.equal(readState(params('traced=0'), DEFAULTS).traced, false)
    assert.equal(readState(params('traced=false'), DEFAULTS).traced, false)
  })

  it('does not write a default down', () => {
    // `/drivers` stays `/drivers`, and clearing one filter takes its
    // parameter out rather than leaving `?kind=` behind.
    assert.equal(String(writeState(params(''), { q: '', kind: '' }, DEFAULTS)), '')
    assert.equal(String(writeState(params('kind=winners'), { kind: '' }, DEFAULTS)), '')
    assert.equal(String(writeState(params('traced=1'), { traced: false }, DEFAULTS)), '')
    assert.equal(String(writeState(params('decade=1970'), { decade: '2020' }, DEFAULTS)), '')
  })

  it('writes what was actually asked for', () => {
    assert.equal(String(writeState(params(''), { q: 'senna' }, DEFAULTS)), 'q=senna')
    assert.equal(String(writeState(params(''), { traced: true }, DEFAULTS)), 'traced=1')
    assert.equal(
      String(writeState(params('q=senna'), { kind: 'winners' }, DEFAULTS)),
      'q=senna&kind=winners',
    )
  })

  it('leaves a parameter it was not given to hold', () => {
    // The declared keys are the only ones this touches: a statement in the
    // SQL console's `?q=` is another page's business, and so is anything a
    // link arrives with.
    assert.equal(String(writeState(params('utm=x'), { kind: 'winners' }, DEFAULTS)), 'utm=x&kind=winners')
    assert.equal(String(clearState(params('utm=x&q=senna&traced=1'), DEFAULTS)), 'utm=x')
  })

  it('clear-all drops the declared set', () => {
    assert.equal(String(clearState(params('q=senna&kind=winners&traced=1'), DEFAULTS)), '')
  })

  // A parameter a reader can type is a parameter that can be wrong. Filtering
  // on a value no row carries would empty the register while the select
  // beside it went on reading "Every nationality" - the control and the table
  // disagreeing about what had been asked.
  it('refuses a value the data does not vouch for', () => {
    assert.equal(oneOf('Italy', ['Italy', 'Brazil']), 'Italy')
    assert.equal(oneOf('Ruritania', ['Italy', 'Brazil']), '')
    assert.equal(oneOf('winners', [['', 'All'], ['winners', 'Race winners']]), 'winners')
    assert.equal(oneOf('nonsense', [['', 'All'], ['winners', 'Race winners']]), '')
    // A register whose default is not the empty one falls back to its own.
    assert.equal(oneOf('1730', ['2020', '2010'], '2020'), '2020')
    assert.equal(oneOf('2010', ['2020', '2010'], '2020'), '2010')
  })
})

/*
 * IX-26. The file a reader takes away, which is the one artefact of this site
 * that has to stand up with no page around it. Every rule it follows is a
 * deliberate difference from the rendered cell (lib/takeaway.js), and each one
 * is the kind that reads as working until the row that breaks it turns up:
 * the driver called O'Ward, the constructor with a comma in its name, the
 * assessment with a newline in it, the column of 27,482.
 */
describe('a table as a file (IX-26)', () => {
  const columns = [
    { key: 'full_name', label: 'Driver' },
    { key: 'entries', label: 'Entries' },
    { key: 'first_season', label: 'First season' },
  ]
  const rows = [
    { full_name: 'Ayrton Senna', entries: 162, first_season: 1984 },
    { full_name: 'Pastor Maldonado', entries: 95, first_season: null },
  ]

  it('writes the header the table shows, and humanises a column that gave none', () => {
    assert.equal(headerOf({ key: 'full_name', label: 'Driver' }), 'Driver')
    assert.equal(headerOf({ key: 'pole_to_win' }), 'Pole to win')
  })

  it('writes a number unformatted: a spreadsheet reading "27,482" gets a string', () => {
    assert.equal(fieldText({ key: 'n' }, { n: 27482 }), '27482')
    assert.equal(fieldText({ key: 'n' }, { n: 1950 }), '1950')
    // And the rendered cell does not, which is the point of the difference.
    assert.equal(text(27482), '27,482')
  })

  it('carries an em dash for a value nobody has established, never a blank', () => {
    assert.equal(fieldText({ key: 'n' }, { n: null }), EMPTY)
    assert.equal(fieldText({ key: 'n' }, { n: undefined }), EMPTY)
    assert.equal(fieldText({ key: 'n' }, { n: '' }), EMPTY)
    // A zero is a zero. It is the one value the em dash never means.
    assert.equal(fieldText({ key: 'n' }, { n: 0 }), '0')
  })

  it("takes a column's own formatter where it has one, so the file and the page agree", () => {
    const spanned = { key: 'from', text: (_value, row) => span(row.from, row.to) }
    assert.equal(fieldText(spanned, { from: 1950, to: 1958 }), '1950–1958')
    assert.equal(fieldText(spanned, { from: 1950, to: null }), '1950–')
  })

  it('leaves out a column that is drawn rather than written — the result rail', () => {
    const rail = { key: 'rail', label: 'Result', text: () => '' }
    assert.deepEqual(
      writtenColumns([...columns, rail], rows).map((c) => c.key),
      ['full_name', 'entries', 'first_season'],
    )
    // A column of nothing but em dashes is NOT that: "not established" on
    // every row is a fact about the database, and it travels.
    const unknown = { key: 'gap', label: 'Gap' }
    assert.deepEqual(
      writtenColumns([unknown], [{ gap: null }, { gap: null }]).map((c) => c.key),
      ['gap'],
    )
  })

  it('tab-separates the clipboard, header first, with no trailing row', () => {
    assert.equal(
      toTsv(columns, rows),
      ['Driver\tEntries\tFirst season', 'Ayrton Senna\t162\t1984', `Pastor Maldonado\t95\t${EMPTY}`].join('\n'),
    )
  })

  it('a pasted field loses its own tabs and newlines rather than becoming two cells', () => {
    const prose = [{ note: 'Two sources disagree.\nBoth are recorded.\tSee below.' }]
    assert.equal(
      toTsv([{ key: 'note', label: 'Note' }], prose),
      'Note\nTwo sources disagree. Both are recorded. See below.',
    )
  })

  it('quotes a CSV field by RFC 4180 and doubles the quotes inside it', () => {
    const awkward = [{ v: 'Brabham, Repco' }, { v: 'He said "no"' }, { v: 'one\ntwo' }, { v: ' padded ' }, { v: "O'Ward" }]
    const lines = toCsv([{ key: 'v', label: 'V' }], awkward).split('\r\n')
    assert.equal(lines[1], '"Brabham, Repco"')
    assert.equal(lines[2], '"He said ""no"""')
    // A quoted field keeps its own line break rather than ending the record,
    // which is why the row count of a CSV is not its line count.
    assert.equal(lines[3], '"one\ntwo"')
    assert.equal(lines[4], '" padded "')
    // An apostrophe is not a quote character and must not be touched.
    assert.equal(lines[5], "O'Ward")
  })

  it('comma-separates the file, one record per CRLF', () => {
    // The first version of this joined the FIELDS with the record separator,
    // which a one-column test cannot see: every cell became its own line and
    // an 862-row register came out as 7,766.
    assert.equal(
      toCsv(columns, rows),
      '\uFEFFDriver,Entries,First season\r\n' +
        'Ayrton Senna,162,1984\r\n' +
        `Pastor Maldonado,95,${EMPTY}\r\n`,
    )
  })

  it('opens the CSV with a byte-order mark, so Excel reads Räikkönen as Räikkönen', () => {
    const csv = toCsv([{ key: 'v', label: 'Driver' }], [{ v: 'Kimi Räikkönen' }])
    assert.equal(csv.slice(0, 1), '\uFEFF')
    assert.equal(csv, '\uFEFFDriver\r\nKimi Räikkönen\r\n')
  })

  it('names the file for the table and the database version that fixes its figures', () => {
    assert.equal(fileName('Drivers', '3.4.0', 'csv'), 'lap-ledger-drivers-v3.4.0.csv')
    assert.equal(fileName('The result of your query', '3.4.0', 'csv'), 'lap-ledger-the-result-of-your-query-v3.4.0.csv')
    // A citation rests on the digest (SD-24) and a filename cannot carry
    // one, but a table must still be takeable before the manifest has
    // arrived at all.
    assert.equal(fileName('Drivers', undefined, 'csv'), 'lap-ledger-drivers.csv')
    assert.equal(fileName(undefined, '3.4.0', 'csv'), 'lap-ledger-table-v3.4.0.csv')
    assert.equal(fileName('Monza — every race', '3.4.0', 'csv'), 'lap-ledger-monza-every-race-v3.4.0.csv')
  })
})

/**
 * What the static page drew, so the handover does not take it away (IX-19).
 *
 * A DOM of three objects rather than a browser: captureStaticTables() asks a
 * document for #prerendered, its tables, each table's <caption> and each
 * table's <tbody> rows, and that is the whole of its contract with the page.
 * The duplicate-caption branch cannot be reached from any page this site
 * builds - no prerendered page has two tables under one heading - so a unit
 * case is the only thing that can hold it.
 */
describe('the rows the static page drew (IX-19)', () => {
  const fakeTable = (caption, rows) => ({
    querySelector: (selector) => (selector === 'caption' && caption !== null ? { textContent: caption } : null),
    querySelectorAll: () => ({ length: rows }),
  })
  const stand = (pathname, tables, run) => {
    const hadDocument = 'document' in globalThis
    const hadLocation = 'location' in globalThis
    const document = globalThis.document
    const location = globalThis.location
    globalThis.document = {
      getElementById: (id) => (id === 'prerendered' ? { querySelectorAll: () => tables } : null),
    }
    globalThis.location = { pathname }
    try {
      run()
    } finally {
      if (hadDocument) globalThis.document = document
      else delete globalThis.document
      if (hadLocation) globalThis.location = location
      else delete globalThis.location
    }
  }

  it('counts each static table under the name its caption gives', () => {
    stand('/drivers', [fakeTable('Drivers', 862)], () => {
      captureStaticTables()
      assert.equal(staticRows('Drivers'), 862)
    })
  })

  it('reads a caption and a heading that differ only in whitespace as one name', () => {
    stand('/cars', [fakeTable('\n  The chassis register\n', 1182)], () => {
      captureStaticTables()
      assert.equal(staticRows('The chassis register'), 1182)
    })
  })

  it('seeds nothing for a table the static half did not draw', () => {
    stand('/records', [fakeTable('The most wins', 25)], () => {
      captureStaticTables()
      assert.equal(staticRows('The most poles'), 0)
      // A table with no name at all asks for nothing rather than for the
      // first table on the page.
      assert.equal(staticRows(undefined), 0)
      assert.equal(staticRows(null), 0)
    })
  })

  it('drops a name that named two tables rather than seeding the wrong one', () => {
    stand('/somewhere', [fakeTable('Every entry', 40), fakeTable('Every entry', 900)], () => {
      captureStaticTables()
      assert.equal(staticRows('Every entry'), 0)
    })
  })

  it('stops once the reader is on another route, and holds across a query string', () => {
    stand('/drivers', [fakeTable('Drivers', 862)], () => {
      captureStaticTables()
      globalThis.location = { pathname: '/drivers' }
      assert.equal(staticRows('Drivers'), 862)
      // A filter or a sort is the reader's own doing, and the rows they had
      // stay available to them.
      globalThis.location = { pathname: '/drivers', search: '?kind=champions' }
      assert.equal(staticRows('Drivers'), 862)
      globalThis.location = { pathname: '/drivers/senna' }
      assert.equal(staticRows('Drivers'), 0)
    })
  })

  it('a route with no static page records no arrival, and leaves one that had', () => {
    stand('/drivers', [fakeTable('Drivers', 862)], () => {
      captureStaticTables()
      // A route the build does not prerender: #prerendered is not there, the
      // capture finds nothing, and it must return before recording the route
      // it was called on - or the register it counted a moment ago is filed
      // under the wrong page and seeds nothing when the reader reaches it.
      globalThis.document = { getElementById: () => null }
      globalThis.location = { pathname: '/reference/sql' }
      captureStaticTables()
      assert.equal(staticRows('The result of your query'), 0)
      globalThis.location = { pathname: '/drivers' }
      assert.equal(staticRows('Drivers'), 862)
    })
  })
})

/*
 * The console's one-line timing position goes to the reader who asked for one
 * of the four tables that are empty by licence, and to nobody else (CD-05).
 * Every case below that expects null is one the review of #533 found the
 * first cut claiming a licence position about.
 */
describe('which empty-by-licence table a statement reads (CD-05)', () => {
  const reads = (sql) => emptyTimingTableRead(sql)

  it('reads the four, however SQLite spells the name', () => {
    assert.equal(reads('SELECT * FROM laps'), 'laps')
    assert.equal(reads('select * from laps limit 5'), 'laps')
    assert.equal(reads('SELECT * FROM "laps"'), 'laps')
    assert.equal(reads('SELECT * FROM [stints]'), 'stints')
    assert.equal(reads('SELECT * FROM `race_timing`'), 'race_timing')
    assert.equal(reads('SELECT * FROM main.laps'), 'laps')
    assert.equal(reads('SELECT * FROM "main"."race_timing"'), 'race_timing')
    assert.equal(reads('SELECT * FROM"laps"'), 'laps')
    assert.equal(reads('SELECT * FROM\n  laps'), 'laps')
    assert.equal(reads('SELECT 1 FROM x JOIN race_control_messages m ON 1'), 'race_control_messages')
    assert.equal(reads('SELECT * FROM (SELECT * FROM laps)'), 'laps')
    assert.equal(reads('WITH x AS (SELECT * FROM race_timing) SELECT * FROM x'), 'race_timing')
  })

  it('does not read a column, a view or a longer name as the table', () => {
    assert.equal(reads('SELECT e.laps FROM race_entries e WHERE e.laps = 0'), null)
    assert.equal(reads('SELECT * FROM v_laps'), null)
    assert.equal(reads('SELECT * FROM lapsx'), null)
    assert.equal(reads('SELECT * FROM races'), null)
    assert.equal(reads('SELECT * FROM race_entries'), null)
  })

  it('does not read a comment or a string literal', () => {
    assert.equal(reads('-- from laps\nSELECT 1 WHERE 0'), null)
    assert.equal(reads('/* from laps */ SELECT 1 WHERE 0'), null)
    assert.equal(reads("SELECT 'from laps' WHERE 0"), null)
    assert.equal(reads("SELECT * FROM races WHERE name LIKE '%from laps%'"), null)
  })

  it('leaves a CTE that shadows one of the names to the reader', () => {
    assert.equal(reads('WITH laps AS (SELECT 1 WHERE 0) SELECT * FROM laps'), null)
    assert.equal(reads('WITH RECURSIVE laps(n) AS (SELECT 1 WHERE 0) SELECT * FROM laps'), null)
    assert.equal(reads('WITH a AS (SELECT 1), laps AS (SELECT 1 WHERE 0) SELECT * FROM laps'), null)
  })

  it('reads a column aliased for one of the names as the alias it is', () => {
    assert.equal(reads('SELECT id, laps AS n FROM laps'), 'laps')
    assert.equal(reads('SELECT a, stints AS n FROM stints WHERE 1 = 0'), 'stints')
  })

  it('answers nothing for what is not a statement', () => {
    assert.equal(reads(undefined), null)
    assert.equal(reads(''), null)
  })
})

describe("the home page's season block (PD-48)", () => {
  // The states `/` cannot be in today. f1.db has one current season, part-run
  // and undecided, so the suite that drives the site only ever sees that one:
  // a season not yet started, a season decided, and a one-round remainder are
  // reachable here and nowhere else.
  const lead = [
    { entity: 'Lando Norris', points: 312 },
    { entity: 'Oscar Piastri', points: 288 },
  ]
  const running = { year: 2026, rounds: 23, run: 14, seats: 20, teams: 10, champion: null }

  it('names a season with no round run as a calendar, and nobody as leading it', () => {
    const strip = seasonStrip({ year: 2027, rounds: 24, run: 0, seats: 0, teams: 0, champion: null }, [])
    assert.deepEqual(
      strip.map((t) => t.label),
      ['Rounds run', 'On the grid'],
    )
    assert.equal(strip[0].value, NOT_YET_RUN)
    assert.equal(strip[0].note, '24 on the calendar')
  })

  it('leads on the leader while the championship is open', () => {
    const [, tile] = seasonStrip(running, lead)
    assert.equal(tile.label, 'Leading the championship')
    assert.equal(tile.value, 'Lando Norris')
    assert.equal(tile.note, '312 points, 24 clear')
  })

  it('calls the same row the champion once the season has one', () => {
    const [, tile] = seasonStrip({ ...running, run: 23, champion: 'Lando Norris' }, lead)
    assert.equal(tile.label, 'Champion')
    assert.equal(tile.value, 'Lando Norris')
  })

  it('never says a leader is 0 clear, and needs no runner-up to say the points', () => {
    const level = [lead[0], { entity: 'Oscar Piastri', points: 312 }]
    assert.equal(seasonStrip(running, level)[1].note, '312 points, level at the top')
    assert.equal(seasonStrip(running, [lead[0]])[1].note, '312 points')
  })

  it('has no strip at all without a current season', () => {
    assert.deepEqual(seasonStrip(null, lead), [])
    assert.deepEqual(seasonStrip(undefined, undefined), [])
  })

  it('counts what is left of the named season, not of the register', () => {
    assert.equal(
      stillToRunNote(running),
      '9 rounds of the 2026 season are still to run, so they carry no result.',
    )
    assert.equal(
      stillToRunNote({ ...running, run: 22 }),
      '1 round of the 2026 season is still to run, so it carries no result.',
    )
  })

  it('hands the reader on by name when the season is over', () => {
    assert.equal(seasonComplete(2026), 'Every round of the 2026 season has been run.')
    assert.equal(seasonHeading(2026), 'The 2026 season')
  })
})

/**
 * The two sentences that name the file a reader is looking at (SD-24).
 *
 * The citation used to end "the version and build date fix which figures you
 * saw", and two different databases were both v2.24 built 2026-09-16 on the
 * day that was measured. The digest is what makes the sentence true, so a
 * citation without one is not a weaker citation - it is the old claim back.
 *
 * DIGEST_NOTE is held here because both renderers split it on the literal
 * "SHA256SUMS" to hang the link on, and the failure is silent and different
 * in each: Data.jsx indexes [1] and would render `undefined`, and the
 * prerenderer's join() would emit the sentence with no link at all, or two.
 */
describe('the sentences that name the file (SD-24)', () => {
  it('puts the digest in the citation, between the build date and the address', () => {
    const text = citation('2.24', '2026-09-16', 'dcb3f6b98aebba26', 'https://lapledger.org/drivers/senna')
    assert.match(text, /database v2\.24 built 2026-09-16, digest dcb3f6b98aebba26, https:\/\/lapledger\.org\/drivers\/senna\./)
    // The address appears once, because both renderers split the sentence on
    // it to mark the URL up.
    assert.equal(text.split('https://lapledger.org/drivers/senna').length, 2)
  })

  it('does not tell a reader the version and the build date fix the figures', () => {
    const text = citation('2.24', '2026-09-16', 'dcb3f6b98aebba26', 'https://lapledger.org/')
    assert.doesNotMatch(text, /version and build date fix/)
  })

  it('names SHA256SUMS once in the digest note, so each renderer can link it', () => {
    const parts = DIGEST_NOTE.split('SHA256SUMS')
    assert.equal(parts.length, 2)
    assert.notEqual(parts[0].trim(), '')
    assert.notEqual(parts[1].trim(), '')
  })
})
