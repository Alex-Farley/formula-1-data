import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '../useQuery.js'
import { Page } from '../components/Page.jsx'
import { Result } from '../components/State.jsx'
import DataTable from '../components/DataTable.jsx'
import Filter, { matches } from '../components/Filter.jsx'
import { span } from '../format.js'

const SQL = `
SELECT id, name, country, locality, circuit_type, races, first_gp, last_gp,
       length_km, turns, layouts
FROM v_circuits
ORDER BY races DESC, name`

export default function Circuits() {
  const state = useQuery(SQL)
  const [term, setTerm] = useState('')

  return (
    <Page
      title="Circuits"
      lede="80 circuits, from Bremgarten and Pescara to the Madring. Every one of the 1,161 championship races is linked to one of them. Length and turns are the circuit's current configuration — thirteen circuits carry a full timeline of what was actually raced, and those are on the circuit's own page."
    >
      <Result state={state} what="Loading the database">
        {(data) => {
          const rows = data.rows.filter((r) =>
            matches(r, ['name', 'country', 'locality', 'circuit_type'], term),
          )
          return (
            <>
              <Filter
                value={term}
                onChange={setTerm}
                placeholder="Filter by circuit, country or town"
                count={rows.length}
                noun={rows.length === 1 ? 'circuit' : 'circuits'}
              />
              <DataTable
                data={{ ...data, rows }}
                columns={[
                  'name',
                  'country',
                  'circuit_type',
                  'races',
                  'held',
                  'length_km',
                  'turns',
                  'layouts',
                ]}
                labels={{ circuit_type: 'Type', length_km: 'Length (km)' }}
                render={{
                  name: (v, row) => <Link to={`/circuits/${row.id}`}>{v}</Link>,
                  held: (_, row) => span(row.first_gp, row.last_gp),
                }}
                empty="No circuit matches that."
              />
            </>
          )
        }}
      </Result>
    </Page>
  )
}
