import { Link } from 'react-router-dom'
import { TimeText } from './Dates.jsx'
import { winnerColour } from '../lib/liveries.js'
import { ALL_STARTED, LAP_NOTE, NEXT_WORD, STRIP_NOTE, STRIP_PATH, lapLabel } from '../lib/lap.js'
import {
  OUTLINE_BY,
  OUTLINE_RULE,
  OUTLINE_VIEWBOX,
  STATE_WORDS,
  outlineLabel,
  roundShortName,
  roundStates,
  stripLabel,
} from '../lib/outline.js'

/**
 * One circuit outline, drawn the one way this site draws them: F1DB's path
 * in its 500-unit box, stroked in the current ink at a constant width
 * whatever size the box is shown at. Nothing is added — no arrow, no start
 * line, no radius colour — because the drawing carries none of those facts
 * (lib/outline.js), and the trace's colours must not be borrowed by a shape
 * that was never measured.
 *
 * `decorative` hides it from a screen reader, for a thumbnail inside a link
 * whose own name says what it is. `label` names a drawing that says more
 * than the outline, and `children` is what it draws over the outline - the
 * weekend's stops, on home's lap (AF-156) - so that a drawing with marks on
 * it is still this one drawing, not a second.
 */
export default function Outline({ path, circuit, layoutId, decorative = false, label, children, className = '', ...rest }) {
  if (!path) return null
  const shape = (
    <>
      <path d={path} fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      {children}
    </>
  )
  // Two elements rather than a spread of attributes: Biome's a11y rule for an
  // SVG reads the attributes it can see, and a spread is not one of them.
  if (decorative) {
    return (
      <svg className={`outline ${className}`.trim()} viewBox={OUTLINE_VIEWBOX} aria-hidden="true" {...rest}>
        {shape}
      </svg>
    )
  }
  return (
    <svg
      className={`outline ${className}`.trim()}
      viewBox={OUTLINE_VIEWBOX}
      role="img"
      aria-label={label ?? outlineLabel(circuit, layoutId)}
      {...rest}
    >
      {shape}
    </svg>
  )
}

/**
 * An outline with its caption and its credit. `caption` is the figure's own
 * line — the layout id, F1DB's figures, the years it ran; the credit under it
 * is the licence's obligation and travels with every card. `rule` prints the
 * one-line rule too, for a card that stands alone; a grid of cards prints it
 * once, above, instead.
 */
export function OutlineCard({ path, circuit, layoutId, caption, rule = false }) {
  if (!path) return null
  return (
    <figure className="outline-card">
      <Outline path={path} circuit={circuit} layoutId={layoutId} />
      <figcaption>
        {caption}
        <br />
        <span className="faint">{OUTLINE_BY}</span>
        {rule && (
          <>
            <br />
            <span className="faint">{OUTLINE_RULE}</span>
          </>
        )}
      </figcaption>
    </figure>
  )
}

/**
 * The season's calendar as a strip of outlines, one per round, each a link
 * to the race, in the state lib/outline.js gives it: run, next, to come.
 * The state is the database's — a round is run when it holds a
 * classification — so the static page and the app agree without a clock.
 * A round F1DB has not yet given a layout keeps its place with an empty box.
 */
export function OutlineStrip({ year, calendar }) {
  if (!calendar.some((round) => round.outline)) return null
  const states = roundStates(calendar)
  return (
    <div className="outline-strip-wrap">
      <ol className="outline-strip" aria-label={stripLabel(year)}>
        {calendar.map((round, i) => (
          <li key={round.round} data-state={states[i]}>
            <Link to={`/races/${year}/${round.round}`}>
              {round.outline ? <Outline path={round.outline} decorative /> : <span className="outline outline-none" aria-hidden="true" />}
              <WinnerMark round={round} year={year} />
              <b>R{round.round}</b>
              <span>{roundShortName(round.name_used)}</span>
              <small>{STATE_WORDS[states[i]]}</small>
            </Link>
          </li>
        ))}
      </ol>
      <p className="faint outline-strip-note">
        {OUTLINE_RULE} {OUTLINE_BY}.
      </p>
    </div>
  )
}

/**
 * The winner's colour under a run round: the winning constructor's mark -
 * led by the colour it is recognised by (AF-45) - from 2010, its national racing colour before 1968, nothing between and
 * nothing where the round is unrun or the colour unknown (AF-04). Decorative:
 * the table beneath names the winner and the car, and the tooltip names the
 * claim. scripts/prerender.js prints the same bar.
 */
export function WinnerMark({ round, year }) {
  const colour = winnerColour(round, year)
  return colour ? <i className="livery" style={colour.mark} title={colour.title} aria-hidden="true" /> : null
}

/**
 * The weekend as a lap (AF-156): lib/lap.js's layout drawn over the round's
 * outline - the track in to the last session started, a stop per session,
 * the next one's ring pulsing (still under prefers-reduced-motion, app.css)
 * - with the next session's name, its start on the reader's clock and how
 * long until it on the drawing's ground, under the outline rather than over
 * it, where the stops and the track would cut the letters on most circuits.
 * A round with no drawing gets the same stops on a strip, the same words
 * under it. scripts/prerender.js draws the same marks from the same layout
 * at the build's day; the words' three lines are always written, the
 * countdown's empty there and both empty once every session has started, so
 * the app changes them in place and the block keeps its height. The list of sessions beside it is the text the drawing stands for.
 */
export function WeekendLap({ race, lap, zone, until }) {
  if (!lap) return null
  const marks = (
    <>
      {lap.run && <path className="lap-run" d={lap.run} fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />}
      {lap.stops.map((stop) => (
        <g key={stop.key}>
          {stop.state === 'next' && <circle className="lap-pulse" cx={stop.x} cy={stop.y} r={stop.r} vectorEffect="non-scaling-stroke" />}
          <circle className="lap-stop" data-state={stop.state} cx={stop.x} cy={stop.y} r={stop.r} vectorEffect="non-scaling-stroke" />
        </g>
      ))}
    </>
  )
  const label = lapLabel(race.circuit, race.f1db_layout_id, lap)
  const next = (
    <p className="lap-next">
      {lap.next ? (
        <>
          <span>
            {NEXT_WORD}
            <b>{lap.next.name}</b>
          </span>
          <span>
            <TimeText iso={lap.next.start_utc} zone={zone ?? 'UTC'} />
          </span>
          <span className="lap-until">{until ?? '\u00a0'}</span>
        </>
      ) : (
        <>
          <span>{ALL_STARTED}</span>
          <span>{'\u00a0'}</span>
          <span className="lap-until">{'\u00a0'}</span>
        </>
      )}
    </p>
  )
  return (
    <figure className={lap.strip ? 'lap lap-strip' : 'lap'}>
      <div className="lap-stage">
        {lap.strip ? (
          <svg className="outline" viewBox={lap.viewBox} role="img" aria-label={label}>
            <path d={STRIP_PATH} fill="none" stroke="currentColor" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
            {marks}
          </svg>
        ) : (
          <Outline path={race.outline} label={label}>
            {marks}
          </Outline>
        )}
        {next}
      </div>
      <figcaption>
        {lap.strip ? STRIP_NOTE : LAP_NOTE}
        {!lap.strip && (
          <>
            <br />
            <span className="faint">{OUTLINE_BY}</span>
          </>
        )}
      </figcaption>
    </figure>
  )
}
