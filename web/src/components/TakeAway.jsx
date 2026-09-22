import { useEffect, useRef, useState } from 'react'
import { currentProgress } from '../data/client.js'
import { fileName, toCsv, toTsv, writtenColumns } from '../lib/takeaway.js'

/**
 * The two ways a table leaves this site (IX-26).
 *
 * One component, rendered in the footer of every table DataTable draws — the
 * six registers, every entity page, the records, and the result of whatever a
 * reader types into the SQL console — because that is the whole site, and a
 * copy button on four pages is the version of this nobody can rely on.
 *
 * BOTH ACT ON THE WHOLE TABLE, NOT THE PAGE OF IT ON SCREEN. A register shows
 * 250 of 862 rows until the reader expands it, and a file holding whichever
 * 250 happened to be drawn is a file that lies about what it is. Where the two
 * differ the buttons say so in their own labels — "Copy all 862 as TSV" — so
 * the count is read before the click, not discovered afterwards in a
 * spreadsheet.
 *
 * Both are also lazy: the serialising happens in the handler, so a page of
 * seven tables costs nothing for the six nobody takes away.
 *
 * WHY A STATUS LINE RATHER THAN A BUTTON THAT CHANGES ITS WORDS. A copy
 * succeeds invisibly — the clipboard gives no sign — so something has to say
 * it worked. Swapping "Copy as TSV" for "Copied" renames the control a reader
 * has just focused, which is the one thing a button's label must not do under
 * their hands; a live region beside it is announced and seen without touching
 * the control. It is also where the failure goes: `navigator.clipboard` is
 * absent on an insecure origin and can be refused outright, and a button that
 * silently does nothing is worse than no button.
 */

/** Long enough to be read, short enough not to sit under the next table. */
const SAID_FOR = 6000

const count = (n) => n.toLocaleString('en-GB')

export default function TakeAway({ columns, rows, shown, name, fileLabel }) {
  const [said, setSaid] = useState(null)
  const timer = useRef(null)
  // A table can be unmounted by a filter keystroke between the copy and the
  // message clearing itself.
  useEffect(() => () => clearTimeout(timer.current), [])

  const say = (message) => {
    clearTimeout(timer.current)
    setSaid(message)
    timer.current = setTimeout(() => setSaid(null), SAID_FOR)
  }

  // Recomputed per click rather than memoised: it is the cheap half of the
  // work, and holding it would hold a copy of every row of every table on the
  // page for as long as the page is open.
  const written = () => writtenColumns(columns, rows)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(toTsv(written(), rows))
      say(`Copied ${count(rows.length)} rows.`)
    } catch {
      say('This browser would not give the page the clipboard. The CSV download still works.')
    }
  }

  const download = () => {
    const file = fileName(fileLabel ?? name, currentProgress().manifest?.version, 'csv')
    const url = URL.createObjectURL(
      new Blob([toCsv(written(), rows)], { type: 'text/csv;charset=utf-8' }),
    )
    const link = document.createElement('a')
    link.href = url
    link.download = file
    document.body.append(link)
    link.click()
    link.remove()
    // Not revoked in the same tick: Safari and Firefox have both been known to
    // cancel a download whose object URL went away before they read it.
    setTimeout(() => URL.revokeObjectURL(url), 1000)
    say(`Saving ${file}.`)
  }

  const whole = shown >= rows.length
  const all = whole ? '' : `all ${count(rows.length)} `

  /*
   * The table's name inside the accessible name, because /data/quality draws
   * seven tables and /races/<year>/<round> three, and a reader listing the
   * controls on one of those would otherwise be offered "Copy as TSV" seven
   * times over with nothing to tell them apart. The visible text stays the
   * whole first clause of it, so the accessible name still contains the label
   * a reader can see and say (2.5.3).
   */
  const named = (visible) => (name ? `${visible}, ${name}` : undefined)

  return (
    <>
      <button type="button" className="take copy" aria-label={named(`Copy ${all}as TSV`)} onClick={copy}>
        Copy {all}as TSV
      </button>
      <button type="button" className="take csv" aria-label={named(`Download ${all}as CSV`)} onClick={download}>
        Download {all}as CSV
      </button>
      {/* Always in the tree, empty when there is nothing to say: a live region
          added to the page at the moment it fills is not announced. */}
      <span className="take-said" role="status">
        {said}
      </span>
    </>
  )
}
