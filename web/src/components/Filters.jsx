import { useEffect, useState } from 'react'
import { number } from '../lib/format.js'

/**
 * The strip above a register: a text box, some selects, and a count.
 *
 * Filtering happens in the browser against rows already fetched, not in SQL.
 * The largest register here is 1,153 rows and the database is in memory — a
 * round trip per keystroke would be slower than filtering, and it would make
 * the result flicker.
 */
export function Filters({ children, showing, of, noun = 'rows' }) {
  const count = showing === of ? `${number(of)} ${noun}` : `${number(showing)} of ${number(of)} ${noun}`
  // The visible count updates per keystroke; the announced one waits until
  // typing settles, because a live region that fires on every character is
  // worse than no live region for the reader it exists for.
  const [announced, setAnnounced] = useState(count)
  useEffect(() => {
    const timer = setTimeout(() => setAnnounced(count), 500)
    return () => clearTimeout(timer)
  }, [count])
  return (
    <div className="filters">
      {children}
      <span className="spacer" />
      <span className="result-count" aria-hidden="true">
        {count}
      </span>
      <span className="sr-only" role="status">
        {announced}
      </span>
    </div>
  )
}

/**
 * A register its own filters have emptied, and the way back (IX-28).
 *
 * `zzzz` + Brazil + Champions gave *“Nothing recorded.”* and nothing else: no
 * word for which of three filters had done it, and no way out but undoing
 * them one at a time. It was also the wrong claim — on a site where an empty
 * table ordinarily means the database holds nothing, a filter that matched
 * nothing is a different fact, which is CD-17's verdict and why DataTable's
 * default is now the neutral “No rows here.”
 *
 * One template, so six registers do not each invent a sentence:
 *
 *     No driver matches “zzzz” among champions from Brazil.
 *     No driver matches “zzzz”.
 *     No street circuits in Monaco here.
 *
 * `among` is the page's own phrase and not a join of raw filter values,
 * because only the page knows the grammar of its own filters: a driver's
 * nationality is a country and not an adjective ("from Brazil", never
 * "Brazilian"), and a chip's visible label is a heading rather than a noun
 * phrase. It is written plural, so that it reads as the subject when there is
 * no search term to be the subject instead.
 *
 * It keeps `state is-empty`, which is how the smoke suite tells a query that
 * has finished and found nothing from one still running.
 */
export function NoMatch({ noun, term = '', among = '', onClear }) {
  const needle = String(term ?? '').trim()
  const sentence = needle
    ? `No ${noun} matches “${needle}”${among ? ` among ${among}` : ''}.`
    : among
      ? `No ${among} here.`
      : `No ${noun} matches these filters.`
  return (
    <div className="state is-empty no-match">
      <p>{sentence}</p>
      {onClear && (
        <button type="button" className="button secondary" onClick={onClear}>
          Clear filters
        </button>
      )}
    </div>
  )
}

export function SearchField({ value, onChange, placeholder = 'Filter…', label }) {
  return (
    <input
      type="search"
      value={value}
      aria-label={label ?? placeholder}
      placeholder={placeholder}
      onChange={(event) => onChange(event.target.value)}
    />
  )
}

export function Select({ value, onChange, options, label, all = 'All' }) {
  return (
    <select value={value} aria-label={label} onChange={(event) => onChange(event.target.value)}>
      <option value="">{all}</option>
      {options.map((option) => {
        const [key, text] = Array.isArray(option) ? option : [option, option]
        return (
          <option key={key} value={key}>
            {text}
          </option>
        )
      })}
    </select>
  )
}

/**
 * One chip that asks its own question, beside a group that asks another.
 *
 * IX-35: "Traced" sat inside the type chips on /circuits, which are one
 * mutually exclusive group - so a reader who wanted the street circuits with
 * a centreline could not ask for them, because choosing either silently
 * cleared the other. Four of those chips are values of circuits.circuit_type
 * and this one is a different question about the same row; a toggle that
 * stays pressed while the group moves beside it is what says so.
 *
 * It carries its own accessible name for the same reason the group carries
 * one: "Traced, toggle button, not pressed" names no subject. The visible
 * word opens that name, so what is heard contains what is read.
 */
export function Toggle({ value, onChange, label, children }) {
  return (
    <button
      type="button"
      className="chip"
      aria-pressed={value}
      aria-label={label}
      onClick={() => onChange(!value)}
    >
      {children}
    </button>
  )
}

/** Mutually exclusive chips, for two or three choices that deserve to be visible. */
export function Chips({ value, onChange, options, label = 'Filter' }) {
  // A group, with a name: six toggle buttons arriving as "hybrid, toggle
  // button, not pressed" said nothing about what they filtered.
  return (
    <span className="chips" role="group" aria-label={label}>
      {options.map(([key, text]) => (
        <button
          key={key}
          type="button"
          className="chip"
          aria-pressed={value === key}
          onClick={() => onChange(key)}
        >
          {text}
        </button>
      ))}
    </span>
  )
}
