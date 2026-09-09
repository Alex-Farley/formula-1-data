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

function send(type, payload) {
  if (!worker) start()
  const id = nextId++
  return new Promise((resolve, reject) => {
    requests.set(id, { resolve, reject })
    worker.postMessage({ id, type, payload })
  })
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

/** Run a statement inside a transaction that is always rolled back. */
export async function queryReadOnly(sql, params = []) {
  await openDatabase()
  return send('readOnly', { sql, params })
}
