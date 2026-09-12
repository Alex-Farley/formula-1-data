/**
 * Where two sources disagree about the fact on this page.
 *
 * `discrepancies` is one of the few tables this project ORIGINATES rather than
 * re-exports, and the whole reason to prefer this database over its upstream:
 * where two sources differ and neither can be checked officially, the
 * disagreement is recorded instead of one of them being picked silently. It
 * lived only on /data/quality, aggregated, which is the one place a reader
 * who cares about a particular race will never be looking.
 *
 * So it goes beside the fact instead. A reader on the 2021 Hungarian Grand Prix
 * sees a pole position stated flatly; the database knows two sources name
 * different drivers for it, and knows why both readings can be true.
 *
 * THE JOIN IS BY SUBJECT, and the subject is free text — 'YYYY round N' for a
 * race, a driver's full name for a driver. The queries below construct that key
 * from what the page already knows rather than parsing it, so a subject whose
 * shape ever changes yields no rows rather than wrong ones. That failure would
 * be silent, which is why verify.py now refuses a race-shaped subject that names
 * no race: the check is what makes the quiet join safe to rely on.
 */
import { Link } from 'react-router-dom'
import { allExplained } from '../lib/disagreement.js'

/*
 * Both values are resolved through `drivers` on the way out. A discrepancy
 * about a pole position holds two driver IDS, and "verstappen against hamilton"
 * is the schema talking. The join is LEFT and falls back to the raw value, so a
 * field whose values are not driver ids — a weight in kg, a lap count — is
 * unaffected.
 */
const RESOLVED = `
  SELECT d.id, d.field, d.status, d.assessment,
         COALESCE(s.full_name, d.stored_value)  AS stored_value,
         COALESCE(v.full_name, d.derived_value) AS derived_value
    FROM discrepancies d
    LEFT JOIN drivers s ON s.id = d.stored_value
    LEFT JOIN drivers v ON v.id = d.derived_value
`

/** Open disagreements about one race. Args: [year, round]. */
export const RACE_DISAGREEMENTS = `
  ${RESOLVED}
   WHERE d.subject = CAST(?1 AS TEXT) || ' round ' || CAST(?2 AS TEXT)
     AND d.status LIKE 'open%'
   ORDER BY d.id
`

/**
 * Open disagreements about one driver's career figures, and the explained
 * ones - where the register and the race records read a span differently and
 * each is right about something (CD-25). Args: [driver id].
 */
export const DRIVER_DISAGREEMENTS = `
  ${RESOLVED}
   WHERE d.subject = (SELECT full_name FROM drivers WHERE id = ?1)
     AND (d.status LIKE 'open%' OR d.status LIKE 'explained - each side%')
   ORDER BY d.id
`


/** `fastest_laps` is a column name. The reader is owed the words. */
const label = (field) => String(field ?? '').replace(/_/g, ' ')

/** Open disagreements about one constructor's figures. Args: [constructor id]. */
export const CONSTRUCTOR_DISAGREEMENTS = `
  ${RESOLVED}
   WHERE d.subject = (SELECT name FROM constructors WHERE id = ?1)
     AND d.status LIKE 'open%'
   ORDER BY d.id
`

/**
 * A stored and a derived reading, side by side.
 *
 * Both are shown because neither has been established as the right one — that
 * is the whole claim. Naming one "correct" here would be the silent pick the
 * table exists to avoid.
 */
export default function Disagreement({ rows, what = 'this' }) {
  if (!rows || rows.length === 0) return null
  const explained = allExplained(rows)

  return (
    <aside className="disagreement" aria-label={explained ? 'Two readings, both recorded' : 'Recorded source disagreement'}>
      <h2>
        {explained
          ? `Two readings of ${what}, each right about something`
          : rows.length === 1
            ? 'Two sources disagree about ' + what
            : `Two sources disagree about ${what}, in ${rows.length} places`}
      </h2>
      <dl>
        {rows.map((row) => (
          <div key={row.id}>
            <dt>{label(row.field)}</dt>
            <dd>
              <p className="disagreement-pair num">
                <span>{row.stored_value}</span>
                <span className="disagreement-vs">against</span>
                <span>{row.derived_value}</span>
              </p>
              <p className="disagreement-why">{row.assessment}</p>
            </dd>
          </div>
        ))}
      </dl>
      <p className="source-note">
        {explained
          ? 'Recorded and explained rather than resolved: the register and the race records define the span differently, and the page shows both. Every recorded reading is listed on '
          : 'Recorded rather than resolved, and open for somebody to settle. Every one is listed on '}
        <Link to="/data/quality">the quality page</Link>.
      </p>
    </aside>
  )
}
