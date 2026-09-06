import { useEffect, useMemo, useRef, useState } from 'react'
import { query } from './client.js'

/**
 * The database in this tab is immutable — it is a downloaded file, and
 * nothing in the app writes to it — so a result is good forever and a query
 * asked twice need only run once. That is what makes going back a page
 * instant instead of a second round trip to the worker.
 *
 * The cap is here because the SQL console can generate distinct statements
 * without limit; insertion order is close enough to least-recently-used for
 * a cache whose entries all cost about the same.
 */
const CAP = 240
const cache = new Map()

function cached(sql, params) {
  const key = JSON.stringify([sql, params])
  const hit = cache.get(key)
  if (hit) {
    // Refresh position so a page's own queries survive a long console session.
    cache.delete(key)
    cache.set(key, hit)
    return hit
  }
  const promise = query(sql, params).catch((error) => {
    // A failure must not be remembered as a result; the next render should be
    // allowed to try again.
    cache.delete(key)
    throw error
  })
  cache.set(key, promise)
  if (cache.size > CAP) cache.delete(cache.keys().next().value)
  return promise
}

const IDLE = { loading: true, error: null, data: null }

/**
 * Run one statement. Returns { loading, error, data } where data is the
 * { columns, rows } the worker sent back.
 *
 * Passing `null` as the SQL holds the query — the state stays loading. Pages
 * use that when a later query depends on the row an earlier one returned.
 */
export function useQuery(sql, params = []) {
  const [state, setState] = useState(IDLE)
  // Queries are string literals and parameters are short arrays of scalars,
  // so serialising them is a cheaper and more reliable dependency than asking
  // every caller to memoise an array literal.
  const key = JSON.stringify([sql, params])

  useEffect(() => {
    if (!sql) {
      setState(IDLE)
      return undefined
    }
    let live = true
    const promise = cached(sql, params)
    // A cache hit still resolves on a microtask, so the loading state would
    // flash for one frame on every back-navigation. Only announce loading if
    // the answer has not arrived by the time this effect finishes.
    let settled = false
    promise.then(
      (data) => {
        settled = true
        if (live) setState({ loading: false, error: null, data })
      },
      (error) => {
        settled = true
        if (live) setState({ loading: false, error, data: null })
      },
    )
    if (!settled) setState(IDLE)
    return () => {
      live = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])

  return state
}

/**
 * Run several statements as one unit.
 *
 * A page is usually several questions about the same thing, and rendering it
 * in pieces as each answer lands makes the layout jump. This resolves them
 * together and reports one loading state and the first error.
 *
 *     const { loading, error, data } = useQueries({
 *       driver: ['SELECT * FROM drivers WHERE id = ?', [id]],
 *       races:  ['SELECT ... WHERE driver_id = ?', [id]],
 *     })
 */
export function useQueries(spec) {
  const key = JSON.stringify(spec)
  const [state, setState] = useState(IDLE)
  const held = useRef(spec)
  held.current = spec

  useEffect(() => {
    const entries = Object.entries(held.current).filter(([, value]) => value && value[0])
    let live = true
    let settled = false
    Promise.all(entries.map(([, [sql, params = []]]) => cached(sql, params))).then(
      (results) => {
        settled = true
        if (!live) return
        const data = {}
        entries.forEach(([name], i) => {
          data[name] = results[i]
        })
        setState({ loading: false, error: null, data })
      },
      (error) => {
        settled = true
        if (live) setState({ loading: false, error, data: null })
      },
    )
    if (!settled) setState(IDLE)
    return () => {
      live = false
    }
  }, [key])

  return state
}

/** The rows of a named result in a useQueries payload, or an empty array. */
export const rows = (data, name) => data?.[name]?.rows ?? []

/** The first row of a named result, or null. */
export const row = (data, name) => data?.[name]?.rows?.[0] ?? null

/** One scalar from a one-row, one-column result. */
export function useScalar(sql, params = []) {
  const { data, ...rest } = useQuery(sql, params)
  const value = useMemo(() => {
    const first = data?.rows?.[0]
    return first ? Object.values(first)[0] : null
  }, [data])
  return { ...rest, value }
}
