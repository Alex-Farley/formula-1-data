/**
 * The pure functions, tested directly.
 *
 * WHY THIS FILE EXISTS
 *     smoke.mjs drives the built site in a real browser and is the better test
 *     of whether the thing works. What it cannot do is put an awkward value
 *     through a function and look at the answer: it can only reach the values
 *     that happen to be in f1.db, on the pages it happens to open. Every rule
 *     these functions encode — a blank is not a zero, a hyphenated venue is not
 *     two words — is a rule that reads as working right up until the one row
 *     that breaks it appears.
 *
 * node:test and node:assert. No new dependency: the front end has four, and a
 * test runner is not going to be the fifth.
 *
 *     npm run test:units
 */
import assert from 'node:assert/strict'
import { DatabaseSync } from 'node:sqlite'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it } from 'node:test'
import { SEASONS_LEDE } from '../src/queries/seasons.js'
import { CONSTRUCTORS_LEDE } from '../src/queries/constructors.js'
import { CIRCUITS_LEDE } from '../src/queries/circuits.js'
import { CARS_LEDE } from '../src/queries/cars.js'
import { codeSpans, idPolicy } from '../src/queries/data.js'

import {
  FOLD_NOUN,
  FOLD_OVER,
  MIN_ROWS,
  UNFOLDED,
  cellText,
  chosenColumns,
  defaultColumns,
  foldFault,
  onPhone,
  shared,
  sharedLine,
  tableKey,
} from '../src/lib/table.js'
import { captureOpenFolds, captureStaticTables, staticOpen, staticRows } from '../src/lib/handover.js'

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
  HOUSE_LOCALE,
  classificationOrder,
  dateSegments,
  houseDate,
  houseTime,
  isDay,
  localDate,
  localRaceDates,
  localTime,
  longDate,
  missing,
  number,
  percent,
  points,
  raceDates,
  result,
  roundResult,
  span,
  text,
  yearList,
  zonedIso,
} from '../src/lib/format.js'
import { distance, elsewhere, fold, prepare, rank } from '../src/lib/search.js'
import { EXAMPLES, QUESTIONS, TOPICS, questionPath } from '../src/lib/questions.js'
import { complaint, emptyTimingTableRead, nearestStatement } from '../src/lib/sql.js'
import { DRIVER_COLUMNS } from '../src/queries/drivers.js'
import { KEY_SHAPE, holderPath, recordPath } from '../src/queries/records.js'
import { EXPLAINED_FOOTER, OPEN_FOOTER, allExplained } from '../src/lib/disagreement.js'
import { SESSION_COLUMNS, clock, eventDay, nextSession, raceStage, until, utc, yourTimeColumn } from '../src/queries/sessions.js'
import {
  SEASON_COLUMNS,
  careerSentence,
  derivedAndPublished,
  lede,
  pointsDiffer,
  record,
  seasonRows,
  seasonTile,
  seasonsNote,
  strip,
  thisSeasonHeading,
  thisSeasonLine,
  ENTRY_COLUMNS,
} from '../src/queries/driver.js'
import {
  constructorsFooter,
  latestRound,
  noConstructorsNote,
  progressionNote,
  roundName,
  roundWinner,
  winningCar,
  CALENDAR_COLUMNS,
  seasonLede,
  standingsHeading,
  stillRunning,
  titleAnswer,
  titleHeading,
  TITLE_STANDINGS,
  titleSettled,
  currentTitle,
  fightAhead,
  fightLine,
  isUpcoming,
  outSince,
  reachFigures,
  teamAvailable,
} from '../src/queries/season.js'
import { reachLayout, reachText } from '../src/charts/reachChart.js'
import { SEASONS_COLUMNS, soFar } from '../src/queries/seasons.js'
import { RACE_COLUMNS as RACES_COLUMNS, raceWinner } from '../src/queries/races.js'
import { CONSTRUCTOR_COLUMNS, entered } from '../src/queries/constructors.js'
import { CIRCUIT_COLUMNS, traced } from '../src/queries/circuits.js'
import { GRANDS_PRIX_COLUMNS } from '../src/queries/grandsprix.js'
import { circuitYears, editionCar, venuesCount } from '../src/queries/grandprix.js'
import { heldAs } from '../src/queries/circuit.js'
import { CHASSIS_COLUMNS, chassisName } from '../src/queries/cars.js'
import { driverName, fastestLapMark, inClassificationOrder, outcome, position, RACE_HISTORY, raceAftermath, raceLede, raceSentence, railOf, scheduledNote, stintsEmpty, stintsLabel } from '../src/queries/race.js'
import { RACE_COLUMNS, raceWinnerHere, racesCount } from '../src/queries/circuit.js'
import { STINT_HEADS, pitPairs, pitWave, stintLaps, stintLayout, stintRows, stintTableRows, stintsShown, unbarredOf } from '../src/charts/stints.js'
import {
  SEASONS_RACED_WIDTH,
  SPARK_HEIGHT,
  TITLE_RACE_WIDTH,
  runsOf,
  seasonsRacedLayout,
  seasonsRacedText,
  titleRaceLayout,
  titleRaceOf,
  titleRaceText,
} from '../src/charts/spark.js'
import { SEASON_COLUMNS as TEAM_SEASON_COLUMNS } from '../src/queries/constructor.js'
import { DERIVED as TEAM_DERIVED, STANDINGS as TEAM_STANDINGS, constructorSeasons, lineageChains, recordFigures } from '../src/queries/constructor.js'
import { FINAL as SEASON_FINAL } from '../src/queries/season.js'
import { DIGEST_NOTE, EYEBROWS, NOT_YET_RUN, behindThisPage, citation, licenceTerms } from '../src/lib/site.js'
import { ONWARD, raceSteps } from '../src/lib/wayfinding.js'
import { NEIGHBOURS as RACE_NEIGHBOURS } from '../src/queries/race.js'
import {
  AGGREGATE_METHOD,
  DISTANCE_LABEL,
  DISTANCE_METHOD,
  KNOCKOUT_METHOD,
  QUALIFYING as QUALIFYING_QUERY,
  RACE as RACE_QUERY,
  distanceMethod,
  lapSeconds,
  layoutLength,
  practiceBySession,
  practiceColumns,
  qualifyingColumns,
  sessionParts,
  sprintQualifyingColumns,
  withDistance,
} from '../src/queries/race.js'
import { chartData, chartNote, seasonComplete, seasonHeading, seasonStrip, stillToRunNote } from '../src/queries/home.js'
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
import { seasonSources, teamsByDriver } from '../src/queries/season.js'
import {
  NEXT,
  NO_TIMELINE_ROW,
  OUTLINE_FIGURES_NOTE,
  OUTLINE_LEAD_NOTE,
  RUN,
  TO_COME,
  circuitOutlinesNote,
  layoutFacts,
  layoutRaced,
  layoutTimeline,
  layoutsCount,
  leadOutline,
  outlineCaption,
  outlineFigures,
  RACE_LAYOUT_NOTE,
  raceLayoutNote,
  roundShortName,
  roundStates,
  timelineName,
} from '../src/lib/outline.js'
import { THUMB_WIDTH, attribution, canShow, fileLinkName, fileTitle, thumbUrl } from '../src/lib/commons.js'
import { GRACE_DAYS, LATE_NOTE, lateDays, lateLine, lateNotice, lateRaces, raceDay, readerDay } from '../src/lib/refresh.js'
import { UNRESULTED } from '../src/queries/changes.js'
import {
  LEADERS_DRAWN,
  asOfOf,
  cardExtras,
  familyAnchor,
  headlineRecords,
  leadersDrawn,
  leadersDrawnLine,
  markLeaders,
  recordColumns,
  recordFamilies,
  tiersOf,
} from '../src/queries/records.js'
import { columnLayout } from '../src/charts/columnChart.js'
import { flagCarClass, gridFlagLayout, textWidth } from '../src/charts/gridFlag.js'
import { INK, slotColour } from '../src/charts/palette.js'
import { clearState, oneOf, readState, urlWriter, writeState } from '../src/lib/urlstate.js'
import { unestablished } from '../src/lib/tiles.js'

const web = join(dirname(fileURLToPath(import.meta.url)), '..')

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
  const entry = (label, weight = 0, more = {}) => prepare({ label, weight, ...more })

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

  // IA-20: the searches the critique found returning nothing.
  it('reads past the separator in a model number and the space in a team name', () => {
    assert.ok(rank(entry('McLaren MP4/4'), 'mp4-4') > 0)
    assert.ok(rank(entry('McLaren MP4/4'), 'mp44') > 0)
    assert.ok(rank(entry('Red Bull Racing'), 'redbull') > 0)
  })

  it('takes a year as the span a page covers, and nothing outside it', () => {
    const ferrari = entry('Ferrari', 250, { meta: 'Italy', from_year: 1950, to_year: 2026 })
    const gone = entry('Ferrari', 0, { meta: 'Italy', from_year: 1950, to_year: 1960 })
    assert.ok(rank(ferrari, 'ferrari 2026') > 0)
    assert.equal(rank(gone, 'ferrari 2026'), -1)
  })

  it('offers the driver for a name and a year before the season whose champion he was', () => {
    const lewis = entry('Sir Lewis Hamilton', 106, { meta: 'United Kingdom', from_year: 2007, to_year: 2026 })
    const season = entry('2008 season', 0, { meta: 'Sir Lewis Hamilton', from_year: 2008, to_year: 2008 })
    assert.ok(rank(season, 'hamilton 2008') > 0, 'the season still answers, by its champion')
    assert.ok(rank(lewis, 'hamilton 2008') > rank(season, 'hamilton 2008'))
  })

  it('reads a question for the race it names', () => {
    const race = entry('2026 Italian Grand Prix', 0, { meta: 'Autodromo Nazionale Monza', from_year: 2026, to_year: 2026 })
    assert.ok(rank(race, 'who won the 2026 italian grand prix') > 0)
    assert.ok(rank(race, 'italian gp 2026') > 0, 'gp is a Grand Prix')
    // A search of nothing but grammar is still a search for those words.
    assert.equal(rank(entry('Monaco'), 'the'), -1)
  })

  it('finds a word in the meta and the hidden words, below one in the label', () => {
    const page = entry('Data', 100, { also: 'download files' })
    assert.ok(rank(page, 'download') > 0)
    assert.ok(rank(entry('Downloads'), 'download') > rank(page, 'download'), 'a label outranks a hidden word')
  })

  it('allows a near spelling only when asked, and never for a short word', () => {
    const max = entry('Max Verstappen', 71)
    const michael = entry('Michael Schumacher', 91)
    assert.equal(rank(max, 'verstapen'), -1, 'not as typed')
    assert.ok(rank(max, 'verstapen', { fuzzy: true }) > 0, 'one letter dropped')
    assert.ok(rank(michael, 'schumaker', { fuzzy: true }) > 0, 'two edits in a long name')
    assert.ok(rank(max, 'verstpapen', { fuzzy: true }) > 0, 'a swap is one edit')
    assert.equal(rank(entry('Damon Hill'), 'hull', { fuzzy: true }), -1, 'four letters must be spelt')
    assert.equal(rank(max, 'vettel', { fuzzy: true }), -1)
  })

  it('counts edits, with a swap of neighbours as one', () => {
    assert.equal(distance('verstappen', 'verstappen', 2), 0)
    assert.equal(distance('verstapen', 'verstappen', 2), 1)
    assert.equal(distance('hmailton', 'hamilton', 2), 1)
    assert.equal(distance('schumaker', 'schumacher', 2), 2)
    assert.ok(distance('prost', 'senna', 1) > 1)
  })

  // IA-21: the empty state hands the words over rather than ending there.
  it('hands a search that found nothing to the console, as a statement that runs', () => {
    const [sql, records] = elsewhere("o'brien\nDROP")
    assert.equal(records.path, '/records')
    const statement = decodeURIComponent(sql.path.replace('/data/sql?q=', ''))
    const lines = statement.split('\n')
    assert.ok(lines[0].startsWith('--') && lines[0].includes("o'brien DROP"), 'the line break in the term stays inside the comment')
    assert.ok(!lines.some((line) => line.startsWith('DROP')), 'and never begins a line of its own')
    const db = new DatabaseSync(join(web, '..', 'f1.db'), { readOnly: true })
    try {
      assert.ok(Array.isArray(db.prepare(statement).all()), 'a quote in the term is doubled, not a syntax error')
      const run = (term) => db.prepare(decodeURIComponent(elsewhere(term)[0].path.replace('/data/sql?q=', ''))).all()
      assert.ok(run('senna').some((row) => row.kind === 'driver'))
      // A reader's % and _ are the characters, not LIKE's wildcards.
      assert.equal(run('100%').length, 0, 'no name holds "100%"')
      assert.equal(run('_').length, 0, 'nor an underscore')
    } finally {
      db.close()
    }
  })
})

describe('the question library (IA-20, PD-32)', () => {
  it('holds forty questions, each a query or a page and never both', () => {
    assert.equal(QUESTIONS.length, 40)
    assert.equal(new Set(QUESTIONS.map((entry) => entry.q)).size, QUESTIONS.length, 'no question twice')
    for (const entry of QUESTIONS) {
      assert.ok(Boolean(entry.sql) !== Boolean(entry.to), entry.q)
      assert.ok(TOPICS.includes(entry.topic), `${entry.q}: a topic the console shows`)
    }
  })

  it('keeps the console opening on the statement it always opened on', () => {
    assert.equal(EXAMPLES[0][0], 'Who has led a race from pole most often?')
    assert.equal(questionPath(QUESTIONS[0]), '/data/sql')
    assert.ok(questionPath(QUESTIONS[1]).startsWith('/data/sql?q='))
  })

  it('answers every question it asks: each statement runs on f1.db and returns rows', () => {
    const db = new DatabaseSync(join(web, '..', 'f1.db'), { readOnly: true })
    try {
      const empty = QUESTIONS.filter((entry) => entry.sql && db.prepare(entry.sql).all().length === 0)
      assert.deepEqual(
        empty.map((entry) => entry.q),
        [],
      )
    } finally {
      db.close()
    }
  })
})

describe('raceDates', () => {
  // The house format (CD-57): the month a word, the day unpadded, a range
  // joined by an en dash as every span on the site is.
  it('writes a weekend inside one month', () => {
    assert.equal(raceDates({ date_iso: '2026-03-29', date_from: '2026-03-27', date_to: '2026-03-29' }), '27–29 Mar 2026')
  })

  it('names both months for a weekend across two', () => {
    assert.equal(raceDates({ date_iso: '2026-11-01', date_from: '2026-10-30', date_to: '2026-11-01' }), '30 Oct–1 Nov 2026')
  })

  it('names both years for a weekend across two', () => {
    assert.equal(raceDates({ date_iso: '2028-01-01', date_from: '2027-12-30', date_to: '2028-01-01' }), '30 Dec 2027–1 Jan 2028')
  })

  it('is the race day, in words, where no weekend is stated - never the ISO string /seasons/1997 printed', () => {
    assert.equal(raceDates({ date_iso: '1950-05-13', date_from: null, date_to: null }), '13 May 1950')
    assert.equal(raceDates({ date_iso: '1997-03-09' }), '9 Mar 1997')
  })

  it('shows the weekend, not the UTC race day, for Las Vegas', () => {
    assert.equal(raceDates({ date_iso: '2026-11-22', date_from: '2026-11-19', date_to: '2026-11-21' }), '19–21 Nov 2026')
  })

  it('is null when nothing is held, so the caller decides', () => {
    assert.equal(raceDates({ date_iso: null, date_from: null, date_to: null }), null)
    assert.equal(raceDates(null), null)
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

describe('record holders', () => {
  it('links every holder that resolves, and leaves a shared record as text', () => {
    assert.equal(holderPath({ holder_table: 'drivers', holder_id: 'senna' }), 'drivers/senna')
    assert.equal(holderPath({ holder_table: 'constructors', holder_id: 'ferrari' }), 'constructors/ferrari')
    assert.equal(holderPath({ holder_table: 'circuits', holder_id: 'monza' }), 'circuits/monza')
    assert.equal(holderPath({ holder_table: 'races', holder_id: '142', race_year: 1966, race_round: 1 }), 'races/1966/1')
    assert.equal(holderPath({ holder_table: 'races', holder_id: '142', race_year: null, race_round: null }), null)
    assert.equal(holderPath({ holder_table: 'drivers', holder_id: null, holder: 'Michael Schumacher, Sir Lewis Hamilton' }), null)
  })

  // PD-27: a record's address is its key, and only a slug is one.
  it('addresses a record by its key, and takes only a slug as one', () => {
    assert.equal(recordPath({ id: 2, key: 'most-wins' }), 'records/most-wins')
    for (const key of ['most-wins', 'most-wins-in-a-season', 'f1']) assert.ok(KEY_SHAPE.test(key), key)
    for (const key of ['', 'Most-wins', 'most wins', 'most/wins', '-most', 'most--wins', 'most-', 'most-wins?x=1']) {
      assert.ok(!KEY_SHAPE.test(key), JSON.stringify(key))
    }
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

  // CD-59: the timetable is held to the Dates rule. The house form is the
  // module's own words, so ICU's en-GB "Sept" never reaches it.
  it("writes a start in the reader's own form, and keeps the house form for en-GB", () => {
    const fp1 = '2026-12-04T09:30Z'
    assert.equal(houseTime(fp1, 'Asia/Dubai'), 'Fri 4 Dec 13:30')
    assert.equal(houseTime('2026-09-06T13:00Z', 'Europe/Rome'), 'Sun 6 Sep 15:00')
    assert.equal(localTime(fp1, 'Asia/Dubai', 'en-GB'), 'Fri 4 Dec 13:30')
    // ICU puts a narrow no-break space before PM; the words are what is held.
    assert.equal(localTime(fp1, 'Asia/Dubai', 'en-US').replace(/[\u202f\u00a0]/g, ' '), 'Fri, Dec 4, 1:30 PM')
    assert.equal(localTime(fp1, 'Asia/Dubai', 'de-DE'), 'Fr., 4. Dez., 13:30')
    assert.equal(localTime(fp1, 'UTC', 'not a locale!'), 'Fri 4 Dec 09:30')
    // Nothing to write is null, never the epoch or the runtime's own zone.
    assert.equal(houseTime(null, 'UTC'), null)
    assert.equal(houseTime('not a time', 'UTC'), null)
    assert.equal(houseTime(fp1, 'Mars/Olympus_Mons'), null)
    assert.equal(houseTime(fp1, undefined), null)
  })

  it('declares every time column for both renderers, and hands a file the wall clock on its zone', () => {
    const row = { kind: 'fp1', name: 'Practice 1', start_utc: '2026-11-20T00:30Z', zone: 'America/Los_Angeles' }
    const columns = [...SESSION_COLUMNS, yourTimeColumn('Asia/Kolkata')]
    assert.deepEqual(
      columns.filter((c) => c.date === 'time').map((c) => c.at(row)),
      [
        { iso: '2026-11-20T00:30Z', zone: 'America/Los_Angeles' },
        { iso: '2026-11-20T00:30Z', zone: 'UTC' },
        { iso: '2026-11-20T00:30Z', zone: 'Asia/Kolkata' },
      ],
    )
    assert.deepEqual(
      columns.slice(1).map((c) => fieldText(c, row)),
      ['2026-11-19T16:30-08:00', '2026-11-20T00:30Z', '2026-11-20T06:00+05:30'],
    )
    assert.equal(fieldText(SESSION_COLUMNS[1], { ...row, start_utc: null }), EMPTY)
    assert.equal(zonedIso('2026-03-08T04:00Z', 'Australia/Melbourne'), '2026-03-08T15:00+11:00')
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
    const explained = { status: 'explained', status_note: 'each side is right about something' }
    const open = { status: 'open', status_note: 'needs official check' }
    const older = { status: 'explained', status_note: 'external figure is older' }
    assert.equal(allExplained([older]), false)
    assert.equal(allExplained([explained]), true)
    assert.equal(allExplained([explained, explained]), true)
    assert.equal(allExplained([open]), false)
    assert.equal(allExplained([explained, open]), false)
    assert.equal(allExplained([]), false)
  })
})

describe('a tile nobody has established (VD-88)', () => {
  it('is a null, an empty string or the em dash, and never a zero', () => {
    for (const value of [null, undefined, '', '\u2014']) assert.equal(unestablished({ value }), true, String(value))
    for (const value of [0, '0', 'P1', 'not yet run']) assert.equal(unestablished({ value }), false, String(value))
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
    // No classified finish, no tile: left out, which is how a strip says a
    // tile does not apply, where a null value would draw an em dash (VD-88).
    assert.equal(
      none.find((i) => i.label === 'Best finish'),
      undefined,
      'no classified finish, no tile',
    )
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

  it('carries the season being run as one tile, from the standings rather than the rounds (PD-59)', () => {
    const calendar = [
      { season: 2026, round: 1, status: 'completed' },
      { season: 2026, round: 2, status: 'completed' },
      { season: 2026, round: 3, status: 'scheduled' },
    ]
    const standings = [
      { year: 2025, position: 2, points: 300 },
      { year: 2026, position: 6, points: 163 },
    ]
    // P6, as the strip's Best finish and Best grid write a position (CD-51).
    assert.deepEqual(seasonTile(calendar, standings), { label: '2026 so far', value: 'P6', note: '163 points, 2 of 3 rounds run' })
    // Once every round is run the label is the season and the note the total.
    const done = calendar.map((row) => ({ ...row, status: 'completed' }))
    assert.deepEqual(seasonTile(done, standings), { label: '2026', value: 'P6', note: '163 points' })
    assert.equal(seasonTile(done, [{ year: 2026, position: 1, points: 1 }]).note, '1 point')
    // No points figure: the place alone, no "— points".
    assert.equal(seasonTile(done, [{ year: 2026, position: 21, points: null }]).note, undefined)
    // Nothing to place: no tile, rather than an em dash claiming a gap.
    assert.equal(seasonTile(done, [{ year: 2026, position: null, points: 0 }]), null)
    assert.equal(seasonTile(done, [{ year: 2025, position: 2, points: 300 }]), null)
    // A driver of another season has no rows and so no tile.
    assert.equal(seasonTile([], standings), null)
  })

  it('says the season being run once on the first screen: the tile, or the line where there is no tile (CD-51)', () => {
    const calendar = [
      { season: 2026, round: 1, status: 'completed', entry_id: 1, constructor: 'Ferrari' },
      { season: 2026, round: 2, status: 'scheduled', entry_id: null, constructor: null },
    ]
    assert.equal(thisSeasonHeading(calendar), '2026, round by round')
    assert.equal(thisSeasonHeading(calendar.map((row) => ({ ...row, status: 'completed' }))), '2026, round by round')
    // Placed: the tile says it, and the section says nothing more.
    assert.equal(thisSeasonLine(calendar, [{ year: 2026, position: 3, points: 214 }]), null)
    // Not placed: no tile, so the line is the one place that says it.
    assert.equal(
      thisSeasonLine(calendar, [{ year: 2026, position: null, points: 0 }]),
      "0 points in the drivers' championship, driving for Ferrari, with 1 of the 2 rounds run.",
    )
    assert.equal(thisSeasonLine(calendar, []), 'Driving for Ferrari, with 1 of the 2 rounds run.')
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
    // The answer and its basis as the page prints them, one after the other.
    const titlePermutations = (args) => {
      const answer = titleAnswer(args)
      return answer ? `${answer.who} ${answer.basis}` : null
    }
    const live = { races: 2, sprints: 1, run: 21, dropped_scores: 'Every result counts', available: 58, sprint_scale: '[8,7,6,5,4,3,2,1]' }
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
    // In two parts (VD-90): the answer, which a season's lede opens on, and
    // what it was worked out from, which the page prints under the tiles.
    const parts = titleAnswer({ drivers: table, remaining: live, afterRound: 21, built: '2026-09-16' })
    assert.equal(parts.who, "Who can still win the drivers' title: Antonelli and Russell.")
    assert.match(parts.basis, /^2 rounds and 1 sprint still to run, so 58 points/)
    assert.match(parts.basis, /a tie at the top is settled on wins, which this does not work out\.$/)

    // Exactly level with the last available point is still in.
    assert.match(
      titlePermutations({ drivers: [table[0], { entity: 'Level', position: 2, points: 242 }], remaining: live, afterRound: 21 }),
      /: Antonelli and Level\./,
    )
    // One driver left in is the title decided, and it says so rather than
    // printing a list of one.
    assert.equal(
      titlePermutations({ drivers: [table[0], table[3]], remaining: live, afterRound: 21 }).split(' 2 rounds')[0],
      "Only Antonelli can still win the drivers' title: no other driver can now reach the leader's total.",
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

  // AF-132: the constructors' title on the same test, and the one answer the
  // five places print. The 2026 shapes below are the issue's own example.
  it("works out who can still win the constructors' title too, and where neither title is answered", () => {
    const live = {
      races: 6, sprints: 0, run: 17, dropped_scores: 'Every result counts', available: 150,
      win_points: 25, fastest_lap_points: 0, scale: '[25,18,15,12,10,8,6,4,2,1]', sprint_scale: '[8,7,6,5,4,3,2,1]', sprint_points: 8,
    }
    const drivers = [
      { entity: 'Antonelli', driver_id: 'antonelli', position: 1, points: 340 },
      { entity: 'Russell', driver_id: 'russell', position: 2, points: 300 },
      { entity: 'Norris', driver_id: 'norris', position: 3, points: 201 },
      { entity: 'Stroll', driver_id: 'stroll', position: 4, points: 20 },
    ]
    const teams = [
      { entity: 'Mercedes', constructor_id: 'mercedes', position: 1, points: 600 },
      { entity: 'Ferrari', constructor_id: 'ferrari', position: 2, points: 466 },
      { entity: 'McLaren', constructor_id: 'mclaren', position: 3, points: 361 },
      { entity: 'Red Bull Racing', constructor_id: 'red-bull', position: 4, points: 342 },
    ]
    // A one-two is the scale's first two places, read from the row: 43 a
    // round, six rounds, 258 - the issue's figure.
    assert.equal(teamAvailable(live), 258)
    assert.equal(teamAvailable({ ...live, sprints: 2 }), 258 + 2 * 15)
    // The fastest-lap point of 2019-2024 goes to one of the two cars.
    assert.equal(teamAvailable({ ...live, fastest_lap_points: 1 }), 6 * 44)
    // A sprint left with no sprint system to price it declines; so does a
    // scale that is not two numbers.
    assert.equal(teamAvailable({ ...live, sprints: 1, sprint_scale: null }), null)
    assert.equal(teamAvailable({ ...live, scale: '[25]' }), null)
    assert.equal(teamAvailable({ ...live, scale: 'not json' }), null)

    // A two-way fight in each: Mercedes by 134 with 258 left keeps Ferrari in
    // and McLaren 239 behind in too, Red Bull 258 behind exactly level with
    // what is left, and so in.
    const answer = titleAnswer({ drivers, constructors: teams, remaining: live, afterRound: 17, built: '2026-09-16', year: 2026 })
    assert.equal(
      answer.who,
      "Who can still win the drivers' title: Antonelli, Russell and Norris. Who can still win the constructors' title: Mercedes, Ferrari, McLaren and Red Bull Racing.",
    )
    assert.match(answer.basis, /^6 rounds still to run, so 150 points are still available to a driver and 258 to a team, a one-two in every round/)
    assert.deepEqual(answer.constructors.alive.map((d) => d.id), ['mercedes', 'ferrari', 'mclaren', 'red-bull'])
    // One past it is out, and the reach chart draws it as the one just out.
    const short = titleAnswer({
      drivers,
      constructors: [...teams.slice(0, 3), { ...teams[3], points: 341 }],
      remaining: live,
      afterRound: 17,
      year: 2026,
    })
    assert.match(short.who, /constructors' title: Mercedes, Ferrari and McLaren\.$/)
    const [driversFigure, teamsFigure] = reachFigures(short, 2026, new Map())
    assert.deepEqual(teamsFigure.data.map((d) => [d.label, d.alive]), [['Mercedes', true], ['Ferrari', true], ['McLaren', true], ['Red Bull Racing', false]])
    assert.deepEqual(driversFigure.data.map((d) => d.label), ['Antonelli', 'Russell', 'Norris', 'Stroll'])
    assert.deepEqual(teamsFigure.rows[3], { entity: 'Red Bull Racing', id: 'red-bull', points: 341, behind: 259, reach: 599, alive: false })
    // Only the highest placed of those out is drawn, beside everyone still in.
    const outTwice = reachFigures(
      titleAnswer({ drivers: [...drivers, { entity: 'Bottas', driver_id: 'bottas', position: 5, points: 2 }], remaining: live, afterRound: 17, year: 2026 }),
      2026,
      new Map(),
    )[0]
    assert.deepEqual(outTwice.data.map((d) => d.label), ['Antonelli', 'Russell', 'Norris', 'Stroll'])

    // A decided title says so, for either championship.
    const decided = titleAnswer({
      drivers: [drivers[0], drivers[3]],
      constructors: [teams[0], { ...teams[1], points: 300 }],
      remaining: live,
      afterRound: 17,
      year: 2026,
    })
    assert.equal(
      decided.who,
      "Only Antonelli can still win the drivers' title: no other driver can now reach the leader's total. Only Mercedes can still win the constructors' title: no other team can now reach the leader's total.",
    )

    // Before 1958 there was no constructors' championship, and before 1979
    // a team scored with its best-placed car only: the drivers' title is
    // still answered (were the season's scores all to count), the
    // constructors' is not.
    for (const year of [1955, 1975, undefined]) {
      const early = titleAnswer({ drivers, constructors: teams, remaining: live, afterRound: 17, year })
      assert.equal(early.constructors, null, `no constructors' answer for ${year}`)
      assert.doesNotMatch(early.who, /constructors/)
      assert.match(early.basis, /^6 rounds still to run, so 150 points are still available, and a driver further behind/)
    }
    // A sprint to run with no sprint system on record declines both, rather
    // than price the sprint at nothing.
    assert.equal(
      titleAnswer({ drivers, constructors: teams, remaining: { ...live, sprints: 1, sprint_scale: null }, afterRound: 17, year: 2026 }),
      null,
    )
    // A dropped-scores season declines both.
    assert.equal(
      titleAnswer({ drivers, constructors: teams, remaining: { ...live, dropped_scores: 'Best 11 results' }, afterRound: 17, year: 1988 }),
      null,
    )
    // A constructors' table alone is still answered.
    assert.match(
      titleAnswer({ drivers: [], constructors: teams, remaining: live, afterRound: 17, year: 2026 }).basis,
      /258 points are still available to a team/,
    )
  })

  it("prints a contender's line, the round they went out at only where the tables establish it", () => {
    const remaining = {
      races: 2, sprints: 0, run: 3, dropped_scores: 'Every result counts', available: 50,
      win_points: 25, fastest_lap_points: 0, scale: '[25,18]', sprint_scale: null, sprint_points: 0,
    }
    // Five rounds, three run, so 100, 75 and 50 left after rounds 1 to 3.
    // B falls out after round 2 (80 behind, 75 left) and stays out; C is
    // level with what is left after round 3, and in.
    const table = (round, totals) =>
      Object.entries(totals).map(([id, points], i) => ({ table_type: 'drivers', after_round: round, driver_id: id, points, position: i + 1 }))
    const standings = [
      ...table(1, { a: 25, b: 18, c: 15, d: 0 }),
      ...table(2, { a: 100, b: 20, c: 40, d: 0 }),
      ...table(3, { a: 110, b: 30, c: 60, d: 1 }),
    ]
    const drivers = standings.filter((r) => r.after_round === 3).map((r) => ({ ...r, entity: r.driver_id.toUpperCase() }))
    const rounds = [1, 2, 3, 4, 5].map((round) => ({ round, sprint: 0, status: round <= 3 ? 'completed' : 'scheduled' }))
    const get = (rows) => (key) => rows[key]
    const title = currentTitle(
      get({
        fightSeason: [{ year: 2026, drivers_champion: null }],
        fightFinal: drivers,
        fightStandings: standings,
        fightRemaining: [remaining],
        fightRounds: rounds,
      }),
    )
    assert.equal(title.next, 4)
    assert.equal(fightLine(title, 'drivers', 'a'), 'Leads the title fight by 50 with 50 left.')
    assert.equal(fightLine(title, 'drivers', 'c'), 'Still in the title fight: 50 behind with 50 left.')
    assert.equal(fightLine(title, 'drivers', 'b'), 'Out of the title fight since round 2.')
    // D: 25 behind with 100 left after round 1, in; 100 behind with 75 left
    // after round 2, out.
    assert.equal(fightLine(title, 'drivers', 'd'), 'Out of the title fight since round 2.')
    assert.equal(fightLine(title, 'drivers', 'nobody'), null)
    assert.equal(fightLine(title, 'constructors', 'a'), null)
    // A gap in the tables leaves the round unestablished, and says only out.
    const gapped = { ...title, standings: standings.filter((r) => r.after_round !== 1) }
    assert.equal(outSince(gapped, 'drivers', 'b'), null)
    assert.equal(fightLine(gapped, 'drivers', 'b'), 'Out of the title fight.')
    // Two totals for one driver after one round is no table either.
    const twice = { ...title, standings: [...standings, { ...standings[9], points: 31 }] }
    assert.equal(outSince(twice, 'drivers', 'b'), null)
    // The only one left, and level at the top.
    const alone = { ...title, drivers: { ...title.drivers, alive: [title.drivers.rows[0]] } }
    assert.equal(fightLine(alone, 'drivers', 'a'), 'The only one left in the title fight: 50 clear with 50 left.')
    const level = currentTitle(
      get({
        fightSeason: [{ year: 2026, drivers_champion: null }],
        fightFinal: [drivers[0], { ...drivers[2], points: 110 }],
        fightStandings: standings,
        fightRemaining: [remaining],
        fightRounds: rounds,
      }),
    )
    assert.equal(fightLine(level, 'drivers', 'a'), 'Level on points at the top of the title fight with 50 left.')
    // A champion on the record, or no answer, is no line and no title.
    assert.equal(
      currentTitle(get({ fightSeason: [{ year: 2026, drivers_champion: 'a' }], fightFinal: drivers, fightStandings: standings, fightRemaining: [remaining], fightRounds: rounds })),
      null,
    )
    assert.equal(fightLine(null, 'drivers', 'a'), null)

    // The upcoming race is the next round of the season answered, until it
    // has a result; the home page's next race is answered only in that season.
    assert.equal(isUpcoming(title, { year: 2026, round: 4, status: 'scheduled' }), true)
    assert.equal(isUpcoming(title, { year: 2026, round: 4, status: 'completed' }), false)
    assert.equal(isUpcoming(title, { year: 2026, round: 3, status: 'completed' }), false)
    assert.equal(isUpcoming(title, { year: 2027, round: 4, status: 'scheduled' }), false)
    assert.equal(isUpcoming(null, { year: 2026, round: 4, status: 'scheduled' }), false)
    assert.equal(fightAhead(title, { year: 2026 }), title.who)
    assert.equal(fightAhead(title, { year: 2027 }), null)
  })

  it('lays out the reach chart: the bar to the points, the outline to the reach, the line at the leader', () => {
    const data = [
      { key: 'a', label: 'A', points: 300, reach: 350, alive: true, colour: null },
      { key: 'b', label: 'B', points: 240, reach: 290, alive: false, colour: null },
    ]
    for (const width of [320, 375, 479, 480, 640, 1200]) {
      const layout = reachLayout({ data, lead: 300, width })
      const [a, b] = layout.bars
      // Every path's x coordinates, in order.
      const xs = (path) => [...path.matchAll(/[MHQ]\s*(-?[\d.]+)/g)].map((m) => Number(m[1]))
      const solidEnd = Math.max(...xs(a.solid))
      const reachEnd = Math.max(...xs(a.extension))
      // The extension starts where the bar ends, and the line stands at the
      // leader's points, which is A's bar end.
      assert.equal(Math.min(...xs(a.extension)), solidEnd)
      assert.ok(Math.abs(layout.lead.x - solidEnd) < 1e-9, `the line is at the leader's total at ${width}`)
      // B's reach falls short of the line; A's passes it.
      assert.ok(Math.max(...xs(b.extension)) < layout.lead.x)
      assert.ok(reachEnd > layout.lead.x)
      assert.ok(a.valueX + 8 * reachText(b.d).length <= width + 60, `the figures fit beside the bar at ${width}`)
      assert.ok(layout.lead.textX >= 34 && layout.lead.textX <= width - 34)
      // No name can run off the left edge (#1182's review: at 320 to 900 px a
      // name end-aligned in a narrow column was cut): below 480 px it starts
      // at the edge above its bar, and from 480 it has BarChart's 168 px.
      for (const bar of layout.bars) {
        if (width < 480) {
          assert.equal(bar.labelAnchor, 'start')
          assert.equal(bar.labelX, 0)
          assert.ok(bar.labelY + 8 <= bar.y, `the name sits above its bar at ${width}`)
          // ...and the leader's line passes no name.
          for (const [y1, y2] of layout.lead.segments) {
            assert.ok(y2 <= bar.labelY - 8 || y1 >= bar.labelY + 8, `the line clears ${bar.d.label}'s name at ${width}`)
          }
        } else {
          assert.equal(bar.labelAnchor, 'end')
          assert.equal(bar.labelX, 158)
        }
      }
      assert.equal(layout.stacked, width < 480)
    }
    assert.equal(reachText(data[0]), '300 → 350')
    assert.equal(reachText(data[1]), '240 → 290, out')
    assert.equal(reachLayout({ data: [], lead: 0, width: 640 }), null)
  })

  // VD-90: the answer takes the lede position, and the season's own note
  // follows it rather than giving way, as a race's follows who won (SD-39).
  it("leads a season's lede with who can still win, and keeps the note after it", () => {
    const said = "Who can still win the drivers' title: Antonelli and Russell."
    assert.equal(seasonLede('Season in progress.', said), `${said} Season in progress.`)
    assert.equal(seasonLede(null, said), said)
    assert.equal(seasonLede('   ', said), said)
    // No answer - a season concluded, not yet run, or one the arithmetic
    // declines - is the note alone, and no note and no answer is no lede.
    assert.equal(seasonLede('Hunt won by a point.', null), 'Hunt won by a point.')
    assert.equal(seasonLede('  Hunt won by a point.  ', null), 'Hunt won by a point.')
    assert.equal(seasonLede(null, null), null)
    assert.equal(seasonLede('', null), null)
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
    // The dropped-scores sentence only where the rule dropped results (CD-50).
    assert.match(progressionNote(false, 'Best 6 of 10'), /^The three drivers who finished highest, .*best few results counted/)
    assert.match(progressionNote(true, 'Best 6 of 10'), /^The three drivers placed highest so far, /)
    assert.equal(progressionNote(false, 'Every result counts'), 'The three drivers who finished highest, tracked from the opening round.')
    assert.equal(progressionNote(true, 'Every result counts'), 'The three drivers placed highest so far, tracked from the opening round.')
    assert.equal(progressionNote(false, null), 'The three drivers who finished highest, tracked from the opening round.')
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
    // The winning car by carName's rule (AF-68): the constructor where one is
    // resolved, the entry's own designation where none is, and the em dash
    // only where neither is held.
    const indy = { status: 'completed', winning_team_id: null, winning_team: null, winning_entrant: 'Kurtis Kraft-Offenhauser' }
    assert.equal(winningCar(indy), 'Kurtis Kraft-Offenhauser')
    assert.equal(winningCar({ ...indy, winning_team_id: 'ferrari', winning_team: 'Ferrari' }), 'Ferrari')
    assert.equal(roundResult(winningCar({ ...indy, winning_entrant: null }), indy), EMPTY)
    const carCell = CALENDAR_COLUMNS.find((c) => c.key === 'winning_team').text
    assert.equal(carCell(null, indy), 'Kurtis Kraft-Offenhauser')
    assert.equal(carCell(null, { ...indy, status: 'scheduled' }), '')
    const entryCar = ENTRY_COLUMNS.find((c) => c.key === 'constructor').text
    assert.equal(entryCar(null, { constructor_id: null, constructor: null, entrant: 'Watson-Offenhauser' }), 'Watson-Offenhauser')
    assert.equal(entryCar('Lotus', { constructor_id: 'lotus', constructor: 'Lotus', entrant: 'Rob Walker' }), 'Lotus')
    assert.equal(entryCar(null, { constructor_id: null, constructor: null, entrant: null }), EMPTY)
    // Why a constructors' table is empty: before 1958 it did not exist, and
    // on a calendar nobody has raced it has not happened yet (CD-32).
    assert.equal(noConstructorsNote(1952, false).body, 'It was not contested until 1958.')
    assert.equal(noConstructorsNote(2027, true).head, 'Not yet run.')
    assert.match(noConstructorsNote(2027, true).body, /No round of the 2027 calendar/)
    assert.equal(noConstructorsNote(1975, false).head, "No constructors' standings.")
    assert.equal(roundName('Chinese Grand Prix', { sprint: 1 }), 'Chinese Grand Prix sprint')
    assert.equal(raceWinner('A', { status: 'completed', co_winner_id: 'b' }), 'A shared')
    assert.equal(raceWinner('A', { status: 'scheduled', co_winner_id: null }), NOT_YET_RUN)
    // /races blanks the three result cells beside that tag, as the season's
    // calendar does, and dashes a NULL on a race that has run (CD-43).
    for (const key of ['constructor', 'pole', 'fastest_lap']) {
      const column = RACES_COLUMNS.find((c) => c.key === key)
      assert.equal(column.text(null, { status: 'scheduled' }), '', `/races ${key} on a race to come`)
      assert.equal(column.text('Ferrari', { status: 'scheduled' }), '', `/races ${key} even where a value is held`)
      assert.equal(column.text(null, { status: 'completed' }), EMPTY, `/races ${key} unestablished on a race run`)
      assert.equal(column.text('Ferrari', { status: 'completed' }), 'Ferrari', `/races ${key} on a race run`)
    }
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

  // CD-39, CD-61: what a race meant, after who won. Each sentence from rows
  // shaped as RACE_HISTORY returns them, so each rule is seen to close.
  it('says what a race meant: the field, the firsts, the wins record and the title', () => {
    const podium = (over) => ({
      driver_id: 'a', driver: 'A', finish_position: 1, constructor_id: 'k', constructor: 'K',
      wins_before: 5, podiums_before: 9, team_wins_before: 20, record_before: 40, rounds_before: 300,
      starters: 20, classified: 14, one_car_each: 1, ...over,
    })
    assert.equal(raceAftermath([], null), '', 'nothing held, nothing said')
    assert.equal(raceAftermath([podium({})], null), '6 of the starters were not classified.', 'no figure the Entries tile shows')
    assert.equal(raceAftermath([podium({ classified: 19 })], null), '1 of the starters was not classified.')
    assert.equal(raceAftermath([podium({ classified: 20 })], null), 'Every starter was classified.')
    assert.equal(raceAftermath([podium({ starters: null })], null), '', 'a field nobody counted is not "every starter"')
    assert.equal(raceAftermath([podium({ one_car_each: 0 })], null), '', 'counts of drivers say nothing of cars where two drove one')
    assert.equal(raceAftermath([podium({ one_car_each: 0, classified: 20 })], null), '')
    // Firsts: the driver, the car's constructor, and anyone else on the podium.
    assert.equal(
      raceAftermath([podium({ wins_before: 0, podiums_before: 0, team_wins_before: 0, classified: 20 }), podium({ driver: 'B', finish_position: 2, podiums_before: 0 }), podium({ driver: 'C', finish_position: 3, podiums_before: 0 })], null),
      'Every starter was classified. It was the first championship race win for A and for K, and the first championship podium for B and C.',
    )
    assert.equal(
      raceAftermath([podium({ team_wins_before: 0, classified: 20 }), podium({ driver: 'B', finish_position: 2 })], null),
      'Every starter was classified. It was the first championship race win for K.',
    )
    assert.equal(
      raceAftermath([podium({ team_wins_before: null, constructor_id: null, constructor: null, wins_before: 0, classified: 20 })], null),
      'Every starter was classified. It was the first championship race win for A.',
      'a car with no constructor - an Indianapolis 500 - claims no first for anyone but its driver',
    )
    assert.equal(
      raceAftermath([podium({ wins_before: 0, rounds_before: 0, classified: 20 }), podium({ driver: 'B', finish_position: 2, podiums_before: 0, rounds_before: 0 })], null),
      'Every starter was classified.',
      'the first round of all has nothing to be first against',
    )
    // The wins record: past it, level with it, short of it, and a first win.
    assert.match(raceAftermath([podium({ wins_before: 40, record_before: 40 })], null), /A set a new record of 41 championship Grand Prix wins\.$/)
    assert.match(raceAftermath([podium({ wins_before: 39, record_before: 40 })], null), /A equalled the record of 40 championship Grand Prix wins\.$/)
    assert.doesNotMatch(raceAftermath([podium({ wins_before: 38, record_before: 40 })], null), /record/)
    assert.doesNotMatch(raceAftermath([podium({ wins_before: 0, record_before: 0 })], null), /record/, 'a first win is said as a first, not as a record')
    assert.doesNotMatch(
      raceAftermath([podium({ wins_before: 40, record_before: 40 }), podium({ driver: 'B', wins_before: 40, record_before: 40 })], null),
      /record/,
      'a shared win claims no record: two counts, one sentence',
    )
    // The title, won and lost.
    assert.match(raceAftermath([podium({})], { champion: 'B', ledBefore: null }), /This round settled the drivers' title for B\.$/)
    assert.match(
      raceAftermath([podium({})], { champion: 'B', ledBefore: 'C' }),
      /This round settled the drivers' title for B\. C had led the championship going into it\.$/,
    )
    // The lede: the sentence, then this, then the note; nothing of it on a
    // round with no result held.
    const race = { year: 2008, status: 'completed', circuit: 'Interlagos', note: 'Run in the rain.' }
    const won = [{ driver: 'A', constructor_id: 'k', constructor: 'K', grid: 1, grid_text: '1', pole: 1 }]
    assert.equal(
      raceLede(race, won, 'awaited', { history: [podium({ classified: 20 })], title: { champion: 'B', ledBefore: null } }),
      "A won for K from pole at Interlagos. Every starter was classified. This round settled the drivers' title for B. Run in the rain.",
    )
    assert.equal(raceLede(race, [], 'awaited', { history: [podium({})], title: { champion: 'B' } }), 'No winner is recorded for this round. Run in the rain.')
  })

  // CD-61: the round the title was settled at, from the drivers' table after
  // it and after the round before.
  it('finds the round that settled the drivers\' title, and declines wherever the arithmetic would not carry', () => {
    const counts = 'Every result counts'
    // A driver's wins are the third member of the pair, where a case needs them.
    const rows = (before, after, { availableBefore = 26, availableAfter = 0, racesBefore = 1, racesAfter = 0, champion = 'a', dropped = counts } = {}) => [
      ...before.map(([id, pts, wins], i) => ({ after_round: 21, driver_id: id, entity: id.toUpperCase(), points: pts, wins, position: i + 1, dropped_scores: dropped, available: availableBefore, races_left: racesBefore, drivers_champion: champion })),
      ...after.map(([id, pts, wins], i) => ({ after_round: 22, driver_id: id, entity: id.toUpperCase(), points: pts, wins, position: i + 1, dropped_scores: dropped, available: availableAfter, races_left: racesAfter, drivers_champion: champion })),
    ]
    assert.deepEqual(titleSettled(rows([['a', 100], ['b', 90]], [['a', 110], ['b', 108]]), 22), { champion: 'A', ledBefore: null })
    assert.deepEqual(
      titleSettled(rows([['b', 100], ['a', 95]], [['a', 120], ['b', 110]]), 22),
      { champion: 'A', ledBefore: 'B' },
      'the title lost as well as won',
    )
    assert.deepEqual(
      titleSettled(rows([['b', 100], ['a', 100]], [['a', 120], ['b', 110]]), 22),
      { champion: 'A', ledBefore: null },
      'level going in, so nobody led',
    )
    assert.equal(titleSettled(rows([['a', 100], ['b', 74]], [['a', 110], ['b', 80]]), 22), null, 'already settled before the round')
    // A margin equal to what was left: a tie on points, settled on wins, with
    // the driver behind having won every race left (2006 going into Brazil).
    assert.deepEqual(
      titleSettled(rows([['a', 100, 7], ['b', 74, 7]], [['a', 125, 7], ['b', 99, 8]]), 22),
      { champion: 'A', ledBefore: null },
      'the round before, the driver behind could still have won the tie on wins',
    )
    assert.equal(titleSettled(rows([['a', 100, 9], ['b', 74, 7]], [['a', 125, 9], ['b', 99, 8]]), 22), null, 'or could not, so it was settled before')
    assert.equal(titleSettled(rows([['a', 100, 8], ['b', 74, 7]], [['a', 125, 8], ['b', 99, 8]]), 22), null, 'level on wins too goes to a countback this does not work out')
    assert.equal(titleSettled(rows([['a', 100], ['b', 74]], [['a', 125], ['b', 99]]), 22), null, 'and no wins on record says nothing')
    // ... and after the round (2004 in Belgium).
    assert.deepEqual(
      titleSettled(rows([['a', 100, 11], ['b', 90, 2]], [['a', 110, 12], ['b', 100, 2]], { availableAfter: 10, racesAfter: 1 }), 22),
      { champion: 'A', ledBefore: null },
      'a margin equal to what is left is settled where the tie on wins is out of reach',
    )
    assert.equal(
      titleSettled(rows([['a', 100, 3], ['b', 90, 3]], [['a', 110, 3], ['b', 100, 3]], { availableAfter: 10, racesAfter: 1 }), 22),
      null,
      'and is not where winning the race left would win the tie',
    )
    assert.equal(titleSettled(rows([['a', 100, 3], ['b', 90, 2]], [['a', 110, 3], ['b', 100, 2]], { availableAfter: 10, racesAfter: 1 }), 22), null, 'nor where it would level the wins')
    assert.equal(titleSettled(rows([['a', 100], ['b', 90]], [['a', 110], ['b', 100]], { availableAfter: 10, racesAfter: 1 }), 22), null, 'nor with no wins on record')
    assert.deepEqual(titleSettled(rows([['a', 100, 4], ['b', 90, 3]], [['a', 110, 5], ['b', 110, 3]]), 22), { champion: 'A', ledBefore: null }, 'level at the end, the leader on wins')
    assert.equal(titleSettled(rows([['a', 100, 4], ['b', 90, 3]], [['a', 110, 4], ['b', 110, 4]]), 22), null, 'level at the end on points and wins')
    assert.equal(titleSettled(rows([['a', 100], ['b', 90]], [['a', 110], ['b', 100]], { availableAfter: null }), 22), null, 'an unpriced sprint declines')
    assert.equal(titleSettled(rows([['a', 100], ['b', 90]], [['a', 110], ['b', 108]], { dropped: 'Best 6 of 10' }), 22), null, 'a dropped-scores season declines')
    assert.equal(titleSettled(rows([['a', 100], ['b', 90]], [['a', 110], ['b', 108]], { champion: 'b' }), 22), null, 'a leader who is not the recorded champion declines')
    assert.deepEqual(titleSettled(rows([['a', 100], ['b', 90]], [['a', 110], ['b', 108]], { champion: null }), 22), { champion: 'A', ledBefore: null }, 'a season being run has no champion recorded yet')
    assert.equal(titleSettled(rows([], [['a', 110], ['b', 108]]), 22), null, 'no table before the round')
    assert.equal(titleSettled(rows([['a', 100], ['b', 90]], [['a', 110]]), 22), null, 'a table of one')
    const conflict = rows([['a', 100], ['b', 90]], [['a', 110], ['b', 108]])
    conflict.push({ ...conflict.at(-1), points: 111 })
    assert.equal(titleSettled(conflict, 22), null, 'two sources giving one driver two totals')
    const excluded = rows([['a', 100], ['b', 90]], [['a', 110], ['b', 108]])
    excluded.push({ ...excluded.at(-1), driver_id: 'x', entity: 'X', points: 200, position: null })
    assert.deepEqual(titleSettled(excluded, 22), { champion: 'A', ledBefore: null }, 'a driver excluded from the classification is not the leader')
    assert.equal(titleSettled([], 22), null)
  })

  // CD-39, CD-61: the two queries, on a database built from schema.sql and a
  // handful of rows, so what they count is seen apart from what f1.db holds.
  it('counts a race\'s history and its title arithmetic from the rounds before it', () => {
    const db = new DatabaseSync(':memory:', { enableForeignKeyConstraints: false })
    db.exec(readFileSync(join(web, '..', 'schema.sql'), 'utf8'))
    // schema.sql turns the keys on; these rows name no grand prix or source.
    db.exec('PRAGMA foreign_keys = OFF')
    const race = db.prepare('INSERT INTO races (id, year, round, gp_id, name_used, sprint, status) VALUES (?, ?, ?, ?, ?, ?, ?)')
    race.run(1, 2000, 1, 'gp', 'One', 0, 'completed')
    race.run(2, 2000, 2, 'gp', 'Two', 0, 'completed')
    race.run(3, 2001, 1, 'gp', 'Three', 0, 'completed')
    race.run(4, 2001, 2, 'gp', 'Four', 1, 'scheduled')
    for (const id of ['a', 'b', 'c', 'd']) db.prepare('INSERT INTO drivers (id, full_name) VALUES (?, ?)').run(id, id.toUpperCase())
    db.prepare("INSERT INTO constructors (id, name) VALUES ('k', 'K'), ('m', 'M')").run()
    const entry = db.prepare('INSERT INTO race_entries (race_id, driver_id, constructor_id, finish_position, position_text, grid, grid_text) VALUES (?, ?, ?, ?, ?, ?, ?)')
    entry.run(1, 'a', 'k', 1, '1', 1, '1')
    entry.run(1, 'b', 'k', 2, '2', 2, '2')
    entry.run(2, 'a', 'k', 1, '1', 1, '1')
    entry.run(2, 'c', 'm', 3, '3', 2, '2')
    // The round asked about: c wins in m's car, b second, d did not start.
    entry.run(3, 'c', 'm', 1, '1', 2, '2')
    entry.run(3, 'b', 'k', 2, '2', 1, '1')
    entry.run(3, 'a', 'k', null, 'DNF', 3, '3')
    entry.run(3, 'd', 'm', null, 'DNS', null, null)
    const got = db.prepare(RACE_HISTORY).all(2001, 1)
    assert.deepEqual(
      got.map((r) => [r.driver_id, r.finish_position, r.wins_before, r.podiums_before, r.team_wins_before, r.record_before, r.rounds_before, r.starters, r.classified]),
      [
        ['c', 1, 0, 1, 0, 2, 2, 3, 2],
        ['b', 2, 0, 1, 2, 2, 2, 3, 2],
      ],
      'counts over the earlier rounds only - an earlier season and none of this round - and DNS is not a start',
    )
    // One car each: d did not start, so its blank grid is no matter.
    const oneCarEach = () => db.prepare(RACE_HISTORY).all(2001, 1)[0].one_car_each
    assert.equal(oneCarEach(), 1)
    db.exec("UPDATE race_entries SET grid = NULL, grid_text = 'PL' WHERE race_id = 3 AND driver_id = 'a'")
    assert.equal(oneCarEach(), 1, 'a pit-lane start is a car of its own')
    db.exec("UPDATE race_entries SET grid_text = NULL WHERE race_id = 3 AND driver_id = 'a'")
    assert.equal(oneCarEach(), 0, 'a starter with no slot at all may be a relief driver in a car already counted')
    db.exec("UPDATE race_entries SET grid = 1, grid_text = '1' WHERE race_id = 3 AND driver_id = 'a'")
    assert.equal(oneCarEach(), 0, 'two starters on one slot')
    db.exec("UPDATE race_entries SET grid = 3, grid_text = '3', shared_drive = 1 WHERE race_id = 3 AND driver_id = 'a'")
    assert.equal(oneCarEach(), 0, 'a flagged shared drive')
    assert.equal(db.prepare(RACE_HISTORY).all(2000, 1)[0].rounds_before, 0)
    assert.equal(db.prepare(RACE_HISTORY).all(2000, 1)[0].record_before, null, 'no win before the first')

    db.exec(`INSERT INTO points_systems (session, from_year, to_year, scoring, scale, win_points, fastest_lap, fastest_lap_points, dropped_scores)
             VALUES ('race', 2000, NULL, 's', 's', 25, 'fl', 1, 'Every result counts')`)
    const standing = db.prepare("INSERT INTO standings (year, table_type, entity, driver_id, points, position, after_round, basis) VALUES (2001, 'drivers', ?, ?, ?, ?, ?, 'running')")
    standing.run('C', 'c', 25, 1, 1)
    standing.run('B', 'b', 18, 2, 1)
    const title = db.prepare(TITLE_STANDINGS).all(2001, 1)
    assert.deepEqual(
      title.map((r) => [r.after_round, r.driver_id, r.available, r.wins, r.races_left]),
      [
        [1, 'c', null, 1, 1],
        [1, 'b', null, 0, 1],
      ],
      'a sprint still to run with no sprint system to price it is NULL, not nothing',
    )
    db.exec(`INSERT INTO points_systems (session, from_year, to_year, scoring, scale, win_points, fastest_lap, fastest_lap_points, dropped_scores)
             VALUES ('sprint', 2000, NULL, 's', 's', 8, 'none', 0, 'Every result counts')`)
    assert.deepEqual(
      db.prepare(TITLE_STANDINGS).all(2001, 2).map((r) => [r.after_round, r.available]),
      [
        [1, 34],
        [1, 34],
      ],
      'after round 1, one race still to run at a win and the fastest lap, and its sprint at a sprint win',
    )
    db.close()
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
      raceSentence({ year: 2027, status: 'scheduled', circuit: 'Istanbul Park', date_iso: '2027-10-03', date_from: '2027-10-01', date_to: '2027-10-03', note: null }, []),
      'Scheduled at Istanbul Park; not yet run.',
      'CD-39: the date is the eyebrow\'s, in a <time>, and not a third copy in the lede',
    )
    assert.equal(
      raceSentence({ year: 2027, status: 'scheduled', circuit: null, date_iso: null, date_from: null, date_to: null, note: null }, []),
      'Scheduled; not yet run.',
    )
    // AF-01: once the clock says the race has been run, "not yet run" is the
    // one thing the sentence must not say - the round is still `scheduled`
    // because no classification has been loaded, which is what it says
    // instead. The note below the classification agrees with it.
    assert.equal(
      raceSentence({ year: 2027, status: 'scheduled', circuit: 'Istanbul Park', date_iso: '2027-10-03', date_from: '2027-10-01', date_to: '2027-10-03', note: null }, [], 'run'),
      'Scheduled at Istanbul Park; no result is recorded yet.',
    )
    assert.equal(
      raceLede({ year: 2027, status: 'scheduled', circuit: 'Istanbul Park', date_iso: '2027-10-03', date_from: '2027-10-01', date_to: '2027-10-03', note: null }, [], 'running'),
      'Scheduled at Istanbul Park; no result is recorded yet.',
    )
    const scheduledRound = { year: 2027, status: 'scheduled', circuit: 'Istanbul Park', date_iso: '2027-10-03', date_from: '2027-10-01', date_to: '2027-10-03', note: null }
    assert.equal(scheduledNote(scheduledRound).head, 'This race has not been run.')
    assert.equal(scheduledNote(scheduledRound).body, 'It is on the 2027 calendar and carries no result yet.')
    assert.equal(scheduledNote(scheduledRound, 'running').head, 'This race is under way.')
    assert.equal(scheduledNote(scheduledRound, 'run').head, 'This race has been run; the result is not here yet.')
    // No race is in this state today; a round part-way through being loaded
    // would be, and a thrown lede is worse than a plain sentence.
    assert.equal(raceSentence(monza, []), 'No winner is recorded for this round.')

    // SD-39: the note follows who won and never replaces it. Whitespace is
    // not a note.
    const won = [{ driver: 'Gerhard Berger', constructor_id: 'ferrari', constructor: 'Ferrari' }]
    assert.equal(raceLede({ ...monza, note: 'Held on a Sunday in June.' }, won), 'Gerhard Berger won for Ferrari at Monza. Held on a Sunday in June.')
    assert.equal(raceLede({ ...monza, note: '  Held on a Sunday in June.  ' }, won), 'Gerhard Berger won for Ferrari at Monza. Held on a Sunday in June.')
    assert.equal(
      raceLede({ year: 2027, status: 'scheduled', circuit: 'Istanbul Park', date_iso: '2027-10-03', date_from: '2027-10-01', date_to: '2027-10-03', note: 'Subject to homologation.' }, []),
      'Scheduled at Istanbul Park; not yet run. Subject to homologation.',
    )
    for (const note of [null, undefined, '', '   ']) {
      assert.equal(
        raceLede({ ...monza, note }, won),
        'Gerhard Berger won for Ferrari at Monza.',
        `a ${JSON.stringify(note)} note falls through to the records`,
      )
    }

    // CD-39: where the one winner started. Pole is the credit and the slot
    // together; the slot without the credit is the front of the grid (2022
    // Brazil, the sprint's grid); a pit-lane start is not a slot.
    const berger = { driver: 'Gerhard Berger', constructor_id: 'ferrari', constructor: 'Ferrari' }
    assert.equal(raceSentence(monza, [{ ...berger, grid: 1, grid_text: '1', pole: 1 }]), 'Gerhard Berger won for Ferrari from pole at Monza.')
    assert.equal(raceSentence(monza, [{ ...berger, grid: 1, grid_text: '1', pole: 0 }]), 'Gerhard Berger won for Ferrari from the front of the grid at Monza.')
    assert.equal(raceSentence(monza, [{ ...berger, grid: 3, grid_text: '3', pole: 0 }]), 'Gerhard Berger won for Ferrari from 3rd on the grid at Monza.')
    assert.equal(raceSentence(monza, [{ ...berger, grid: 22, grid_text: '22', pole: 0 }]), 'Gerhard Berger won for Ferrari from 22nd on the grid at Monza.')
    assert.equal(raceSentence(monza, [{ ...berger, grid: 24, grid_text: 'PL', pole: 0 }]), 'Gerhard Berger won for Ferrari at Monza.', 'a pit-lane start names no slot')
    assert.equal(raceSentence(monza, [{ ...berger, grid: null, grid_text: null, pole: 0 }]), 'Gerhard Berger won for Ferrari at Monza.', 'nor does a grid nobody recorded')
    assert.equal(
      raceSentence({ ...monza, circuit: 'Reims-Gueux' }, [
        { driver: 'Juan Manuel Fangio', constructor_id: 'alfa-romeo', constructor: 'Alfa Romeo', grid: 1, pole: 1 },
        { driver: 'Luigi Fagioli', constructor_id: 'alfa-romeo', constructor: 'Alfa Romeo', grid: 7, pole: 0 },
      ]),
      'Juan Manuel Fangio and Luigi Fagioli shared the win for Alfa Romeo at Reims-Gueux.',
      'a shared win has two drivers and one slot, and names none',
    )

    // SD-40: an empty pit-stop section before the first season with a stop,
    // between, and after the last round holding one - the last on either
    // side of a season's turn as well as within one.
    const span = { year: 1994, latest_year: 2026, latest_round: 15 }
    assert.match(stintsEmpty({ year: 1976, round: 9 }, span), /^Pit stops are recorded from 1994\./)
    for (const race of [{ year: 2021, round: 12 }, { year: 2026, round: 15 }, { year: 2026, round: 3 }]) {
      assert.match(stintsEmpty(race, span), /^F1DB records no pit stop for this race/, `${race.year}/${race.round} is a race without a stop`)
    }
    for (const race of [{ year: 2026, round: 16 }, { year: 2027, round: 1 }]) {
      assert.match(stintsEmpty(race, span), /^No pit stop is recorded for this race yet\./, `${race.year}/${race.round} is awaiting its stops`)
    }
    // No stop held anywhere: nothing to be before or after.
    assert.match(stintsEmpty({ year: 2026, round: 16 }, undefined), /^F1DB records no pit stop for this race/)
  })

  it('groups a constructor’s lineage into chains, its own first, in order (DA-32)', () => {
    const step = (chain_id, sequence, from_year, constructor_id) => ({ chain_id, sequence, from_year, constructor_id })
    const rows = [
      step('renault-1977', 1, 1977, 'renault'),
      step('enstone', 6, 2021, 'alpine'),
      step('enstone', 3, 2002, 'renault'),
      step('enstone', 1, 1981, 'toleman'),
    ]
    const chains = lineageChains(rows, { id: 'renault', lineage_chain: 'enstone' })
    assert.deepEqual(chains.map((c) => c[0].chain_id), ['enstone', 'renault-1977'], 'the constructor’s own chain leads')
    assert.deepEqual(chains[0].map((s) => s.sequence), [1, 3, 6], 'steps in sequence order')
    const later = lineageChains(
      [step('b', 1, 2000, 'x'), step('a', 1, 1990, 'x'), step('c', 1, null, 'x')],
      { id: 'x', lineage_chain: null },
    )
    assert.deepEqual(later.map((c) => c[0].chain_id), ['a', 'b', 'c'], 'otherwise by first year, a chain with no year last')
    assert.deepEqual(lineageChains([], { id: 'x', lineage_chain: null }), [])
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
    // The Constructor beside it is blank on a race to come, dashed on one run (CD-43).
    const hereCar = RACE_COLUMNS.find((c) => c.key === 'constructor').text
    assert.equal(hereCar(null, { status: 'scheduled' }), '')
    assert.equal(hereCar(null, { status: 'completed' }), EMPTY)
    assert.equal(hereCar('McLaren', { status: 'completed' }), 'McLaren')
  })

  it('adds a Confidence or an As of column only where the records differ on it', () => {
    const shared = [
      { confidence: 'reference', as_of: '2026-09-21' },
      { confidence: 'reference', as_of: '2026-09-21' },
    ]
    assert.deepEqual(tiersOf(shared), ['reference'])
    assert.equal(asOfOf(shared), '2026-09-21')
    assert.deepEqual(
      recordColumns(shared).map((c) => c.label),
      // The value is second: the record and its figure are the pair the
      // page is for, and the holder answers the question after that (VD-51).
      ['Record', 'Value', 'Held by', 'How it is derived'],
    )
    assert.equal(recordColumns([{ confidence: 'reference' }, { confidence: 'high' }]).at(-1).key, 'confidence')
    const apart = [{ ...shared[0] }, { ...shared[1], as_of: '2026-09-07' }]
    assert.equal(asOfOf(apart), null)
    assert.equal(recordColumns(apart).at(-1).key, 'as_of')
    // The headline cards carry the same two, on the same condition (VD-68).
    assert.deepEqual(cardExtras(shared), [])
    assert.deepEqual(cardExtras([{ ...apart[0], confidence: 'high' }, apart[1]]).map((c) => c.key), ['as_of', 'confidence'])
  })

  it('draws a leaderboard to fifteen, and keeps a tie at the cut whole (VD-68)', () => {
    const board = (wins) => wins.map((w, i) => ({ id: i, wins: w }))
    const clean = board([30, 29, 28, 27, 26, 25, 24, 23, 22, 21, 20, 19, 18, 17, 16, 15, 14])
    assert.equal(leadersDrawn(clean, 'wins').length, LEADERS_DRAWN)
    assert.equal(leadersDrawnLine(LEADERS_DRAWN), 'The fifteen with the most.')
    // Fourteenth to seventeenth level, as the constructors on nine wins are.
    const tied = board([30, 29, 28, 27, 26, 25, 24, 23, 22, 21, 20, 19, 18, 9, 9, 9, 9, 8])
    assert.deepEqual(leadersDrawn(tied, 'wins').map((r) => r.id), [...Array(17).keys()])
    assert.match(leadersDrawnLine(17), /^The 17 with the most/)
    assert.equal(leadersDrawn(board([3, 2, 1]), 'wins').length, 3)
  })

  it("marks a leaderboard's holder, every one of a shared record, and nothing on an empty board (VD-94)", () => {
    const bars = (values) => values.map((value, i) => ({ key: i, value }))
    assert.deepEqual(markLeaders(bars([9, 7, 7])).map((b) => b.mark), [true, false, false])
    assert.deepEqual(markLeaders(bars([7, 7, 5])).map((b) => b.mark), [true, true, false])
    assert.deepEqual(markLeaders([]), [])
  })

  it('leads with the headline records and shows every other one once, under its family (WK-08)', () => {
    const rows = [
      { id: 1, key: 'a', family: 'Championships', headline: 1 },
      { id: 2, key: 'b', family: 'Wins', headline: 1 },
      { id: 3, key: 'c', family: 'Pole positions', headline: 0 },
      { id: 4, key: 'd', family: 'Wins', headline: 0 },
      { id: 5, key: 'e', family: 'Championships', headline: 0 },
    ]
    assert.deepEqual(headlineRecords(rows).map((r) => r.key), ['a', 'b'])
    const families = recordFamilies(rows)
    // In the order each family's FIRST record comes, the headline ones
    // included: Wins is second though its first row below the headline is id 4.
    assert.deepEqual(families.map((f) => f.family), ['Championships', 'Wins', 'Pole positions'])
    assert.deepEqual(families.map((f) => f.rows.map((r) => r.key)), [['e'], ['d'], ['c']])
    assert.equal(families[2].anchor, 'pole-positions')
    // A family with nothing below the headline has no section.
    assert.deepEqual(recordFamilies(rows.slice(0, 2)), [])
    assert.equal(familyAnchor('Races and circuits'), 'races-and-circuits')
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

describe('thumbUrl and fileTitle: the stored address, or one built from the file name', () => {
  const stored = 'https://thumb.wikimedia.org/wikipedia/commons/thumb/a/a8/X.jpg/960px-X.jpg'
  it('strips the File: prefix, underscores the spaces and encodes the rest', () => {
    assert.equal(
      thumbUrl({ file_name: 'File:Ayrton Senna 1988 (Canada).jpg' }, 640),
      'https://commons.wikimedia.org/wiki/Special:FilePath/Ayrton_Senna_1988_(Canada).jpg?width=640',
    )
    assert.equal(thumbUrl({ file_name: 'Nürburgring.jpg' }).includes('N%C3%BCrburgring.jpg?width=800'), true)
  })
  it('takes the stored address up to the width it was fetched at (VD-23)', () => {
    assert.equal(thumbUrl({ file_name: 'File:X.jpg', thumb_url: stored }, 600), stored)
    assert.equal(thumbUrl({ file_name: 'File:X.jpg', thumb_url: stored }), stored)
    assert.equal(thumbUrl({ file_name: 'File:X.jpg', thumb_url: stored }, THUMB_WIDTH), stored)
  })
  it('builds the Special:FilePath address past that width, without one, or when told not to', () => {
    const built = 'https://commons.wikimedia.org/wiki/Special:FilePath/X.jpg?width='
    assert.equal(thumbUrl({ file_name: 'File:X.jpg', thumb_url: stored }, 1200), `${built}1200`)
    assert.equal(thumbUrl({ file_name: 'File:X.jpg', thumb_url: null }, 600), `${built}600`)
    assert.equal(thumbUrl({ file_name: 'File:X.jpg', thumb_url: ' ' }, 600), `${built}600`)
    assert.equal(thumbUrl({ file_name: 'File:X.jpg', thumb_url: stored }, 600, { direct: false }), `${built}600`)
  })
  it('is null for no file name rather than a URL to nothing', () => {
    assert.equal(thumbUrl({ file_name: '' }), null)
    assert.equal(thumbUrl({ file_name: null }), null)
    assert.equal(thumbUrl({ file_name: 'File:' }), null)
    assert.equal(thumbUrl(null), null)
  })
  it('captions with the name a person would read, as Commons heads the page (DP-31)', () => {
    assert.equal(fileTitle('File:Ayrton_Senna_1988.jpg'), 'Ayrton Senna 1988')
    assert.equal(fileTitle('Circuit de Monaco, April 1, 2018 SkySat (cropped).jpg'), 'Circuit de Monaco, April 1, 2018 SkySat (cropped)')
    assert.equal(fileTitle('File:Lotus 49 (1967).PNG'), 'Lotus 49 (1967)')
    // Only a trailing extension: a dot inside a title is part of it.
    assert.equal(fileTitle('File:Dr. Giuseppe Farina.jpg'), 'Dr. Giuseppe Farina')
    assert.equal(fileTitle(undefined), '')
  })
  it('names the credit link for the photograph and where it goes, beginning with what it shows', () => {
    const name = fileLinkName({ file_name: 'File:Ayrton_Senna_1988.jpg' })
    assert.equal(name, 'Ayrton Senna 1988, on Wikimedia Commons')
    assert.ok(name.startsWith(fileTitle('File:Ayrton_Senna_1988.jpg')), 'the visible text begins the name (2.5.3)')
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
    // Whose lengths are whose, only where the register's sit beside F1DB's.
    assert.ok(!circuitOutlinesNote(8).includes(OUTLINE_FIGURES_NOTE))
    assert.ok(circuitOutlinesNote(8, true).endsWith(OUTLINE_FIGURES_NOTE))
    // VD-83: the large lead sits in the timeline's section too, so it is named there.
    assert.ok(circuitOutlinesNote(8, true).includes(OUTLINE_LEAD_NOTE))
    assert.ok(!circuitOutlinesNote(1, true).includes(OUTLINE_LEAD_NOTE))
  })
  it("lists a timeline card's facts under its heading, and a missing length as not established (AX-26)", () => {
    const facts = (entry) => layoutFacts(entry).map(({ label, value }) => `${label}=${value}`)
    const row = { layout_name: 'Grand Prix circuit', from_year: 2010, to_year: null, length_km: 5.891, confidence: 'high' }
    assert.deepEqual(facts({ layout: row, outline: null }), ['Years=2010–', 'Length=5.891 km', 'Confidence=high'])
    // A length the register does not hold is null, never 0 or dropped.
    assert.deepEqual(facts({ layout: { ...row, length_km: null }, outline: null })[1], 'Length=null')
    // A drawing no row names has the outline's years and nothing of the register's.
    assert.deepEqual(facts({ layout: null, outline: { first_year: 1955, last_year: 1961 } }), ['Years=1955–1961'])
    // Its heading carries those years, so two such cards are not headed alike.
    const unnamed = (first, last) => timelineName({ layout: null, outline: { first_year: first, last_year: last } })
    assert.equal(unnamed(2008, 2012), `${NO_TIMELINE_ROW}, 2008–2012`)
    assert.notEqual(unnamed(2008, 2012), unnamed(2013, 2014))
    assert.equal(timelineName({ layout: row, outline: null }), 'Grand Prix circuit')
  })
  it("prints a race's layout with the register's figures, and says whose they are only beside F1DB's (AF-07)", () => {
    const race = {
      layout_name: 'Original long circuit',
      layout_km: 7.96,
      layout_turns: 26,
      outline: 'M0 0',
      outline_km: 7.873,
      outline_turns: 26,
    }
    assert.equal(layoutRaced(race), 'Original long circuit · 7.96 km · 26 turns')
    // A figure the register does not hold is left out, never printed as 0.
    assert.equal(layoutRaced({ ...race, layout_turns: null }), 'Original long circuit · 7.96 km')
    assert.equal(layoutRaced({ ...race, layout_km: null, layout_turns: null }), 'Original long circuit')
    assert.equal(layoutRaced({ ...race, layout_name: null }), null)
    assert.equal(raceLayoutNote(race), RACE_LAYOUT_NOTE)
    // No note where one side has no figures to set against the other's.
    assert.equal(raceLayoutNote({ ...race, outline: null }), null)
    assert.equal(raceLayoutNote({ ...race, outline_km: null, outline_turns: null }), null)
    assert.equal(raceLayoutNote({ ...race, layout_name: null, layout_km: null, layout_turns: null }), null)
    // A length of 0 is a figure, not a missing one.
    assert.equal(layoutRaced({ ...race, layout_km: 0, layout_turns: null }), 'Original long circuit · 0 km')
  })
  it("folds a circuit's timeline and its outlines into one list, and hides neither side's gaps (IX-32)", () => {
    const layout = (id, from, drawn) => ({ id, from_year: from, f1db_layout_id: drawn })
    const outline = (id, first) => ({ f1db_layout_id: id, first_year: first })
    const shape = (entries) => entries.map(({ layout: l, outline: o }) => [l?.id ?? null, o?.f1db_layout_id ?? null])
    // Monza's shape: a drawing two rows name, a row that names none, and a
    // drawing no row names, which ties with that row on its year.
    const outlines = [outline('m-1', 1950), outline('m-2', 1955), outline('m-5', 1974), outline('m-6', 1976), outline('m-9', null)]
    const layouts = [layout(3, 1950, 'm-1'), layout(4, 1955, 'm-2'), layout(6, 1960, 'm-2'), layout(9, 1974, null), layout(10, 1994, 'm-6')]
    assert.deepEqual(shape(layoutTimeline(layouts, outlines)), [
      [3, 'm-1'],
      [4, 'm-2'],
      [6, 'm-2'],
      [9, null],
      [null, 'm-5'],
      [10, 'm-6'],
      [null, 'm-9'],
    ])
    // A row naming a drawing this circuit has none of is a row with no drawing, not a dropped row.
    assert.deepEqual(shape(layoutTimeline([layout(1, 2000, 'x-1')], [])), [[1, null]])
    // A register row with no year goes last too.
    assert.deepEqual(shape(layoutTimeline([layout(2, null, null), layout(1, 1990, null)], [])), [[1, null], [2, null]])
    const keys = layoutTimeline(layouts, outlines).map((entry) => entry.key)
    assert.equal(new Set(keys).size, keys.length, 'every row has its own key, a drawing shown twice included')
    assert.deepEqual(layoutTimeline(undefined, undefined), [])
    assert.equal(layoutsCount(layouts, outlines), '5 in the timeline, 5 drawn')
    assert.equal(layoutsCount([], outlines), '5')
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
    assert.equal(colourSource([livery, livery]), 'the team’s own livery')
    // National only: never "the team's", and it says whose it is.
    assert.match(colourSource([national]), /the entrant’s national racing colour/)
    assert.doesNotMatch(colourSource([national]), /the team’s own livery$/)
    // Both: both named, and the national one still disclaimed.
    const both = colourSource([livery, national])
    assert.match(both, /the team’s livery from 2010/)
    assert.match(both, /before 1968 the entrant’s national racing colour, not the team’s$/)
    // A hollow mark is a null in the list and changes none of the three
    // answers - the note describes it in a clause of its own.
    assert.equal(colourSource([livery, gap]), colourSource([livery]))
    assert.equal(colourSource([national, gap]), colourSource([national]))
    // No colour at all is the one case the sentence must never be printed
    // for, and both callers guard it: Driver.jsx on finishesInColour and
    // Records.jsx on bars.some(colour), each of which is false here. The
    // clause is short because a figure's note is held to 50 words (VD-80).
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

  // The columns the repository declares, in the three modules that declare
  // any. That nobody draws one of them is not checkable from here - a
  // `render` is written in a page and a link in prerender's own map - so it
  // is a conventions test and a build failure instead; see
  // test/conventions.mjs and fromColumns() in scripts/prerender.js.
  it('is declared on the columns that are their text, and on no others', () => {
    const declared = [
      ...RACE_COLUMNS,
      ...SEASON_COLUMNS,
      ...TEAM_SEASON_COLUMNS,
      ...recordColumns([{ confidence: 'reference' }]),
    ].filter((c) => c.collapse === true)
    assert.deepEqual(
      declared.map((c) => c.key),
      ['layout_key', 'wins', 'podiums', 'poles', 'fastest_laps', 'wins', 'podiums', 'poles'],
    )
  })
})

// ------------------------------------------------- the columns a register shows

describe('the columns a register shows (IA-23)', () => {
  const columns = [
    { key: 'name', rowHeader: true, label: 'Driver' },
    { key: 'nation', label: 'Nationality' },
    { key: 'wins', label: 'Wins', phone: true },
    { key: 'points', label: 'Points', optional: true },
    { key: 'titles', label: 'Titles', phone: true },
  ]
  const keys = (list) => list?.map((c) => c.key) ?? null

  it('opens on every column but the optional ones', () => {
    assert.deepEqual(keys(defaultColumns(columns)), ['name', 'nation', 'wins', 'titles'])
  })

  // The phone set is a mark on the default, not a second list; the row
  // header is in it without saying so, and a list that declares no phone
  // column has nothing to leave out.
  it('keeps the row header in the phone set, and marks nothing on a list that declares none', () => {
    assert.deepEqual(keys(columns.filter((c) => onPhone(c, columns))), ['name', 'wins', 'titles'])
    const plain = [{ key: 'a', rowHeader: true }, { key: 'b' }, { key: 'c' }]
    assert.deepEqual(keys(plain.filter((c) => onPhone(c, plain))), ['a', 'b', 'c'])
  })

  // `?cols=` is typed as often as it is clicked. The list's order, not the
  // parameter's; the row header whether asked for or not; a key the list
  // does not have dropped; and a parameter naming nothing it has is the
  // default rather than an empty table.
  it('reads ?cols= against the list, never past it', () => {
    assert.deepEqual(keys(chosenColumns(columns, 'titles,points')), ['name', 'points', 'titles'])
    assert.deepEqual(keys(chosenColumns(columns, 'wins,not-a-column')), ['name', 'wins'])
    assert.deepEqual(keys(chosenColumns(columns, 'titles wins')), ['name', 'wins', 'titles'])
    assert.equal(chosenColumns(columns, 'not-a-column'), null)
    assert.equal(chosenColumns(columns, ''), null)
    assert.equal(chosenColumns(columns, null), null)
  })

  // IX-27 asked for three at phone width, and the static page opens on the
  // phone set before a line of script has run, so each register's set holds
  // the column it opens sorted on as well: otherwise the app would redraw the
  // table the moment it took over, to show the column its arrow is on.
  it('gives each register a phone default of three, holding its opening sort', () => {
    const registers = [
      ['drivers', DRIVER_COLUMNS, 'wins'],
      ['constructors', CONSTRUCTOR_COLUMNS, 'entries'],
      ['circuits', CIRCUIT_COLUMNS, 'races'],
      ['grands prix', GRANDS_PRIX_COLUMNS, 'held'],
      ['chassis', CHASSIS_COLUMNS, 'first_year'],
      ['races', RACES_COLUMNS, null],
    ]
    for (const [name, list, opening] of registers) {
      const phone = defaultColumns(list).filter((c) => onPhone(c, list))
      assert.equal(phone.length, 3, `${name}: ${keys(phone).join(', ')}`)
      if (opening) assert.ok(keys(phone).includes(opening), `${name} opens sorted on ${opening}`)
      // An optional column is never in the phone set: the phone set is a
      // part of the default, and an optional column is not in the default.
      assert.ok(!list.some((c) => c.optional === true && c.phone === true), `${name}: optional and phone`)
      assert.ok(!list.some((c) => c.optional === true && c.rowHeader === true), `${name}: an optional row header`)
    }
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

  /*
   * CR-79. A stand-in for the address bar and react-router's navigate: like a
   * BrowserRouter, a navigation has moved the address by the time it returns,
   * and nothing re-renders in between - which is a burst inside one frame.
   */
  function bar(search, hash) {
    const where = { search, hash }
    const calls = []
    const navigate = (to, options) => {
      calls.push(options)
      where.search = to.search
      where.hash = to.hash
    }
    return { where, calls, address: () => where, navigate }
  }

  it('keeps the fragment the reader arrived on, and replaces rather than pushes', () => {
    const b = bar('?decade=1990s', '#champions')
    urlWriter({ 'champions.sort': '', 'champions.dir': '' }, b).set({ 'champions.sort': 'full_name', 'champions.dir': 'asc' })
    assert.equal(b.where.search, '?decade=1990s&champions.sort=full_name&champions.dir=asc')
    assert.equal(b.where.hash, '#champions')
    urlWriter({ decade: '' }, b).clear()
    assert.equal(b.where.search, '?champions.sort=full_name&champions.dir=asc')
    assert.equal(b.where.hash, '#champions', 'clearing a filter keeps it too')
    assert.deepEqual(b.calls, [{ replace: true }, { replace: true }])
  })

  it('writes an address with nothing left in it as no query at all', () => {
    const b = bar('?q=senna', '')
    urlWriter({ q: '' }, b).set({ q: '' })
    assert.equal(b.where.search, '')
  })

  it('composes two hooks writing in one frame, neither dropping the other', () => {
    // A page's filter and a table's keyed sort are two writers made from the
    // same render. Each composes on the address, not on that render, so the
    // second keeps what the first wrote - in either order.
    const b = bar('', '')
    const page = urlWriter({ q: '', category: '' }, b)
    const table = urlWriter({ 'glossary.sort': '', 'glossary.dir': '' }, b)
    page.set({ category: 'results' })
    table.set({ 'glossary.sort': 'term', 'glossary.dir': 'desc' })
    page.set({ q: 'pole' })
    assert.equal(b.where.search, '?category=results&glossary.sort=term&glossary.dir=desc&q=pole')
    table.set({ 'glossary.sort': '', 'glossary.dir': '' })
    assert.equal(b.where.search, '?category=results&q=pole')
  })
})

/*
 * VD-82, IX-46. Every other table keeps its state in the address too, under
 * its own name, and folds past FOLD_OVER rows unless it says why not.
 */
describe('a table in the address, and the one reveal control (VD-82)', () => {
  it('keys a table by the heading a reader can see, spelled for an address', () => {
    assert.equal(tableKey('Every entry'), 'every-entry')
    assert.equal(tableKey("Final drivers' standings"), 'final-drivers-standings')
    assert.equal(tableKey('Räikkönen — 2007 '), 'raikkonen-2007')
    assert.equal(tableKey(''), '')
    assert.equal(tableKey(null), '')
  })

  it('writes a keyed table down as a register is written, and leaves the others', () => {
    const keyed = { 'every-entry.sort': '', 'every-entry.dir': '', 'every-entry.all': false }
    const next = writeState(new URLSearchParams('every-win.all=1'), { 'every-entry.all': true, 'every-entry.sort': 'year', 'every-entry.dir': 'asc' }, keyed)
    assert.equal(String(next), 'every-win.all=1&every-entry.all=1&every-entry.sort=year&every-entry.dir=asc')
    // Back to the table's own order: nothing left behind but the other table.
    assert.equal(String(writeState(next, { 'every-entry.sort': '', 'every-entry.dir': '', 'every-entry.all': false }, keyed)), 'every-win.all=1')
  })

  it('refuses a long table that neither folds nor says why', () => {
    const over = FOLD_OVER + 1
    assert.equal(foldFault(FOLD_OVER, false, null), null, 'at the threshold, nothing to say')
    assert.match(foldFault(over, false, null), /no fold and no UNFOLDED reason/)
    assert.equal(foldFault(over, FOLD_NOUN.entries, null), null)
    assert.equal(foldFault(over, false, UNFOLDED.register), null)
    assert.match(foldFault(over, 'rows', null), /not a FOLD_NOUN value/)
    assert.match(foldFault(3, false, 'because'), /not an UNFOLDED reason/)
    assert.match(foldFault(over, FOLD_NOUN.entries, UNFOLDED.subject), /both/)
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
  // `open`: whether the reader has opened the table's fold (VD-69).
  const fakeTable = (caption, rows, open = false) => ({
    querySelector: (selector) => (selector === 'caption' && caption !== null ? { textContent: caption } : null),
    querySelectorAll: () => ({ length: rows }),
    closest: (selector) =>
      selector === '.table-wrap'
        ? { querySelector: (inner) => (inner === ':scope > details.table-fold' ? { open } : null) }
        : null,
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

  // VD-69. A fold the reader opened before the database did stays open:
  // closing it at the handover would take away rows they were reading. The
  // page is counted at boot, when every fold is closed, and the reader opens
  // one afterwards - which is the order a real page has, and the one the
  // first version of this read only at boot and so never saw.
  it('remembers a fold the reader opened after boot, on that route and under one name only', () => {
    const wins = fakeTable('Every win', 251)
    stand('/constructors/ferrari', [wins, fakeTable('Cars built', 90)], () => {
      captureStaticTables()
      assert.equal(staticOpen('Every win'), false)
      wins.closest = () => ({ querySelector: () => ({ open: true }) })
      captureOpenFolds()
      assert.equal(staticOpen('Every win'), true)
      assert.equal(staticOpen('Cars built'), false)
      assert.equal(staticOpen('Season by season'), false)
      globalThis.location = { pathname: '/constructors/mclaren' }
      assert.equal(staticOpen('Every win'), false)
    })
    stand('/somewhere', [fakeTable('Every entry', 40, true), fakeTable('Every entry', 900)], () => {
      captureStaticTables()
      captureOpenFolds()
      assert.equal(staticOpen('Every entry'), false)
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

/*
 * CD-08: the citation's second sentence names the sources behind the page's
 * rows with their terms, read from the three columns the build enforces
 * rather than from the licence prose.
 */
describe('the sources behind a page (CD-08)', () => {
  const f1db = { source: 'F1DB', redistributable: 'yes', share_alike: 0, attribution_required: 1 }
  const wiki = { source: 'Wikipedia season results tables', redistributable: 'yes', share_alike: 1, attribution_required: 1 }
  const fom = { source: 'F1 results archive', redistributable: 'facts-only', share_alike: 0, attribution_required: 0 }

  it('reads the terms from the classification, share-alike before attribution', () => {
    assert.equal(licenceTerms(f1db), 'redistributable with attribution')
    assert.equal(licenceTerms(wiki), 'redistributable, share-alike')
    assert.equal(licenceTerms(fom), 'facts only')
    assert.equal(licenceTerms({ redistributable: 'no' }), 'not redistributable')
    assert.equal(licenceTerms({ redistributable: 'yes', share_alike: 0, attribution_required: 0 }), 'redistributable')
  })

  it('lists one, two and three sources as a sentence, and none as nothing', () => {
    assert.equal(behindThisPage([f1db]).before, 'Behind this page: F1DB (redistributable with attribution). ')
    assert.equal(
      behindThisPage([wiki, f1db]).before,
      'Behind this page: Wikipedia season results tables (redistributable, share-alike) and F1DB (redistributable with attribution). ',
    )
    assert.match(behindThisPage([fom, wiki, f1db]).before, /\(facts only\), Wikipedia .* and F1DB/)
    assert.equal(behindThisPage([]), null)
    assert.equal(behindThisPage(undefined), null)
  })

  // CD-46: a season's page names the points system's entry only where it
  // prints what that system says - the title arithmetic, or a rule that
  // dropped scores - merged into the registry's order once.
  it("joins the points system's source in only where the page prints what it says", () => {
    const fom7 = { id: 7, priority: 7, source: 'F1 results archive' }
    const f1db10 = { id: 10, priority: 10, source: 'F1DB' }
    const written = { id: 18, priority: 18, source: 'Written for this project from general knowledge' }
    const formula1 = { id: 3, priority: 3, source: 'Formula1.com' }
    const base = [fom7, f1db10]
    const every = { dropped_scores: 'Every result counts' }
    const best = { dropped_scores: 'Varied: typically best n from each half of the season' }
    assert.deepEqual(seasonSources(base, [written], { answer: null, remaining: every }), base)
    assert.deepEqual(seasonSources(base, [written], { answer: null, remaining: null }), base)
    assert.deepEqual(seasonSources(base, [written], { answer: { who: 'x' }, remaining: every }).map((s) => s.id), [7, 10, 18])
    assert.deepEqual(seasonSources(base, [written], { answer: null, remaining: best }).map((s) => s.id), [7, 10, 18])
    assert.deepEqual(seasonSources(base, [formula1, f1db10], { answer: { who: 'x' }, remaining: every }).map((s) => s.id), [3, 7, 10])
  })
})

/**
 * What the console says before it runs anything. A typo in SELECT used to be
 * answered with the explanation meant for a write (IX-25).
 */
describe('the console refuses what it will not run, and says why (IX-25)', () => {
  it('runs the five ways a read starts', () => {
    for (const sql of ['SELECT 1', 'with t as (select 1) select * from t', 'VALUES (1)', 'EXPLAIN SELECT 1', 'PRAGMA table_info(drivers)']) {
      assert.equal(complaint(sql), null, sql)
    }
    assert.equal(complaint('-- a note\nSELECT 1'), null)
  })

  it('suggests the read a near miss was meant to be', () => {
    assert.match(complaint('SELEC 1'), /^Did you mean SELECT\? No statement starts with “SELEC”/)
    assert.match(complaint('slect * from drivers'), /^Did you mean SELECT\?/)
    assert.match(complaint('SLEECT 1'), /^Did you mean SELECT\?/)
    assert.match(complaint('selectt 1'), /^Did you mean SELECT\?/)
    assert.match(complaint('WIHT t AS (SELECT 1) SELECT * FROM t'), /^Did you mean WITH\?/)
    assert.match(complaint('VALEUS (1)'), /^Did you mean VALUES\?/)
    assert.match(complaint('EXPLIAN SELECT 1'), /^Did you mean EXPLAIN\?/)
    assert.match(complaint('PRAMGA table_info(drivers)'), /^Did you mean PRAGMA\?/)
    assert.match(complaint('/* why */ SELEC 1'), /“SELEC”/)
  })

  it('still tells a write, or a near miss of one, that it would be rolled back', () => {
    for (const sql of ['DELETE FROM drivers', 'DELET FROM drivers', 'insrt into x values (1)', 'DROP TABLE drivers', 'UPDATE drivers SET x = 1', 'ATTACH ...']) {
      assert.match(complaint(sql), /^Reads only: .* rolled back anyway/, sql)
    }
  })

  it('names a word that starts no statement at all, without the lecture', () => {
    const said = complaint('foo 1')
    assert.match(said, /^No statement starts with “foo”/)
    assert.doesNotMatch(said, /rolled back|write/)
    assert.doesNotMatch(complaint('it 1'), /Did you mean/)
  })

  it('keeps the other refusals', () => {
    assert.equal(complaint('   '), 'Nothing to run.')
    assert.equal(complaint('-- only a comment'), 'Nothing to run.')
    assert.match(complaint('PRAGMA case_sensitive_like = ON'), /^That pragma can change/)
    assert.match(complaint('(SELECT 1)'), /^No statement starts with “\(”/)
  })

  it('reads a near miss as the statement it is nearest, and does not guess a tie', () => {
    assert.equal(nearestStatement('selec'), 'select')
    assert.equal(nearestStatement('SELEC'), 'select')
    assert.equal(nearestStatement('delet'), 'delete')
    assert.equal(nearestStatement('wiht'), 'with')
    assert.equal(nearestStatement('wh'), null)
    assert.equal(nearestStatement('xyzzy'), null)
    // One from DELETE and two from SELECT: the write is nearer.
    assert.equal(nearestStatement('selete'), 'delete')
    // Two from SELECT and two from DELETE: a tie that includes a write is
    // not guessed to be a read.
    assert.equal(nearestStatement('belet'), 'delete')
    assert.match(complaint('BELET 1'), /^Reads only: /)
  })
})

// IA-01: the words a Grand Prix's page and a circuit's page put round the
// tables, which both renderers print from these functions.
describe('a Grand Prix and the venues it has used', () => {
  const sentence = (rows) =>
    heldAs(rows)
      .map((segment) => (segment.id ? `[${segment.name}]` : segment.text))
      .join('')

  it('names every event a circuit has held, linked, with its count', () => {
    assert.equal(sentence([]), '')
    assert.equal(sentence([{ id: 'monaco', name: 'Monaco Grand Prix', races: 72, scheduled: 1 }]), 'Held here as the [Monaco Grand Prix] (72 races).')
    assert.equal(
      sentence([
        { id: 'british', name: 'British Grand Prix', races: 60, scheduled: 1 },
        { id: 'european', name: 'European Grand Prix', races: 1, scheduled: 0 },
        { id: 'spanish', name: 'Spanish Grand Prix', races: 0, scheduled: 1 },
      ]),
      'Held here as the [British Grand Prix] (60 races) and the [European Grand Prix] (1 race). On the calendar here as the [Spanish Grand Prix].',
    )
    assert.equal(
      sentence([{ id: 'spanish', name: 'Spanish Grand Prix', races: 0, scheduled: 1 }]),
      'On the calendar here as the [Spanish Grand Prix].',
      'a venue that has held nothing yet is not said to have held it',
    )
    const keys = heldAs([
      { id: 'a', name: 'A', races: 1, scheduled: 0 },
      { id: 'b', name: 'B', races: 1, scheduled: 0 },
    ]).map((segment) => segment.key)
    assert.equal(new Set(keys).size, keys.length, 'every segment has a key of its own')
  })

  it('gives a venue only booked no span, and counts it apart', () => {
    assert.equal(circuitYears(null, { first_year: 1950, last_year: 2026, scheduled: 1 }), '1950–2026')
    assert.equal(circuitYears(null, { first_year: null, last_year: null, scheduled: 1 }), 'not yet run')
    assert.equal(venuesCount([{ races: 21 }, { races: 0, scheduled: 1 }]), '1 · 1 to come')
    assert.equal(venuesCount([{ races: 11 }, { races: 18 }]), '2')
  })

  // SD-38: the circuit's race list counts what the tile counts, and the rest apart.
  it('counts a circuit\'s races run as its tile does, and the ones to come apart', () => {
    const races = (run, ahead) => [
      ...Array.from({ length: ahead }, () => ({ status: 'scheduled' })),
      ...Array.from({ length: run }, () => ({ status: 'completed' })),
    ]
    assert.equal(racesCount(races(61, 1)), '61 · 1 to come')
    assert.equal(racesCount(races(76, 0)), '76')
    assert.equal(racesCount(races(0, 1)), '0 · 1 to come', 'a venue only booked has run none')
    assert.equal(racesCount([]), '0')
  })

  it('names the car an entrant ran where no constructor row exists, and none for an edition to come', () => {
    const run = { status: 'completed', constructor_id: null, constructor: null, entrant: 'Kurtis Kraft-Offenhauser' }
    assert.equal(editionCar(null, run), 'Kurtis Kraft-Offenhauser')
    assert.equal(editionCar('Ferrari', { status: 'completed', constructor_id: 'ferrari', constructor: 'Ferrari', entrant: 'Scuderia Ferrari' }), 'Ferrari')
    assert.equal(editionCar(null, { status: 'scheduled', constructor_id: null, constructor: null, entrant: null }), '')
  })
})

// CR-64: two renderers run these queries on two SQLite builds - sql.js in the
// app, node:sqlite in the prerender - and they print the same rows in the
// same order only if the ORDER BY leaves the engine no choice. 121 (season,
// table, position) groups hold more than one row, so every adjacent pair is
// checked against the whole sort key: a pair the key cannot tell apart is a
// pair whose order is the query plan's, which is the defect.
describe('the standings orders are total (CR-64)', () => {
  const nullsLast = (a, b) => (a === null) - (b === null) || (a === null ? 0 : a - b)
  const strictlyOrdered = (rows, compare, label) => {
    for (let i = 1; i < rows.length; i++) {
      assert.ok(compare(rows[i - 1], rows[i]) < 0, `${label}: rows ${rows[i - 1].id} and ${rows[i].id} tie on the whole key`)
    }
  }

  // The rows below come out in id order within a tie today with or without
  // the last term, because that is the plan both engines happen to choose -
  // so the data check alone would still pass with it removed. What makes the
  // order total is the query ending on a key no two rows share.
  it('ends both ORDER BYs on the row id, which no two rows of the view share', () => {
    assert.match(SEASON_FINAL, /ORDER BY [^\n]*, f\.id\s*$/)
    assert.match(TEAM_STANDINGS, /ORDER BY [^\n]*, s\.id\s*$/)
    const db = new DatabaseSync(join(web, '..', 'f1.db'), { readOnly: true })
    try {
      assert.equal(db.prepare('SELECT COUNT(*) - COUNT(DISTINCT id) AS n FROM v_standings_final').get().n, 0)
    } finally {
      db.close()
    }
  })

  it("orders every season's final table with nothing left to the plan", () => {
    const db = new DatabaseSync(join(web, '..', 'f1.db'), { readOnly: true })
    try {
      const years = db.prepare('SELECT DISTINCT year FROM v_standings_final ORDER BY year').all()
      assert.ok(years.length > 70)
      const key = (a, b) =>
        (a.table_type < b.table_type ? -1 : a.table_type > b.table_type ? 1 : 0) ||
        nullsLast(a.position, b.position) ||
        (b.points ?? 0) - (a.points ?? 0) ||
        a.id - b.id
      for (const { year } of years) strictlyOrdered(db.prepare(SEASON_FINAL).all(year), key, String(year))
      // Cooper 1960: Maserati and Castellotti, both fifth - the tie the
      // issue named, kept in the order it has always shown.
      const fifth = db.prepare(SEASON_FINAL).all(1960).filter((row) => row.table_type === 'constructors' && row.position === 5)
      assert.ok(fifth.length > 1, 'the 1960 tie is still in the register')
    } finally {
      db.close()
    }
  })

  it("orders every constructor's standings with nothing left to the plan", () => {
    const db = new DatabaseSync(join(web, '..', 'f1.db'), { readOnly: true })
    try {
      const teams = db.prepare("SELECT DISTINCT constructor_id AS id FROM v_standings_final WHERE table_type = 'constructors' AND constructor_id IS NOT NULL").all()
      const key = (a, b) => a.year - b.year || nullsLast(a.position, b.position) || a.id - b.id
      for (const { id } of teams) strictlyOrdered(db.prepare(TEAM_STANDINGS).all(id), key, id)
    } finally {
      db.close()
    }
  })
})

// CD-34: Wins and Poles on a constructor's "On the record" and the static
// facts list, the count beside the published figure as the driver page does.
describe("a constructor's record figures (CD-34)", () => {
  it('gives both figures, and the count alone where nothing is published', () => {
    assert.deepEqual(recordFigures({ wins: 250, poles: 254 }, { wins: 251, poles: 254 }), [
      ['Wins', '251 derived · 250 published'],
      ['Poles', '254 derived · 254 published'],
    ])
    // rob-walker: no race entry, so SUM gives NULL, and no published wins.
    assert.deepEqual(recordFigures({ wins: null, poles: null }, { wins: null, poles: null }), [
      ['Wins', '0 derived'],
      ['Poles', '0 derived'],
    ])
  })

  it('names the four teams where the register and the count part, from f1.db', () => {
    const db = new DatabaseSync(join(web, '..', 'f1.db'), { readOnly: true })
    try {
      const wins = (id) => recordFigures(db.prepare('SELECT * FROM constructors WHERE id = ?').get(id), db.prepare(TEAM_DERIVED).get(id) ?? {})[0][1]
      for (const id of ['ferrari', 'vanwall', 'alfa-romeo']) {
        assert.match(wins(id), /^[\d,]+ derived · [\d,]+ published$/, id)
      }
      assert.equal(wins('rob-walker'), '0 derived')
    } finally {
      db.close()
    }
  })
})

// ------------------------------------------------------ stint windows (PD-56)

describe('stint windows and the pit order (PD-56)', () => {
  const entry = (id, finish, laps, grid, extra = {}) => ({
    id,
    driver_id: id,
    driver: id,
    finish_position: finish,
    position_text: finish == null ? 'DNF' : String(finish),
    laps_completed: laps,
    grid,
    ...extra,
  })
  const stop = (driver, n, lap) => ({ driver_id: driver, stop_number: n, lap_number: lap })
  const entries = [
    entry('c', null, 20, 1),
    entry('a', 1, 50, 2),
    entry('b', 2, 50, 3),
    entry('d', null, null, 4, { position_text: 'DSQ' }),
    entry('e', null, 0, 5, { position_text: 'DNS' }),
  ]
  const pits = [stop('a', 1, 20), stop('b', 1, 18), stop('a', 2, 35), stop('c', 1, 21), stop('d', 1, 10)]

  it('draws a bar for every driver who started with a lap count, in finishing order', () => {
    const rows = stintRows(entries, pits)
    assert.deepEqual(
      rows.map((r) => [r.entry.id, r.stops.join(' '), r.out]),
      [
        ['a', '20 35', false],
        ['b', '18', false],
        ['c', '21', true],
      ],
    )
    assert.equal(stintsShown(rows), true)
    assert.equal(stintsShown(stintRows(entries, [])), false, 'no stop recorded, no figure')
  })

  it('splits a bar at each stop, and marks a stop past the last lap at its end', () => {
    const layout = stintLayout(entries, pits)
    const [a, , c] = layout.cars
    assert.equal(a.stints.length, 3)
    assert.equal(a.stops.length, 2)
    // c stopped on lap 21 and completed 20: the stop is at the bar's end, not past it.
    assert.equal(c.stints.length, 1)
    assert.equal(c.stops[0], c.end)
    assert.ok(c.cross, 'a car not classified ends on a cross')
    assert.equal(a.cross, null)
    assert.ok(Math.max(...layout.cars.map((car) => car.end)) <= layout.width)
  })

  it('tables the drawn drivers and the ones with stops and no lap count', () => {
    assert.deepEqual(
      unbarredOf(entries, pits).map((e) => e.id),
      ['d'],
    )
    assert.deepEqual(
      stintTableRows(entries, pits).map((r) => [r.id, r.stops, r.stop_laps]),
      [
        ['a', 2, '20, 35'],
        ['b', 1, '18'],
        ['c', 1, '21'],
        ['d', 1, '10'],
      ],
    )
  })

  it('pairs classified neighbours on the grid or at the flag, in grid order, and says who stopped first', () => {
    const field = [entry('p', 1, 50, 3), entry('q', 2, 50, 1), entry('r', 3, 50, 2), entry('s', 4, 50, 9)]
    const stops = [stop('p', 1, 10), stop('q', 1, 12), stop('r', 1, 12), stop('s', 1, 30)]
    const pairs = pitPairs(field, stops)
    assert.deepEqual(
      pairs.map((x) => [x.ahead.id, x.behind.id, x.first?.id ?? 'same', x.swapped]),
      [
        ['q', 'p', 'p', true],
        ['r', 'p', 'p', true],
        ['q', 'r', 'same', false],
        ['r', 's', 'r', false],
      ],
    )
    assert.deepEqual(pitPairs(field, []), [], 'no stop, no pair')
  })

  it('counts every recorded stop on its lap for the pit wave, a stop past the last lap on that lap (AF-134)', () => {
    const rows = stintRows(entries, pits)
    const wave = pitWave(pits, stintLaps(rows))
    // d, disqualified with no lap count, is in the table and so in the wave;
    // c's lap-21 stop is past c's last lap but inside the race's fifty.
    assert.deepEqual(
      wave.counts.map((c) => [c.lap, c.count]),
      [
        [10, 1],
        [18, 1],
        [20, 1],
        [21, 1],
        [35, 1],
      ],
    )
    assert.equal(wave.stops, pits.length)
    assert.deepEqual(pitWave([stop('a', 1, 60), stop('b', 1, null)], 50).counts, [{ lap: 50, count: 1 }], 'past the last lap counts on it; no lap, not counted')
    assert.deepEqual(pitWave([], 50), { counts: [], stops: 0, most: 0, busiest: [] })
  })

  it('draws a column per lap with a stop, the tallest the strip, every column inside it', () => {
    const layout = stintLayout(entries, pits)
    const { wave } = layout
    assert.equal(wave.columns.length, 5)
    assert.equal(wave.head, STINT_HEADS.wave(1))
    for (const c of wave.columns) {
      assert.equal(c.y + c.height, wave.base, `lap ${c.lap} stands on the base`)
      assert.ok(c.x >= layout.start - c.width && c.x + c.width <= layout.width, `lap ${c.lap} is inside the drawing`)
      assert.ok(c.width >= 1)
    }
    assert.ok(wave.base < layout.cars[0].barY, 'the strip is above the first bar')
    assert.ok(wave.headY < Math.min(...wave.columns.map((c) => c.y)), 'and its name above the strip')
    assert.ok(wave.columns.every((c) => c.height >= 2), 'every column at least 2 px tall')
  })

  it("keeps the strip's name inside a phone-width drawing, with full names in the label column", () => {
    const long = (id, finish) => entry(id, finish, 60, finish, { driver: 'Heinz-Harald Frentzen-Montoya' })
    const field = [long('x', 1), long('y', 2)]
    const layout = stintLayout(field, [stop('x', 1, 30)], 250)
    const { wave } = layout
    assert.ok(wave.headX >= 0, 'not past the left edge')
    assert.ok(wave.headX + textWidth(wave.head) <= layout.width, `“${wave.head}” ends inside the 250 px drawing`)
    assert.ok(stintLayout(entries, pits).wave.headX === stintLayout(entries, pits).start, 'and starts with the bars where it fits')
  })
})

/*
 * AF-134's own example, pinned: the 2025 United States Grand Prix, 56 laps,
 * as F1DB records it and f1.db held it when the item was worked. The top
 * eight all stopped once, between laps 22 and 33, Leclerc first, on lap 22,
 * and finished third. The fixture is literal so the test does not read the
 * committed database; smoke.mjs checks the page against the database.
 */
describe('the pit wave at Austin 2025 (AF-134)', () => {
  const order = ['verstappen', 'norris', 'leclerc', 'hamilton', 'piastri', 'russell', 'tsunoda', 'hulkenberg', 'bearman', 'alonso',
    'lawson', 'stroll', 'antonelli', 'albon', 'ocon', 'hadjar', 'colapinto', 'bortoleto', 'gasly']
  const entries = [
    ...order.map((id, i) => ({ id, driver_id: id, driver: id, finish_position: i + 1, position_text: String(i + 1), laps_completed: i >= 16 ? 55 : 56 })),
    { id: 'sainz', driver_id: 'sainz', driver: 'sainz', finish_position: null, position_text: 'DNF', laps_completed: 5 },
  ]
  const pits = [
    ['albon', 1, 7], ['bortoleto', 1, 14], ['leclerc', 1, 22], ['ocon', 1, 24], ['gasly', 1, 27], ['stroll', 1, 28],
    ['hadjar', 1, 28], ['tsunoda', 1, 29], ['piastri', 1, 30], ['bearman', 1, 30], ['alonso', 1, 30], ['lawson', 1, 30],
    ['hamilton', 1, 31], ['antonelli', 1, 31], ['norris', 1, 32], ['colapinto', 1, 32], ['verstappen', 1, 33], ['russell', 1, 33],
    ['hulkenberg', 1, 33], ['albon', 2, 36], ['bortoleto', 2, 36],
  ].map(([driver_id, stop_number, lap_number]) => ({ driver_id, stop_number, lap_number }))

  it('stopped the top eight once each, between laps 22 and 33, Leclerc first', () => {
    const rows = stintRows(entries, pits)
    const top = rows.slice(0, 8)
    assert.ok(top.every((r) => r.stops.length === 1 && r.stops[0] >= 22 && r.stops[0] <= 33))
    const first = [...top].sort((a, b) => a.stops[0] - b.stops[0])[0]
    assert.deepEqual([first.entry.id, first.stops[0], first.entry.finish_position], ['leclerc', 22, 3])
    assert.equal(stintLaps(rows), 56)
  })

  it('peaks at four stops on lap 30, and names the lap to a screen reader', () => {
    const rows = stintRows(entries, pits)
    const wave = pitWave(pits, stintLaps(rows))
    assert.equal(wave.stops, 21)
    assert.equal(wave.most, 4)
    assert.deepEqual(wave.busiest, [30])
    assert.equal(stintLayout(entries, pits).wave.head, 'Stops on each lap (up to 4)')
    assert.match(stintsLabel(rows, wave), /20 drivers’ races in finishing order, split at 21 recorded stops\. Of 21 recorded in all, the most on one lap: 4, on lap 30\.$/)
    // A tie names every lap it holds.
    const tied = pits.filter((p) => p.lap_number !== 30 && p.driver_id !== 'hulkenberg')
    assert.match(stintsLabel(rows, pitWave(tied, 56)), / Of 16 recorded in all, the most on one lap: 2, on laps 28, 31, 32, 33 and 36\.$/)
  })
})

describe('the registers\' small multiples (VD-54)', () => {
  const done = { undecided: 0, not_started: 0 }

  it('reads the triples in round order, whatever order group_concat gave', () => {
    assert.deepEqual(titleRaceOf('3:20.0:9.0 1:9.0:6.0 2:15.0:12.0'), [
      { round: 1, gap: 3 },
      { round: 2, gap: 3 },
      { round: 3, gap: 11 },
    ])
  })

  it('keeps a side at nought before its first row and at its last total after a gap', () => {
    // 2014: Hamilton had no row after Melbourne.
    assert.deepEqual(titleRaceOf('1::18.0 2:25.0:43.0 3::51.0'), [
      { round: 1, gap: -18 },
      { round: 2, gap: -18 },
      { round: 3, gap: -26 },
    ])
  })

  it('draws no line and prints a dash where there is none, as Margin does in that row', () => {
    assert.equal(titleRaceOf(null), null)
    assert.equal(titleRaceText(null, done), '—')
    assert.equal(titleRaceText(null, { undecided: 0, not_started: 1 }), '—')
  })

  it('names the round the lead over the runner-up was taken for good, and level is not ahead', () => {
    assert.equal(titleRaceText('1:9:6 2:15:12', done), 'Ahead of the runner-up after every round')
    assert.equal(titleRaceText('1:6:9 2:15:12 3:18:18 4:24:18', done), 'Ahead of the runner-up from round 4 of 4')
    assert.equal(titleRaceText('1:9:6 2:9:12 3:18:12', done), 'Ahead of the runner-up from round 3 of 3')
    assert.equal(titleRaceText('1:9:9', done), 'Level with the runner-up after the last round')
    assert.equal(titleRaceText('1:6:9', done), 'Behind the runner-up after the last round')
    assert.equal(titleRaceText('1:9:6', { undecided: 1, not_started: 0 }), 'Ahead of second place after every round so far')
    assert.equal(titleRaceText('1:6:9 2:15:12', { undecided: 1, not_started: 0 }), 'Ahead of second place from round 2 of 2 run')
  })

  it('draws from nought at the start, with the line at nought inside the box', () => {
    const layout = titleRaceLayout('1:6:9 2:15:12')
    assert.equal(layout.width, TITLE_RACE_WIDTH)
    assert.equal(layout.height, SPARK_HEIGHT)
    assert.match(layout.line, /^M2,/)
    assert.ok(layout.zero > 0 && layout.zero < SPARK_HEIGHT)
    // A season that never left nought still has its line in the middle.
    assert.equal(titleRaceLayout('1:0:0').zero, SPARK_HEIGHT / 2)
    assert.equal(titleRaceLayout(null), null)
  })

  it('joins consecutive seasons into runs and says them as words', () => {
    assert.deepEqual(runsOf([1950, 1951, 1979, 1980, 1985]), [
      [1950, 1951],
      [1979, 1980],
      [1985, 1985],
    ])
    assert.equal(seasonsRacedText('1951,1950,1979,1980,1981'), '1950–1951, 1979–1981')
    assert.equal(seasonsRacedText(null), 'No race entries')
  })

  it('puts every constructor on one axis, from the first season to the current one', () => {
    const whole = seasonsRacedLayout('1950,1951', 1950, 1951)
    assert.deepEqual(whole.runs, [{ x: 0, width: SEASONS_RACED_WIDTH }])
    const one = seasonsRacedLayout('2026', 1950, 2026)
    assert.equal(one.runs.length, 1)
    assert.ok(one.runs[0].x + one.runs[0].width <= SEASONS_RACED_WIDTH + 0.1)
    assert.deepEqual(seasonsRacedLayout(null, 1950, 2026).runs, [])
    assert.equal(seasonsRacedLayout('1950', null, 2026), null)
  })
})

// SD-37: the late-results notice is refresh_health.py's rule, at the reader's
// date. These hold the two to the same days and the same cancellation half.
describe('late results', () => {
  it('waits the same days the health check does', () => {
    const python = readFileSync(join(web, '..', '.github', 'scripts', 'refresh_health.py'), 'utf8')
    assert.equal(Number(python.match(/^GRACE_DAYS = (\d+)$/m)?.[1]), GRACE_DAYS)
  })

  it('is late only past the grace days, and never when F1DB dropped the round', () => {
    const round = { year: 2026, round: 17, name_used: 'Singapore Grand Prix', date_iso: '2026-10-11', on_f1db_calendar: 1 }
    assert.equal(lateDays(round, '2026-10-14'), null, 'three days is not late')
    assert.equal(lateDays(round, '2026-10-15'), 4, 'four is')
    assert.equal(lateDays({ ...round, on_f1db_calendar: null }, '2026-10-15'), 4, 'a season F1DB has not reached still counts')
    assert.equal(lateDays({ ...round, on_f1db_calendar: 0 }, '2026-10-15'), null, 'a round F1DB no longer lists does not')
    assert.equal(lateDays({ ...round, date_iso: null }, '2026-10-15'), null, 'an unreadable date is not evidence of anything')
    assert.equal(lateDays(round, '2026-10-09'), null, 'nor is a race still to come')
  })

  it('reads the reader\'s own calendar day', () => {
    assert.match(readerDay(), /^\d{4}-\d{2}-\d{2}$/)
    const d = new Date(2026, 9, 6, 23, 30)
    assert.equal(readerDay(d.getTime()), '2026-10-06')
  })

  it('says it once for /changes, and the race page says it in the same words', () => {
    assert.equal(lateNotice([]), null)
    const late = lateRaces([{ year: 2026, round: 17, name_used: 'Singapore Grand Prix', date_iso: '2026-10-11', date_to: null, on_f1db_calendar: 1 }], '2026-10-16')
    const notice = lateNotice(late)
    assert.equal(notice.head, 'Results are late.')
    assert.equal(notice.body, `The 2026 Singapore Grand Prix was run on 2026-10-11, and its result is not here yet. ${LATE_NOTE}`)
    const note = scheduledNote({ year: 2026, date_iso: '2026-10-11' }, 'run', 5)
    assert.equal(note.head, 'This race’s result is late.')
    assert.equal(note.body, `It was run on 2026-10-11. ${LATE_NOTE}`)
  })

  it('names the circuit\'s day, not F1DB\'s UTC one, and counts on the UTC one', () => {
    // Las Vegas: a Saturday-night race that is Sunday in UTC.
    const vegas = { year: 2026, round: 21, name_used: 'Las Vegas Grand Prix', date_iso: '2026-11-22', date_to: '2026-11-21', on_f1db_calendar: 1 }
    assert.equal(raceDay(vegas), '2026-11-21')
    assert.equal(lateDays(vegas, '2026-11-25'), null, 'three days after the UTC day is not late')
    assert.ok(lateLine({ ...vegas, days: 4 }).includes('run on 2026-11-21,'))
    assert.ok(scheduledNote(vegas, 'run', 4).body.startsWith('It was run on 2026-11-21.'))
  })

  it('finds the late rounds in the database the site serves', () => {
    const db = new DatabaseSync(join(web, '..', 'f1.db'), { readOnly: true })
    try {
      const rounds = db.prepare(UNRESULTED).all()
      assert.ok(rounds.length > 0, 'the calendar holds rounds still to be run')
      assert.ok(rounds.every((r) => r.on_f1db_calendar !== undefined), 'and each says whether F1DB lists it')
      // Every round still unresulted is late on a day long after the last of
      // them, unless F1DB dropped it; none is late on the first of them.
      const last = rounds.at(-1).date_iso
      const after = `${Number(last.slice(0, 4)) + 1}${last.slice(4)}`
      assert.equal(lateRaces(rounds, after).length, rounds.filter((r) => r.on_f1db_calendar !== 0).length)
      assert.equal(lateRaces(rounds, rounds[0].date_iso).length, 0)
    } finally {
      db.close()
    }
  })
})

/*
 * The counts the register ledes spell out (VD-79). The ledes are written by
 * hand, and since VD-79 the static page draws them too, in place of the
 * counts it used to compute at build time - so a season, a venue or a
 * chassis arriving would leave both halves stating last year's figure, with
 * nothing to say so. Held against f1.db here instead.
 */
describe('the counts the register ledes spell out (VD-79)', () => {
  const db = new DatabaseSync(join(web, '..', 'f1.db'), { readOnly: true })
  const count = (sql) => Object.values(db.prepare(sql).get())[0]
  const ONES = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve',
    'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen']
  const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety']
  // As the ledes write a number: "seventy-seven", "a hundred and fifty".
  const spelled = (n) => {
    const under = (m) => (m < 20 ? ONES[m] : `${TENS[Math.floor(m / 10)]}${m % 10 ? `-${ONES[m % 10]}` : ''}`)
    if (n < 100) return under(n)
    const hundreds = Math.floor(n / 100)
    const rest = n % 100
    return `${hundreds === 1 ? 'a' : ONES[hundreds]} hundred${rest ? ` and ${under(rest)}` : ''}`
  }
  const opens = (lede, n, noun) => assert.ok(lede.toLowerCase().startsWith(`${spelled(n)} ${noun}`), `the lede opens "${lede.slice(0, 40)}…", and f1.db holds ${n}`)

  it('the seasons register counts the championships begun', () => {
    opens(SEASONS_LEDE, count("SELECT COUNT(DISTINCT year) FROM races WHERE status = 'completed'"), 'championships')
  })
  it('the constructors register counts the constructors', () => {
    opens(CONSTRUCTORS_LEDE, count('SELECT COUNT(*) FROM constructors'), 'constructors')
  })
  it('the circuits register counts the venues', () => {
    opens(CIRCUITS_LEDE, count('SELECT COUNT(*) FROM circuits'), 'venues')
  })
  it('the cars register counts the designs with a page, and every chassis', () => {
    opens(CARS_LEDE, count('SELECT COUNT(*) FROM cars'), 'designs')
    const chassis = count('SELECT COUNT(*) FROM chassis').toLocaleString('en-GB')
    assert.ok(CARS_LEDE.includes(`${chassis} of them`), `the lede counts the chassis, and f1.db holds ${chassis}`)
  })
})

describe('dates are words on the page and ISO in the data (CD-57)', () => {
  // Intl puts a thin or narrow no-break space round a range's dash in some
  // locales; the words are what is being checked.
  const plain = (value) => String(value).replace(/[\u2009\u202f\u00a0]/g, ' ')

  it('knows a whole ISO day from anything else', () => {
    assert.equal(isDay('1997-03-09'), true)
    for (const value of ['1997', '1997-03', '1997-02-30', '1997-13-01', '09/03/1997', '', null, undefined]) {
      assert.equal(isDay(value), false, String(value))
    }
  })

  it('writes the house format, short and long, and null where there is no whole day', () => {
    assert.equal(houseDate('1997-03-09'), '9 Mar 1997')
    assert.equal(houseDate('1997-09-09'), '9 Sep 1997')
    assert.equal(houseDate('1997-03-09', 'long'), '9 March 1997')
    assert.equal(houseDate('1911'), null)
    assert.equal(houseDate(null), null)
  })

  it('writes the reader’s own format for en-US and de-DE, and keeps the house format for en-GB', () => {
    assert.equal(HOUSE_LOCALE, 'en-GB')
    assert.equal(localDate('1997-03-09', 'short', 'en-US'), 'Mar 9, 1997')
    assert.equal(localDate('1997-03-09', 'short', 'de-DE'), '9. März 1997')
    assert.equal(localDate('1997-03-09', 'long', 'de-DE'), '9. März 1997')
    assert.equal(localDate('1997-03-09', 'long', 'en-US'), 'March 9, 1997')
    // ICU's own en-GB says "Sept"; the house says "Sep", and an en-GB reader
    // keeps the house, so the handover changes nothing for them.
    assert.equal(localDate('1997-09-09', 'short', 'en-GB'), '9 Sep 1997')
  })

  it('reads the day in UTC, so a reader west of London is not shown the evening before', () => {
    assert.equal(localDate('1950-01-01', 'short', 'en-US'), 'Jan 1, 1950')
  })

  it('falls back to the house format for a locale Intl will not take', () => {
    assert.equal(localDate('1997-03-09', 'short', 'not a locale!'), '9 Mar 1997')
  })

  it('writes a weekend in the reader’s order, and the race day where none is stated', () => {
    const weekend = { date_iso: '2026-03-29', date_from: '2026-03-27', date_to: '2026-03-29' }
    assert.equal(plain(localRaceDates(weekend, 'en-US')), 'Mar 27 – 29, 2026')
    assert.equal(localRaceDates(weekend, 'en-GB'), '27–29 Mar 2026')
    assert.equal(localRaceDates({ date_iso: '1997-03-09' }, 'en-US'), 'Mar 9, 1997')
    assert.equal(localRaceDates({ date_iso: null }, 'en-US'), null)
  })

  it('cuts a sentence at its ISO days and leaves everything else as words', () => {
    assert.deepEqual(dateSegments('read on 2026-09-04 after round 12'), ['read on ', { iso: '2026-09-04' }, ' after round 12'])
    assert.deepEqual(dateSegments('2026-10-05'), [{ iso: '2026-10-05' }])
    assert.deepEqual(dateSegments('no day here, v2.25'), ['no day here, v2.25'])
    // Not a day: an impossible one, and a run of digits that only contains one.
    assert.deepEqual(dateSegments('1997-02-30'), ['1997-02-30'])
    assert.deepEqual(dateSegments('ref 12026-09-041'), ['ref 12026-09-041'])
    // A day inside a longer token is that token's, and is left as written.
    assert.deepEqual(dateSegments('File:Foo 2019-05-26.jpg'), ['File:Foo 2019-05-26.jpg'])
    assert.deepEqual(dateSegments('https://x.org/2024-01-01/y'), ['https://x.org/2024-01-01/y'])
    // And one ending a sentence, or in brackets, is still a day.
    assert.deepEqual(dateSegments('(read 2026-10-06).'), ['(read ', { iso: '2026-10-06' }, ').'])
    assert.deepEqual(dateSegments('built 2026-10-05, digest'), ['built ', { iso: '2026-10-05' }, ', digest'])
  })

  it('hands a file the ISO value of a date column, and a weekend as an ISO interval', () => {
    assert.equal(fieldText({ key: 'as_of', date: 'short' }, { as_of: '2026-10-04' }), '2026-10-04')
    assert.equal(fieldText({ key: 'as_of', date: 'short' }, { as_of: null }), EMPTY)
    const race = { key: 'date_iso', date: 'race' }
    assert.equal(fieldText(race, { date_iso: '1997-03-09', date_from: null, date_to: null }), '1997-03-09')
    assert.equal(fieldText(race, { date_iso: '2026-03-29', date_from: '2026-03-27', date_to: '2026-03-29' }), '2026-03-27/2026-03-29')
  })
})

describe('one eyebrow rule: the page type, then the facts that identify the entity (VD-81, IA-09)', () => {
  it('writes a whole ISO day out, and nothing for half of one', () => {
    assert.equal(longDate('1985-01-07'), '7 January 1985')
    assert.equal(longDate('2025-07-06'), '6 July 2025')
    assert.equal(longDate('1911'), null)
    assert.equal(longDate(null), null)
  })
  it('leads with the type on every entity page, and leaves out a fact not held', () => {
    // The day stays ISO in the string, and each renderer draws it as a date (CD-57).
    assert.equal(EYEBROWS.driver('United Kingdom', '1985-01-07'), 'Driver · United Kingdom · born 1985-01-07')
    assert.equal(EYEBROWS.driver('Italy', '1911'), 'Driver · Italy')
    assert.equal(EYEBROWS.driver('United States of America', null), 'Driver · United States of America')
    assert.equal(EYEBROWS.constructor('Italy', 'Maranello, Italy'), 'Constructor · Italy · Maranello')
    // A base abroad keeps its country: the constructor's is not the base's.
    assert.equal(EYEBROWS.constructor('Austria', 'Milton Keynes, United Kingdom'), 'Constructor · Austria · Milton Keynes, United Kingdom')
    assert.equal(EYEBROWS.constructor('United Kingdom', null), 'Constructor · United Kingdom')
    assert.equal(EYEBROWS.circuit('Silverstone', 'United Kingdom'), 'Circuit · Silverstone, United Kingdom')
    assert.equal(EYEBROWS.race(12, 24, '2025-07-06'), 'Race · Round 12 of 24 · 2025-07-06')
    assert.equal(EYEBROWS.season(24, 24), 'Season · 24 rounds, all run')
    assert.equal(EYEBROWS.season(24, 16), 'Season · 24 rounds, 16 run')
    assert.equal(EYEBROWS.season(24, 0), 'Season · 24 rounds, none run yet')
    assert.equal(EYEBROWS.car('Red Bull Racing', 2023, 2023), 'Car · Red Bull Racing · 2023')
    assert.equal(EYEBROWS.car('Ferrari', 1952, 1953), 'Car · Ferrari · 1952–1953')
    assert.equal(EYEBROWS.car(null, null, null), 'Car')
    assert.equal(EYEBROWS.grandPrix('United Kingdom'), 'Grand Prix · United Kingdom')
    assert.equal(EYEBROWS.grandPrix(null), 'Grand Prix')
    assert.equal(EYEBROWS.era(2014, 2021), 'Era · 2014–2021')
    assert.equal(EYEBROWS.era(2026, null), 'Era · 2026–')
  })
  it('names a race page\'s neighbours as their own pages are headed', () => {
    const db = new DatabaseSync(join(web, '..', 'f1.db'), { readOnly: true })
    try {
      const middle = db.prepare(RACE_NEIGHBOURS).get(2025, 12)
      const steps = raceSteps(middle)
      assert.equal(steps.previous.label, `2025 ${db.prepare('SELECT name_used FROM races WHERE year = 2025 AND round = 11').get().name_used}`)
      assert.equal(steps.next.label, `2025 ${db.prepare('SELECT name_used FROM races WHERE year = 2025 AND round = 13').get().name_used}`)
      assert.equal(middle.rounds, db.prepare('SELECT COUNT(*) AS n FROM races WHERE year = 2025').get().n)
      // Across a season's edge, the step names the other season's race.
      const first = raceSteps(db.prepare(RACE_NEIGHBOURS).get(2025, 1))
      assert.ok(first.previous.label.startsWith('2024 '), first.previous.label)
      assert.equal(raceSteps(db.prepare(RACE_NEIGHBOURS).get(1950, 1)).previous, null, 'the first race has no step back')
    } finally {
      db.close()
    }
  })
})

describe("a circuit's onward band says a shared record is shared (CR-50)", () => {
  const winner = (driver_id, wins) => ({ driver_id, driver: driver_id, wins })
  const hint = (winners) => ONWARD.circuit({ races: [], winners }).items.find((item) => item?.to?.startsWith('/drivers/')).hint

  it('a lone record is more than anyone', () => {
    assert.equal(hint([winner('a', 5), winner('b', 4)]), 'Has won here 5 times — more than anyone.')
    assert.equal(hint([winner('a', 1)]), 'Has won here 1 time — more than anyone.')
  })
  it('a record level with another driver is shared, not more than anyone', () => {
    assert.equal(hint([winner('a', 5), winner('b', 5), winner('c', 2)]), 'Has won here 5 times — a record shared with others.')
  })
})

describe("the championship chart's axis is the career (IX-38)", async () => {
  const { finishesFigure } = await import('../src/queries/driver.js')
  const { dotPlotLayout } = await import('../src/charts/dotPlot.js')
  // Andretti's shape: entered from 1968, in the standings only from 1970.
  const driver = { full_name: 'A Driver', first_season: 1968, last_season: 1982 }
  const standings = [
    { year: 1970, position: 15, points: 4 },
    { year: 1982, position: 19, points: 4 },
  ]
  const bySeason = [1968, 1969, 1970, 1982].map((year) => ({ year, teams: null }))
  const extent = (chart) => dotPlotLayout({ ...chart, width: 600 }).x.domain

  it('runs from the first season the tile states to the last, not the standings', () => {
    assert.deepEqual(extent(finishesFigure(driver, standings, new Map(), bySeason)), [1968, 1982])
  })
  it('takes the race records where they reach past the register, and ignores a NULL end', () => {
    const open = { ...driver, first_season: 1970, last_season: null }
    const chart = finishesFigure(open, standings, new Map(), [{ year: 1969 }, ...bySeason.slice(2), { year: 1984 }])
    assert.deepEqual(extent(chart), [1969, 1984])
  })
  it('never cuts a datum the span does not reach', () => {
    assert.deepEqual(extent({ data: [{ x: 2000, y: 1 }, { x: 2010, y: 2 }], xDomain: [2003, 2005] }), [2000, 2010])
  })
})

describe("/data's identifier policy reads meta as the file states it (DA-25)", () => {
  it('sets paired backticks as code, and an unpaired one as text', () => {
    assert.deepEqual(codeSpans('join `a` on `b`'), [
      { text: 'join ', code: false },
      { text: 'a', code: true },
      { text: ' on ', code: false },
      { text: 'b', code: true },
      { text: '', code: false },
    ])
    assert.deepEqual(codeSpans('a `b` c `d e'), [
      { text: 'a ', code: false },
      { text: 'b', code: true },
      { text: ' c ', code: false },
      { text: '`d e', code: false },
    ])
    assert.deepEqual(codeSpans('no marks'), [{ text: 'no marks', code: false }])
  })
  it('a row the file does not carry is null; an empty one is a list of none', () => {
    assert.deepEqual(idPolicy({}), { note: null, stable: null, keys: null })
    assert.deepEqual(idPolicy({ id_stability: 's', id_stability_stable: '', id_stability_keys: '' }), {
      note: 's',
      stable: [],
      keys: [],
    })
  })
  it('splits keys on the semicolon, so the commas inside one stay in it', () => {
    assert.deepEqual(idPolicy({ id_stability_stable: 'races, qualifying', id_stability_keys: 'races(year, round); records(key)' }), {
      note: null,
      stable: ['races', 'qualifying'],
      keys: ['races(year, round)', 'records(key)'],
    })
  })
})

// AF-131: each session gap as a distance on the track, measured in the
// driver's own session, at the session-best lap's average speed.
describe('a session gap as a distance on the track (AF-131)', () => {
  const row = (driver_id, parts) => ({ driver_id, q1: null, q2: null, q3: null, time: null, ...parts })
  // Singapore 2026's sheet, cut to one driver of each kind and the pole.
  const singapore = [
    row('verstappen', { q1: '1:33.241', q2: '1:31.639', q3: '1:31.373' }),
    row('leclerc', { q1: '1:32.774', q2: '1:31.953', q3: '1:31.427' }),
    row('hamilton', { q1: '1:32.429', q2: '1:31.529', q3: '1:31.496' }),
    row('lindblad', { q1: '1:33.288', q2: '1:32.498', q3: '1:32.781' }),
    row('hulkenberg', { q1: '1:33.147', q2: '1:32.784' }),
    row('alonso', { q1: '1:34.223' }),
    row('hadjar', {}),
  ]
  const byDriver = (rows) => Object.fromEntries(rows.map((r) => [r.driver_id, r.distance_m]))

  it('reads a lap time as the session tables write it, and nothing else', () => {
    assert.equal(lapSeconds('1:31.373'), 91.373)
    assert.equal(lapSeconds('53.904'), 53.904)
    assert.equal(lapSeconds('10:01.000'), 601)
    for (const odd of [null, undefined, '', '+0.054', '1 lap', 'DNF', '1:31:20.5', 91.373]) assert.equal(lapSeconds(odd), null)
  })

  it('measures each driver against the fastest lap of the last part they set a time in', () => {
    const d = byDriver(withDistance(singapore, 4.94))
    // The top ten against the Q3 pole: 54 m/s on 4.94 km.
    assert.equal(d.verstappen, 0)
    assert.equal(d.leclerc, 3)
    assert.equal(d.lindblad, 76)
    assert.equal(d.hamilton, 7)
    // A Q2 knockout against Hamilton's fastest Q2, a Q1 knockout against his Q1.
    assert.equal(d.hulkenberg, 68)
    assert.equal(d.alonso, 96)
    // No time is not established, never 0.
    assert.equal(d.hadjar, null)
  })

  it('leaves every distance unestablished without a length, and keeps the rest of the row', () => {
    for (const km of [null, undefined, 0]) {
      const rows = withDistance(singapore, km)
      assert.ok(rows.every((r) => r.distance_m === null))
      assert.deepEqual(
        qualifyingColumns(rows).map((c) => c.key),
        ['position_text', 'driver', 'constructor', 'driver_number', 'q1', 'q2', 'q3', 'gap', 'interval'],
      )
      assert.equal(distanceMethod(rows), null)
    }
    assert.equal(withDistance(singapore, 4.94)[1].q3, '1:31.427')
  })

  it('puts the column after the gap, prints metres, and dashes a missing one', () => {
    const rows = withDistance(singapore, 4.94)
    const keys = qualifyingColumns(rows).map((c) => c.key)
    assert.deepEqual(keys.slice(keys.indexOf('gap'), keys.indexOf('gap') + 3), ['gap', 'distance_m', 'interval'])
    const column = qualifyingColumns(rows).find((c) => c.key === 'distance_m')
    assert.equal(column.label, DISTANCE_LABEL)
    assert.equal(column.text(76), '76 m')
    assert.equal(column.text(0), '0 m')
    assert.equal(column.text(1234), '1,234 m')
    assert.equal(column.text(null), '—')
    assert.equal(distanceMethod(rows), `${DISTANCE_METHOD} ${KNOCKOUT_METHOD}`)
    assert.ok(sprintQualifyingColumns(rows).some((c) => c.key === 'distance_m'))
  })

  it('measures a single-session sheet, and a practice session, against its one fastest time', () => {
    // Phoenix 1990's front of the grid: one time each, 3.8 km.
    const phoenix = [
      row('berger', { time: '1:28.664' }),
      row('pierluigi-martini', { time: '1:28.731' }),
      row('alesi', { time: '1:29.408' }),
      row('senna', { time: null }),
    ]
    const d = byDriver(withDistance(phoenix, 3.8))
    assert.deepEqual(d, { berger: 0, 'pierluigi-martini': 3, alesi: 32, senna: null })
    assert.equal(distanceMethod(withDistance(phoenix, 3.8)), DISTANCE_METHOD)
    // Each practice session is its own sheet with its own fastest lap.
    const sheets = practiceBySession(
      [
        { session: 'fp1', driver_id: 'a', time: '1:30.000' },
        { session: 'fp1', driver_id: 'b', time: '1:31.000' },
        { session: 'fp2', driver_id: 'b', time: '1:29.000' },
        { session: 'fp2', driver_id: 'a', time: '1:29.500' },
      ],
      4.5,
    )
    assert.deepEqual(
      sheets.map((s) => byDriver(s.rows)),
      [
        { a: 0, b: 50 },
        { b: 0, a: 25 },
      ],
    )
    assert.ok(practiceColumns(sheets[0].rows).some((c) => c.key === 'distance_m'))
    assert.ok(!practiceColumns(practiceBySession([{ session: 'fp1', driver_id: 'a', time: '1:30.000' }])[0].rows).some((c) => c.key === 'distance_m'))
  })

  it('measures a grid time summed over two laps over both, and says so', () => {
    const aggregate = [row('a', { time: '3:00.000' }), row('b', { time: '3:01.000' }), row('c', {})]
    // One second behind over two 5 km laps run in 180 s: 2 x 5000 / 180.
    assert.deepEqual(byDriver(withDistance(aggregate, 5, 2)), { a: 0, b: 56, c: null })
    assert.deepEqual(byDriver(withDistance(aggregate, 5)), { a: 0, b: 28, c: null })
    for (const laps of [null, undefined, 1]) assert.deepEqual(byDriver(withDistance(aggregate, 5, laps)), { a: 0, b: 28, c: null })
    // A time of nothing is not a lap: no distance, never a negative one.
    assert.deepEqual(byDriver(withDistance([...aggregate, row('d', { time: '0.000' })], 5)), { a: 0, b: 28, c: null, d: null })
    assert.equal(distanceMethod(withDistance(aggregate, 5, 2), 2), `${DISTANCE_METHOD} ${AGGREGATE_METHOD}`)
    assert.equal(distanceMethod(withDistance(aggregate, 5), 1), DISTANCE_METHOD)
  })

  it("takes the register's length, then F1DB's drawing's, and neither where neither holds one", () => {
    assert.equal(layoutLength({ layout_km: 4.94, outline_km: 4.927 }), 4.94)
    assert.equal(layoutLength({ layout_km: null, outline_km: 3.8 }), 3.8)
    assert.equal(layoutLength({ layout_km: null, outline_km: null }), null)
    assert.equal(layoutLength(undefined), null)
  })

  it('resolves the layout and the distance on f1.db: Singapore 2026 by its timeline, Bahrain 2020 by its one-off, Phoenix 1990 by its drawing', () => {
    const db = new DatabaseSync(join(web, '..', 'f1.db'), { readOnly: true })
    try {
      const race = (year, round) => db.prepare(RACE_QUERY).get(year, round)
      const singapore2026 = race(2026, 17)
      assert.equal(singapore2026.f1db_layout_id, 'marina-bay-4')
      assert.equal(layoutLength(singapore2026), 4.94)
      const sheet = withDistance(db.prepare(QUALIFYING_QUERY).all(2026, 17), layoutLength(singapore2026))
      assert.equal(sheet.find((r) => r.driver_id === 'leclerc').distance_m, 3)
      assert.equal(sheet.find((r) => r.driver_id === 'lindblad').distance_m, 76)
      assert.equal(layoutLength(race(2020, 16)), 3.543)
      const phoenix1990 = race(1990, 1)
      assert.equal(phoenix1990.layout_km, null)
      assert.equal(layoutLength(phoenix1990), 3.8)
      const grid = withDistance(db.prepare(QUALIFYING_QUERY).all(1990, 1), layoutLength(phoenix1990))
      assert.equal(sessionParts(grid)[0], 'time')
      assert.equal(grid.find((r) => r.driver_id === 'pierluigi-martini').distance_m, 3)
      // The grid's laps: two in 2005's aggregate rounds, one after, and
      // none dated before 1996, which counts as one.
      assert.equal(phoenix1990.qualifying_laps, null)
      assert.equal(singapore2026.qualifying_laps, 1)
      assert.deepEqual([race(2005, 6).qualifying_laps, race(2005, 7).qualifying_laps], [2, 1])
    } finally {
      db.close()
    }
  })
})

describe('a chart with no owner is drawn in ink, its stated value marked (VD-94)', () => {
  it('a lone series without a sourced colour is ink, and several take the slots', () => {
    assert.equal(slotColour(0, 1), INK)
    assert.deepEqual([0, 1, 2].map((i) => slotColour(i, 3)), ['var(--series-1)', 'var(--series-2)', 'var(--series-3)'])
  })

  it("the home chart prints the two figures its note states, marks the latest season raced and draws a calendar hollow", () => {
    const seasons = [
      { year: 1950, rounds: 7, run: 7 },
      { year: 1960, rounds: 10, run: 10 },
      { year: 2025, rounds: 24, run: 24 },
      { year: 2026, rounds: 23, run: 18 },
      { year: 2027, rounds: 24, run: 0 },
    ]
    const columns = chartData(seasons)
    assert.deepEqual(columns.filter((c) => c.print).map((c) => c.key), [1950, 2026])
    assert.deepEqual(columns.filter((c) => c.mark).map((c) => c.key), [2026])
    assert.deepEqual(columns.filter((c) => c.hollow).map((c) => [c.key, c.note]), [[2027, 'calendar']])
    // The note names the same two seasons the picture prints.
    assert.match(chartNote(seasons), /^7 rounds in 1950; 23 by 2026\./)
    // The layout prints those two and not the peak, 2025 and 2027's 24.
    const layout = columnLayout({ data: columns, width: 600, height: 200 })
    assert.deepEqual(layout.columns.filter((c) => c.value !== null).map((c) => c.d.key), [1950, 2026])
    // With nothing raced nothing is marked, and the peak is printed as before.
    const calendar = chartData([{ year: 2027, rounds: 24, run: 0 }, { year: 2028, rounds: 20, run: 0 }])
    assert.equal(calendar.some((c) => c.mark || c.print), false)
    const peak = columnLayout({ data: calendar, width: 600, height: 200 })
    assert.deepEqual(peak.columns.filter((c) => c.value !== null).map((c) => c.d.key), [2027])
  })

  it('grid to flag marks the car classified first, and both of a shared winning drive', () => {
    const entry = (id, grid, finish, laps) => ({
      id,
      driver: `Driver ${id}`,
      grid,
      finish_position: finish,
      position_text: finish === null ? 'DNF' : String(finish),
      laps_completed: laps,
    })
    const layout = gridFlagLayout([entry(1, 2, 1, 50), entry(2, 1, 2, 50), entry(3, 3, null, 20)])
    assert.deepEqual(layout.cars.map(flagCarClass), ['flag-car flag-won', 'flag-car', 'flag-car flag-out'])
    const shared = gridFlagLayout([entry(1, 1, 1, 50), entry(2, 1, 1, 50), entry(3, 2, 2, 50)])
    assert.deepEqual(shared.cars.map((car) => car.won), [true, true, false])
  })
})

describe('where winners start at a circuit (AF-133)', async () => {
  const {
    STARTS_COLUMNS,
    startsFigures,
    startsLine,
    startsNote,
    startsTable,
    winnerStarts,
    byDecade,
    chipStart,
  } = await import('../src/queries/circuit.js')
  const { STARTS_CAP, dotStrip, gridDiagram, slotsDrawn } = await import('../src/charts/gridStarts.js')
  // One STARTS row: a winning entry of a race run here.
  const won = (year, grid, driver, constructor, extra = {}) => ({
    year,
    round: 1,
    name_used: 'Grand Prix',
    grid,
    grid_text: grid === null ? null : String(grid),
    driver_id: driver.toLowerCase().replace(/\W+/g, '-'),
    driver,
    constructor_id: constructor.toLowerCase().replace(/\W+/g, '-'),
    constructor,
    constructor_country: null,
    winners: 1,
    ...extra,
  })
  // Austin as the item worked it, 2012 to 2025: thirteen races, no 2020.
  const AUSTIN = [
    [2012, 2, 'Sir Lewis Hamilton', 'McLaren'],
    [2013, 1, 'Sebastian Vettel', 'Red Bull'],
    [2014, 2, 'Sir Lewis Hamilton', 'Mercedes'],
    [2015, 2, 'Sir Lewis Hamilton', 'Mercedes'],
    [2016, 1, 'Sir Lewis Hamilton', 'Mercedes'],
    [2017, 1, 'Sir Lewis Hamilton', 'Mercedes'],
    [2018, 2, 'Kimi Raikkonen', 'Ferrari'],
    [2019, 1, 'Valtteri Bottas', 'Mercedes'],
    [2021, 1, 'Max Verstappen', 'Red Bull'],
    [2022, 2, 'Max Verstappen', 'Red Bull'],
    [2023, 6, 'Max Verstappen', 'Red Bull'],
    [2024, 4, 'Charles Leclerc', 'Ferrari'],
    [2025, 1, 'Max Verstappen', 'Red Bull'],
  ].map(([year, grid, driver, team]) => won(year, grid, driver, team))
  // WINNERS and TEAMS as the views give them, most wins first.
  const tally = (key) =>
    [...AUSTIN.reduce((m, r) => m.set(r[key], (m.get(r[key]) ?? 0) + 1), new Map())]
      .map(([name, wins]) => ({ [key]: name, wins }))
      .sort((a, b) => b.wins - a.wins || a[key].localeCompare(b[key]))
  const value = (items, label) => items.find((item) => item.label === label)?.value

  it("pins Austin's figures as the item worked them", () => {
    const races = winnerStarts(AUSTIN)
    assert.equal(races.length, 13)
    const items = startsFigures(races, { placed: 308, first: 167, front: 250 }, tally('driver'), tally('constructor'))
    assert.equal(value(items, 'Won from first on the grid'), '6 of 13 (46%), against 167 of 308 (54%) at every circuit, 2012–2025')
    assert.equal(value(items, 'Won from the first two slots'), '11 of 13 (85%), against 250 of 308 (81%) at every circuit')
    assert.equal(value(items, 'Lowest winning grid slot'), '6th — Max Verstappen, 2023')
    assert.equal(value(items, 'Most wins by a driver'), 'Sir Lewis Hamilton, 5')
    assert.equal(value(items, 'Most wins by a team'), 'Mercedes and Red Bull, 5 each')
    assert.equal(value(items, 'Not counted as a slot'), undefined, 'every Austin winner has a slot')
    assert.equal(startsLine(races, 0), 'All 13 races won here, counted together. No layout timeline is recorded for this circuit.')
    // The table: one row per slot won from, in slot order, every race named.
    const table = startsTable(races)
    assert.deepEqual(table.map((row) => [row.start, row.wins]), [['1st', 6], ['2nd', 5], ['4th', 1], ['6th', 1]])
    const named = STARTS_COLUMNS.find((c) => c.key === 'races').text(table[3].races)
    assert.equal(named, '2023 Max Verstappen (Red Bull)')
    // The drawings: six slots, a whole row past the 6th; every race a dot.
    const grid = gridDiagram(races)
    assert.equal(grid.boxes.length, 6)
    assert.equal(grid.boxes.flatMap((b) => b.dots).length, 13)
    assert.ok(grid.boxes.every((b) => b.count === null))
    // The even slots stand half a box back of the odd ones beside them.
    const [p1, p2] = grid.boxes
    assert.ok(p2.x > p1.x && p2.y > p1.y)
    assert.equal(dotStrip(races).columns.length, 6)
    assert.deepEqual(byDecade(races).map((d) => [d.decade, d.races.length]), [['2010s', 8], ['2020s', 5]])
  })

  it("draws Monza's first slot as its count, 26, not as 26 dots", () => {
    const monza = Array.from({ length: 26 }, (_, i) => won(1950 + i, 1, `Driver ${i}`, 'Ferrari'))
    monza.push(won(2026, 19, 'Andrea Kimi Antonelli', 'Mercedes'))
    const races = winnerStarts(monza)
    const grid = gridDiagram(races)
    assert.ok(26 > STARTS_CAP)
    assert.equal(grid.boxes.length, 20, '19th is drawn, with its partner in the 20th')
    assert.equal(grid.boxes[0].count, 26)
    assert.deepEqual(grid.boxes[0].dots, [])
    assert.equal(grid.boxes[18].dots.length, 1, 'the 19th is stated, not hidden')
    const strip = dotStrip(races)
    assert.equal(strip.columns[0].count, 26)
    assert.ok(strip.columns[0].bar && strip.columns[0].dots.length === 0)
    // The strip is as tall as STARTS_CAP where a count stands in, and the
    // bar runs from its top to the baseline.
    assert.equal(strip.columns[0].bar.y + strip.columns[0].bar.height, strip.baseline - 1)
    // Two counts side by side are written at different heights, and a
    // third beside them goes back down, so no two neighbours share a line.
    const three = winnerStarts([1, 2, 3].flatMap((slot) => Array.from({ length: 9 }, (_, i) => won(1950 + slot * 10 + i, slot, 'D', 'T'))))
    const ys = dotStrip(three).columns.slice(0, 3).map((c) => c.countY)
    assert.ok(ys[0] !== ys[1] && ys[1] !== ys[2] && ys[0] === ys[2], `count heights ${ys}`)
    assert.ok(Math.min(...ys) > 0, 'and every count is inside the drawing')
    // A slot of exactly STARTS_CAP is still dots.
    const eight = winnerStarts(Array.from({ length: STARTS_CAP }, (_, i) => won(2000 + i, 3, 'D', 'T')))
    assert.equal(gridDiagram(eight).boxes[2].dots.length, STARTS_CAP)
    assert.equal(slotsDrawn(new Map([[3, []]])), 4)
  })

  it('keeps a pit-lane start, a slot not recorded and a shared drive apart from the slots', () => {
    const rows = [
      won(1950, 1, 'A', 'Alfa Romeo'),
      won(1951, null, 'B', 'Ferrari', { grid_text: 'PL' }),
      won(1952, null, 'C', 'Ferrari'),
      won(1953, 1, 'D', 'Maserati', { round: 2, winners: 2 }),
      won(1953, 7, 'E', 'Maserati', { round: 2, winners: 2 }),
    ]
    const races = winnerStarts(rows)
    assert.deepEqual(races.map((r) => [r.kind, r.slot]), [['slot', 1], ['pit', null], ['none', null], ['shared', null]])
    assert.deepEqual(races.map(chipStart), ['1st', 'pit lane', 'grid not recorded', 'shared drive'])
    // Only the one race with a slot is counted, and the rest are said.
    const items = startsFigures(races, null, [], [])
    assert.equal(value(items, 'Won from first on the grid'), '1 of 1 (100%)')
    assert.equal(value(items, 'Not counted as a slot'), '1 pit lane · 1 grid not recorded · 1 shared drive')
    assert.deepEqual(startsTable(races).map((r) => r.start), ['1st', 'pit lane', 'grid not recorded', 'shared drive'])
    // None of them is a dot, or a zero.
    assert.equal(gridDiagram(races).boxes.flatMap((b) => b.dots).length, 1)
    // Nothing with a slot: nothing to draw, and no slot figures.
    const unplaced = winnerStarts([rows[1]])
    assert.equal(gridDiagram(unplaced), null)
    assert.equal(dotStrip(unplaced), null)
    assert.equal(value(startsFigures(unplaced, null, [], []), 'Won from first on the grid'), undefined)
  })

  it('names ties in full up to three, then counts them', () => {
    const races = winnerStarts([won(2000, 9, 'A', 'T'), won(2001, 9, 'B', 'T'), won(2002, 9, 'C', 'T'), won(2003, 9, 'D', 'T')])
    assert.equal(value(startsFigures(races, null, [], []), 'Lowest winning grid slot'), '9th — A, 2000; B, 2001; C, 2002 and 1 more')
    const four = ['A', 'B', 'C', 'D'].map((driver) => ({ driver, wins: 1 }))
    assert.equal(value(startsFigures(races, null, four, []), 'Most wins by a driver'), '4 drivers, 1 each')
    assert.equal(value(startsFigures(races, null, four.slice(0, 2), []), 'Most wins by a driver'), 'A and B, 1 each')
  })

  it('the note names only the colours of dots drawn, never of races folded into a count', async () => {
    const { drawnColours } = await import('../src/charts/gridStarts.js')
    // Nine 2010s wins from one slot are a count; the one dot drawn is 1990's, in the gap.
    const rows = Array.from({ length: 9 }, (_, i) => won(2011 + i, 2, 'A', 'Mercedes'))
    rows.push(won(1990, 1, 'B', 'McLaren'))
    rows.sort((a, b) => a.year - b.year)
    const races = winnerStarts(rows)
    assert.ok(races.some((race) => race.colour), 'the folded races do carry a colour')
    assert.deepEqual(drawnColours(races), [null])
    assert.doesNotMatch(startsNote(drawnColours(races)), /livery/)
    assert.match(startsNote(drawnColours(races)), /every dot is hollow/)
    // Every slot a count: no dot, and nothing said of colour.
    const folded = winnerStarts(rows.filter((row) => row.year > 2000))
    assert.deepEqual(drawnColours(folded), [])
    assert.doesNotMatch(startsNote([]), /olour/)
  })

  it('a chip names its race for a screen reader, and a shared drive with no team reads as not established', async () => {
    const { chipRace } = await import('../src/queries/circuit.js')
    const races = winnerStarts([
      won(2020, 1, 'A', 'Mercedes', { round: 1, name_used: 'Austrian Grand Prix' }),
      won(2020, 1, 'A', 'Mercedes', { round: 2, name_used: 'Styrian Grand Prix' }),
    ])
    assert.notEqual(chipRace(races[0]), chipRace(races[1]))
    const shared = winnerStarts([won(1953, 1, 'D', 'Maserati', { winners: 2 }), won(1953, 7, 'E', 'Ferrari', { winners: 2, constructor: null, constructor_id: null })])
    assert.equal(shared[0].team, 'Maserati / —')
  })

  it('a team with no colour on record is hollow, and the note says so', () => {
    // 1990: the declared gap, where no row can carry a colour.
    const races = winnerStarts([won(1990, 1, 'A', 'McLaren')])
    assert.equal(races[0].colour, null)
    assert.match(startsNote([null]), /every dot is hollow/)
    assert.doesNotMatch(startsNote([{ kind: 'livery' }]), /hollow/)
    assert.match(startsNote([{ kind: 'livery' }, null]), /A hollow dot has no colour on record\./)
  })
})
