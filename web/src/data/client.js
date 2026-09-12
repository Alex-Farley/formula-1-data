/**
 * The main thread's side of the worker.
 *
 * One worker, one connection, promise-per-request. Everything the app knows
 * about the database goes through here, which is why the SQL console is not a
 * special case: it takes the same path every page takes.
 */
const requests = new Map()
let nextId = 1
let worker = null

/** { phase, loaded, total } — what the boot screen renders. */
let progress = { phase: 'idle' }
const listeners = new Set()

function announce(next) {
  progress = next
  for (const listener of listeners) listener(progress)
}

export function onProgress(listener) {
  listeners.add(listener)
  listener(progress)
  return () => listeners.delete(listener)
}

export const currentProgress = () => progress

function start() {
  worker = new Worker(new URL('./worker.js', import.meta.url), {
    type: 'module',
    name: 'f1-sqlite',
  })
  worker.onmessage = ({ data }) => {
    if (data.type === 'progress') {
      // Once the page is up, a loading phase cannot take it down again. The
      // worker a cancel() replaces reports 'checking' and 'starting' as it
      // opens, and Boot unmounts every route for anything but 'ready' - so
      // the console remounted, re-ran its opening query and lost the reader's
      // text, which is how the first cut of cancel failed its own test. Only
      // 'failed' may follow 'ready'; retryOpen() resets the phase itself.
      if (progress.phase === 'ready' && data.phase !== 'failed') return
      announce(data)
      return
    }
    const pending = requests.get(data.id)
    if (!pending) return
    requests.delete(data.id)
    if (data.ok) pending.resolve(data.result)
    else pending.reject(new Error(data.error.message))
  }
  worker.onerror = (event) => {
    const error = new Error(event.message || 'the database worker failed to start')
    announce({ phase: 'failed', error: error.message })
    for (const pending of requests.values()) pending.reject(error)
    requests.clear()
  }
}

function send(type, payload, signal) {
  if (!worker) start()
  const id = nextId++
  return new Promise((resolve, reject) => {
    requests.set(id, { type, payload, resolve, reject })
    worker.postMessage({ id, type, payload })
    if (signal) {
      if (signal.aborted) cancel(id)
      else signal.addEventListener('abort', () => cancel(id), { once: true })
    }
  })
}

/**
 * Abandon one request by replacing the worker it is stuck in.
 *
 * sql.js runs a statement to completion on the worker's only thread, so a
 * three-way self-join typed into the console held the one connection every
 * page shares, for the rest of the session, with no way out but a reload
 * nobody was told to attempt. There is no interrupt: the only way to stop a
 * statement is to terminate the worker. So that is what this does - and then
 * opens a fresh one (from IndexedDB, well under a second on a second visit)
 * and re-sends every PAGE QUERY that was waiting behind the runaway, so the
 * pages that were mid-query fill in as if nothing had happened.
 *
 * Console statements are never re-sent - not even the ones that were not the
 * victim. The review of the first cut found why: with two console statements
 * in flight, cancelling the second replayed the first, and the first was the
 * runaway. So every waiting readOnly request is rejected with the same
 * AbortError, and the console runs one statement at a time.
 */
const aborted = () => {
  const error = new Error('Cancelled. The statement was stopped and the connection reopened.')
  error.name = 'AbortError'
  return error
}

function cancel(id) {
  const victim = requests.get(id)
  if (!victim) return
  requests.delete(id)
  const survivors = []
  const dropped = []
  for (const [rid, r] of requests) {
    if (r.type === 'query') survivors.push([rid, r])
    else if (r.type !== 'open') dropped.push(r)
  }
  requests.clear()
  worker?.terminate?.()
  worker = null
  opened = null
  // openDatabase() starts the new worker and posts 'open' first, which the
  // worker needs before anything else; the replays queue behind it.
  openDatabase().catch(() => {})
  for (const [rid, r] of survivors) {
    requests.set(rid, r)
    worker.postMessage({ id: rid, type: r.type, payload: r.payload })
  }
  for (const r of dropped) r.reject(aborted())
  victim.reject(aborted())
}

let opened = null

/**
 * Open the database, once. Resolves to the manifest — version, build date,
 * size, and whether the bytes came from the cache — which the footer shows so
 * the page can never claim a version the file it loaded does not have.
 *
 * The asset base is computed here rather than in the worker: after bundling,
 * the worker's own URL is somewhere under assets/, while the four served files
 * sit at the site root.
 *
 * NOT document.baseURI. That was right under a hash router, where every page
 * was served from the one index.html at the root. Under real paths it is the
 * directory of whatever route the reader landed on, so /drivers/hamilton would
 * ask for /drivers/f1.db and get a 404 on a deep link — a bug that never shows
 * on the home page. BASE_URL is the deploy's root, which is what these four
 * files are actually relative to.
 */
export function openDatabase() {
  if (!opened) {
    opened = send('open', { base: new URL(import.meta.env.BASE_URL, location.origin).href })
      .then((manifest) => {
        announce({ phase: 'ready', manifest })
        return manifest
      })
      .catch((error) => {
        announce({ phase: 'failed', error: error.message })
        throw error
      })
  }
  return opened
}

/**
 * Try again after a failure. openDatabase() caches its promise so that every
 * caller shares one open; a failed open was cached too, so a reader whose
 * train came out of the tunnel had no way back but a reload nobody told them
 * to attempt. A dead worker is dropped as well, since start() recreates it.
 */
export function retryOpen() {
  if (currentProgress().phase !== 'failed') return openDatabase()
  opened = null
  worker?.terminate?.()
  worker = null
  announce({ phase: 'idle' })
  return openDatabase()
}

/** Run one statement. Resolves to { columns, rows }, rows as plain objects. */
export async function query(sql, params = []) {
  await openDatabase()
  return send('query', { sql, params })
}

/** The first row of a query, or null. */
export async function first(sql, params = []) {
  const { rows } = await query(sql, params)
  return rows[0] ?? null
}

/**
 * Run a statement inside a transaction that is always rolled back.
 *
 * An AbortSignal cancels it: see cancel() for what that costs and why it is
 * the only way.
 */
export async function queryReadOnly(sql, params = [], { signal } = {}) {
  await openDatabase()
  return send('readOnly', { sql, params }, signal)
}
