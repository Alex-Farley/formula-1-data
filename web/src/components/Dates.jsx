import { Fragment } from 'react'
import { EMPTY, dateSegments, localDate, localRaceDates, localTime, missing } from '../lib/format.js'
import { raceDay } from '../lib/refresh.js'

/**
 * Dates as the app draws them (CD-57; docs/design-system.md section 5,
 * *Dates*): the reader's own format, in a <time> that keeps the ISO day.
 *
 * scripts/prerender.js writes the same elements in the house format -
 * "9 Mar 1997" - because a static file cannot know its reader; lib/format.js
 * says why an en-GB reader keeps that format here too. Nothing in this file
 * decides what a date says: the words come from lib/format.js, so the two
 * halves differ only in the locale they are written for.
 */

/** A missing date is "not established", as everywhere else: the em dash. */
const empty = <span className="empty">{EMPTY}</span>

/**
 * One day. `length` is 'short' ("9 Mar 1997") for a table, a tile or a
 * field, and 'long' ("9 March 1997") for a sentence. A value that is not a
 * whole ISO day is printed as it is held rather than guessed at.
 */
export function DateText({ iso, length = 'short' }) {
  if (missing(iso)) return empty
  const shown = localDate(iso, length)
  return shown === null ? String(iso) : <time dateTime={iso}>{shown}</time>
}

/**
 * One instant on one zone's clock - a session's start (CD-59): the reader's
 * own form, in a <time> that keeps the instant. A value that will not parse,
 * or a zone Intl does not know, is printed as it is held.
 */
export function TimeText({ iso, zone }) {
  if (missing(iso)) return empty
  const shown = localTime(iso, zone)
  return shown === null ? String(iso) : <time dateTime={iso}>{shown}</time>
}

/**
 * When a race was run: its weekend where one is stated, its day where not.
 * The <time> carries the race's local day (lib/refresh.js's raceDay), since
 * HTML has no machine form for a range.
 */
export function RaceDates({ race }) {
  const shown = localRaceDates(race)
  if (shown === null) return empty
  return <time dateTime={raceDay(race)}>{shown}</time>
}

/**
 * A sentence with ISO days in it - a citation, a source's note, a record's
 * derivation - with each day drawn as a <time> and the words left alone.
 * Anything that is not a string is passed through.
 */
export function Dated({ children, length = 'long' }) {
  if (typeof children !== 'string') return children ?? null
  const parts = dateSegments(children)
  if (parts.every((part) => typeof part === 'string')) return children
  // The pieces of one fixed string, in its order: the position is the key.
  return parts.map((part, i) =>
    typeof part === 'string' ? (
      // biome-ignore lint/suspicious/noArrayIndexKey: the pieces of one string, never reordered
      <Fragment key={i}>{part}</Fragment>
    ) : (
      // biome-ignore lint/suspicious/noArrayIndexKey: the pieces of one string, never reordered
      <time key={i} dateTime={part.iso}>
        {localDate(part.iso, length)}
      </time>
    ),
  )
}

/**
 * A declared table column's cell when the column holds dates (`date` on the
 * column): 'short' or 'long' for a column of ISO days, 'race' for a race
 * row's weekend, 'text' for a column of sentences with days inside them,
 * such as a record's derivation, and 'time' for an instant, which the
 * column's `at` names with its zone. DataTable reads it; scripts/prerender.js
 * has its twin.
 */
export function dateCell(column, row) {
  const value = row[column.key]
  if (column.date === 'time') {
    const { iso, zone } = column.at(row)
    return <TimeText iso={iso} zone={zone} />
  }
  if (column.date === 'race') return <RaceDates race={row} />
  if (column.date === 'text') return missing(value) ? empty : <Dated>{String(value)}</Dated>
  return <DateText iso={value} length={column.date} />
}
