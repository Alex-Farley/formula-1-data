import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '../useQuery.js'
import { Page } from '../components/Page.jsx'
import { Result } from '../components/State.jsx'
import DataTable from '../components/DataTable.jsx'
import Filter, { matches } from '../components/Filter.jsx'
import { span } from '../format.js'

const SQL = `
SELECT id, name, country, wins, constructors_titles, drivers_titles,
       first_entry, last_entry, active, lineage_chain
FROM constructors
ORDER BY wins DESC, constructors_titles DESC, name`

export default function Constructors() {
  const state = useQuery(SQL)
  const [term, setTerm] = useState('')

  return (
    <Page
      title="Constructors"
      lede="55 constructors, and the ten continuous racing operations that connect them across their name changes. Enstone is Toleman → Benetton → Renault → Lotus → Renault → Alpine; Brackley is Tyrrell → BAR → Honda → Brawn → Mercedes."
    >
      <Result state={state} what="Loading the database">
        {(data) => {
          const rows = data.rows.filter((r) =>
            matches(r, ['name', 'country', 'lineage_chain'], term),
          )
          return (
            <>
              <Filter
                value={term}
                onChange={setTerm}
                placeholder="Filter by name, country or lineage"
                count={rows.length}
                noun={rows.length === 1 ? 'constructor' : 'constructors'}
              />
              <DataTable
                data={{ ...data, rows }}
                columns={[
                  'name',
                  'country',
                  'wins',
                  'constructors_titles',
                  'drivers_titles',
                  'entered',
                  'lineage_chain',
                ]}
                labels={{
                  constructors_titles: "Constructors'",
                  drivers_titles: "Drivers'",
                  lineage_chain: 'Lineage',
                }}
                render={{
                  name: (v, row) => <Link to={`/constructors/${row.id}`}>{v}</Link>,
                  entered: (_, row) => span(row.first_entry, row.last_entry),
                }}
                empty="No constructor matches that."
              />
            </>
          )
        }}
      </Result>
    </Page>
  )
}
