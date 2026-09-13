import { Link } from 'react-router-dom'
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
 * whose own name says what it is.
 */
export default function Outline({ path, circuit, layoutId, decorative = false, className = '', ...rest }) {
  if (!path) return null
  const shape = (
    <path d={path} fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
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
      aria-label={outlineLabel(circuit, layoutId)}
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
