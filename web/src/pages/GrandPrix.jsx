import { Link, useParams } from 'react-router-dom'
import { Confidence, Fields, Onward, Page, Section, Stats } from '../components/Page.jsx'
import { Result } from '../components/States.jsx'
import DataTable, { cell } from '../components/DataTable.jsx'
import SearchKey from '../components/SearchKey.jsx'
import { rows, useQueries } from '../data/useQuery.js'
import { number, span } from '../lib/format.js'
import { NAMES, NOT_YET_RUN, SHARED, SPRINT } from '../lib/site.js'
import { ONWARD, TRAIL } from '../lib/wayfinding.js'
import {
  CIRCUITS,
  CIRCUIT_COLUMNS,
  venuesCount,
  EDITIONS,
  EDITION_COLUMNS,
  GRAND_PRIX,
  editionCar,
  WINNERS,
  WINNER_COLUMNS,
} from '../queries/grandprix.js'

/*
 * The React renders for the columns queries/grandprix.js defines — the links,
 * the tags and the sort keys; the router is the reason they live here. The
 * words each cell carries are the column's own `text`, which
 * scripts/prerender.js prints too, so the static tables are these.
 */
const CIRCUIT_APP = {
  circuit: {
    render: (name, row) => (row.circuit_id ? <Link to={`/circuits/${row.circuit_id}`}>{name}</Link> : cell(name)),
  },
  first_year: {
    render: (_, row) =>
      row.first_year === null && row.scheduled ? (
        <span className="tag">{NOT_YET_RUN}</span>
      ) : (
        span(row.first_year, row.last_year)
      ),
    sort: (row) => row.first_year,
  },
}
const EDITION_APP = {
  year: { render: (year) => <Link to={`/seasons/${year}`}>{year}</Link> },
  name_used: {
    render: (name, row) => (
      <>
        <Link to={`/races/${row.year}/${row.round}`}>{name}</Link>
        {row.sprint ? ' ' : ''}
        {row.sprint ? <span className="tag">{SPRINT}</span> : null}
      </>
    ),
  },
  circuit: {
    render: (name, row) => (row.circuit_id ? <Link to={`/circuits/${row.circuit_id}`}>{name}</Link> : cell(name)),
  },
  winner: {
    render: (name, row) =>
      row.status !== 'completed' ? (
        <span className="tag">{NOT_YET_RUN}</span>
      ) : row.winner_id ? (
        <>
          <Link to={`/drivers/${row.winner_id}`}>{name}</Link>
          {row.co_winner_id ? ' ' : ''}
          {row.co_winner_id ? <span className="tag">{SHARED}</span> : null}
        </>
      ) : (
        cell(name)
      ),
  },
  constructor: {
    render: (name, row) =>
      row.status === 'completed' && row.constructor_id ? (
        <Link to={`/constructors/${row.constructor_id}`}>{name}</Link>
      ) : (
        editionCar(name, row)
      ),
  },
}
const WINNER_APP = {
  driver: { render: (name, row) => <Link to={`/drivers/${row.driver_id}`}>{name}</Link> },
  first_win: { sort: (row) => row.first_win },
}
const withRenders = (columns, renders) =>
  columns.map((column) => ({ ...column, ...(Object.hasOwn(renders, column.key) ? renders[column.key] : {}) }))

export default function GrandPrix() {
  const { id } = useParams()
  const state = useQueries({
    gp: [GRAND_PRIX, [id]],
    circuits: [CIRCUITS, [id]],
    editions: [EDITIONS, [id]],
    winners: [WINNERS, [id]],
  })

  return (
    <Result state={state} context="That Grand Prix could not be read">
      {(data) => {
        const gp = data.gp.rows[0]
        if (!gp) {
          return (
            <Page title="No such Grand Prix" cite={false} trail={TRAIL.missing('/grands-prix', 'Grands Prix')}>
              <p className="muted">Nothing in the register has the id “{id}”.</p>
              <p>
                Press <SearchKey /> to search by name, or <Link to="/grands-prix">browse every Grand Prix</Link>.
              </p>
            </Page>
          )
        }
        return <GrandPrixBody gp={gp} data={data} />
      }}
    </Result>
  )
}

function GrandPrixBody({ gp, data }) {
  const circuits = rows(data, 'circuits')
  const editions = rows(data, 'editions')
  const winners = rows(data, 'winners')
  return (
    <Page eyebrow={gp.country} title={NAMES.grandPrix(gp.name).headline} trail={TRAIL.grandPrix(gp.id, gp.name)} lede={gp.notes}>
      <Section>
        <Stats
          items={[
            { label: 'Times held', value: number(gp.held) },
            { label: 'Span', value: span(gp.first_held, gp.last_held) },
            { label: 'Circuits', value: number(gp.circuits) },
            gp.scheduled ? { label: 'Still to come', value: number(gp.scheduled) } : null,
          ]}
        />
      </Section>

      <Section title="Where it has been held" count={venuesCount(circuits)}>
        <DataTable
          rows={circuits}
          rowKey={(row) => row.circuit_id ?? row.circuit}
          sortable={false}
          columns={withRenders(CIRCUIT_COLUMNS, CIRCUIT_APP)}
        />
      </Section>

      {winners.length > 0 && (
        <Section title="Most wins" count={winners.length === 1 ? '1 driver' : `${winners.length} drivers`}>
          <DataTable
            rows={winners}
            rowKey={(row) => row.driver_id}
            sortable
            sort="wins"
            direction="desc"
            page={25}
            columns={withRenders(WINNER_COLUMNS, WINNER_APP)}
          />
        </Section>
      )}

      <Section title="Every edition" count={`${editions.length}`}>
        <DataTable
          rows={editions}
          rowKey={(row) => `${row.year}-${row.round}`}
          sortable
          sort="year"
          direction="desc"
          page={100}
          columns={withRenders(EDITION_COLUMNS, EDITION_APP)}
        />
      </Section>

      <Section title="On the record">
        <Fields
          items={[
            // Dropped rather than dashed where there is none, as the static
            // page drops it: an event with no other name is not missing one.
            gp.aliases ? { label: 'Also run as', value: gp.aliases } : null,
            { label: 'Confidence', value: <Confidence value={gp.confidence} /> },
          ]}
        />
      </Section>

      <Onward {...ONWARD.grandPrix({ editions, winners })} />
    </Page>
  )
}
