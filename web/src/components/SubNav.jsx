import { NavLink } from 'react-router-dom'

const LINKS = [
  ['/reference', 'Overview'],
  ['/reference/eras', 'Eras and regulations'],
  ['/reference/quality', 'Data quality'],
  ['/reference/sources', 'Sources and licences'],
  ['/reference/glossary', 'Glossary and people'],
  ['/reference/sql', 'SQL console'],
]

export default function SubNav() {
  return (
    <nav className="subnav" aria-label="Reference sections">
      {LINKS.map(([to, label]) => (
        <NavLink key={to} to={to} end className={({ isActive }) => (isActive ? 'active' : undefined)}>
          {label}
        </NavLink>
      ))}
    </nav>
  )
}
