#!/usr/bin/env node
/**
 * Stage the three files this app serves out of public/, and describe them.
 *
 *   f1.db.gz          the database, gzipped        ~4.7 MB   the normal path
 *   f1.db             the database, as built        ~20 MB   the fallback path
 *   sql-wasm.wasm     the SQLite engine            ~660 KB
 *   db-manifest.json  what the above are           ~200 B    fetched first
 *   SHA256SUMS        full digests of the above     ~300 B    shasum -c
 *   schema.sql        what the tables mean          ~92 KB   the three documents
 *   ATTRIBUTION.md    where the data came from      ~15 KB   that explain the above
 *   LICENSE-DATA      what you may do with it        ~4 KB
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

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex')

/*
 * SHA256SUMS, for the files this script stages.
 *
 * /data showed a short digest and then told the reader the full ones "ship as
 * SHA256SUMS with each release". Following that instruction returned FAILED:
 * the release's list digests the release's own copies, correctly, and the copy
 * served from here is rebuilt on every deploy and had moved eleven commits
 * past the tag while still calling itself the same version and build date
 * (SD-24). A verification instruction that fails for the honest reader is
 * worse than none, because it looks like tampering.
 *
 * Each file is digested as it is staged, so the list cannot describe a file
 * this run did not write. Deliberately free of comment lines and of any
 * header: `shasum -c SHA256SUMS` and `sha256sum -c SHA256SUMS` both warn on a
 * line they cannot parse, so what the list covers is said on /data, where the
 * reader is, and this file stays machine-readable.
 */
const sums = []
const digested = (name, bytes) => {
  sums.push([name, sha256(bytes)])
  return bytes
}

// ------------------------------------------------------------------ the database

const dbPath = join(repo, 'f1.db')
if (!existsSync(dbPath)) {
  die('f1.db not found at the repository root.\nBuild it first:  cd .. && python3 build.py')
}

mkdirSync(publicDir, { recursive: true })

const bytes = digested('f1.db', readFileSync(dbPath))
const fullDigest = sha256(bytes)
const digest = fullDigest.slice(0, 16)

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
  // Read back rather than recompressed: the staged file is the one served, so
  // it is the one the digest has to describe.
  gzipBytes = digested('f1.db.gz', readFileSync(gzPath)).length
  console.log(`  public/f1.db.gz          (${mb(gzipBytes)}, unchanged)`)
} else {
  const gz = digested('f1.db.gz', gzipSync(bytes, { level: 9 }))
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

// ------------------------------------------------------- the ODbL overlay
//
// The circuit centrelines are NOT in f1.db. OpenStreetMap is ODbL, which
// carries share-alike and a database right, so a database containing its data
// is a Derivative Database and must itself be published under ODbL - letting
// twenty-five centrelines set the licence of 117,000 rows. build.py writes
// them to f1-geometry.db instead, and the two files distributed side by side
// are a Collective Database, which ODbL does not treat as derivative.
//
// The worker fetches this and merges the rows into the database in memory, in
// the reader's own browser. It is 212 KB, so it is staged raw: gzipping it
// would save less than the extra request costs to reason about.
const geoPath = join(repo, 'f1-geometry.db')
let geometry = null
if (existsSync(geoPath)) {
  const geoBytes = digested('f1-geometry.db', readFileSync(geoPath))
  copyFileSync(geoPath, join(publicDir, 'f1-geometry.db'))
  geometry = {
    file: 'f1-geometry.db',
    bytes: geoBytes.length,
    digest: sha256(geoBytes).slice(0, 16),
    licence: 'ODbL-1.0',
    attribution: '© OpenStreetMap contributors',
  }
  console.log(`  public/f1-geometry.db    (${kb(geoBytes.length)}, ODbL overlay)`)
} else {
  console.log('  (no f1-geometry.db — track maps will be absent)')
}

// ------------------------------------------------------ the documents
//
// WHY THE SITE SERVES THESE AND NOT ONLY THE REPOSITORY
//     lapledger.org hands anyone 20 MB of data. The licence obligation travels
//     with that file, so the notice that states the terms has to be reachable
//     from where the file was taken - not from a repository the downloader has
//     no reason to open, and had no way to read at all until 2026-09-14.
//     f1-geometry.db's own `meta.apply` row and every release body already
//     name these paths; until now they named nothing a downloader could fetch.
//
// WHY IT IS FATAL RATHER THAN A WARNING
//     Every other attribution notice this project writes fails closed -
//     commons.js canShow() refuses an image without a credit, parquet_export.py
//     refuses ODbL rows, the build refuses an unclassified source. A missing
//     licence document is the same class of failure, and a deploy that quietly
//     drops it is the one shape this project has decided it will not ship.
//     These three are committed files at the repository root, so absence means
//     a renamed or truncated checkout, not an ordinary Monday.
for (const name of ['schema.sql', 'ATTRIBUTION.md', 'LICENSE-DATA']) {
  const from = join(repo, name)
  if (!existsSync(from)) {
    die(`${name} not found at the repository root.\nThe site serves it beside the data it explains; it cannot be published without it.`)
  }
  copyFileSync(from, join(publicDir, name))
  digested(name, readFileSync(from))
  console.log(`  public/${name.padEnd(22)} (${kb(statSync(from).size)})`)
}

// ----------------------------------------------------------------- the wasm

// A bundler resolves sql.js through its "browser" export condition, and that
// build asks for sql-wasm-browser.wasm. Copy that one, so the binary always
// matches the glue that will actually run, but land it at the single stable
// name the loader points locateFile at. Getting this wrong does not produce a
// 404 — a dev server answers an unknown path with index.html, and you get
// "expected magic word" from the wasm compiler instead.
//
// It is staged before the manifest is written because the manifest carries its
// digest too: the wasm is served immutable at a fixed path, so an upgrade to
// sql.js would otherwise leave a returning reader running new glue against a
// year-old binary. The loader puts this in the query string for the same
// reason it does for the database.
const wasm = ['sql-wasm-browser.wasm', 'sql-wasm.wasm']
  .map((name) => join(sqlJsDist, name))
  .find((path) => existsSync(path))

if (!wasm) die('sql.js not installed.\nInstall it first:  npm install')
const wasmBytes = digested('sql-wasm.wasm', readFileSync(wasm))
const wasmDigest = sha256(wasmBytes).slice(0, 16)
copyFileSync(wasm, join(publicDir, 'sql-wasm.wasm'))
console.log(`  public/sql-wasm.wasm     (${kb(wasmBytes.length)}, digest ${wasmDigest})`)

// ------------------------------------------------------------- the manifest

const manifest = {
  digest,
  // The whole digest as well as the short one. The short form is what a
  // person reads in a footer and what the cache keys on; a machine-readable
  // identifier that says `sha256:` and then gives sixteen of sixty-four hex
  // digits is claiming to be something it is not, and /data's JSON-LD is
  // read by machines (SD-24).
  sha256: fullDigest,
  bytes: bytes.length,
  gzipBytes,
  wasm: wasmDigest,
  version: meta.version ?? null,
  built: meta.built ?? null,
  staged: new Date().toISOString().slice(0, 10),
  geometry,
}
writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)
console.log(`  public/db-manifest.json  (v${manifest.version ?? '?'}, digest ${digest})`)

// ---------------------------------------------------------------- the digests

// In sha256sum's own format - hex, two spaces, the name a reader's download
// will have - so `shasum -c SHA256SUMS` works in the directory they fetched
// the files into. parquet-bundle.mjs appends f1-parquet.zip to this when it
// succeeds; it runs next in the chain, and it is the one staged file this
// script does not write.
writeFileSync(
  join(publicDir, 'SHA256SUMS'),
  sums.map(([name, hex]) => `${hex}  ${name}\n`).join(''),
)
console.log(`  public/SHA256SUMS        (${sums.length} files)`)

// ---------------------------------------------------------------- cache rules

/*
 * Caching, for hosts that read _headers (Cloudflare Pages, Netlify).
 *
 * The manifest is the one file that must never be served stale: it carries the
 * digest the loader compares against its cached copy, so a cached manifest
 * means a reader keeps an old database forever.
 *
 * Everything it describes is safe to cache hard, but only because of what the
 * loader does with these paths. f1.db, f1.db.gz and sql-wasm.wasm are served
 * under names that never change, so "immutable" would be a lie on its own —
 * and a deployment proved it, pairing a fresh manifest with a year-old
 * database out of a reader's cache. The loader appends the manifest's digest
 * to each of these as a query string, which is what makes the entry per build
 * rather than per path and the promise below true. Vite's asset names already
 * carry a content hash of their own.
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
    // Digests of files that are rewritten on every deploy, under a name that
    // does not change. A cached copy is a checksum list for a file the reader
    // no longer has, which reads as tampering rather than as staleness - so it
    // takes the manifest's rule and not the immutable one below. No extension,
    // like LICENSE-DATA, so the type is said here or the host guesses.
    '/SHA256SUMS',
    '  Cache-Control: no-cache',
    '  Content-Type: text/plain; charset=utf-8',
    '',
    '/f1.db',
    '  Cache-Control: public, max-age=31536000, immutable',
    '',
    '/f1.db.gz',
    '  Cache-Control: public, max-age=31536000, immutable',
    '',
    '/f1-geometry.db',
    '  Cache-Control: public, max-age=31536000, immutable',
    '',
    '/sql-wasm.wasm',
    '  Cache-Control: public, max-age=31536000, immutable',
    '',
    '/assets/*',
    '  Cache-Control: public, max-age=31536000, immutable',
    '',
    // The three documents are read, not downloaded. Left to the host, a host
    // guesses: LICENSE-DATA has no extension at all and .md is a type several
    // browsers save rather than show, so the licence a reader followed a link
    // to would land in their downloads folder unopened. They change with the
    // build and are not digest-addressed, so they take no immutable rule.
    // The feed's own media type. A .xml file is served as application/xml,
    // which every feed reader accepts, but atom+xml is what the rel="alternate"
    // link advertises and what a browser matches on when it offers to
    // subscribe. prerender.js writes the file; this says what it is.
    '/feed.xml',
    '  Content-Type: application/atom+xml; charset=utf-8',
    '',
    '/schema.sql',
    '  Content-Type: text/plain; charset=utf-8',
    '',
    '/ATTRIBUTION.md',
    '  Content-Type: text/plain; charset=utf-8',
    '',
    '/LICENSE-DATA',
    '  Content-Type: text/plain; charset=utf-8',
    '',
  ].join('\n'),
)
console.log('  public/_headers          (cache rules)')
