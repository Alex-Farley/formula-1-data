import { HashRouter, NavLink, Route, Routes } from 'react-router-dom'
import Seasons from './pages/Seasons.jsx'
import Season from './pages/Season.jsx'
import Drivers from './pages/Drivers.jsx'
import Driver from './pages/Driver.jsx'
import Constructors from './pages/Constructors.jsx'
import Constructor from './pages/Constructor.jsx'
import Circuits from './pages/Circuits.jsx'
import Circuit from './pages/Circuit.jsx'
import Cars from './pages/Cars.jsx'
import Car from './pages/Car.jsx'
import Console from './pages/Console.jsx'
import Trends from './pages/Trends.jsx'
import Gaps from './pages/Gaps.jsx'
import NotFound from './pages/NotFound.jsx'

const NAV = [
  { to: '/', label: 'Seasons', end: true },
  { to: '/drivers', label: 'Drivers' },
  { to: '/constructors', label: 'Constructors' },
  { to: '/circuits', label: 'Circuits' },
  { to: '/cars', label: 'Cars' },
  { to: '/trends', label: 'Trends' },
  { to: '/console', label: 'SQL' },
  { to: '/gaps', label: 'Gaps' },
]

export default function App() {
  // HashRouter, not BrowserRouter: this builds to a static site with no server
  // in front of it, so there is nothing to rewrite deep links back to
  // index.html. A hash route works on GitHub Pages, in a subdirectory, and
  // from the filesystem, with no configuration.
  return (
    <HashRouter>
      <header className="masthead">
        <div className="masthead-inner">
          <div className="brand">
            <h1>F1 Verified Facts</h1>
            <p>1950–2026 · 1,161 races · queried in your browser</p>
          </div>
          <nav>
            {NAV.map(({ to, label, end }) => (
              <NavLink key={to} to={to} end={end}>
                {label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>

      <main>
        <Routes>
          <Route path="/" element={<Seasons />} />
          <Route path="/seasons/:year" element={<Season />} />
          <Route path="/drivers" element={<Drivers />} />
          <Route path="/drivers/:id" element={<Driver />} />
          <Route path="/constructors" element={<Constructors />} />
          <Route path="/constructors/:id" element={<Constructor />} />
          <Route path="/circuits" element={<Circuits />} />
          <Route path="/circuits/:id" element={<Circuit />} />
          <Route path="/cars" element={<Cars />} />
          <Route path="/cars/:id" element={<Car />} />
          <Route path="/trends" element={<Trends />} />
          <Route path="/console" element={<Console />} />
          <Route path="/gaps" element={<Gaps />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>

      <footer>
        <p>
          Every page here is SQL against <code>f1.db</code>, running locally in this tab. Career
          wins, poles and fastest laps are derived from the race records, not stored — see{' '}
          <NavLink to="/gaps">Gaps</NavLink> for what the database deliberately does not hold.
        </p>
        <p className="muted">
          Data derived from Wikipedia and formula1.com, licensed CC BY-SA 4.0. Unaffiliated with
          Formula One or the FIA.
        </p>
      </footer>
    </HashRouter>
  )
}
