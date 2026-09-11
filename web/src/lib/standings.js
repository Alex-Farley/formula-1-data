import { missing } from './format.js'

/**
 * One row per entity in a final championship table.
 *
 * `standings` holds a running table after every round plus a set of rows with
 * `after_round` NULL — the season as it finished. Those final rows are NOT one
 * per entity, for two different reasons, and only one of them is a duplicate:
 *
 * **Two sources describing the same season.** 2026 carries 46 final driver rows
 * for 23 drivers: formula1.com records the team but no position, F1DB records
 * the position but no team. Rendered naively that lists every driver twice.
 *
 * **An entity that genuinely finished the season twice.** Force India was
 * excluded from the 2018 constructors' championship with 0 points and its
 * successor scored 52 under the same id and engine. Both rows belong in that
 * table, and collapsing them would delete a fact.
 *
 * WHAT TELLS THEM APART
 *     Not the points. That was the first answer here and it was wrong: it held
 *     only while the two sources agreed on every number, and they stopped
 *     agreeing the moment one of them counted a race the other had not — which
 *     for a season still being run is most weeks. The moment they disagreed,
 *     every driver appeared twice again.
 *
 *     The source does tell them apart, and it does so by construction. Two rows
 *     from DIFFERENT sources are two descriptions of one thing. Two rows from
 *     the SAME source are two things that source is asserting separately —
 *     which is exactly the shape of 2018 Force India, both of whose rows come
 *     from F1DB.
 *
 * WHEN THE SOURCES DISAGREE ON THE NUMBER
 *     A source that has not yet recorded the most recent race reports fewer
 *     points than one that has; it is behind, never ahead, because points only
 *     accumulate. So the larger total is the more current one and is taken.
 *     This is only ever reached for a season in progress: for a finished season
 *     the sources agree, and if they ever did not, that is a discrepancy for
 *     the database to record rather than for this function to paper over.
 */
export function finalStandings(rows) {
  const groups = new Map()

  for (const row of rows) {
    // Identity, plus which source is asserting it. Two rows that differ only
    // in source are one entity; two from one source are two entries.
    const key = `${row.year}|${row.entity_id}|${row.engine_id ?? ''}|${row.points}|${row.source ?? ''}`
    const held = groups.get(key)
    if (!held) {
      groups.set(key, { ...row })
      continue
    }
    if (missing(held.position) && !missing(row.position)) {
      groups.set(key, { ...row, team: held.team ?? row.team, position_text: row.position_text ?? held.position_text })
    } else if (missing(held.team) && !missing(row.team)) {
      held.team = row.team
    }
  }

  // Now merge across sources: same entity, different source.
  //
  // The key deliberately does NOT include engine_id. One source records the
  // engine and the other leaves it null, so keying on it puts the two rows in
  // different buckets and every constructor comes back twice — Mercedes at 425
  // points from one source and 468 from the other, both claiming position 1.
  // Two rows from ONE source are still two entries; that is the check below,
  // and it is the only thing this fold has to get right.
  const merged = new Map()
  for (const row of groups.values()) {
    const key = `${row.year}|${row.entity_id}`
    const held = merged.get(key)
    if (!held) {
      merged.set(key, [row])
      continue
    }
    // Two entries from the same source are both real; anything else is the
    // same entity described twice and is folded into one row.
    if (held.some((r) => r.source === row.source)) held.push(row)
    else held[0] = fold(held[0], row)
  }

  return [...merged.values()]
    .flat()
    .sort((a, b) => {
      // A position nobody established cannot be ordered against one that was.
      if (missing(a.position) && missing(b.position)) return (b.points ?? 0) - (a.points ?? 0)
      if (missing(a.position)) return 1
      if (missing(b.position)) return -1
      return a.position - b.position
    })
}

/** One row from two descriptions of the same entity's season. */
function fold(a, b) {
  // The higher total is the source that has counted the most rounds. Equal
  // totals mean the sources agree and there is nothing to choose.
  const current = (b.points ?? 0) > (a.points ?? 0) ? b : a
  const other = current === a ? b : a
  return {
    ...current,
    // Position and team are each recorded by only one of the two sources, so
    // take whichever row actually has them rather than whichever won above.
    position: missing(current.position) ? other.position : current.position,
    position_text: missing(current.position_text) ? other.position_text : current.position_text,
    team: missing(current.team) ? other.team : current.team,
    engine_id: missing(current.engine_id) ? other.engine_id : current.engine_id,
  }
}
