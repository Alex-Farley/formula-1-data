import { Link } from 'react-router-dom'
import { ownColour } from '../charts/own.js'
import { PODIUM_LABEL, podiumTeam } from '../lib/podium.js'

/**
 * Home's podium, the last race run's top three as steps (AF-135;
 * design-system.md section 3, *Season cycle*): read first to third, and
 * stood second, first, third by app.css. Each step names its place, driver
 * and team, so the team's colour is never the only cue; a team with no
 * colour on record stands as an outline. `steps` is lib/podium.js's
 * podium(), which a race page's slabs (components/RacePodium.jsx, VD-108)
 * stand too. scripts/prerender.js's podiumHtml() writes the same markup.
 */
export default function Podium({ steps }) {
  return (
    <ol className="podium" aria-label={PODIUM_LABEL}>
      {steps.map((step) => {
        const own = ownColour(step.colour)
        return (
          <li key={step.place} className={`podium-step podium-${step.place}`}>
            <span className="podium-place">{step.ordinal}</span>{' '}
            <span className="podium-driver">
              {step.driver_id ? <Link to={`/drivers/${step.driver_id}`}>{step.driver}</Link> : step.driver}
            </span>{' '}
            <span className="podium-team muted small">{podiumTeam(step)}</span>
            <span
              className={own.className ? `podium-block ${own.className}` : 'podium-block podium-block-none'}
              style={own.style}
              aria-hidden="true"
            />
          </li>
        )
      })}
    </ol>
  )
}
