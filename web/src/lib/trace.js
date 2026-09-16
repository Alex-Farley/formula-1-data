/**
 * The words the site uses about the OpenStreetMap trace.
 *
 * AF-23 settled which drawing leads: F1DB's outline is the picture of a
 * circuit — every layout the championship raced, for 79 of the 80 venues,
 * CC BY 4.0 — and the trace is the one thing an outline cannot carry. An
 * outline has no scale, no position and no direction; the trace is measured,
 * geo-referenced, and checked against the length this register publishes. So
 * the trace is stated rather than drawn, and these are the words it is stated
 * in, shared by the register and the circuit page.
 *
 * The ODbL credit travels with the figures exactly as it travelled with the
 * line: a measurement taken from an ODbL database is as much that database's
 * as a drawing of it was, which is the same reading that keeps the
 * centrelines in f1-geometry.db rather than in f1.db.
 */

/** © OpenStreetMap contributors, and the licence the row itself states. */
export const odblCredit = (licence) => `\u00a9 OpenStreetMap contributors, ${licence || 'ODbL 1.0'}.`

export const ODBL_CREDIT = odblCredit()

/** Under the trace's figures on a circuit's own page. */
export const TRACE_RULE =
  'Traced from OpenStreetMap and measured against the length this register publishes. The ' +
  'centrelines ship as a separate file under ODbL, which your browser merged in to read these ' +
  'figures. F1DB\u2019s outlines are the drawing of this circuit; the trace is what they cannot carry.'

/** Above the traced circuits on the register. */
export const TRACE_REGISTER_NOTE =
  `What each traced centreline measures, against the length this register publishes. A circuit\u2019s ` +
  `shape is drawn on its own page, from F1DB\u2019s outlines; the trace is the measurement beside it. ${ODBL_CREDIT}`

/**
 * IX-31: a circuit with no trace and a trace that did not arrive rendered
 * identically — no figure, no section, no message — and the register read
 * "0 of 80", which is a claim about the database made when what happened was
 * a network failure. Which of these is shown is chosen from whether the
 * overlay merged at all, never from this circuit's own rows.
 */
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
