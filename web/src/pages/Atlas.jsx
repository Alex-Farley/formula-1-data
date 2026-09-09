import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Confidence, Fields, Note, Onward, Page, Section } from '../components/Page.jsx'
import { Result } from '../components/States.jsx'
import { useQuery } from '../data/useQuery.js'
import { number } from '../lib/format.js'
import { cornerRadius, pathOf, pointAt, project, stitch } from '../lib/lap.js'

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
 * Where each band of corner radius ends, in metres.
 *
 * These are the categories a corner falls into rather than quantiles of a
 * distribution, because a radius means something on its own: 30 m is a
 * hairpin whatever the rest of the lap looks like. They were checked against
 * the geometry before being fixed here — measured over all 7,224 sample
 * points of the 25 traced laps, the five bands take 14%, 17%, 25%, 20% and
 * 24% of the traced distance, so naming them costs nothing in how well the
 * picture reads.
 *
 *     < 50 m   hairpin
 *   50-100 m   slow corner
 *  100-200 m   medium
 *  200-400 m   fast
 *    > 400 m   straight or kink
 *
 * The ramp runs the other way from the bands: tightest gets the strongest
 * colour, because the corners are the subject and the straights are the rest.
 */
const BANDS = [50, 100, 200, 400]
const BAND_NAMES = ['hairpin', 'slow', 'medium', 'fast', 'straight']
const bandIndex = (r) => {
  const i = BANDS.findIndex((edge) => r < edge)
  return i === -1 ? 4 : i
}
const band = (r) => `var(--seq-${5 - bandIndex(r)})`

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
      lede="Twenty-five circuits traced from OpenStreetMap, every one an ordered lap you can walk. Drag the slider to travel round it, colour the line by how hard it turns, or switch to true scale to see how these places really compare."
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
        radius: walk.complete ? cornerRadius(walk.ring, shape.cum) : null,
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
   * the radius crosses a band edge.
   */
  const runs = useMemo(() => {
    if (!lap) return []
    if (!colour || !lap.radius) return [{ d: lap.path, stroke: 'var(--ink)' }]
    const { x, y } = lap.shape
    const out = []
    let start = 0
    let current = band(lap.radius[0])
    for (let i = 1; i <= x.length; i += 1) {
      const next = i < x.length ? band(lap.radius[i]) : null
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
              <h2 style={{ margin: 0, fontSize: 17 }}>{row.name}</h2>
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
                disabled={!lap.radius}
              >
                Colour by corner radius
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

            {colour && lap.radius && (
              <div className="panel" style={{ marginBottom: 12 }}>
                <div className="small muted">Corner radius</div>
                <dl className="radius-key">
                  {BAND_NAMES.map((name, i) => (
                    <div key={name}>
                      <dt>
                        <i style={{ background: `var(--seq-${5 - i})` }} />
                        {name}
                      </dt>
                      <dd className="num">
                        {i === 0 && `under ${BANDS[0]} m`}
                        {i > 0 && i < BANDS.length && `${BANDS[i - 1]}\u2013${BANDS[i]} m`}
                        {i === BANDS.length && `over ${BANDS[BANDS.length - 1]} m`}
                      </dd>
                    </div>
                  ))}
                </dl>
                <p className="small muted" style={{ margin: '10px 0 0' }}>
                  Radius, not g-force: lateral acceleration is v²/r and this database holds no
                  speeds. A wing car&rsquo;s grip also rises with speed, so one g figure across a lap
                  would flatter the hairpins and libel the fast curves.
                </p>
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
            : 'Each frame is fitted to its own circuit. Switch on true scale to compare their sizes. Pick any one to open it above.'
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
          <strong>The colour is read off the shape, not off a corner table.</strong> It measures how
          fast the line changes direction over fifty metres. There is no corner data behind it — no
          names, no apexes, no sector boundaries — so treat it as a description of the drawing
          rather than a fact about the circuit.
        </Note>
        <p className="measure muted">
          Three traces do not close: Las Vegas is missing a section, and Monaco and Montjuïc each
          have holes a few metres wide. They are still the best shape anyone has, so they are drawn
          in amber — but they cannot be walked, and the slider is switched off for them.
        </p>
        <p className="source-note">
          Geometry © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>,{' '}
          {rows[0]?.licence ?? 'ODbL 1.0'} — the obligation travels with the shape if you take one.
          Twenty-five of the eighty circuits have been traced so far.
        </p>
      </Section>

      <Onward
        items={[
          { to: `/circuits/${row.circuit_id}`, label: row.name, hint: 'Its layouts, its winners and every race held there.' },
          { to: '/circuits', label: 'All circuits', hint: 'The other fifty-five venues, traced or not.' },
          { to: '/reference/quality', label: 'What is missing', hint: 'Why historic layouts have no shape at all.' },
        ]}
      />
    </>
  )
}
