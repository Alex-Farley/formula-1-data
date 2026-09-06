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
  return (
    <div className="filters">
      {children}
      <span className="spacer" />
      <span className="result-count">
        {showing === of ? `${number(of)} ${noun}` : `${number(showing)} of ${number(of)} ${noun}`}
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

/** Mutually exclusive chips, for two or three choices that deserve to be visible. */
export function Chips({ value, onChange, options }) {
  return (
    <span className="chips">
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
