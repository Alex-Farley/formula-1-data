import { Link } from 'react-router-dom'
import { Onward, Page, Section } from '../components/Page.jsx'
import { Result } from '../components/States.jsx'
import DataTable from '../components/DataTable.jsx'
import LiveryMark from '../components/LiveryMark.jsx'
import { Select } from '../components/Filters.jsx'
import { row, rows, useQueries, useQuery } from '../data/useQuery.js'
import { colourForEntry } from '../lib/liveries.js'
import { NAMES } from '../lib/site.js'
import { oneOf, useUrlState } from '../lib/urlstate.js'
import { ONWARD, TRAIL } from '../lib/wayfinding.js'
import {
  CHOOSE,
  COMPARE_CAVEAT,
  COMPARE_DRIVERS,
  COMPARE_LEDE,
  SAME_DRIVER,
  careerColumns,
  careerRows,
  closestNote,
  closestTeamMates,
  comparePath,
  compareSearch,
  noTeamMate,
  neverTeamMates,
  pairSummary,
} from '../queries/compare.js'
import { DERIVED, DRIVER, PAIR_COLUMNS, TEAM_MATES, teamMatesFooter } from '../queries/driver.js'

/**
 * /compare?a=&b= (PD-43). The words, the figures and the queries are
 * queries/compare.js's and queries/driver.js's; this adds the two pickers,
 * the links and the livery mark the driver page's tables wear.
 *
 * An id the register does not hold is treated as unchosen (lib/urlstate.js
 * oneOf), so `?a=nobody` shows an empty picker rather than a picker that
 * says one thing and a page that says another.
 */
const PAIR_APP = {
  year: { render: (year) => <Link to={`/seasons/${year}`}>{year}</Link> },
  constructor: {
    render: (name, entry) => (
      <>
        <LiveryMark
          colour={colourForEntry({
            constructorId: entry.constructor_id,
            country: entry.constructor_country,
            year: entry.year,
            team: name,
          })}
          year={entry.year}
        />
        <Link to={`/constructors/${entry.constructor_id}`}>{name}</Link>
      </>
    ),
  },
}
const pairColumns = PAIR_COLUMNS.map((column) => ({ ...column, ...PAIR_APP[column.key] }))

export default function Compare() {
  const state = useQuery(COMPARE_DRIVERS)
  const [chosen, set] = useUrlState({ a: '', b: '' })
  return (
    <Result state={state} context="The driver register could not be read">
      {(data) => {
        const options = data.rows.map((driver) => [driver.id, driver.full_name])
        const a = oneOf(chosen.a, options)
        const b = oneOf(chosen.b, options)
        const nameOf = (id) => data.rows.find((driver) => driver.id === id)?.full_name ?? null
        return <CompareBody a={a} b={b} nameOf={nameOf} options={options} set={set} />
      }}
    </Result>
  )
}

function CompareBody({ a, b, nameOf, options, set }) {
  const pair = a && b && a !== b
  const names = pair ? NAMES.comparison(nameOf(a), nameOf(b)) : NAMES.compare()

  return (
    <Page
      title={names.headline}
      documentName={names.title}
      trail={TRAIL.compare()}
      lede={COMPARE_LEDE}
      // The pair is the page: cited without it, a comparison is two empty
      // pickers. The canonical stays /compare, the one static page.
      citedSearch={pair ? compareSearch(a, b) : ''}
    >
      <div className="filters">
        <Select value={a} onChange={(value) => set({ a: value })} options={options} label="First driver" all={CHOOSE} />
        <Select value={b} onChange={(value) => set({ b: value })} options={options} label="Second driver" all={CHOOSE} />
      </div>

      {a && a === b && <p className="muted">{SAME_DRIVER}</p>}

      {/* Keyed on the choice, so a new choice starts from loading rather
          than rendering one frame of the last choice's answers under it. */}
      {(a || b) && a !== b && <Chosen key={`${a}|${b}`} a={a} b={b} pair={pair} nameOf={nameOf} />}

      <Onward {...ONWARD.compare()} />
    </Page>
  )
}

/** What the choice asks of the database, and the answer drawn. */
function Chosen({ a, b, pair, nameOf }) {
  // One chosen, in either picker: that driver's team-mates, each offered in
  // the other picker's place.
  const one = a || b
  const state = useQueries({
    driverA: pair ? [DRIVER, [a]] : null,
    driverB: pair ? [DRIVER, [b]] : null,
    derivedA: pair ? [DERIVED, [a]] : null,
    derivedB: pair ? [DERIVED, [b]] : null,
    // With one driver chosen, every team-mate of theirs, to offer as the
    // second; with two, the pair's own seasons.
    together: [TEAM_MATES, [one, pair ? b : null]],
  })
  return (
    <Result state={state} context="Those careers could not be read" skeleton>
      {(data) =>
        pair ? (
          <Pair data={data} />
        ) : (
          <Closest
            name={nameOf(one)}
            together={rows(data, 'together')}
            pathTo={(mate) => (a ? comparePath(a, mate) : comparePath(mate, b))}
          />
        )
      }
    </Result>
  )
}

/** Both chosen: the careers, then the seasons they shared a constructor. */
function Pair({ data }) {
  const driverA = row(data, 'driverA')
  const driverB = row(data, 'driverB')
  const together = rows(data, 'together')
  const nameA = driverA.full_name
  const nameB = driverB.full_name
  const summary = pairSummary(nameA, nameB, together)
  return (
    <>
      <Section title="Two careers">
        <DataTable
          rows={careerRows(driverA, row(data, 'derivedA') ?? {}, driverB, row(data, 'derivedB') ?? {})}
          rowKey={(figure) => figure.figure}
          // The figures are in the order the driver page's strip gives
          // them; sorting rows of unlike figures by value would mean nothing.
          sortable={false}
          columns={careerColumns(nameA, nameB)}
          footer={COMPARE_CAVEAT}
        />
        <p className="source-note">
          The whole of each career: <Link to={`/drivers/${driverA.id}`}>{nameA}</Link> ·{' '}
          <Link to={`/drivers/${driverB.id}`}>{nameB}</Link>
        </p>
      </Section>

      <Section title="As team-mates" note={summary ?? neverTeamMates(nameA, nameB)}>
        {together.length > 0 && (
          <DataTable
            rows={together}
            rowKey={(entry) => `${entry.year}-${entry.constructor_id}`}
            columns={pairColumns}
            footer={teamMatesFooter(nameA)}
          />
        )}
      </Section>
    </>
  )
}

/**
 * One chosen: the drivers they shared most Grands Prix with, each a link to
 * that pair, so the most common comparison is one click from here.
 */
function Closest({ name, together, pathTo }) {
  const mates = closestTeamMates(together)
  if (mates.length === 0) return <p className="muted">{noTeamMate(name)}</p>
  return (
    <Section title={`${name}’s team-mates`} note={closestNote(name, mates.length, new Set(together.map((entry) => entry.mate_id)).size)}>
      <ul>
        {mates.map((mate) => (
          <li key={mate.id}>
            <Link to={pathTo(mate.id)}>{mate.name}</Link>{' '}
            <span className="faint">
              {mate.races} {mate.races === 1 ? 'Grand Prix' : 'Grands Prix'} together
            </span>
          </li>
        ))}
      </ul>
    </Section>
  )
}
