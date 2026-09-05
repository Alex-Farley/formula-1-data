import { Link, useParams } from 'react-router-dom'
import { useQuery } from '../useQuery.js'
import { Confidence, Page, Section, Stats } from '../components/Page.jsx'
import { Result } from '../components/State.jsx'
import DataTable from '../components/DataTable.jsx'
import CommonsImage from '../components/CommonsImage.jsx'
import { cell, span } from '../format.js'

const CAR = `
SELECT c.*, co.name AS constructor, co.id AS constructor_id
FROM cars c
LEFT JOIN constructors co ON co.id = c.constructor_id
WHERE c.id = ?`

// The races this car is linked to. A (car, season) link asserts that every
// race the constructor won, took pole for or set fastest lap in that season
// was in this chassis, so it is not claimed where a team ran two cars in one
// year - those seasons are simply absent.
const RACES = `
SELECT year, round, gp_name, circuit, driver, won, pole, fastest_lap
FROM v_car_races
WHERE car_id = ?
ORDER BY year, round`

// The lead image of whichever article describes this car, with the credit its
// licence requires. LIMIT 1 because a car can span several chassis articles
// and one photograph is enough; the rest are reachable through v_car_images.
const IMAGE = `
SELECT * FROM v_car_images WHERE car_id = ? LIMIT 1`

const SPEC = [
  ['Designers', 'designers'],
  ['Engine', 'engine_name'],
  ['Configuration', 'engine_config'],
  ['Capacity (cc)', 'capacity_cc'],
  ['Aspiration', 'aspiration'],
  ['Power (bhp)', 'power_bhp'],
  ['Rev limit (rpm)', 'rev_limit_rpm'],
  ['Chassis', 'chassis_type'],
  ['Gearbox', 'gearbox'],
  ['Suspension', 'suspension'],
  ['Brakes', 'brakes'],
  ['Weight (kg)', 'weight_kg'],
  ['Wheelbase (mm)', 'wheelbase_mm'],
  ['Tyres', 'tyres'],
]

export default function Car() {
  const { id } = useParams()
  const car = useQuery(CAR, [id])
  const races = useQuery(RACES, [id])
  const image = useQuery(IMAGE, [id])

  return (
    <Result state={car} what="Loading the car">
      {(data) => {
        const c = data.rows[0]
        if (!c)
          return (
            <Page title="Not found" back={{ to: '/cars', label: 'All cars' }}>
              <p className="muted">No car with id “{id}”.</p>
            </Page>
          )
        return (
          <Page
            title={
              <>
                {c.full_name} <Confidence value={c.confidence} />
              </>
            }
            back={{ to: '/cars', label: 'All cars' }}
          >
            <Stats
              items={[
                {
                  label: 'Constructor',
                  value: c.constructor,
                },
                { label: 'Raced', value: span(c.from_year, c.to_year) },
                { label: 'Wins', value: c.wins },
                { label: 'Poles', value: c.poles },
                { label: 'Fastest laps', value: c.fastest_laps },
                { label: "Drivers' titles", value: c.drivers_titles },
                { label: "Constructors' titles", value: c.constructors_titles },
              ]}
            />
            {image.data?.rows?.[0] && (
              <CommonsImage row={image.data.rows[0]} width={800} />
            )}
            {c.concept && (
              <p className="lede">
                <strong>Concept.</strong> {c.concept}
              </p>
            )}
            {c.story && <p>{c.story}</p>}
            {c.outcome && (
              <p className="note">
                <strong>Outcome.</strong> {c.outcome}
              </p>
            )}
            {c.innovations && (
              <p className="note">
                <strong>Introduced.</strong> {c.innovations}
              </p>
            )}

            <Section
              title="Specification"
              note={`Spec confidence: ${c.spec_confidence ?? 'not stated'}. A blank figure was not established, and is never a zero.`}
            >
              <dl className="spec">
                {SPEC.filter(([, key]) => c[key] !== null && c[key] !== undefined).map(
                  ([label, key]) => (
                    <div key={key}>
                      <dt>{label}</dt>
                      <dd>{cell(c[key])}</dd>
                    </div>
                  ),
                )}
              </dl>
              {c.power_note && <p className="note">{c.power_note}</p>}
            </Section>

            <Section
              title="Races linked to this car"
              note="Only seasons where the constructor is known to have run one chassis are linked, so this is a floor, not a complete race history."
            >
              <Result state={races} what="Loading the races">
                {(rows) => (
                  <DataTable
                    data={rows}
                    columns={['year', 'gp_name', 'circuit', 'driver', 'result']}
                    labels={{ gp_name: 'Grand Prix' }}
                    render={{
                      year: (v) => <Link to={`/seasons/${v}`}>{v}</Link>,
                      result: (_, row) =>
                        [row.won && 'Win', row.pole && 'Pole', row.fastest_lap && 'Fastest lap']
                          .filter(Boolean)
                          .join(' · ') || '—',
                    }}
                    empty="No races linked to this car."
                  />
                )}
              </Result>
            </Section>
          </Page>
        )
      }}
    </Result>
  )
}
