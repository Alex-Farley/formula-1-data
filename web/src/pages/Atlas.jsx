import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Confidence, Fields, Note, Page, Section } from '../components/Page.jsx'
import { Result } from '../components/States.jsx'
import { useQuery } from '../data/useQuery.js'
import { number } from '../lib/format.js'
import { pathOf, pointAt, project, stitch, turnRate } from '../lib/lap.js'

const SQL = `
  SELECT g.circuit_id, g.centreline, g.measured_km, g.published_km, g.delta_pct,
         g.node_count, g.segment_count, g.loose_ends, g.closes,
         g.osm_relation, g.osm_timestamp, g.licence, g.confidence,
         c.name, c.country, c.locality, c.turns, c.direction, c.circuit_type,
         v.races, v.first_gp, v.last_gp
    FROM circuit_geometry g
    JOIN circuits c   ON c.id = g.circuit_id
    LEFT JOIN v_circuits v ON v.id = g.circuit_id
   ORDER BY c.name
`

/**
 * Where each band of turn rate begins, in degrees per metre.
 *
 * These are the quintiles of the actual distribution — measured over all 6,272
 * points of the 22 laps that close — so each band is a fifth of the traced
 * distance in the database rather than a round number chosen by eye. Picked by
 * hand, the bands put 65% of every circuit in the bottom two and the picture
 * washed out.
 */
const BANDS = [0.08, 0.22, 0.39, 0.71]
const band = (k) => `var(--seq-${BANDS.findIndex((edge) => k < edge) + 1 || 5})`

/** A square viewBox around a circuit's own extent. */
function fitted(shape, pad = 40) {
  const { x0, x1, y0, y1 } = shape.bounds
  const w = x1 - x0 + pad * 2
  const h = y1 - y0 + pad * 2
  const side = Math.max(w, h)
  return `${x0 - pad - (side - w) / 2} ${y0 - pad - (side - h) / 2} ${side} ${side}`
}

/** The same square for every circuit, so their sizes can be compared. */
function shared(shape, side) {
  const cx = (shape.bounds.x0 + shape.bounds.x1) / 2
  const cy = (shape.bounds.y0 + shape.bounds.y1) / 2
  return `${cx - side / 2} ${cy - side / 2} ${side} ${side}`
}

export default function Atlas() {
  const state = useQuery(SQL)
  return (
    <Page
      eyebrow="Circuits"
      title="Track atlas"
      back={{ to: '/circuits', label: 'The register' }}
      lede="Twenty-five circuits traced from OpenStreetMap. The ways of each relation stitch end to end into an ordered lap, so a line here can be measured and walked — the length shown is the sum of that walk, not a figure copied from anywhere."
    >
      <Result state={state}>{(data) => <AtlasBody rows={data.rows} />}</Result>
    </Page>
  )
}

function AtlasBody({ rows }) {
  const [id, setId] = useState('spa')
  const [at, setAt] = useState(0)
  const [colour, setColour] = useState(true)
  const [trueScale, setTrueScale] = useState(false)

  /**
   * Stitch and project every circuit once. Twenty-five laps is about forty
   * milliseconds of work and roughly seven thousand points; redoing it on
   * every scrub tick would be the one thing that made this feel slow.
   */
  const laps = useMemo(() => {
    const out = new Map()
    for (const row of rows) {
      const walk = stitch(row.centreline)
      if (!walk) continue
      const shape = project(walk.ring)
      out.set(row.circuit_id, {
        row,
        shape,
        complete: walk.complete,
        path: pathOf(shape.x, shape.y),
        // Colouring is only meaningful along an ordered lap; on a trace that
        // does not close, the walk stops early and the rest is unvisited.
        turn: walk.complete ? turnRate(walk.ring, shape.cum) : null,
      })
    }
    return out
  }, [rows])

  /** One square that holds the largest circuit, for the true-scale wall. */
  const widest = useMemo(() => {
    let side = 0
    for (const { shape } of laps.values()) {
      side = Math.max(side, shape.bounds.x1 - shape.bounds.x0, shape.bounds.y1 - shape.bounds.y0)
    }
    return side + 160
  }, [laps])

  const lap = laps.get(id)

  /**
   * One path per run of same-band points, so a 330-point lap draws as about
   * eighty paths rather than 330 — and the colour still changes exactly where
   * the turn rate does.
   */
  const runs = useMemo(() => {
    if (!lap) return []
    if (!colour || !lap.turn) return [{ d: lap.path, stroke: 'var(--ink)' }]
    const { x, y } = lap.shape
    const out = []
    let start = 0
    let current = band(lap.turn[0])
    for (let i = 1; i <= x.length; i += 1) {
      const next = i < x.length ? band(lap.turn[i]) : null
      if (next !== current) {
        out.push({ d: pathOf(x, y, start, Math.min(i + 1, x.length)), stroke: current })
        start = i
        current = next
      }
    }
    return out
  }, [lap, colour])

  if (!lap) return null
  const { row, shape } = lap
  const marker = pointAt(shape, at)
  const walkable = lap.complete

  return (
    <>
      <Section>
        <div className="atlas">
          <div className="atlas-stage">
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 8 }}>
              <h3 style={{ margin: 0, fontSize: 17 }}>{row.name}</h3>
              <span className="faint small">
                {[row.locality, row.country].filter(Boolean).join(', ')}
              </span>
              <span style={{ flex: 1 }} />
              {!walkable && <span className="pill pill-unverified">trace does not close</span>}
            </div>

            <svg
              viewBox={fitted(shape)}
              role="img"
              aria-label={`Traced centreline of ${row.name}, ${row.measured_km} km over ${number(row.node_count)} points`}
              style={{ maxHeight: 460 }}
            >
              {runs.map((run, i) => (
                <path
                  key={i}
                  d={run.d}
                  fill="none"
                  stroke={run.stroke}
                  strokeWidth="26"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  vectorEffect="non-scaling-stroke"
                  style={{ strokeWidth: 4 }}
                />
              ))}
              {walkable && (
                <>
                  <circle cx={marker.x} cy={marker.y} r="70" fill="var(--accent)" opacity="0.16" />
                  <circle
                    cx={marker.x}
                    cy={marker.y}
                    r="30"
                    fill="var(--accent)"
                    stroke="var(--panel)"
                    strokeWidth="9"
                  />
                </>
              )}
            </svg>

            <div className="atlas-scrub">
              <label className="faint small" htmlFor="atlas-at" style={{ whiteSpace: 'nowrap' }}>
                Along the lap
              </label>
              <input
                id="atlas-at"
                type="range"
                min="0"
                max="1000"
                value={Math.round(at * 1000)}
                disabled={!walkable}
                onChange={(event) => setAt(Number(event.target.value) / 1000)}
              />
              <output htmlFor="atlas-at">
                {walkable
                  ? `${number(Math.round(marker.metres))} m of ${number(Math.round(shape.length))}`
                  : 'not a closed lap'}
              </output>
            </div>
          </div>

          <div>
            <div className="chips" style={{ marginBottom: 12 }}>
              <button
                type="button"
                className="chip"
                aria-pressed={colour}
                onClick={() => setColour(!colour)}
                disabled={!lap.turn}
              >
                Colour by turn rate
              </button>
              <button
                type="button"
                className="chip"
                aria-pressed={trueScale}
                onClick={() => setTrueScale(!trueScale)}
              >
                True scale
              </button>
            </div>

            {colour && lap.turn && (
              <div className="panel" style={{ marginBottom: 12 }}>
                <div className="small muted">Turn rate</div>
                <div className="ramp">
                  <i style={{ background: 'var(--seq-1)' }} />
                  <i style={{ background: 'var(--seq-2)' }} />
                  <i style={{ background: 'var(--seq-3)' }} />
                  <i style={{ background: 'var(--seq-4)' }} />
                  <i style={{ background: 'var(--seq-5)' }} />
                </div>
                <div className="ramp-ends">
                  <span>straight</span>
                  <span>hairpin</span>
                </div>
              </div>
            )}

            <div className="panel">
              <Fields
                items={[
                  { label: 'Walked', value: `${row.measured_km.toFixed(3)} km` },
                  { label: 'Published', value: `${row.published_km.toFixed(3)} km` },
                  {
                    label: 'Difference',
                    value: `${row.delta_pct > 0 ? '+' : ''}${row.delta_pct.toFixed(2)}%`,
                  },
                  { label: 'Turns', value: row.turns },
                  { label: 'Direction', value: row.direction },
                  { label: 'Races held', value: number(row.races) },
                  { label: 'Traced points', value: number(row.node_count) },
                  { label: 'Ways', value: number(row.segment_count) },
                  { label: 'Loose ends', value: number(row.loose_ends) },
                  { label: 'Confidence', value: <Confidence value={row.confidence} /> },
                  {
                    label: 'OSM relation',
                    value: (
                      <a
                        href={`https://www.openstreetmap.org/relation/${row.osm_relation}`}
                        target="_blank"
                        rel="noreferrer noopener"
                      >
                        {row.osm_relation}
                      </a>
                    ),
                  },
                  {
                    label: 'Circuit',
                    value: <Link to={`/circuits/${row.circuit_id}`}>Everything else about it</Link>,
                  },
                ]}
              />
            </div>
          </div>
        </div>
      </Section>

      <Section
        title="All twenty-five"
        count={`${laps.size}`}
        note={
          trueScale
            ? 'Every frame now covers the same ground, so these are comparable: Monaco really is half of Spa.'
            : 'Each frame is fitted to its own circuit. Switch on true scale to compare their sizes.'
        }
      >
        <div className="atlas-wall">
          {[...laps.values()].map(({ row: r, shape: s, path, complete }) => (
            <button
              key={r.circuit_id}
              type="button"
              className="atlas-cell"
              aria-pressed={r.circuit_id === id}
              onClick={() => {
                setId(r.circuit_id)
                setAt(0)
              }}
            >
              <svg viewBox={trueScale ? shared(s, widest) : fitted(s)} aria-hidden="true">
                <path
                  d={path}
                  fill="none"
                  stroke={complete ? 'var(--ink-soft)' : 'var(--warn)'}
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  vectorEffect="non-scaling-stroke"
                />
              </svg>
              <b>{r.name}</b>
              <span>{r.measured_km.toFixed(3)} km</span>
            </button>
          ))}
        </div>
      </Section>

      <Section title="What this is, and is not">
        <Note>
          <strong>The turn-rate colouring is derived from the shape.</strong> It measures how fast
          the bearing changes over fifty metres of traced line. The database holds no corner data at
          all — no numbers, no names, no apex positions, no sector boundaries — so this is a reading
          of the geometry, not a fact about the circuit. Node spacing is irregular, which is why it
          is averaged over a window rather than taken per point.
        </Note>
        <p className="measure muted">
          Three traces do not close: Las Vegas is missing a way, and Monaco and Montjuïc each have
          holes of a few metres. They are still the best shape anyone has for those circuits, so
          they are drawn — in amber above — but they cannot be walked, and the scrubber is disabled
          for them. <code>build.py</code> decides this when the row is admitted and{' '}
          <code>verify.py</code> re-derives it from the geometry on every build; this page only
          reproduces a result the database already guarantees.
        </p>
        <p className="source-note">
          Geometry © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>,{' '}
          {rows[0]?.licence ?? 'ODbL 1.0'}. This is the only ODbL table in the database: nothing else
          derives from it and it is excluded from the JSON export, so dropping the table drops the
          obligation. Only 25 of the 80 circuits have been traced.
        </p>
      </Section>
    </>
  )
}
