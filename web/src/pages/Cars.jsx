import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Note, Onward, Page, Section } from '../components/Page.jsx'
import { Result } from '../components/States.jsx'
import DataTable, { cell } from '../components/DataTable.jsx'
import { Chips, Filters, SearchField, Select } from '../components/Filters.jsx'
import { useQuery } from '../data/useQuery.js'
import { span } from '../lib/format.js'

const SQL = `
  SELECT ch.id, ch.name, ch.full_name, ch.constructor_id, k.name AS constructor,
         ch.first_year, ch.last_year, ch.engine_name, ch.chassis_type,
         ch.power_bhp, ch.wheelbase_mm, ch.weight_kg,
         ch.races, ch.wins, ch.published_wins, ch.car_id, ch.article, ch.confidence,
         CASE WHEN ch.chassis_type IS NULL AND ch.engine_name IS NULL
              THEN 0 ELSE 1 END AS has_spec,
         (SELECT landmark FROM cars WHERE cars.id = ch.car_id) AS landmark
    FROM chassis ch
    LEFT JOIN constructors k ON k.id = ch.constructor_id
   ORDER BY ch.first_year, ch.name
`

export default function Cars() {
  const state = useQuery(SQL)
  return (
    <Page
      title="Cars"
      lede="Every chassis with a championship entry — 1,153 of them, most raced by a privateer for a single weekend. Filter to race winners, landmark designs, or the ones with a published specification. A blank is a figure nobody published, not a car with no wheelbase."
    >
      <Section>
        <Result state={state} skeleton>
          {(data) => <Register rows={data.rows} />}
        </Result>
      </Section>

      <Onward
        items={[
          { to: '/constructors', label: 'Constructors', hint: 'The teams that built and ran them.' },
          { to: '/reference/eras', label: 'Eras and rules', hint: 'The regulations these cars were designed around.' },
          { to: '/records', label: 'Records', hint: 'What the fastest of them actually won.' },
        ]}
      />
    </Page>
  )
}

function Register({ rows }) {
  const [term, setTerm] = useState('')
  const [constructor, setConstructor] = useState('')
  const [kind, setKind] = useState('')

  const constructors = useMemo(
    () =>
      [...new Set(rows.map((r) => r.constructor).filter(Boolean))].sort((a, b) =>
        a.localeCompare(b, 'en'),
      ),
    [rows],
  )

  const filtered = useMemo(() => {
    const needle = term.trim().toLowerCase()
    return rows.filter((row) => {
      if (constructor && row.constructor !== constructor) return false
      if (kind === 'landmark' && !row.landmark) return false
      if (kind === 'spec' && !row.has_spec) return false
      if (kind === 'winners' && !row.wins) return false
      if (!needle) return true
      return [row.name, row.full_name, row.constructor]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(needle))
    })
  }, [rows, term, constructor, kind])

  const landmarks = rows.filter((r) => r.landmark).length

  return (
    <>
      <Note>
        <strong>“Raced” is not the same as a car's design life.</strong> These years are the
        seasons the chassis actually entered a championship race, which usually runs longer than
        the works team's own dates: privateers were still running the Ferrari 500 in 1957, years
        after Ferrari had moved on.
      </Note>

      <Filters showing={filtered.length} of={rows.length} noun="chassis">
        <SearchField value={term} onChange={setTerm} label="Filter cars" placeholder="A chassis or a constructor…" />
        <Select
          value={constructor}
          onChange={setConstructor}
          label="Constructor"
          all="Every constructor"
          options={constructors}
        />
        <Chips
          value={kind}
          onChange={setKind}
          options={[
            ['', 'All'],
            ['winners', 'Race winners'],
            ['spec', 'With a spec'],
            ['landmark', `Landmark (${landmarks})`],
          ]}
        />
      </Filters>

      <DataTable
        rows={filtered}
        rowKey={(row) => row.id}
        sort="first_year"
        direction="asc"
        page={150}
        columns={[
          {
            key: 'name',
            label: 'Chassis',
            render: (name, row) => (
              <>
                <Link to={`/cars/${row.id}`}>{name}</Link>
                {row.landmark ? <span className="tag" style={{ marginLeft: 6 }}>landmark</span> : null}
              </>
            ),
          },
          {
            key: 'constructor',
            label: 'Constructor',
            render: (name, row) =>
              row.constructor_id ? <Link to={`/constructors/${row.constructor_id}`}>{name}</Link> : cell(name),
          },
          {
            key: 'first_year',
            label: 'Raced',
            align: 'num',
            render: (_, row) => span(row.first_year, row.last_year),
            sort: (row) => row.first_year,
          },
          { key: 'engine_name', label: 'Engine', align: 'prose' },
          { key: 'power_bhp', label: 'Power (bhp)', align: 'num' },
          { key: 'wheelbase_mm', label: 'Wheelbase (mm)', align: 'num' },
          { key: 'races', label: 'Races', align: 'num' },
          { key: 'wins', label: 'Wins', align: 'num' },
          {
            key: 'published_wins',
            label: 'Published wins',
            align: 'num',
          },
        ]}
        footer="“Wins” counts the races that can be attributed to this exact chassis; “published wins” is what the car's own article claims. A gap between them is usually a season the constructor ran two designs and no source says which car raced when."
      />
    </>
  )
}
