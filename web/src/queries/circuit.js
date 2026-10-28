/**
 * One circuit's page: its queries and its three tables' columns, read by
 * Circuit.jsx and by scripts/prerender.js (PD-02, rung five).
 *
 * WHY THIS FILE EXISTS
 *     The static circuit page had one table, "Grands Prix held here", from
 *     race_results in year order with four columns; the app has "Every race
 *     held here" newest first with the layout raced and a "not yet run" mark,
 *     and two tables — most wins here, constructors here — the static page
 *     did not carry. The definitions live here once.
 *
 * See queries/drivers.js for what a column's `text` is.
 */
import { number, ordinal, percent, roundResult, span, text } from '../lib/format.js'
import { colourForEntry, colourSource } from '../lib/liveries.js'
import { LABELS, NOT_YET_RUN } from '../lib/site.js'

/**
 * The stored row with the derived figures beside it: v_circuits counts the
 * races and their span from the races themselves, because the stored
 * last_gp is NULL for every venue still in use.
 */
export const CIRCUIT = `
  SELECT c.*, v.races, v.first_gp AS derived_first, v.last_gp AS derived_last,
         v.seasons_used, v.events_hosted, v.layouts
    FROM circuits c
    LEFT JOIN v_circuits v ON v.id = c.id
   WHERE c.id = ?
`

/**
 * The circuit's photograph (VD-62), where it has one: the aerial view VD-61
 * took by the `circuit` route of article_images. `circuit_id` is UNIQUE
 * there, so this is one row or none, and a circuit with none - the
 * Sudschleife, anything VD-61 declined - draws its page exactly as before.
 */
export const PHOTOGRAPH = `
  SELECT i.* FROM article_images i
   WHERE i.route = 'circuit' AND i.circuit_id = ?
`

/**
 * What that photograph is OF, for its alt (AX-13): the venue, and from where.
 * The harvest admits only a file whose name says SkySat, aerial or
 * Luftaufnahme (CIRCUIT_PHOTOGRAPH in data/harvest.py), so every one of them
 * looks down on the circuit. The figure carries no subject line - it sits
 * beside the heading that already names the place - so the alt is the one
 * place this is said, and both renderers say it from here.
 */
export const photographAlt = (name) => `${name} from above`

/** The centreline is a few hundred kilobytes of coordinates; only ever fetched for the one circuit being looked at. */
export const GEOMETRY = `SELECT * FROM circuit_geometry WHERE circuit_id = ?`

/**
 * How much of the register is traced, for the line a circuit without a trace
 * shows (IX-31). Counted rather than written into the sentence: "25 of the
 * 80" is true today, and a figure typed into prose goes stale in silence.
 */
export const TRACE_COVERAGE = `
  SELECT (SELECT COUNT(DISTINCT circuit_id) FROM circuit_geometry) AS traced,
         (SELECT COUNT(*) FROM circuits) AS circuits
`

export const LAYOUTS = `
  SELECT * FROM circuit_layouts WHERE circuit_id = ? ORDER BY from_year
`

/**
 * F1DB's outline of every layout raced here (AF-03), with the years and
 * the rounds run on each, counted from the completed races that name it —
 * the same split v_circuits makes for the stats above, so a layout on the
 * calendar and not yet raced is "1 round to come", not a round run at a
 * venue that has never held one. A drawing, not a measurement:
 * lib/outline.js says how it differs from GEOMETRY.
 *
 * `latest` is the last race that names the layout, run or to come, as one
 * sortable year-and-round (202609): leadOutline draws that layout large
 * (VD-37). The grid keeps the chronological order below.
 */
export const OUTLINES = `
  SELECT o.f1db_layout_id, o.length_km, o.turns, o.path,
         MIN(CASE WHEN r.status = 'completed' THEN r.year END) AS first_year,
         MAX(CASE WHEN r.status = 'completed' THEN r.year END) AS last_year,
         COUNT(CASE WHEN r.status = 'completed' THEN 1 END) AS rounds,
         COUNT(CASE WHEN r.status != 'completed' THEN 1 END) AS scheduled,
         MAX(r.year * 100 + r.round) AS latest
    FROM circuit_outlines o
    LEFT JOIN races r ON r.f1db_layout_id = o.f1db_layout_id
   WHERE o.circuit_id = ?
   GROUP BY o.f1db_layout_id
   ORDER BY first_year IS NULL, first_year, o.f1db_layout_id
`

/** Newest first: the order the app's table opens in. */
export const RACES = `
  SELECT r.year, r.round, r.name_used, r.status, r.layout_key,
         (SELECT group_concat(d.full_name, ' / ') FROM race_entries e
            JOIN drivers d ON d.id = e.driver_id
           WHERE e.race_id = r.id AND e.finish_position = 1) AS winner,
         (SELECT e.driver_id FROM race_entries e
           WHERE e.race_id = r.id AND e.finish_position = 1 LIMIT 1) AS winner_id,
         (SELECT k.name FROM race_entries e JOIN constructors k ON k.id = e.constructor_id
           WHERE e.race_id = r.id AND e.finish_position = 1 LIMIT 1) AS constructor
    FROM races r
   WHERE r.circuit_id = ?
   ORDER BY r.year DESC, r.round DESC
`

export const WINNERS = `
  SELECT driver_id, driver, wins, first_win, last_win
    FROM v_circuit_winners WHERE circuit_id = ?
   ORDER BY wins DESC, driver
`

/**
 * One row per constructor that has won here, most wins first.
 *
 * The join is for the constructor's country, which the pre-1968 national
 * colour needs and the view does not carry (AF-52). The view's own
 * `last_win` is the season the mark is drawn for - the site's rule for a
 * subject spanning seasons is the last one - so nothing here needs a
 * correlated MAX and `schema.sql` is untouched.
 */
export const TEAMS = `
  SELECT v.*, k.country AS constructor_country
    FROM v_circuit_constructors v
    LEFT JOIN constructors k ON k.id = v.constructor_id
   WHERE v.circuit_id = ?
   ORDER BY v.wins DESC, v.constructor
`

/**
 * The events this venue has held, for the line above its race list (IA-01):
 * the way from a circuit to every other place its Grand Prix has been run.
 * Counted the way the race list below is, run and still to come apart.
 */
export const GRANDS_PRIX = `
  SELECT g.id, g.name,
         COUNT(CASE WHEN r.status = 'completed' THEN 1 END) AS races,
         COUNT(CASE WHEN r.status != 'completed' THEN 1 END) AS scheduled
    FROM races r
    JOIN grands_prix g ON g.id = r.gp_id
   WHERE r.circuit_id = ?
   GROUP BY g.id
   ORDER BY races DESC, g.name
`

/**
 * The registry entries behind the rows this page prints, for the citation's
 * second sentence (CD-46; site.js's behindThisPage says what it reads): the
 * circuit's own row, every race run or booked here, and every entry
 * classified first in one of them - the winner column, *Most wins here* and
 * the constructors' wins are each read from those. The layout timeline is a
 * table with no `source_id`; its whole-table entry in `table_provenance`
 * stands for its rows, read only where the page draws them. The outlines,
 * the centreline and the photograph each carry their own credit beside them,
 * as on a race's page, and an event's name in the line above the races is a
 * label, not a fact this page states.
 */
export const CIRCUIT_SOURCES = `
  SELECT s.source, s.redistributable, s.share_alike, s.attribution_required
    FROM source_registry s
   WHERE s.id IN (
           SELECT source_id FROM circuits WHERE id = ?1
     UNION SELECT source_id FROM races WHERE circuit_id = ?1
     UNION SELECT e.source_id FROM race_entries e JOIN races r ON r.id = e.race_id
            WHERE r.circuit_id = ?1 AND e.finish_position = 1
     UNION SELECT p.source_id FROM table_provenance p
            WHERE p.tbl = 'circuit_layouts'
              AND EXISTS (SELECT 1 FROM circuit_layouts WHERE circuit_id = ?1))
   ORDER BY s.priority, s.id
`

/**
 * The race list's heading and count, as both renderers write them (SD-38).
 * The list holds every race at the venue, the ones still to run among them,
 * so "Every race held here 62" sat beside the tile's "Championship races 61"
 * on /circuits/silverstone: the extra row was the scheduled 2027 race. The
 * heading no longer says "held", and the count separates the two in the words
 * a Grand Prix's venue count uses (venuesCount in queries/grandprix.js): run
 * first, which is the tile's figure, since both count status 'completed'
 * (v_circuits.races), and then the rows the table marks "not yet run".
 */
export const RACES_HEADING = 'Every race here'

export const racesCount = (races) => {
  const ahead = races.filter((row) => row.status !== 'completed').length
  const run = races.length - ahead
  return ahead ? `${number(run)} · ${number(ahead)} to come` : number(run)
}

/** The winner, or "not yet run" for a race still on the calendar. */
export const raceWinnerHere = (name, row) => (row.status !== 'completed' ? NOT_YET_RUN : text(name))

export const RACE_COLUMNS = [
  { key: 'year', rowHeader: true, label: 'Season', align: 'num', text: (year) => String(year) },
  { key: 'name_used', rowHeader: true, label: 'Grand Prix' },
  // Plain text in both halves, and a NULL here is a race this database has
  // not attributed to a layout - which is what the sentence above the table
  // says in words. Monza ran 77 races with no layout recorded against any of
  // them (VD-29).
  { key: 'layout_key', label: 'Layout', collapse: true },
  { key: 'winner', label: 'Winner', text: raceWinnerHere },
  // Blank, not dashed, beside that "not yet run" (roundResult, CD-43).
  { key: 'constructor', label: 'Constructor', text: roundResult },
]

export const WINNER_COLUMNS = [
  { key: 'driver', rowHeader: true, label: 'Driver' },
  { key: 'wins', label: 'Wins', align: 'num' },
  { key: 'first_win', label: 'Span', align: 'num', text: (_, row) => span(row.first_win, row.last_win) },
]

// The span the WINNERS table above already prints for a driver, and this
// one did not for a constructor. AF-52's mark takes `last_win` and its
// tooltip names that season, so the row has to show it: a mark whose claim
// a reader cannot check against the row is the one thing this site does not
// do. The column is the same construction as WINNER_COLUMNS's.
export const TEAM_COLUMNS = [
  { key: 'constructor', rowHeader: true, label: 'Constructor' },
  { key: 'wins', label: 'Wins', align: 'num' },
  { key: 'first_win', label: 'Span', align: 'num', text: (_, row) => span(row.first_win, row.last_win) },
]

/**
 * The line above a circuit's race list naming the events held there, as
 * segments both renderers draw: `{ text }` is words, `{ id, name }` is a
 * link to that Grand Prix, and `key` is the segment's place in the sentence,
 * for React. "Held here as the British Grand Prix (60 races) and the
 * 70th Anniversary Grand Prix (1 race)." An event only on the calendar here
 * has not been held here, and gets a sentence of its own: "On the calendar
 * here as the Spanish Grand Prix."
 */
export function heldAs(rows) {
  const words = []
  const clause = (lead, group, count) => {
    if (!group.length) return
    words.push({ text: `${words.length ? ' ' : ''}${lead} the ` })
    group.forEach((row, i) => {
      if (i > 0) words.push({ text: i === group.length - 1 ? ' and the ' : ', the ' })
      words.push({ id: row.id, name: row.name })
      if (count) words.push({ text: ` (${row.races} ${row.races === 1 ? 'race' : 'races'})` })
    })
    words.push({ text: '.' })
  }
  clause('Held here as', rows.filter((row) => row.races > 0), true)
  clause('On the calendar here as', rows.filter((row) => !(row.races > 0) && row.scheduled > 0), false)
  return words.map((segment, place) => ({ ...segment, key: `${place}` }))
}

/** "1 season", "76 seasons". */
const seasonCount = (n) => `${n} ${n === 1 ? 'season' : 'seasons'}`

/**
 * The circuit's tiles, as both renderers draw them (VD-49), from CIRCUIT's
 * row: the races and the span are v_circuits', derived from the races, since
 * the stored last_gp is NULL for every venue still in use and the stored
 * count is not the races.
 */
export const circuitStrip = (circuit) => [
  { label: 'Championship races', value: number(circuit.races) },
  {
    label: LABELS.seasons,
    value: span(circuit.derived_first, circuit.derived_last),
    note: seasonCount(circuit.seasons_used ?? 0),
  },
  { label: 'Length', value: circuit.length_km ? `${circuit.length_km} km` : null, note: 'current layout' },
  { label: 'Turns', value: circuit.turns },
  { label: 'Direction', value: circuit.direction },
  { label: 'Type', value: circuit.circuit_type },
]

/*
 * WHERE WINNERS START HERE (AF-133)
 *
 * Every race run here, by the grid slot its winner started from, counted
 * from race_entries (finish_position = 1, with `grid`) and drawn three ways:
 * the starting grid with a dot in each box for every race won from it, its
 * phone form as a strip of slots, and one chip per race by decade.
 * charts/gridStarts.js lays the first two out for both renderers; the rest
 * is here, read by Circuit.jsx and scripts/prerender.js alike.
 *
 * A RACE IS THE UNIT, not a winning entry. A race with two drivers
 * classified first is a shared drive, and race_entries records each driver's
 * own grid slot, and not the slot the winning car started from (Reims 1951:
 * Fangio 1st on the grid, Fagioli 7th, in the one car). Those races are kept
 * apart and labelled, never counted as either slot - and so are a winner
 * who started from the pit lane (grid_text 'PL', grid NULL) and one whose
 * slot nobody recorded (grid NULL). None of the three is a slot, and none is
 * a zero.
 */

/** Every winning entry of every race run here, oldest first; `winners` is how many the race has. */
export const STARTS = `
  SELECT r.year, r.round, r.name_used, e.grid, e.grid_text,
         e.driver_id, d.full_name AS driver,
         e.constructor_id, k.name AS constructor, k.country AS constructor_country,
         COUNT(*) OVER (PARTITION BY r.id) AS winners
    FROM races r
    JOIN race_entries e ON e.race_id = r.id AND e.finish_position = 1
    LEFT JOIN drivers d ON d.id = e.driver_id
    LEFT JOIN constructors k ON k.id = e.constructor_id
   WHERE r.circuit_id = ? AND r.status = 'completed'
   ORDER BY r.year, r.round, e.id
`

/**
 * The same count at every circuit over the seasons this one has run races
 * in, its first to its last, for the
 * comparison beside this one's: races whose one winner has a grid slot, and
 * how many of those were won from the first slot and from the first two.
 * The rule is startKind()'s - a shared drive and a winner with no slot are
 * left out of both halves of the comparison alike.
 */
export const STARTS_EVERYWHERE = `
  SELECT COUNT(*) AS placed,
         COUNT(CASE WHEN w.grid = 1 THEN 1 END) AS first,
         COUNT(CASE WHEN w.grid <= 2 THEN 1 END) AS front
    FROM (SELECT MAX(e.grid) AS grid, COUNT(*) AS winners
            FROM race_entries e JOIN races r ON r.id = e.race_id
           WHERE e.finish_position = 1 AND r.status = 'completed'
             AND r.year BETWEEN (SELECT MIN(year) FROM races WHERE circuit_id = ?1 AND status = 'completed')
                            AND (SELECT MAX(year) FROM races WHERE circuit_id = ?1 AND status = 'completed')
           GROUP BY e.race_id) w
   WHERE w.winners = 1 AND w.grid IS NOT NULL
`

export const STARTS_HEADING = 'Where winners start here'

/** What a race's start is: a slot, or one of the three things that are not one. */
export const START_KINDS = {
  slot: 'slot',
  pit: 'pit',
  none: 'none',
  shared: 'shared',
}

/** How each start that is not a slot is written, in a chip and in the table. */
export const START_WORDS = {
  pit: 'pit lane',
  none: 'grid not recorded',
  shared: 'shared drive',
}

const startKind = (entries) => {
  if (entries.length > 1) return START_KINDS.shared
  const [e] = entries
  if (e.grid !== null && e.grid !== undefined) return START_KINDS.slot
  return e.grid_text === 'PL' ? START_KINDS.pit : START_KINDS.none
}

/**
 * STARTS's rows as one record per race, oldest first: { key, year, round,
 * name, kind, slot, winners, colour }. `slot` is the grid slot where `kind`
 * is a slot and null otherwise. `colour` is the winning team's
 * (colourForEntry: its livery from 2010, its national colour before 1968,
 * null otherwise and for a shared drive whose drivers' teams differ).
 */
export function winnerStarts(rows) {
  const races = []
  for (const row of rows) {
    const key = `${row.year}-${row.round}`
    let race = races.at(-1)
    if (!race || race.key !== key) {
      race = { key, year: row.year, round: row.round, name: row.name_used, entries: [] }
      races.push(race)
    }
    race.entries.push(row)
  }
  return races.map(({ entries, ...race }) => {
    const kind = startKind(entries)
    const teams = [...new Set(entries.map((e) => e.constructor_id ?? e.constructor))]
    const [first] = entries
    return {
      ...race,
      kind,
      slot: kind === START_KINDS.slot ? first.grid : null,
      winners: entries.map((e) => ({ driver: e.driver, driver_id: e.driver_id, constructor: e.constructor, constructor_id: e.constructor_id })),
      team: teams.length === 1 ? first.constructor : entries.map((e) => e.constructor).join(' / '),
      colour:
        teams.length === 1
          ? colourForEntry({ constructorId: first.constructor_id, country: first.constructor_country, year: race.year, team: first.constructor })
          : null,
    }
  })
}

/** The races with a grid slot, by slot: a Map from slot to its races, oldest first. */
export function bySlot(races) {
  const slots = new Map()
  for (const race of races) {
    if (race.kind !== START_KINDS.slot) continue
    if (!slots.has(race.slot)) slots.set(race.slot, [])
    slots.get(race.slot).push(race)
  }
  return slots
}

/** "Max Verstappen", "Juan Manuel Fangio / Luigi Fagioli". */
export const winnerNames = (race) => race.winners.map((w) => text(w.driver)).join(' / ')

/** A race as one mark's words: "2023 Max Verstappen, Red Bull, from 6th". */
export const startTitle = (race) =>
  `${race.year} ${winnerNames(race)}, ${text(race.team)}, ${race.kind === START_KINDS.slot ? `from ${ordinal(race.slot)}` : START_WORDS[race.kind]}`

/** What a chip carries after the year and the team: "6th", or the words for a start that is not a slot. */
export const chipStart = (race) => (race.kind === START_KINDS.slot ? ordinal(race.slot) : START_WORDS[race.kind])

/** "7 of 14 (50%)". */
const share = (part, whole) => `${number(part)} of ${number(whole)} (${percent(part, whole, 0)})`

/** Names joined as prose: "a", "a and b", "a, b and c". */
const prose = (names) => (names.length < 2 ? names.join('') : `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`)

/** The most named in a "most wins" line before the rest become a count. */
export const MOST_NAMED = 3

/**
 * "Sir Lewis Hamilton, 5", "Mercedes and Red Bull, 5 each", or, past
 * MOST_NAMED tied, "4 drivers, 1 each". `rows` are WINNERS's or TEAMS's,
 * most wins first; `name` reads a row's name and `noun` counts them.
 */
export function mostWins(rows, name, noun) {
  if (!rows.length) return null
  const top = rows[0].wins
  const tied = rows.filter((row) => row.wins === top)
  if (tied.length === 1) return `${text(name(tied[0]))}, ${number(top)}`
  if (tied.length > MOST_NAMED) return `${number(tied.length)} ${noun}, ${number(top)} each`
  return `${prose(tied.map((row) => text(name(row))))}, ${number(top)} each`
}

/**
 * The few short figures under the heading, as { label, value } for Fields
 * in both renderers. `everywhere` is STARTS_EVERYWHERE's row over the same
 * seasons; `winners` and `teams` are the page's WINNERS and TEAMS rows, so
 * "most wins" is the first line of the two tables beside it, not a second
 * count of its own.
 *
 * The first slot and the first two are counted out of the races that have
 * a slot - a pit-lane start, a slot not recorded and a shared drive are in
 * neither the count nor the total, and the last line says how many there
 * are. "First two slots" rather than "front row": the front row has not
 * always been two cars wide, and this database does not record how each
 * year's grid was formed.
 */
export function startsFigures(races, everywhere, winners, teams) {
  const slots = races.filter((race) => race.kind === START_KINDS.slot)
  const placed = slots.length
  const items = []
  if (placed) {
    const first = slots.filter((race) => race.slot === 1).length
    const front = slots.filter((race) => race.slot <= 2).length
    const years = span(races[0].year, races.at(-1).year)
    items.push({
      label: 'Won from first on the grid',
      value: everywhere?.placed
        ? `${share(first, placed)}, against ${share(everywhere.first, everywhere.placed)} at every circuit, ${years}`
        : share(first, placed),
    })
    items.push({ label: 'Won from the first two slots', value: share(front, placed) })
    const lowest = Math.max(...slots.map((race) => race.slot))
    const from = slots.filter((race) => race.slot === lowest)
    const named = from.slice(0, MOST_NAMED).map((race) => `${winnerNames(race)}, ${race.year}`)
    const more = from.length > MOST_NAMED ? ` and ${number(from.length - MOST_NAMED)} more` : ''
    items.push({ label: 'Lowest winning grid slot', value: `${ordinal(lowest)} — ${named.join('; ')}${more}` })
  }
  const driver = mostWins(winners, (row) => row.driver, 'drivers')
  if (driver) items.push({ label: 'Most wins by a driver', value: driver })
  const team = mostWins(teams, (row) => row.constructor, 'teams')
  if (team) items.push({ label: 'Most wins by a team', value: team })
  const apart = [START_KINDS.pit, START_KINDS.none, START_KINDS.shared]
    .map((kind) => [kind, races.filter((race) => race.kind === kind).length])
    .filter(([, n]) => n > 0)
    .map(([kind, n]) => `${number(n)} ${kind === START_KINDS.shared ? (n === 1 ? 'shared drive' : 'shared drives') : `${START_WORDS[kind]}`}`)
  if (apart.length) items.push({ label: 'Not counted as a slot', value: apart.join(' · ') })
  return items
}

/**
 * The line under the heading: how many races, and across how many of the
 * layouts the register records for the circuit (`circuit_layouts`, the
 * thirteen circuits with a timeline; the rest record none).
 */
export function startsLine(races, layouts) {
  const all = races.length === 1 ? 'The one race won here' : `All ${number(races.length)} races won here, counted together`
  if (layouts > 1) return `${all}, across the ${number(layouts)} layouts the register records.`
  if (layouts === 1) return `${all}, on the one layout the register records.`
  return `${all}. No layout timeline is recorded for this circuit.`
}

/** The figure's note: 50 words at its longest (conventions.mjs), with a hollow dot and both kinds of colour. */
export const startsNote = (colours) => {
  const drawn = colours.filter(Boolean)
  const hollow = drawn.length < colours.length
  const colour = drawn.length
    ? ` Coloured by winner: ${colourSource(drawn)}.${hollow ? ' A hollow dot has no colour on record.' : ''}`
    : ' No winner here has a colour on record, so every dot is hollow.'
  return `A dot is a race won from that slot; over eight, the box shows the count. Boxes stand two abreast, as grids do now.${colour}`
}

/** The figure's numbers: one row per slot won from, then each start that is not a slot. */
export function startsTable(races) {
  const rows = [...bySlot(races)]
    .sort(([a], [b]) => a - b)
    .map(([slot, won]) => ({ key: `slot-${slot}`, start: ordinal(slot), wins: won.length, races: won }))
  for (const kind of [START_KINDS.pit, START_KINDS.none, START_KINDS.shared]) {
    const won = races.filter((race) => race.kind === kind)
    if (won.length) rows.push({ key: kind, start: START_WORDS[kind], wins: won.length, races: won })
  }
  return rows
}

export const STARTS_COLUMNS = [
  { key: 'start', rowHeader: true, label: 'Grid slot' },
  { key: 'wins', label: 'Wins', align: 'num' },
  {
    key: 'races',
    label: 'Races won',
    text: (races) => races.map((race) => `${race.year} ${winnerNames(race)} (${text(race.team)})`).join('; '),
  },
]

/** The drawing's accessible name: what the table holds, in one line. "Wins here by grid slot: 1st 7, 2nd 5, 4th 1, 6th 1." */
export const startsLabel = (rows) => `Wins here by grid slot: ${rows.map((row) => `${row.start} ${number(row.wins)}`).join(', ')}.`

/** The timeline's heading, under the figure. */
export const TIMELINE_HEADING = 'Race by race'

/** The races by decade, oldest first: [{ decade: '1950s', races }]. */
export function byDecade(races) {
  const decades = []
  for (const race of races) {
    const decade = `${Math.floor(race.year / 10) * 10}s`
    if (decades.at(-1)?.decade !== decade) decades.push({ decade, races: [] })
    decades.at(-1).races.push(race)
  }
  return decades
}
