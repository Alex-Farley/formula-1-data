import { createContext, Fragment, useEffect, useRef } from 'react'
import { currentProgress } from '../data/client.js'
import { Link, useLocation } from 'react-router-dom'
import { missing, text } from '../lib/format.js'
import { SITE, titled, citation } from '../lib/site.js'

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
 * prerender.js writes both correctly on every one of the 3,514 pages, and
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

export function Page({ eyebrow, title, lede, trail, aside, children, cite = true }) {
  useDocumentName(title)
  const heading = useFocusOnNavigation()
  return (
    <article className="page">
      {trail && <Crumbs trail={trail} />}
      <header>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1 ref={heading} tabIndex={-1}>
          {title}
        </h1>
        {lede && <p className="lede">{lede}</p>}
        {aside}
      </header>
      <PageTitle.Provider value={typeof title === 'string' ? title : null}>{children}</PageTitle.Provider>
      {cite && <Cite />}
    </article>
  )
}

/**
 * The trail, in the app's half of the site.
 *
 * IA-22: prerender.js has written one on every page since it was added, and
 * the app answered with a single back link to the section above — so the two
 * renderers described two different hierarchies of the same document, and a
 * reader who arrived on the static page watched the trail collapse to one
 * step the moment the database opened. The trail itself comes from
 * lib/wayfinding.js, so neither renderer holds its own reading of it.
 *
 * The markup is prerender.js's, class for class, so `.crumbs` in app.css
 * draws both. It sits inside the article rather than beside it, where the
 * static page puts it: <main> belongs to App.jsx, and a prop threaded up
 * there to place one nav would be a second way of saying where a page sits.
 * The rules are on the class, so the two look the same either way.
 */
function Crumbs({ trail }) {
  return (
    <nav className="crumbs" aria-label="Breadcrumb">
      {trail.map(([to, label], i) => (
        <Fragment key={to}>
          {i > 0 && <span className="sep">/</span>}
          {i === trail.length - 1 ? <span aria-current="page">{label}</span> : <Link to={to}>{label}</Link>}
        </Fragment>
      ))}
    </nav>
  )
}

/**
 * After an in-app navigation the document's focus sat on <body>, so a
 * screen reader said nothing and the next Tab started at the wordmark -
 * eleven stops before the content, on every hop of a driver -> team -> car
 * journey. Focusing the new page's h1 is what a page load would have done.
 * Not on the arrival: that is the handover from the prerendered page, where
 * main.jsx focuses this same heading itself once the static page is gone.
 *
 * The flag is module-scoped because the guard has to outlive the component,
 * and a useRef does not. Two routes are two different component types, so
 * React unmounts the old Page and mounts a new one - `useRef(true)` was
 * therefore true AGAIN on every navigation that changed page type, which is
 * every navigation out of an index: /circuits -> /circuits/albert-park sent
 * focus to <body> with the code to prevent it sitting in this file. Only the
 * app's first Page is the arrival; every Page after it is a navigation.
 *
 * In dev, StrictMode runs that first effect twice and the second pass focuses
 * the arrival's heading - which is what handOver() does in a build anyway, so
 * the two agree rather than diverging where nobody is testing.
 */
let landed = false

function useFocusOnNavigation() {
  const { pathname } = useLocation()
  const ref = useRef(null)
  useEffect(() => {
    if (!landed) {
      landed = true
      return
    }
    // Not out of a modal that is staying. The search palette is open on top of
    // the page, and a navigation committing underneath it - click a result,
    // press / again before the router has caught up - would pull focus back to
    // the heading behind it: Escape then misses the dialog, which stays open
    // over a page the reader can no longer reach. What is in front of the
    // reader wins.
    //
    // A route change now also CLOSES the palette (AF-60, App.jsx's
    // CloseSearchOnNavigate), and React removes it in the commit after this
    // effect - so at this instant focus is still inside a dialog that is about
    // to stop existing, and bailing out for good would drop the reader on
    // <body> with the page changed under them. Look again after the next
    // frame, by which time that commit has landed: a dialog still standing
    // keeps focus, one that has gone hands it over like any other navigation.
    // A frame rather than a microtask, because a microtask can run before
    // React has re-rendered and would read the palette as still open.
    if (document.activeElement?.closest('[role="dialog"]')) {
      const frame = requestAnimationFrame(() => {
        if (!document.activeElement?.closest('[role="dialog"]')) {
          ref.current?.focus({ preventScroll: true })
        }
      })
      return () => cancelAnimationFrame(frame)
    }
    ref.current?.focus({ preventScroll: true })
    return undefined
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

/**
 * The h1 of the page a component is rendered inside, or null.
 *
 * SectionTitle's fallback. Four registers and the SQL console render their
 * table outside any titled Section - there is nothing above it but the page's
 * own h1 - so the mechanism above fired on fifty tables and missed the five
 * busiest on the site: entering /drivers with a screen reader announced
 * "table, 10 columns, 862 rows" and no name at all (AX-17). The name is taken
 * from the heading rather than written at the call site for the same reason
 * as SectionTitle: one string, the one already on screen, and no way for the
 * two to drift.
 */
export const PageTitle = createContext(null)

export function Section({ title, count, note, children, id }) {
  return (
    <SectionTitle.Provider value={typeof title === 'string' ? title : null}>
      <section className="section" id={id}>
        {title && (
          <h2>
            {title}
            {/* A text-node space: the visible gap is CSS, but the accessible
                name is the text, and "Classification20 entries" is what a
                heading-by-heading reader was given. */}
            {count !== undefined && count !== null && (
              <>
                {' '}
                <span className="count">{count}</span>
              </>
            )}
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
  // VD-28: two ranks, and only where a page has asked for them. A strip with
  // no `lead` keeps the one rank it has always had, so this changes the pages
  // that named a lead figure and no others - the alternative was shrinking
  // every figure on nine pages to make two of them larger by comparison.
  const ranked = shown.some((item) => item.lead)
  return (
    <dl className="stats" data-ranked={ranked ? '' : undefined}>
      {shown.map(({ label, value, note, lead, kind }) => (
        // `kind="name"` is a value that is a person, a team or a place rather
        // than a figure. The display face is condensed and drawn for numerals;
        // set a name in it at 25px and the tile reads as a headline, which is
        // how three of five tiles on a race page came to be underlined names
        // in display type. Names take the sans face at a reading size.
        <div key={label} data-lead={lead ? '' : undefined} data-kind={kind || undefined}>
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
 * The ladder is verified > high > reference > medium > unverified >
 * catalogued. Only verified and the two bottom rungs take a colour, and each
 * always carries the word: the colour supports the label, it never replaces
 * it.
 */
/**
 * The confidence tier, as a pill that goes to the ladder that defines it.
 *
 * A bare word - "medium" - on thirteen pages taught a reader that the site
 * was unsure of itself, when the ladder two clicks away says it means an
 * exact figure may have drifted. The tier is a link to that definition, and
 * carries it as a title for the reader who hovers.
 */
export function Confidence({ value, plain = false }) {
  if (!value) return null
  // `plain` is for the quality page itself, where a link to the page the
  // reader is on would be a no-op dressed as a way forward.
  if (plain) return <span className={`pill pill-${String(value).toLowerCase()}`}>{value}</span>
  return (
    <Link
      to="/data/quality"
      className={`pill pill-${String(value).toLowerCase()}`}
      title={`Confidence tier "${value}" - what it means, on the quality page`}
    >
      {value}
    </Link>
  )
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

/**
 * How to cite the page. Every ingredient existed - the version and build
 * date in the footer, the canonical address in the head, the source beside
 * each figure - and nothing assembled them, on a site whose stated ambition
 * is to be cited. One sentence, the same in the app and the static page,
 * with the date the reader is looking at it left to the reader: the build
 * date is the date that matters, because the figures are a function of it.
 */
export function Cite() {
  const manifest = currentProgress().manifest
  if (!manifest) return null
  // The address as the browser has it - origin and base included - so a
  // preview cites itself and lapledger.org cites lapledger.org; the static
  // page uses the canonical origin, which on the site is the same string.
  const url = `${window.location.origin}${window.location.pathname}`
  const text = citation(manifest.version, manifest.built, url)
  const [before, after] = text.split(url)
  return (
    <aside className="cite" aria-label="How to cite this page">
      <p>
        {before}
        <span className="url">{url}</span>
        {after}
      </p>
    </aside>
  )
}
