/** A search box over rows already in memory — every list here is small enough. */
export default function Filter({ value, onChange, placeholder, count, noun }) {
  return (
    <div className="filter">
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
      />
      {count !== undefined && (
        <span className="muted">
          {count} {noun}
        </span>
      )}
    </div>
  )
}

/** Case-insensitive substring match across the given fields. */
export function matches(row, fields, term) {
  if (!term) return true
  const needle = term.toLowerCase()
  return fields.some((f) => String(row[f] ?? '').toLowerCase().includes(needle))
}
