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
  groupFault,
  groupRuns,
  onPhone,
  shared,
  sharedLine,
  tableKey,
} from '../src/lib/table.js'
import { captureOpenFolds, captureStaticTables, staticFaceFoldOpen, staticOpen, staticRows } from '../src/lib/handover.js'

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
import { EXPLAINED_FOOTER, OPEN_FOOTER, allExplained, byReading } from '../src/lib/disagreement.js'
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
  clinchRound,
  mostPerRound,
  seasonAnswer,
  titleAnswer,
  titleStrip,
  titleHeading,
  TITLE_STANDINGS,
  titleSettled,
  currentTitle,
  fightAhead,
  fightCitation,
  fightLine,
  isUpcoming,
  outSince,
  reachFigures,
  RACE_PLACES,
  CLINCH_CHAMPION,
  CLINCH_LEVEL,
  CLINCH_ON,
  CLINCH_TAKEN,
  clinchStrips,
  teamAvailable,
  championPill,
  pointsShare,
  standingsLeader,
  EVERY_RESULT_COUNTS,
  leadersByRound,
  raceEnded,
  shortNames,
  titleFinding,
  titleRaceFigure,
} from '../src/queries/season.js'
import { reachLayout, reachText } from '../src/charts/reachChart.js'
import { BAR_LABEL_WIDTH, barLayout, barMargin, textRoom } from '../src/charts/barChart.js'
import { clinchLayout } from '../src/charts/clinchStrip.js'
import { SEASONS_COLUMNS, soFar } from '../src/queries/seasons.js'
import { entryColumns, entryOut, entryResult } from '../src/queries/car.js'
import { disagrees, safeToQuote } from '../src/queries/quality.js'
import { eraCell } from '../src/queries/eras.js'
import { RACE_COLUMNS as RACES_COLUMNS, raceWinner } from '../src/queries/races.js'
import { CONSTRUCTOR_COLUMNS, entered } from '../src/queries/constructors.js'
import { CIRCUIT_COLUMNS, traced } from '../src/queries/circuits.js'
import { traceFields } from '../src/lib/trace.js'
import { GRANDS_PRIX_COLUMNS } from '../src/queries/grandsprix.js'
import { circuitYears, editionCar, venuesCount } from '../src/queries/grandprix.js'
import { heldAs } from '../src/queries/circuit.js'
import { CHASSIS_COLUMNS, chassisName } from '../src/queries/cars.js'
import { driverName, fastestLapMark, inClassificationOrder, outcome, position, RACE_HISTORY, raceAftermath, raceLede, raceSentence, railOf, scheduledNote, stintsEmpty, stintsLabel } from '../src/queries/race.js'
import { classificationFooter, firstHomeNote, raceBehind, raceTime } from '../src/queries/race.js'
import { RACE_COLUMNS, raceWinnerHere, racesCount } from '../src/queries/circuit.js'
import { STINT_HEADS, lapRange, pitPairs, pitWave, stintLaps, stintLayout, stintRows, stintTableRows, stintTitle, stintsShown, stopTitle, unbarredOf } from '../src/charts/stints.js'
import {
  BY_ROUND_WIDTH,
  ROW_SPARK_HEIGHT,
  SEASONS_RACED_WIDTH,
  SPARK_HEIGHT,
  TITLE_RACE_WIDTH,
  byRoundLayout,
  byRoundOf,
  byRoundText,
  runsOf,
  seasonsRacedLayout,
  seasonsRacedText,
  titleRaceLayout,
  titleRaceOf,
  titleRaceText,
} from '../src/charts/spark.js'
import { SEASON_COLUMNS as TEAM_SEASON_COLUMNS } from '../src/queries/constructor.js'
import {
  BY_SEASON as TEAM_BY_SEASON,
  DERIVED as TEAM_DERIVED,
  STANDINGS as TEAM_STANDINGS,
  WINS as TEAM_WINS,
  WINS_FOOTER as TEAM_WINS_FOOTER,
  constructorSeasons,
  lineageChains,
  recordFigures,
  winsByRace,
  winsFooter,
} from '../src/queries/constructor.js'
import { FINAL as SEASON_FINAL } from '../src/queries/season.js'
import { DIGEST_NOTE, EYEBROWS, NOT_YET_RUN, behindThisPage, citation, licenceTerms } from '../src/lib/site.js'
import { ONWARD, raceSteps } from '../src/lib/wayfinding.js'
import { NEIGHBOURS as RACE_NEIGHBOURS } from '../src/queries/race.js'
import { gridFlagLabel, gridFlagMoves, gridFlagStory } from '../src/queries/race.js'
import { nameParts } from '../src/lib/format.js'
import { RACING_INK, SLAB_INK, contrastRatio, inkOn, placesMoved, slab, slabVars } from '../src/lib/podium.js'
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
  podiumStart,
  raceAlso,
  racePodium,
  raceStrip,
  practiceBySession,
  practiceColumns,
  qualifyingColumns,
  raceWeather,
  WEATHER_METHOD,
  sessionParts,
  sprintQualifyingColumns,
  withDistance,
} from '../src/queries/race.js'
import {
  CYCLE,
  READING_NOTE,
  RESULTS_DAYS,
  chartData,
  chartNote,
  chartNotes,
  dbLine,
  homeAhead,
  homeCycle,
  homePlate,
  lastPodium,
  openingCaption,
  openingRace,
  podium,
  reachHeading,
  reading,
  seasonComplete,
  sessionsClock,
  seasonHeading,
  seasonStrip,
  stillToRunNote,
} from '../src/queries/home.js'
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
  liveryRibbon,
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
  photoOutline,
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
  cardComparator,
  cardExtras,
  cardFigure,
  familyAnchor,
  headlineRecords,
  recordLead,
  runSentence,
  leadersDrawn,
  leadersDrawnLine,
  markLeaders,
  recordColumns,
  recordFamilies,
  tiersOf,
} from '../src/queries/records.js'
import { columnLayout } from '../src/charts/columnChart.js'
import { flagCarClass, gridFlagLayout, gridFlagRows, textWidth } from '../src/charts/gridFlag.js'
import { INK, slotColour } from '../src/charts/palette.js'
import { clearState, oneOf, readState, urlWriter, writeState } from '../src/lib/urlstate.js'
import { unestablished } from '../src/lib/tiles.js'
import { LAP_NEXT, LAP_RUN, LAP_TO_COME, flatten, lapLabel, lapLayout } from '../src/lib/lap.js'
import {
  FORECAST_ENDPOINT,
  FRESH_MS,
  OUTLOOK_DAYS,
  dayName,
  forecastRequest,
  loadForecast,
  outlookDays,
  readForecast,
  sessionForecasts,
  sky,
  updatedAt,
} from '../src/lib/forecast.js'

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

describe('result, with a blank text (CR-26)', () => {
  it('falls back to the number where the text is an empty string, as it does for null', () => {
    assert.equal(result({ position_text: '', finish_position: 3 }), '3')
  })

  it('is an em dash where the text is empty and there is no number', () => {
    assert.equal(result({ position_text: '', finish_position: null }), EMPTY)
  })
})

describe('the car page entry columns (CR-26)', () => {
  it('entryResult is result(): the source spelling, the number, or the em dash', () => {
    const rows = [
      { position_text: 'DNF', finish_position: null },
      { position_text: '7', finish_position: 7 },
      { position_text: 'D', finish_position: 12 },
      { position_text: null, finish_position: 3 },
      { position_text: '', finish_position: 3 },
      { position_text: '', finish_position: null },
      { position_text: null, finish_position: null },
    ]
    for (const row of rows) assert.equal(entryResult(row.position_text, row), result(row))
    assert.equal(entryResult('DNF', { position_text: 'DNF', finish_position: null }), 'DNF')
    assert.equal(entryResult('D', { position_text: 'D', finish_position: 12 }), 'D')
    assert.equal(entryResult('', { position_text: '', finish_position: 3 }), '3')
    assert.equal(entryResult(null, { position_text: null, finish_position: null }), EMPTY)
  })

  it('entryOut says Finished only for a classified finisher with no status', () => {
    assert.equal(entryOut(null, { finish_position: 4 }), 'Finished')
    assert.equal(entryOut('', { finish_position: 4 }), 'Finished')
    assert.equal(entryOut('Engine', { finish_position: null }), 'Engine')
    assert.equal(entryOut('+1 Lap', { finish_position: 9 }), '+1 Lap')
  })

  it('entryOut is an em dash for no status and no finish: not established, not "Finished"', () => {
    assert.equal(entryOut(null, { finish_position: null }), EMPTY)
  })

  it('the Result and Out columns are the two helpers', () => {
    const columns = entryColumns(false)
    assert.equal(columns.find((c) => c.key === 'position_text').text, entryResult)
    assert.equal(columns.find((c) => c.key === 'status').text, entryOut)
  })
})

describe('eraCell (CR-26)', () => {
  it('writes the name and then its years', () => {
    assert.equal(eraCell('Turbo era', { from_year: 1977, to_year: 1988 }), 'Turbo era 1977–1988')
    assert.equal(eraCell('Hybrid era', { from_year: 2014, to_year: null }), 'Hybrid era 2014–')
  })

  it('shows a missing name as the em dash and does not drop the years', () => {
    assert.equal(eraCell(null, { from_year: 1950, to_year: 1950 }), `${EMPTY} 1950`)
  })
})

describe('the data-quality helpers (CR-26)', () => {
  it('safeToQuote says yes only for a truthy flag', () => {
    assert.equal(safeToQuote(1), 'yes')
    assert.equal(safeToQuote(0), 'not without checking')
    assert.equal(safeToQuote(null), 'not without checking')
  })

  const agreeing = {
    derived_wins: 3, wins_external: 3, derived_poles: 2, poles_external: 2, derived_fl: 1, fastest_laps_external: 1,
  }

  it('disagrees is false when every published figure matches', () => {
    assert.equal(disagrees(agreeing), false)
  })

  it('disagrees is true when any one published figure differs', () => {
    assert.equal(disagrees({ ...agreeing, wins_external: 4 }), true)
    assert.equal(disagrees({ ...agreeing, poles_external: 1 }), true)
    assert.equal(disagrees({ ...agreeing, fastest_laps_external: 0 }), true)
  })

  it('disagrees does not count a figure nobody published, even a derived zero against it', () => {
    const none = { ...agreeing, wins_external: null, poles_external: null, fastest_laps_external: null }
    assert.equal(disagrees({ ...none, derived_wins: 0 }), false)
  })

  it('disagrees counts a published zero as a figure to compare', () => {
    assert.equal(disagrees({ ...agreeing, wins_external: 0 }), true)
  })
})

describe("a race's finishing time and gap (AF-157)", () => {
  const winner = { finish_position: 1, driver: 'Lewis Hamilton', time: '1:19:57.566', gap: '+0.526' }
  const second = { finish_position: 2, driver: 'Oscar Piastri', time: '1:19:58.213', gap: '+1.173' }
  const lapped = { finish_position: 9, driver: 'A', time: null, gap: '+2 laps' }
  const out = { finish_position: null, driver: 'B', time: null, gap: null, status: 'Engine' }
  const dsq = { finish_position: null, driver: 'George Russell', time: '1:19:57.040', gap: null, position_text: 'DSQ' }

  it("prints the winner's time and every other car's gap, its own time with no gap, the em dash with neither", () => {
    assert.equal(raceTime(winner), '1:19:57.566', 'the winner shows the time, whatever its gap')
    assert.equal(raceTime(second), '+1.173')
    assert.equal(raceTime(lapped), '+2 laps')
    assert.equal(raceTime(dsq), '1:19:57.040', 'the first car home holds a time and no gap')
    assert.equal(raceTime(out), null)
    assert.equal(raceTime({ finish_position: 1, time: null, gap: null }), null, 'a shared winner F1DB gives no time')
  })

  it('sorts by how far behind: the first car home, seconds, then laps, and nothing for neither', () => {
    assert.equal(raceBehind(dsq), 0)
    assert.equal(raceBehind(winner), 0.526)
    assert.equal(raceBehind({ gap: '+1:03.011' }), 63.011)
    assert.ok(raceBehind(lapped) > raceBehind({ gap: '+1 lap' }) && raceBehind({ gap: '+1 lap' }) > raceBehind({ gap: '+1:03.011' }))
    assert.equal(raceBehind(out), null)
  })

  it('says where the gaps are to a car not classified first, and nowhere else', () => {
    const note = 'Each gap is to the first car home, George Russell, who is not classified first.'
    assert.equal(firstHomeNote([winner, second, dsq, out]), note)
    assert.ok(classificationFooter([winner, second, dsq]).includes(note))
    assert.equal(firstHomeNote([{ ...winner, gap: null }, second, lapped, out]), '', 'the winner is the first car home')
    assert.equal(firstHomeNote([out, lapped]), '')
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
    // DA-43: points and entries are explained here too, so the words are not a span's.
    assert.ok(EXPLAINED_FOOTER.includes('the published figure'))
    assert.ok(!EXPLAINED_FOOTER.includes('span'))
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
    // DA-43: a stored total explained on the record is a reading too, and the
    // kind decides it - the same note on another kind is not.
    const total = { kind: 'stored-total', status: 'explained', status_note: 'net of dropped scores' }
    assert.equal(allExplained([total]), true)
    assert.equal(allExplained([total, explained]), true)
    assert.equal(allExplained([{ ...older, kind: 'external-figure' }]), false)
    assert.equal(allExplained([{ ...total, status: 'open' }]), false)
  })
  it('splits open rows from explained ones, open first, and drops an empty group', () => {
    const open = { id: 1, kind: 'stored-total', status: 'open', status_note: 'sources differ' }
    const total = { id: 2, kind: 'stored-total', status: 'explained', status_note: 'external figure is older' }
    assert.deepEqual(byReading([total, open]), [[open], [total]])
    assert.deepEqual(byReading([open]), [[open]])
    assert.deepEqual(byReading([total]), [[total]])
    assert.deepEqual(byReading([]), [])
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

  // AF-137: a rival who can at best draw level is settled on the countback
  // the season's own rule sets, counted from the Grand Prix places so far
  // with the rival's best case added - every round left won, or for a team
  // a one-two - and the leader's scoring places as they stand.
  describe('a tie a rival can at best draw level for, settled on the countback', () => {
    // The issue's example: before Austin 2026, Antonelli wins it and Russell
    // is 9th. Antonelli 365 with 9 wins, Russell 240 with 3, five rounds and
    // 125 points left. Russell's best case is level on 365 with 8 wins.
    const live = {
      races: 5, sprints: 0, run: 18, results: 18, dropped_scores: 'Every result counts', available: 125,
      win_points: 25, fastest_lap_points: 0, scale: '[25,18,15,12,10,8,6,4,2,1]', sprint_scale: '[8,7,6,5,4,3,2,1]', sprint_points: 8,
      countback: RACE_PLACES,
    }
    const drivers = [
      { entity: 'Andrea Kimi Antonelli', driver_id: 'antonelli', position: 1, points: 365 },
      { entity: 'George Russell', driver_id: 'russell', position: 2, points: 240 },
      { entity: 'Sir Lewis Hamilton', driver_id: 'hamilton', position: 3, points: 229 },
    ]
    const place = (kind, id, at, n) => ({ kind, id, place: at, n })
    const austin = [
      place('drivers', 'antonelli', 1, 9), place('drivers', 'antonelli', 2, 3), place('drivers', 'antonelli', 3, 3),
      place('drivers', 'russell', 1, 3), place('drivers', 'russell', 2, 4), place('drivers', 'russell', 3, 1),
    ]
    const answer = (args) => titleAnswer({ drivers, remaining: live, afterRound: 18, year: 2026, places: austin, ...args })

    it('puts out a rival who would lose the tie, and says on what', () => {
      const said = answer({})
      assert.equal(
        said.who,
        "Only Andrea Kimi Antonelli can still win the drivers' title: no other driver can now beat the leader's total, or match it and win the countback.",
      )
      assert.match(said.basis, /A tie on points goes to whoever has more wins, then more second places, and so on\./)
      assert.match(
        said.basis,
        /George Russell can at best draw level with Andrea Kimi Antonelli, by winning every round left, and would then lose it on the countback: 8 wins to 9\.$/,
      )
      assert.ok(!said.basis.includes('Points only'), 'the old sentence goes where the answer is given')
      assert.equal(said.drivers.rows.find((d) => d.id === 'russell').alive, false)
      assert.equal(fightLine(said, 'drivers', 'russell'), 'Out of the title fight: can at best draw level, and would lose the countback.')
      assert.equal(fightLine(said, 'drivers', 'antonelli'), 'The only one left in the title fight: 125 clear with 125 left.')
      // The bar meets the line and is out, so the note says why.
      const [figure] = reachFigures(said, 2026)
      assert.equal(figure.rows.find((d) => d.id === 'russell').alive, false)
      assert.match(figure.note, /a bar short of it is out, as is one that meets it and loses the countback\./)
    })

    it('keeps in a rival who would win the tie, the other way round', () => {
      const fewer = austin.map((p) => (p.id === 'antonelli' && p.place === 1 ? { ...p, n: 7 } : p))
      const said = answer({ places: fewer })
      assert.equal(said.who, "Who can still win the drivers' title: Andrea Kimi Antonelli and George Russell.")
      assert.match(said.basis, /and would then take the title on the countback: 8 wins to 7\.$/)
      assert.equal(fightLine(said, 'drivers', 'russell'), 'Still in the title fight: 125 behind with 125 left.')
      assert.ok(!reachFigures(said, 2026)[0].note.includes('countback'))
    })

    it('goes down the order where the wins are level, and only as far as the places that score', () => {
      // 8 wins each; then second places, Russell's 4 to Antonelli's 3.
      const level = austin.map((p) => (p.id === 'antonelli' && p.place === 1 ? { ...p, n: 8 } : p))
      assert.match(answer({ places: level }).basis, /take the title on the countback: level on wins, then 4 second places to 3\.$/)
      // Seconds level too: third places, 3 to 1, against him.
      const deeper = level.map((p) => (p.id === 'russell' && p.place === 2 ? { ...p, n: 3 } : p))
      assert.match(answer({ places: deeper }).basis, /lose it on the countback: level on wins and every place to second, then 1 third place to 3\.$/)
      // Level on every place that scores: below them the leader's finishes are
      // not fixed, so nobody can say, and the rival stays in. A place below the
      // scale and a team's place are not a driver's countback at all.
      const same = [
        place('drivers', 'antonelli', 1, 8), place('drivers', 'russell', 1, 3),
        place('drivers', 'antonelli', 11, 4), place('constructors', 'russell', 2, 9),
      ]
      const unsaid = answer({ places: same })
      assert.match(unsaid.who, /Andrea Kimi Antonelli and George Russell\./)
      assert.match(unsaid.basis, /by winning every round left, and who the countback would then favour is not worked out here\.$/)
    })

    it('counts a sprint left as nothing, because a sprint place is not a race place', () => {
      const said = answer({ remaining: { ...live, sprints: 1, available: 133 } , drivers: [drivers[0], { ...drivers[1], points: 232 }] })
      assert.match(said.basis, /by winning every round and sprint left, and would then lose it on the countback: 8 wins to 9\.$/)
    })

    it('declines where the rule is not held, and where the results are behind the calendar', () => {
      // A season no tie_breaks period covers: the words VD-90 printed, and the
      // rival counted in, as before AF-137.
      const unruled = answer({ remaining: { ...live, countback: null } })
      assert.match(unruled.who, /Andrea Kimi Antonelli and George Russell\./)
      assert.match(unruled.basis, /Points only: a tie at the top is settled on wins, which this does not work out\.$/)
      assert.ok(!unruled.basis.includes('countback'))
      // A spelling the page does not know is not the rule.
      assert.match(answer({ remaining: { ...live, countback: 'race and sprint places' } }).basis, /Points only/)
      // A round run with no result yet would be counted as nobody's places.
      const behind = answer({ remaining: { ...live, results: 17 } })
      assert.match(behind.who, /Andrea Kimi Antonelli and George Russell\./)
      assert.match(behind.basis, /goes to whoever has more wins.*who the countback would then favour is not worked out here\.$/)
      // And without the places at all.
      assert.match(answer({ places: undefined }).basis, /not worked out here\.$/)
    })

    it("settles the constructors' title on both cars' places, with a one-two a round", () => {
      const teams = [
        { entity: 'Mercedes', constructor_id: 'mercedes', position: 1, points: 500 },
        { entity: 'Ferrari', constructor_id: 'ferrari', position: 2, points: 414 },
      ]
      // Two rounds at 43 a team: Ferrari 86 behind, level at best. Its best case
      // adds two wins and two second places: 5 and 3 against Mercedes' 5 and 4.
      const two = { ...live, races: 2, available: 50 }
      const places = [
        place('constructors', 'mercedes', 1, 5), place('constructors', 'mercedes', 2, 4),
        place('constructors', 'ferrari', 1, 3), place('constructors', 'ferrari', 2, 1),
      ]
      const said = titleAnswer({ drivers: [], constructors: teams, remaining: two, afterRound: 18, year: 2026, places })
      assert.match(said.who, /^Only Mercedes can still win the constructors' title: no other team can now beat the leader's total, or match it and win the countback\./)
      assert.match(said.basis, /Ferrari can at best draw level with Mercedes, with a one-two in every round left, and would then lose it on the countback: level on wins, then 3 second places to 4\.$/)
      // Two more second places and it is Ferrari's.
      const more = places.map((p) => (p.id === 'ferrari' && p.place === 2 ? { ...p, n: 3 } : p))
      const won = titleAnswer({ drivers: [], constructors: teams, remaining: two, afterRound: 18, year: 2026, places: more })
      assert.match(won.who, /Mercedes and Ferrari\./)
      assert.match(won.basis, /would then take the title on the countback: level on wins, then 5 second places to 4\.$/)
    })

    it('has to beat every leader, and names no figures against two', () => {
      const shared = [
        { entity: 'A', driver_id: 'a', position: 1, points: 365 },
        { entity: 'B', driver_id: 'b', position: 2, points: 365 },
        { entity: 'C', driver_id: 'c', position: 3, points: 240 },
      ]
      const places = [place('drivers', 'a', 1, 6), place('drivers', 'b', 1, 9), place('drivers', 'c', 1, 3)]
      // 8 wins beats A's 6 and loses to B's 9: out.
      const said = titleAnswer({ drivers: shared, remaining: live, afterRound: 18, year: 2026, places })
      assert.equal(said.who, "Who can still win the drivers' title: A and B.")
      assert.match(said.basis, /C can at best draw level with A and B, by winning every round left, and would then lose it on the countback\.$/)
      // Beating both keeps C in.
      const both = places.map((p) => (p.id === 'b' ? { ...p, n: 7 } : p))
      assert.match(titleAnswer({ drivers: shared, remaining: live, afterRound: 18, year: 2026, places: both }).who, /A, B and C\./)
      // One id twice on a table is not counted back.
      const twice = [...shared, { entity: 'C again', driver_id: 'c', position: 4, points: 1 }]
      assert.match(titleAnswer({ drivers: twice, remaining: live, afterRound: 18, year: 2026, places }).basis, /not worked out here\.$/)
    })
  })

  // AF-138: which finishes at the next round settle the drivers' title. The
  // issue's example, before Austin 2026, from the database after round 17:
  // Antonelli 340 with 8 wins, six rounds and 150 points left, then 125.
  describe('the clinch strip for the next round', () => {
    const live = {
      races: 6, sprints: 0, run: 17, results: 17, dropped_scores: 'Every result counts', available: 150,
      win_points: 25, fastest_lap_points: 0, scale: '[25,18,15,12,10,8,6,4,2,1]', sprint_scale: '[8,7,6,5,4,3,2,1]', sprint_points: 8,
      countback: RACE_PLACES,
    }
    const drivers = [
      { entity: 'Andrea Kimi Antonelli', driver_id: 'antonelli', position: 1, points: 340 },
      { entity: 'George Russell', driver_id: 'russell', position: 2, points: 238 },
      { entity: 'Sir Lewis Hamilton', driver_id: 'hamilton', position: 3, points: 229 },
      { entity: 'Max Verstappen', driver_id: 'verstappen', position: 4, points: 221 },
      { entity: 'Charles Leclerc', driver_id: 'leclerc', position: 5, points: 215 },
      { entity: 'Lando Norris', driver_id: 'norris', position: 6, points: 201 },
      { entity: 'Oscar Piastri', driver_id: 'piastri', position: 7, points: 138 },
    ]
    const counts = {
      antonelli: { 1: 8, 2: 3, 3: 3, 5: 1 },
      russell: { 1: 3, 2: 4, 3: 1, 4: 2, 5: 1, 7: 1, 9: 1 },
      hamilton: { 1: 1, 2: 2, 3: 3, 4: 3, 5: 2, 6: 5 },
    }
    const placesOf = (table) =>
      Object.entries(table).flatMap(([id, by]) => Object.entries(by).map(([at, n]) => ({ kind: 'drivers', id, place: Number(at), n })))
    const places = placesOf(counts)
    const names = ['Australian', 'Chinese', 'Japanese', 'Miami', 'Canadian', 'Monaco', 'Barcelona-Catalunya', 'Austrian', 'British', 'Belgian',
      'Hungarian', 'Dutch', 'Italian', 'Spanish', 'Azerbaijan', 'Bahrain', 'Singapore', 'United States', 'Mexico City', 'Sao Paulo',
      'Las Vegas', 'Qatar', 'Abu Dhabi']
    const rounds = names.map((name, i) => ({
      round: i + 1,
      name_used: `${name} Grand Prix`,
      sprint: [2, 4, 5, 9, 12, 17].includes(i + 1) ? 1 : 0,
      status: i < 17 ? 'completed' : 'scheduled',
    }))
    const strips = ({ remaining = live, table = drivers, at = places, calendar = rounds } = {}) =>
      clinchStrips(titleAnswer({ drivers: table, remaining, afterRound: remaining.run, year: 2026, places: at }), remaining, calendar)
    const marks = (strip, label) => strip.data.find((d) => d.label === label).cells.map((c) => c.mark)
    const [T, C, L, O] = [CLINCH_TAKEN, CLINCH_CHAMPION, CLINCH_LEVEL, CLINCH_ON]

    it("pins Austin's strip: he wins, Russell 10th or lower, Hamilton 5th or lower", () => {
      const clinch = strips()
      assert.equal(clinch.race, 'United States Grand Prix')
      assert.equal(clinch.round, 18)
      // No other finish of his settles it: second, and Russell scoring nothing
      // is 120 behind with 125 left.
      assert.equal(clinch.strips.length, 1)
      const [wins] = clinch.strips
      assert.equal(wins.title, 'If Andrea Kimi Antonelli wins the United States Grand Prix')
      assert.equal(wins.place, 1)
      // Every rival still in has a row, Piastri, out, none.
      assert.deepEqual(wins.data.map((d) => d.label), ['Russell', 'Hamilton', 'Verstappen', 'Leclerc', 'Norris'])
      assert.deepEqual(marks(wins, 'Russell'), [T, O, O, O, O, O, O, O, L, C, C])
      assert.deepEqual(marks(wins, 'Hamilton'), [T, O, O, O, C, C, C, C, C, C, C])
      for (const rival of ['Verstappen', 'Leclerc', 'Norris']) assert.deepEqual(marks(wins, rival), [T, ...Array(10).fill(C)], rival)
      // Russell 9th is level on 365, and the countback is Antonelli's: Russell
      // wins the five rounds after for 8 wins, to his 9.
      const ninth = wins.data[0].cells[8]
      assert.deepEqual(ninth.countback, { wins: false, place: 1, mine: 8, theirs: 9 })
      const russell = wins.rows.find((r) => r.id === 'russell')
      assert.equal(russell.p1, "Antonelli's place")
      assert.equal(russell.p8, 'Title goes on')
      assert.equal(russell.p9, 'Level: Antonelli champion on the countback')
      assert.equal(russell.p10, 'Antonelli champion')
      assert.equal(russell.none, 'Antonelli champion')
      assert.equal(russell.entity, 'George Russell')
      // The table has a column for every place the scale pays, and none.
      assert.deepEqual(wins.columns.map((c) => c.label), ['Rival', '1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th', '10th', 'No points'])
      assert.deepEqual(Object.keys(russell).sort(), ['entity', 'id', 'none', ...wins.columns.slice(1, 11).map((c) => c.key)].sort())
      assert.match(wins.note, /A tick is Antonelli champion;.*a dash, Antonelli's own place\.$/)
    })

    it('is what seasonAnswer() and so the upcoming race carry, and nothing once the title is on the record', () => {
      const args = { rounds, standings: [], drivers, remaining: live, afterRound: 17, year: 2026, places }
      const open = seasonAnswer({ ...args, season: { year: 2026, drivers_champion: null } })
      assert.deepEqual(open.clinch, strips())
      const crowned = seasonAnswer({ ...args, season: { year: 2026, drivers_champion: 'antonelli', champion: 'Andrea Kimi Antonelli' } })
      assert.equal(crowned.clinch, null)
    })

    it('says who the countback favours, and where it cannot', () => {
      // Two wins fewer for Antonelli: 7 after Austin, to Russell's 8.
      const fewer = placesOf({ ...counts, antonelli: { ...counts.antonelli, 1: 6 } })
      const [wins] = strips({ at: fewer }).strips
      assert.equal(wins.rows[0].p9, 'Level: Russell takes the countback')
      assert.equal(wins.data[0].cells[8].mark, CLINCH_LEVEL)
      // No rule held for the season: level, and not worked out.
      const [unruled] = strips({ remaining: { ...live, countback: null } }).strips
      assert.equal(unruled.rows[0].p9, 'Level: the countback is not worked out')
      assert.equal(unruled.data[0].cells[8].countback, null)
    })

    it('draws a strip whose row lands only on level where the countback is the leader’s, and not where it is not', () => {
      // Russell on 240: scoring nothing at Austin he is 125 behind with 125 left.
      const level = [drivers[0], { ...drivers[1], points: 240 }, ...drivers.slice(2)]
      const [wins] = strips({ table: level }).strips
      assert.deepEqual(marks(wins, 'Russell'), [T, ...Array(9).fill(O), L])
      assert.equal(wins.rows[0].none, 'Level: Antonelli champion on the countback')
      // With the countback Russell's, no finish of Antonelli's settles it.
      assert.equal(strips({ table: level, at: placesOf({ ...counts, antonelli: { 1: 6 } }) }), null)
    })

    it('draws a strip for every finish of the leader that settles it, best first', () => {
      // After Austin: Antonelli 365, Russell 242, Hamilton 241, five rounds
      // and 125 left, then 100. Nothing at Mexico still settles it, so long
      // as neither of them wins.
      const after = [
        { ...drivers[0], points: 365 }, { ...drivers[1], points: 242 }, { ...drivers[2], points: 241 },
        { ...drivers[3], points: 236 }, { ...drivers[4], points: 233 }, { ...drivers[5], points: 211 },
      ]
      const calendar = rounds.map((r) => (r.round === 18 ? { ...r, status: 'completed' } : r))
      const clinch = strips({ table: after, remaining: { ...live, races: 5, run: 18, results: 18, available: 125 }, calendar })
      assert.equal(clinch.race, 'Mexico City Grand Prix')
      assert.deepEqual(clinch.strips.map((s) => s.place), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, null])
      const none = clinch.strips.at(-1)
      assert.equal(none.title, 'If Andrea Kimi Antonelli scores no points in the Mexico City Grand Prix')
      assert.equal(clinch.strips[1].title, 'If Andrea Kimi Antonelli finishes second in the Mexico City Grand Prix')
      // Scoring nothing, the leader's place is no column: no cell is taken.
      assert.ok(none.data.every((d) => !d.cells.some((c) => c.mark === CLINCH_TAKEN)))
      assert.deepEqual(marks(none, 'Russell'), [O, C, C, C, C, C, C, C, C, C, C])
    })

    it('draws nothing where the next round cannot settle it, or the arithmetic cannot say', () => {
      // A round earlier, 175 left: nothing at Austin settles it.
      assert.equal(strips({ remaining: { ...live, races: 7, run: 16, results: 16, available: 175 }, calendar: rounds.map((r) => (r.round === 17 ? { ...r, status: 'scheduled' } : r)) }), null)
      // Two level at the top; nobody still in; a calendar a round out.
      assert.equal(strips({ table: [drivers[0], { ...drivers[1], points: 340 }, ...drivers.slice(2)] }), null)
      assert.equal(strips({ table: [drivers[0], drivers[6]] }), null)
      assert.equal(strips({ calendar: rounds.map((r) => (r.round === 18 ? { ...r, status: 'completed' } : r)) }), null)
      // A scale that is not numbers, and no answer at all.
      assert.equal(strips({ remaining: { ...live, scale: 'not json' } }), null)
      assert.equal(clinchStrips(null, live, rounds), null)
    })

    it('says so, rather than drawing, at a sprint weekend or where the fastest lap pays', () => {
      const sprint = rounds.map((r) => (r.round === 18 ? { ...r, sprint: 1 } : r))
      const atSprint = strips({ remaining: { ...live, sprints: 1, available: 158 }, calendar: sprint })
      assert.equal(atSprint.strips, undefined)
      assert.equal(
        atSprint.declined,
        'The United States Grand Prix could settle the drivers\' title, but it has a sprint as well, and which finishes in the two would settle it is not drawn here.',
      )
      // A point for the fastest lap: 26 a round, 130 left after Austin, and
      // Russell on 230 out of reach of 366 if he scores nothing.
      const lap = strips({ remaining: { ...live, fastest_lap_points: 1, available: 156 }, table: [drivers[0], { ...drivers[1], points: 230 }, ...drivers.slice(2)] })
      assert.match(lap.declined, /^The United States Grand Prix could settle the drivers' title, but the fastest lap pays a point/)
      // A sprint weekend that cannot settle it says nothing.
      assert.equal(strips({ remaining: { ...live, sprints: 1, available: 158 }, calendar: sprint, table: [drivers[0], { ...drivers[1], points: 300 }] }), null)
      // Russell on 248 can at best draw level (373 to 248 with 125 left):
      // the sentence is said where the countback is Antonelli's, 9 wins to 8,
      // and not where it is Russell's, 10 to 9, or cannot be counted.
      const level = [drivers[0], { ...drivers[1], points: 248 }, ...drivers.slice(2)]
      const atLevel = (at) => strips({ remaining: { ...live, sprints: 1, available: 158 }, calendar: sprint, table: level, at })
      assert.match(atLevel(places).declined, /it has a sprint as well/)
      assert.equal(atLevel(placesOf({ ...counts, russell: { ...counts.russell, 1: 5 } })), null)
      assert.equal(strips({ remaining: { ...live, sprints: 1, available: 158, results: 16 }, calendar: sprint, table: level }), null)
    })

    it('lays each strip out inside its width, a cell a place with its symbol, and no cell at the leader’s own place', () => {
      const [wins] = strips().strips
      for (const width of [280, 320, 400, 479, 480, 640, 1200]) {
        const layout = clinchLayout({ data: wins.data, width })
        assert.equal(layout.rows.length, 5)
        assert.equal(layout.columns.length, 11)
        assert.equal(layout.columns.at(-1).text, width < 480 ? '0' : '0 pts')
        for (const row of layout.rows) {
          assert.equal(row.cells.length, 11)
          assert.equal(row.cells[0].rect, null, `the leader's place has no cell at ${width}`)
          assert.equal(row.cells[0].className, 'clinch-taken')
          for (const cell of row.cells.slice(1)) {
            assert.ok(cell.rect.x >= row.labelX && cell.rect.x + cell.rect.width <= width, `a cell outside ${width}`)
            assert.match(cell.symbol, /^M/)
          }
          assert.ok(row.labelX > 0)
        }
        // The marks reach the classes app.css colours.
        assert.deepEqual([...new Set(layout.rows[0].cells.map((c) => c.className))], ['clinch-taken', 'clinch-on', 'clinch-level', 'clinch-champion'])
      }
      assert.equal(clinchLayout({ data: [], width: 640 }), null)
    })

    it('widens the names to fit, as far as the cells allow, and cuts a name past that', () => {
      const [wins] = strips().strips
      const full = wins.data.map((d, i) => (i === 0 ? { ...d, label: 'Andrea Kimi Antonelli' } : d))
      for (const width of [400, 640]) {
        const layout = clinchLayout({ data: full, width })
        assert.equal(layout.rows[0].label, 'Andrea Kimi Antonelli', `the full name at ${width}`)
        assert.ok(layout.rows[0].labelX >= 8 + 21 * 6, `the names' column wide enough at ${width}`)
        assert.ok(layout.rows[0].cells.at(-1).rect.x + layout.rows[0].cells.at(-1).rect.width <= width)
      }
      const long = wins.data.map((d, i) => (i === 0 ? { ...d, label: 'A Name Far Too Long To Fit Beside Eleven Cells' } : d))
      const cut = clinchLayout({ data: long, width: 320 })
      assert.match(cut.rows[0].label, /…$/)
      assert.ok(cut.rows[0].cells.every((c) => !c.rect || c.rect.width >= 12))
      assert.ok(cut.rows[0].cells.at(-1).rect.x + cut.rows[0].cells.at(-1).rect.width <= 320)
      // Names that fit keep the usual column; one a little wider widens it.
      assert.equal(clinchLayout({ data: wins.data.map((d) => ({ ...d, label: 'Ace' })), width: 320 }).rows[0].labelX, 68)
      assert.equal(clinchLayout({ data: wins.data.map((d) => ({ ...d, label: 'Ace' })), width: 640 }).rows[0].labelX, 112)
    })
  })

  // LV-15. Five rounds and three run, 100, 75 and 50 left after rounds 1 to
  // 3 at 25 a driver and 43 a team. A is 80 clear after round 2 and stays so.
  describe('a title decided before the last round', () => {
    const remaining = {
      races: 2, sprints: 0, run: 3, dropped_scores: 'Every result counts', available: 50,
      win_points: 25, fastest_lap_points: 0, scale: '[25,18]', sprint_scale: null, sprint_points: 0,
    }
    const rounds = [1, 2, 3, 4, 5].map((round) => ({
      round, name_used: `Round ${round} Grand Prix`, sprint: 0, status: round <= 3 ? 'completed' : 'scheduled',
    }))
    const table = (kind, round, totals) =>
      Object.entries(totals).map(([id, points], i) => ({
        table_type: kind, after_round: round, position: i + 1, points, entity: id.toUpperCase(),
        ...(kind === 'drivers' ? { driver_id: id } : { constructor_id: id }),
      }))
    const standings = [
      ...table('drivers', 1, { a: 25, b: 18 }),
      ...table('drivers', 2, { a: 100, b: 20 }),
      ...table('drivers', 3, { a: 110, b: 30 }),
      ...table('constructors', 1, { x: 43, y: 30 }),
      ...table('constructors', 2, { x: 86, y: 60 }),
      ...table('constructors', 3, { x: 129, y: 90 }),
    ]
    const after = (kind) => standings.filter((r) => r.after_round === 3 && r.table_type === kind)
    const season = { year: 2026, drivers_champion: 'a', champion: 'Ace', constructors_champion: null }
    const args = {
      season, rounds, standings, drivers: after('drivers'), constructors: after('constructors'), remaining, afterRound: 3, year: 2026,
    }
    const title = { most: mostPerRound(remaining), rounds, standings, afterRound: 3 }

    it('finds the round: the first after which nobody could reach or equal them, every table since agreeing', () => {
      assert.equal(clinchRound(title, 'drivers', 'a'), 2)
      // 39 clear with 86 left: the team title is not decided.
      assert.equal(clinchRound(title, 'constructors', 'x'), null)
      assert.equal(clinchRound(title, 'drivers', null), null)
      assert.equal(clinchRound(title, 'drivers', 'nobody'), null)
    })

    it('declines where the tables cannot say, or where a rival could still draw level', () => {
      const gap = { ...title, standings: standings.filter((r) => r.after_round !== 3) }
      assert.equal(clinchRound(gap, 'drivers', 'a'), null)
      const twice = { ...title, standings: [...standings, { ...standings[5], points: 31 }] }
      assert.equal(clinchRound(twice, 'drivers', 'a'), null)
      // Exactly 75 clear with 75 left after round 2: the countback may have
      // settled it there, so round 3 is not asserted.
      const level = [
        ...table('drivers', 1, { a: 25, b: 18 }),
        ...table('drivers', 2, { a: 100, b: 25 }),
        ...table('drivers', 3, { a: 110, b: 30 }),
      ]
      assert.equal(clinchRound({ ...title, standings: level }, 'drivers', 'a'), null)
      // Nobody on the table, or one alone on it, is no margin to measure.
      const alone = standings.filter((r) => r.driver_id === 'a')
      assert.equal(clinchRound({ ...title, standings: alone }, 'drivers', 'a'), null)
    })

    it('says the champion first, and works out only the title still fought', () => {
      const answer = seasonAnswer(args)
      assert.equal(
        answer.who,
        "Ace is the 2026 World Champion, clinched at the Round 2 Grand Prix (round 2). Who can still win the constructors' title: X and Y.",
      )
      assert.equal(answer.drivers, null)
      assert.equal(answer.constructors.kind, 'constructors')
      assert.match(answer.basis, /86 points are still available to a team/)
      assert.doesNotMatch(answer.basis, /to a driver/)
      assert.deepEqual(reachFigures(answer, 2026, new Map()).map((f) => f.kind), ['constructors'])
    })

    it('keeps the sentence and stops at the title where the round cannot be named', () => {
      const answer = seasonAnswer({ ...args, standings: standings.filter((r) => r.after_round !== 1 && r.after_round !== 2) })
      assert.match(answer.who, /^Ace is the 2026 World Champion\. Who can still win/)
    })

    it('keeps the sentence where the arithmetic declines, and has no basis to print', () => {
      const lagging = seasonAnswer({ ...args, afterRound: 2 })
      assert.match(lagging.who, /^Ace is the 2026 World Champion, clinched at the Round 2 Grand Prix \(round 2\)\.$/)
      assert.equal(lagging.basis, null)
      assert.equal(lagging.drivers, null)
      assert.deepEqual(reachFigures(lagging, 2026, new Map()), [])
    })

    it('says both where both are on the record, and fights neither', () => {
      const both = seasonAnswer({
        ...args,
        season: { ...season, constructors_champion: 'x', constructors_champion_name: 'Xeno' },
        constructors: table('constructors', 3, { x: 129, y: 30 }),
        standings: [...standings.filter((r) => !(r.table_type === 'constructors' && r.after_round === 3)), ...table('constructors', 3, { x: 200, y: 30 })],
      })
      assert.equal(
        both.who,
        "Ace is the 2026 World Champion, clinched at the Round 2 Grand Prix (round 2). Xeno is the 2026 Constructors' Champion, clinched at the Round 3 Grand Prix (round 3).",
      )
      assert.equal(both.basis, null)
      assert.equal(both.constructors, null)
    })

    it('is exactly titleAnswer() with no title on the record, and says nothing of a season over', () => {
      const open = { ...season, drivers_champion: null, champion: null }
      const fought = titleAnswer({ ...args })
      assert.deepEqual(seasonAnswer({ ...args, season: open }), { ...fought, clinch: clinchStrips(fought, args.remaining, args.rounds) })
      assert.equal(seasonAnswer({ ...args, remaining: { ...remaining, races: 0, available: 0, run: 5 } }), null)
    })

    it("gives the champion's page the sentence and every other driver no line", () => {
      const get = (rows) => (key) => rows[key]
      const current = currentTitle(
        get({
          fightSeason: [season],
          fightFinal: [...after('drivers'), ...after('constructors')],
          fightStandings: standings,
          fightRemaining: [remaining],
          fightRounds: rounds,
        }),
      )
      assert.equal(current.next, 4)
      assert.equal(fightLine(current, 'drivers', 'a'), 'Ace is the 2026 World Champion, clinched at the Round 2 Grand Prix (round 2).')
      assert.equal(fightLine(current, 'drivers', 'b'), null)
      assert.equal(fightLine(current, 'constructors', 'x'), 'Leads the title fight by 39 with 86 left.')
    })

    it('cites the statement only where the crowned sentence is printed', () => {
      const entry = (id) => ({ id, priority: id })
      const held = { fightSources: [entry(5), entry(7)], crownedSources: [entry(2)] }
      const get = (key) => held[key]
      const title = { crowned: { drivers: { id: 'a', line: 'x' }, constructors: null } }
      const ids = (rows) => rows.map((s) => s.id)
      assert.deepEqual(ids(fightCitation(get, title, 'drivers', 'a')), [2, 5, 7])
      assert.deepEqual(ids(fightCitation(get, title, 'drivers', 'b')), [5, 7])
      assert.deepEqual(ids(fightCitation(get, title, 'constructors', 'x')), [5, 7])
      assert.deepEqual(ids(fightCitation(get, title)), [2, 5, 7], 'the whole answer, on the upcoming race')
      assert.deepEqual(ids(fightCitation(get, { crowned: undefined })), [5, 7])
    })

    // AF-137: the countback's entries are behind a line only where it counted
    // a tie back - a crowned title, or a fight with no rule held, does not.
    it('cites the countback only where the answer counted a tie back', () => {
      const entry = (id) => ({ id, priority: id })
      const held = { fightSources: [entry(5), entry(7)], fightTieSources: [entry(1), entry(7)], crownedSources: [entry(2)] }
      const get = (key) => held[key]
      const ids = (rows) => rows.map((s) => s.id)
      const rule = { counts: new Map(), depth: 10 }
      const level = { tie: rule, rows: [{ id: 'a', level: false }, { id: 'b', level: true }] }
      const none = { tie: rule, rows: [{ id: 'a', level: false }] }
      assert.deepEqual(ids(fightCitation(get, { drivers: level }, 'drivers', 'b')), [1, 5, 7])
      assert.deepEqual(ids(fightCitation(get, { drivers: level })), [1, 5, 7], 'the basis states the rule')
      assert.deepEqual(ids(fightCitation(get, { drivers: none }, 'drivers', 'a')), [5, 7], 'nobody level: the line does not reach it')
      assert.deepEqual(ids(fightCitation(get, { drivers: none })), [1, 5, 7])
      assert.deepEqual(ids(fightCitation(get, { drivers: { ...level, tie: null } })), [5, 7], 'no rule held')
      assert.deepEqual(ids(fightCitation(get, { drivers: null, crowned: { drivers: { id: 'a' } } }, 'drivers', 'a')), [2, 5, 7])
      assert.deepEqual(ids(seasonSources([entry(7)], [entry(18)], { answer: { drivers: level }, remaining: null, tie: [entry(1)] })), [1, 7, 18])
      assert.deepEqual(ids(seasonSources([entry(7)], [entry(18)], { answer: { who: 'crowned', drivers: null }, remaining: null, tie: [entry(1)] })), [7, 18])
    })

    it("names the champion on the strip while the gap stays a gap", () => {
      const strip = (held) =>
        titleStrip({
          season: { ...held }, year: 2026, running: true, run: 3, notRun: false,
          lead: { entity: 'Ace', driver_id: 'a', points: 110 }, second: { entity: 'Bo', points: 30 },
          teamLead: { entity: 'Xeno', constructor_id: 'x', points: 129 },
        }).filter(Boolean).map((t) => t.label)
      assert.deepEqual(strip({ rounds: 5, drivers_champion: null }).slice(1), ['Leads', 'Gap', "Constructors' leader"])
      assert.deepEqual(strip({ rounds: 5, drivers_champion: 'a' }).slice(1), ["Drivers' champion", 'Gap', "Constructors' leader"])
      assert.deepEqual(strip({ rounds: 5, drivers_champion: 'a', constructors_champion: 'x' }).slice(1), ["Drivers' champion", 'Gap', "Constructors' champion"])
    })
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
    // A season over, or no answer, is no line and no title.
    assert.equal(
      currentTitle(
        get({
          fightSeason: [{ year: 2026, drivers_champion: 'a', champion: 'Ace' }],
          fightFinal: drivers,
          fightStandings: standings,
          fightRemaining: [{ ...remaining, races: 0, run: 5, available: 0 }],
          fightRounds: rounds,
        }),
      ),
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

  it('lays out a leaderboard: names beside the bars from the tablet breakpoint, above them below it, and the leader clear', () => {
    const format = (v) => v.toLocaleString('en-GB')
    const data = [
      { key: 'a', label: 'Sir Lewis Hamilton', value: 106 },
      { key: 'b', label: 'Michael Schumacher', value: 91 },
      { key: 'c', label: 'Max Verstappen', value: 74 },
      { key: 'd', label: 'Damon Hill', value: 22 },
    ]
    // Every x coordinate a bar's path visits.
    const xs = (path) => [...path.matchAll(/[MLQ]\s*(-?[\d.]+)|\s(-?[\d.]+),-?[\d.]+\s+L/g)].map((m) => Number(m[1] ?? m[2]))
    for (const width of [288, 340, 400, 560, 720]) {
      const beside = barLayout({ data, width, stacked: false, format })
      const above = barLayout({ data, width, stacked: true, format })
      for (const layout of [beside, above]) {
        for (const bar of layout.bars) {
          // The bar runs from its start to its tip, and its value, with the
          // margin after the leader's, stays inside the plot.
          assert.equal(Math.min(...xs(bar.path)), layout.stacked ? 0 : BAR_LABEL_WIDTH)
          assert.equal(Math.max(...xs(bar.path)), bar.tip)
          assert.ok(bar.valueX + textRoom(bar, format) <= width, `${bar.d.label}'s figures fit at ${width}`)
          if (layout.stacked) {
            assert.equal(bar.labelAnchor, 'start')
            assert.equal(bar.labelX, 0)
            assert.ok(bar.labelY + 8 <= bar.y, `the name sits above its bar at ${width}`)
            assert.ok(bar.labelY - 8 >= bar.rowTop, `and inside its own row at ${width}`)
          } else {
            assert.equal(bar.labelAnchor, 'end')
            assert.equal(bar.labelX, BAR_LABEL_WIDTH - 10)
            assert.equal(bar.labelY, bar.middle)
          }
        }
        // The bars keep their order of length.
        const tips = layout.bars.map((bar) => bar.tip)
        assert.deepEqual([...tips].sort((p, q) => q - p), tips)
        assert.deepEqual(layout.bars.slice(1).map((bar) => bar.margin), [null, null, null])
      }
      // The leader says how far clear it is wherever that costs the bars at
      // most a quarter of their length: at every width here with the names
      // above (though a 250 px plot of long values can drop it), and beside
      // them only with room to spare - not in half of .split at 768.
      assert.equal(above.bars[0].margin, '15 clear')
      assert.equal(beside.bars[0].margin, width >= 560 ? '15 clear' : null, `the margin beside the names at ${width}`)
      // The point of stacking: with no name column the longest bar is longer.
      const length = (layout) => layout.bars[0].tip - Math.min(...xs(layout.bars[0].path))
      assert.ok(length(above) > length(beside), `the stacked bar is the longer at ${width}`)
    }
    // A tie at the top leads nobody, and every bar level with it says nothing.
    const tied = [
      { key: 'a', value: 25 },
      { key: 'b', value: 25 },
      { key: 'c', value: 24 },
    ]
    assert.equal(barMargin(tied, format), null)
    assert.deepEqual(barLayout({ data: tied, width: 400, stacked: true, format }).bars.map((bar) => bar.margin), [null, null, null])
    // The margin is to the next value down, not the next row; one bar, or
    // every bar level, has nothing to be clear of.
    assert.deepEqual(barMargin([{ key: 'b', value: 3 }, { key: 'a', value: 10 }, { key: 'c', value: 7 }], format), { key: 'a', text: '3 clear' })
    assert.equal(barMargin([{ key: 'a', value: 4 }], format), null)
    assert.equal(barMargin([{ key: 'a', value: 4 }, { key: 'b', value: 4 }], format), null)
    assert.equal(barLayout({ data: [], width: 400, stacked: true, format }), null)
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
    assert.equal(by(SEASONS_COLUMNS).rounds.text(23, { running: 1, undecided: 1, run: 13 }), '13 of 23')
    assert.equal(by(SEASONS_COLUMNS).rounds.text(24, { running: 0, undecided: 0, run: 24 }), '24')
    // LV-15: a title settled with rounds to run. The champion loses the mark,
    // the count of rounds and second place keep theirs, and the constructors'
    // title, a column of its own, is judged on its own.
    const settled = { running: 1, undecided: 0, team_undecided: 1, run: 19 }
    assert.equal(by(SEASONS_COLUMNS).rounds.text(23, settled), '19 of 23')
    assert.equal(by(SEASONS_COLUMNS).champion.text('Antonelli', settled), 'Antonelli')
    assert.equal(by(SEASONS_COLUMNS).runner_up.text('Verstappen', settled), 'Verstappen so far')
    assert.equal(by(SEASONS_COLUMNS).runner_up.text(null, settled), EMPTY)
    assert.equal(by(SEASONS_COLUMNS).runner_up.text('Hunt', { running: 0, undecided: 0 }), 'Hunt')
    assert.equal(by(SEASONS_COLUMNS).runner_up.text('Russell', { running: 1, undecided: 1 }), 'Russell')
    assert.equal(by(SEASONS_COLUMNS).constructors_champion.text('Mercedes', settled), 'Mercedes so far')
    assert.equal(by(SEASONS_COLUMNS).constructors_champion.text('Mercedes', { ...settled, team_undecided: 0 }), 'Mercedes')
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

  // CR-33: one list of the trace's fields, which the app's <Fields> and the
  // static page's fields() both print.
  it('states a trace in one list of fields for both renderers', () => {
    const row = { osm_relation: 148194, layout_key: null, measured_km: 3.3885, published_km: 3.337, delta_pct: 1.54, node_count: 464, closes: 0, loose_ends: 1 }
    const fields = (geometry, direction) => traceFields(geometry, direction).map(({ label, value, href }) => [label, value, href ?? null])
    assert.deepEqual(fields(row, 'clockwise'), [
      ['OpenStreetMap relation', '148194', 'https://www.openstreetmap.org/relation/148194'],
      ['Measured', '3.389 km against 3.337 km published here (+1.54%)', null],
      ['Points', '464', null],
      ['The walk', 'does not close \u2014 1 loose way end, so the length above is the ways added up rather than a lap walked round', null],
      ['Raced', 'clockwise', null],
    ])
    // A layout named is a field; no direction is no field; no verdict on the
    // walk, and no node count, are not established rather than a lap or 0.
    const unsettled = fields({ ...row, layout_key: 'current', closes: null, node_count: null }, null)
    assert.deepEqual(unsettled.map(([label]) => label), ['OpenStreetMap relation', 'Layout traced', 'Measured', 'Points', 'The walk'])
    assert.equal(unsettled[1][1], 'current')
    assert.equal(unsettled[3][1], EMPTY)
    assert.equal(unsettled[4][1], null)
    assert.equal(fields({ ...row, closes: 1 }, null)[3][1], 'closes into one lap')
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

  it("opens a record's page on its number, and a run of races on its sentence and its runs (VD-112)", () => {
    const wins = { key: 'most-wins', value: '106', value_num: 106, unit: 'wins', holder: 'Sir Lewis Hamilton', holder_table: 'drivers', holder_id: 'hamilton' }
    assert.deepEqual(recordLead(wins), {
      figure: '106',
      whole: null,
      lines: [[{ text: 'wins' }], [{ text: 'Held by ' }, { text: 'Sir Lewis Hamilton', href: 'drivers/hamilton' }]],
      runs: null,
    })
    // A value with no number to lead with is set whole; a shared holder is text.
    const whole = recordLead({ ...wins, value: 'Monaco', value_num: null, holder_id: null })
    assert.equal(whole.figure, null)
    assert.equal(whole.whole, 'Monaco')
    assert.deepEqual(whole.lines, [[{ text: 'Held by ' }, { text: 'Sir Lewis Hamilton', href: null }]])

    const run = (holder_id, length, first_n, from, to, ongoing = 0) => ({
      holder_id, holder: holder_id.toUpperCase(), length, first_n, ongoing,
      from_year: Number(from[0].slice(0, 4)), from_date: from[0], from_name: from[1],
      to_year: Number(to[0].slice(0, 4)), to_date: to[0], to_name: to[1],
    })
    const races = (r) => Array.from({ length: r.length }, (_, i) => ({ holder_id: r.holder_id, first_n: r.first_n, year: r.from_year, round: i + 1, name_used: 'X Grand Prix', outline: null }))
    const streak = { ...wins, key: 'most-consecutive-wins', value: '3, 2023 A Grand Prix to 2023 B Grand Prix', value_num: 3 }
    const rows = [
      run('a', 3, 10, ['2023-05-07', 'A Grand Prix'], ['2023-09-03', 'B Grand Prix']),
      run('b', 2, 1, ['2012-11-01', 'C Grand Prix'], ['2013-03-01', 'D Grand Prix']),
      run('c', 2, 5, ['2014-01-01', 'E Grand Prix'], ['2014-02-01', 'F Grand Prix']),
      run('d', 1, 7, ['2015-01-01', 'G Grand Prix'], ['2015-01-01', 'G Grand Prix']),
    ]
    const lead = recordLead(streak, rows, rows.flatMap(races))
    assert.equal(lead.figure, '3')
    assert.deepEqual(lead.lines, [[{ text: 'A', href: 'drivers/a' }, { text: ' won three Grands Prix in a row in 2023, from the A Grand Prix in May to the B Grand Prix in September.' }]])
    assert.equal(lead.runs.top.length, 1)
    assert.equal(lead.runs.top[0].races.length, 3)
    // Five runs and on through a tie at the fifth: four rows here, all drawn,
    // the record's alone marked, each its share of the longest.
    assert.deepEqual(lead.runs.longest.map((r) => [r.figure, r.mark, r.share, r.years, r.ends]), [
      ['3', true, 1, '2023', 'A to B'],
      ['2', false, 0.6667, '2012–2013', 'C to D'],
      ['2', false, 0.6667, '2014', 'E to F'],
      ['1', false, 0.3333, '2015', 'G'],
    ])
    // The page's count not bearing out the record's figure draws no run.
    assert.equal(recordLead({ ...streak, value_num: 4 }, rows, rows.flatMap(races)).runs, null)
    assert.deepEqual(recordLead({ ...streak, value_num: 4 }, rows, rows.flatMap(races)).lines.at(-1)[0], { text: 'Held by ' })
    // Nor does a record STREAKS does not name, or one whose races are short.
    assert.equal(recordLead({ ...streak, key: 'most-wins' }, rows, rows.flatMap(races)).runs, null)
    assert.equal(recordLead(streak, rows, races(rows[0]).slice(1)).runs, null)

    // Over a winter each end names its year; an Indianapolis 500 in the run
    // makes it championship races; a run to the latest race says so.
    assert.equal(
      runSentence(rows[1], 'won'),
      ' won two Grands Prix in a row, from the C Grand Prix in November 2012 to the D Grand Prix in March 2013.',
    )
    assert.equal(
      runSentence({ ...rows[2], to_name: 'Indianapolis 500' }, 'won'),
      ' won two championship races in a row in 2014, from the E Grand Prix in January to the Indianapolis 500 in February.',
    )
    assert.equal(
      runSentence({ ...rows[0], ongoing: true }, 'won'),
      ' has won three Grands Prix in a row in 2023, from the A Grand Prix in May to the B Grand Prix in September, the latest race the database holds.',
    )
  })

  it("sets a record card's number apart from the rest of its value (VD-111)", () => {
    const card = (value, value_num, unit) => cardFigure({ value, value_num, unit })
    assert.deepEqual(card('106', 106, 'wins'), { figure: '106', qualifier: 'wins', counts: true })
    assert.deepEqual(card('7 each', 7, 'titles'), { figure: '7', qualifier: 'titles each', counts: true })
    assert.deepEqual(card('19 of the 22 races in 2023', 19, 'wins'), { figure: '19', qualifier: 'wins of the 22 races in 2023', counts: true })
    // A comma after the figure is the sentence's, not a thousands separator.
    assert.deepEqual(card('10, 2023 Miami Grand Prix to 2023 Italian Grand Prix', 10, 'wins'), {
      figure: '10',
      qualifier: 'wins, 2023 Miami Grand Prix to 2023 Italian Grand Prix',
      counts: true,
    })
    assert.deepEqual(card('3,723.5', 3723.5, 'points'), { figure: '3,723.5', qualifier: 'points', counts: true })
    // A value that names its own unit is not given it twice.
    assert.deepEqual(card('1,234 points', 1234, 'points'), { figure: '1,234', qualifier: 'points', counts: true })
    // Nor is one whose own word says what it counts (PR #1367 review).
    assert.deepEqual(card('6 starters', 6, 'cars'), { figure: '6', qualifier: 'starters', counts: true })
    assert.deepEqual(card('0.002 s each', 0.002, 'seconds'), { figure: '0.002', qualifier: 's each', counts: true })
    assert.deepEqual(card('5 each', 5, 'races'), { figure: '5', qualifier: 'races each', counts: true })
    // A phrase after a comma is about the figure, which keeps its unit.
    assert.deepEqual(card('84, with Mercedes', 84, 'wins'), { figure: '84', qualifier: 'wins, with Mercedes', counts: true })
    assert.deepEqual(card('9, British Grand Prix', 9, 'wins'), { figure: '9', qualifier: 'wins, British Grand Prix', counts: true })
    assert.deepEqual(card('191, before the 2020 Sakhir Grand Prix', 191, 'entries'), {
      figure: '191',
      qualifier: 'entries, before the 2020 Sakhir Grand Prix',
      counts: true,
    })
    // An age is held in days and written in years: the figure is the
    // value's, and its own words say what it counts, not value_num's unit.
    assert.deepEqual(card('18 years, 228 days, 2016 Spanish Grand Prix', 6802, 'days'), {
      figure: '18',
      qualifier: 'years, 228 days, 2016 Spanish Grand Prix',
      counts: false,
    })
    // No number to lead with, or nothing beside one that is not value_num.
    assert.equal(card('Ferrari', 1, 'titles'), null)
    assert.equal(card('1958', 1, 'points'), null)
    assert.equal(card('40.63%', 40.63, 'per cent'), null)
  })

  it("draws a record card's holder and the next two from its derivation, with the margin (VD-111)", () => {
    const record = (over) => ({
      record: 'Most Grand Prix wins',
      holder: 'Sir Lewis Hamilton',
      holder_id: 'hamilton',
      value: '106',
      value_num: 106,
      unit: 'wins',
      detail: 'drivers.wins. Next: Michael Schumacher on 91, Max Verstappen on 74, Sebastian Vettel on 53.',
      ...over,
    })
    const read = (c) => c.bars.map((b) => `${b.label} ${b.figure}${b.holder ? '*' : ''}`)
    const wins = cardComparator(record())
    assert.deepEqual(read(wins), ['Sir Lewis Hamilton 106*', 'Michael Schumacher 91', 'Max Verstappen 74'])
    assert.deepEqual(wins.bars.map((b) => b.share), [1, 0.8585, 0.6981])
    assert.equal(wins.margin, '15 clear of Michael Schumacher')
    assert.equal(wins.label, 'Most Grand Prix wins: Sir Lewis Hamilton 106, Michael Schumacher 91, Max Verstappen 74')

    // A shared record draws a bar for each holder, both marked, and says who
    // is next; a suffixed name is one name.
    const shared = cardComparator(
      record({
        holder: 'Michael Schumacher, Kurt Ahrens, Jr.',
        holder_id: null,
        value: '7 each',
        value_num: 7,
        detail: 'Next: Juan Manuel Fangio on 5, Alain Prost on 4, Max Verstappen on 4.',
      }),
    )
    assert.deepEqual(read(shared), ['Michael Schumacher 7*', 'Kurt Ahrens, Jr. 7*', 'Juan Manuel Fangio 5'])
    assert.equal(shared.margin, 'Shared; Juan Manuel Fangio next on 5')

    // A season's form: the holder's bar carries its season as the runners'
    // do, from the derivation, and a tie at the third bar is drawn whole.
    const seasons = {
      value: '19 of the 22 races in 2023',
      value_num: 19,
      holder: 'Max Verstappen',
      detail: 'Per season. Max Verstappen, 2023: 19 of 22. Next: Max Verstappen 15 (2022), Michael Schumacher 13 (2004), Sebastian Vettel 13 (2013).',
    }
    const season = cardComparator(record(seasons))
    assert.deepEqual(read(season), ['Max Verstappen 2023 19*', 'Max Verstappen 2022 15', 'Michael Schumacher 2004 13', 'Sebastian Vettel 2013 13'])
    assert.equal(season.margin, '4 clear of Max Verstappen 2022')
    // Or from the one year the value gives, where the derivation does not
    // say; a shared record held twice by one driver draws both seasons.
    assert.deepEqual(read(cardComparator(record({ ...seasons, value: '575, 2023', value_num: 575, detail: 'Nominal. Next: Max Verstappen 454 (2022).' }))), [
      'Max Verstappen 2023 575*',
      'Max Verstappen 2022 454',
    ])
    assert.deepEqual(
      read(
        cardComparator(
          record({
            holder: 'Michael Schumacher, Kimi Raikkonen',
            holder_id: null,
            value: '10 each',
            value_num: 10,
            detail: 'Michael Schumacher, 2004: 10 of 18; Kimi Raikkonen, 2005: 10 of 19; Kimi Raikkonen, 2008: 10 of 18. Next: Mika Hakkinen 9 (2000).',
          }),
        ),
      ),
      // Three holdings fill the three bars; the margin still names the next.
      ['Michael Schumacher 2004 10*', 'Kimi Raikkonen 2005 10*', 'Kimi Raikkonen 2008 10*'],
    )
    // A holder whose season cannot be found draws no bars, not a driver
    // among seasons.
    assert.equal(cardComparator(record({ ...seasons, value: '19', detail: 'Per season. Next: Max Verstappen 15 (2022).' })), null)
    // A margin to two level runners names both.
    assert.equal(cardComparator(record({ detail: 'Next: A on 91, B on 91, C on 74.' })).margin, '15 clear of A and B')
    assert.equal(cardComparator(record({ value: '3,723.5', value_num: 3723.5, detail: 'Next: A on 3098.' })).margin, '625.5 clear of A')

    // No comparator rather than a guessed one: no list, a list in another
    // form or with an item that fits neither, an age, or nothing to scale.
    assert.equal(cardComparator(record({ detail: 'Every completed championship race in date order.' })), null)
    assert.equal(cardComparator(record({ detail: 'Next: Michael Schumacher 21 years, 92 days, Kimi Raikkonen 20 years, 283 days.' })), null)
    assert.equal(cardComparator(record({ detail: 'Next: A on 91, B with Ferrari 72.' })), null)
    assert.equal(cardComparator(record({ detail: 'Next: A on 91. And a sentence after it.' })), null)
    assert.equal(cardComparator(record({ detail: 'Next: A on 5. B on 3.' })), null)
    assert.equal(cardComparator(record({ detail: 'Next: A 15 (2022). B 13 (2004).' })), null)
    assert.equal(cardComparator(record({ value: '18 years, 228 days', value_num: 6802, unit: 'days', detail: 'Next: A on 6900.' })), null)
    assert.equal(cardComparator(record({ value: '0', value_num: 0, detail: 'Next: A on 0.' })), null)
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


describe('a constructor ribbon draws every season from 2010 in its own scheme (VD-115)', () => {
  const seasons = (from, to) => Array.from({ length: to - from + 1 }, (_, i) => from + i)
  const mclaren = liveryRibbon({ id: 'mclaren', name: 'McLaren', last_entry: null }, seasons(1966, 2026))

  it('a plate a season raced from 2010, each in the scheme liveryFor gives it', () => {
    assert.equal(mclaren.plates.length, 17)
    for (const plate of mclaren.plates)
      assert.deepEqual(plate.scheme, liveryFor('mclaren', plate.year).scheme.map((c) => c.base), `${plate.year}`)
    assert.equal(mclaren.plates[0].title, '2010: Chrome')
    assert.equal(mclaren.label, 'What McLaren raced in, season by season since 2010')
  })

  it('runs of one name, the year at each change and at the end, the last run open while the team races', () => {
    assert.deepEqual(
      mclaren.runs.map((r) => [r.name, r.start, r.end, r.years]),
      [
        ['Chrome', 1, 6, '2010–14'],
        ['Graphite grey', 6, 8, '2015–16'],
        ['Tarocco orange', 8, 9, '2017'],
        ['Papaya', 9, 18, '2018–'],
      ],
    )
    assert.equal(mclaren.runs[3].bracket, 'Papaya, 2018–')
    assert.equal(mclaren.ticks.map((t) => t.tick).filter(Boolean).join(' '), '’10 ’15 ’17 ’18 ’26')
    assert.deepEqual(mclaren.ticks.filter((t) => t.edge).map((t) => t.year), [2010, 2026])
    assert.equal(mclaren.list, 'Chrome 2010–14 · Graphite grey 2015–16 · Tarocco orange 2017 · Papaya 2018–')
    assert.equal(
      mclaren.aria,
      'McLaren\u2019s livery by season: Chrome 2010 to 2014, Graphite grey 2015 and 2016, Tarocco orange 2017, Papaya from 2018',
    )
  })

  it('names the runs under brackets only where every word fits its bracket', () => {
    // A season-long run of a two-word name cannot sit under one 23 px plate.
    assert.equal(mclaren.fits, false)
    const renault = liveryRibbon({ id: 'renault', name: 'Renault', last_entry: 2020 }, [...seasons(2002, 2011), ...seasons(2016, 2020)])
    assert.equal(renault.fits, true)
    // A gap in the seasons raced ends a run, and a team that has stopped has no open run.
    assert.deepEqual(
      renault.runs.map((r) => [r.start, r.end, r.years]),
      [
        [1, 2, '2010'],
        [2, 3, '2011'],
        [3, 8, '2016–20'],
      ],
    )
    assert.equal(renault.ticks.map((t) => t.tick).join(' '), '’10 ’11 ’16    ’20')
    const audi = liveryRibbon({ id: 'audi', name: 'Audi', last_entry: null }, [2026])
    assert.equal(audi.fits, true)
    assert.deepEqual(audi.ticks, [{ year: 2026, tick: '’26', edge: true }])
  })

  it('no ribbon before 2010 or for a team with no livery here; a season with none is an empty plate, never a colour', () => {
    assert.equal(liveryRibbon({ id: 'brabham', name: 'Brabham', last_entry: 1992 }, seasons(1962, 1992)), null)
    assert.equal(liveryRibbon({ id: 'nobody', name: 'Nobody', last_entry: null }, [2024, 2025]), null)
    const missing = liveryRibbon({ id: 'mclaren', name: 'McLaren', last_entry: 2027 }, [2026, 2027])
    assert.deepEqual(missing.plates[1], { year: 2027, title: '2027: Not established', scheme: [] })
    assert.equal(missing.list, 'Papaya 2026 · Not established 2027')
  })

  it('credits every page each plate was read from, says whose word each name is, and names a colour this site chose', () => {
    const text = (note) => note.map((part) => (typeof part === 'string' ? part : part.text)).join('')
    const links = mclaren.note.filter((part) => typeof part !== 'string').map((part) => part.href)
    const drawn = new Set(mclaren.plates.map((p) => liveryFor('mclaren', p.year)))
    for (const livery of drawn)
      for (const url of livery.source)
        if (/wikipedia\.org/.test(url)) assert.ok(links.includes(url), `${url} is linked`)
        else assert.ok(text(mclaren.note).includes(new URL(url).hostname.replace(/^www\./, '')), `${url} is named`)
    assert.ok(links.includes('https://creativecommons.org/licenses/by-sa/4.0/'), 'with the licence')
    assert.match(text(mclaren.note), /Tarocco orange and Papaya are the team's own names, the rest the sources' description\./)
    assert.match(text(mclaren.note), /Before 2010 this site has no sourced livery to draw\./)
    const tr = liveryRibbon({ id: 'toro-rosso', name: 'Toro Rosso', last_entry: 2019 }, seasons(2006, 2019))
    assert.match(text(tr.note), /The plates for 2010–16 also carry red and silver, which no page cited here states/)
    const aston = liveryRibbon({ id: 'aston-martin', name: 'Aston Martin', last_entry: null }, seasons(2021, 2026))
    assert.match(text(aston.note), /each name is the team's own\./)
    assert.doesNotMatch(text(aston.note), /Before 2010/)
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
      ['layout_key', 'poles', 'wins', 'podiums', 'fastest_laps', 'poles', 'wins', 'podiums'],
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
  // `faceFold`: the team-mates face-off's disclosure (VD-130), or null.
  const stand = (pathname, tables, run, faceFold = null) => {
    const hadDocument = 'document' in globalThis
    const hadLocation = 'location' in globalThis
    const document = globalThis.document
    const location = globalThis.location
    globalThis.document = {
      getElementById: (id) =>
        id === 'prerendered'
          ? { querySelectorAll: () => tables, querySelector: (selector) => (selector === 'details.face-fold' ? faceFold : null) }
          : null,
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

  // VD-130: the face-off's disclosure, opened while the database arrived.
  it('remembers the face-off disclosure the reader opened, on that route only', () => {
    const fold = { open: false }
    stand('/drivers/brabham', [fakeTable('Team-mates', 241)], () => {
      captureStaticTables()
      captureOpenFolds()
      assert.equal(staticFaceFoldOpen(), false, 'written closed')
      fold.open = true
      captureOpenFolds()
      assert.equal(staticFaceFoldOpen(), true)
      assert.equal(staticOpen('Team-mates'), false, "the table's own fold is another thing")
      globalThis.location = { pathname: '/drivers/fangio' }
      assert.equal(staticFaceFoldOpen(), false)
    }, fold)
    stand('/drivers/norris', [fakeTable('Team-mates', 12)], () => {
      captureStaticTables()
      captureOpenFolds()
      assert.equal(staticFaceFoldOpen(), false, 'a page with no disclosure')
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
    { entity: 'Lando Norris', driver_id: 'norris', points: 312, constructor_id: 'mclaren', constructor: 'McLaren', constructor_country: 'United Kingdom' },
    { entity: 'Oscar Piastri', driver_id: 'piastri', points: 288, constructor_id: 'mclaren', constructor: 'McLaren', constructor_country: 'United Kingdom' },
  ]
  const running = { year: 2026, rounds: 23, run: 14, seats: 20, teams: 10, champion: null }
  // currentTitle()'s answer once both titles are on the record with rounds
  // to run (LV-15): the drivers' at round 19, the constructors' at 20.
  const rounds = [19, 20, 21].map((round) => ({ round, name_used: `Round ${round} Grand Prix` }))
  const crownedTitle = {
    year: 2026,
    who: 'Lando Norris is the 2026 World Champion, clinched at the Round 19 Grand Prix (round 19). McLaren is the 2026 Constructors\u2019 Champion.',
    fought: null,
    rounds,
    crowned: {
      drivers: { id: 'norris', name: 'Lando Norris', round: 19, line: 'Lando Norris is the 2026 World Champion, clinched at the Round 19 Grand Prix (round 19).' },
      constructors: { id: 'mclaren', name: 'McLaren', round: 20, line: "McLaren is the 2026 Constructors' Champion, clinched at the Round 20 Grand Prix (round 20)." },
    },
  }

  it('names a season with no round run as a calendar, with no plate and nobody as leading it', () => {
    const notRun = { year: 2027, rounds: 24, run: 0, seats: 0, teams: 0, champion: null }
    assert.equal(homePlate({ now: notRun, lead: [], title: null }), null)
    const strip = seasonStrip(notRun, null)
    assert.deepEqual(
      strip.map((t) => t.label),
      ['Rounds run', 'On the grid'],
    )
    assert.equal(strip[0].value, NOT_YET_RUN)
    assert.equal(strip[0].note, '24 on the calendar')
    assert.equal(strip[0].lead, true, 'with no plate the rounds tile is the hero again')
  })

  it('opens on the leader while the championship is open: the margin, the runner-up and the rounds (VD-109)', () => {
    const plate = homePlate({ now: running, lead, title: null })
    assert.equal(plate.label, 'Leading the 2026 championship')
    assert.equal(plate.name, 'Lando Norris')
    assert.equal(plate.href, 'drivers/norris')
    assert.equal(plate.team, 'McLaren')
    assert.equal(plate.teamHref, 'constructors/mclaren')
    assert.equal(plate.margin, '24')
    assert.equal(plate.sentence, 'points clear of Oscar Piastri after 14 of 23 rounds.')
    assert.ok(plate.colour, "in the team's colour for the season")
    assert.deepEqual(plate.said, [])
    // The plate states the rounds and the leader, so the strip under it is
    // who is in the cars alone, and the margin is the page's one hero.
    assert.deepEqual(seasonStrip(running, plate).map((t) => [t.label, Boolean(t.lead)]), [['On the grid', false]])
  })

  it('calls the leader the champion only once the record names that driver', () => {
    assert.equal(homePlate({ now: { ...running, champion: 'norris' }, lead, title: null }).label, '2026 World Champion')
    assert.equal(homePlate({ now: { ...running, champion: 'piastri' }, lead, title: null }).label, 'Leading the 2026 championship')
    const done = homePlate({ now: { ...running, run: 23, champion: 'norris' }, lead, title: null })
    assert.equal(done.sentence, 'points clear of Oscar Piastri after all 23 rounds.')
  })

  it('says where each title on the record was settled, and the next race says neither again', () => {
    const plate = homePlate({ now: { ...running, run: 20, champion: 'norris' }, lead, title: crownedTitle })
    assert.equal(
      plate.sentence,
      "points clear of Oscar Piastri after 20 of 23 rounds. The title was settled at the Round 19 Grand Prix, round 19. McLaren took the constructors' title at the Round 20 Grand Prix, round 20.",
    )
    assert.deepEqual(plate.said, ['drivers', 'constructors'])
    const next = { year: 2026, round: 21 }
    assert.equal(homeAhead(crownedTitle, next, plate.said), null, 'nothing is left to say under the next race')
    // Without the plate's word for a title, the next race keeps its line.
    assert.equal(homeAhead(crownedTitle, next, ['drivers']), crownedTitle.crowned.constructors.line)
    // A title still fought stays under the next race, after what is unsaid.
    const half = { ...crownedTitle, crowned: { drivers: null, constructors: crownedTitle.crowned.constructors }, fought: 'Norris leads by 24.' }
    assert.equal(homeAhead(half, next, ['constructors']), 'Norris leads by 24.')
    assert.equal(homeAhead({ year: 2026, who: 'Norris leads by 24.', crowned: null }, next, []), 'Norris leads by 24.')
    assert.equal(homeAhead(crownedTitle, { year: 2027, round: 1 }, []), null, "another season's race says nothing of this one")
    // A title clinchRound() could not place stops at the title.
    const placeless = { ...crownedTitle, crowned: { drivers: { ...crownedTitle.crowned.drivers, round: null }, constructors: { ...crownedTitle.crowned.constructors, round: null } } }
    assert.equal(
      homePlate({ now: { ...running, run: 20, champion: 'norris' }, lead, title: placeless }).sentence,
      "points clear of Oscar Piastri after 20 of 23 rounds. McLaren took the constructors' title.",
    )
  })

  it('never says a leader is 0 clear, and prints no margin it cannot count', () => {
    const level = homePlate({ now: running, lead: [lead[0], { ...lead[1], points: 312 }], title: null })
    assert.equal(level.margin, null)
    assert.equal(level.sentence, 'Level on points with Oscar Piastri after 14 of 23 rounds.')
    // A plate with no margin has no hero, so the rounds tile keeps the role.
    assert.deepEqual(seasonStrip(running, level).map((t) => [t.label, t.value, Boolean(t.lead)]), [['Rounds run', '14 of 23', true], ['On the grid', '20', false]])
    const one = homePlate({ now: running, lead: [lead[0], { ...lead[1], points: 311 }], title: null })
    assert.equal(one.sentence, 'point clear of Oscar Piastri after 14 of 23 rounds.')
    // A total nobody established is not a zero, and a lone row has no gap.
    for (const unknown of [[lead[0], { ...lead[1], points: null }], [{ ...lead[0], points: null }, lead[1]], [lead[0]]]) {
      const plate = homePlate({ now: running, lead: unknown, title: null })
      assert.equal(plate.margin, null)
      assert.equal(plate.sentence, null)
      assert.equal(plate.name, 'Lando Norris')
      assert.equal(seasonStrip(running, plate)[0].value, '14 of 23', 'and the strip still says how far the season has run')
    }
    // A leader with no team on record is drawn in ink and named alone.
    const bare = homePlate({ now: running, lead: [{ ...lead[0], constructor_id: null, constructor: null }, lead[1]], title: null })
    assert.equal(bare.colour, null)
    assert.equal(bare.team, null)
    assert.equal(bare.teamHref, null)
  })

  it('has no plate and no strip at all without a current season', () => {
    assert.equal(homePlate({ now: null, lead, title: null }), null)
    assert.deepEqual(seasonStrip(null, null), [])
    assert.deepEqual(seasonStrip(undefined, undefined), [])
  })

  it('says what the database holds in one line, each count from the shape (VD-109)', () => {
    const shape = { races_run: 1169, from_year: 1950, entries: 27636, qualifying: 27149, standings: 34771, pit_stops: 22746, pit_stops_from: 1994, images: 711 }
    assert.deepEqual(
      dbLine(shape).map((p) => `${p.value} ${p.words}`),
      ['1,169 races run since 1950', '27,636 entries', '27,149 qualifying rows', '34,771 standings rows', '22,746 pit stops since 1994', '711 photographs of cars'],
    )
    const bare = dbLine({ ...shape, from_year: null, pit_stops_from: null })
    assert.equal(bare[0].words, 'races run', 'a year nobody holds drops the clause')
    assert.equal(bare[4].words, 'pit stops')
  })

  it("stands the last race's podium with where each driver started (VD-109)", () => {
    const row = (position, driver_id, grid, pole = 0, grid_text = String(grid)) => ({ position, driver_id, driver: driver_id, constructor_id: 'mclaren', constructor: 'McLaren', constructor_country: null, year: 2026, grid, grid_text, pole })
    const steps = lastPodium([row(1, 'norris', 1, 1), row(2, 'verstappen', 21), { ...row(3, 'hadjar', null, 0, 'PL') }])
    assert.deepEqual(steps.map((s) => s.start), ['from pole', 'from 21st', 'from the pit lane'])
    assert.equal(lastPodium([row(1, 'norris', 1, 1), row(2, 'verstappen', 21)]), null, 'a missing place is no podium')
    assert.equal(lastPodium(undefined), null)
  })

  it("shows the winner's race time and the others' gaps, and none where they are not to the winner (AF-157)", () => {
    const row = (position, time, gap) => ({ position, driver_id: `d${position}`, driver: `D${position}`, constructor_id: 'mclaren', constructor: 'McLaren', year: 2026, time, gap })
    const times = (rows) => lastPodium(rows).map((s) => s.time)
    assert.deepEqual(times([row(1, '1:31:44.742', null), row(2, '1:31:45.915', '+1.173'), row(3, null, '+1 lap')]), ['1:31:44.742', '+1.173', '+1 lap'])
    assert.deepEqual(times([row(1, '1:31:44.742', null), row(2, null, null), row(3, null, '+1 lap')]), ['1:31:44.742', '—', '+1 lap'], 'a step with none beside one that has one is the em dash')
    assert.deepEqual(times([row(1, null, null), row(2, null, null), row(3, null, null)]), [null, null, null], 'no step has one: no line')
    assert.deepEqual(times([row(1, '1:19:57.566', '+0.526'), row(2, '1:19:58.213', '+1.173'), row(3, '1:20:05.589', '+8.549')]), [null, null, null], 'a winner with a gap: the gaps are not to the winner')
    assert.deepEqual(lastPodium([row(1, '1:31:44.742', null), row(2, null, '+1.173'), row(3, null, '+1 lap')]).map((s) => s.timeSaid), ['race time', 'gap to the winner', 'gap to the winner'], 'each figure says what it is')
    assert.deepEqual(lastPodium([row(1, null, null), row(2, null, null), row(3, null, null)]).map((s) => s.timeSaid), [null, null, null])
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

describe("the home page's season cycle (AF-135), on fixed clocks", () => {
  const now = { year: 2026, rounds: 23, run: 19 }
  const latest = { year: 2026, round: 19, name_used: 'Mexico City Grand Prix', date_iso: '2026-11-01' }
  const next = { year: 2026, round: 20, name_used: 'Sao Paulo Grand Prix', date_iso: '2026-11-08' }
  const sessions = [
    { kind: 'fp1', name: 'Practice 1', start_utc: '2026-11-06T15:30Z', zone: 'America/Sao_Paulo' },
    { kind: 'qualifying', name: 'Qualifying', start_utc: '2026-11-07T18:00Z', zone: 'America/Sao_Paulo' },
    { kind: 'race', name: 'Race', start_utc: '2026-11-08T17:00Z', zone: 'America/Sao_Paulo' },
  ]
  const at = (iso) => Date.parse(iso)
  const state = (clock, over = {}) => homeCycle({ now, latest, next, sessions, ...over }, at(clock))

  it('leads with the podium from the result until the end of the third day after the race', () => {
    assert.equal(RESULTS_DAYS, 3)
    assert.deepEqual(state('2026-11-02T08:00Z'), { state: CYCLE.results, run: false })
    // Both edges: the last instant of the third day, and the first of the fourth.
    assert.equal(state('2026-11-04T23:59Z').state, CYCLE.results)
    assert.equal(state('2026-11-05T00:00Z').state, CYCLE.preview)
  })

  it('previews the next round until its first session, and opens the weekend on it', () => {
    assert.equal(state('2026-11-06T15:29Z').state, CYCLE.preview)
    assert.deepEqual(state('2026-11-06T15:30Z'), { state: CYCLE.weekend, run: false })
    assert.deepEqual(state('2026-11-08T19:59Z'), { state: CYCLE.weekend, run: false })
  })

  it('says the race has been run once its three hours are over, and never shows it as still to come', () => {
    assert.deepEqual(state('2026-11-08T20:00Z'), { state: CYCLE.weekend, run: true })
    assert.deepEqual(state('2026-11-12T00:00Z'), { state: CYCLE.weekend, run: true })
  })

  it('opens the weekend on a back-to-back round before the last podium has had its three days', () => {
    const close = [{ ...sessions[0], start_utc: '2026-11-03T15:30Z' }]
    assert.equal(state('2026-11-03T15:30Z', { sessions: close }).state, CYCLE.weekend)
  })

  it('opens a weekend with no timetable on its first day, and falls back on the race page rule for the race', () => {
    assert.equal(state('2026-11-06T15:30Z', { sessions: [] }).state, CYCLE.preview)
    const dated = { ...next, date_from: '2026-11-06' }
    assert.equal(state('2026-11-05T23:59Z', { sessions: [], next: dated }).state, CYCLE.preview)
    assert.deepEqual(state('2026-11-06T00:00Z', { sessions: [], next: dated }), { state: CYCLE.weekend, run: false })
    // date_iso's day and a full day after it, as raceStage() waits.
    assert.equal(state('2026-11-10T00:00Z', { sessions: [] }).state, CYCLE.weekend)
    assert.equal(state('2026-11-10T00:00Z', { sessions: [] }).run, true)
  })

  it('gives no podium for last season, and is off with no round to come or no season', () => {
    assert.equal(state('2026-11-02T08:00Z', { latest: { ...latest, year: 2025 } }).state, CYCLE.preview)
    assert.equal(state('2026-11-02T08:00Z', { latest: null }).state, CYCLE.preview)
    assert.equal(state('2026-11-02T08:00Z', { next: null }).state, CYCLE.off)
    assert.equal(state('2026-11-02T08:00Z', { now: null }).state, CYCLE.off)
  })

  it('stands three single places as steps, and declines a shared place or a missing one', () => {
    const row = (position, driver_id, constructor_id) => ({ position, driver_id, driver: driver_id, constructor_id, constructor: constructor_id, constructor_country: null, year: 2026 })
    const three = [row(1, 'norris', 'mclaren'), row(2, 'leclerc', 'ferrari'), row(3, 'piastri', 'mclaren')]
    const steps = podium(three)
    assert.deepEqual(
      steps.map((s) => [s.ordinal, s.driver, s.constructor]),
      [['1st', 'norris', 'mclaren'], ['2nd', 'leclerc', 'ferrari'], ['3rd', 'piastri', 'mclaren']],
    )
    assert.equal(podium([three[0], three[1]]), null)
    assert.equal(podium([three[0], { ...three[0], driver_id: 'x' }, three[1], three[2]]), null)
    assert.equal(podium([]), null)
  })

  it('names the clock the sessions are written on, and the title its chart is of', () => {
    assert.equal(sessionsClock(null), 'Start times, UTC.')
    assert.equal(sessionsClock('America/Sao_Paulo'), 'Start times, your time (America/Sao Paulo).')
    assert.equal(reachHeading("The drivers' title"), "Who can still win the drivers' title")
  })
})

describe("the home page's weekend as a lap (AF-156), on fixed clocks", () => {
  const at = (iso) => Date.parse(iso)
  const session = (kind, name, start_utc) => ({ kind, name, start_utc, zone: 'America/Sao_Paulo' })
  const normal = [
    session('fp1', 'Practice 1', '2026-11-06T14:30Z'),
    session('fp2', 'Practice 2', '2026-11-06T18:00Z'),
    session('fp3', 'Practice 3', '2026-11-07T14:30Z'),
    session('qualifying', 'Qualifying', '2026-11-07T18:00Z'),
    session('race', 'Race', '2026-11-08T17:00Z'),
  ]
  const sprint = [
    session('fp1', 'Practice 1', '2026-04-10T03:30Z'),
    session('sprint_qualifying', 'Sprint qualifying', '2026-04-10T07:30Z'),
    session('sprint', 'Sprint', '2026-04-11T03:00Z'),
    session('qualifying', 'Qualifying', '2026-04-11T07:00Z'),
    session('race', 'Race', '2026-04-12T07:00Z'),
  ]
  // A square drawn clockwise from its top-left corner, 400 units round.
  const square = 'M0 0H100V100H0Z'
  const states = (lap) => lap.stops.map((s) => s.state)

  it('reads every command F1DB writes, flags run together included', () => {
    const round = (runs) => runs.reduce((sum, run) => sum + run.slice(1).reduce((a, p, k) => a + Math.hypot(p[0] - run[k][0], p[1] - run[k][1]), 0), 0)
    assert.equal(round(flatten(square)), 400)
    assert.equal(round(flatten('m0 0 100 0 0 100-100 0z')), 400, 'a relative moveto, its pairs read as linetos')
    // A circle of radius 50 as two arcs, the second with its flags and the
    // first coordinate run together as minified paths write them.
    const circle = round(flatten('M0 50a50 50 0 1 1 100 0a50 50 0 11-100 0'))
    assert.ok(Math.abs(circle - 100 * Math.PI) < 1, `two half-circles are ${circle.toFixed(2)} round, not ${(100 * Math.PI).toFixed(2)}`)
    const curve = round(flatten('M0 0c0 50 100 50 100 0s100-50 100 0q50 50 100 0t100 0'))
    assert.ok(curve > 400 && curve < 520, `the curves are read as curves: ${curve.toFixed(1)}`)
    assert.throws(() => flatten('M0 0 X5 5'))
  })

  it('reads every outline the database holds, so no round falls to the strip for want of a reader', () => {
    const db = new DatabaseSync(join(web, '..', 'f1.db'), { readOnly: true })
    try {
      const paths = db.prepare('SELECT f1db_layout_id, path FROM circuit_outlines').all()
      assert.ok(paths.length > 0)
      for (const { f1db_layout_id: id, path } of paths) {
        const lap = lapLayout(path, normal, at('2026-11-01T00:00Z'))
        assert.equal(lap.strip, false, `${id} is read`)
        for (const stop of lap.stops) assert.ok(stop.x >= 0 && stop.x <= 500 && stop.y >= 0 && stop.y <= 500, `${id}: a stop inside the box`)
      }
    } finally {
      db.close()
    }
  })

  it('spaces the stops evenly in order, the race closing the lap where the drawing began', () => {
    const lap = lapLayout(square, normal.slice(0, 4), at('2026-11-01T00:00Z'))
    assert.deepEqual(
      lap.stops.map((s) => [s.x, s.y]),
      [[100, 0], [100, 100], [0, 100], [0, 0]],
    )
    assert.equal(lap.run, null, 'nothing is drawn in before the first session')
    assert.equal(lap.next.kind, 'fp1')
  })

  it('draws in a normal weekend as each session starts', () => {
    const before = lapLayout(square, normal, at('2026-11-06T14:29Z'))
    assert.deepEqual(states(before), [LAP_NEXT, LAP_TO_COME, LAP_TO_COME, LAP_TO_COME, LAP_TO_COME])
    assert.equal(before.ran, 0)
    // Both edges of a start: the minute before and the minute of it.
    const first = lapLayout(square, normal, at('2026-11-06T14:30Z'))
    assert.deepEqual(states(first), [LAP_RUN, LAP_NEXT, LAP_TO_COME, LAP_TO_COME, LAP_TO_COME])
    assert.equal(first.run, 'M0 0L80 0', 'the track is drawn in to the first stop, a fifth of the way round')
    assert.equal(first.next.name, 'Practice 2')
    const saturday = lapLayout(square, normal, at('2026-11-07T20:00Z'))
    assert.deepEqual(states(saturday), [LAP_RUN, LAP_RUN, LAP_RUN, LAP_RUN, LAP_NEXT])
    assert.equal(saturday.run, 'M0 0L100 0L100 100L0 100L0 80', 'four fifths of the way round, along the drawing')
    const raced = lapLayout(square, normal, at('2026-11-08T17:00Z'))
    assert.deepEqual(states(raced), [LAP_RUN, LAP_RUN, LAP_RUN, LAP_RUN, LAP_RUN])
    assert.equal(raced.next, null, 'with every session started there is no next')
    assert.equal(raced.run, 'M0 0L100 0L100 100L0 100L0 0', 'and the lap is closed')
  })

  it("takes a sprint weekend's own sessions, in the order they are run", () => {
    const lap = lapLayout(square, sprint, at('2026-04-10T12:00Z'))
    assert.deepEqual(
      lap.stops.map((s) => [s.key, s.state]),
      [
        ['fp1', LAP_RUN],
        ['sprint_qualifying', LAP_RUN],
        ['sprint', LAP_NEXT],
        ['qualifying', LAP_TO_COME],
        ['race', LAP_TO_COME],
      ],
    )
    assert.equal(lap.next.name, 'Sprint')
    assert.ok(lap.stops.find((s) => s.state === LAP_NEXT).r > lap.stops.find((s) => s.state === LAP_RUN).r, 'the next stop is drawn larger')
  })

  it('lays a round with no drawing, or one it cannot read, on a strip, and draws nothing with no timetable', () => {
    for (const path of [null, 'not a path']) {
      const lap = lapLayout(path, normal, at('2026-11-06T14:30Z'))
      assert.equal(lap.strip, true)
      assert.equal(lap.viewBox, '0 0 500 48')
      assert.deepEqual(
        lap.stops.map((s) => s.x),
        [114.4, 204.8, 295.2, 385.6, 476],
      )
      assert.equal(lap.run, 'M24 24L114.4 24')
    }
    assert.equal(lapLayout(square, [], at('2026-11-06T14:30Z')), null)
    assert.equal(lapLayout(square, null, at('2026-11-06T14:30Z')), null)
  })

  it('names where the weekend stands, in words', () => {
    const label = (iso, path = square) => lapLabel('Interlagos', 'interlagos-2', lapLayout(path, normal, at(iso)))
    assert.equal(label('2026-11-01T00:00Z'), 'Outline of Interlagos, F1DB layout interlagos-2, with the weekend’s 5 sessions marked round it in order: none has started')
    assert.equal(label('2026-11-07T15:00Z'), 'Outline of Interlagos, F1DB layout interlagos-2, with the weekend’s 5 sessions marked round it in order: 3 of them started, Qualifying next')
    assert.equal(label('2026-11-09T00:00Z'), 'Outline of Interlagos, F1DB layout interlagos-2, with the weekend’s 5 sessions marked round it in order: every one has started')
    assert.equal(label('2026-11-07T15:00Z', null), 'A strip of the weekend’s 5 sessions, in order: 3 of them started, Qualifying next')
  })
})

describe("the home page's opening slot (VD-92)", () => {
  // f1.db has a season part-run, so `/` only ever shows the last race run;
  // the opener before a season starts, and a round with no drawing, are
  // reachable here.
  const latest = { year: 2026, round: 19, name_used: 'Mexico City Grand Prix', winner: 'Lando Norris', outline: 'M0 0', date_iso: '2026-10-25' }
  const next = { year: 2026, round: 20, name_used: 'Sao Paulo Grand Prix', outline: 'M1 1', date_iso: '2026-11-08', date_from: '2026-11-06', date_to: '2026-11-08' }
  const running = { year: 2026, run: 19 }

  it('draws the last race run while the season is under way', () => {
    assert.equal(openingRace(latest, next, running).race, latest)
    assert.deepEqual(openingCaption(openingRace(latest, next, running)), {
      text: 'Last race run: the 2026 Mexico City Grand Prix, won by Lando Norris',
      dates: null,
    })
  })

  it('draws the opener, with its dates, before the season has run a round', () => {
    const opener = { ...next, year: 2027, round: 1, name_used: 'Bahrain Grand Prix' }
    const got = openingRace(latest, opener, { year: 2027, run: 0 })
    assert.equal(got.race, opener)
    assert.deepEqual(openingCaption(got), { text: 'Next on the calendar: the 2027 Bahrain Grand Prix', dates: opener })
  })

  it('gives way to the other race where the one chosen has no drawing, and has no slot with neither', () => {
    assert.equal(openingRace(latest, { ...next, outline: null }, { year: 2027, run: 0 }).race, latest)
    assert.equal(openingRace({ ...latest, outline: null }, next, running).race, next)
    assert.equal(openingRace(null, undefined, null), null)
    assert.equal(openingRace({ ...latest, outline: null }, { ...next, outline: null }, running), null)
  })

  it('drops the date clause where no date is held, and names an unrecorded winner as the panel does', () => {
    assert.equal(openingCaption({ race: { ...next, date_iso: null, date_from: null, date_to: null }, run: false }).dates, null)
    assert.equal(
      openingCaption({ race: { ...latest, winner: null }, run: true }).text,
      'Last race run: the 2026 Mexico City Grand Prix, won by an unrecorded driver',
    )
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

  // VD-117: the count is of races won, so the three teams that won a shared
  // drive - where counting entries parted it from the register by one - say
  // one figure twice, and every other team holding a total does too.
  it('counts every team holding a total as the register does, the shared drives once, from f1.db', () => {
    const db = new DatabaseSync(join(web, '..', 'f1.db'), { readOnly: true })
    try {
      const teams = db.prepare('SELECT * FROM constructors WHERE wins IS NOT NULL').all()
      assert.ok(teams.length > 100, `${teams.length} constructors hold a total`)
      for (const team of teams) {
        const shown = recordFigures(team, db.prepare(TEAM_DERIVED).get(team.id) ?? {})[0][1]
        assert.equal(shown, `${team.wins.toLocaleString('en-GB')} derived · ${team.wins.toLocaleString('en-GB')} published`, team.id)
      }
      const wins = (id) => recordFigures(db.prepare('SELECT * FROM constructors WHERE id = ?').get(id), db.prepare(TEAM_DERIVED).get(id) ?? {})[0][1]
      assert.equal(wins('rob-walker'), '0 derived')
    } finally {
      db.close()
    }
  })
})

// VD-117: *Every win* a row a race, so its count is the tile's and /records'.
describe("a constructor's wins, a shared drive once (VD-117)", () => {
  const entry = (year, round, driver, chassis = 'ferrari-555', extra = {}) => ({
    year,
    round,
    name_used: `Race ${round}`,
    driver_id: driver,
    driver: driver.toUpperCase(),
    chassis_id: chassis,
    chassis: chassis?.toUpperCase() ?? null,
    ...extra,
  })

  it('makes the entries of one race one row, each driver kept in order, a design once', () => {
    const rows = winsByRace([entry(1957, 2, 'a'), entry(1956, 1, 'musso'), entry(1956, 1, 'fangio'), entry(1955, 3, 'b', null)])
    assert.equal(rows.length, 3)
    assert.deepEqual(rows.map((r) => r.driver), ['A', 'MUSSO / FANGIO', 'B'])
    assert.deepEqual(rows[1].drivers, [{ id: 'musso', name: 'MUSSO' }, { id: 'fangio', name: 'FANGIO' }])
    assert.equal(rows[1].designs.length, 1)
    assert.equal(rows[1].chassis, 'FERRARI-555', 'one design keeps its own words')
    assert.equal(rows[2].chassis, null, 'a blank chassis stays blank')
  })

  it('joins two designs where a shared drive raced both', () => {
    const [row] = winsByRace([entry(1956, 1, 'musso', 'x'), entry(1956, 1, 'fangio', 'y')])
    assert.equal(row.chassis, 'X / Y')
    assert.deepEqual(row.designs.map((d) => d.id), ['x', 'y'])
  })

  it('names the shared races under the table, and only where there is one', () => {
    const shared = winsByRace([entry(1956, 1, 'musso', 'x', { name_used: 'Argentine Grand Prix' }), entry(1956, 1, 'fangio', 'x', { name_used: 'Argentine Grand Prix' })])
    assert.equal(
      winsFooter(shared),
      `${TEAM_WINS_FOOTER} A shared drive counts once, to the car, with each of its drivers named: the 1956 Argentine Grand Prix.`,
    )
    assert.equal(winsFooter(winsByRace([entry(1957, 2, 'a')])), TEAM_WINS_FOOTER)
    assert.equal(winsFooter([]), TEAM_WINS_FOOTER)
  })

  it('gives every team as many rows, and season wins, as the tile counts, from f1.db', () => {
    const db = new DatabaseSync(join(web, '..', 'f1.db'), { readOnly: true })
    try {
      const teams = db.prepare('SELECT DISTINCT constructor_id AS id FROM race_entries WHERE finish_position = 1 AND constructor_id IS NOT NULL').all()
      let shared = 0
      for (const { id } of teams) {
        const { wins } = db.prepare(TEAM_DERIVED).get(id)
        const rows = winsByRace(db.prepare(TEAM_WINS).all(id))
        assert.equal(rows.length, wins, `${id}: Every win`)
        assert.equal(db.prepare(TEAM_BY_SEASON).all(id).reduce((sum, s) => sum + s.wins, 0), wins, `${id}: Wins by season`)
        shared += rows.filter((r) => r.drivers.length > 1).length
      }
      assert.ok(shared > 0, 'the register holds a shared drive for this to be about')
      const ferrari = winsByRace(db.prepare(TEAM_WINS).all('ferrari'))
      assert.match(winsFooter(ferrari), /each of its drivers named: .*the 1956 Argentine Grand Prix/)
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

  // VD-103: a stint is labelled in words under its bar, never by a second ink.
  it('labels each stint by its laps under the bar, and by its number and laps in its tooltip', () => {
    const [a, b, c] = stintLayout(entries, pits).cars
    assert.deepEqual(
      a.stints.map((s) => [s.laps, s.title]),
      [
        ['1–20', 'Stint 1: laps 1–20'],
        ['21–35', 'Stint 2: laps 21–35'],
        ['36–50', 'Stint 3: laps 36–50'],
      ],
    )
    assert.deepEqual(
      c.stints.map((s) => s.title),
      ['Stint 1: laps 1–20'],
      'a stop past the last lap does not make a stint',
    )
    assert.equal(lapRange(17, 18), '18')
    assert.equal(stintTitle(2, 17, 18), 'Stint 2: lap 18')
    assert.ok(a.lapsY > a.barY + 8 + 3 && a.lapsY < b.barY - 3, 'the label sits between its bar’s ticks and the next row’s')
    // A stint too short for its laps keeps its tooltip and loses the label.
    const short = stintLayout([entry('a', 1, 50, 1), entry('b', 2, 50, 2)], [stop('a', 1, 10), stop('a', 2, 11), stop('b', 1, 25)]).cars[0]
    assert.deepEqual(
      short.stints.map((s) => [s.laps, s.title]),
      [
        ['1–10', 'Stint 1: laps 1–10'],
        [null, 'Stint 2: lap 11'],
        ['12–50', 'Stint 3: laps 12–50'],
      ],
    )
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

  // AF-141: a time per stop, in the laps' order, NULL an em dash and never 0.
  it('prints each stop’s pit-lane time beside its lap, and NULL as an em dash', () => {
    const timed = [
      { ...stop('a', 2, 35), pit_lane_seconds: 3707.606 },
      { ...stop('a', 1, 20), pit_lane_seconds: 22.449 },
      { ...stop('b', 1, 18), pit_lane_seconds: null },
      { ...stop('b', 2, 40), pit_lane_seconds: 8.757 },
      { ...stop('c', 1, 21), pit_lane_seconds: 0 },
    ]
    assert.deepEqual(
      stintTableRows(entries, timed).map((r) => [r.id, r.stop_laps, r.stop_times]),
      [
        ['a', '20, 35', '22.4, 3707.6'],
        ['b', '18, 40', '—, 8.8'],
        ['c', '21', '0.0'],
      ],
    )
    assert.equal(stopTitle(35, 22.449), 'Lap 35: pit lane 22.4 s')
    assert.equal(stopTitle(18, null), 'Lap 18: pit lane —')
    assert.equal(stopTitle(18, undefined), 'Lap 18: pit lane —')
    const cars = stintLayout(entries, timed).cars
    assert.deepEqual(cars.map((car) => car.titles), [
      ['Lap 20: pit lane 22.4 s', 'Lap 35: pit lane 3707.6 s'],
      ['Lap 18: pit lane —', 'Lap 40: pit lane 8.8 s'],
      // Past the end of c's 20 laps, the tick at the end and the title on its own lap.
      ['Lap 21: pit lane 0.0 s'],
    ])
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
  const done = { running: 0, not_started: 0 }

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
    assert.equal(titleRaceText('1:9:6', { running: 1, not_started: 0 }), 'Ahead of second place after every round so far')
    assert.equal(titleRaceText('1:6:9 2:15:12', { running: 1, not_started: 0 }), 'Ahead of second place from round 2 of 2 run')
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

describe("the season-by-season tables' rounds (VD-106)", () => {
  it('reads the pairs in round order, a place as a number and a code as itself', () => {
    assert.deepEqual(byRoundOf('3:DNF 1:2 2:14'), [
      { round: 1, place: 2, code: '2' },
      { round: 2, place: 14, code: '14' },
      { round: 3, place: null, code: 'DNF' },
    ])
    assert.deepEqual(byRoundOf(null), [])
  })

  it('says every round entered, the source code where there is no place, and a constructor round with none classified', () => {
    assert.equal(byRoundText('4:1 1:3 2:DNF'), 'R1 P3, R2 DNF, R4 P1')
    assert.equal(byRoundText('1:5 2:'), 'R1 P5, R2 not classified')
    assert.equal(byRoundText(null), '—')
  })

  it('draws a bar a place on one scale, a tick for a round not classified, and nothing for a round not entered', () => {
    const layout = byRoundLayout('1:1 2:20 3:DNF 4:33', 6)
    assert.equal(layout.width, BY_ROUND_WIDTH)
    assert.equal(layout.height, ROW_SPARK_HEIGHT)
    // Rounds 1, 2 and 4 are bars, round 3 a tick, rounds 5 and 6 empty.
    assert.equal(layout.bars.length, 3)
    assert.equal(layout.ticks.length, 1)
    const [win, twentieth, below] = layout.bars
    assert.ok(win.height > twentieth.height, 'a win stands taller than 20th')
    assert.equal(below.height, twentieth.height, '33rd is drawn at the floor, as 20th is')
    assert.ok(layout.ticks[0].height < twentieth.height, 'a tick is shorter than the shortest bar')
    // Every bar stands on the line and inside the box, in its own slot.
    for (const bar of layout.bars) {
      assert.ok(bar.y >= 0 && bar.y + bar.height <= ROW_SPARK_HEIGHT)
      assert.ok(bar.x >= 0 && bar.x + bar.width <= BY_ROUND_WIDTH + 0.1)
    }
    assert.ok(layout.bars[2].x > layout.ticks[0].x && layout.ticks[0].x > layout.bars[1].x)
    // The last bar of a six-round season ends two slots short of the box.
    assert.ok(layout.bars[2].x + layout.bars[2].width < (BY_ROUND_WIDTH * 4) / 6 + 0.1)
    assert.equal(byRoundLayout(null, 6), null)
  })

  it('draws a season to its last round entered where the calendar is not known', () => {
    const layout = byRoundLayout('1:1 2:2', null)
    assert.ok(layout.bars[1].x + layout.bars[1].width > BY_ROUND_WIDTH - 2)
  })
})

describe('column groups (VD-106)', () => {
  it('is a run of neighbours sharing a label, with the columns between them a run of none', () => {
    const columns = [
      { key: 'year', rowHeader: true },
      { key: 'entries' },
      { key: 'poles', group: 'Qualifying' },
      { key: 'wins', group: 'Races' },
      { key: 'best', group: 'Races' },
      { key: 'championship' },
    ]
    assert.deepEqual(groupRuns(columns), [
      { group: null, span: 2 },
      { group: 'Qualifying', span: 1 },
      { group: 'Races', span: 2 },
      { group: null, span: 1 },
    ])
    // A group whose columns collapsed is gone with them.
    assert.deepEqual(groupRuns(columns.filter((c) => c.key !== 'poles')), [
      { group: null, span: 2 },
      { group: 'Races', span: 2 },
      { group: null, span: 1 },
    ])
    assert.equal(groupRuns([{ key: 'year' }, { key: 'wins' }]), null)
  })

  it('is refused beside a phone set', () => {
    assert.equal(groupFault([{ key: 'a', group: 'G' }, { key: 'b' }]), null)
    assert.match(groupFault([{ key: 'a', group: 'G' }, { key: 'b', phone: true }]), /both groups and a phone set/)
  })

  it('groups the season-by-season tables in a weekend order, the qualifying first', () => {
    const heads = (columns) => groupRuns(columns).map((run) => `${run.group ?? '-'}:${run.span}`)
    assert.deepEqual(heads(SEASON_COLUMNS), ['-:3', 'Qualifying:1', 'Races:6', '-:1'])
    assert.deepEqual(heads(TEAM_SEASON_COLUMNS), ['-:3', 'Qualifying:1', 'Races:5', '-:1'])
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

describe('a round the driver did not race says why (AF-151)', async () => {
  const { THIS_SEASON_COLUMNS, NOT_ENTERED, PRACTICE_ONLY } = await import('../src/queries/driver.js')
  const cell = (row) => THIS_SEASON_COLUMNS.find((column) => column.key === 'position_text').text(null, row)

  it('a practice sheet and no race row is practice only', () => {
    assert.equal(cell({ entry_id: null, practised: 1 }), PRACTICE_ONLY)
  })
  it('neither is not entered', () => {
    assert.equal(cell({ entry_id: null, practised: 0 }), NOT_ENTERED)
  })
  it('a race row wins over the practice sheet', () => {
    assert.equal(cell({ entry_id: 7, practised: 1, position_text: '4', finish_position: 4 }), '4')
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

describe('a driver’s career chart tells the career (VD-124), on rows written out', async () => {
  const { careerStory, finishesFigure } = await import('../src/queries/driver.js')
  const { dotPlotLayout, DOT_R, RING_R } = await import('../src/charts/dotPlot.js')
  const { MARKER, placeDotMarkers } = await import('../src/charts/annotate.js')
  const final = (year, position, points) => ({ year, position, points, basis: 'final' })
  // Norris's shape: 11th, 9th, 6th, 7th, 6th, 2nd, champion by two, and the season being run.
  const norris = [final(2019, 11, 49), final(2020, 9, 97), final(2021, 6, 160), final(2022, 7, 122), final(2023, 6, 205), final(2024, 2, 374), final(2025, 1, 423), { year: 2026, position: 6, points: 150, basis: 'running' }]
  const raced = norris.map((s) => s.year)
  const wins = [{ year: 2024, round: 6, name_used: 'Miami Grand Prix' }, { year: 2024, round: 15, name_used: 'Dutch Grand Prix' }]
  const runnersUp = [{ year: 2025, points: 421, name: 'Max Verstappen' }]

  it('states the climb to one title, and a note for the first win and one for the title', () => {
    const story = careerStory(norris, { wins, runnersUp, first: 2019, raced })
    assert.equal(story.finding, 'From 11th to champion in seven seasons')
    assert.equal(story.kicker, 'Final championship position each season, 2026 so far · the title ringed')
    assert.deepEqual(story.notes, [
      { n: 1, x: 2024, lead: 'First win, 2024', text: 'Miami Grand Prix, round 6; 2nd in the championship that year.' },
      { n: 2, x: 2025, lead: 'Champion, 2025', text: 'By two points from Verstappen.' },
    ])
  })
  it('counts the seasons raced, not the years, and names both years where the first season has no place', () => {
    const gap = [{ year: 1968, position: null, basis: 'final' }, final(1970, 15, 4), final(1978, 1, 64)]
    assert.equal(careerStory(gap, { first: 1968, raced: [1968, 1970, 1978] }).finding, 'From 15th in 1970 to champion in 1978')
    const sabbatical = [final(2001, 9, 10), final(2004, 3, 50), final(2005, 1, 90)]
    assert.equal(careerStory(sabbatical, { first: 2001, raced: [2001, 2004, 2005] }).finding, 'From 9th to champion in three seasons')
  })
  it('counts several titles, and makes a first win in a title season one note', () => {
    const story = careerStory([final(1950, 1, 30), final(1951, 4, 19), final(1952, 1, 36)], {
      wins: [{ year: 1950, round: 1, name_used: 'British Grand Prix' }],
      runnersUp: [{ year: 1950, points: 27.5, name: 'Juan Manuel Fangio' }],
      first: 1950,
      raced: [1950, 1951, 1952],
    })
    assert.equal(story.finding, 'Two titles between 1950 and 1952')
    assert.equal(story.kicker, 'Final championship position each season · each title ringed')
    assert.deepEqual(story.notes, [
      { n: 1, x: 1950, lead: 'First win and first title, 1950', text: 'British Grand Prix, round 1. By 2.5 points from Fangio.' },
    ])
    assert.equal(careerStory([final(1950, 1, 30), final(1951, 4, 19)], { first: 1950, raced: [1950, 1951] }).finding, 'Champion at the first attempt')
  })
  it('never calls the season being run a title, and says it as so far', () => {
    const rookie = [final(2025, 7, 150), { year: 2026, position: 1, points: 390, basis: 'running' }]
    const story = careerStory(rookie, { wins: [{ year: 2026, round: 2, name_used: 'Chinese Grand Prix' }], first: 2025, raced: [2025, 2026] })
    assert.equal(story.finding, 'At best 7th in the championship, in 2025; 1st in 2026 so far')
    assert.equal(story.kicker, 'Final championship position each season, 2026 so far')
    // No final place to state for the season of the first win.
    assert.deepEqual(story.notes, [{ n: 1, x: 2026, lead: 'First win, 2026', text: 'Chinese Grand Prix, round 2.' }])
    const chart = finishesFigure({ full_name: 'A Driver', first_season: 2025, last_season: 2026 }, rookie, new Map(), [{ year: 2025 }, { year: 2026 }])
    assert.deepEqual(chart.data.map((d) => d.mark), [false, false], 'a lead in the season being run is not ringed')
  })
  it('names the best final place and how often, and gives no note without a dot to point to', () => {
    const story = careerStory([final(1955, 2, 23), final(1956, 2, 27), final(1957, 2, 25), { year: 1962, position: null, basis: 'final' }], {
      wins: [{ year: 1962, round: 1, name_used: 'A Grand Prix' }],
      first: 1955,
    })
    assert.equal(story.finding, 'At best 2nd in the championship, three times')
    assert.deepEqual(story.notes, [])
  })
  it('gives the points alone where no single runner-up is on record, and a level title as level', () => {
    const one = [final(2000, 3, 20), final(2001, 1, 40)]
    assert.equal(careerStory(one, { first: 2000 }).notes[0].text, 'On 40 points.')
    assert.equal(careerStory(one, { first: 2000, runnersUp: [{ year: 2001, points: 40, name: 'B Driver' }] }).notes[0].text, 'Level on points with Driver.')
    assert.equal(careerStory(one, { first: 2000, runnersUp: [{ year: 2001, points: 39, name: 'B Driver' }] }).notes[0].text, 'By one point from Driver.')
  })

  const driver = { full_name: 'Lando Norris', first_season: 2019, last_season: 2026 }
  const chart = finishesFigure(driver, norris, new Map(), raced.map((year) => ({ year })), { wins, runnersUp })
  it('labels every season, in the short form where only that fits, and both ends where neither does', () => {
    assert.deepEqual(dotPlotLayout({ ...chart, width: 480 }).xTicks.map((t) => t.text), raced.map(String))
    assert.deepEqual(dotPlotLayout({ ...chart, width: 300 }).xTicks.map((t) => t.text), raced.map((y) => `’${String(y).slice(-2)}`))
    const long = finishesFigure({ full_name: 'A', first_season: 1993, last_season: 2011 }, [final(1993, 17, 2), final(2011, 17, 4)], new Map(), [])
    const ticks = dotPlotLayout({ ...long, width: 320 }).xTicks.map((t) => t.value)
    assert.equal(ticks[0], 1993)
    assert.equal(ticks[ticks.length - 1], 2011)
    assert.ok(ticks.length < 19, 'not every season, where they would collide')
  })
  it('grids P1, P5 and P10, and the tens past them, never the floor', () => {
    assert.deepEqual(dotPlotLayout({ ...chart, width: 480 }).yTicks.map((t) => t.text), ['P1', 'P5', 'P10'])
    const deep = finishesFigure(driver, [final(2019, 23, 0), final(2020, 9, 1)], new Map(), [])
    assert.deepEqual(dotPlotLayout({ ...deep, width: 480 }).yTicks.map((t) => t.text), ['P1', 'P5', 'P10', 'P20'])
  })
  it('breaks the line at a season with no dot and at a season not raced', () => {
    const data = [{ x: 1, y: 3 }, { x: 2, y: 2 }, { x: 3, y: null }, { x: 4, y: 1 }, { x: 5, y: 2 }, { x: 7, y: 4 }]
    const layout = dotPlotLayout({ data, width: 400, line: true })
    assert.equal(layout.segments.length, 2)
    assert.equal((layout.linePath.match(/M/g) ?? []).length, 2)
    assert.equal(dotPlotLayout({ data, width: 400 }).linePath, '', 'no line unless asked')
  })
  it('takes the one colour every dot shares, and ink where they differ', () => {
    const pair = { light: '#d66c00', dark: '#ff8000' }
    const data = [{ x: 1, y: 1, colour: pair }, { x: 2, y: 2, colour: { ...pair } }]
    assert.deepEqual(dotPlotLayout({ data, width: 400, line: true }).lineColour, pair)
    assert.equal(dotPlotLayout({ data: [...data, { x: 3, y: 2, colour: { light: '#000', dark: '#fff' } }], width: 400, line: true }).lineColour, null)
    assert.equal(dotPlotLayout({ data: [...data, { x: 3, y: 2, hollow: true }], width: 400, line: true }).lineColour, null)
  })
  it('sets every marker under its dot, clear of every dot, the line and the other marker, at every width', () => {
    const reach = MARKER.r + MARKER.ring / 2
    const near = (s, px, py) => {
      const l = (s.x2 - s.x1) ** 2 + (s.y2 - s.y1) ** 2
      const t = Math.max(0, Math.min(1, ((px - s.x1) * (s.x2 - s.x1) + (py - s.y1) * (s.y2 - s.y1)) / l))
      return Math.hypot(s.x1 + t * (s.x2 - s.x1) - px, s.y1 + t * (s.y2 - s.y1) - py)
    }
    for (const width of [300, 352, 480, 640]) {
      const layout = dotPlotLayout({ ...chart, width })
      assert.deepEqual(layout.markers.map((m) => m.n), [1, 2], `${width}: a marker for each note`)
      for (const m of layout.markers) {
        const dot = layout.points.find((p) => Math.abs(p.cx - m.cx) < 0.01)
        assert.ok(m.cy > dot.cy, `${width}: marker ${m.n} under its dot`)
        assert.ok(m.cy + reach <= layout.tickY - 10, `${width}: marker ${m.n} above the axis`)
        for (const p of layout.points) assert.ok(Math.hypot(p.cx - m.cx, p.cy - m.cy) >= reach + (p.d.mark ? RING_R : DOT_R), `${width}: marker ${m.n} clear of ${p.d.x}`)
        for (const s of layout.segments) assert.ok(near(s, m.cx, m.cy) >= reach, `${width}: marker ${m.n} clear of the line`)
      }
      const [a, b] = layout.markers
      assert.ok(Math.hypot(a.cx - b.cx, a.cy - b.cy) >= 2 * reach, `${width}: the two markers apart`)
    }
  })
  it('goes over a dot where under would leave the drawing', () => {
    const [m] = placeDotMarkers([{ n: 1, x: 50, y: 95, r: DOT_R }], { dots: [{ x: 50, y: 95, r: DOT_R }], bottom: 100 })
    assert.ok(m.cy < 95)
    assert.ok(m.leader.y1 < 95 && m.leader.y2 < m.leader.y1, 'the hairline runs up from the dot to the disc')
  })
  it('steps a disc aside where nothing straight under or over a title is clear: Button at 300 to 400 px', () => {
    const reach = MARKER.r + MARKER.ring / 2
    const near = (s, px, py) => {
      const l = (s.x2 - s.x1) ** 2 + (s.y2 - s.y1) ** 2
      const t = Math.max(0, Math.min(1, ((px - s.x1) * (s.x2 - s.x1) + (py - s.y1) * (s.y2 - s.y1)) / l))
      return Math.hypot(s.x1 + t * (s.x2 - s.x1) - px, s.y1 + t * (s.y2 - s.y1) - py)
    }
    // A ringed P1 between an 18th and a 5th: the climb under the title fills the space below it.
    const places = [8, 17, 7, 9, 3, 9, 6, 15, 18, 1, 5, 2, 5, 9, 8, 16, 15]
    const button = places.map((position, i) => final(2000 + i, position, 10))
    const years = button.map((s) => s.year)
    const chart = finishesFigure({ full_name: 'Jenson Button', first_season: 2000, last_season: 2016 }, button, new Map(), years.map((year) => ({ year })), {
      wins: [{ year: 2006, round: 13, name_used: 'Hungarian Grand Prix' }],
    })
    for (const width of [300, 320, 360, 400]) {
      const layout = dotPlotLayout({ ...chart, width })
      assert.deepEqual(layout.markers.map((m) => m.n), [1, 2], `${width}: a marker for each note`)
      for (const m of layout.markers) {
        for (const p of layout.points) assert.ok(Math.hypot(p.cx - m.cx, p.cy - m.cy) >= reach + (p.d.mark ? RING_R : DOT_R), `${width}: marker ${m.n} clear of ${p.d.x}`)
        for (const s of layout.segments) assert.ok(near(s, m.cx, m.cy) >= reach, `${width}: marker ${m.n} clear of the line`)
        assert.ok(m.cx - reach >= 0 && m.cx + reach <= width && m.cy - reach >= 0 && m.cy + reach <= layout.tickY - 10, `${width}: marker ${m.n} inside the drawing`)
        // The hairline runs out from the dot towards the disc, never back on itself.
        const dot = layout.points.find((p) => Math.hypot(p.cx - m.leader.x1, p.cy - m.leader.y1) <= (p.d.mark ? RING_R : DOT_R) + 1.01)
        assert.ok(dot, `${width}: marker ${m.n}'s hairline starts at a dot's edge`)
        assert.ok(Math.hypot(m.leader.x2 - dot.cx, m.leader.y2 - dot.cy) >= Math.hypot(m.leader.x1 - dot.cx, m.leader.y1 - dot.cy), `${width}: marker ${m.n}'s hairline runs outward`)
      }
    }
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

describe("a race page's podium where its tiles stood (VD-108)", () => {
  const entry = (finish_position, driver_id, over = {}) => ({
    finish_position,
    driver_id,
    driver: driver_id,
    constructor_id: 'mclaren',
    constructor: 'McLaren',
    constructor_country: null,
    entrant: null,
    grid: 4,
    grid_text: '4',
    pole: 0,
    fastest_lap: 0,
    ...over,
  })
  const race = { status: 'completed', year: 2026, circuit_id: 'interlagos', circuit: 'Interlagos' }
  const three = [entry(1, 'a', { grid: 1, grid_text: '1', pole: 1 }), entry(2, 'b', { grid: 21, grid_text: '21' }), entry(3, 'c', { grid: 5, grid_text: '5' }), entry(4, 'd')]

  it('says where each driver started, a slot or the words for one that is not', () => {
    assert.equal(podiumStart(entry(1, 'a', { grid: 1, grid_text: '1', pole: 1 })), 'from pole')
    assert.equal(podiumStart(entry(1, 'a', { grid: 1, grid_text: '1', pole: 0 })), 'from the front of the grid', 'first on the grid without the pole credit (2022 Brazil)')
    assert.equal(podiumStart(entry(2, 'b', { grid: 21, grid_text: '21' })), 'from 21st')
    assert.equal(podiumStart(entry(2, 'b', { grid: 12, grid_text: '12' })), 'from 12th')
    assert.equal(podiumStart(entry(2, 'b', { grid: null, grid_text: 'PL' })), 'from the pit lane')
    assert.equal(podiumStart(entry(2, 'b', { grid: null, grid_text: null })), 'grid not recorded', 'a slot nobody recorded is not a zero')
    assert.equal(podiumStart(entry(2, 'b', { grid: 1, grid_text: '8' })), null, 'a slot the source states otherwise says nothing')
  })

  it('stands the three with their starts, and declines a shared place, a missing one and a round not run', () => {
    assert.deepEqual(
      racePodium(race, three).map((s) => [s.ordinal, s.driver, s.constructor, s.start]),
      [['1st', 'a', 'McLaren', 'from pole'], ['2nd', 'b', 'McLaren', 'from 21st'], ['3rd', 'c', 'McLaren', 'from 5th']],
    )
    assert.equal(racePodium(race, [three[0], three[1], three[2], entry(3, 'e')]), null)
    assert.equal(racePodium(race, [three[0], three[1]]), null)
    assert.equal(racePodium({ ...race, status: 'scheduled' }, three), null)
    // The car by carName()'s rule, as the standfirst names it (AF-64).
    const indy = entry(1, 'parsons', { constructor_id: null, constructor: null, entrant: 'Kurtis Kraft-Offenhauser' })
    assert.equal(racePodium(race, [indy, three[1], three[2]])[0].constructor, 'Kurtis Kraft-Offenhauser')
  })

  it('takes the Winner tile out of the strip only where the podium is drawn', () => {
    const labels = (entries) => raceStrip(race, entries, []).map((t) => t.label)
    assert.ok(!labels(three).includes('Winner'))
    assert.ok(labels(three).includes('Pole'))
    const shared = [three[0], three[1], three[2], entry(3, 'e')]
    assert.ok(labels(shared).includes('Winner'), 'a declined podium keeps the tile, so the strip still names who won')
  })

  it("puts the strip's other tiles on the line under the slabs, the circuit without its place", () => {
    const placed = { ...race, locality: 'São Paulo', country: 'Brazil' }
    const also = raceAlso(placed, three, [])
    assert.deepEqual(
      also.map((t) => t.label),
      raceStrip(placed, three, []).map((t) => t.label),
    )
    assert.equal(also.find((t) => t.label === 'Circuit').note, undefined)
    assert.equal(raceStrip(placed, three, []).find((t) => t.label === 'Circuit').note, 'São Paulo, Brazil', 'the strip keeps it')
    assert.equal(also.find((t) => t.label === 'Entries').note, '4 classified')
  })

  it('counts places made or lost from a numbered slot only', () => {
    const steps = racePodium(race, [
      entry(1, 'a', { grid: null, grid_text: 'PL' }),
      entry(2, 'b', { grid: 21, grid_text: '21' }),
      entry(3, 'c', { grid: 1, grid_text: '8' }),
    ])
    assert.deepEqual(steps.map((s) => s.grid), [null, 21, null], 'a pit-lane start and a slot stated otherwise have none')
    assert.deepEqual(placesMoved(21, 2), { kind: 'up', text: '\u25b2 19', said: '19 places gained' })
    assert.deepEqual(placesMoved(1, 3), { kind: 'down', text: '\u25bc 2', said: '2 places lost' })
    assert.deepEqual(placesMoved(3, 2), { kind: 'up', text: '\u25b2 1', said: '1 place gained' })
    assert.equal(placesMoved(2, 2).kind, 'held')
    assert.equal(placesMoved(null, 2), null)
  })

  it('draws each slab from its step: the place and given names, the surname linked, the team and start, the chip', () => {
    const [first, second] = racePodium(race, [
      entry(1, 'piquet-jr', { driver: 'Nelson Piquet Jr.', grid: 1, grid_text: '1', pole: 1 }),
      entry(2, 'von-trips', { driver: 'Wolfgang von Trips', grid: 21, grid_text: '21' }),
      entry(3, 'c', { driver: 'Zsolt', grid: 3, grid_text: '3' }),
    ]).map(slab)
    assert.deepEqual(
      [first.numeral, first.first, first.surname, first.href, first.meta, first.move.text],
      ['1', '1st · Nelson', 'Piquet Jr.', 'drivers/piquet-jr', 'McLaren · from pole', 'held'],
    )
    assert.deepEqual([second.first, second.surname, second.meta, second.move.said], ['2nd · Wolfgang', 'von Trips', 'McLaren · from 21st', '19 places gained'])
    assert.deepEqual(nameParts('Zsolt'), { given: '', surname: 'Zsolt' }, 'a one-word name is a surname alone')
    assert.equal(slab({ place: 3, ordinal: '3rd', driver: 'Zsolt', driver_id: 'c', constructor: 'X', start: null, grid: null, colour: null }).first, '3rd')
  })

  it('sets a slab in black or white, whichever reads better on each value of its pair, and holds 4.5:1 on every colour', () => {
    assert.equal(inkOn('#ff8000'), SLAB_INK.dark, 'papaya takes black')
    assert.equal(inkOn('#1f3c88'), SLAB_INK.light, 'a navy takes white')
    assert.equal(inkOn('#000000'), SLAB_INK.light)
    assert.equal(inkOn('#ffffff'), SLAB_INK.dark)
    // Every livery's two values, and every national colour's value in each
    // of tokens.css's three blocks: the ink chosen clears the text floor.
    const tokens = readFileSync(join(web, 'src', 'styles', 'tokens.css'), 'utf8')
    const blocks = {
      light: tokens.slice(0, tokens.indexOf('@media (prefers-color-scheme: dark)')),
      osDark: tokens.slice(tokens.indexOf('@media (prefers-color-scheme: dark)'), tokens.indexOf(":root[data-theme='dark']")),
      stampedDark: tokens.slice(tokens.indexOf(":root[data-theme='dark']")),
    }
    const racing = (block) => Object.fromEntries([...block.matchAll(/--(racing-[a-z]+):\s*(#[0-9a-f]{6})\b/g)].map((m) => [m[1], m[2]]))
    const light = racing(blocks.light)
    assert.deepEqual(Object.keys(light).sort(), Object.keys(RACING_INK).sort(), 'RACING_INK names every racing token')
    const under = []
    for (const [theme, block] of [['light', blocks.light], ['dark', blocks.osDark], ['dark', blocks.stampedDark]]) {
      for (const [token, hex] of Object.entries(racing(block))) {
        assert.equal(RACING_INK[token][theme], inkOn(hex), `--${token} in the ${theme} theme (${hex}): RACING_INK is not inkOn() of it`)
        if (contrastRatio(hex, inkOn(hex)) < 4.5) under.push(`--${token} ${theme} ${hex}`)
      }
    }
    for (const l of LIVERIES)
      for (const hex of [l.light, l.dark]) if (contrastRatio(hex, inkOn(hex)) < 4.5) under.push(`${l.constructor} ${l.from} ${hex}`)
    assert.deepEqual(under, [], 'a slab whose words fall under 4.5:1')
    assert.ok(LIVERIES.length > 0)
  })

  it("carries the pair and each value's ink, or nothing for a team with no colour", () => {
    const vars = slabVars({ light: '#d66c00', dark: '#ff8000' })
    assert.deepEqual(Object.keys(vars), ['--livery-light', '--livery-dark', '--slab-ink-light', '--slab-ink-dark'])
    assert.deepEqual([vars['--slab-ink-light'], vars['--slab-ink-dark']], [inkOn('#d66c00'), inkOn('#ff8000')])
    const uk = slabVars({ light: 'var(--racing-uk)', dark: 'var(--racing-uk)' })
    assert.deepEqual([uk['--slab-ink-light'], uk['--slab-ink-dark']], [RACING_INK['racing-uk'].light, RACING_INK['racing-uk'].dark])
    assert.equal(slabVars(null), null)
  })
})

describe("the race header's weather line (AF-142)", () => {
  const nb = '\u00a0'
  const said = (conditions, reported) => ({ conditions, reported, air_max_c: null, rain_mm: null })
  const model = { air_max_c: 18.4, rain_mm: 3.2, credit: 'The credit.' }

  it('says nothing where neither source holds anything', () => {
    assert.equal(raceWeather(undefined), null)
    assert.equal(raceWeather({ conditions: null, reported: null, air_max_c: null, rain_mm: null }), null)
    // Words the build read as neither wet nor dry, and no model row.
    assert.equal(raceWeather(said(null, 'Temperatures reaching up to 23 °C')), null)
  })

  it('a report alone is a mark and a word, with nothing modelled to label', () => {
    assert.deepEqual(raceWeather(said('wet', 'Rain')), { mark: 'rain', text: 'Wet', modelled: false })
    assert.deepEqual(raceWeather(said('dry', 'Hot, dry')), { mark: 'sun', text: 'Dry', modelled: false })
  })

  it('the model alone has no mark and no word of wet or dry, whatever it holds', () => {
    assert.deepEqual(raceWeather({ conditions: null, reported: null, ...model }), {
      mark: null,
      text: `High of 18${nb}°C, 3.2${nb}mm of rain on the day`,
      modelled: true,
      method: `${WEATHER_METHOD} The credit.`,
    })
    assert.equal(raceWeather({ conditions: null, reported: 'Temperatures of 68 °F', ...model }).mark, null)
  })

  it('both are joined, and no rain at all is said as none', () => {
    assert.equal(raceWeather({ conditions: 'wet', reported: 'Wet', ...model }).text, `Wet · High of 18${nb}°C, 3.2${nb}mm of rain on the day`)
    assert.equal(raceWeather({ conditions: 'dry', reported: 'Dry', ...model, air_max_c: 7.5, rain_mm: 0 }).text, `Dry · High of 8${nb}°C, no rain on the day`)
  })

  it('a half-held model row is not established, and rain is never read as none', () => {
    const missing = raceWeather({ conditions: 'dry', reported: 'Dry', air_max_c: 20, rain_mm: null })
    assert.deepEqual(missing, { mark: 'sun', text: 'Dry', modelled: false })
  })

  it('the figures go out with the Copernicus credit or not at all (AF-149)', () => {
    assert.deepEqual(raceWeather({ conditions: 'dry', reported: 'Dry', ...model, credit: null }), { mark: 'sun', text: 'Dry', modelled: false })
    assert.equal(raceWeather({ conditions: null, reported: null, ...model, credit: null }), null)
  })

  it('dry is cloud where the phrase says cloud and not sun, and the word says what the mark does', () => {
    const cloud = { mark: 'cloud', text: 'Dry, with cloud', modelled: false }
    for (const phrase of ['Partly cloudy', 'Overcast, mild, dry', 'Dry, grey and cool', 'Dry and dull', 'Scattered thunderstorms, but remaining dry']) {
      assert.deepEqual(raceWeather(said('dry', phrase)), cloud, phrase)
    }
    for (const phrase of ['Sunny with clouds', 'Cloudy, sunny later', 'Fine and Dry', 'Greyhound', 'Dullness']) {
      assert.deepEqual(raceWeather(said('dry', phrase)), { mark: 'sun', text: 'Dry', modelled: false }, phrase)
    }
    // A wet race stays wet however clouded the phrase is.
    assert.equal(raceWeather(said('wet', 'Overcast with intermittent rain')).mark, 'rain')
  })
})

describe('a chart with no owner is drawn in ink, its stated value marked (VD-94)', () => {
  it('a lone series without a sourced colour is ink, and several take the slots', () => {
    assert.equal(slotColour(0, 1), INK)
    assert.deepEqual([0, 1, 2].map((i) => slotColour(i, 3)), ['var(--series-1)', 'var(--series-2)', 'var(--series-3)'])
  })

  it('the home chart marks the latest season raced, draws it as the rounds it has run with the rest dashed, and a calendar hollow', () => {
    const seasons = [
      { year: 1950, rounds: 7, run: 7, indianapolis: 1 },
      { year: 1960, rounds: 10, run: 10, indianapolis: 1 },
      { year: 2025, rounds: 24, run: 24, indianapolis: 0 },
      { year: 2026, rounds: 23, run: 18, indianapolis: 0 },
      { year: 2027, rounds: 24, run: 0, indianapolis: 0 },
    ]
    const columns = chartData(seasons)
    assert.deepEqual(columns.filter((c) => c.mark).map((c) => c.key), [2026])
    assert.deepEqual(columns.filter((c) => c.hollow).map((c) => [c.key, c.note]), [[2027, 'calendar']])
    // VD-123: the red column is the season so far, not its calendar.
    const now = columns.find((c) => c.key === 2026)
    assert.deepEqual([now.value, now.ahead, now.note], [18, 5, '5 still to run'])
    assert.deepEqual([columns[0].value, columns[0].ahead], [7, 0], 'a completed season is all solid')
    // Every figure the chart states is a note in its key now, so the plot prints none.
    assert.equal(columns.some((c) => c.print), false)
    const layout = columnLayout({ data: columns, width: 600, height: 260, labelPeak: false })
    assert.equal(layout.columns.filter((c) => c.value !== null).length, 0)
    const drawn = layout.columns.find((c) => c.d.key === 2026)
    assert.ok(drawn.ahead !== null && drawn.peak < drawn.top, 'what is still to run is dashed over the solid column')
    assert.ok(drawn.ahead.y1 === drawn.peak && drawn.ahead.y2 < drawn.top, 'from the calendar’s top down to just above the rounds run')
    assert.ok(Math.abs(drawn.peak - layout.y(23)) < 1e-9, 'up to the calendar’s 23')
    assert.equal(layout.columns.find((c) => c.d.key === 2025).ahead, null)
    // The note says what is counted, and which column is not results.
    assert.equal(
      chartNote(seasons),
      'Every championship round, the Indianapolis 500 of 1950–60 included. The 2027 column is a calendar: none of its rounds has been run.',
    )
    // With nothing raced nothing is marked.
    const calendar = chartData([{ year: 2027, rounds: 24, run: 0 }, { year: 2028, rounds: 20, run: 0 }])
    assert.equal(calendar.some((c) => c.mark), false)
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
    // The field first, in the order it ended, then the marked lines, so
    // the winner is drawn over the field (VD-113).
    const layout = gridFlagLayout([entry(1, 2, 1, 50), entry(2, 1, 2, 50), entry(3, 3, null, 20)])
    assert.deepEqual(layout.cars.map(flagCarClass), ['flag-car', 'flag-car flag-out', 'flag-car flag-won'])
    assert.deepEqual(layout.notes, [])
    const shared = gridFlagLayout([entry(1, 1, 1, 50), entry(2, 1, 1, 50), entry(3, 2, 2, 50)])
    assert.deepEqual(shared.cars.map((car) => car.won), [false, true, true])
  })

  // VD-113: the race's biggest moves, grid number minus finishing place.
  const car = (id, grid, finish, extra = {}) => ({
    id,
    driver: `Driver Name${id}`,
    abbreviation: `N${String(id).padStart(2, '0')}`,
    grid,
    grid_text: grid === null ? 'PL' : String(grid),
    finish_position: finish,
    position_text: finish === null ? 'DNF' : String(finish),
    laps_completed: finish === null ? 10 : 50,
    ...extra,
  })
  const story = (entries) => gridFlagStory(gridFlagRows(entries))

  it('grid to flag picks the biggest moves, a gain before a loss of the same size, three at most', () => {
    // 2 climbs six and 8 falls six, the gain first; 5 climbs four; the
    // fourth biggest is 9's fall of two, and nothing else is two.
    const field = [car(1, 1, 1), car(2, 8, 2), car(3, 3, 3), car(4, 4, 4), car(5, 9, 5), car(6, 5, 6), car(7, 6, 7), car(8, 2, 8), car(9, 7, 9)]
    assert.deepEqual(
      gridFlagMoves(gridFlagRows(field)).map((m) => [m.entry.id, m.moved]),
      [
        [2, 6],
        [8, -6],
        [5, 4],
      ],
    )
    // The same rows in another order pick the same moves in the same order.
    assert.deepEqual(
      gridFlagMoves(gridFlagRows([...field].reverse())).map((m) => m.entry.id),
      [2, 8, 5],
    )
  })

  it('grid to flag leaves a tie at the cut out whole, and has no story where nothing moved', () => {
    // 2 climbs five; 3, 4 and 5 each move one: the cut at three would keep
    // two of them, so none is kept.
    const tied = [car(1, 1, 1), car(2, 7, 2), car(3, 2, 3), car(4, 3, 4), car(5, 4, 5), car(6, 5, 6), car(7, 6, 7)]
    assert.deepEqual(gridFlagMoves(gridFlagRows(tied)).map((m) => m.entry.id), [2])
    const still = [car(1, 1, 1), car(2, 2, 2), car(3, 3, 3)]
    assert.deepEqual(story(still), { finding: null, kicker: null, moves: [] })
    const layout = gridFlagLayout(still, 640, [])
    assert.equal(layout.cars.some((c) => c.strong), false)
  })

  it('grid to flag counts no move it cannot establish: a retirement, a pit-lane start, a shared drive', () => {
    const entries = [
      car(1, 1, 1),
      car(2, 2, null),
      car(3, null, 2),
      car(4, 20, 3, { shared_drive: 1 }),
      car(5, 4, 4),
      car(6, 3, 5),
    ]
    assert.deepEqual(gridFlagMoves(gridFlagRows(entries)).map((m) => [m.entry.id, m.moved]), [[6, -2]])
  })

  it('grid to flag states the biggest climb, names a tie at it, and falls back to the biggest fall', () => {
    const climb = story([car(1, 1, 1), car(2, 8, 2), car(3, 3, 3), car(4, 4, 4), car(5, 9, 5), car(6, 5, 6), car(7, 6, 7), car(8, 2, 8), car(9, 7, 9)])
    assert.equal(climb.finding, 'Name2 came from 8th to finish 2nd')
    assert.equal(climb.kicker, 'Each starter, grid slot to result · the winner in red · the biggest gains and losses drawn in full ink')
    assert.deepEqual(
      climb.moves.map((m) => [m.long, m.short]),
      [
        ['Name2: 8th to 2nd, up six', 'N02 8th → 2nd'],
        ['Name8: 2nd to 8th', 'N08 2nd → 8th'],
        ['Name5: 9th to 5th', 'N05 9th → 5th'],
      ],
    )
    const won = story([car(1, 5, 1), car(2, 1, 2), car(3, 2, 3), car(4, 3, 4), car(5, 4, 5)])
    assert.equal(won.finding, 'Name1 came from 5th to win')
    assert.equal(won.kicker, 'Each starter, grid slot to result · the winner in red · the biggest gain drawn in full ink')
    const pair = story([car(1, 1, 1), car(2, 6, 2), car(3, 7, 3), car(4, 2, 4), car(5, 3, 5), car(6, 4, 6), car(7, 5, 7)])
    assert.equal(pair.finding, 'Name2 and Name3 each climbed four places')
    const fall = story([car(1, 1, 1), car(2, 2, 6), car(3, 3, 2), car(4, 4, 3), car(5, 5, 4), car(6, 6, 5)])
    // 2 fell four; 3 to 6 each climbed one, a tie past the cut.
    assert.equal(fall.finding, 'Name2 fell from 2nd to 6th')
    assert.equal(fall.kicker, 'Each starter, grid slot to result · the winner in red · the biggest loss drawn in full ink')
    // An entry the figure cannot draw changes the kicker's claim.
    const short = gridFlagStory(gridFlagRows([car(1, 1, 1), car(2, 4, 2), car(3, 2, 3), car(4, 3, 4)]), [car(9, null, null)])
    assert.match(short.kicker, /^Grid slot to result · /)
    // A surname another driver on the grid shares keeps the full name, though
    // only one of the two is picked; the other keeps its surname.
    const brothers = story([
      car(1, 1, 1, { driver: 'Ralf Schumacher' }),
      car(2, 9, 2, { driver: 'Michael Schumacher' }),
      car(3, 2, 3),
      car(4, 3, 4),
      car(5, 4, 5),
      car(6, 5, 6),
      car(7, 6, 7),
      car(8, 7, 8),
      car(9, 8, 9),
    ])
    assert.equal(brothers.finding, 'Michael Schumacher came from 9th to finish 2nd')
    assert.equal(brothers.moves[0].long, 'Michael Schumacher: 9th to 2nd, up seven')
    // The finding's move is marked to be labelled first, even where a
    // bigger fall comes before it in size.
    const bigFall = story([car(1, 1, 1), car(2, 5, 2), car(3, 3, 3), car(4, 4, 4), car(5, 6, 5), car(6, 2, 9), car(7, 7, 6), car(8, 8, 7), car(9, 9, 8)])
    assert.deepEqual(
      bigFall.moves.map((m) => [m.entry.id, m.moved, m.lead]),
      [
        [6, -7, false],
        [2, 3, true],
      ],
    )
    // Three words, family name last, keep the last word though the first
    // starts with the code.
    assert.equal(story([car(1, 1, 1), car(2, 9, 2, { driver: 'Qing Hua Ma', abbreviation: 'QIN' }), car(3, 2, 3)]).finding, 'Ma came from 9th to finish 2nd')
    // A family name written first is the one its code spells.
    const zhou = story([car(1, 1, 1), car(2, 17, 2, { driver: 'Zhou Guanyu', abbreviation: 'ZHO' }), car(3, 2, 3)])
    assert.equal(zhou.finding, 'Zhou came from 17th to finish 2nd')
    assert.match(gridFlagLabel(gridFlagRows([car(1, 1, 1), car(2, 4, 2)]), zhou.moves), / Drawn in full ink: Zhou, 17th to 2nd, up fifteen; /)
  })

  it('grid to flag sets each picked line its label clear of the others, inside the plot, or none', () => {
    // Three big moves: 20th to 2nd, 19th to 3rd and 1st to 18th; the rest
    // move two places or fewer.
    const order = [3, 20, 19, 2, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 1, 17, 18]
    const entries = order.map((grid, i) => car(i + 1, grid, i + 1))
    const rows = gridFlagRows(entries)
    const told = gridFlagStory(rows)
    assert.equal(told.moves.length, 3)
    for (const width of [1000, 640, 375, 320]) {
      const layout = gridFlagLayout(entries, width, told.moves)
      assert.equal(layout.cars.filter((c) => c.strong).length, 3, `${width}: three lines in full ink`)
      const coded = layout.cars.some((c) => c.name.length === 3)
      for (const note of layout.notes) {
        const drawn = layout.cars.find((c) => c.key === note.key)
        assert.equal(drawn.strong, true)
        assert.equal(note.text, coded ? told.moves.find((m) => m.entry.id === note.key).short : told.moves.find((m) => m.entry.id === note.key).long)
        const w = textWidth(note.text) * 1.2
        const left = note.anchor === 'end' ? note.x - w : note.x
        assert.ok(left >= layout.start - 0.1 && left + w <= layout.finish + 0.1, `${width}: “${note.text}” inside the plot`)
        assert.ok(note.y - 7 >= layout.top && note.y + 7 <= layout.bottom, `${width}: “${note.text}” inside the plot's height`)
      }
      const boxes = layout.notes.map((n) => {
        const w = textWidth(n.text) * 1.2
        const left = n.anchor === 'end' ? n.x - w : n.x
        return { left, right: left + w, top: n.y - 7, bottom: n.y + 7 }
      })
      for (let i = 0; i < boxes.length; i++)
        for (let j = i + 1; j < boxes.length; j++) {
          const [a, b] = [boxes[i], boxes[j]]
          assert.ok(a.right <= b.left || b.right <= a.left || a.bottom <= b.top || b.bottom <= a.top, `${width}: two labels overlap`)
        }
      if (width === 1000) assert.equal(layout.notes.length, 3, 'at 1,000 px every label fits')
    }
  })
})

describe("the home page's reading section (CD-14)", () => {
  const shape = { discrepancies: 12 }

  it('counts as many conventions as its note says, and names the three most often read as bugs', () => {
    const panels = reading(shape)
    assert.match(READING_NOTE, /^Four conventions /)
    assert.equal(panels.length, 4)
    const text = panels.map((p) => p.body.join('')).join(' ')
    assert.match(text, /appears twice is a shared drive/)
    assert.match(text, /before 1991 is net of dropped scores/)
    assert.match(text, /stored figure and a counted one disagree, you get both/)
  })

  it('keeps the discrepancy count as a link to the audit page, and still says the gaps are published', () => {
    const disagreements = reading(shape).find((p) => p.head.startsWith('Disagreements'))
    assert.deepEqual(disagreements.link, { to: '/data/quality', text: '12 on record' })
    assert.match(disagreements.body.join(''), /what is missing is published too/)
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
  const { GRID_MIN_SLOTS, STARTS_CAP, dotStrip, gridDiagram, slotsDrawn } = await import('../src/charts/gridStarts.js')
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
  // STARTS_SEASONS's rows: the item's figures at every circuit, 2012-2025,
  // in one season of the span, and a season outside it that must not count.
  const SEASONS = [
    { year: 1990, placed: 16, first: 9, front: 12 },
    { year: 2015, placed: 308, first: 167, front: 250 },
  ]
  const value = (items, label) => items.find((item) => item.label === label)?.value

  it("pins Austin's figures as the item worked them", () => {
    const races = winnerStarts(AUSTIN)
    assert.equal(races.length, 13)
    const items = startsFigures(races, SEASONS)
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
    // The drawings: the grid at its nine rows, though no winner here
    // started further back than 6th (VD-116), and the strip as far as the
    // 6th and a whole row; every race a dot, in the slot it was won from.
    const grid = gridDiagram(races)
    assert.equal(GRID_MIN_SLOTS, 18)
    assert.equal(grid.boxes.length, GRID_MIN_SLOTS)
    assert.deepEqual(grid.boxes.map((b) => b.slot), Array.from({ length: GRID_MIN_SLOTS }, (_, i) => i + 1))
    assert.equal(grid.boxes.flatMap((b) => b.dots).length, 13)
    assert.deepEqual(grid.boxes.map((b) => b.dots.length).slice(0, 7), [6, 5, 0, 1, 0, 1, 0])
    assert.ok(grid.boxes.slice(6).every((b) => b.dots.length === 0), 'the boxes past the 6th are drawn empty')
    assert.ok(grid.boxes.every((b) => b.count === null))
    // Nine rows are 676 px across, which the grid keeps unscaled in the
    // 698 px plot it first shows in, at 768.
    assert.equal(grid.width, 676)
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
    // The grid's minimum is a floor, not a cap: a winner from further back
    // than the ninth row draws as far as that slot and its partner.
    assert.equal(slotsDrawn(new Map([[3, []]]), GRID_MIN_SLOTS), GRID_MIN_SLOTS)
    assert.equal(slotsDrawn(new Map([[21, []]]), GRID_MIN_SLOTS), 22)
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
    const items = startsFigures(races, [])
    assert.equal(value(items, 'Won from first on the grid'), '1 of 1 (100%)')
    assert.equal(value(items, 'Not counted as a slot'), '1 pit lane · 1 grid not recorded · 1 shared drive')
    assert.deepEqual(startsTable(races).map((r) => r.start), ['1st', 'pit lane', 'grid not recorded', 'shared drive'])
    // None of them is a dot, or a zero.
    assert.equal(gridDiagram(races).boxes.flatMap((b) => b.dots).length, 1)
    // Nothing with a slot: nothing to draw, and no slot figures.
    const unplaced = winnerStarts([rows[1]])
    assert.equal(gridDiagram(unplaced), null)
    assert.equal(dotStrip(unplaced), null)
    assert.equal(value(startsFigures(unplaced, []), 'Won from first on the grid'), undefined)
  })

  it('names ties in full up to three, then counts them', () => {
    const races = winnerStarts([won(2000, 9, 'A', 'T'), won(2001, 9, 'B', 'T'), won(2002, 9, 'C', 'T'), won(2003, 9, 'D', 'T')])
    assert.equal(value(startsFigures(races, []), 'Lowest winning grid slot'), '9th — A, 2000; B, 2001; C, 2002 and 1 more')
    assert.equal(value(startsFigures(races, []), 'Most wins by a driver'), '4 drivers, 1 each')
    assert.equal(value(startsFigures(races.slice(0, 2), []), 'Most wins by a driver'), 'A and B, 1 each')
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

describe('what history says: one layout or all, a race and a Grand Prix (AF-139)', async () => {
  const { SCOPE, grandPrixLine, historyBlock, historyScope, layoutOf, seasonsOver, startsFigures, winnerStarts, winsBy } = await import(
    '../src/queries/circuit.js'
  )
  const won = (year, grid, driver, constructor, extra = {}) => ({
    year,
    round: 1,
    name_used: 'Grand Prix',
    circuit_id: 'here',
    layout_key: null,
    grid,
    grid_text: String(grid),
    driver_id: driver.toLowerCase(),
    driver,
    constructor_id: constructor.toLowerCase(),
    constructor,
    constructor_country: null,
    winners: 1,
    ...extra,
  })
  // Bahrain's timeline as the register holds it: the Grand Prix circuit by
  // year, and two one-offs reached only through the race's layout_key.
  const BAHRAIN = [
    { layout_key: 'gp', layout_name: 'Grand Prix circuit', from_year: 2004, to_year: null, by_year: 1 },
    { layout_key: 'endurance', layout_name: 'Endurance circuit', from_year: 2010, to_year: 2010, by_year: 0 },
    { layout_key: 'outer', layout_name: 'Outer circuit', from_year: 2020, to_year: 2020, by_year: 0 },
  ]
  // Silverstone's last three rows, by year, and nothing for 1949.
  const SILVERSTONE = [
    { layout_key: 'bridge-3', layout_name: 'Bridge circuit, revised', from_year: 1996, to_year: 1996, by_year: 1 },
    { layout_key: 'bridge-4', layout_name: 'Bridge circuit, final form', from_year: 1997, to_year: 2009, by_year: 1 },
    { layout_key: 'arena', layout_name: 'Arena layout', from_year: 2010, to_year: null, by_year: 1 },
  ]

  it('reads a race onto its layout as LAYOUT_RACED_JOIN does: a named one-off, else the by-year row', () => {
    assert.equal(layoutOf(BAHRAIN, 2010, 'endurance').layout_key, 'endurance')
    assert.equal(layoutOf(BAHRAIN, 2010).layout_key, 'gp', 'a race naming no one-off is on the by-year row')
    assert.equal(layoutOf(BAHRAIN, 2020, 'outer').layout_key, 'outer')
    assert.equal(layoutOf(BAHRAIN, 2003), null, 'before the timeline starts')
    assert.equal(layoutOf(BAHRAIN, 2026, 'nowhere'), null, 'a key the timeline does not hold matches nothing')
    assert.equal(layoutOf(SILVERSTONE, 2009).layout_key, 'bridge-4')
    assert.equal(layoutOf(SILVERSTONE, 2010).layout_key, 'arena')
    assert.equal(layoutOf([], 2025), null, 'no timeline, no layout')
  })

  it('counts one layout of a circuit with several, and every layout unless the reader asks', () => {
    const races = winnerStarts([
      won(1996, 3, 'Hill', 'Williams'),
      won(2008, 4, 'Hamilton', 'McLaren'),
      won(2009, 1, 'Vettel', 'Red Bull'),
      won(2010, 2, 'Webber', 'Red Bull'),
      won(2024, 1, 'Hamilton', 'Mercedes'),
      won(2025, 1, 'Norris', 'McLaren'),
    ])
    const latest = races.at(-1)
    const every = historyScope(races, SILVERSTONE, latest, SCOPE.all)
    assert.deepEqual([every.offered, every.scope, every.races.length], [true, SCOPE.all, 6])
    const one = historyScope(races, SILVERSTONE, latest, SCOPE.layout)
    assert.deepEqual([one.scope, one.layout.layout_key, one.races.map((r) => r.year)], [SCOPE.layout, 'arena', [2010, 2024, 2025]])
    // An address value that is not a scope counts every layout.
    assert.equal(historyScope(races, SILVERSTONE, latest, 'bogus').races.length, 6)
    // The block over one layout: its line says which, and its figures are of those races.
    const block = historyBlock({ races, layouts: SILVERSTONE, seasons: [], reference: latest, asked: SCOPE.layout })
    assert.equal(block.line, 'The 3 races won here on this layout (Arena layout, 2010–), of the 6 on every layout.')
    assert.equal(block.figures.find((f) => f.label === 'Most wins by a team').value, 'McLaren, Mercedes and Red Bull, 1 each')
    assert.equal(block.table.reduce((n, row) => n + row.wins, 0), 3)
    assert.match(block.label, /^Wins here by grid slot: /)
    // A layout with no name on record is given its years, never its key.
    const unnamed = historyBlock({ races, layouts: SILVERSTONE.map((l) => ({ ...l, layout_name: null })), reference: latest, asked: SCOPE.layout })
    assert.equal(unnamed.line, 'The 3 races won here on this layout (2010–), of the 6 on every layout.')
    // On a race's own page the line names the circuit.
    const there = historyBlock({ races, layouts: SILVERSTONE, reference: { year: 2026, layout: null }, asked: SCOPE.layout, place: 'at Silverstone' })
    assert.match(there.line, /^The 3 races won at Silverstone on this layout/)
    assert.match(there.label, /^Wins at Silverstone by grid slot: /)
    const all = historyBlock({ races, layouts: SILVERSTONE, reference: { year: 2026, layout: null }, place: 'at Silverstone' })
    assert.equal(all.line, 'All 6 races won at Silverstone, counted together, across the 3 layouts the register records.')
  })

  it('offers no switch where it would change nothing, and keeps a one-off off the layout it interrupts', () => {
    const races = winnerStarts([
      won(2004, 1, 'Schumacher', 'Ferrari'),
      won(2010, 3, 'Alonso', 'Ferrari', { layout_key: 'endurance' }),
      won(2020, 1, 'Perez', 'Racing Point', { round: 16, layout_key: 'outer' }),
      won(2025, 1, 'Piastri', 'McLaren'),
    ])
    const gp = historyScope(races, BAHRAIN, races.at(-1), SCOPE.layout)
    assert.deepEqual(gp.races.map((r) => r.year), [2004, 2025], 'the two one-offs are not the Grand Prix circuit')
    // On the outer circuit's own race, "this layout" is the one-off.
    assert.deepEqual(historyScope(races, BAHRAIN, { year: 2020, layout: 'outer' }, SCOPE.layout).races.map((r) => r.year), [2020])
    // No timeline: no layout, no switch, every race.
    const none = historyScope(races, [], races.at(-1), SCOPE.layout)
    assert.deepEqual([none.offered, none.layout, none.races.length], [false, null, 4])
    // One layout holding every race: the switch would change nothing.
    const only = winnerStarts([won(2011, 1, 'A', 'T'), won(2012, 2, 'B', 'T')])
    assert.equal(historyScope(only, SILVERSTONE, only.at(-1), SCOPE.layout).offered, false)
    // A layout with no race won on it yet - an upcoming race on a new one.
    assert.equal(historyScope(only, [{ layout_key: 'new', from_year: 2026, to_year: null, by_year: 1 }], { year: 2026, layout: null }, SCOPE.layout).offered, false)
    // No race won: no block.
    assert.equal(historyBlock({ races: [] }), null)
  })

  it('counts a Grand Prix held at several venues as one event, and says so', () => {
    const races = winnerStarts([
      won(1959, 1, 'McLaren', 'Cooper', { circuit_id: 'sebring' }),
      won(1960, 1, 'Moss', 'Lotus', { circuit_id: 'riverside' }),
      won(1961, 3, 'Ireland', 'Lotus', { circuit_id: 'watkins-glen' }),
      won(1962, 1, 'Clark', 'Lotus', { circuit_id: 'watkins-glen' }),
    ])
    const block = historyBlock({ races, seasons: [], grandPrix: true })
    assert.equal(block.offered, false, 'no layout is the event\'s')
    assert.match(block.label, /^Wins at this Grand Prix by grid slot: /)
    assert.equal(block.line, 'All 4 races won at this Grand Prix, counted together across the 3 circuits it has been held at, not circuit by circuit.')
    assert.equal(block.figures.find((f) => f.label === 'Most wins by a team').value, 'Lotus, 3')
    assert.equal(grandPrixLine(races.slice(2)), 'All 2 races won at this Grand Prix, all at one circuit.')
    assert.equal(grandPrixLine(races.slice(0, 1)), 'The one race won at this Grand Prix.')
  })

  it('counts a shared win for each driver and each team once, and nobody for an entry with none', () => {
    const races = winnerStarts([
      won(1951, 1, 'Fangio', 'Alfa Romeo', { winners: 2 }),
      won(1951, 7, 'Fagioli', 'Alfa Romeo', { winners: 2 }),
      won(1952, 2, 'Fangio', 'Alfa Romeo'),
      won(1953, 4, 'Nobody', 'X', { driver_id: null, constructor_id: null }),
    ])
    assert.deepEqual(winsBy(races, 'driver_id', 'driver').map((r) => [r.name, r.wins]), [['Fangio', 2], ['Fagioli', 1]])
    assert.deepEqual(winsBy(races, 'constructor_id', 'constructor').map((r) => [r.name, r.wins]), [['Alfa Romeo', 2]])
  })

  it('compares with every circuit over the seasons the races span, and with nothing outside them', () => {
    const seasons = [
      { year: 2009, placed: 17, first: 9, front: 13 },
      { year: 2010, placed: 19, first: 8, front: 14 },
      { year: 2011, placed: 19, first: 12, front: 15 },
    ]
    assert.deepEqual(seasonsOver(seasons, 2010, 2011), { placed: 38, first: 20, front: 29 })
    assert.equal(seasonsOver(seasons, 1950, 1951), null)
    const races = winnerStarts([won(2010, 1, 'A', 'T'), won(2011, 2, 'B', 'T')])
    assert.equal(
      startsFigures(races, seasons).find((f) => f.label === 'Won from first on the grid').value,
      '1 of 2 (50%), against 20 of 38 (53%) at every circuit, 2010–2011',
    )
  })
})

describe('the race weekend forecast (AF-143)', () => {
  // A weekend as the database holds one: Interlagos, its circuit three hours
  // behind UTC, and the point race_weather_modelled holds for it.
  const point = { latitude: -23.701111, longitude: -46.697222, timezone: 'America/Sao_Paulo' }
  const next = { date_from: '2026-11-06', date_to: '2026-11-08', date_iso: '2026-11-08' }
  const sessions = [
    { kind: 'fp1', start_utc: '2026-11-06T15:30Z' },
    { kind: 'qualifying', start_utc: '2026-11-07T18:00Z' },
    // 02:10 UTC on the 9th is 23:10 on the 8th at the circuit.
    { kind: 'race', start_utc: '2026-11-09T02:10Z' },
  ]
  const at = (iso) => Date.parse(iso)
  const params = (request) => Object.fromEntries(new URL(request.url).searchParams)

  it('reads a WMO code as a mark and the word that says the same, and an unknown code as neither', () => {
    assert.deepEqual(sky(0), { mark: 'sun', word: 'Clear' })
    assert.deepEqual(sky(3), { mark: 'cloud', word: 'Cloudy' })
    assert.deepEqual(sky(48), { mark: 'cloud', word: 'Fog' })
    assert.deepEqual(sky(53), { mark: 'rain', word: 'Drizzle' })
    assert.deepEqual(sky(81), { mark: 'rain', word: 'Rain' })
    assert.deepEqual(sky(75), { mark: 'rain', word: 'Snow' })
    assert.deepEqual(sky(95), { mark: 'rain', word: 'Thunderstorms' })
    for (const code of [4, 100, null, undefined, 2.5, '0']) assert.equal(sky(code), null, `code ${code}`)
  })

  it('asks, in the weekend, for the hours of the circuit days its sessions start on, at the point held', () => {
    const request = forecastRequest({ cycle: 'weekend', next, sessions, point }, at('2026-11-06T16:00Z'))
    assert.equal(request.kind, 'sessions')
    assert.ok(request.url.startsWith(`${FORECAST_ENDPOINT}?`))
    assert.deepEqual(params(request), {
      latitude: '-23.701111',
      longitude: '-46.697222',
      timezone: 'America/Sao_Paulo',
      start_date: '2026-11-06',
      // The race's circuit day, not its UTC one.
      end_date: '2026-11-08',
      hourly: 'weather_code,temperature_2m,precipitation_probability',
    })
    // The same address all weekend, so a page left open asks once.
    assert.equal(forecastRequest({ cycle: 'weekend', next, sessions, point }, at('2026-11-07T19:00Z')).url, request.url)
  })

  it('asks for nothing once every session has started, nor with no point, nor in the off state', () => {
    assert.equal(forecastRequest({ cycle: 'weekend', next, sessions, point }, at('2026-11-09T02:10Z')), null)
    assert.equal(forecastRequest({ cycle: 'weekend', next, sessions, point: null }, at('2026-11-06T16:00Z')), null)
    assert.equal(forecastRequest({ cycle: 'weekend', next, sessions, point: { ...point, latitude: null } }, at('2026-11-06T16:00Z')), null)
    assert.equal(forecastRequest({ cycle: 'weekend', next, sessions, point: { ...point, timezone: '' } }, at('2026-11-06T16:00Z')), null)
    assert.equal(forecastRequest({ cycle: 'weekend', next, sessions: [], point }, at('2026-11-06T16:00Z')), null)
    assert.equal(forecastRequest({ cycle: 'off', next, sessions, point }, at('2026-11-02T00:00Z')), null)
    assert.equal(forecastRequest({ cycle: 'preview', next: null, sessions, point }, at('2026-11-02T00:00Z')), null)
  })

  it(`asks, before the weekend, for its days, from ${OUTLOOK_DAYS} days before its first and not sooner`, () => {
    const first = at('2026-11-06T00:00Z')
    const request = forecastRequest({ cycle: 'preview', next, sessions, point }, first - OUTLOOK_DAYS * 86400000)
    assert.equal(request.kind, 'days')
    assert.deepEqual(request.days, ['2026-11-06', '2026-11-07', '2026-11-08'])
    assert.equal(params(request).daily, 'weather_code,temperature_2m_max,precipitation_probability_max')
    assert.equal(params(request).hourly, undefined)
    assert.equal(forecastRequest({ cycle: 'results', next, sessions, point }, first - 86400000).kind, 'days')
    assert.equal(forecastRequest({ cycle: 'preview', next, sessions, point }, first - OUTLOOK_DAYS * 86400000 - 1), null)
    // A race with only its day held is a weekend of one day.
    assert.deepEqual(forecastRequest({ cycle: 'preview', next: { date_iso: '2026-11-08' }, sessions, point }, first).days, ['2026-11-08'])
    assert.equal(forecastRequest({ cycle: 'preview', next: { date_iso: null }, sessions, point }, first), null)
  })

  const hourly = {
    hourly: {
      time: ['2026-11-06T12:00', '2026-11-06T13:00', '2026-11-07T15:00', '2026-11-08T23:00'],
      weather_code: [0, 3, null, 61],
      temperature_2m: [21.4, 22.5, null, -0.2],
      precipitation_probability: [5, 40, null, null],
    },
  }

  it('reads an answer it can, and refuses one it cannot', () => {
    const request = { kind: 'sessions' }
    const rows = readForecast(hourly, request)
    assert.equal(rows.size, 4)
    assert.deepEqual(rows.get('2026-11-07T15:00'), { code: null, temp: null, rain: null })
    assert.equal(readForecast(null, request), null)
    assert.equal(readForecast({ error: true, reason: 'out of range' }, request), null)
    assert.equal(readForecast(hourly, { kind: 'days' }), null, 'an hourly answer is not a daily one')
    assert.equal(readForecast({ hourly: { ...hourly.hourly, temperature_2m: [1, 2] } }, request), null, 'columns of different lengths')
    assert.equal(readForecast({ hourly: { time: [], weather_code: [], temperature_2m: [], precipitation_probability: [] } }, request), null)
  })

  it('gives each session still to start the hour nearest its start, and nothing it was not given', () => {
    const rows = readForecast(hourly, { kind: 'sessions' })
    // fp1 is 12:30 at the circuit, so 13:00; qualifying 15:00, which holds
    // no figure; the race 23:10, so 23:00 on the 8th, with no chance of rain.
    assert.deepEqual(sessionForecasts(rows, sessions, point.timezone, at('2026-11-06T15:00Z')), [
      { mark: 'cloud', text: 'Cloudy · 23 °C · 40% rain' },
      null,
      { mark: 'rain', text: 'Rain · 0 °C' },
    ])
    // And none for a session that has started.
    assert.deepEqual(sessionForecasts(rows, sessions, point.timezone, at('2026-11-06T15:30Z'))[0], null)
    assert.deepEqual(sessionForecasts(null, sessions, point.timezone, at('2026-11-06T15:00Z')), [null, null, null])
  })

  it('gives a line for each day of the weekend it holds a figure for, and none for one it does not', () => {
    const request = { kind: 'days' }
    const rows = readForecast(
      {
        daily: {
          time: ['2026-11-06', '2026-11-07', '2026-11-08'],
          weather_code: [1, null, 4],
          temperature_2m_max: [24.4, null, 19.5],
          precipitation_probability_max: [10, null, 80],
        },
      },
      request,
    )
    assert.deepEqual(outlookDays(rows, ['2026-11-06', '2026-11-07', '2026-11-08']), [
      { day: '2026-11-06', mark: 'sun', text: 'Clear · High of 24 °C · up to 10% rain' },
      // A code outside the table: no mark and no word, and the figures kept.
      { day: '2026-11-08', mark: null, text: 'High of 20 °C · up to 80% rain' },
    ])
    assert.deepEqual(outlookDays(null, ['2026-11-06']), [])
  })

  it('names the day, and when the answer came, in the reader’s form', () => {
    assert.equal(dayName('2026-11-06', 'en-GB'), 'Friday')
    assert.equal(dayName('2026-11-06', 'de-DE'), 'Freitag')
    assert.equal(dayName('6 Nov', 'en-GB'), null)
    assert.equal(updatedAt(Date.UTC(2026, 10, 4, 14, 5), 'UTC', 'en-GB'), '14:05')
    assert.equal(updatedAt(Date.UTC(2026, 10, 4, 14, 5), null, 'en-GB'), '14:05')
    assert.equal(updatedAt(Date.UTC(2026, 10, 4, 14, 5), 'America/Sao_Paulo', 'en-GB'), '11:05')
    assert.equal(updatedAt(Date.UTC(2026, 10, 4, 0, 5), 'UTC', 'en-GB'), '00:05')
    // ICU writes the space before PM as a narrow no-break space, or as a plain one in older versions.
    assert.match(updatedAt(Date.UTC(2026, 10, 4, 14, 5), 'UTC', 'en-US'), /^2:05\sPM$/)
    assert.equal(updatedAt(null, 'UTC', 'en-GB'), null)
    // An answer from an earlier day, on the reader's clock, names its day.
    const came = Date.UTC(2026, 10, 6, 14, 5)
    assert.equal(updatedAt(came, 'UTC', 'en-GB', came + 11 * 3600000), '6 Nov 2026, 14:05')
    assert.equal(updatedAt(came, 'UTC', 'en-GB', came + 3600000), '14:05')
    // 14:05 UTC on the 6th is 03:05 on the 7th in Auckland, and eleven hours on it is still the 7th there.
    assert.equal(updatedAt(came, 'Pacific/Auckland', 'en-GB', came + 11 * 3600000), '03:05')
  })

  it('fetches once an address for the visit, with no credentials and no referrer, and fails on a refusal', async () => {
    const calls = []
    const fetcher = async (url, options) => {
      calls.push([url, options])
      return url.endsWith('ok') ? { ok: true, json: async () => ({ fine: 1 }) } : { ok: false, status: 429 }
    }
    const first = await loadForecast('https://example.test/ok', fetcher)
    const again = await loadForecast('https://example.test/ok', fetcher)
    assert.deepEqual(first.json, { fine: 1 })
    assert.equal(again, first)
    assert.equal(calls.length, 1)
    assert.deepEqual(calls[0][1], { credentials: 'omit', referrerPolicy: 'no-referrer' })
    await assert.rejects(loadForecast('https://example.test/refused', fetcher), /429/)
    await assert.rejects(loadForecast('https://example.test/refused', fetcher), /429/)
    assert.equal(calls.length, 2, 'a failure is not asked for again in the same visit')
    // And an answer is asked for again once it is FRESH_MS old, not before.
    const t = 1_000_000_000_000
    await loadForecast('https://example.test/later-ok', fetcher, t)
    await loadForecast('https://example.test/later-ok', fetcher, t + FRESH_MS - 1)
    assert.equal(calls.length, 3)
    await loadForecast('https://example.test/later-ok', fetcher, t + FRESH_MS)
    assert.equal(calls.length, 4, 'an answer FRESH_MS old is asked for again')
  })
})

describe('the outline as a thumbnail, the circuits won at and the season plate (VD-104)', async () => {
  const { WON_AT_NOTE, wonAt, wonAtCount, winsAt } = await import('../src/lib/outline.js')
  const { seasonPlate, titleStrip: strip } = await import('../src/queries/season.js')

  it('groups a driver’s wins by circuit, most wins first, a tie to the circuit won at last', () => {
    const win = (circuit_id, year, round, outline = null) => ({ circuit_id, circuit: circuit_id.toUpperCase(), year, round, name_used: `${circuit_id} GP`, f1db_layout_id: outline && `${circuit_id}-${year}`, outline })
    const cards = wonAt([win('a', 1990, 1, 'M1'), win('b', 1990, 2), win('c', 1991, 1, 'M3'), win('a', 1992, 1), win('b', 1993, 4, 'M5')])
    assert.deepEqual(cards.map((c) => c.circuit_id), ['b', 'a', 'c'], 'two wins each at a and b, and b was won at last')
    assert.deepEqual(cards.map((c) => c.wins.length), [2, 2, 1])
    assert.equal(cards.reduce((n, c) => n + c.wins.length, 0), 5, 'every win is on a card')
    assert.equal(cards[1].layoutId, 'a-1990', 'a circuit is drawn as the latest win there that has a drawing')
    assert.equal(cards[1].outline, 'M1')
    assert.deepEqual(cards[0].wins.map((w) => w.year), [1990, 1993], 'the wins in date order')
    assert.deepEqual(wonAt([]), [])
    assert.deepEqual(wonAt(null), [])
    assert.equal(wonAtCount(cards), '3 circuits')
    assert.equal(wonAtCount([cards[0]]), '1 circuit')
    assert.equal(winsAt(1), '1 win')
    assert.match(WON_AT_NOTE, /not to scale/)
    assert.match(WON_AT_NOTE, /Jules Roy/)
  })

  it('draws a plate for a concluded season with a champion, and the strip leaves out what it says', () => {
    const season = {
      rounds: 22, drivers_champion: 'max', champion: 'Max', champion_team: 'red-bull', champion_team_name: 'Red Bull Racing',
      champion_team_country: 'Austria', margin: 8, runner_up_name: 'Lewis', constructors_champion: 'mercedes', constructors_champion_name: 'Mercedes', champion_points: 395.5,
    }
    const plate = seasonPlate({ season, year: 2021, running: false })
    assert.equal(plate.label, '2021 World Champion')
    assert.equal(plate.href, 'drivers/max')
    assert.equal(plate.teamHref, 'constructors/red-bull')
    assert.equal(plate.margin, '8')
    assert.equal(plate.sentence, 'points clear of Lewis in the final table, with 395.5 points.')
    assert.ok(plate.colour, 'a 2021 team is in the livery era')
    assert.equal(seasonPlate({ season: { ...season, margin: 1, champion_points: null }, year: 2021, running: false }).sentence, 'point clear of Lewis in the final table.')
    assert.equal(seasonPlate({ season, year: 2021, running: true }), null, 'none while the season is running')
    assert.equal(seasonPlate({ season: { ...season, drivers_champion: null }, year: 2021, running: false }), null, 'none without a champion')
    assert.equal(seasonPlate({ season: { ...season, champion_team: null }, year: 1985, running: false }).colour, null, 'ink where no team is on record')
    const gap = seasonPlate({ season: { ...season, champion_team: 'mclaren', champion_team_name: 'McLaren', champion_team_country: 'United Kingdom' }, year: 1985, running: false })
    assert.equal(gap.colour, null, 'ink for a team on record in a year with no colour (1968 to 2009)')
    assert.equal(gap.team, 'McLaren', 'and the team still named in words')
    const labels = (s) => strip({ season: s, year: 2021, running: false, run: 22, notRun: false }).map((t) => t.label)
    assert.deepEqual(labels(season), ['Rounds', "Constructors' champion"])
    const unmeasured = seasonPlate({ season: { ...season, margin: null }, year: 2021, running: false })
    assert.equal(unmeasured.margin, null, 'no margin stored, no figure')
    assert.equal(unmeasured.sentence, null, 'and no sentence')
    assert.deepEqual(labels({ ...season, margin: null }), ['Rounds', "Drivers' champion", "Constructors' champion", 'Margin'], 'and both tiles stay: the points, and the margin not established')
    assert.deepEqual(labels({ ...season, drivers_champion: null }), ['Rounds', "Drivers' champion", "Constructors' champion", 'Margin'])
  })

  it('gives an onward card that links a race its outline, and none where nothing is drawn', () => {
    const race = { circuit_id: 'monaco', circuit: 'Monaco' }
    const next = (neighbours) => ONWARD.race({ race, year: 2021, winners: [], neighbours }).items.filter(Boolean).find((item) => item.label === 'The next race')
    assert.equal(next({ next: '2021/6', next_outline: 'M0' }).outline, 'M0')
    assert.equal(next({ next: '2021/6', next_outline: null }).outline, null)
    const circuit = ONWARD.circuit({ races: [{ year: 2021, round: 5, name_used: 'Monaco GP', status: 'completed', outline: 'M9' }], winners: [] })
    assert.equal(circuit.items.filter(Boolean)[0].outline, 'M9')
  })
})

describe('the leader in the row and a bar in the points (VD-105, VD-110)', () => {
  it('marks every row at P1, so a shared place at the top marks both and a countback the one placed first', () => {
    const rows = [
      { position: 1, points: 30 },
      { position: 1, points: 30 },
      { position: 3, points: 30 },
      { position: null, points: 40 },
    ]
    assert.deepEqual(rows.map(standingsLeader), [true, true, false, false])
  })

  it('names the champion on their own row, with the round only where it was worked out', () => {
    const season = { drivers_champion: 'antonelli', constructors_champion: 'mercedes' }
    const row = { position: 1, driver_id: 'antonelli', constructor_id: 'mercedes' }
    const crowned = { drivers: { id: 'antonelli', round: 19 }, constructors: { id: 'mercedes', round: null } }
    assert.equal(championPill('drivers', row, season, crowned), 'champion · settled R19')
    assert.equal(championPill('constructors', row, season, crowned), 'champion', 'no round worked out, no round named')
    assert.equal(championPill('drivers', row, season, undefined), 'champion', 'a concluded season')
    assert.equal(championPill('drivers', { ...row, position: 2 }, season, crowned), null, 'only the leader')
    assert.equal(championPill('drivers', row, { drivers_champion: null }, crowned), null, 'a leader who is not yet champion')
    assert.equal(championPill('drivers', { ...row, driver_id: null }, { drivers_champion: null }, crowned), null, 'no id is nobody')
    assert.equal(championPill('drivers', row, season, { drivers: { id: 'russell', round: 19 } }), 'champion', "another's round is not theirs")
  })

  it("measures each total against the highest a classified row holds, from 0 to 1", () => {
    const share = pointsShare([
      { position: 1, points: 390 },
      { position: 2, points: 279 },
      { position: null, points: 400 },
      { position: 3, points: null },
    ])
    assert.equal(share(390), 1)
    assert.equal(share(279), 0.7154)
    assert.equal(share(400), 1, 'an excluded total never draws past the leader')
    assert.equal(share(0), 0)
    assert.equal(share(null), null, 'a total not held draws no bar')
    assert.equal(pointsShare([{ position: 1, points: 0 }])(0), null, 'nothing to measure against')
    assert.equal(pointsShare([])(10), null)
  })
})

import { LABEL_GAP, MARKER, STACKED_GAP, gutterWidth, nudge, placeAbove, placeMarker } from '../src/charts/annotate.js'
import { lineLayout } from '../src/charts/lineChart.js'

describe('the annotation pattern (VD-121)', () => {
  it('nudges colliding labels apart by the gap, in their order, and leaves separate ones where they are', () => {
    const placed = nudge([40, 43, 100])
    assert.equal(placed[2], 100, 'a label clear of the rest stays level with its line')
    assert.ok(placed[1] - placed[0] >= LABEL_GAP - 1e-9, `${placed[0]} and ${placed[1]} are ${LABEL_GAP} apart at least`)
    assert.ok(placed[0] < 40 && placed[1] > 43, 'each moved away from the other, about where they were')
    assert.ok(Math.abs((placed[0] + placed[1]) / 2 - 41.5) < 1e-9, 'centred on where they wanted to be')
    // Level lines keep the caller's order, the first above.
    const level = nudge([50, 50])
    assert.ok(level[0] < level[1], 'two ends level: the first listed is placed above')
    // A group pushed into the next merges with it, so no two end up closer.
    const three = nudge([10, 20, 30, 34])
    for (let k = 1; k < three.length; k += 1) assert.ok(three[k] - three[k - 1] >= LABEL_GAP - 1e-9, `${three.join(', ')}`)
    // Held inside the bounds where the stack fits.
    const held = nudge([0, 2], { min: 6, max: 200 })
    assert.equal(held[0], 6)
    assert.equal(held[1], 6 + LABEL_GAP)
    assert.deepEqual(nudge([]), [])
  })

  it('makes the gutter as wide as the widest label, and none where nothing is labelled', () => {
    assert.equal(gutterWidth([]), 0)
    const short = gutterWidth([{ name: 'Hunt', value: '69' }])
    const long = gutterWidth([{ name: 'Hunt', value: '69' }, { name: 'Verstappen', value: '279' }])
    assert.ok(long > short, `${long} for Verstappen 279 against ${short} for Hunt 69`)
    assert.ok(gutterWidth([{ name: null, value: '33%' }]) < short, 'a value alone needs less than a name and a value')
  })

  it('puts a marker above its point, below where above leaves the drawing or sits on a line, and clear of another marker', () => {
    const up = placeMarker(100, 100, [])
    assert.equal(up.cy, 100 - MARKER.offset)
    assert.ok(up.leader.y1 < 100 && up.leader.y2 > up.cy, 'the hairline runs from the point up to the disc')
    assert.equal(placeMarker(100, 12, [], { top: 0 }).cy, 12 + MARKER.offset, 'no room above the top edge')
    assert.equal(placeMarker(100, 100, [100 - MARKER.offset + 2]).cy, 100 + MARKER.offset, 'another line where the disc would go')
    const first = placeMarker(100, 100, [])
    const second = placeMarker(104, 100, [], { taken: [first] })
    const reach = MARKER.r + MARKER.ring / 2
    assert.ok(Math.hypot(second.cx - first.cx, second.cy - first.cy) >= 2 * reach, 'two markers a round apart do not overlap')
  })

  it('puts a column’s marker above it only, raised clear of one already placed, and over a band with no hairline (VD-123)', () => {
    const one = placeAbove(100, 100)
    assert.equal(one.cy, 100 - MARKER.offset)
    assert.deepEqual([one.leader.y1, one.leader.y2], [100 - MARKER.gap, one.cy + MARKER.r])
    const apart = 2 * (MARKER.r + MARKER.ring / 2) + 2
    // A round apart on a phone: the second disc goes up, never down into its column.
    const two = placeAbove(105, 106, { taken: [one] })
    assert.ok(two.cy < one.cy, 'raised, not lowered')
    assert.ok(Math.hypot(two.cx - one.cx, two.cy - one.cy) >= apart - 0.02, 'clear of the first')
    assert.ok(Math.hypot(two.cx - one.cx, two.cy - one.cy) < apart + 0.5, 'and no further up than it must go')
    // Far enough apart, nothing moves.
    assert.equal(placeAbove(200, 100, { taken: [one] }).cy, 100 - MARKER.offset)
    assert.equal(placeAbove(100, 100, { leader: false }).leader, null)
  })

  // The home chart's seasons, cut down: a steady stretch, a tied peak side by
  // side, a season part run and a calendar.
  const homeSeasons = (now) => [
    { year: 1950, rounds: 7, run: 7, indianapolis: 1 },
    { year: 1951, rounds: 8, run: 8, indianapolis: 1 },
    ...[16, 16, 17, 16, 16, 17].map((rounds, k) => ({ year: 1984 + k, rounds, run: rounds, indianapolis: 0 })),
    { year: 1990, rounds: 19, run: 19, indianapolis: 0 },
    { year: 2024, rounds: 24, run: 24, indianapolis: 0 },
    { year: 2025, rounds: 24, run: 24, indianapolis: 0 },
    now,
    { year: 2027, rounds: 24, run: 0, indianapolis: 0 },
  ]

  it('works the home chart’s finding and notes out from the rows (VD-123)', () => {
    const shown = chartNotes(homeSeasons({ year: 2026, rounds: 23, run: 20, indianapolis: 0 }))
    assert.equal(shown.finding, 'Seven races in 1950; 24 by 2024.')
    assert.equal(shown.kicker, 'Championship rounds per season')
    assert.deepEqual(
      shown.notes.map((n) => `${n.n}. ${n.lead}: ${n.text}`),
      [
        '1. 1950: seven rounds: The first championship, the Indianapolis 500 included.',
        '2. 1984–1989: 16 or 17, every year: Six seasons in a row within a round of each other, shaded.',
        '3. 2024 and 2025: 24: The most in any completed season.',
        '4. 2026: 20 of 23 run: In red; the three to come are dashed above. 2027 is a calendar.',
      ],
    )
    // One marker to a note, the tied peak's one over both its seasons; the
    // band's over the band with no hairline, and shaded from its first season to its last.
    assert.deepEqual(
      shown.marks.map((m) => [m.n, m.keys.join(','), m.leader]),
      [
        [1, '1950', true],
        [2, '1984,1985,1986,1987,1988,1989', false],
        [3, '2024,2025', true],
        [4, '2026', true],
      ],
    )
    assert.deepEqual(shown.bands, [{ from: 1984, to: 1989 }])
  })

  it('names the season raced last once it is complete, and the peak where it ties (VD-123)', () => {
    // Complete and level with the peak: the peak's note names the seasons
    // before it, and says it was matched.
    const level = chartNotes(homeSeasons({ year: 2026, rounds: 24, run: 24, indianapolis: 0 }))
    assert.deepEqual(
      level.notes.slice(2).map((n) => `${n.lead}: ${n.text}`),
      ['2024 and 2025: 24: The most in any completed season, matched in 2026.', '2026: 24 rounds: In red, the season run last. 2027 is a calendar.'],
    )
    // Complete and past it: no peak note of its own, and the finding names it.
    const most = chartNotes(homeSeasons({ year: 2026, rounds: 25, run: 25, indianapolis: 0 }))
    assert.equal(most.finding, 'Seven races in 1950; 25 by 2026.')
    assert.deepEqual(
      most.notes.map((n) => n.lead),
      ['1950: seven rounds', '1984–1989: 16 or 17, every year', '2026: 25 rounds'],
    )
    assert.equal(most.notes[2].text, 'In red, the season run last: the most in any season. 2027 is a calendar.')
    assert.deepEqual(most.marks.map((m) => m.n), [1, 2, 3])
    // Nothing raced: no finding and no notes.
    assert.deepEqual(chartNotes([{ year: 2027, rounds: 24, run: 0, indianapolis: 0 }]).notes, [])
    // The first season holding the peak: the finding does not set it against itself.
    const flat = [
      { year: 1950, rounds: 7, run: 7, indianapolis: 1 },
      { year: 1951, rounds: 7, run: 7, indianapolis: 1 },
      { year: 1952, rounds: 6, run: 6, indianapolis: 1 },
      { year: 1953, rounds: 7, run: 3, indianapolis: 0 },
    ]
    const held = chartNotes(flat)
    assert.equal(held.finding, 'Seven races in 1950, never more.')
    // and a peak it shares is marked over the season after it, and named with it.
    assert.deepEqual(
      held.notes.map((n) => n.lead),
      ['1950: seven rounds', '1950 and 1951: 7', '1953: 3 of 7 run'],
    )
    assert.deepEqual(held.marks.map((m) => m.keys), [[1950], [1951], [1953]])
  })

  // The whole home series, every season 1950-2027 as the register held it in
  // November 2026, so the layout is tested on columns as thin as the page's
  // (the confirmation of #1409: the cut-down series' columns are wider, and
  // hid a hairline starting inside a neighbouring disc on a phone).
  const ROUNDS = [
    7, 8, 8, 9, 9, 7, 8, 8, 11, 9, 10, 8, 9, 10, 10, 10, 9, 11, 12, 11, 13, 11, 12, 15, 15, 14, 16, 17, 16, 15, 14, 15, 16, 15, 16, 16, 16,
    16, 16, 16, 16, 16, 16, 16, 16, 17, 16, 17, 16, 16, 17, 17, 17, 16, 18, 19, 18, 17, 18, 17, 19, 19, 20, 19, 19, 19, 21, 20, 21, 21,
    17, 22, 22, 22, 24, 24, 23, 24,
  ]
  const wholeSeries = ROUNDS.map((rounds, k) => {
    const year = 1950 + k
    return { year, rounds, run: year === 2026 ? 20 : year === 2027 ? 0 : rounds, indianapolis: year <= 1960 ? 1 : 0 }
  })

  it('lays the whole home series’ markers out sound at every width from 250 to 1800 px (VD-123)', () => {
    const shown = chartNotes(wholeSeries)
    assert.deepEqual(shown.marks.map((m) => m.keys.length > 0), [true, true, true, true])
    const reach = MARKER.r + MARKER.ring / 2
    for (let width = 250; width <= 1800; width += 1) {
      const layout = columnLayout({ data: chartData(wholeSeries), width, height: 260, labelPeak: false, marks: shown.marks, bands: shown.bands })
      const where = (m) => `${width}: marker ${m.n} at (${m.cx.toFixed(1)}, ${m.cy.toFixed(1)})`
      assert.equal(layout.markers.length, 4, `${width}: every note has its marker`)
      for (const m of layout.markers) {
        assert.ok(m.cy - reach >= -1e-9 && m.cx - reach >= -1e-9 && m.cx + reach <= width + 1e-9, `${where(m)} is inside the drawing`)
        // Over no column it reaches: the column's own edges, read off its path.
        for (const c of layout.columns) {
          const half = c.centre - Number(c.path.match(/^M([-\d.]+),/)[1])
          if (Math.abs(c.centre - m.cx) <= reach + half) assert.ok(m.cy + reach <= c.peak + 1e-9, `${where(m)} clears ${c.d.key}'s column`)
        }
        for (const o of layout.markers) {
          if (o === m) continue
          assert.ok(Math.hypot(m.cx - o.cx, m.cy - o.cy) >= 2 * reach, `${where(m)} and marker ${o.n} do not overlap`)
          if (!m.leader) continue
          const { x1, y1, x2, y2 } = m.leader
          const t = Math.max(0, Math.min(1, ((o.cx - x1) * (x2 - x1) + (o.cy - y1) * (y2 - y1)) / ((x2 - x1) ** 2 + (y2 - y1) ** 2)))
          const d = Math.hypot(x1 + t * (x2 - x1) - o.cx, y1 + t * (y2 - y1) - o.cy)
          assert.ok(d >= reach, `${where(m)}: its hairline clears marker ${o.n}'s disc (${d.toFixed(1)})`)
        }
      }
    }
  })

  it('lays the home chart’s markers out inside the drawing at every width, none touching another (VD-123)', () => {
    const seasons = homeSeasons({ year: 2026, rounds: 23, run: 20, indianapolis: 0 })
    const shown = chartNotes(seasons)
    const reach = MARKER.r + MARKER.ring / 2
    for (const width of [300, 320, 343, 352, 375, 400, 640, 900]) {
      const layout = columnLayout({ data: chartData(seasons), width, height: 260, labelPeak: false, marks: shown.marks, bands: shown.bands })
      assert.deepEqual(layout.markers.map((m) => m.n), [1, 2, 3, 4], `${width}: every note has its marker`)
      for (const m of layout.markers) assert.ok(m.cy - reach >= -1e-9, `${width}: marker ${m.n} is inside the drawing (${m.cy})`)
      for (let a = 0; a < layout.markers.length; a += 1)
        for (let b = a + 1; b < layout.markers.length; b += 1) {
          const [p, q] = [layout.markers[a], layout.markers[b]]
          assert.ok(Math.hypot(p.cx - q.cx, p.cy - q.cy) >= 2 * reach, `${width}: markers ${p.n} and ${q.n} do not overlap`)
        }
      // No hairline runs through another marker's disc: on a phone 2026's
      // and the 2024-25 peak's stand a few pixels apart (the review of #1409).
      for (const m of layout.markers) {
        if (!m.leader) continue
        const { x1, y1, x2, y2 } = m.leader
        for (const o of layout.markers) {
          if (o === m) continue
          const t = Math.max(0, Math.min(1, ((o.cx - x1) * (x2 - x1) + (o.cy - y1) * (y2 - y1)) / ((x2 - x1) ** 2 + (y2 - y1) ** 2)))
          const d = Math.hypot(x1 + t * (x2 - x1) - o.cx, y1 + t * (y2 - y1) - o.cy)
          assert.ok(d >= reach, `${width}: marker ${m.n}'s hairline clears marker ${o.n}'s disc (${d.toFixed(1)})`)
        }
      }
      // Each disc stands over its columns, no lower than their top.
      const top = (keys) => Math.min(...layout.columns.filter((c) => keys.includes(c.d.key)).map((c) => c.peak))
      for (const [k, m] of layout.markers.entries()) assert.ok(m.cy + reach <= top(shown.marks[k].keys), `${width}: marker ${m.n} clears its columns`)
      const [band] = layout.bands
      const inBand = layout.columns.filter((c) => c.d.key >= 1984 && c.d.key <= 1989)
      assert.ok(band.x <= inBand[0].centre && band.x + band.width >= inBand.at(-1).centre, `${width}: the band spans its seasons`)
      assert.ok(layout.columns.filter((c) => c.d.key === 1990).every((c) => c.centre > band.x + band.width), `${width}: and stops before the next`)
    }
  })

  // Two lines ending a point apart, as 1976 did: before VD-121 the second
  // end's label was dropped.
  const converging = [
    { name: 'James Hunt', label: 'Hunt', points: [{ x: 1, y: 0 }, { x: 2, y: 30 }, { x: 3, y: 69 }] },
    { name: 'Niki Lauda', label: 'Lauda', points: [{ x: 1, y: 9 }, { x: 2, y: 61 }, { x: 3, y: 68 }] },
    { name: 'Jody Scheckter', label: 'Scheckter', points: [{ x: 1, y: 2 }, { x: 2, y: 36 }, { x: 3, y: 49 }] },
  ]

  it('sets each label name over value where one line would take more than its share of a narrow chart', () => {
    const long = converging.map((s, i) => ({ ...s, label: ['Verstappen', 'Hamilton', 'Bottas'][i], points: s.points.map((p) => ({ ...p, y: p.y + 0.5 })) }))
    const wide = lineLayout({ series: long, width: 480, height: 250 })
    assert.ok(wide.lines.every((l) => !l.end.label.stacked), 'at 480 each label is one line')
    const narrow = lineLayout({ series: long, width: 250, height: 250 })
    const labels = narrow.lines.map((l) => l.end.label)
    assert.ok(labels.every((l) => l.stacked), 'at 250 each is name over value')
    assert.ok(narrow.right - narrow.left > 250 * 0.45, `the plot keeps its room (${Math.round(narrow.right - narrow.left)} px)`)
    assert.ok(250 - narrow.right < gutterWidth(labels), 'a narrower gutter than one line would need')
    const ys = labels.map((l) => l.y).sort((a, b) => a - b)
    for (let k = 1; k < ys.length; k += 1) assert.ok(ys[k] - ys[k - 1] >= STACKED_GAP - 1e-9, `stacked labels at ${ys.join(', ')}`)
    assert.ok(labels.every((l) => l.nameY < l.y && l.valueY > l.y && l.nameY - 10 >= 0 && l.valueY + 10 <= 250), 'each line inside the drawing')
    const alone = lineLayout({ series: [long[0]], width: 250, height: 250 })
    assert.ok(!alone.lines[0].end.label.stacked, 'a value alone is never stacked')
  })

  it('labels every line end in the gutter, converging or not, at least the gap apart, each on a hairline from its own end', () => {
    const layout = lineLayout({ series: converging, width: 480, height: 250 })
    const labels = layout.lines.map((l) => l.end.label)
    assert.deepEqual(
      labels.map((l) => `${l.name} ${l.value}`),
      ['Hunt 69', 'Lauda 68', 'Scheckter 49'],
    )
    const ys = labels.map((l) => l.y).sort((a, b) => a - b)
    for (let k = 1; k < ys.length; k += 1) assert.ok(ys[k] - ys[k - 1] >= LABEL_GAP - 1e-9, `labels at ${ys.join(', ')}`)
    for (const [i, l] of labels.entries()) {
      const { end } = layout.lines[i]
      assert.ok(l.x > layout.right, 'the label is in the gutter, right of the plot')
      assert.deepEqual(l.leader[0], [end.x + MARKER.gap + 1, end.y], 'the hairline starts at its own line end')
      assert.equal(l.leader[l.leader.length - 1][1], l.y, 'and ends level with its label')
    }
    assert.ok(labels[0].y < labels[1].y, 'Hunt, a point ahead, is labelled above Lauda')
  })

  it('names a lone series by its value alone, runs the axis to xMax, and lays out marks and bands', () => {
    const alone = lineLayout({ series: [converging[0]], width: 480 })
    assert.equal(alone.lines[0].end.label.name, null)
    const longer = lineLayout({ series: converging, width: 480, xMax: 6 })
    assert.equal(longer.x.domain[1], 6, 'the axis runs on to the calendar')
    assert.ok(longer.lines[0].end.x < longer.right, 'and the lines stop short of its end')
    const marked = lineLayout({ series: converging, width: 480, marks: [{ n: 1, series: 1, x: 2 }, { n: 2, series: 0, x: 9 }], bands: [{ from: 2, to: 3 }] })
    assert.deepEqual(marked.markers.map((m) => m.n), [1], 'a mark on a round its line does not reach is not drawn')
    assert.equal(marked.markers[0].cx, marked.x(2))
    assert.equal(marked.bands.length, 1)
    assert.equal(marked.bands[0].x, marked.x(2))
    assert.equal(marked.bands[0].width, marked.x(3) - marked.x(2))
  })

  it('shortens a name to the surname, keeping a particle or a suffix, and keeps both full names where two would match', () => {
    assert.deepEqual(shortNames(['James Hunt', 'Wolfgang von Trips', 'Elio de Angelis', 'Nelson Piquet Jr.', 'Andrea Kimi Antonelli']), [
      'Hunt',
      'von Trips',
      'de Angelis',
      'Piquet Jr.',
      'Antonelli',
    ])
    assert.deepEqual(shortNames(['Graham Hill', 'Phil Hill', 'Jim Clark']), ['Graham Hill', 'Phil Hill', 'Clark'])
  })

  it('says how a race ended from the entry, and nothing for a shared drive', () => {
    const e = (fields) => ({ finish_position: null, position_text: null, status: null, laps_completed: null, ...fields })
    assert.equal(raceEnded([e({ finish_position: 1, position_text: '1' })]), 'wins')
    assert.equal(raceEnded([e({ finish_position: 3, position_text: '3' })]), 'finishes 3rd')
    assert.equal(raceEnded([e({ position_text: 'DNF', status: 'Accident' })]), 'crashes out')
    assert.equal(raceEnded([e({ position_text: 'DNF', status: 'Withdrew', laps_completed: 2 })]), 'withdraws after two laps')
    assert.equal(raceEnded([e({ position_text: 'DNF', status: 'Withdrew', laps_completed: 0 })]), 'withdraws')
    assert.equal(raceEnded([e({ position_text: 'DNF', status: 'Fuel system' })]), 'retires (fuel system)')
    assert.equal(raceEnded([e({ position_text: 'DNF' })]), 'retires')
    assert.equal(raceEnded([e({ position_text: 'DNS', status: 'Accident in practice' })]), 'does not start (accident in practice)')
    assert.equal(raceEnded([e({ position_text: 'DNS', status: 'DNS' })]), 'does not start')
    assert.equal(raceEnded([e({ position_text: 'DSQ', status: 'Underweight' })]), 'is disqualified')
    assert.equal(raceEnded([e({ position_text: 'DNP' })]), null)
    assert.equal(raceEnded([e({ finish_position: 2 }), e({ finish_position: 5 })]), null)
    assert.equal(raceEnded([]), null)
  })

  // A season of four rounds, written out: A leads three, B takes the last.
  const row = (round, id, name, pts) => ({ table_type: 'drivers', after_round: round, driver_id: id, entity: name, points: pts, position: 1 })
  const table = (round, totals) => Object.entries(totals).map(([id, pts]) => row(round, id, `Driver ${id.toUpperCase()}`, pts))
  const short = (_id, name) => name.split(' ').pop()

  it('finds who led, and declines a lead that was shared or a table with a gap', () => {
    const standings = [...table(1, { a: 9, b: 6 }), ...table(2, { a: 15, b: 15 }), ...table(3, { a: 24, b: 21 }), ...table(4, { a: 24, b: 30 })]
    const leaders = leadersByRound(standings)
    assert.deepEqual(leaders.map((l) => l.id), ['a', null, 'a', 'b'], 'level after round 2 is nobody leading')
    assert.deepEqual(leaders[1].level, ['a', 'b'])
    assert.equal(titleFinding(leaders, false, short), 'A led after two rounds. B led after one: the last')
    assert.equal(titleFinding(leaders, true, short), 'B took the lead after round 4')
    const always = leadersByRound([...table(1, { a: 9, b: 6 }), ...table(2, { a: 18, b: 12 })])
    assert.equal(titleFinding(always, false, short), 'A led after every round')
    assert.equal(titleFinding(always, true, short), 'A has led after every round so far')
    const from = leadersByRound([...table(1, { a: 9, b: 6 }), ...table(2, { a: 9, b: 15 }), ...table(3, { a: 9, b: 24 })])
    assert.equal(titleFinding(from, false, short), 'B led after every round from round 2')
    const back = leadersByRound([...table(1, { a: 6, b: 9 }), ...table(2, { a: 15, b: 9 }), ...table(3, { a: 15, b: 18 }), ...table(4, { a: 24, b: 18 })])
    assert.equal(titleFinding(back, false, short), 'A led after two of the four rounds, including the last')
    assert.equal(titleFinding(leadersByRound([...table(1, { a: 9, b: 6 }), ...table(3, { a: 18, b: 6 })]), false, short), null, 'round 2 missing')
    assert.equal(titleFinding(leaders.slice(0, 2), false, short), null, 'level after the last round')
    // A source giving one driver two totals for one round: no leader there.
    assert.equal(leadersByRound([row(1, 'a', 'Driver A', 9), row(1, 'a', 'Driver A', 6), row(1, 'b', 'Driver B', 3)])[0].id, null)
  })

  // The whole figure, from rows written out: a five-round season with an
  // absence, decided at the last round. No f1.db, so it holds wherever it runs.
  const rounds = [1, 2, 3, 4, 5].map((round) => ({ round, name_used: `Grand Prix ${round}`, status: 'completed', sprint: 0 }))
  const drivers = [
    { driver_id: 'b', entity: 'Driver B', points: 25 },
    { driver_id: 'a', entity: 'Driver A', points: 24 },
    { driver_id: 'c', entity: 'Driver C', points: 10 },
  ]
  const standings = [
    ...table(1, { a: 9, b: 6, c: 2 }),
    ...table(2, { a: 18, b: 12, c: 4 }),
    ...table(3, { a: 18, b: 18, c: 6 }),
    ...table(4, { a: 24, b: 21, c: 8 }),
    ...table(5, { a: 24, b: 25, c: 10 }),
  ]
  const entry = (round, id, fields) => ({ round, driver_id: id, finish_position: null, position_text: null, status: null, laps_completed: null, ...fields })
  const entries = [
    ...[1, 2, 3, 4, 5].flatMap((r) => [entry(r, 'b', { finish_position: 2, position_text: '2' }), entry(r, 'c', { finish_position: 4, position_text: '4' })]),
    entry(1, 'a', { finish_position: 1, position_text: '1' }),
    entry(2, 'a', { position_text: 'DNF', status: 'Accident' }),
    entry(5, 'a', { position_text: 'DNF', status: 'Withdrew', laps_completed: 2 }),
  ]
  const figure = (over = {}) =>
    titleRaceFigure({
      year: 1976,
      live: false,
      drivers,
      standings,
      teams: new Map(),
      remaining: { dropped_scores: 'Best 7 results', races: 0 },
      rounds,
      entries,
      champion: 'b',
      ...over,
    })

  it('marks the longest absence and a title decided at the last round, with every word in the key', () => {
    const race = figure()
    assert.equal(race.finding, 'A led after three rounds. B led after one: the last')
    assert.equal(race.kicker, 'Points after each round')
    assert.deepEqual(race.series.map((s) => s.label), ['B', 'A', 'C'])
    assert.deepEqual(race.annotations, [
      { n: 1, lead: 'R2, Grand Prix 2', text: 'A crashes out, then misses R3 and R4 (shaded).' },
      { n: 2, lead: 'R5, Grand Prix 5', text: 'A withdraws after two laps. B finishes 2nd and takes the title by a point.' },
    ])
    assert.deepEqual(race.marks, [{ n: 1, series: 1, x: 2 }, { n: 2, series: 0, x: 5 }], 'each on its own line, at its round')
    assert.deepEqual(race.bands, [{ from: 2, to: 4 }])
    assert.equal(race.xMax, null, 'a concluded season draws the rounds it ran')
  })

  it('says nothing of a round none of the three entered, and nothing it cannot establish', () => {
    // Round 3 entered by nobody drawn - the Indianapolis 500 to 1960 - is no absence.
    const noIndy = entries.filter((e) => e.round !== 3).concat(entry(4, 'a', { finish_position: 1, position_text: '1' }))
    assert.deepEqual(
      figure({ entries: noIndy }).annotations.map((a) => a.text),
      ['A withdraws after two laps. B finishes 2nd and takes the title by a point.'],
    )
    // The champion on the record is not the one who leads the final table: no decider.
    assert.deepEqual(figure({ champion: 'a' }).marks.map((m) => m.x), [2])
    // A fatal accident is said in the record's words, and nothing is shaded.
    const fatal = entries.map((e) => (e.round === 2 && e.driver_id === 'a' ? { ...e, status: 'Fatal accident' } : e))
    const race = figure({ entries: fatal })
    assert.equal(race.annotations[0].text, 'A: fatal accident.')
    assert.deepEqual(race.bands, [])
    // A fatal ending outranks a longer absence (1961: von Trips, not Hill):
    // C is killed at round 4 and misses one round, A misses two.
    const killed = entries
      .filter((e) => !(e.driver_id === 'c' && e.round === 5))
      .map((e) => (e.driver_id === 'c' && e.round === 4 ? { ...e, finish_position: null, position_text: 'DNF', status: 'Fatal accident' } : e))
    const first = figure({ entries: killed }).annotations[0]
    assert.deepEqual([first.lead, first.text], ['R4, Grand Prix 4', 'C: fatal accident.'])
    // A disqualification is not set before an absence as if it caused it.
    const dsq = entries.map((e) => (e.round === 2 && e.driver_id === 'a' ? { ...e, position_text: 'DSQ', status: 'Disqualified' } : e))
    assert.equal(figure({ entries: dsq }).annotations[0].text, 'A misses R3 and R4 (shaded).')
  })

  it("says how a race ended without repeating the result as its reason", () => {
    const one = (fields) => [{ finish_position: null, position_text: null, status: null, laps_completed: null, ...fields }]
    assert.equal(raceEnded(one({ position_text: 'DNF', status: 'Retired' })), 'retires')
    assert.equal(raceEnded(one({ position_text: 'DNF', status: 'Engine' })), 'retires (engine)')
    assert.equal(raceEnded(one({ position_text: 'DNF', status: null })), 'retires')
  })

  it('marks the round a title was settled with rounds to run, where the season counted every result', () => {
    // Ten-point wins and no fastest-lap point; after round 3 of 5, B is 21
    // clear with 20 left.
    const settled = [
      ...table(1, { a: 0, b: 10, c: 6 }),
      ...table(2, { a: 6, b: 20, c: 6 }),
      ...table(3, { a: 6, b: 30, c: 9 }),
    ]
    const live = titleRaceFigure({
      year: 2030,
      live: true,
      drivers: [
        { driver_id: 'b', entity: 'Driver B', points: 30 },
        { driver_id: 'c', entity: 'Driver C', points: 9 },
        { driver_id: 'a', entity: 'Driver A', points: 6 },
      ],
      standings: settled,
      teams: new Map(),
      remaining: { dropped_scores: EVERY_RESULT_COUNTS, races: 2, win_points: 10, fastest_lap_points: 0, scale: '[10,6,4,3,2,1]', sprint_scale: null },
      rounds: rounds.map((r) => (r.round > 3 ? { ...r, status: 'scheduled' } : r)),
      entries: [1, 2, 3].flatMap((r) => ['a', 'b', 'c'].map((id) => entry(r, id, { finish_position: 1, position_text: '1' }))),
      champion: 'b',
    })
    assert.deepEqual(live.annotations, [{ n: 1, lead: 'R3, Grand Prix 3', text: 'B settles the title with two rounds to run.' }])
    assert.equal(live.finding, 'B has led after every round so far')
    assert.equal(live.xMax, 5, 'a season being run draws its whole calendar')
  })
})

describe("the team-mates face-off (VD-122), on rows written out", async () => {
  const { faceOffs, FACE_OFFS } = await import('../src/queries/driver.js')
  const { faceColours } = await import('../src/charts/own.js')
  // One TEAM_MATES row: a season with one team-mate, the driver's figure first.
  const row = (year, mate, [qa, qb, bq], [fa, fb, bc], [p, mp], { races = 10, round = 10, team = 'mclaren', name = 'McLaren', country = 'United Kingdom' } = {}) => ({
    year, constructor_id: team, constructor: name, constructor_country: country, mate_id: mate.toLowerCase(), mate: `Some ${mate}`, last_round: year * 100 + round,
    races, both_qualified: bq, qualified_ahead: qa, qualified_behind: qb, both_classified: bc, finished_ahead: fa, finished_behind: fb, points: p, mate_points: mp,
  })
  // Newest first, as the query orders them.
  const rows = [
    row(2024, 'Late', [3, 7, 10], [2, 4, 6], [20, 40], { races: 10 }),
    row(2022, 'Long', [12, 8, 20], [9, 9, 18], [100, 90.5], { races: 20 }),
    row(2021, 'Long', [10, 10, 20], [7, 9, 16], [80, 60], { races: 20 }),
    row(2019, 'Mid', [6, 4, 10], [5, 3, 8], [30, 10], { races: 15 }),
    row(2018, 'Short', [1, 0, 1], [0, 0, 0], [0, 0], { races: 1 }),
  ]
  const face = faceOffs('A Driver', rows)

  it('shows the latest team-mate and the others with the most Grands Prix together, latest first', () => {
    assert.equal(FACE_OFFS, 3)
    assert.deepEqual(face.blocks.map((b) => b.mate_id), ['late', 'long', 'mid'])
    assert.match(face.note, /Shown first: the latest team-mate and the two others with the most Grands Prix together; the other one follows under “Show all 4 team-mates”, latest first, and the table has every pairing\./)
  })
  // VD-130: every other team-mate has a block, behind one disclosure.
  it('puts every other team-mate behind the disclosure, latest first, and names it for the whole count', () => {
    assert.deepEqual(face.more.map((b) => b.mate_id), ['short'])
    assert.deepEqual(face.fold, { more: 'Show all 4 team-mates', less: 'Show the first 3' })
    const many = faceOffs('A Driver', [
      row(2024, 'Late', [3, 7, 10], [2, 4, 6], [20, 40], { races: 10 }),
      row(2023, 'Few', [1, 0, 1], [0, 0, 0], [0, 0], { races: 1 }),
      row(2022, 'Long', [12, 8, 20], [9, 9, 18], [100, 90.5], { races: 20 }),
      row(2020, 'Fewer', [1, 0, 1], [0, 0, 0], [0, 0], { races: 1, round: 2 }),
      row(2020, 'Fewest', [1, 0, 1], [0, 0, 0], [0, 0], { races: 1, round: 1 }),
      row(2019, 'Mid', [6, 4, 10], [5, 3, 8], [30, 10], { races: 15 }),
    ])
    assert.deepEqual(many.blocks.map((b) => b.mate_id), ['late', 'long', 'mid'])
    assert.deepEqual(many.more.map((b) => b.mate_id), ['few', 'fewer', 'fewest'], 'the rest by their last round together, newest first')
    assert.equal(new Set([...many.blocks, ...many.more].map((b) => b.mate_id)).size, 6, 'every team-mate once')
    assert.match(many.note, /the other three follow under “Show all 6 team-mates”/)
    const few = faceOffs('A Driver', rows.slice(0, 4))
    assert.deepEqual([few.more, few.fold], [[], null], 'three team-mates or fewer have no disclosure')
    assert.match(few.note, / The table has every pairing\.$/)
  })
  it('keys the colours of the blocks behind the disclosure as well', () => {
    const hidden = faceOffs('A Driver', [
      row(2024, 'A', [1, 0, 1], [1, 0, 1], [1, 0], { races: 10 }),
      row(2023, 'B', [1, 0, 1], [1, 0, 1], [1, 0], { races: 10 }),
      row(2022, 'C', [1, 0, 1], [1, 0, 1], [1, 0], { races: 10 }),
      row(1955, 'D', [1, 0, 1], [1, 0, 1], [1, 0], { races: 1, team: 'maserati', name: 'Maserati', country: 'Italy' }),
    ])
    assert.deepEqual(hidden.more.map((b) => b.mate_id), ['d'])
    assert.match(hidden.note, /or in ink where it has none/, 'the national colour with no second is only behind the disclosure')
  })
  it('sums the table\'s own columns, and says who led with the leader\'s figure first', () => {
    const long = face.blocks[1]
    assert.deepEqual(long.tallies.map((t) => [t.mine, t.theirs, t.ahead]), [['22', '18', 'mine'], ['16', '18', 'theirs'], ['180', '150.5', 'mine']])
    assert.equal(long.when, '2021–22 · 2 seasons')
    assert.equal(long.verdict, 'Driver ahead in qualifying and on points; Long ahead on finishes.')
    assert.deepEqual(face.headline, { text: 'Late out-qualified Driver', figure: '7–3' })
    assert.equal(face.standfirst, 'One season together at McLaren. Across 4 team-mates, Driver was ahead in qualifying in 3 of 5 team-mate seasons, level in 1, behind in 1.')
  })
  it('says every season only where every season went one way', () => {
    assert.equal(face.blocks[0].verdict, 'Late ahead on all three counts.')
    const two = faceOffs('A Driver', [row(2020, 'Mate', [6, 4, 10], [5, 3, 8], [30, 10]), row(2019, 'Mate', [6, 4, 10], [5, 3, 8], [30, 10])])
    assert.equal(two.blocks[0].verdict, 'Driver ahead on all three counts, every season.')
  })
  it('reads an unestablished count as not established, never 0–0, and draws no bar for it', () => {
    const none = faceOffs('A Driver', [row(1955, 'Mate', [0, 0, 0], [0, 0, 0], [0, 0], { team: 'maserati', name: 'Maserati', country: 'Italy' })])
    const [q, race, pts] = none.blocks[0].tallies
    assert.deepEqual([q.mine, q.theirs, q.share, q.ahead], ['—', '—', null, null])
    assert.deepEqual([race.mine, race.share, race.ahead], ['none', null, null])
    assert.deepEqual([pts.mine, pts.theirs, pts.ahead, pts.share], ['0', '0', 'level', null], 'points are each driver\'s own, so 0–0 is a real level, with no bar to split')
    assert.deepEqual(none.headline, { text: 'Driver and Mate level on points', figure: '0–0' })
    assert.equal(none.standfirst, 'One season together at Maserati.', 'no qualifying sentence where no season has one')
  })
  it('draws the team-mate in the livery\'s second colour, in ink where there is none, and in the chart slots with no colour (D-65)', () => {
    const papaya = faceColours(face.blocks[0].colour)
    assert.equal(papaya.className, 'face-off face-off-owned')
    assert.deepEqual(papaya.vars, { '--face-a-light': '#d66c00', '--face-a-dark': '#ff8000', '--face-b-light': '#2e3033', '--face-b-dark': '#64696f' })
    const national = faceColours(faceOffs('A Driver', [row(1955, 'Mate', [1, 0, 1], [1, 0, 1], [1, 0], { team: 'maserati', name: 'Maserati', country: 'Italy' })]).blocks[0].colour)
    assert.deepEqual(Object.keys(national.vars), ['--face-a-light', '--face-a-dark'], 'a national colour has no second, so the team-mate takes the ink fallback')
    const none = faceColours(faceOffs('A Driver', [row(1990, 'Mate', [1, 0, 1], [1, 0, 1], [1, 0])]).blocks[0].colour)
    assert.deepEqual(none, { className: 'face-off', vars: { '--face-a': 'var(--series-1)', '--face-b': 'var(--series-2)' } })
  })
  it('takes the latest team-mate by round, not by the team name a year is ordered by', () => {
    // As the query orders them: 1955 at Ferrari (rounds to 3) before 1955 at Lancia (to 7).
    const late = faceOffs('A Driver', [
      row(1955, 'Early', [1, 0, 1], [1, 0, 1], [1, 0], { round: 3, team: 'ferrari', name: 'Ferrari', country: 'Italy' }),
      row(1955, 'Later', [0, 1, 1], [0, 1, 1], [0, 1], { round: 7, team: 'lancia', name: 'Lancia', country: 'Italy' }),
    ])
    assert.deepEqual(late.blocks.map((b) => b.mate_id), ['later', 'early'])
    assert.deepEqual(late.headline, { text: 'Later out-qualified Driver', figure: '1–0' })
  })
  it('keeps a name\'s own case at the start of the verdict, and capitalises only "level"', () => {
    const particle = faceOffs('Alain de Changy', [row(1959, 'Mate', [2, 1, 3], [0, 1, 1], [0, 0])])
    assert.equal(particle.blocks[0].verdict, 'de Changy ahead in qualifying; Mate ahead on finishes; level on points.')
    const level = faceOffs('A Driver', [row(1959, 'Mate', [1, 1, 2], [0, 0, 0], [0, 0])])
    assert.equal(level.blocks[0].verdict, 'Level in qualifying and on points.')
  })
  it('draws a season shared at two teams as one split, summed', () => {
    const two = faceOffs('A Driver', [
      row(1954, 'Mate', [1, 0, 1], [1, 0, 1], [3, 0], { team: 'ferrari', name: 'Ferrari', country: 'Italy' }),
      row(1954, 'Mate', [0, 2, 2], [0, 1, 1], [0, 4], { team: 'maserati', name: 'Maserati', country: 'Italy' }),
    ])
    assert.deepEqual(two.blocks[0].seasons.map((s) => [s.year, ...s.tallies.map((t) => `${t.mine}–${t.theirs}`)]), [[1954, '1–2', '1–1', '3–4']])
  })
  it('has nothing to say with no team-mate', () => assert.equal(faceOffs('A Driver', []), null))
})

describe("F1DB's outline over a photograph (AF-177), on rows written out", () => {
  const photo = { file_name: 'File:A.jpg', width: 800, height: 450 }
  const row = { path: 'M10 10L490 490', photo_file: 'File:A.jpg', photo_transform: JSON.stringify([1.5, 0, 0, -1.25, 20, 400]) }
  it('draws the outline as stored, under the transform its placing stores, in the frame of the photograph', () => {
    assert.deepEqual(photoOutline([row], photo), { d: 'M10 10L490 490', transform: 'matrix(1.5 0 0 -1.25 20 400)', width: 800, height: 450 })
  })
  it('draws nothing on a photograph it was not placed on', () => {
    assert.equal(photoOutline([row], { ...photo, file_name: 'File:B.jpg' }), null)
  })
  it('draws nothing where no outline is placed, or the photograph has no size', () => {
    assert.equal(photoOutline([{ ...row, photo_file: null, photo_transform: null }], photo), null)
    assert.equal(photoOutline([], photo), null)
    assert.equal(photoOutline([row], { ...photo, width: null }), null)
    assert.equal(photoOutline([row], null), null)
  })
  it('takes the placed outline where a circuit has several', () => {
    const other = { path: 'M0 0L1 1', photo_file: null, photo_transform: null }
    assert.equal(photoOutline([other, row], photo)?.d, 'M10 10L490 490')
  })
})

import { LABEL_CLEAR, SQUARE, SQUARE_ROOM, COLUMN_MARGIN } from '../src/charts/columnChart.js'
import { winsFigure, winsStory } from '../src/queries/constructor.js'

describe('a constructor’s wins chart, its titles, peak and drought marked (VD-125), on rows written out', () => {
  // Ferrari's wins, 1950-2026, as the register held them in November 2026,
  // so the layout is tested on columns as thin as the page's - races won,
  // 1956's shared drive once (VD-117).
  const FERRARI = [
    0, 3, 7, 7, 2, 1, 5, 0, 2, 2, 1, 5, 0, 1, 3, 0, 2, 0, 1, 0, 4, 2, 1, 0, 3, 6, 6, 4, 5, 6, 0, 2, 3, 4, 1, 2, 0, 2, 1, 3, 6, 0, 0, 0, 1, 1,
    3, 5, 6, 6, 10, 9, 15, 8, 15, 1, 9, 9, 8, 1, 5, 1, 3, 2, 0, 3, 0, 5, 6, 3, 0, 0, 4, 1, 5, 0, 2,
  ]
  const TITLES = [1961, 1964, 1975, 1976, 1977, 1979, 1982, 1983, 1999, 2000, 2001, 2002, 2003, 2004, 2007, 2008]
  const ferrari = { id: 'ferrari', name: 'Ferrari' }
  const seasons = FERRARI.map((wins, k) => ({ year: 1950 + k, wins, entries: 2 }))
  // Constructors' tables: a final one each finished season, 2026 still running.
  const standings = seasons.map((s) => ({
    year: s.year,
    position: TITLES.includes(s.year) ? 1 : 2,
    basis: s.year === 2026 ? 'running' : 'final',
  }))
  const champ = (year, driver_id, name) => ({ year, driver_id, name })
  const champions = [
    champ(1952, 'ascari', 'Alberto Ascari'),
    champ(1953, 'ascari', 'Alberto Ascari'),
    champ(1956, 'fangio', 'Juan Manuel Fangio'),
    champ(1958, 'hawthorn', 'Mike Hawthorn'),
    champ(1961, 'phil-hill', 'Phil Hill'),
    champ(1964, 'surtees', 'John Surtees'),
    champ(1975, 'lauda', 'Niki Lauda'),
    champ(1977, 'lauda', 'Niki Lauda'),
    champ(1979, 'scheckter', 'Jody Scheckter'),
    ...[2000, 2001, 2002, 2003, 2004].map((y) => champ(y, 'michael-schumacher', 'Michael Schumacher')),
    champ(2007, 'raikkonen', 'Kimi Räikkönen'),
  ]
  const colour = { name: 'Rosso Scuderia livery', pair: { lead: { name: 'Rosso Scuderia' } } }

  it('works Ferrari’s finding, kicker and four notes out from the rows, the notes as the approved mockup has them', () => {
    const story = winsStory(ferrari, seasons, { standings, champions, colour })
    // Not the mockup's "The Schumacher years": his 2001 (9) and 2003 (8) are
    // no higher than 2006-07 (9) and 2008 (8), so the reign does not stand
    // above everything else, and the finding states the peak.
    assert.equal(story.finding, 'Fifteen wins in 2002 and 2004 stand above everything else')
    assert.equal(story.kicker, 'Ferrari’s wins each season, in Rosso Scuderia')
    assert.equal(story.titleKey, 'a constructors’ title (16)')
    assert.deepEqual([...story.titles].sort(), TITLES)
    assert.deepEqual(
      story.notes.map((n) => `${n.n}. ${n.lead}: ${n.text}`),
      [
        '1. 1952–53: Ascari: Seven wins each season, and both drivers’ titles.',
        '2. 1975–77: three titles in a row: Constructors’ titles each year; Lauda champion in 1975 and 1977.',
        '3. 1991–93: no win: The longest winless run in Ferrari’s 77 seasons, shaded.',
        '4. 2002 and 2004: 15 each: Ferrari’s most in a season, inside Schumacher’s five straight titles.',
      ],
    )
    // The tie is one marker over both its seasons; the drought's disc is lifted
    // into its band on a hairline, and the band is shaded.
    assert.deepEqual(
      story.marks.map((m) => [m.n, m.keys.join(','), m.leader, m.lift]),
      [
        [1, '1952,1953', false, false],
        [2, '1975,1976,1977', false, false],
        [3, '1991,1992,1993', true, true],
        [4, '2002,2004', false, false],
      ],
    )
    assert.deepEqual(story.bands, [{ from: 1991, to: 1993 }])
    // No colour: the kicker names none. The season being run is not a title.
    assert.equal(winsStory(ferrari, seasons, { standings, champions }).kicker, 'Ferrari’s wins each season')
    const leading = standings.map((s) => (s.year === 2026 ? { ...s, position: 1 } : s))
    assert.equal(winsStory(ferrari, seasons, { standings: leading, champions }).titles.has(2026), false)
  })

  const team = { id: 'x', name: 'Williams' }
  const run = (from, wins) => wins.map((w, k) => ({ year: from + k, wins: w, entries: 2 }))
  const finals = (rows, titles = [], running = null) =>
    rows.map((s) => ({ year: s.year, position: titles.includes(s.year) ? 1 : 3, basis: s.year === running ? 'running' : 'final' }))

  it('gives tied peaks decades apart a disc each with one number, and one key entry', () => {
    const rows = run(1962, [2, 4, 4, 1, 0, 1, 4, 0, 0])
    const story = winsStory({ name: 'Brabham' }, rows, { standings: finals(rows) })
    assert.equal(story.finding, 'Four wins in 1963, 1964 and 1968 stand above everything else')
    const peak = story.notes.find((n) => n.lead.endsWith('4 each'))
    assert.equal(peak.lead, '1963, 1964 and 1968: 4 each')
    assert.deepEqual(
      story.marks.filter((m) => m.n === peak.n).map((m) => m.keys),
      [[1963, 1964], [1968]],
      'within two seasons, one disc; further, a disc of its own with the same number',
    )
    assert.equal(story.notes.filter((n) => n.n === peak.n).length, 1)
  })

  it('names every champion of a tied peak where no one driver holds it, and loses no title to a merged note', () => {
    // Brabham: titles in a row in 1966-67 are exactly the first disc of a
    // peak tied with 1983, so the run's note goes; Brabham's own 1966 title
    // is at the peak too, so its note goes; the peak's note names all three.
    const rows = run(1964, [0, 0, 4, 4, 2, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 3, 1, 4])
    const champs = [
      champ(1966, 'jack-brabham', 'Jack Brabham'),
      champ(1967, 'hulme', 'Denny Hulme'),
      champ(1981, 'piquet', 'Nelson Piquet'),
      champ(1983, 'piquet', 'Nelson Piquet'),
    ]
    const story = winsStory({ name: 'Brabham' }, rows, { standings: finals(rows, [1966, 1967]), champions: champs })
    const peak = story.notes.find((n) => n.lead.endsWith('4 each'))
    assert.equal(peak.text, 'Brabham’s most in a season; Brabham champion in 1966, Hulme in 1967, Piquet in 1983.')
    assert.equal(story.notes.some((n) => n.lead.includes('titles in a row') || n.lead === '1966: Brabham'), false)
  })

  it('calls a reign the finding only where every season of it stands above every other', () => {
    // Red Bull: the peak, 2023, is inside Verstappen's 2021-24, but 2021 and
    // 2024 are below Vettel's 2011 and 2013.
    const rows = run(2010, [9, 12, 5, 13, 0, 0, 2, 3, 4, 2, 2, 11, 17, 21, 9])
    const champs = [
      ...[2010, 2011, 2012, 2013].map((y) => champ(y, 'vettel', 'Sebastian Vettel')),
      ...[2021, 2022, 2023, 2024].map((y) => champ(y, 'verstappen', 'Max Verstappen')),
    ]
    const story = winsStory({ name: 'Red Bull' }, rows, { standings: finals(rows), champions: champs })
    assert.equal(story.finding, '21 wins in 2023 stand above everything else')
    assert.equal(story.notes.find((n) => n.lead === '2023: 21').text, 'Red Bull’s most in a season, inside Verstappen’s four straight titles.')
    // The same reign with its worst season above every other: the finding names it.
    const higher = rows.map((s) => (s.year >= 2021 ? { ...s, wins: s.wins + 5 } : s))
    assert.equal(winsStory({ name: 'Red Bull' }, higher, { standings: finals(higher), champions: champs }).finding, 'The Verstappen years stand above everything else')
  })

  it('marks no peak where the best is one win, and says how many seasons had one', () => {
    const rows = run(2012, [1, 1, 0, 0])
    const story = winsStory({ name: 'Lotus F1 Team' }, rows, { standings: finals(rows) })
    assert.equal(story.finding, 'A win in two of Lotus F1 Team’s four seasons')
    assert.deepEqual(story.notes.map((n) => n.lead), ['2014–15: no win'])
    assert.equal(story.titleKey, null)
  })

  it('shades every drought as long as the longest, names a running one "since", and leaves out a single dry season', () => {
    const rows = run(1950, [0, 0, 0, 1, 2, 0, 3, 4, 0, 0, 0])
    const story = winsStory({ name: 'Maserati' }, rows, { standings: finals(rows) })
    const dry = story.notes.find((n) => n.lead.endsWith('no win'))
    assert.equal(dry.lead, '1950–52 and 1958–60: no win')
    assert.equal(dry.text, 'The longest winless runs in Maserati’s 11 seasons, three each, shaded.')
    assert.deepEqual(story.bands, [{ from: 1950, to: 1952 }, { from: 1958, to: 1960 }])
    assert.equal(story.marks.filter((m) => m.n === dry.n).length, 2)
    // Still running: it reaches the season being run.
    const now = run(2020, [3, 1, 0, 0, 0])
    const running = winsStory(team, now, { standings: finals(now, [], 2024) })
    assert.equal(running.notes.map((n) => `${n.lead}: ${n.text}`).at(-1), 'Since 2022: no win: The longest winless run in Williams’ 5 seasons, and still running, shaded.')
    // The same seasons all finished: a span, not "since".
    assert.equal(winsStory(team, now, { standings: finals(now) }).notes.at(-1).lead, '2022–24: no win')
    // One dry season between wins is no drought.
    const wet = run(2000, [2, 0, 3])
    assert.equal(winsStory(team, wet, { standings: finals(wet) }).notes.some((n) => n.lead.endsWith('no win')), false)
  })

  it('says a champion’s season once where it is the peak, and a run of titles once where it is the tie', () => {
    // BRM 1962: Hill's title and the peak are one column, so one note.
    const rows = run(1960, [0, 0, 4, 2, 2])
    const hill = [champ(1962, 'graham-hill', 'Graham Hill')]
    const brm = winsStory({ name: 'BRM' }, rows, { standings: finals(rows, [1962]), champions: hill })
    assert.deepEqual(brm.notes.map((n) => `${n.lead}: ${n.text}`).slice(-1), ['1962: 4: BRM’s most in a season; Hill champion.'])
    assert.equal(brm.notes.some((n) => n.lead === '1962: Hill'), false)
    // Renault 2005-06: the titles in a row are the tied seasons, so the peak's note says it.
    const renault = run(2004, [1, 8, 8, 0, 2])
    const alonso = [champ(2005, 'alonso', 'Fernando Alonso'), champ(2006, 'alonso', 'Fernando Alonso')]
    const story = winsStory({ name: 'Renault' }, renault, { standings: finals(renault, [2005, 2006]), champions: alonso })
    assert.equal(story.finding, 'The Alonso years stand above everything else')
    assert.deepEqual(story.notes.map((n) => n.lead), ['2005 and 2006: 8 each'])
    assert.equal(story.notes[0].text, 'Renault’s most in a season, inside Alonso’s two straight titles.')
    // Two champions inside the run: each named, the second without "champion".
    const mclaren = run(1983, [1, 12, 6, 4])
    const two = [champ(1984, 'lauda', 'Niki Lauda'), champ(1985, 'prost', 'Alain Prost'), champ(1986, 'prost', 'Alain Prost')]
    const titles = winsStory({ name: 'McLaren' }, mclaren, { standings: finals(mclaren, [1984, 1985]), champions: two })
    assert.equal(titles.notes.find((n) => n.lead === '1984–85: two titles in a row').text, 'Constructors’ titles each year; Lauda champion in 1984, Prost in 1985.')
  })

  it('draws a season of no win as a stub, a title as a square under its column, and labels round years clear of each other', () => {
    const figure = winsFigure(ferrari, seasons, { standings, champions, colour })
    assert.equal(figure.keyBeside, true, 'more seasons than the slot: full width, its key beside it')
    assert.equal(figure.labelPeak, false, 'the peak is a marker, not a figure over its first column')
    for (const width of [352, 900]) {
      const layout = columnLayout({ ...figure, width })
      const baseline = figure.height - COLUMN_MARGIN.bottom - SQUARE_ROOM
      const zero = layout.columns.filter((c) => c.d.value === 0)
      assert.ok(zero.length > 0 && zero.every((c) => c.zero && c.path === null), `${width}: every winless season a stub, never a column`)
      assert.ok(zero.every((c) => Math.abs(c.zero.y - (baseline - 1)) < 1e-9), `${width}: on the baseline`)
      const squares = layout.columns.filter((c) => c.square)
      assert.deepEqual(squares.map((c) => c.d.key), TITLES, `${width}: a square under every title and no other season`)
      for (const c of squares) {
        assert.ok(c.square.y > baseline && c.square.y + c.square.size < layout.tickY - 9, `${width}: ${c.d.key}'s square between the baseline and the labels`)
        assert.ok(c.square.size <= SQUARE && Math.abs(c.square.x + c.square.size / 2 - c.centre) < 1e-9, `${width}: centred under its column`)
      }
      const labels = layout.columns.filter((c) => c.label !== null)
      assert.equal(labels[0].d.key, 1950, `${width}: the first season named`)
      for (let k = 1; k < labels.length; k += 1)
        assert.ok(labels[k].centre - labels[k - 1].centre >= LABEL_CLEAR, `${width}: ${labels[k - 1].label} and ${labels[k].label} clear of each other`)
      assert.ok(labels.slice(1).every((c) => c.d.key % 5 === 0), `${width}: the rest are round years (${labels.map((c) => c.label).join(' ')})`)
      assert.equal(labels.length, width === 352 ? 4 : 8, `${width}: every quarter-century on a phone, every decade at 900, as the mockup labels them`)
      assert.ok(layout.columns.every((c) => c.value === null), `${width}: no figure printed over a column`)
    }
    // An axis that jumps decades - a team absent between - keeps its labels apart.
    const gap = [1954, 1955, ...Array.from({ length: 17 }, (_, k) => 2010 + k)].map((year) => ({ key: year, value: 1, label: String(year) }))
    const jumped = columnLayout({ data: gap, width: 352, roundLabels: true })
    const named = jumped.columns.filter((c) => c.label !== null)
    for (let k = 1; k < named.length; k += 1) assert.ok(named[k].centre - named[k - 1].centre >= LABEL_CLEAR, `${named.map((c) => c.label).join(' ')}`)
    // Too few round years for the step (twenty seasons on a phone): every
    // labelEvery-th, thinned the same way, never overprinting.
    const short = Array.from({ length: 20 }, (_, k) => ({ key: 1950 + k, value: k % 3, label: String(1950 + k) }))
    for (const width of [250, 320, 400]) {
      const thin = columnLayout({ data: short, width, roundLabels: true, labelEvery: 2 }).columns.filter((c) => c.label !== null)
      assert.ok(thin.length >= 2, `${width}: still labelled`)
      for (let k = 1; k < thin.length; k += 1) assert.ok(thin[k].centre - thin[k - 1].centre >= LABEL_CLEAR, `${width}: ${thin.map((c) => c.label).join(' ')}`)
    }
    // A stub only where a chart asks for stubs: elsewhere a zero draws nothing.
    const plainZero = columnLayout({ data: [{ key: 'a', value: 0 }, { key: 'b', value: 3 }], width: 400 })
    assert.equal(plainZero.columns[0].zero, null)
    assert.notEqual(plainZero.columns[0].path, null)
    // A tie printed: every column at the peak, not the first of them.
    const tie = columnLayout({ data: [3, 15, 8, 15].map((value, k) => ({ key: k, value })), width: 400 })
    assert.deepEqual(tie.columns.map((c) => c.value), [null, '15', null, '15'])
  })

  it('lays Ferrari’s markers out sound at every width from 250 to 1800 px, the drought’s in its band', () => {
    const figure = winsFigure(ferrari, seasons, { standings, champions, colour })
    const reach = MARKER.r + MARKER.ring / 2
    for (let width = 250; width <= 1800; width += 1) {
      const layout = columnLayout({ ...figure, width })
      const where = (m) => `${width}: marker ${m.n} at (${m.cx.toFixed(1)}, ${m.cy.toFixed(1)})`
      assert.deepEqual(layout.markers.map((m) => m.n), [1, 2, 3, 4], `${width}: every note has its marker`)
      for (const m of layout.markers) {
        assert.ok(m.cy - reach >= -1e-9 && m.cx - reach >= -1e-9 && m.cx + reach <= width + 1e-9, `${where(m)} is inside the drawing`)
        for (const c of layout.columns) {
          if (c.path === null) continue
          const half = c.centre - Number(c.path.match(/^M([-\d.]+),/)[1])
          if (Math.abs(c.centre - m.cx) <= reach + half) assert.ok(m.cy + reach <= c.peak + 1e-9, `${where(m)} clears ${c.d.key}'s column`)
        }
        for (const o of layout.markers)
          if (o !== m) assert.ok(Math.hypot(m.cx - o.cx, m.cy - o.cy) >= 2 * reach, `${where(m)} and marker ${o.n} do not overlap`)
      }
      // The drought's disc: inside its band, well above the baseline, on a hairline down to it.
      const [band] = layout.bands
      const dry = layout.markers[2]
      assert.ok(dry.cx >= band.x && dry.cx <= band.x + band.width, `${where(dry)} is over its band`)
      const baseline = layout.columns[0].top
      assert.ok(dry.cy <= (band.y + baseline) / 2 + 1e-9, `${where(dry)} is lifted halfway up the plot or higher`)
      assert.ok(dry.leader && dry.leader.y1 > dry.cy && Math.abs(dry.leader.y1 - (baseline - MARKER.gap)) < 1e-9, `${where(dry)} has its hairline from the baseline`)
    }
  })
})
