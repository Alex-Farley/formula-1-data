import { missing } from './format.js'

/**
 * One row per entity in a final championship table.
 *
 * `standings` holds a running table after every round plus a set of rows with
 * `after_round` NULL — the season as it finished. Those final rows are NOT one
 * per entity, for two different reasons, and only one of them is a duplicate:
 *
 * **Two sources describing the same result.** 2026 carries 46 final driver rows
 * for 23 drivers: formula1.com records the team but no position, F1DB records
 * the position but no team, and both agree on the points. Rendered naively that
 * lists every driver twice. These are collapsed — and because the two rows
 * assert the same points, taking the position from one and the team from the
 * other invents nothing neither source states.
 *
 * **An entity that genuinely finished the season twice.** Force India was
 * excluded from the 2018 constructors' championship with 0 points and its
 * successor scored 52 under the same id and engine. Both rows belong in that
 * table, and collapsing them would delete a fact.
 *
 * The points are what tell the two cases apart, so they are part of the group
 * key. Nothing here picks a winner between rows that disagree.
 */
export function finalStandings(rows) {
  const groups = new Map()

  for (const row of rows) {
    const key = `${row.year}|${row.entity_id}|${row.engine_id ?? ''}|${row.points}`
    const held = groups.get(key)
    if (!held) {
      groups.set(key, { ...row })
      continue
    }
    // Prefer the row that carries a classified position: this is a
    // classification, and a row without one cannot be placed in it.
    if (missing(held.position) && !missing(row.position)) {
      groups.set(key, { ...row, team: held.team ?? row.team })
    } else if (missing(held.team) && !missing(row.team)) {
      held.team = row.team
    }
  }

  return [...groups.values()].sort((a, b) => {
    // A position nobody established cannot be ordered against one that was.
    if (missing(a.position) && missing(b.position)) return (b.points ?? 0) - (a.points ?? 0)
    if (missing(a.position)) return 1
    if (missing(b.position)) return -1
    return a.position - b.position
  })
}
