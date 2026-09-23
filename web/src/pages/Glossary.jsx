import { useMemo } from 'react'
import { Onward, Page, Section } from '../components/Page.jsx'
import { Result } from '../components/States.jsx'
import DataTable from '../components/DataTable.jsx'
import { SportNav } from '../components/SubNav.jsx'
import { Chips, Filters, NoMatch, SearchField } from '../components/Filters.jsx'
import { rows, useQueries } from '../data/useQuery.js'
import { GLOSSARY, GLOSSARY_COLUMNS, PERSONNEL, PERSONNEL_COLUMNS } from '../queries/glossary.js'

import { ONWARD, TRAIL } from '../lib/wayfinding.js'
import { oneOf, useUrlState } from '../lib/urlstate.js'
import { NAMES } from '../lib/site.js'
const SPEC = {
  glossary: [GLOSSARY],
  personnel: [PERSONNEL],
}

// The sort key for the one column whose cell is a span of two values.
const PERSONNEL_APP = { active_from: { sort: (row) => row.active_from } }
const withRenders = (columns, renders) =>
  columns.map((column) => ({ ...column, ...(Object.hasOwn(renders, column.key) ? renders[column.key] : {}) }))

export default function Glossary() {
  const state = useQueries(SPEC)

  return (
    <Page
      title={NAMES.glossary().headline}
      documentName={NAMES.glossary().title}
      trail={TRAIL.glossary()}
      lede="What the words on a classification actually mean — and the designers, administrators and team principals whose decisions are behind most of the rest of this site."
    >
      <SportNav />
      <Result state={state}>
        {(data) => {
          const glossary = rows(data, 'glossary')
          const personnel = rows(data, 'personnel')
          return <Body glossary={glossary} personnel={personnel} />
        }}
      </Result>
    </Page>
  )
}

function Body({ glossary, personnel }) {
  const categories = useMemo(
    () => [...new Set(glossary.map((row) => row.category).filter(Boolean))].sort(),
    [glossary],
  )
  const chips = [['', 'All'], ...categories.map((c) => [c, c])]

  // In the address, where it survives the page it explains (IA-08). The two
  // tables here are not addressed: one set of sort parameters names one
  // table, and this page has a glossary and a list of people.
  const [params, set, clear] = useUrlState({ q: '', category: '' })
  const term = params.q
  const category = oneOf(params.category, chips)

  const filtered = useMemo(() => {
    const needle = term.trim().toLowerCase()
    return glossary.filter((row) => {
      if (category && row.category !== category) return false
      if (!needle) return true
      return (
        row.term.toLowerCase().includes(needle) || row.definition.toLowerCase().includes(needle)
      )
    })
  }, [glossary, term, category])

  // The two filters as a plural noun phrase, for the empty state (IX-28).
  // Not "terms about tyres": a glossary category is whatever `data/` says it
  // is, and half of them are adjectives - `sporting`, `technical`, `format`,
  // `power unit` - so "terms about sporting" is what that phrasing would
  // actually have written for 13 of the 44 terms. Naming the category as a
  // category reads for every value the chips can carry, including one added
  // after this line.
  const among = category ? `terms in the ${category} category` : ''

  return (
    <>
      <Section title="Glossary" count={`${glossary.length} terms`}>
        <Filters showing={filtered.length} of={glossary.length} noun="terms">
          <SearchField
            value={term}
            onChange={(value) => set({ q: value })}
            label="Filter terms"
            placeholder="A term…"
          />
          <Chips
            label="Filter terms by category"
            value={category}
            onChange={(value) => set({ category: value })}
            options={chips}
          />
        </Filters>
        {/* No opening sort: the query's case-insensitive ORDER BY is the order
            the table opens in, and the static page prints the rows as they come.
            The header says so without re-sorting them (CR-28). */}
        <DataTable
          rows={filtered}
          rowKey={(row) => row.term}
          sortable
          opening={{ key: 'term', direction: 'asc' }}
          page={80}
          columns={GLOSSARY_COLUMNS}
          empty={<NoMatch noun="term" term={term} among={among} onClear={clear} />}
        />
      </Section>

      <Section title="People" count={`${personnel.length}`}>
        <DataTable
          rows={personnel}
          rowKey={(row) => row.id}
          sortable
          sort="active_from"
          direction="asc"
          page={60}
          columns={withRenders(PERSONNEL_COLUMNS, PERSONNEL_APP)}
        />
      </Section>

      <Onward {...ONWARD.glossary()} />
    </>
  )
}
