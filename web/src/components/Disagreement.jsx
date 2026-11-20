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
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Dated } from './Dates.jsx'
import {
  DRIVER_READINGS,
  EXPLAINED_FOOTER,
  FOLDED_ID,
  OPEN_FOOTER,
  POINTER_LINK,
  allExplained,
  byReading,
  explainedHeading,
  fieldLabel,
  openHeading,
} from '../lib/disagreement.js'
import { staticDisagreementsOpen } from '../lib/handover.js'
import { REPORT_URL, SETTLE_ASK, SETTLE_LINK } from '../lib/site.js'

/*
 * Both values are resolved through `drivers` on the way out. A discrepancy
 * about a pole position holds two driver IDS, and "verstappen against hamilton"
 * is the schema talking. The join is LEFT and falls back to the raw value, so a
 * field whose values are not driver ids — a weight in kg, a lap count — is
 * unaffected.
 */
const RESOLVED = `
  SELECT d.id, d.kind, d.field, d.status, d.status_note, d.assessment,
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
     AND d.status = 'open'
   ORDER BY d.id
`

/**
 * Open disagreements about one driver's career figures, and the explained
 * ones - where the register and the race records read a span differently and
 * each is right about something (CD-25), or a stored total differs from the
 * records' count for a reason on the record (DA-43). Args: [driver id].
 */
export const DRIVER_DISAGREEMENTS = `
  ${RESOLVED}
   WHERE d.subject = (SELECT full_name FROM drivers WHERE id = ?1)
     AND ${DRIVER_READINGS}
   ORDER BY d.id
`


/** `fastest_laps` is a column name. The reader is owed the words. */

/** Open disagreements about one constructor's figures. Args: [constructor id]. */
export const CONSTRUCTOR_DISAGREEMENTS = `
  ${RESOLVED}
   WHERE d.subject = (SELECT name FROM constructors WHERE id = ?1)
     AND d.status = 'open'
   ORDER BY d.id
`

/**
 * A stored and a derived reading, side by side.
 *
 * Both are shown because neither has been established as the right one — that
 * is the whole claim. Naming one "correct" here would be the silent pick the
 * table exists to avoid.
 *
 * Open rows and explained ones each get an aside of their own, open first
 * (byReading), so neither is introduced in the other's words.
 *
 * `folded` is a race page's (VD-131): the box follows the classification,
 * closed to its heading, with the id the pointer above the table links to.
 * A race's rows are open ones only (RACE_DISAGREEMENTS), so it is one box.
 */
export default function Disagreement({ rows, what = 'this', folded = false }) {
  if (!rows || rows.length === 0) return null
  return byReading(rows).map((group, i) => (
    <Readings key={group[0].id} rows={group} what={what} folded={folded} id={folded && i === 0 ? FOLDED_ID : undefined} />
  ))
}

/**
 * The line above a race's classification that says how many disagreements
 * the folded box below holds, in the box's own heading, and links to it
 * (VD-131). Following the link opens the box; the static page's link, with
 * no script, scrolls to it closed, one line to open.
 */
export function DisagreementPointer({ rows, what }) {
  if (!rows || rows.length === 0) return null
  const open = () => {
    const details = document.getElementById(FOLDED_ID)?.querySelector(':scope > details')
    if (details) details.open = true
  }
  return (
    <p className="disagreement-pointer">
      {openHeading(what, rows.length)}:{' '}
      <a href={`#${FOLDED_ID}`} onClick={open}>
        {POINTER_LINK}
      </a>
      .
    </p>
  )
}

function Readings({ rows, what, folded, id }) {
  const explained = allExplained(rows)
  const heading = <h2>{explained ? explainedHeading(what) : openHeading(what, rows.length)}</h2>
  const body = (
    <>
      <dl>
        {rows.map((row) => (
          <div key={row.id}>
            <dt>{fieldLabel(row.field)}</dt>
            <dd>
              <p className="disagreement-pair num">
                <span>{row.stored_value}</span>
                <span className="disagreement-vs">against</span>
                <span>{row.derived_value}</span>
              </p>
              <p className="disagreement-why">
                <Dated>{row.assessment}</Dated>
              </p>
            </dd>
          </div>
        ))}
      </dl>
      {/* The invitation goes beside an OPEN row only. A reading explained as
          each side being right about something is not waiting for anybody, and
          asking a reader to settle it would misdescribe the row in front of
          them. These are the pages where a reader is likeliest to know
          something the database does not. */}
      <p className="source-note">
        {explained ? EXPLAINED_FOOTER : OPEN_FOOTER}
        <Link to="/data/quality">the quality page</Link>.
        {!explained && (
          <>
            {' '}
            {SETTLE_ASK}
            <a href={REPORT_URL}>{SETTLE_LINK}</a>.
          </>
        )}
      </p>
    </>
  )

  return (
    <aside className="disagreement" id={id} aria-label={explained ? 'Two readings, both recorded' : 'Recorded source disagreement'}>
      {folded ? (
        <Fold heading={heading}>{body}</Fold>
      ) : (
        <>
          {heading}
          {body}
        </>
      )}
    </aside>
  )
}

// Closed until it is opened, and open at the handover where the reader opened
// it on the static page (lib/handover.js), so nothing closes under them.
function Fold({ heading, children }) {
  const [open, setOpen] = useState(staticDisagreementsOpen)
  return (
    <details open={open} onToggle={(event) => setOpen(event.currentTarget.open)}>
      <summary>{heading}</summary>
      {children}
    </details>
  )
}
