import { Note, Onward, Page, Section } from '../components/Page.jsx'
import { Result } from '../components/States.jsx'
import DataTable from '../components/DataTable.jsx'
import SubNav from '../components/SubNav.jsx'
import { rows, useQueries } from '../data/useQuery.js'
import { number } from '../lib/format.js'
import {
  CONSEQUENCES,
  CONSEQUENCES_NOTE,
  CONSEQUENCE_COLUMNS,
  GEOMETRY_LICENCE,
  LICENCES,
  LICENCES_NOTE,
  LICENCE_COLUMNS,
  SOURCES,
  SOURCES_FOOTER,
  SOURCE_COLUMNS,
} from '../queries/sources.js'

const SPEC = {
  sources: [SOURCES],
  licences: [LICENCES],
  geometry: [GEOMETRY_LICENCE],
}

/*
 * The React renders for the two linked columns queries/sources.js defines.
 * The words each cell carries are the column's own `text`, which
 * scripts/prerender.js prints too, so the static tables are these.
 */
const external = (urlKey) => ({
  render: (name, row) =>
    row[urlKey] ? (
      <a href={row[urlKey]} target="_blank" rel="noreferrer noopener">
        {name}
      </a>
    ) : (
      name
    ),
})
const SOURCE_APP = { source: external('url') }
const LICENCE_APP = { licence: external('licence_url') }
const withRenders = (columns, renders) =>
  columns.map((column) => ({ ...column, ...(Object.hasOwn(renders, column.key) ? renders[column.key] : {}) }))

export default function Sources() {
  const state = useQueries(SPEC)

  return (
    <Page
      title="Sources and licences"
      lede="Where every figure on this site comes from, and what you may do with it if you take it. Sources are ranked on whether anything independent can check them, not on how much data they hold."
    >
      <SubNav />
      <Result state={state}>
        {(data) => {
          const sources = rows(data, 'sources')
          const licences = rows(data, 'licences')
          const geometry = rows(data, 'geometry')

          return (
            <>
              <Section
                title="What a licence cost, or bought"
                note={CONSEQUENCES_NOTE}
              >
                <DataTable rows={CONSEQUENCES} rowKey={(row) => row.source} sortable={false} columns={CONSEQUENCE_COLUMNS} />
              </Section>

              <Note>
                <strong>The ODbL obligation is confined to a separate file.</strong>{' '}
                {geometry.map((row) => `${number(row.n)} traced centrelines under ${row.licence}`).join(', ')}
                , published as <code>f1-geometry.db</code>. <code>f1.db</code> contains no
                OpenStreetMap data of any kind, so it is not a Derivative Database and does not
                carry ODbL; your browser merged the two to draw the maps on this site. That
                containment is deliberate: ODbL reaches the whole database it lands in, so
                twenty-five centrelines inside <code>f1.db</code> would set the licence of
                117,000 rows that have nothing to do with them.
              </Note>

              <Section title="The source registry" count={`${sources.length}`}>
                <DataTable
                  rows={sources}
                  rowKey={(row) => row.id}
                  sortable
                  sort="priority"
                  direction="asc"
                  page={30}
                  columns={withRenders(SOURCE_COLUMNS, SOURCE_APP)}
                  footer={SOURCES_FOOTER}
                />
              </Section>

              <Section
                title="Photograph licences"
                count={`${licences.length} distinct`}
                note={LICENCES_NOTE}
              >
                <DataTable
                  rows={licences}
                  rowKey={(row) => row.licence}
                  sortable
                  sort="images"
                  direction="desc"
                  columns={withRenders(LICENCE_COLUMNS, LICENCE_APP)}
                />
              </Section>

              <Section title="Using this data">
                <p className="measure">
                  You are welcome to. Carry the licence with whatever you take: attribute F1DB for
                  the race records, keep share-alike on anything derived from Wikipedia prose, and
                  treat a traced centreline as OpenStreetMap under ODbL — that obligation travels
                  with it.
                </p>
                <p className="measure faint">
                  This site is unaffiliated with Formula One, the FIA, or any team. Formula One,
                  F1 and Grand Prix are trademarks of their respective owners and are used here
                  descriptively.
                </p>
              </Section>

              <Onward
                items={[
                  { to: '/data/quality', label: 'Data quality', hint: 'How far to trust each figure, and what is missing.' },
                  { to: '/data/sql', label: 'SQL console', hint: 'Pull the rows you need straight out of the database.' },
                  { to: '/data', label: 'Data', hint: 'The database itself: the files, the version, and how far to trust it.' },
                ]}
              />
            </>
          )
        }}
      </Result>
    </Page>
  )
}
