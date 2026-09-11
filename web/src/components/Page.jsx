import { createContext, Fragment, useEffect, useRef } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { missing, text } from '../lib/format.js'
import { SITE, titled } from '../lib/site.js'

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

/**
 * document.title and the canonical, kept current across in-app navigation.
 *
 * prerender.js writes both correctly on every one of the 3,515 pages, and
 * nothing in the app has ever updated either. So after any client-side
 * navigation the tab, the bookmark, the history entry and the screen
 * reader's announcement all still name the page the reader LANDED on. On a
 * site whose dominant entry is a deep search arrival, that is the
 * share-and-cite path broken.
 *
 * It lives here because every page in the app renders a Page and hands it
 * the same string it uses for the h1 — so the document name and the visible
 * name cannot drift, and a page added later gets this for free.
 */
function useDocumentName(headline) {
  const { pathname } = useLocation()

  useEffect(() => {
    // Result renders its children only once the query has resolved, and every
    // data page wraps this one in it — so a page that reaches here without a
    // name is not a page still loading, it is a page that has no name to
    // give. It gets the site and nothing more. Writing `undefined — Lap
    // Ledger` would put a non-answer in the tab, the bookmark, the history
    // entry and the announcement, which is the em dash lying one surface over.
    document.title = missing(headline) ? SITE : titled(headline)
  }, [headline, pathname])

  // The canonical is mechanical: one per document, created if the static
  // HTML did not carry one, and always the path we are actually on.
  useEffect(() => {
    let tag = document.head.querySelector('link[rel="canonical"]')
    if (!tag) {
      tag = document.createElement('link')
      tag.rel = 'canonical'
      document.head.appendChild(tag)
    }
    tag.href = `${window.location.origin}${pathname}`
  }, [pathname])
}

export function Page({ eyebrow, title, lede, back, aside, children }) {
  useDocumentName(title)
  const heading = useFocusOnNavigation()
  return (
    <article className="page">
      <header>
        {back && (
          <p className="crumb">
            <Link to={back.to}>{back.label}</Link>
          </p>
        )}
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1 ref={heading} tabIndex={-1}>
          {title}
        </h1>
        {lede && <p className="lede">{lede}</p>}
        {aside}
      </header>
      {children}
    </article>
  )
}

/**
 * After an in-app navigation the document's focus sat on <body>, so a
 * screen reader said nothing and the next Tab started at the wordmark -
 * eleven stops before the content, on every hop of a driver -> team -> car
 * journey. Focusing the new page's h1 is what a page load would have done.
 * Not on first mount: that is the handover from the prerendered page, and
 * moving focus there is a separate decision (AX-01).
 */
function useFocusOnNavigation() {
  const { pathname } = useLocation()
  const ref = useRef(null)
  const first = useRef(true)
  useEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    ref.current?.focus({ preventScroll: true })
  }, [pathname])
  return ref
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
