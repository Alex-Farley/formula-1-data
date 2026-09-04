import { useEffect, useState } from 'react'
import { run } from './db.js'

/**
 * Run a query and track its state. Returns { loading, error, data }, where
 * data is the { columns, rows } from db.run.
 *
 * The first call on a cold page waits for the database to download and the
 * wasm to instantiate; everything after it is a local query and returns in
 * milliseconds.
 */
export function useQuery(sql, params = []) {
  const [state, setState] = useState({ loading: true, error: null, data: null })

  // Queries are string literals and params are small arrays of scalars, so
  // serialising them is a cheaper and more reliable dependency than asking
  // every caller to memoise its params array.
  const key = JSON.stringify([sql, params])

  useEffect(() => {
    let live = true
    setState({ loading: true, error: null, data: null })
    run(sql, params)
      .then((data) => live && setState({ loading: false, error: null, data }))
      .catch((error) => live && setState({ loading: false, error, data: null }))
    return () => {
      live = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  return state
}
