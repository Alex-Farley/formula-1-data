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
 * home's opening (VD-109, queries/home.js homePlate) is built on it. A
 * constructor's livery ribbon (VD-115) was to be, and is LiveryRibbon.jsx
 * instead: its plates hold no words and draw each colour as itself.
 *
 * `aside` is what stands beside the champion under the same rule, from
 * 1180 px in the slot's column: home's last race and its podium (VD-109).
 * A sentence with no margin - a lead level on points - is printed alone.
 * `heading` sets the name as an h2 where the plate opens a section that has
 * none, as home's does, so the aside's h3 is not the page's first heading
 * under its h1; the season page's plate stands above its tiles in a
 * paragraph, as it always has.
 */
export default function SeasonPlate({ plate, aside = null, heading = false }) {
  const Name = heading ? 'h2' : 'p'
  if (!plate) return null
  const own = ownColour(plate.colour)
  const classes = [own.className ? `season-plate ${own.className}` : 'season-plate season-plate-none', aside ? 'season-plate-split' : null]
    .filter(Boolean)
    .join(' ')
  const champion = (
    <>
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
      <Name className="season-plate-name">{plate.href ? <Link to={`/${plate.href}`}>{plate.name}</Link> : plate.name}</Name>
      {(plate.margin || plate.sentence) && (
        <p className="season-plate-figure">
          {plate.margin && (
            <>
              <span className="season-plate-margin">{plate.margin}</span>{' '}
            </>
          )}
          <span>{plate.sentence}</span>
        </p>
      )}
    </>
  )
  return (
    <div className={classes} style={own.style}>
      {aside ? (
        <>
          <div className="season-plate-main">{champion}</div>
          {aside}
        </>
      ) : (
        champion
      )}
    </div>
  )
}
