import { useMemo, useState } from 'react'
import { Onward, Page, Section } from '../components/Page.jsx'
import { Result } from '../components/States.jsx'
import DataTable from '../components/DataTable.jsx'
import SubNav from '../components/SubNav.jsx'
import { Chips, Filters, SearchField } from '../components/Filters.jsx'
import { rows, useQueries } from '../data/useQuery.js'
import { span } from '../lib/format.js'

const SPEC = {
  glossary: ['SELECT * FROM glossary ORDER BY term'],
  personnel: ['SELECT * FROM personnel ORDER BY full_name'],
}

export default function Glossary() {
  const state = useQueries(SPEC)
  const [term, setTerm] = useState('')
  const [category, setCategory] = useState('')

  return (
    <Page
      title="Glossary and people"
      lede="What the words on a classification actually mean — and the designers, administrators and team principals whose decisions are behind most of the rest of this site."
    >
      <SubNav />
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
        <DataTable
          rows={filtered}
          rowKey={(row) => row.term}
          sortable
          sort="term"
          page={80}
          columns={[
            { key: 'term', label: 'Term', width: '18%' },
            { key: 'category', label: 'Category' },
            { key: 'definition', label: 'Definition', align: 'prose' },
          ]}
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
          columns={[
            { key: 'full_name', label: 'Name' },
            { key: 'role', label: 'Role' },
            { key: 'associated_with', label: 'With' },
            {
              key: 'active_from',
              label: 'Active',
              align: 'num',
              render: (_, row) => span(row.active_from, row.active_to),
              sort: (row) => row.active_from,
            },
            { key: 'nationality', label: 'Nationality' },
            { key: 'significance', label: 'Why they are here', align: 'prose' },
          ]}
        />
      </Section>

      <Onward
        items={[
          { to: '/reference/eras', label: 'Eras and rules', hint: 'Where most of this vocabulary comes from.' },
          { to: '/races', label: 'Races', hint: 'See the terms in use on a classification.' },
          { to: '/reference/quality', label: 'Data quality', hint: 'What “verified” and “reference” mean here.' },
        ]}
      />
    </>
  )
}
