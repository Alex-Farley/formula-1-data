import { NavLink } from 'react-router-dom'

/**
 * Two drawers with no reader in common, so two navs rather than one.
 *
 * /reference used to hold both: a database drawer (quality, sources, the SQL
 * console) and a sport drawer (eras, glossary). The first is the database
 * itself and now lives under /data, which took the masthead slot. Eras and
 * the glossary keep their URLs and are reached from the pages about the sport
 * — Seasons, Cars, Circuits, Races and the home page — not from /data.
 */
const DATA = [
  ['/data', 'Overview'],
  ['/data/quality', 'Data quality'],
  ['/data/sources', 'Sources and licences'],
  ['/data/sql', 'SQL console'],
]

const SPORT = [
  ['/reference/eras', 'Eras and regulations'],
  ['/reference/glossary', 'Glossary and people'],
]

function Nav({ links, label }) {
  return (
    <nav className="subnav" aria-label={label}>
      {links.map(([to, name]) => (
        <NavLink key={to} to={to} end className={({ isActive }) => (isActive ? 'active' : undefined)}>
          {name}
        </NavLink>
      ))}
    </nav>
  )
}

export default function SubNav() {
  return <Nav links={DATA} label="Data sections" />
}

export function SportNav() {
  return <Nav links={SPORT} label="About the sport" />
}
