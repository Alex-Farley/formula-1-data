import { Fragment } from 'react'
import { Link } from 'react-router-dom'
import { PODIUM_LABEL, slab } from '../lib/podium.js'
import { tileValue } from './Page.jsx'

/**
 * A race page's podium where its tiles stood (VD-108, the stepped podium
 * approved on #1330; design-system.md section 3, *Season cycle*): three
 * slabs in team colour, read first to third and stood second, first, third
 * by app.css from 768 px, and under them the strip's other tiles on one
 * line. Each slab names its place, driver, team and start in words, so the
 * colour is never the only cue, and a team with no colour on record stands
 * on a plain panel. `steps` is queries/race.js's racePodium(), `also` its
 * raceAlso(); scripts/prerender.js's racePodiumBlock() writes the same
 * markup from lib/podium.js's slab().
 */
export default function RacePodium({ heading, steps, also }) {
  return (
    <div className="race-podium">
      <p className="eyebrow">{heading}</p>
      <ol className="race-slabs" aria-label={PODIUM_LABEL}>
        {steps.map(slab).map((s) => (
          <li
            key={s.place}
            className={`race-slab race-slab-${s.place} ${s.vars ? 'livery-series' : 'race-slab-plain'}`}
            style={s.vars ?? undefined}
          >
            <span className="race-slab-num" aria-hidden="true">
              {s.numeral}
            </span>{' '}
            <span className="race-slab-first">{s.first}</span>{' '}
            <span className="race-slab-surname">{s.href ? <Link to={`/${s.href}`}>{s.surname}</Link> : s.surname}</span>{' '}
            <span className="race-slab-meta">
              <span>{s.meta}</span>
              {s.time && (
                <>
                  {' '}
                  <span className="race-slab-time num">
                    <span className="sr-only">{s.timeSaid} </span>
                    {s.time}
                  </span>
                </>
              )}
              {s.move && (
                <>
                  {' '}
                  <span className={`race-slab-move ${s.move.kind}`}>
                    <span aria-hidden="true">{s.move.text}</span>
                    <span className="sr-only">{s.move.said}</span>
                  </span>
                </>
              )}
            </span>
          </li>
        ))}
      </ol>
      {also.length > 0 && (
        <p className="race-also">
          {also.map((item, i) => (
            <Fragment key={item.label}>
              {i > 0 && ' · '}
              <span>
                <b>{item.label}</b> {tileValue(item)}
                {item.note && ` · ${item.note}`}
              </span>
            </Fragment>
          ))}
        </p>
      )}
    </div>
  )
}
