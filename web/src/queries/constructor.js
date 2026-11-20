/**
 * One constructor's page: its queries and its three tables' columns, read
 * by Constructor.jsx and by scripts/prerender.js (PD-02, rung five).
 *
 * WHY THIS FILE EXISTS
 *     The static constructor page had one table, "Wins", with three columns
 *     from race_results in year order; the app has "Every win" with five,
 *     newest first, and a season-by-season table and a table of the cars
 *     built that the static page did not carry at all. The definitions live
 *     here once.
 *
 * See queries/drivers.js for what a column's `text` is.
 */
import { EMPTY, inWords, missing, number, points, span, text, yearList } from '../lib/format.js'
import { derivedAndPublished } from './driver.js'
import { shortNames } from './season.js'
import { byRoundText } from '../charts/spark.js'
import { LABELS, SLOT_MARKS } from '../lib/site.js'
import { TILE_JOIN } from '../lib/tiles.js'

export const CONSTRUCTOR = `SELECT * FROM constructors WHERE id = ?`

/**
 * The record, counted from the race records rather than read from a column.
 *
 * A WIN IS A RACE WON (VD-117). Two drivers who shared one car's drive are
 * two entries classified first, and counting entries gave Ferrari 251 here
 * against the 250 races /records, the register's own `wins` and F1DB give
 * it: the 1956 Argentine Grand Prix, one car Musso and Fangio shared,
 * counted twice. `wins` here and in BY_SEASON counts races, so a shared
 * drive counts once, to the car, as /records and verify.py's hold on the
 * register count it; the driver tables credit it to each driver.
 */
export const DERIVED = `
  SELECT COUNT(*)                       AS entries,
         COUNT(DISTINCT r.year)         AS seasons,
         COUNT(DISTINCT r.id)           AS races,
         COUNT(DISTINCT CASE WHEN e.finish_position = 1 THEN r.id END) AS wins,
         SUM(e.finish_position <= 3)    AS podiums,
         SUM(e.pole = 1)                AS poles,
         SUM(e.fastest_lap = 1)         AS fastest_laps,
         COUNT(DISTINCT e.driver_id)    AS drivers
    FROM race_entries e
    JOIN races r ON r.id = e.race_id
   WHERE e.constructor_id = ?
`

/**
 * Wins and Poles as the register states them (CD-34): the count from the race
 * records beside the stored figure, in the driver page's words - "250
 * derived · 250 published". The two used to part on Ferrari, Vanwall and
 * Alfa Romeo, which was DERIVED counting a shared drive twice (VD-117);
 * counted by race, as verify.py holds the stored total to, they agree. Where
 * the register holds no total - rob-walker, whose wins are its chassis
 * makers' - the count stands alone. Read by the app's "On the record" and
 * the static page's facts list, which is how the two say the same thing; the
 * Stats strip's Wins is the derived half.
 */
export const recordFigures = (constructor, derived) => [
  ['Wins', derivedAndPublished(derived.wins ?? 0, constructor.wins)],
  ['Poles', derivedAndPublished(derived.poles ?? 0, constructor.poles)],
]

export const BY_SEASON = `
  SELECT r.year,
         COUNT(*)                    AS entries,
         -- Races won, a shared drive once (VD-117, as DERIVED).
         COUNT(DISTINCT CASE WHEN e.finish_position = 1 THEN r.id END) AS wins,
         COALESCE(SUM(e.finish_position <= 3), 0) AS podiums,
         COALESCE(SUM(e.pole = 1), 0)             AS poles,
         SUM(COALESCE(e.points, 0))  AS points,
         MIN(e.finish_position)      AS best,
         COUNT(DISTINCT e.driver_id) AS drivers,
         -- The season's races by round, for its bars (VD-106, charts/spark.js
         -- byRoundOf): "round:place" for the best place any of its cars was
         -- classified in, and the place empty where none was.
         (SELECT group_concat(b.round || ':' || COALESCE(b.best, ''), ' ')
            FROM (SELECT r2.round, MIN(e2.finish_position) AS best
                    FROM race_entries e2
                    JOIN races r2 ON r2.id = e2.race_id
                   WHERE e2.constructor_id = ?1 AND r2.year = r.year
                   GROUP BY r2.id) b) AS by_round,
         -- The calendar's length, rounds not yet run included.
         (SELECT MAX(c.round) FROM races c WHERE c.year = r.year) AS rounds
    FROM race_entries e
    JOIN races r ON r.id = e.race_id
   WHERE e.constructor_id = ?1
   GROUP BY r.year
   ORDER BY r.year
`

/** The heading the wins chart leads a constructor's page under. */
export const WINS_HEADING = 'Wins by season'

/** The wins chart's numbers, as Figure's table lays them out. */
export const WINS_FIGURE_COLUMNS = [
  { key: 'year', label: 'Season', align: 'num', rowHeader: true, text: (year) => String(year) },
  { key: 'wins', label: 'Wins', align: 'num' },
  { key: 'entries', label: 'Entries', align: 'num' },
]

/**
 * The drivers' champions who won the title in this team's car (VD-125):
 * each season's first place in a final drivers' table - so the season being
 * run, led and not won, is none - where the team the champion scored the
 * most points for that season is this one: Fangio's 1954, raced for
 * Maserati and then for Mercedes, is Mercedes'. Takes `?1`, the id.
 */
export const CHAMPIONS = `
  SELECT s.year, s.driver_id, d.full_name AS name
    FROM v_standings_final s
    JOIN drivers d ON d.id = s.driver_id
   WHERE s.table_type = 'drivers' AND s.basis = 'final' AND s.position = 1
     AND ?1 = (SELECT e.constructor_id
                 FROM race_entries e
                 JOIN races r ON r.id = e.race_id
                WHERE r.year = s.year AND e.driver_id = s.driver_id AND e.constructor_id IS NOT NULL
                GROUP BY e.constructor_id
                ORDER BY TOTAL(e.points) DESC, COUNT(*) DESC, e.constructor_id
                LIMIT 1)
   ORDER BY s.year
`

/**
 * The wins chart, a column per season (VD-73): everything ColumnChart is
 * given, worked out once for both renderers - Constructor.jsx draws it in
 * the app, scripts/prerender.js on the static page. Null for a team with a
 * win in fewer than two seasons, which has no chart. `bySeason` is
 * BY_SEASON's rows; `standings` STANDINGS' and `champions` CHAMPIONS', and
 * `colour` the colourForEntry() or nationalEntry() the chart is drawn in,
 * or null.
 *
 * The chart used to draw only the winning seasons, on a band scale, so the
 * pixels between 1990 and 1994 were as wide as those between 1996 and 1997
 * and a reader saw an unbroken run of wins. Every season entered goes on the
 * axis. `lead`: the chart takes the opening slot beside the header (VD-84)
 * unless the team has entered more seasons than the slot can draw at a
 * usable width (SLOT_MARKS); then it leads under the tiles at the full
 * width, its key beside it (`keyBeside`).
 *
 * In the annotation pattern (VD-125, docs/design-system.md section 3,
 * *Figure*), to the approved mockup P07v2: a finding and a kicker over it
 * (winsStory()), a square under each constructors' title, and the numbered
 * notes in the key, so the peak - every season tied at it - is a marker
 * rather than a figure printed over the first of them.
 */
export function winsFigure(constructor, bySeason, { standings = [], champions = [], colour = null } = {}) {
  if (bySeason.filter((s) => s.wins > 0).length <= 1) return null
  const seasons = [...bySeason].sort((a, b) => a.year - b.year)
  const story = winsStory(constructor, seasons, { standings, champions, colour })
  const lead = seasons.length <= SLOT_MARKS
  return {
    rows: seasons,
    lead,
    keyBeside: !lead,
    note: 'Every season entered, winless ones included, so a drought is visible as a gap. A shared drive counts once, to the car.',
    finding: story.finding,
    kicker: story.kicker,
    titleKey: story.titleKey,
    annotations: story.notes.map(({ n, lead: head, text: line }) => ({ n, lead: head, text: line })),
    marks: story.marks,
    bands: story.bands,
    data: seasons.map((s) => ({
      key: s.year,
      value: s.wins,
      label: String(s.year),
      square: story.titles.has(s.year),
      note: story.titles.has(s.year) ? 'constructors’ title' : undefined,
    })),
    labelEvery: Math.max(1, Math.ceil(seasons.length / 12)),
    roundLabels: true,
    // A winless season a stub on the baseline, not an empty slot.
    stubs: true,
    // The peak is a marker now, with its words in the key.
    labelPeak: false,
    integer: true,
    // Ten more where a title's square takes the room under the baseline.
    height: story.titles.size ? 210 : 200,
    label: `Race wins per season for ${constructor.name}, ${seasons[0].year} to ${seasons[seasons.length - 1].year}${
      story.titles.size ? '; a square under a season is a constructors’ title' : ''
    }${story.notes.length ? `; ${inWords(story.notes.length)} numbered ${story.notes.length === 1 ? 'note' : 'notes'} in the key` : ''}`,
  }
}

const sentence = (words) => words.charAt(0).toUpperCase() + words.slice(1)
/** "Ferrari’s", "Williams’". */
const owns = (name) => `${name}${name.endsWith('s') ? '’' : '’s'}`
/** "2002 and 2004", "1966, 1967 and 1983". */
const listed = (items) => (items.length < 2 ? String(items[0] ?? '') : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`)
/** "1952–53", "1979–85", "1999–2004": a run of years as span() writes one, the century kept where it changes. */
const yearSpan = (from, to) =>
  from === to ? String(from) : `${from}–${Math.floor(from / 100) === Math.floor(to / 100) ? String(to).slice(2) : to}`
/** Years, runs of consecutive ones as spans: "1975 and 1977", "2014–15 and 2017–20". */
const yearsText = (list) => listed(runsOf(list, (a, b) => b === a + 1).map((run) => yearSpan(run[0], run[run.length - 1])))
/** `list` cut into runs wherever `together(previous, next)` is false. */
const runsOf = (list, together) =>
  list.reduce((runs, item, i) => {
    if (i > 0 && together(list[i - 1], item)) runs[runs.length - 1].push(item)
    else runs.push([item])
    return runs
  }, [])
/** "Seven wins", "No win", "Eight and eleven wins": a season's wins, or several seasons'. */
const winsWords = (counts) => {
  if (counts.every((w) => w === counts[0])) {
    const w = counts[0]
    const each = counts.length > 1 ? ' each season' : ''
    return w === 0 ? `No win${each}` : `${sentence(inWords(w))} ${w === 1 ? 'win' : 'wins'}${each}`
  }
  return counts.includes(0) ? `Wins of ${listed(counts.map(number))}` : `${sentence(listed(counts.map(inWords)))} wins`
}
/** Tied seasons this many apart or fewer share one marker; further apart, each run of them has a disc of its own. */
const TIE_REACH = 2

/**
 * What the wins chart says over it and in its key (VD-125), from the
 * chart's seasons in year order, the constructors' standings (a title is a
 * final table's first place) and the drivers' champions in the team's car
 * (CHAMPIONS). Returns the finding, the kicker and the
 * title squares' line under it, the years of the titles, and the notes,
 * numbered in the order they stand on the axis - at most four, as the
 * approved mockup has (a declared exception to the pattern's three):
 *
 *   the first drivers' title won in the team's car, and the same driver's
 *     titles straight after it ("1952–53: Ascari") - left out where it
 *     falls inside the next note's run, which then names the champion, or
 *     is all at the peak, whose note does;
 *   the first run of constructors' titles in a row ("1975–77: three titles
 *     in a row"), and who was champion in the team's car inside it - left
 *     out where it is exactly the seasons of one of the peak's discs;
 *   the peak, every season tied at the most wins, where that is more than
 *     one (a team whose best is one win has every winning season at its
 *     peak, and nothing to point at), with the champions in the team's car
 *     in those seasons: one marker between tied seasons
 *     TIE_REACH apart or fewer, and a disc with the same number on each run
 *     of them further apart, so no tie reads as one record;
 *   the longest winless run, of two seasons or more, shaded, its disc in
 *     the empty band on a hairline; several as long are each shaded and
 *     named. A run that reaches a season still being run is "since".
 *
 * The finding names a driver only where the peak lies inside one driver's
 * run of straight titles in the team's car and every season of that run
 * has more wins than any season outside it ("The Alonso years" at
 * Renault); otherwise it states the peak, or, where the best is one win,
 * how many seasons had one. The approved mockup's "The Schumacher years"
 * is not Ferrari's: his 2001 (nine) and 2003 (eight) are no higher than
 * 2006-07 and 2008.
 */
export function winsStory(constructor, seasons, { standings = [], champions = [], colour = null } = {}) {
  const name = constructor.name
  const titles = new Set(standings.filter((s) => s.position === 1 && s.basis === 'final').map((s) => s.year))
  const entered = new Set(seasons.map((s) => s.year))
  const winsIn = new Map(seasons.map((s) => [s.year, s.wins]))
  const next = (a, b) => b === a + 1 && entered.has(b)
  const surname = (row) => shortNames([row.name])[0]

  // The drivers' titles in the team's car, as runs of one driver's straight ones.
  const crowned = [...champions].sort((a, b) => a.year - b.year).filter((c) => entered.has(c.year))
  const driverRuns = runsOf(crowned, (a, b) => next(a.year, b.year) && a.driver_id === b.driver_id)
  const titleRuns = runsOf(
    [...titles].sort((a, b) => a - b),
    (a, b) => next(a, b),
  )

  const peak = Math.max(...seasons.map((s) => s.wins))
  const tied = seasons.filter((s) => s.wins === peak).map((s) => s.year)
  const marked = peak > 1
  // The one driver whose straight titles in the team's car hold every peak season.
  const reign = driverRuns.find((run) => run.length > 1 && tied.every((y) => run.some((c) => c.year === y))) ?? null
  // Or, short of that, the one driver champion in the team's car in each of them.
  const crownedIn = new Map(crowned.map((c) => [c.year, c]))
  const peakChampion =
    tied.every((y) => crownedIn.has(y)) && new Set(tied.map((y) => crownedIn.get(y).driver_id)).size === 1 ? crownedIn.get(tied[0]) : null
  // The champions in the team's car in some of `years`, each named once:
  // "Lauda champion in 1984, Prost in 1985".
  const championsIn = (years) => {
    const inside = crowned.filter((c) => years.includes(c.year))
    const byDriver = [...new Set(inside.map((c) => c.driver_id))].map((id) => inside.filter((c) => c.driver_id === id))
    return byDriver.map((list, i) => `${surname(list[0])}${i === 0 ? ' champion' : ''} in ${yearsText(list.map((c) => c.year))}`).join(', ')
  }
  // Short of one champion in every peak season, each peak season's own, so
  // no title in a peak season goes unsaid (Brabham: 1966, 1967 and 1983).
  const peakChampions = championsIn(tied)
  const peakSays = reign
    ? `, inside ${owns(surname(reign[0]))} ${inWords(reign.length)} straight titles`
    : peakChampion
      ? `; ${surname(peakChampion)} champion${tied.length > 1 ? ' each time' : ''}`
      : peakChampions
        ? `; ${peakChampions}`
        : ''
  // The reign is the finding only where it stands above everything else:
  // its worst season beats every season outside it. Red Bull's peak is
  // inside Verstappen's four titles, but his 2021 and 2024 are below
  // Vettel's 2011 and 2013.
  const reignYears = new Set((reign ?? []).map((c) => c.year))
  const above =
    reign !== null &&
    Math.min(...seasons.filter((s) => reignYears.has(s.year)).map((s) => s.wins)) >
      Math.max(-1, ...seasons.filter((s) => !reignYears.has(s.year)).map((s) => s.wins))
  const sameYears = (a, b) => a.length === b.length && a.every((y, i) => y === b[i])
  // Tied seasons near enough to share a marker, each run of them a disc.
  const clusters = marked ? runsOf(tied, (a, b) => b - a <= TIE_REACH) : []

  const parts = []
  const constructorsRun = titleRuns.find((run) => run.length > 1) ?? null
  const firstDriverRun = driverRuns[0] ?? null
  // The run of titles has a note of its own unless it is exactly the
  // seasons of one of the peak's discs, whose note then says it.
  const runNote = constructorsRun !== null && !clusters.some((keys) => sameYears(keys, constructorsRun))
  const overlaps =
    runNote && firstDriverRun && firstDriverRun.some((c) => c.year >= constructorsRun[0] && c.year <= constructorsRun[constructorsRun.length - 1])
  // A champion's seasons that are all the peak's are the peak's note, which
  // names the champion; two notes on one column would say one thing twice.
  const inPeak = marked && firstDriverRun?.every((c) => tied.includes(c.year))
  if (firstDriverRun && !overlaps && !inPeak) {
    const years = firstDriverRun.map((c) => c.year)
    const n = years.length
    parts.push({
      keys: years,
      leader: false,
      lead: `${yearSpan(years[0], years[n - 1])}: ${surname(firstDriverRun[0])}`,
      text: `${winsWords(years.map((y) => winsIn.get(y)))}, and ${
        n === 1 ? 'the drivers’ title' : n === 2 ? 'both drivers’ titles' : 'the drivers’ title each year'
      }.`,
    })
  }
  // The same, for a run of titles that is exactly the seasons of one of the
  // peak's discs.
  if (runNote) {
    const [from, to] = [constructorsRun[0], constructorsRun[constructorsRun.length - 1]]
    const champs = championsIn(constructorsRun)
    parts.push({
      keys: constructorsRun,
      leader: false,
      lead: `${yearSpan(from, to)}: ${inWords(constructorsRun.length)} titles in a row`,
      text: `Constructors’ titles each year${champs ? `; ${champs}` : ''}.`,
    })
  }

  if (marked) {
    for (const keys of clusters)
      parts.push({
        keys,
        leader: false,
        lead: tied.length === 1 ? `${tied[0]}: ${number(peak)}` : `${listed(tied)}: ${number(peak)} each`,
        text: `${owns(name)} most in a season${peakSays}.`,
      })
  }

  const dry = runsOf(
    seasons.filter((s) => s.wins === 0).map((s) => s.year),
    next,
  )
  const longest = Math.max(0, ...dry.map((run) => run.length))
  if (longest > 1) {
    const droughts = dry.filter((run) => run.length === longest)
    const last = seasons[seasons.length - 1].year
    // Still running: the team's last season is the one being run - its
    // standings are not yet a final table - and the drought reaches it.
    const running = standings.some((s) => s.year === last && s.basis !== 'final')
    const named = droughts.map((run) =>
      running && run[run.length - 1] === last ? `Since ${run[0]}` : yearSpan(run[0], run[run.length - 1]),
    )
    const still = running && droughts.some((run) => run[run.length - 1] === last)
    for (const run of droughts)
      parts.push({
        keys: run,
        lift: true,
        band: { from: run[0], to: run[run.length - 1] },
        lead: `${sentence(listed(named.map((n, i) => (i === 0 ? n : n.charAt(0).toLowerCase() + n.slice(1)))))}: no win`,
        text:
          droughts.length === 1
            ? `The longest winless run in ${owns(name)} ${number(seasons.length)} seasons${still ? ', and still running' : ''}, shaded.`
            : `The longest winless runs in ${owns(name)} ${number(seasons.length)} seasons, ${inWords(longest)} each, shaded.`,
      })
  }

  let finding
  if (marked && above) finding = `The ${surname(reign[0])} years stand above everything else`
  else if (marked) finding = `${sentence(inWords(peak))} wins in ${listed(tied)} stand above everything else`
  else {
    const won = seasons.filter((s) => s.wins > 0).length
    finding = `A win in ${inWords(won)} of ${owns(name)} ${inWords(seasons.length)} seasons`
  }
  const drawnIn = colour ? (colour.pair?.lead?.name ?? colour.name) : null
  const kicker = `${owns(name)} wins each season${drawnIn ? `, in ${drawnIn}` : ''}`
  const titleKey = titles.size ? `a constructors’ title (${number(titles.size)})` : null

  // In the order they stand on the axis, numbered so; the discs of one
  // note share its number, and its words are in the key once.
  parts.sort((a, b) => a.keys[0] - b.keys[0])
  const numbered = []
  const notes = []
  for (const part of parts) {
    const same = notes.find((note) => note.lead === part.lead && note.text === part.text)
    const n = same ? same.n : notes.length + 1
    if (!same) notes.push({ n, lead: part.lead, text: part.text })
    numbered.push({ ...part, n })
  }
  const marks = numbered.map((p) => ({ n: p.n, keys: p.keys, leader: p.leader !== false, lift: Boolean(p.lift) }))
  const bands = numbered.filter((p) => p.band).map((p) => p.band)
  return { finding, kicker, titleKey, titles, notes, marks, bands }
}

/**
 * The season's final table can legitimately hold two rows for one constructor:
 * Force India was excluded from 2018 with nothing and its successor scored 52
 * under the same id, and Cooper contested 1960 with three engines. Both
 * survive v_standings_final; the same-fact-from-two-sources rows do not. The
 * rule and its reasons are on the view in schema.sql.
 *
 * Two such rows can share a position (Cooper's 1960 Maserati and Castellotti
 * rows are both fifth), so the row id closes the order, as on the season's
 * FINAL (CR-64): constructorSeasons shows the first of them.
 */
export const STANDINGS = `
  SELECT s.id, s.year, s.constructor_id, s.engine_id, s.position, s.position_text, s.points, s.team, s.basis
    FROM v_standings_final s
   WHERE s.table_type = 'constructors' AND s.constructor_id = ?
   ORDER BY s.year, s.position IS NULL, s.position, s.id
`

/**
 * Newest first: the order the app's table opens in. A row is an entry
 * classified first, so a shared drive is two rows; winsByRace() makes them
 * one before either renderer draws the table.
 */
export const WINS = `
  SELECT r.year, r.round, r.name_used, r.circuit_id, c.name AS circuit,
         e.driver_id, d.full_name AS driver, e.chassis_id, ch.name AS chassis
    FROM race_entries e
    JOIN races r ON r.id = e.race_id
    LEFT JOIN circuits c  ON c.id = r.circuit_id
    LEFT JOIN drivers d   ON d.id = e.driver_id
    LEFT JOIN chassis ch  ON ch.id = e.chassis_id
   WHERE e.constructor_id = ? AND e.finish_position = 1
   ORDER BY r.year DESC, r.round DESC, e.id
`

export const DESIGNS = `
  SELECT ch.id, ch.name, ch.first_year, ch.last_year, ch.engine_name, ch.chassis_type,
         ch.power_bhp, ch.races, ch.wins, ch.confidence
    FROM chassis ch
   WHERE ch.constructor_id = ?
   ORDER BY ch.first_year IS NULL, ch.first_year, ch.name, ch.id
`

/**
 * The chains the page draws (DA-32): every chain with a period recorded under
 * this constructor's id, not the one chain `constructors.lineage_chain` names
 * - that is the chain the name last belonged to, so /constructors/renault
 * read Enstone and not the works Renault team of 1977-85 (`renault-1977`),
 * which DA-02 recorded as a chain of its own. A chain of one step is drawn
 * only when it is not the constructor's own `lineage_chain`: a lone name in
 * its own chain has no other name to connect it to. Takes `?1`, the id.
 */
const DRAWN_CHAINS = `
  SELECT l.chain_id FROM constructor_lineage l
   WHERE l.constructor_id = ?1
     AND (l.chain_id IS NOT (SELECT lineage_chain FROM constructors WHERE id = ?1)
          OR (SELECT COUNT(*) FROM constructor_lineage m WHERE m.chain_id = l.chain_id) > 1)
`

export const LINEAGE = `
  SELECT l.* FROM constructor_lineage l
   WHERE l.chain_id IN (${DRAWN_CHAINS})
   ORDER BY l.chain_id, l.sequence
`

/**
 * LINEAGE's rows as one list of steps per chain: the constructor's own
 * `lineage_chain` first, then the others by the year their first name
 * began. A step is "this page" by `constructor_id`, which names the register
 * row, and not by `entity_name`, which is the name as raced and differs from
 * the register's for Williams, Jordan, Racing Bulls, BAR and Midland (DA-32).
 */
export function lineageChains(rows, constructor) {
  const chains = new Map()
  for (const step of rows) {
    if (!chains.has(step.chain_id)) chains.set(step.chain_id, [])
    chains.get(step.chain_id).push(step)
  }
  const start = (steps) => steps[0].from_year ?? Infinity
  return [...chains.entries()]
    .sort(([ia, a], [ib, b]) => (ib === constructor.lineage_chain) - (ia === constructor.lineage_chain) || start(a) - start(b) || (ia < ib ? -1 : 1))
    .map(([, steps]) => steps.sort((a, b) => a.sequence - b.sequence))
}

/**
 * The registry entries behind the rows this page prints, for the citation's
 * second sentence (CD-46, as CD-08 did for races and drivers; site.js's
 * behindThisPage says what it reads): the constructor's own row, every entry
 * it made and the race each was in - the tiles, the season table and the
 * wins are all counted from them - every chassis in *Cars built*, and every
 * standings row the championship column is read from, by the rule
 * DRIVER_SOURCES gives for the same view. The lineage is a table with no
 * `source_id`; its whole-table entry in `table_provenance` stands for its
 * rows, read only where the app draws a chain (DRAWN_CHAINS says which).
 * The static page does not draw it yet and names it all the same: the
 * sentence cites the address the two share, and is one sentence in both.
 * A name joined in only to label a row - a circuit, a driver - is the
 * label's, not a fact this page states, as on a driver's page. Photographs
 * and the disagreements each say where they come from beside them.
 */
export const CONSTRUCTOR_SOURCES = `
  SELECT s.source, s.redistributable, s.share_alike, s.attribution_required
    FROM source_registry s
   WHERE s.id IN (
           SELECT source_id FROM constructors WHERE id = ?1
     UNION SELECT source_id FROM race_entries WHERE constructor_id = ?1
     UNION SELECT r.source_id FROM races r JOIN race_entries e ON e.race_id = r.id WHERE e.constructor_id = ?1
     UNION SELECT source_id FROM chassis WHERE constructor_id = ?1
     UNION SELECT t.source_id FROM standings t
            WHERE t.table_type = 'constructors' AND t.constructor_id = ?1
              AND (t.basis = 'final'
                   OR NOT EXISTS (SELECT 1 FROM standings f
                                   WHERE f.year = t.year AND f.table_type = 'constructors'
                                     AND f.basis = 'final'))
     UNION SELECT p.source_id FROM table_provenance p
            WHERE p.tbl = 'constructor_lineage'
              AND EXISTS (${DRAWN_CHAINS}))
   ORDER BY s.priority, s.id
`

/**
 * The season-by-season rows with the championship position joined on, newest
 * first — the order the app's table opens in, so the static page prints them
 * as they come. Where a season carries two standings rows (an engine split),
 * the first by position is the one shown, as the app has always done.
 */
export const constructorSeasons = (bySeason, standings) =>
  [...bySeason]
    .sort((a, b) => b.year - a.year)
    .map((season) => {
      const standing = standings.find((s) => s.year === season.year)
      return {
        ...season,
        championship: standing?.position ?? null,
        championship_text: standing?.position_text ?? null,
      }
    })

/* In a weekend's order and grouped by it, as the driver page's are (VD-106). */
export const SEASON_COLUMNS = [
  { key: 'year', rowHeader: true, label: 'Season', align: 'num', text: (year) => String(year) },
  { key: 'entries', label: 'Entries', align: 'num' },
  { key: 'drivers', label: 'Drivers', align: 'num' },
  // Counted from the race records, as the driver page's are, and declared for
  // the same reason (VD-29): a team that never won prints a column of noughts,
  // and the two pages describing the same figures should not differ on it.
  { key: 'poles', label: 'Poles', align: 'num', collapse: true, group: 'Qualifying' },
  { key: 'wins', label: 'Wins', align: 'num', collapse: true, group: 'Races' },
  { key: 'podiums', label: 'Podiums', align: 'num', collapse: true, group: 'Races' },
  { key: 'best', label: 'Best', align: 'num', group: 'Races', text: (value) => (missing(value) ? EMPTY : `P${value}`) },
  { key: 'points', label: 'Points scored', align: 'num', group: 'Races', text: (value) => points(value) },
  { key: 'by_round', label: 'By round', align: 'spark', group: 'Races', sortable: false, text: byRoundText },
  {
    key: 'championship_text',
    label: 'Championship',
    align: 'num',
    text: (value, row) => text(value ?? row.championship),
    glossary: 'results',
  },
]

export const ENGINE_SPLIT_FOOTER =
  "The constructors' championship is contested by a chassis–engine pair, so a season can carry more than one entry for the same name. Open the season to see both."

/** What “By round” draws, said under every constructor's seasons (VD-106). */
export const BY_ROUND_FOOTER =
  '“By round” draws each race entered on the season’s calendar: a bar for the best place any of its cars was classified in, tallest for a win and shortest for 20th or lower, and a tick for a race none was.'

/** The seasons table's source line: what “By round” draws, and the engine split where there is one. */
export const seasonsFooter = (engineSplit) => (engineSplit ? `${BY_ROUND_FOOTER} ${ENGINE_SPLIT_FOOTER}` : BY_ROUND_FOOTER)

export const WIN_COLUMNS = [
  { key: 'year', rowHeader: true, label: 'Season', align: 'num', text: (year) => String(year) },
  { key: 'name_used', rowHeader: true, label: 'Grand Prix' },
  { key: 'circuit', label: 'Circuit' },
  { key: 'driver', label: 'Driver' },
  { key: 'chassis', label: 'Chassis', text: (name, row) => text(name ?? row.chassis_id) },
]

/**
 * *Every win* a row a race (VD-117): WINS's rows, the entries of one race
 * made one row, so the table, its count and its fold say what the Wins tile,
 * the chart and /records say. A shared drive keeps each driver, in WINS's
 * order, as `drivers` for the links and `driver` for the words, joined as
 * every race list joins a shared drive's winners (TILE_JOIN); its chassis
 * likewise as `designs` and `chassis`, each design once, where they were more
 * than one. A race one entry won keeps that entry's words.
 */
export function winsByRace(entries) {
  const byRace = new Map()
  for (const entry of entries) {
    const key = `${entry.year}-${entry.round}`
    const row = byRace.get(key)
    if (!row) {
      byRace.set(key, {
        ...entry,
        drivers: [{ id: entry.driver_id, name: entry.driver }],
        designs: [{ id: entry.chassis_id, name: entry.chassis }],
      })
      continue
    }
    row.drivers.push({ id: entry.driver_id, name: entry.driver })
    if (!row.designs.some((d) => d.id === entry.chassis_id)) row.designs.push({ id: entry.chassis_id, name: entry.chassis })
  }
  return [...byRace.values()].map((row) => ({
    ...row,
    ...(row.drivers.length > 1 ? { driver: row.drivers.map((d) => d.name).join(TILE_JOIN) } : {}),
    ...(row.designs.length > 1 ? { chassis: row.designs.map((d) => d.name ?? d.id ?? EMPTY).join(TILE_JOIN) } : {}),
  }))
}

export const WINS_FOOTER =
  'A blank chassis is a season this team ran more than one design and no source records which car raced which round.'

/**
 * *Every win*'s source line: the blank chassis, and where the team won a race
 * two drivers shared, which races, and that each counts once (VD-117) - the
 * chart says the rule, and this names the rows it is about. Takes
 * winsByRace()'s rows.
 */
export const winsFooter = (wins) => {
  const shared = wins.filter((row) => row.drivers?.length > 1).map((row) => `the ${row.year} ${row.name_used}`)
  return shared.length
    ? `${WINS_FOOTER} A shared drive counts once, to the car, with each of its drivers named: ${listed(shared)}.`
    : WINS_FOOTER
}

export const DESIGN_COLUMNS = [
  { key: 'name', rowHeader: true, label: 'Chassis' },
  { key: 'first_year', label: 'Years', align: 'num', text: (_, row) => span(row.first_year, row.last_year) },
  { key: 'engine_name', label: 'Engine' },
  { key: 'power_bhp', label: 'Power (bhp)', align: 'num' },
  { key: 'races', label: 'Races', align: 'num' },
  { key: 'wins', label: 'Wins', align: 'num' },
]

/**
 * The constructor's tiles, as both renderers draw them (VD-49). The figures
 * are DERIVED's, counted from the race records, never the stored columns:
 * constructors.entries is NULL for every row.
 *
 * VD-28: wins and the constructors' titles lead, the same two ranks the
 * driver page takes and for the same reason - and, for the same reason, a
 * zero does not lead: of the constructors in the register most never won,
 * and leading their 0 would point the emphasis at what is not there. A strip
 * with no lead keeps the one rank it always had.
 */
export const teamStrip = (constructor, derived) =>
  [
    {
      label: LABELS.seasons,
      value: span(constructor.first_entry, constructor.active ? null : constructor.last_entry),
      note: `${derived.seasons ?? 0} ${derived.seasons === 1 ? 'season' : 'seasons'}`,
    },
    { label: LABELS.entries, value: number(derived.entries) },
    { label: 'Wins', value: number(derived.wins ?? 0), lead: Number(derived.wins) > 0 },
    { label: 'Podiums', value: number(derived.podiums ?? 0) },
    { label: 'Poles', value: number(derived.poles ?? 0) },
    { label: 'Drivers', value: number(derived.drivers) },
    constructor.constructors_titles
      ? {
          label: "Constructors' titles",
          value: number(constructor.constructors_titles),
          note: missing(constructor.title_years) ? undefined : yearList(constructor.title_years),
          lead: true,
        }
      : null,
    constructor.drivers_titles ? { label: "Drivers' titles", value: number(constructor.drivers_titles) } : null,
  ].filter(Boolean)
