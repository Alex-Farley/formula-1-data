import { Note, Onward, Page, Section } from '../components/Page.jsx'
import { Result } from '../components/States.jsx'
import DataTable from '../components/DataTable.jsx'
import SubNav from '../components/SubNav.jsx'
import { rows, useQueries } from '../data/useQuery.js'
import { host, number } from '../lib/format.js'

const SPEC = {
  sources: ['SELECT * FROM source_registry ORDER BY priority'],
  licences: [
    `SELECT licence, licence_url, COUNT(*) AS images
       FROM article_images
      WHERE licence IS NOT NULL
      GROUP BY licence
      ORDER BY images DESC`,
  ],
  geometry: ['SELECT COUNT(*) AS n, licence FROM circuit_geometry GROUP BY licence'],
}

/**
 * The licences, as consequences rather than as a list of names.
 *
 * A licence is not a footnote here — it is the thing that decided what this
 * database contains. The full classification of every race was available for
 * seven versions and stayed out because the copy that could be got carried a
 * non-commercial clause; it shipped when the same facts were found under CC BY.
 */
const CONSEQUENCES = [
  [
    'F1DB',
    'CC BY 4.0',
    'Attribution only, and no non-commercial clause — which is why the full classification of all 1,161 races ships in the committed database rather than being loaded locally. This is the licence that closed the largest gap this project had.',
  ],
  [
    'Wikipedia',
    'CC BY-SA 4.0',
    'Share-alike, and it reaches any prose taken from it. Registers, notes and the era descriptions are downstream of this.',
  ],
  [
    'Jolpica-F1 (Ergast)',
    'CC BY-NC-SA',
    'The non-commercial clause means these rows are loaded locally as a cross-check and never committed. They are what produces the 118 recorded finishing-position disagreements, and they are why those disagreements are recorded rather than resolved.',
  ],
  [
    'Wikidata',
    'CC0',
    'No obligation at all. Used to resolve circuit identity to an OpenStreetMap relation.',
  ],
  [
    'OpenStreetMap',
    'ODbL 1.0',
    'Share-alike plus a database right, so it is quarantined into a file of its own: the centrelines ship as f1-geometry.db, f1.db contains no OpenStreetMap data at all, and two databases side by side are a Collective Database rather than a derivative one. Your browser merges them to draw the maps.',
  ],
  [
    'Wikimedia Commons',
    'per file',
    'Sixteen different licence strings across the photographs, so each row carries its own. No pixels are stored — only a reference, its licence, and its photographer, and the photographer is displayed with the picture because the licence requires it.',
  ],
]

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
                note="Licences decided what is in this database and what is not. If you reuse anything from here, this is the column that applies to you."
              >
                <DataTable
                  rows={CONSEQUENCES.map(([source, licence, consequence]) => ({
                    source,
                    licence,
                    consequence,
                  }))}
                  rowKey={(row) => row.source}
                  sortable={false}
                  columns={[
                    { key: 'source', label: 'Source' },
                    { key: 'licence', label: 'Licence' },
                    { key: 'consequence', label: 'Consequence', align: 'prose' },
                  ]}
                />
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
                  columns={[
                    { key: 'priority', label: 'Rank', align: 'num' },
                    {
                      key: 'source',
                      label: 'Source',
                      render: (name, row) =>
                        row.url ? (
                          <a href={row.url} target="_blank" rel="noreferrer noopener">
                            {name}
                          </a>
                        ) : (
                          name
                        ),
                    },
                    { key: 'authority', label: 'Authority' },
                    { key: 'use', label: 'Used for', align: 'prose' },
                    { key: 'licence', label: 'Licence', align: 'prose' },
                    { key: 'cadence', label: 'Updated', align: 'prose' },
                    { key: 'checkability', label: 'What can check it', align: 'prose' },
                  ]}
                  footer="Ranked by authority, not by volume. The last column is the one that decides where a source sits."
                />
              </Section>

              <Section
                title="Photograph licences"
                count={`${licences.length} distinct`}
                note="Commons files do not share one licence, so each photograph carries its own — which is why the credit always travels with the picture."
              >
                <DataTable
                  rows={licences}
                  rowKey={(row) => row.licence}
                  sortable
                  sort="images"
                  direction="desc"
                  columns={[
                    {
                      key: 'licence',
                      label: 'Licence',
                      render: (name, row) =>
                        row.licence_url ? (
                          <a href={row.licence_url} target="_blank" rel="noreferrer noopener">
                            {name}
                          </a>
                        ) : (
                          name
                        ),
                    },
                    { key: 'images', label: 'Photographs', align: 'num' },
                    {
                      key: 'licence_url',
                      label: 'Terms',
                      render: (url) => (url ? host(url) : null),
                    },
                  ]}
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
