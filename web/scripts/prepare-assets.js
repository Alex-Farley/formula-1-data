#!/usr/bin/env node
/**
 * Stage the three files this app serves out of public/, and describe them.
 *
 *   f1.db.gz          the database, gzipped        ~4.7 MB   the normal path
 *   f1.db             the database, as built        ~20 MB   the fallback path
 *   sql-wasm.wasm     the SQLite engine            ~660 KB
 *   db-manifest.json  what the above are           ~200 B    fetched first
 *
 * WHY A MANIFEST
 *     The database is now twenty megabytes. Downloading that on every visit is
 *     the single worst thing this front end can do to a reader, so the loader
 *     keeps the bytes in IndexedDB and only downloads when they have changed.
 *     "Changed" has to be answerable BEFORE the download, which is what this
 *     file is for: it carries a digest of f1.db, and it is small enough that
 *     fetching it on every load costs nothing. The digest is the cache key.
 *
 *     A Last-Modified or ETag would nearly do, but not quite — they are the
 *     host's opinion of the file, they differ between hosts, and a rebuild
 *     that produces identical bytes should not evict a warm cache. A content
 *     digest is a property of the data itself and behaves the same everywhere.
 *
 * WHY BOTH .gz AND THE RAW FILE
 *     Static hosts do not agree on whether they will compress an unknown
 *     binary type, and several will not. Shipping the gzip ourselves makes the
 *     4.7 MB transfer a property of this repository rather than of whoever is
 *     serving it. The raw file stays as the fallback for a browser without
 *     DecompressionStream, and costs nothing to a reader who never fetches it.
 *
 * Nothing here is committed. f1.db is a build artefact of build.py at the
 * repository root, and the wasm comes back with npm install; a second copy of
 * either in git is a copy that can drift.
 */
import { copyFileSync, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { gzipSync } from 'node:zlib'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const web = join(here, '..')
const repo = join(web, '..')
const publicDir = join(web, 'public')
const sqlJsDist = join(web, 'node_modules', 'sql.js', 'dist')

const die = (message) => {
  console.error(`\n${message}\n`)
  process.exit(1)
}

const kb = (bytes) => `${(bytes / 1024).toFixed(0)} KB`
const mb = (bytes) => `${(bytes / 1024 / 1024).toFixed(1)} MB`

// ------------------------------------------------------------------ the database

const dbPath = join(repo, 'f1.db')
if (!existsSync(dbPath)) {
  die('f1.db not found at the repository root.\nBuild it first:  cd .. && python3 build.py')
}

mkdirSync(publicDir, { recursive: true })

const bytes = readFileSync(dbPath)
const digest = createHash('sha256').update(bytes).digest('hex').slice(0, 16)

// A rebuild that changed nothing should not cost every reader a 4.7 MB
// download, and gzipping twenty megabytes at level 9 is the slow part of this
// script. If the staged copy already matches the digest, leave it alone.
const manifestPath = join(publicDir, 'db-manifest.json')
const gzPath = join(publicDir, 'f1.db.gz')
let previous = null
try {
  previous = JSON.parse(readFileSync(manifestPath, 'utf8'))
} catch {
  previous = null
}

let gzipBytes
if (previous?.digest === digest && existsSync(gzPath)) {
  gzipBytes = statSync(gzPath).size
  console.log(`  public/f1.db.gz          (${mb(gzipBytes)}, unchanged)`)
} else {
  const gz = gzipSync(bytes, { level: 9 })
  writeFileSync(gzPath, gz)
  gzipBytes = gz.length
  console.log(`  public/f1.db.gz          (${mb(gzipBytes)})`)
}

copyFileSync(dbPath, join(publicDir, 'f1.db'))
console.log(`  public/f1.db             (${mb(bytes.length)}, fallback)`)

// The version and build date come out of the database's own meta table rather
// than being restated here, so the footer can never claim a version the file
// it is serving does not have. node:sqlite is used read-only and closed before
// anything else touches the file.
let meta = {}
try {
  const { DatabaseSync } = await import('node:sqlite')
  const db = new DatabaseSync(dbPath, { readOnly: true })
  for (const row of db.prepare('SELECT key, value FROM meta').all()) meta[row.key] = row.value
  db.close()
} catch (error) {
  // Not fatal: the app renders without a version string, and this script must
  // not become the reason a build fails on a Node without node:sqlite.
  console.log(`  (could not read meta: ${error.message})`)
}

const manifest = {
  digest,
  bytes: bytes.length,
  gzipBytes,
  version: meta.version ?? null,
  built: meta.built ?? null,
  staged: new Date().toISOString().slice(0, 10),
}
writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)
console.log(`  public/db-manifest.json  (v${manifest.version ?? '?'}, digest ${digest})`)

// ----------------------------------------------------------------- the wasm

// A bundler resolves sql.js through its "browser" export condition, and that
// build asks for sql-wasm-browser.wasm. Copy that one, so the binary always
// matches the glue that will actually run, but land it at the single stable
// name the loader points locateFile at. Getting this wrong does not produce a
// 404 — a dev server answers an unknown path with index.html, and you get
// "expected magic word" from the wasm compiler instead.
const wasm = ['sql-wasm-browser.wasm', 'sql-wasm.wasm']
  .map((name) => join(sqlJsDist, name))
  .find((path) => existsSync(path))

if (!wasm) die('sql.js not installed.\nInstall it first:  npm install')
copyFileSync(wasm, join(publicDir, 'sql-wasm.wasm'))
console.log(`  public/sql-wasm.wasm     (${kb(statSync(wasm).size)})`)

// ---------------------------------------------------------------- cache rules

/*
 * Caching, for hosts that read _headers (Cloudflare Pages, Netlify).
 *
 * The manifest is the one file that must never be served stale: it carries the
 * digest the loader compares against its cached copy, so a cached manifest
 * means a reader keeps an old database forever. Everything it describes is
 * safe to cache hard — the database only changes with its digest, and Vite's
 * asset names already carry a content hash.
 *
 * A host that ignores this file is not broken by it. The loader also asks for
 * the manifest with cache: 'no-cache' itself, so the rule is a belt to that
 * brace rather than the only thing standing between a reader and stale data.
 */
writeFileSync(
  join(publicDir, '_headers'),
  [
    '/db-manifest.json',
    '  Cache-Control: no-cache',
    '',
    '/f1.db',
    '  Cache-Control: public, max-age=31536000, immutable',
    '',
    '/f1.db.gz',
    '  Cache-Control: public, max-age=31536000, immutable',
    '',
    '/sql-wasm.wasm',
    '  Cache-Control: public, max-age=31536000, immutable',
    '',
    '/assets/*',
    '  Cache-Control: public, max-age=31536000, immutable',
    '',
  ].join('\n'),
)
console.log('  public/_headers          (cache rules)')
