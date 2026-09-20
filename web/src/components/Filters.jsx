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
