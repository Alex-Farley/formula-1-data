#!/usr/bin/env node
/**
 * Copy the two binary assets this app serves into public/:
 *
 *   f1.db            the database, from the repository root
 *   sql-wasm.wasm    the SQLite engine, from the installed sql.js
 *
 * Neither is committed. f1.db is a build artefact of build.py and lives at the
 * repository root; duplicating it here would mean two copies in git that could
 * drift. The wasm belongs to sql.js and comes back with npm install. Both are
 * in .gitignore, and this runs before dev and before build so they are always
 * the current ones.
 */
import { copyFileSync, existsSync, mkdirSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const web = join(here, '..')
const repo = join(web, '..')
const publicDir = join(web, 'public')
const sqlJsDist = join(web, 'node_modules', 'sql.js', 'dist')

// A bundler resolves sql.js through its "browser" export condition, and that
// build asks for sql-wasm-browser.wasm. Copy that one, so the binary always
// matches the glue that will actually run, but land it at the single stable
// name db.js points locateFile at. The plain build is the fallback for a
// sql.js old enough not to ship a browser-specific one; as of 1.14 the two
// files are byte-identical anyway.
const wasm = ['sql-wasm-browser.wasm', 'sql-wasm.wasm']
  .map((name) => join(sqlJsDist, name))
  .find((path) => existsSync(path))

const assets = [
  {
    from: join(repo, 'f1.db'),
    to: join(publicDir, 'f1.db'),
    missing:
      'f1.db not found at the repository root.\n' +
      'Build it first:  cd .. && python3 build.py',
  },
  {
    from: wasm ?? join(sqlJsDist, 'sql-wasm.wasm'),
    to: join(publicDir, 'sql-wasm.wasm'),
    missing: 'sql.js not installed.\nInstall it first:  npm install',
  },
]

mkdirSync(publicDir, { recursive: true })

for (const { from, to, missing } of assets) {
  try {
    statSync(from)
  } catch {
    console.error(`\n${missing}\n`)
    process.exit(1)
  }
  copyFileSync(from, to)
  const kb = Math.round(statSync(to).size / 1024)
  console.log(`  public/${to.slice(publicDir.length + 1)}  (${kb} KB)`)
}
