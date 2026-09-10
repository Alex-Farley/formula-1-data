import { createContext, Fragment } from 'react'
import { Link } from 'react-router-dom'
import { text } from '../lib/format.js'

/**
 * A page: an optional way back, a title, an optional standfirst.
 *
 * The title is an h1 and a Section heading is an h2, so the outline runs
 * h1 -> h2 -> h3 with nothing skipped. It used to start at h2, which left
 * every page in the app with NO h1 at all - the only one in the build was
 * the loading screen - so somebody navigating by heading found no title for
 * the document they were on. The prerendered HTML had it right all along
 * (#prerendered h1 in app.css), so the static page and the app disagreed
 * about the shape of the same document.
 */
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
        <h1>{title}</h1>
        {lede && <p className="lede">{lede}</p>}
        {aside}
      </header>
      {children}
    </article>
  )
}

/**
 * The heading of the Section a component is rendered inside, or null.
 *
 * It exists so a table can be NAMED by the section that introduces it. A
 * <caption> is how a table tells assistive technology what it holds, and
 * fifty call sites passed none - so entering any table on the site announced
 * only "table". Taking the name from here rather than writing fifty captions
 * means there is one string, the one already on screen, and it cannot drift
 * out of step with the heading a reader can see.
 */
export const SectionTitle = createContext(null)

export function Section({ title, count, note, children, id }) {
  return (
    <SectionTitle.Provider value={typeof title === 'string' ? title : null}>
      <section className="section" id={id}>
        {title && (
          <h2>
            {title}
            {count !== undefined && count !== null && <span className="count">{count}</span>}
          </h2>
        )}
        {note && <p className="note">{note}</p>}
        {children}
      </section>
    </SectionTitle.Provider>
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

/**
 * Where to go next.
 *
 * Almost every page here is a junction — a driver leads to a team, a team to a
 * car, a car to the race it won. A reader who has to go back to the nav to
 * find that out mostly does not bother, so each page ends by naming the two to
 * four routes out of it that are worth taking.
 */
export function Onward({ title = 'Keep going', items }) {
  const shown = items.filter(Boolean)
  if (shown.length === 0) return null
  return (
    <nav className="onward" aria-label={title}>
      <h2>{title}</h2>
      <div>
        {shown.map(({ to, label, hint }) => (
          <Link key={`${to}-${label}`} to={to}>
            <b>{label}</b>
            {hint && <span>{hint}</span>}
          </Link>
        ))}
      </div>
    </nav>
  )
}

/** A row of buttons that start something, primary first. */
export function Actions({ items }) {
  const shown = items.filter(Boolean)
  if (shown.length === 0) return null
  return (
    <p className="actions">
      {shown.map(({ to, label, primary }) => (
        <Link key={`${to}-${label}`} to={to} className={primary ? 'button' : 'button secondary'}>
          {label}
        </Link>
      ))}
    </p>
  )
}

/** Step to the neighbour on either side — the previous season, the next race. */
export function Stepper({ previous, next }) {
  if (!previous && !next) return null
  return (
    <nav className="stepper" aria-label="Neighbouring pages">
      {previous ? <Link to={previous.to}>← {previous.label}</Link> : <span />}
      {next ? <Link to={next.to}>{next.label} →</Link> : <span />}
    </nav>
  )
}
