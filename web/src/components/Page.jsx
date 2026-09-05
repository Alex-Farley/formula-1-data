import { Fragment } from 'react'
import { Link } from 'react-router-dom'
import { text } from '../lib/format.js'

/** A page: an optional way back, a title, an optional standfirst. */
export function Page({ eyebrow, title, lede, back, aside, children }) {
  return (
    <article className="page">
      <header>
        {back && (
          <p className="crumb">
            <Link to={back.to}>{back.label}</Link>
          </p>
        )}
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h2>{title}</h2>
        {lede && <p className="lede">{lede}</p>}
        {aside}
      </header>
      {children}
    </article>
  )
}

export function Section({ title, count, note, children, id }) {
  return (
    <section className="section" id={id}>
      {title && (
        <h3>
          {title}
          {count !== undefined && count !== null && <span className="count">{count}</span>}
        </h3>
      )}
      {note && <p className="note">{note}</p>}
      {children}
    </section>
  )
}

/** Headline figures. A value of null is dropped rather than shown as a dash —
 *  an empty stat tile is noise, where an empty table cell is information. */
export function Stats({ items }) {
  const shown = items.filter((item) => item && item.value !== null && item.value !== undefined && item.value !== '')
  if (shown.length === 0) return null
  return (
    <dl className="stats">
      {shown.map(({ label, value, note }) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>
            {typeof value === 'number' ? text(value) : value}
            {note && <small>{note}</small>}
          </dd>
        </div>
      ))}
    </dl>
  )
}

/** A definition list of label/value rows, dashes and all. */
export function Fields({ items }) {
  const shown = items.filter(Boolean)
  if (shown.length === 0) return null
  return (
    <dl className="fields">
      {/* A Fragment, not a wrapper with display: contents. The box tree would
          look the same either way, but CSS selectors match the DOM — and
          `.fields > dd` then matches nothing, so the rules, the hairlines and
          the wrapping all silently stop applying. */}
      {shown.map(({ label, value }) => (
        <Fragment key={label}>
          <dt>{label}</dt>
          <dd>{value === null || value === undefined || value === '' ? <span className="empty">—</span> : value}</dd>
        </Fragment>
      ))}
    </dl>
  )
}

/**
 * How good a fact is, shown rather than hidden.
 *
 * The ladder is verified > high > reference > medium > unverified. Only its
 * two ends take a colour, and both always carry the word: the colour supports
 * the label, it never replaces it.
 */
export function Confidence({ value }) {
  if (!value) return null
  return <span className={`pill pill-${String(value).toLowerCase()}`}>{value}</span>
}

/** Where a row came from, set small and out of the way. */
export function SourceNote({ children }) {
  return <p className="source-note">{children}</p>
}

export function Note({ children }) {
  return <div className="note-box">{children}</div>
}
