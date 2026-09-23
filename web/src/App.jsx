import { useEffect, useRef, useState } from 'react'
import { BrowserRouter, Link, Navigate, NavLink, Route, Routes, useLocation } from 'react-router-dom'
import Boot from './components/Boot.jsx'
import Search from './components/Search.jsx'
import SearchKey from './components/SearchKey.jsx'
import { Result } from './components/States.jsx'
import ThemeToggle from './components/Theme.jsx'
import { currentProgress } from './data/client.js'
import { useQuery } from './data/useQuery.js'
import { OUTLINE_CREDIT } from './lib/outline.js'
import { CHECKED_LABEL, LAST_CHECKED } from './lib/refresh.js'
import {
  COUNTED_TOTALS,
  IN_THIS_TAB,
  REPORT_ASK,
  REPORT_LINK,
  REPORT_PROMISE,
  REPORT_URL,
} from './lib/site.js'

import Home from './pages/Home.jsx'
import Seasons from './pages/Seasons.jsx'
import Season from './pages/Season.jsx'
import Races from './pages/Races.jsx'
import Race from './pages/Race.jsx'
import Drivers from './pages/Drivers.jsx'
import Driver from './pages/Driver.jsx'
import Compare from './pages/Compare.jsx'
import Constructors from './pages/Constructors.jsx'
import Constructor from './pages/Constructor.jsx'
import Circuits from './pages/Circuits.jsx'
import Circuit from './pages/Circuit.jsx'
import GrandsPrix from './pages/GrandsPrix.jsx'
import GrandPrix from './pages/GrandPrix.jsx'
import Cars from './pages/Cars.jsx'
import Car from './pages/Car.jsx'
import Records from './pages/Records.jsx'
import Changes from './pages/Changes.jsx'
import Data from './pages/Data.jsx'
import Eras from './pages/Eras.jsx'
import Quality from './pages/Quality.jsx'
import Sources from './pages/Sources.jsx'
import Glossary from './pages/Glossary.jsx'
import Sql from './pages/Sql.jsx'
import About from './pages/About.jsx'
import NotFound from './pages/NotFound.jsx'

const NAV = [
  { to: '/seasons', label: 'Seasons' },
  { to: '/races', label: 'Races' },
  { to: '/drivers', label: 'Drivers' },
  { to: '/constructors', label: 'Constructors' },
  { to: '/circuits', label: 'Circuits' },
  { to: '/cars', label: 'Cars' },
  { to: '/records', label: 'Records' },
  { to: '/data', label: 'Data' },
]

function Wordmark() {
  return (
    <Link to="/" className="wordmark">
      {/* A chequered field, four by four, cropped to the panel with no
          padding: the cells run to the edge so the mark reads as cloth
          rather than as an icon in a box. One cell carries the accent —
          the checked fact — and it never moves. Below 24px the field is
          redrawn three by three with the centre cell marked, because 8px
          cells fall under a device pixel and turn to mush. */}
      <svg width="26" height="26" viewBox="0 0 32 32" aria-hidden="true">
        <rect width="32" height="32" rx="3" fill="currentColor" />
        <rect width="8" height="8" fill="var(--panel)" />
        <rect x="16" width="8" height="8" fill="var(--panel)" />
        <rect x="8" y="8" width="8" height="8" fill="var(--panel)" />
        <rect x="24" y="8" width="8" height="8" fill="var(--panel)" />
        <rect y="16" width="8" height="8" fill="var(--panel)" />
        <rect x="16" y="16" width="8" height="8" fill="var(--accent)" />
        <rect x="8" y="24" width="8" height="8" fill="var(--panel)" />
        <rect x="24" y="24" width="8" height="8" fill="var(--panel)" />
      </svg>
      <span>
        <b>Lap Ledger</b>
        <span>1950–2027 · every championship race</span>
      </span>
    </Link>
  )
}

/**
 * The path the document was loaded at, router-relative.
 *
 * Read at import time, which is before main.jsx runs anything: Boot does not
 * render Chrome until the database is open, and a click on the static page in
 * the meantime is held as a route change, so the pathname at ScrollToTop's
 * first render is NOT reliably the one the reader arrived at.
 */
const LANDING = (() => {
  if (typeof window === 'undefined') return null
  const base = (import.meta.env.BASE_URL ?? '/').replace(/\/$/, '')
  const path = window.location.pathname
  return (base && path.startsWith(base) ? path.slice(base.length) : path) || '/'
})()

/**
 * Send the reader to the top when the route changes, as a page load would —
 * and never on the arrival.
 *
 * Boot renders this only once the database is open, which is the same instant
 * main.jsx's handOver() removes the prerendered page and puts back the offset
 * it read just before. The first effect ran against the app's first pathname
 * and raced that restore; on the circuit pages the reset won, so a reader
 * thirteen seconds into a 7,000 px page was returned to y = 0 by an event
 * they did not cause, four runs out of four.
 *
 * The arrival is the path the document loaded at, not merely the first render:
 * a reader who clicked through the static page before the database opened is
 * on their second page by the time this mounts, and that one IS a route change
 * — the offset they had belongs to the page they left, and handOver() drops it
 * for the same reason. The flag is left standing rather than cleared on the
 * arrival, so navigating back to the landing path later still goes to the top,
 * and so dev's doubled StrictMode pass reaches the same answer as a build.
 */
function ScrollToTop() {
  const { pathname } = useLocation()
  const first = useRef(true)
  useEffect(() => {
    if (first.current && pathname === LANDING) return
    first.current = false
    window.scrollTo(0, 0)
  }, [pathname])
  return null
}

/**
 * An address that moved, still answering.
 *
 * The search and the hash travel with it: /reference/sql?q=… is the SQL
 * console's permalink, and a site that asks to be cited cannot let a
 * citation stop resolving because a section was renamed.
 */
function Moved({ to }) {
  const { search, hash } = useLocation()
  return <Navigate to={{ pathname: to, search, hash }} replace />
}

/**
 * The season being run, at an address that does not change.
 *
 * `/now` is the one URL a returning reader can type and a link can point at
 * without going stale each January. It redirects rather than rendering: a
 * season already has an address, and a second address for the same page is
 * the thing a canonical tag exists to undo.
 *
 * The year is `meta.current_season` - the season data/current.py declares is
 * being run - and NOT the newest year in the file. The registers already hold
 * 2027, which has run no race, so MAX(year) would send the reader to an empty
 * season; schema.sql's views anchor on the same row for the same reason.
 *
 * Unlike the four Moved addresses this one has to ask the database, so it
 * cannot be a plain <Navigate>. Nearly every reader meets it before the app
 * exists anyway: scripts/prerender.js writes a static redirecting page at
 * /now, and that one answers on a cold arrival without opening f1.db at all.
 * With no row to read - which verify.py does not allow into a built database
 * - the seasons index is the honest answer rather than /seasons/undefined.
 */
function Now() {
  const { search, hash } = useLocation()
  const state = useQuery("SELECT value FROM meta WHERE key = 'current_season'")
  return (
    <Result state={state} context="The season being run could not be read">
      {(data) => {
        const year = data?.rows?.[0]?.value
        if (!year) return <Navigate to="/seasons" replace />
        return <Navigate to={{ pathname: `/seasons/${year}`, search, hash }} replace />
      }}
    </Result>
  )
}

function Footer() {
  const manifest = currentProgress().manifest
  return (
    <footer className="sitefoot">
      <div className="sitefoot-inner">
        <div>
          <p>
            {IN_THIS_TAB} {COUNTED_TOTALS}{' '}
            <Link to="/data/quality">How far to trust it</Link> ·{' '}
            <Link to="/data/sql">write your own query</Link> ·{' '}
            <Link to="/changes">what changed</Link> ·{' '}
            <Link to="/about">who publishes this</Link>.
          </p>
          {/* The inbound channel. A reader who spots a wrong value is the
              adversarial cross-check this project cannot generate for itself,
              and until now the site gave them nowhere to say so - no contact,
              no report link, and an invisible issue tracker nobody had ever
              opened an issue in. The promise is deliberately small and true:
              a disagreement is recorded, not resolved by picking a side. */}
          <p>
            {REPORT_ASK} <a href={REPORT_URL}>{REPORT_LINK}</a>. {REPORT_PROMISE}
          </p>
          <p className="faint">
            Race data from <a href="https://github.com/f1db/f1db">F1DB</a> (CC BY 4.0), prose and
            registers from Wikipedia (CC BY-SA 4.0), circuit geometry ©{' '}
            <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a> (ODbL
            1.0), photographs from Wikimedia Commons under the licence shown with each.{' '}
            {OUTLINE_CREDIT}. Full account on the{' '}
            <Link to="/data/sources">sources page</Link>. Unaffiliated with
            Formula One, the FIA or any team.
          </p>
        </div>
        <dl>
          <dt>Database</dt>
          <dd>v{manifest?.version ?? '—'}</dd>
          <dt>Built</dt>
          <dd>{manifest?.built ?? '—'}</dd>
          {/* When the pipeline last looked, beside when the data last moved.
              A build date alone cannot tell a quiet week from a dead refresh
              (SD-25); this is a committed source constant rather than a row
              in meta, because BUILT is deliberately not a clock [D-01]. */}
          <dt>{CHECKED_LABEL}</dt>
          <dd>{LAST_CHECKED}</dd>
          <dt>Digest</dt>
          <dd>
            <code>{manifest?.digest ?? '—'}</code>
          </dd>
          <dt>Size</dt>
          <dd>
            {manifest ? `${(manifest.bytes / 1024 / 1024).toFixed(1)} MB` : '—'}
            {manifest?.gzipBytes
              ? ` (${(manifest.gzipBytes / 1024 / 1024).toFixed(1)} MB over the wire)`
              : ''}
          </dd>
          <dt>This load</dt>
          <dd>{manifest?.cached ? 'from your browser store' : 'downloaded'}</dd>
        </dl>
      </div>
    </footer>
  )
}

/**
 * Close the search palette when the route changes.
 *
 * `Search` closes itself on Escape, on a backdrop mousedown and on picking a
 * result - `go()` calls `onClose()` before `navigate()` - but a navigation
 * that happens by any other route left it standing over a page it was never
 * opened against, and browser Back with the palette open did the same. A
 * modal is about the page it was opened on, and the page has gone.
 *
 * It sits beside ScrollToTop, with the rest of what a route change means,
 * rather than inside Chrome: subscribing Chrome itself to the location would
 * re-render the masthead and the footer on every navigation to do it.
 * `setSearching` is a useState setter, so it is stable and the effect runs on
 * the pathname alone. On the arrival it sets false over false, which React
 * discards.
 */
function CloseSearchOnNavigate({ setSearching }) {
  const { pathname } = useLocation()
  useEffect(() => {
    setSearching(false)
  }, [pathname, setSearching])
  return null
}

function Chrome() {
  const [searching, setSearching] = useState(false)

  useEffect(() => {
    // Cmd/Ctrl+K, and nothing without a modifier. A bare `/` opened search
    // here too, as a single-character shortcut nobody could turn off (WCAG
    // 2.1.4, AX-15); it is gone rather than made optional, because this
    // chord already did the same thing. Either modifier on any platform:
    // SearchKey only chooses which one to name.
    const onKey = (event) => {
      if ((event.key === 'k' || event.key === 'K') && (event.metaKey || event.ctrlKey)) {
        event.preventDefault()
        setSearching(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div className="app">
      <ScrollToTop />
      <CloseSearchOnNavigate setSearching={setSearching} />
      {/* The wordmark, eight section links, the search trigger and the theme
          toggle are eleven tab stops, and they stood in front of the content
          of every page. WCAG 2.4.1 was already satisfied by the landmarks,
          which is a bypass only for a reader who has a screen reader to move
          between them; this is the one for everybody else. It is the first
          element in the document, it is invisible until it takes focus, and
          it moves focus INTO <main> rather than only scrolling there — a
          fragment link that lands on a non-focusable target leaves the next
          Tab back at the wordmark, which is the bug rather than the fix.
          scripts/prerender.js writes the same link and the same target into
          the static page, so a cold arrival is not the exception. */}
      <a className="skiplink" href="#main">
        Skip to content
      </a>
      <header className="masthead">
        <div className="masthead-inner">
          <Wordmark />
          <nav>
            {NAV.map(({ to, label }) => (
              <NavLink key={to} to={to} className={({ isActive }) => (isActive ? 'active' : undefined)}>
                {label}
              </NavLink>
            ))}
          </nav>
          <button
            type="button"
            className="search-trigger"
            onClick={() => setSearching(true)}
          >
            <span aria-hidden="true">⌕</span>
            Search
            <SearchKey />
          </button>
          <ThemeToggle />
        </div>
      </header>

      <main id="main" tabIndex={-1}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/seasons" element={<Seasons />} />
          <Route path="/seasons/:year" element={<Season />} />
          <Route path="/races" element={<Races />} />
          <Route path="/races/:year/:round" element={<Race />} />
          <Route path="/grands-prix" element={<GrandsPrix />} />
          <Route path="/grands-prix/:id" element={<GrandPrix />} />
          <Route path="/drivers" element={<Drivers />} />
          <Route path="/drivers/:id" element={<Driver />} />
          {/* Two drivers side by side (PD-43). The pair is the query string,
              so one static page at /compare answers every comparison. */}
          <Route path="/compare" element={<Compare />} />
          <Route path="/constructors" element={<Constructors />} />
          <Route path="/constructors/:id" element={<Constructor />} />
          <Route path="/circuits" element={<Circuits />} />
          <Route path="/circuits/:id" element={<Circuit />} />
          <Route path="/cars" element={<Cars />} />
          <Route path="/cars/:id" element={<Car />} />
          <Route path="/records" element={<Records />} />
          {/* Guessable, shareable, and not a masthead item: the season in
              progress, for a reader who wants it without picking a year. */}
          <Route path="/now" element={<Now />} />
          {/* The database's own front door, and the three pages about it. */}
          <Route path="/changes" element={<Changes />} />
          <Route path="/data" element={<Data />} />
          <Route path="/data/quality" element={<Quality />} />
          <Route path="/data/sources" element={<Sources />} />
          <Route path="/data/sql" element={<Sql />} />
          {/* Neither about the sport nor about the file: about the person
              who publishes both, and what they will and will not promise.
              Off the masthead and linked from the footer of every page,
              which is where a reader goes looking for it. */}
          <Route path="/about" element={<About />} />
          {/* About the sport rather than the database. These keep their
              addresses and lost the masthead slot; Seasons, Cars, Circuits,
              Races and the home page lead here. */}
          <Route path="/reference/eras" element={<Eras />} />
          <Route path="/reference/glossary" element={<Glossary />} />
          {/* The old addresses. prerender.js writes a redirecting page at
              each for a cold arrival; these answer the same way in-app. */}
          <Route path="/reference" element={<Moved to="/data" />} />
          <Route path="/reference/quality" element={<Moved to="/data/quality" />} />
          <Route path="/reference/sources" element={<Moved to="/data/sources" />} />
          <Route path="/reference/sql" element={<Moved to="/data/sql" />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>

      <Footer />
      <Search open={searching} onClose={() => setSearching(false)} />
    </div>
  )
}

export default function App() {
  // BrowserRouter, not HashRouter. A hash is never sent to a server, so under
  // HashRouter every one of the 2,300 pages here shared one URL, one title and
  // one entry in any index: the site could not be linked to a page, cited, or
  // crawled. scripts/prerender.js now writes a real file at every one of these
  // paths, which is what makes a deep link resolve without a rewrite rule --
  // and it means no SPA fallback is needed, so a missing f1.db still 404s
  // honestly rather than coming back as index.html with a 200.
  //
  // basename tracks vite's `base` through the same variable, so a build served
  // from a subdirectory routes from there without a second thing to configure.
  //
  // Boot wraps the router rather than the other way round so that the database
  // is opened once, before any route can ask it a question, and so that the
  // wait has somewhere to be drawn.
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <Boot>
        <Chrome />
      </Boot>
    </BrowserRouter>
  )
}
