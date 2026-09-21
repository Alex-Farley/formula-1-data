import { useMemo, useState } from 'react'
import { Onward, Page, Section } from '../components/Page.jsx'
import { Result } from '../components/States.jsx'
import DataTable from '../components/DataTable.jsx'
import { SportNav } from '../components/SubNav.jsx'
import { Chips, Filters, NoMatch, SearchField } from '../components/Filters.jsx'
import { rows, useQueries } from '../data/useQuery.js'
import { GLOSSARY, GLOSSARY_COLUMNS, PERSONNEL, PERSONNEL_COLUMNS } from '../queries/glossary.js'

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
  const [term, setTerm] = useState('')
  const [category, setCategory] = useState('')

  return (
    <Page
      title="Glossary and people"
      lede="What the words on a classification actually mean — and the designers, administrators and team principals whose decisions are behind most of the rest of this site."
    >
      <SportNav />
      <Result state={state}>
        {(data) => {
          const glossary = rows(data, 'glossary')
          const personnel = rows(data, 'personnel')
          return (
            <Body
              glossary={glossary}
              personnel={personnel}
              term={term}
              setTerm={setTerm}
              category={category}
              setCategory={setCategory}
            />
          )
        }}
      </Result>
    </Page>
  )
}

function Body({ glossary, personnel, term, setTerm, category, setCategory }) {
  const categories = useMemo(
    () => [...new Set(glossary.map((row) => row.category).filter(Boolean))].sort(),
    [glossary],
  )

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
  const clear = () => {
    setTerm('')
    setCategory('')
  }

  return (
    <>
      <Section title="Glossary" count={`${glossary.length} terms`}>
        <Filters showing={filtered.length} of={glossary.length} noun="terms">
          <SearchField value={term} onChange={setTerm} label="Filter terms" placeholder="A term…" />
          <Chips
            label="Filter terms by category"
            value={category}
            onChange={setCategory}
            options={[['', 'All'], ...categories.map((c) => [c, c])]}
          />
        </Filters>
        {/* No opening sort: the query's case-insensitive ORDER BY is the order
            the table opens in, and the static page prints the rows as they come. */}
        <DataTable
          rows={filtered}
          rowKey={(row) => row.term}
          sortable
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

      <Onward
        items={[
          { to: '/reference/eras', label: 'Eras and rules', hint: 'Where most of this vocabulary comes from.' },
          { to: '/races', label: 'Races', hint: 'See the terms in use on a classification.' },
          { to: '/data/quality', label: 'Data quality', hint: 'What “verified” and “reference” mean here.' },
        ]}
      />
    </>
  )
}
