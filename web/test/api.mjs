/**
 * The JSON API's refusal, shown refusing what it exists to refuse (D-48).
 *
 * scripts/api.mjs publishes the rows of f1.db to any origin, and the f1.db
 * beside it can be a local copy the timing loaders or the geometry overlay
 * have written into. So it stops before writing anything, the way
 * tools/parquet_export.py does (review of #711). Each test copies f1.db,
 * plants ONE thing the refusal must catch, runs the script against the copy,
 * and asserts it exits non-zero and names the table. None of them reaches
 * the writing half, so dist/ is never touched.
 */
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { copyFileSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'

const web = join(dirname(fileURLToPath(import.meta.url)), '..')

const planted = (sql) => {
  const dir = mkdtempSync(join(tmpdir(), 'lapledger-api-'))
  const path = join(dir, 'f1.db')
  copyFileSync(join(web, '..', 'f1.db'), path)
  const db = new DatabaseSync(path)
  db.exec(sql)
  db.close()
  const run = spawnSync(process.execPath, [join(web, 'scripts', 'api.mjs')], {
    env: { ...process.env, LAPLEDGER_DB: path },
    encoding: 'utf8',
  })
  rmSync(dir, { recursive: true, force: true })
  return run
}

const refused = (run, table) => {
  assert.notEqual(run.status, 0, `api.mjs wrote a database carrying ${table}`)
  assert.match(run.stderr, /REFUSED/)
  assert.match(run.stderr, new RegExp(table))
}

describe('the JSON API refuses a database it may not publish', () => {
  it('a pit stop from Jolpica, as tools/ergast_load.py --timing writes one', () => {
    refused(planted("UPDATE pit_stops SET source = 'jolpica', source_id = 12 WHERE id = (SELECT MIN(id) FROM pit_stops)"), 'pit_stops')
  })

  it('a race entry citing a source that may not be passed on', () => {
    refused(planted('UPDATE race_entries SET source_id = 12 WHERE id = (SELECT MIN(id) FROM race_entries)'), 'race_entries')
  })

  it('a lap of FOM-owned timing', () => {
    refused(
      planted(
        "INSERT INTO laps (race_id, driver_key, lap_number, source) VALUES ((SELECT MIN(id) FROM races), 'x', 1, 'fastf1')",
      ),
      'laps',
    )
  })
})
