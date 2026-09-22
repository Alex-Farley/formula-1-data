import { useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'

/**
 * A register's filters, its sort and its expansion, in the address bar.
 *
 * WHY
 *     Every register here answered only to state held in a component. The
 *     drivers from Brazil, the street circuits, the 1970s races sorted by
 *     round — a reader could reach any of them and could then send nobody
 *     there, cite none of them, and lose all of it by following a link and
 *     coming back. The address bar is the one piece of state a browser
 *     already knows how to keep, share and restore, so the filters go in it
 *     and the component holds nothing (IA-08).
 *
 * REPLACE, NEVER PUSH
 *     A filter is a refinement of the view the reader is already in, not
 *     somewhere new they have gone: pushing would make Back walk them out of
 *     a register one chip at a time, and a search box would fill the history
 *     with a keystroke each. Replacing keeps one entry per register visit,
 *     which is the entry the reader leaves behind when they open a driver —
 *     so Back brings the filter back, which is the test this was written
 *     against. The SQL console already stores its statement this way.
 *
 * A DEFAULT IS ABSENT
 *     `/drivers` stays `/drivers` until something is actually asked of it,
 *     and clearing a filter takes its parameter back out rather than writing
 *     `?nationality=`. Clear-all is the whole declared set dropped.
 *
 * Values are strings, or booleans for a toggle — written as `=1`, absent when
 * false. Anything else a caller wants in the URL formats itself to a string
 * first, so what a reader sees is what the page reads back.
 */

/** Is `value` the same as the declared default, and so not worth an address? */
function isDefault(value, fallback) {
  return typeof fallback === 'boolean' ? Boolean(value) === fallback : String(value) === String(fallback)
}

/** The declared keys as a state object, taking each default where the URL is silent. */
export function readState(params, defaults) {
  const state = {}
  for (const [key, fallback] of Object.entries(defaults)) {
    const raw = params.get(key)
    if (typeof fallback === 'boolean') state[key] = raw === null ? fallback : raw === '1'
    else state[key] = raw ?? fallback
  }
  return state
}

/**
 * `params` with `changes` applied: a value that is the default is deleted
 * rather than written. Undeclared parameters on the URL are carried through
 * untouched — this owns the keys it was given and no others.
 */
export function writeState(params, changes, defaults) {
  const next = new URLSearchParams(params)
  for (const [key, value] of Object.entries(changes)) {
    if (isDefault(value, defaults[key])) next.delete(key)
    else next.set(key, typeof value === 'boolean' ? '1' : String(value))
  }
  return next
}

/** `params` with every declared key dropped: the Clear filters button. */
export function clearState(params, defaults) {
  const next = new URLSearchParams(params)
  for (const key of Object.keys(defaults)) next.delete(key)
  return next
}

/**
 * A parameter is a stranger until the data vouches for it.
 *
 * `?nationality=Ruritania` would otherwise filter the register to nothing
 * while the select beside it, having no such option, went on reading "Every
 * nationality" — the control and the table disagreeing about what was asked.
 * An unknown value falls back, so the page is at worst unfiltered and never
 * inconsistent. Options are the shape the selects and chips take: a string,
 * or a [value, label] pair.
 */
export function oneOf(value, options, fallback = '') {
  const known = options.some((option) => String(Array.isArray(option) ? option[0] : option) === String(value))
  return known ? value : fallback
}

/**
 * `const [state, set, clear] = useUrlState({ q: '', kind: '' })`
 *
 * `set` takes a partial — `set({ q: 'senna' })` — and `clear` drops the lot.
 */
export function useUrlState(defaults) {
  const [params, setParams] = useSearchParams()

  /*
   * What the address holds, which is not always what this render was handed.
   *
   * react-router gives a setter the parameters of the render it was made in,
   * and two controls can be touched inside one frame — a chip, then the
   * search box beside it, before the first write has rendered. Composed on
   * the render, the second write is built on parameters that no longer
   * describe the address and silently drops the first one's filter: the
   * glossary's own test caught exactly that, a category chip and then a term,
   * ending with the term and no category. Composing on the last WRITE as well
   * as the last render is what makes a burst of them add up.
   */
  const latest = useRef(params)
  useEffect(() => {
    latest.current = params
  }, [params])

  const state = readState(params, defaults)
  const write = (next) => {
    latest.current = next
    setParams(next, { replace: true })
  }
  const set = (changes) => write(writeState(latest.current, changes, defaults))
  const clear = () => write(clearState(latest.current, defaults))
  return [state, set, clear]
}
