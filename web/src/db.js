/**
 * The database, in the browser.
 *
 * f1.db is 1.6 MB, so it is fetched whole and handed to SQLite compiled to
 * WebAssembly. There is no server and no API: every query on every page is
 * real SQL running against the same file `./f1 sql` runs against. That is why
 * the console page can offer arbitrary SELECTs — it is not a special feature,
 * it is the same path everything else uses.
 */
import initSqlJs from 'sql.js'

let dbPromise = null

async function open() {
  // Both files sit next to index.html. Resolving against document.baseURI
  // rather than a root-absolute path keeps this working when the app is
  // served from a subdirectory.
  //
  // locateFile ignores the name it is given on purpose. sql.js ships several
  // glue builds and they ask for different filenames - the browser build,
  // which is the one a bundler resolves through the package's "browser"
  // export condition, asks for sql-wasm-browser.wasm. The binaries are
  // identical, so scripts/copy-assets.js puts one of them at a single known
  // name and this points every request at it. Asking for the name emscripten
  // happens to want would break the moment the resolved build changed, and it
  // would break as a wasm compile error rather than a 404, because a dev
  // server answers an unknown path with index.html.
  const [SQL, buffer] = await Promise.all([
    initSqlJs({ locateFile: () => new URL('sql-wasm.wasm', document.baseURI).href }),
    fetch(new URL('f1.db', document.baseURI)).then((r) => {
      if (!r.ok) throw new Error(`could not load f1.db — ${r.status} ${r.statusText}`)
      return r.arrayBuffer()
    }),
  ])
  return new SQL.Database(new Uint8Array(buffer))
}

/** The shared connection. Opened once, on first query. */
export function getDatabase() {
  if (!dbPromise) dbPromise = open()
  return dbPromise
}

/**
 * Run one statement. Returns { columns, rows } with rows as plain objects,
 * which is what every table in this app renders.
 */
export async function run(sql, params = []) {
  const db = await getDatabase()
  const stmt = db.prepare(sql)
  try {
    // Column names are known at prepare time, so an empty result still knows
    // its shape and the table still renders its header.
    const columns = stmt.getColumnNames()
    stmt.bind(params)
    const rows = []
    while (stmt.step()) rows.push(stmt.getAsObject())
    return { columns, rows }
  } finally {
    stmt.free()
  }
}

/** The first row of a query, or null. */
export async function first(sql, params = []) {
  const { rows } = await run(sql, params)
  return rows[0] ?? null
}

/**
 * Run a statement and undo anything it changed.
 *
 * This — not the prefix check below — is what actually keeps the console from
 * altering the database. A statement cannot be classified as a read by looking
 * at its first word: SQLite accepts a WITH clause in front of DELETE, INSERT
 * and UPDATE too, so
 *
 *     WITH t AS (SELECT 1) DELETE FROM drivers
 *
 * begins with WITH and empties the table. Rather than chase that with a
 * cleverer pattern — which then rejects an honest `WHERE note LIKE '%delete%'`
 * — wrap the statement in a transaction and roll it back. Whatever it turns
 * out to be, the copy in this tab is the same afterwards as before.
 */
export async function runReadOnly(sql, params = []) {
  const db = await getDatabase()
  db.exec('BEGIN')
  try {
    return await run(sql, params)
  } finally {
    db.exec('ROLLBACK')
  }
}

/**
 * A clear message for an obvious mistake.
 *
 * A courtesy, not the guarantee — runReadOnly above is the guarantee. This
 * only catches the common case early so the reader gets an explanation rather
 * than an empty result.
 */
export function readOnlyComplaint(sql) {
  const stripped = sql
    .replace(/--[^\n]*/g, ' ')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .trim()
  if (!stripped) return 'Nothing to run.'
  if (!/^(select|with|explain|pragma)\b/i.test(stripped)) {
    return 'Only SELECT, WITH, EXPLAIN and PRAGMA are run here. The database is a copy in your browser, and anything that does change it is rolled back — but a write is not what you meant to type.'
  }
  return null
}
