import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Note, Page, Section } from '../components/Page.jsx'
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
      lede="Every chassis the championship has an entry for — 1,153 of them, most raced by a privateer for one weekend. Specifications come from the {{Racing car}} infobox of the car's own article where it has one, which is why some rows are a full spec sheet and most are a name and a year. A blank is a figure nobody published, not a car with no wheelbase."
    >
      <Section>
        <Result state={state} skeleton>
          {(data) => <Register rows={data.rows} />}
        </Result>
      </Section>
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
        <strong>A car's design life is not its racing life.</strong> The years below are the years
        the chassis is recorded as entering a championship race. A works team's own dates for a car
        are usually shorter: privateers ran the Ferrari 500 until 1957, years after Ferrari had
        moved on. Anything about when a car raced comes from the chassis register, never from a
        design date.
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
        footer="Where “wins” and “published wins” differ, the derived figure counts the races this database can attribute to this chassis and the published one is what the car's article claims — a difference is a season the constructor ran more than one design, not an error."
      />
    </>
  )
}
