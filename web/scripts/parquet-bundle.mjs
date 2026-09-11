#!/usr/bin/env node
/**
 * Build the Parquet bundle into public/, so the site serves it from its own
 * domain at /f1-parquet.zip.
 *
 * WHY IT LIVES IN THE NPM CHAIN
 *     It was written three times into a deploy script at tools/, and three
 *     times produced nothing on the deployed site, because that script was
 *     never executed - the dashboard's build-command field said it ran and
 *     the build log said otherwise. That script is now gone. This chain -
 *     npm run build - demonstrably runs, because it is what puts f1.db.gz
 *     and db-manifest.json on the site.
 *
 *     A deploy step belongs where the evidence says the build goes, not
 *     where it reads most tidily.
 *
 * WHY IT NEVER FAILS THE BUILD
 *     A missing download is worth less than a working site, so pyarrow being
 *     unavailable must not stop a deploy. But non-fatal must not mean silent,
 *     which is the mistake that hid this for three rounds: the outcome is
 *     written to public/build-status.txt and served at /build-status.txt, so
 *     a failure is one fetch away from a diagnosis even where the build log
 *     cannot be read.
 */
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, writeFileSync, statSync, rmSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const web = dirname(dirname(fileURLToPath(import.meta.url)))
const repo = dirname(web)
const publicDir = join(web, 'public')
const zipPath = join(publicDir, 'f1-parquet.zip')
const outDir = join(repo, 'parquet')

const lines = []
const say = (s) => { lines.push(s); console.log(`  ${s}`) }

const CANDIDATES = ['python3', '/usr/bin/python3', 'python3.13', 'python3.12', 'python']

/** A python that can open a SQLite file — the asdf one on PATH may not. */
function python() {
  for (const c of CANDIDATES) {
    try {
      execFileSync(c, ['-c', 'import sqlite3'], { stdio: 'ignore' })
      return c
    } catch { /* try the next */ }
  }
  return null
}

/** A python that can install things. Not necessarily the same one. */
function pythonWithPip() {
  for (const c of CANDIDATES) {
    try {
      execFileSync(c, ['-m', 'pip', '--version'], { stdio: 'ignore' })
      return c
    } catch { /* try the next */ }
  }
  return null
}

/**
 * Get pyarrow importable by `py`, whatever this image is willing to allow.
 *
 * Cloudflare's build image has two pythons and NEITHER can do this alone:
 * the asdf 3.13 first on PATH has pip but no sqlite3, and /usr/bin/python3
 * 3.12 has sqlite3 but no pip ("No module named pip", which is what the
 * deployed status file finally reported). The database needs sqlite3 and
 * pyarrow needs installing, so the two have to be combined.
 *
 * In order: ask py's own pip; failing that bootstrap one with ensurepip;
 * failing that borrow another python's pip and install FOR py's version into
 * a directory, which is why --python-version and --only-binary matter -
 * pyarrow is a compiled wheel and a cp313 build will not import into 3.12.
 */
// Installing into somebody's Python is a deploy-image decision, not a
// laptop one: a JavaScript build step that ran pip on whoever typed
// `npm run build` was a surprise nobody asked for. The install branches run
// where a deploy or CI runs, or where the person has said so.
const MAY_INSTALL = Boolean(
  process.env.CI || process.env.CF_PAGES || process.env.WORKERS_CI || process.env.LAPLEDGER_PARQUET,
)

function ensurePyarrow(py) {
  try {
    execFileSync(py, ['-c', 'import pyarrow'], { stdio: 'ignore' })
    return { how: 'already present', env: {} }
  } catch { /* not there yet */ }

  if (!MAY_INSTALL) {
    throw new Error('pyarrow is not installed and this is not a deploy; set LAPLEDGER_PARQUET=1 to let this step install it')
  }

  try {
    execFileSync(py, ['-m', 'pip', 'install', '--quiet', 'pyarrow'], { stdio: 'pipe' })
    return { how: 'installed with its own pip', env: {} }
  } catch { /* no pip, or it refused */ }

  try {
    execFileSync(py, ['-m', 'ensurepip', '--default-pip'], { stdio: 'pipe' })
    execFileSync(py, ['-m', 'pip', 'install', '--quiet', 'pyarrow'], { stdio: 'pipe' })
    return { how: 'installed after ensurepip', env: {} }
  } catch { /* ensurepip absent too */ }

  const pipPy = pythonWithPip()
  if (!pipPy) throw new Error('no python on this image has pip, and ensurepip did not work')
  const tag = execFileSync(py,
    ['-c', 'import sys;print(f"{sys.version_info.major}.{sys.version_info.minor}")']).toString().trim()
  const target = join(repo, '.pyarrow')
  execFileSync(pipPy, ['-m', 'pip', 'install', '--quiet', '--target', target,
                       '--python-version', tag, '--only-binary=:all:', 'pyarrow'],
               { stdio: 'pipe' })
  execFileSync(py, ['-c', 'import pyarrow'], { stdio: 'ignore', env: { ...process.env, PYTHONPATH: target } })
  return { how: `installed for ${tag} using ${pipPy}'s pip`, env: { PYTHONPATH: target } }
}

mkdirSync(publicDir, { recursive: true })
rmSync(zipPath, { force: true })

const py = python()
let ok = false
try {
  if (!py) throw new Error('no python3 that can import sqlite3')
  say(`python   ${execFileSync(py, ['-c', 'import sys;print(sys.executable, sys.version.split()[0])']).toString().trim()}`)
  const { how, env } = ensurePyarrow(py)
  say(`pyarrow  ${how}`)
  execFileSync(py, [join(repo, 'tools', 'parquet_export.py'), '--out', outDir, '--zip', zipPath],
               { stdio: 'pipe', cwd: repo, env: { ...process.env, ...env } })
  say(`result   ok, ${(statSync(zipPath).size / 1048576).toFixed(1)} MB`)
  ok = true
} catch (error) {
  const detail = [error?.message, error?.stderr?.toString(), error?.stdout?.toString()]
    .filter(Boolean).join('\n').trim()
  say('result   FAILED')
  lines.push(detail || '(no detail)')
  console.warn('  the Parquet bundle could not be built; the site deploys without it')
  rmSync(zipPath, { force: true })
}
rmSync(outDir, { recursive: true, force: true })

// The heartbeat. Build logs are off for this project and a failed deploy
// leaves the previous one live, so every freshness signal the site had was
// a lagging one. This names the deploy commit, the database it carries and
// the round its data is complete through, on success as well as failure,
// at /build-status.txt.
function heartbeat() {
  const out = []
  const sha = process.env.WORKERS_CI_COMMIT_SHA || process.env.CF_PAGES_COMMIT_SHA
    || (() => { try { return execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repo }).toString().trim() } catch { return 'unknown' } })()
  out.push(`commit   ${sha}`)
  try {
    const { DatabaseSync } = await_import_sqlite()
    const db = new DatabaseSync(join(repo, 'f1.db'), { readOnly: true })
    const meta = Object.fromEntries(db.prepare('SELECT key, value FROM meta').all().map((r) => [r.key, r.value]))
    const last = db.prepare(`SELECT year, round, name_used FROM races WHERE status = 'completed'
                             ORDER BY year DESC, round DESC LIMIT 1`).get()
    db.close()
    out.push(`database v${meta.version}, built ${meta.built}`)
    if (last) out.push(`complete through ${last.year} round ${last.round}, ${last.name_used}`)
  } catch (error) {
    out.push(`database  could not be read: ${error?.message ?? error}`)
  }
  try {
    const head = execFileSync('sed', ['-n', '2p', join(repo, 'harvest', 'race_results.txt')]).toString().trim()
    const m = head.match(/F1DB (v\S+) \(([^)]+)\)/)
    if (m) out.push(`f1db     ${m[1]} ${m[2]}`)
  } catch { /* the harvest header is a nicety */ }
  return out
}

function await_import_sqlite() {
  // node:sqlite is what prepare-assets.js and the prerenderer already use.
  return process.getBuiltinModule('node:sqlite')
}

writeFileSync(join(publicDir, 'build-status.txt'),
              `lapledger build\nwhen     ${new Date().toISOString()}\n${heartbeat().join('\n')}\n\nparquet bundle\n${lines.join('\n')}\n`)
if (!ok) process.exitCode = 0   // never fail the build
