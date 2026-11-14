import { Link } from 'react-router-dom'
import LiveryMark from './LiveryMark.jsx'
import { ownColour } from '../charts/own.js'

/**
 * The season plate (VD-104 (c), design-system.md §3): queries/season.js
 * seasonPlate()'s champion, in the pair of the team they won with - the
 * 4 px rule over the plate, `.livery-series` choosing the light or the dark
 * value as a chart series does - or in ink where no colour is on record.
 * The label names the team in words beside its mark, so the colour is never
 * the only cue. scripts/prerender.js writes the same markup. One component:
 * home's opening (VD-109) and a constructor's ribbon (VD-115) are to be
 * built on it.
 */
export default function SeasonPlate({ plate }) {
  if (!plate) return null
  const own = ownColour(plate.colour)
  return (
    <div className={own.className ? `season-plate ${own.className}` : 'season-plate season-plate-none'} style={own.style}>
      <p className="season-plate-label">
        {plate.colour && <LiveryMark colour={plate.colour} prose />}
        {plate.label}
        {plate.team && (
          <>
            {' · '}
            {plate.teamHref ? <Link to={`/${plate.teamHref}`}>{plate.team}</Link> : plate.team}
          </>
        )}
      </p>
      <p className="season-plate-name">
        <Link to={`/${plate.href}`}>{plate.name}</Link>
      </p>
      {plate.margin && (
        <p className="season-plate-figure">
          <span className="season-plate-margin">{plate.margin}</span> <span>{plate.sentence}</span>
        </p>
      )}
    </div>
  )
}
