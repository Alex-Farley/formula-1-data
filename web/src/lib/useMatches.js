import { useEffect, useState } from 'react'

/**
 * Does the page match a media query? False where there is no query to ask,
 * so a table that declares no phone set subscribes to nothing. DataTable's
 * phone set and BarChart's stacked names (VD-114) both ask lib/table.js's
 * PHONE.
 */
export function useMatches(query) {
  const [matches, setMatches] = useState(() => Boolean(query && globalThis.matchMedia?.(query).matches))
  useEffect(() => {
    if (!query || !globalThis.matchMedia) {
      setMatches(false)
      return undefined
    }
    const list = globalThis.matchMedia(query)
    const change = () => setMatches(list.matches)
    change()
    list.addEventListener('change', change)
    return () => list.removeEventListener('change', change)
  }, [query])
  return matches
}
