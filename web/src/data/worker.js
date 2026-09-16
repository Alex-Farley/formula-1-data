/**
 * SQLite, off the main thread.
 *
 * WHY A WORKER
 *     The database is twenty megabytes of bytes to decompress and a wasm
 *     module to instantiate before the first query, and then a query over
 *     27,460 race entries has to run somewhere. On the main thread all of that
 *     is time the page cannot paint, scroll or respond to a keystroke. In a
 *     worker it is time the page spends drawing a progress bar.
 *
 * The protocol is a request id and a type. Every reply carries the id it
 * answers; progress is the one message sent unprompted.
 */
import initSqlJs from 'sql.js'
import { read, write } from './cache.js'

let database = null
let opening = null
/** The sql.js module, once started — the overlay needs it too. */
let SQL = null
/** Where f1.db.gz, f1.db, sql-wasm.wasm and db-manifest.json are served from. */
let assetBase = null

/**
 * A URL for one of the four files this app serves.
 *
 * WHY THE VERSION
 *     f1.db.gz, f1.db and sql-wasm.wasm are served immutable for a year,
 *     because re-downloading twenty megabytes a reader already has is the
 *     worst thing this front end can do to them. But their paths never
 *     change, and "immutable" at a path that can change its contents is a
 *     promise the deploy cannot keep: the manifest is fetched no-cache and so
 *     is always this build's, while the database beside it may still be last
 *     build's, held in a cache that was told not to ask again until next year.
 *     That pairing is exactly what the length check in load() reports, and it
 *     took a deployment to find.
 *
 *     So the digest travels in the query string. A build that changes the
 *     bytes changes the URL, which makes the year-long entry per build rather
 *     than per path — the caching stays, the staleness goes.
 */
const asset = (name, version) => {
  const url = new URL(name, assetBase)
  if (version) url.searchParams.set('v', version)
  return url.href
}

/**
 * Fetch, and fail with a message that names the file.
 *
 * A bare fetch rejection is "Failed to fetch" and nothing else — no URL, no
 * status. Four different files are fetched here, and the difference between
 * "the database is not deployed" and "the wasm is not deployed" is the whole
 * of the diagnosis, so it is worth the wrapper.
 */
async function get(name, init, version) {
  const url = asset(name, version)
  let response
  try {
    response = await fetch(url, init)
  } catch (cause) {
    throw new Error(`could not reach ${url} — ${cause?.message ?? cause}`)
  }
  if (!response.ok) throw new Error(`${url} — ${response.status} ${response.statusText}`)
  return response
}

const post = (message) => self.postMessage(message)
const progress = (phase, detail = {}) => post({ type: 'progress', phase, ...detail })

// ------------------------------------------------------------------ loading

async function fetchManifest() {
  // Cache-busting is the point of the manifest, so the manifest itself must
  // not be served from cache. Everything it describes is content-addressed and
  // may be cached forever.
  const response = await get('db-manifest.json', { cache: 'no-cache' })
  return response.json()
}

/**
 * Read a response body, reporting bytes as they arrive.
 *
 * Content-Length is what makes a determinate progress bar possible and is
 * absent whenever the host applies its own transfer encoding, so the manifest's
 * figures stand in. `ceiling` is the larger of the two possible answers: a
 * server that decodes .gz transparently hands over the full twenty megabytes
 * under a Content-Length that described the compressed file, and a bar that
 * ran past 100% would be worse than one that simply rescales.
 */
async function drain(response, expected, ceiling, phase = 'downloading') {
  const declared = Number(response.headers.get('content-length')) || 0
  let total = declared || expected || 0
  const reader = response.body?.getReader()
  if (!reader) return new Uint8Array(await response.arrayBuffer())

  const chunks = []
  let loaded = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    chunks.push(value)
    loaded += value.length
    if (loaded > total) total = ceiling || 0
    progress(phase, { loaded, total })
  }

  const out = new Uint8Array(loaded)
  let at = 0
  for (const chunk of chunks) {
    out.set(chunk, at)
    at += chunk.length
  }
  return out
}

/** The two bytes every gzip member starts with. */
const isGzip = (bytes) => bytes.length > 2 && bytes[0] === 0x1f && bytes[1] === 0x8b

async function gunzip(bytes) {
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

async function download(manifest, init) {
  // The gzip is the normal path: 4.5 MB on the wire instead of 20 MB, shipped
  // as a file rather than left to whatever the host decides to compress.
  //
  // WHETHER IT ARRIVES COMPRESSED IS NOT OURS TO DECIDE. Plenty of servers —
  // Vite's own preview among them — serve a .gz with Content-Encoding: gzip,
  // and the browser then inflates it before this code ever sees it. Others
  // hand over the raw member. Handing already-inflated bytes to
  // DecompressionStream fails with a bare "Failed to fetch", which is a
  // miserable thing to debug in a deployment you do not control. So the bytes
  // are asked, not the headers: a gzip member starts 1f 8b, and a SQLite file
  // starts "SQLite format 3".
  if (typeof DecompressionStream === 'function') {
    const response = await get('f1.db.gz', init, manifest.digest)
    const bytes = await drain(response, manifest.gzipBytes, manifest.bytes)
    if (!isGzip(bytes)) return bytes
    progress('decompressing')
    return gunzip(bytes)
  }

  const response = await get('f1.db', init, manifest.digest)
  return drain(response, manifest.bytes, manifest.bytes)
}

/** Did the download come back a different size from the one promised? */
const short = (bytes, manifest) => Boolean(manifest.bytes) && bytes.length !== manifest.bytes

async function load() {
  progress('checking')
  const manifest = await fetchManifest()

  let bytes = await read(manifest.digest)
  const cached = bytes !== null
  if (!cached) {
    bytes = await download(manifest)
    // A truncated download opens as a corrupt database several queries later,
    // which reads as a broken site rather than a broken transfer. The manifest
    // knows how big the file is, so say so here instead.
    //
    // The other thing that looks like this is a stale cache: a reader holding
    // a previous build's database under this build's manifest. The version in
    // the asset URL is what stops that happening, but it cannot help a cache
    // that keys on the path alone, or one already poisoned before this code
    // shipped. So the first mismatch is not fatal — ask again, refusing every
    // cache on the way, and only then give up.
    if (short(bytes, manifest)) {
      bytes = await download(manifest, { cache: 'reload' })
    }
    if (short(bytes, manifest)) {
      throw new Error(
        `the database arrived incomplete — ${bytes.length.toLocaleString('en-GB')} bytes of ` +
          `${manifest.bytes.toLocaleString('en-GB')}. Something between here and the host is ` +
          `serving an old copy; a hard reload usually clears it.`,
      )
    }
    // Storing is not on the critical path — the reader can have the database
    // now and the cache can settle behind them.
    write(manifest.digest, bytes).catch(() => {})
  }

  progress('starting')
  // locateFile ignores the name it is given, on purpose. sql.js ships several
  // glue builds asking for different wasm filenames; prepare-assets.js lands
  // one binary at a single known name and this points every request there.
  SQL = await initSqlJs({ locateFile: () => asset('sql-wasm.wasm', manifest.wasm) }).catch((cause) => {
    throw new Error(
      `SQLite would not start from ${asset('sql-wasm.wasm', manifest.wasm)} — ${cause?.message ?? cause}`,
    )
  })
  database = new SQL.Database(bytes)
  const geometry = await mergeGeometry(manifest)

  return { ...manifest, cached, geometry }
}

/**
 * Merge the ODbL circuit centrelines into the database in memory.
 *
 * WHY THEY ARRIVE SEPARATELY
 *     OpenStreetMap is ODbL 1.0, which carries share-alike AND a database
 *     right. A database containing its data is a Derivative Database and must
 *     itself be published under ODbL — which would let twenty-five
 *     centrelines decide the licence of 117,000 rows they have nothing to do
 *     with. So f1.db contains none of it, and the centrelines are published
 *     as f1-geometry.db beside it. Two independent databases distributed side
 *     by side are a Collective Database, which ODbL explicitly does not treat
 *     as derivative.
 *
 *     Merging them here, in the reader's own browser, is what makes
 *     `SELECT * FROM circuit_geometry` and the two views over it work exactly
 *     as they did when the rows shipped inside f1.db. Nothing downstream of
 *     this function knows the difference.
 *
 * IT IS NOT FATAL. A missing or unreachable overlay costs the track maps and
 * nothing else: every other page queries a database that is already open. An
 * ODbL file failing to arrive must not take the site down with it.
 */
async function mergeGeometry(manifest) {
  if (!manifest.geometry?.file) return null
  try {
    const response = await get(manifest.geometry.file, undefined, manifest.geometry.digest)
    const overlay = new SQL.Database(new Uint8Array(await response.arrayBuffer()))
    try {
      // The column list is read from the overlay, never written out here.
      // A hardcoded one silently drops whatever the schema gains next, and a
      // copy that drops a column looks exactly like a copy that worked —
      // `segment_count`, `loose_ends` and `closes` arrived after this was
      // first written — the schema is what grows, so a hardcoded list would
      // have dropped them silently instead of carrying them here for
      // whatever reads them next.
      const columns = overlay
        .exec('SELECT name FROM pragma_table_info(\'circuit_geometry\')')[0]
        .values.map(([name]) => name)
      const names = columns.map((c) => `"${c}"`).join(', ')
      const statement = overlay.prepare('SELECT * FROM circuit_geometry')
      const insert = database.prepare(
        `INSERT OR REPLACE INTO circuit_geometry (${names})
         VALUES (${columns.map(() => '?').join(', ')})`,
      )
      let merged = 0
      try {
        while (statement.step()) {
          const row = statement.getAsObject()
          insert.run(columns.map((c) => row[c] ?? null))
          merged += 1
        }
      } finally {
        statement.free()
        insert.free()
      }
      // The manifest's description of the file travels with the count: /data
      // states the overlay's size and digest beside f1.db's, and read them
      // from here rather than fetching the manifest a second time.
      return { ...manifest.geometry, merged }
    } finally {
      overlay.close()
    }
  } catch (cause) {
    // Reported, not thrown. The reader loses the track maps, not the site.
    console.warn(`the circuit geometry overlay did not load — ${cause?.message ?? cause}`)
    return null
  }
}

// ------------------------------------------------------------------ querying

function query(sql, params) {
  const statement = database.prepare(sql)
  try {
    // Column names are known at prepare time, so an empty result still knows
    // its shape and a table still renders its header.
    const columns = statement.getColumnNames()
    if (params?.length) statement.bind(params)
    const rows = []
    while (statement.step()) rows.push(statement.getAsObject())
    return { columns, rows }
  } finally {
    statement.free()
  }
}

/**
 * Run a statement and undo whatever it did.
 *
 * This — not a check on the first word — is what keeps the console from
 * altering the database. A statement cannot be classified as a read by
 * looking at its opening keyword: SQLite accepts a WITH clause in front of
 * DELETE, so
 *
 *     WITH t AS (SELECT 1) DELETE FROM drivers
 *
 * begins with WITH and empties the table. Rather than chase that with a
 * cleverer pattern, which then rejects an honest WHERE note LIKE '%delete%',
 * wrap the statement and roll it back. Whatever it turns out to be, the copy
 * in this tab is the same afterwards as before.
 */
function queryReadOnly(sql, params) {
  database.exec('BEGIN')
  try {
    return query(sql, params)
  } finally {
    database.exec('ROLLBACK')
  }
}

// ------------------------------------------------------------------ protocol

const handlers = {
  async open({ base }) {
    assetBase = base
    if (!opening) opening = load()
    return opening
  },
  query: ({ sql, params }) => query(sql, params ?? []),
  readOnly: ({ sql, params }) => queryReadOnly(sql, params ?? []),
}

self.onmessage = async ({ data }) => {
  const { id, type, payload } = data
  try {
    const handler = handlers[type]
    if (!handler) throw new Error(`unknown request "${type}"`)
    if (type !== 'open' && !database) await opening
    post({ id, ok: true, result: await handler(payload ?? {}) })
  } catch (error) {
    // Error objects do not survive structuredClone with their message intact
    // across every engine; send the parts that matter.
    post({ id, ok: false, error: { message: String(error?.message ?? error) } })
  }
}
