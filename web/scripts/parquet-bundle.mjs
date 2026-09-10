#!/usr/bin/env node
/**
 * Build the Parquet bundle into public/, so the site serves it from its own
 * domain at /f1-parquet.zip.
 *
 * WHY IT LIVES HERE AND NOT IN tools/cloudflare-build.sh
 *     Because that script is not what Cloudflare runs. The build log says so:
 *
 *         Executing user build command: cd web && npm ci && npm run build
 *
 *     Three attempts at putting this step in that script produced nothing on
 *     the deployed site, for the simple reason that none of them ever
 *     executed. This chain - npm run build - demonstrably runs, because it is
 *     what puts f1.db.gz and db-manifest.json on the site.
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
function ensurePyarrow(py) {
  try {
    execFileSync(py, ['-c', 'import pyarrow'], { stdio: 'ignore' })
    return { how: 'already present', env: {} }
  } catch { /* not there yet */ }

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
writeFileSync(join(publicDir, 'build-status.txt'),
              `parquet bundle\nwhen     ${new Date().toISOString()}\n${lines.join('\n')}\n`)
if (!ok) process.exitCode = 0   // never fail the build
