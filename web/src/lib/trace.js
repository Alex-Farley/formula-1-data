/**
 * The words the site uses about the OpenStreetMap trace.
 *
 * AF-23 settled which drawing leads: F1DB's outline is the picture of a
 * circuit — every layout the championship raced, for 79 of the 80 venues,
 * CC BY 4.0 — and the trace is the one thing an outline cannot carry. An
 * outline has no scale, no position and no direction; the trace is measured,
 * geo-referenced, and checked against the length this register publishes. So
 * the trace is stated rather than drawn on a stage of its own, and these are
 * the words it is stated in, shared by the register and the circuit page —
 * the app's and the one scripts/prerender.js writes (CR-33), so the two halves
 * of a circuit page cannot state the trace differently. It was once drawn
 * over a circuit's aerial photograph (AF-96); F1DB's outline is drawn there
 * now (AF-177, photoOutline in lib/outline.js).
 *
 * The ODbL credit travels with the figures exactly as it travelled with the
 * line: a measurement taken from an ODbL database is as much that database's
 * as a drawing of it was, which is the same reading that keeps the
 * centrelines in f1-geometry.db rather than in f1.db.
 */

import { number } from './format.js'

/** © OpenStreetMap contributors, and the licence the row itself states. */
export const odblCredit = (licence) => `\u00a9 OpenStreetMap contributors, ${licence || 'ODbL 1.0'}.`

export const ODBL_CREDIT = odblCredit()

/**
 * "6.004 km against 6.003 km published here (+0.01%)": what a trace measured,
 * against the length this register publishes, or null where it has not got
 * both. The circuit's page states it under "Measured", and the season page's
 * next round states it in a sentence (PD-49); one wording, so the figure a
 * reader meets on the way to a circuit is the one they meet when they arrive.
 */
export const measured = (geometry) => {
  const { delta_pct: delta, measured_km: km, published_km: published } = geometry
  if (km === null || km === undefined || published === null || published === undefined) return null
  return `${km.toFixed(3)} km against ${published.toFixed(3)} km published here${
    delta === null || delta === undefined ? '' : ` (${delta > 0 ? '+' : ''}${delta.toFixed(2)}%)`
  }`
}

/** The heading of the trace's section on a circuit's own page. */
export const TRACE_HEADING = 'Traced and measured'

/**
 * Under the trace's figures on a circuit's own page. True of both halves:
 * the browser reads the figures from the file once it has merged it in, and
 * the static page was written from the same file (CR-33).
 */
export const TRACE_RULE =
  'Traced from OpenStreetMap and measured against the length this register publishes. The ' +
  'centrelines ship as a separate file under ODbL, and these figures are read from it. ' +
  'F1DB\u2019s outlines are the drawing of this circuit; the trace is what they cannot carry.'

/**
 * What the trace measures, as the label and words of each field: the
 * circuit page's <Fields> in the app and fields() in scripts/prerender.js
 * both print this list, so neither can carry a figure the other lacks. A
 * field with an `href` is a link to it. `value` is null where the figure is
 * not established, which both halves print as the em dash.
 *
 * AF-23 demoted the trace from a drawing to these facts: the outlines are
 * the picture of a circuit, and the trace is the thing they cannot be — a
 * length taken off the map and checked against the one this register
 * publishes, which is the only independent check the traced circuits have on
 * their own stated length. `closes` is the build's verdict on the walk, not
 * a fresh stitch at render time: build.py decides it when the row is admitted
 * and verify.py re-derives it on every build.
 */
export const traceFields = (geometry, direction) =>
  [
    {
      label: 'OpenStreetMap relation',
      value: String(geometry.osm_relation),
      href: `https://www.openstreetmap.org/relation/${geometry.osm_relation}`,
    },
    geometry.layout_key ? { label: 'Layout traced', value: geometry.layout_key } : null,
    { label: 'Measured', value: measured(geometry) },
    { label: 'Points', value: number(geometry.node_count) },
    {
      // build.py sums every way in the relation, whether or not they walk
      // into a ring, so a trace with a hole still has an honest length — it
      // is just not a lap. Las Vegas measures within 2 % of its published
      // length and is still missing a way.
      label: 'The walk',
      // build.py writes 0 or 1 and the column is not NOT NULL, so the
      // absence of a verdict is a third state and reads as one.
      value:
        geometry.closes === null || geometry.closes === undefined
          ? null
          : geometry.closes
            ? 'closes into one lap'
            : `does not close \u2014 ${number(geometry.loose_ends)} loose way ${
                geometry.loose_ends === 1 ? 'end' : 'ends'
              }, so the length above is the ways added up rather than a lap walked round`,
    },
    direction ? { label: 'Raced', value: direction } : null,
  ].filter(Boolean)

/**
 * Above the traced circuits on the register. The licence comes from the rows
 * being shown, the same way the circuit page takes it from the row it prints,
 * so one page cannot end up naming it differently from the other.
 */
export const traceRegisterNote = (licence) =>
  `What each traced centreline measures, against the length this register publishes. A circuit\u2019s ` +
  `shape is drawn on its own page, from F1DB\u2019s outlines; the trace is the measurement beside it. ${odblCredit(licence)}`

/**
 * IX-31: a circuit with no trace and a trace that did not arrive rendered
 * identically — no figure, no section, no message — and the register read
 * "0 of 80", which is a claim about the database made when what happened was
 * a network failure. Which of these is shown is chosen from whether the
 * overlay merged at all, never from this circuit's own rows.
 */
export const TRACE_COLUMN_UNKNOWN =
  'Traced cannot be answered while the centreline file is missing: every circuit below reads as ' +
  'unestablished, which is what an em dash means here \u2014 not as a circuit without a trace.'

export const TRACE_NOT_LOADED =
  'The centreline file did not load, so nothing traced is shown \u2014 here or anywhere else on the site. ' +
  'That is a file that did not arrive, not a circuit without a trace.'

/**
 * The coverage figure is counted from the database on the page that prints
 * it, never written into the sentence, and the sentence drops it rather than
 * inventing one when the count is not in hand.
 */
const ONLY_WHERE = 'a trace exists only where an OpenStreetMap relation could be matched to a layout on the ground today.'

export const noTrace = (traced, circuits) =>
  traced && circuits
    ? `No traced centreline for this circuit. ${traced} of the ${circuits} have one: ${ONLY_WHERE}`
    : `No traced centreline for this circuit: ${ONLY_WHERE}`
