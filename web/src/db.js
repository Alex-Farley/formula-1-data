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
 * Reject anything that is not a read.
 *
 * This is a guard rail, not a security boundary, and there is nothing here to
 * protect: the database is a copy in the visitor's own tab, thrown away on
 * reload. It exists so that a mistyped DELETE in the console gives a clear
 * message instead of silently emptying the table you are looking at.
 */
export function readOnlyComplaint(sql) {
  const stripped = sql
    .replace(/--[^\n]*/g, ' ')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .trim()
  if (!stripped) return 'Nothing to run.'
  if (!/^(select|with|explain|pragma)\b/i.test(stripped)) {
    return 'Only SELECT, WITH, EXPLAIN and PRAGMA are run here. The database is a copy in your browser, but an accidental write would still change what you are looking at until you reload.'
  }
  return null
}
