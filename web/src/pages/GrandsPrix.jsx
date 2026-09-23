import { Link } from 'react-router-dom'
import { Onward, Page, Section } from '../components/Page.jsx'
import { Result } from '../components/States.jsx'
import DataTable, { cell } from '../components/DataTable.jsx'
import { useQuery } from '../data/useQuery.js'
import { NAMES, SHARED } from '../lib/site.js'
import { ONWARD, TRAIL } from '../lib/wayfinding.js'
import { GRANDS_PRIX, GRANDS_PRIX_COLUMNS, GRANDS_PRIX_FOOTER, GRANDS_PRIX_LEDE } from '../queries/grandsprix.js'

/**
 * The React renders for the columns queries/grandsprix.js defines — the links,
 * the tag and a sort key; the router is the reason they live here. The words
 * each cell carries are the column's own `text`, which scripts/prerender.js
 * prints too, so the static register is this one.
 */
const APP = {
  name: { render: (name, row) => <Link to={`/grands-prix/${row.id}`}>{name}</Link> },
  first_held: { sort: (row) => row.first_held },
  last_winner: {
    render: (name, row) =>
      row.last_winner_id ? (
        <>
          <Link to={`/drivers/${row.last_winner_id}`}>{name}</Link>
          {row.last_co_winner_id ? ' ' : ''}
          {row.last_co_winner_id ? <span className="tag">{SHARED}</span> : null}
        </>
      ) : (
        cell(name)
      ),
  },
}

export default function GrandsPrix() {
  const state = useQuery(GRANDS_PRIX)
  return (
    <Page
      title={NAMES.grandsPrix().headline}
      documentName={NAMES.grandsPrix().title}
      trail={TRAIL.grandsPrix()}
      lede={GRANDS_PRIX_LEDE}
    >
      <Section>
        <Result state={state} skeleton>
          {(data) => (
            <DataTable
              addressed
              rows={data.rows}
              rowKey={(row) => row.id}
              sort="held"
              direction="desc"
              page={100}
              columns={GRANDS_PRIX_COLUMNS.map((column) => ({ ...column, ...APP[column.key] }))}
              footer={GRANDS_PRIX_FOOTER}
            />
          )}
        </Result>
      </Section>

      <Onward {...ONWARD.grandsPrix()} />
    </Page>
  )
}
