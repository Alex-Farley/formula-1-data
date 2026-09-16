import { useEffect, useState } from 'react'
import { BrowserRouter, Link, Navigate, NavLink, Route, Routes, useLocation } from 'react-router-dom'
import Boot from './components/Boot.jsx'
import Search from './components/Search.jsx'
import ThemeToggle from './components/Theme.jsx'
import { currentProgress } from './data/client.js'
import { OUTLINE_CREDIT } from './lib/outline.js'

import Home from './pages/Home.jsx'
import Seasons from './pages/Seasons.jsx'
import Season from './pages/Season.jsx'
import Races from './pages/Races.jsx'
import Race from './pages/Race.jsx'
import Drivers from './pages/Drivers.jsx'
import Driver from './pages/Driver.jsx'
import Constructors from './pages/Constructors.jsx'
import Constructor from './pages/Constructor.jsx'
import Circuits from './pages/Circuits.jsx'
import Circuit from './pages/Circuit.jsx'
import Cars from './pages/Cars.jsx'
import Car from './pages/Car.jsx'
import Records from './pages/Records.jsx'
import Data from './pages/Data.jsx'
import Eras from './pages/Eras.jsx'
import Quality from './pages/Quality.jsx'
import Sources from './pages/Sources.jsx'
import Glossary from './pages/Glossary.jsx'
import Sql from './pages/Sql.jsx'
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
        <span>1950–2026 · every championship race</span>
      </span>
    </Link>
  )
}

/** Send the reader to the top when the route changes, as a page load would. */
function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => {
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

function Footer() {
  const manifest = currentProgress().manifest
  return (
    <footer className="sitefoot">
      <div className="sitefoot-inner">
        <div>
          <p>
            Every page here is a query against one SQLite file, running in this tab. Nothing you
            look at or type is sent anywhere, and once it has loaded, this tab keeps working
            without a network. Career
            totals are counted from the race records wherever the records can support it, and an em
            dash means nobody has established that figure — never zero.{' '}
            <Link to="/data/quality">How far to trust it</Link> ·{' '}
            <Link to="/data/sql">write your own query</Link>.
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

function Chrome() {
  const [searching, setSearching] = useState(false)

  useEffect(() => {
    const onKey = (event) => {
      const typing = /^(input|textarea|select)$/i.test(event.target?.tagName ?? '')
      if ((event.key === 'k' || event.key === 'K') && (event.metaKey || event.ctrlKey)) {
        event.preventDefault()
        setSearching(true)
      } else if (event.key === '/' && !typing && !event.metaKey && !event.ctrlKey) {
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
          <button type="button" className="search-trigger" onClick={() => setSearching(true)}>
            <span aria-hidden="true">⌕</span>
            Search
            <kbd>/</kbd>
          </button>
          <ThemeToggle />
        </div>
      </header>

      <main>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/seasons" element={<Seasons />} />
          <Route path="/seasons/:year" element={<Season />} />
          <Route path="/races" element={<Races />} />
          <Route path="/races/:year/:round" element={<Race />} />
          <Route path="/drivers" element={<Drivers />} />
          <Route path="/drivers/:id" element={<Driver />} />
          <Route path="/constructors" element={<Constructors />} />
          <Route path="/constructors/:id" element={<Constructor />} />
          <Route path="/circuits" element={<Circuits />} />
          <Route path="/circuits/:id" element={<Circuit />} />
          <Route path="/cars" element={<Cars />} />
          <Route path="/cars/:id" element={<Car />} />
          <Route path="/records" element={<Records />} />
          {/* The database's own front door, and the three pages about it. */}
          <Route path="/data" element={<Data />} />
          <Route path="/data/quality" element={<Quality />} />
          <Route path="/data/sources" element={<Sources />} />
          <Route path="/data/sql" element={<Sql />} />
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
