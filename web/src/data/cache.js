/**
 * The database, kept between visits.
 *
 * Twenty megabytes is not a download to repeat. IndexedDB holds the decoded
 * bytes under the digest from db-manifest.json, so a second visit opens the
 * database from disk in a few hundred milliseconds and a rebuild — a new
 * digest — evicts the old copy on the way past.
 *
 * Every function here resolves rather than rejects when storage is
 * unavailable. Private windows, a browser with site data blocked, a quota
 * refusal on a small device: all of them mean "download it again", which is
 * slower but correct. A cache that can take the app down with it is worse
 * than no cache.
 */
const DB_NAME = 'f1-verified-facts'
const STORE = 'database'
const VERSION = 1

function open() {
  return new Promise((resolve) => {
    let request
    try {
      request = indexedDB.open(DB_NAME, VERSION)
    } catch {
      resolve(null)
      return
    }
    request.onupgradeneeded = () => {
      const idb = request.result
      if (!idb.objectStoreNames.contains(STORE)) idb.createObjectStore(STORE)
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => resolve(null)
    request.onblocked = () => resolve(null)
  })
}

function transact(idb, mode, work) {
  return new Promise((resolve) => {
    let tx
    try {
      tx = idb.transaction(STORE, mode)
    } catch {
      resolve(null)
      return
    }
    const request = work(tx.objectStore(STORE))
    tx.onabort = () => resolve(null)
    tx.onerror = () => resolve(null)
    if (!request) {
      tx.oncomplete = () => resolve(true)
      return
    }
    request.onsuccess = () => resolve(request.result ?? null)
    request.onerror = () => resolve(null)
  })
}

/** The stored bytes for this digest, or null. */
export async function read(digest) {
  const idb = await open()
  if (!idb) return null
  const value = await transact(idb, 'readonly', (store) => store.get(digest))
  idb.close()
  return value instanceof ArrayBuffer ? new Uint8Array(value) : null
}

/**
 * Store these bytes under this digest and drop every other entry.
 *
 * Clearing first is deliberate: only one build of the database is ever wanted,
 * and letting old copies accumulate would put a reader who visits across four
 * releases eighty megabytes into their quota.
 */
export async function write(digest, bytes) {
  const idb = await open()
  if (!idb) return
  await transact(idb, 'readwrite', (store) => {
    store.clear()
    // A copy, because the caller's view may be backed by a buffer that is
    // about to be transferred to SQLite.
    return store.put(bytes.slice().buffer, digest)
  })
  idb.close()
}
