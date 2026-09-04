import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '../useQuery.js'
import { Page } from '../components/Page.jsx'
import { Result } from '../components/State.jsx'
import DataTable from '../components/DataTable.jsx'
import Filter, { matches } from '../components/Filter.jsx'
import { span } from '../format.js'

const SQL = `
SELECT id, car, constructor, from_year, to_year, engine_name, aspiration,
       capacity_cc, power_bhp, weight_kg, wins, poles, drivers_titles
FROM v_cars
ORDER BY wins DESC, car`

export default function Cars() {
  const state = useQuery(SQL)
  const [term, setTerm] = useState('')

  return (
    <Page
      title="Cars"
      lede="29 landmark chassis, from the Alfetta to the RB19 — a register of designs that mattered, not of every car that started a Grand Prix. A car here is a chassis design, not a season: the Lotus 79 raced in 1978 and 1979 and is one row. A blank spec is “not established”, never zero."
    >
      <Result state={state} what="Loading the database">
        {(data) => {
          const rows = data.rows.filter((r) =>
            matches(r, ['car', 'constructor', 'engine_name'], term),
          )
          return (
            <>
              <Filter
                value={term}
                onChange={setTerm}
                placeholder="Filter by car, constructor or engine"
                count={rows.length}
                noun={rows.length === 1 ? 'car' : 'cars'}
              />
              <DataTable
                data={{ ...data, rows }}
                columns={[
                  'car',
                  'constructor',
                  'raced',
                  'engine_name',
                  'power_bhp',
                  'weight_kg',
                  'wins',
                  'poles',
                ]}
                labels={{
                  engine_name: 'Engine',
                  power_bhp: 'Power (bhp)',
                  weight_kg: 'Weight (kg)',
                }}
                render={{
                  car: (v, row) => <Link to={`/cars/${row.id}`}>{v}</Link>,
                  raced: (_, row) => span(row.from_year, row.to_year),
                }}
                empty="No car matches that."
              />
            </>
          )
        }}
      </Result>
    </Page>
  )
}
