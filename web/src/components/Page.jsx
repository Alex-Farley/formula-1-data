import { Link } from 'react-router-dom'
import { cell } from '../format.js'

export function Page({ title, lede, back, children }) {
  return (
    <article className="page">
      {back && (
        <p className="back">
          <Link to={back.to}>← {back.label}</Link>
        </p>
      )}
      <h2>{title}</h2>
      {lede && <p className="lede">{lede}</p>}
      {children}
    </article>
  )
}

export function Section({ title, note, children }) {
  return (
    <section className="section">
      {title && <h3>{title}</h3>}
      {note && <p className="note">{note}</p>}
      {children}
    </section>
  )
}

/** The headline figures for a driver, team, circuit or car. */
export function Stats({ items }) {
  const shown = items.filter(({ value }) => value !== null && value !== undefined && value !== '')
  if (shown.length === 0) return null
  return (
    <dl className="stats">
      {shown.map(({ label, value }) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{cell(value)}</dd>
        </div>
      ))}
    </dl>
  )
}

/**
 * How good a fact is, shown rather than hidden. The ladder is
 * verified > high > reference > medium > unverified.
 */
export function Confidence({ value }) {
  if (!value) return null
  return <span className={`pill pill-${value}`}>{value}</span>
}
