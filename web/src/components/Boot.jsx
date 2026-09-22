import { useEffect, useState } from 'react'
import { onProgress, openDatabase, retryOpen } from '../data/client.js'
import { onPending } from '../data/pending.js'
import { bytes as formatBytes } from '../lib/format.js'

/**
 * The wait, made legible.
 *
 * Twenty megabytes of database has to arrive before the first question can be
 * asked, and pretending otherwise with a spinner is how a reader decides the
 * site is broken. This says which of four things is happening, how far through
 * it is, and — on a second visit, when the bytes come out of IndexedDB — it
 * is gone before it can be read.
 *
 * Two shapes. On a prerendered route the static page is already on screen
 * and this stands in front of it as a strip pinned to the foot of the
 * viewport; the full panel used to render BELOW the static page, at
 * y = 1,391 on the homepage and y = 33,857 on /drivers, where four critics
 * measured it and no reader ever saw it. Where there is no static page, the
 * panel is the page.
 */
const WORDS = {
  idle: 'Starting up',
  checking: 'Checking for a newer build',
  downloading: 'Downloading the database',
  decompressing: 'Unpacking',
  starting: 'Starting SQLite',
  ready: 'Ready',
  failed: 'The database could not be opened',
}

/** Whether the prerendered page is in the document — decided once, at mount. */
const standingIn = () => typeof document !== 'undefined' && Boolean(document.getElementById('prerendered'))

/**
 * The console is the one route whose static page is not facts.
 *
 * Every other prerendered page is the answer the reader came for, written
 * from the last published build, so a failed open leaves them holding it.
 * /data/sql has nothing to hold: the page IS the app. Told that the figures
 * on this page are from the last published build, a reader on the console is
 * being reassured about figures that are not there — and the only prose
 * beside the strip is the page's own line about needing JavaScript, in a tab
 * where JavaScript is plainly running (CD-40). So the strip says what
 * actually follows from the database not opening.
 *
 * Read at render rather than at mount, because the route can change while the
 * database is still arriving.
 */
const CONSOLE = `${import.meta.env.BASE_URL.replace(/\/$/, '')}/data/sql`
const onConsole = () =>
  typeof location !== 'undefined' && location.pathname.replace(/\/$/, '') === CONSOLE

export default function Boot({ children }) {
  const [state, setState] = useState({ phase: 'idle' })
  const [pending, setPending] = useState(null)
  const [standing] = useState(standingIn)

  useEffect(() => {
    const stop = onProgress(setState)
    openDatabase().catch(() => {})
    return stop
  }, [])
  useEffect(() => onPending(setPending), [])

  if (state.phase === 'ready') return children

  const failed = state.phase === 'failed'
  const determinate = state.phase === 'downloading' && state.total > 0
  const share = determinate ? Math.min(1, state.loaded / state.total) : 0
  const progress = determinate
    ? `${formatBytes(state.loaded)} of ${formatBytes(state.total)}`
    : state.phase === 'downloading' && state.loaded
      ? formatBytes(state.loaded)
      : ''
  const phrase = failed ? WORDS.failed : WORDS[state.phase] ?? WORDS.idle
  const stranded = failed
    ? onConsole()
      ? '. The console runs on that file, so there is nothing here to query until it opens.'
      : '. The figures on this page are from the last published build.'
    : ''
  const retry = () => retryOpen().catch(() => {})

  // Named by the phase sentence, bounded, and read out as bytes rather than a
  // bare percentage: a progressbar whose value is "30" and whose name is
  // nothing is a number with no referent.
  const bar = (
    <div
      className={`bar${determinate ? '' : ' indeterminate'}`}
      role="progressbar"
      aria-labelledby="boot-phase"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={determinate ? Math.round(share * 100) : undefined}
      aria-valuetext={progress || phrase}
    >
      <i style={determinate ? { width: `${share * 100}%` } : undefined} />
    </div>
  )

  if (standing) {
    return (
      <div className="boot-strip">
        <div className="boot-strip-inner">
          {/* One live region, present from the first render, so the first
              phase is not missed; the byte count is deliberately outside it. */}
          <p id="boot-phase" className="boot-phase" role="status">
            {phrase}
            {pending && !failed ? ` — opening ${pending} when it is ready` : ''}
            {stranded}
          </p>
          {failed ? (
            <button type="button" className="button" onClick={retry}>
              Try again
            </button>
          ) : (
            <span className="boot-bytes">{progress}</span>
          )}
          {failed ? null : bar}
        </div>
      </div>
    )
  }

  if (failed) {
    return (
      <div className="boot">
        <div className="boot-inner">
          <h1 id="boot-phase">{WORDS.failed}</h1>
          {/* The reader first, the checkout second (CD-17). This panel used to
              answer "the database could not be opened" with a raw exception
              and a paragraph about `npm run build` and `file://` - an answer
              written for somebody holding the repository, shown to everybody
              who is not. Both are still here; which of them is the page and
              which is behind a disclosure has swapped, the way Quality.jsx
              already puts a reader's sentence over a maintainer's note. */}
          <p className="error" role="alert">
            The site’s data file did not load. Try again below — and if it keeps happening, it
            may be unavailable for the moment rather than anything being wrong at your end.
          </p>
          <p>
            <button type="button" className="button" onClick={retry}>
              Try again
            </button>
          </p>
          <details className="gap-note">
            <summary>Running this from a checkout?</summary>
            <pre>{state.error}</pre>
            <p>
              The site serves <code>f1.db.gz</code>, <code>f1.db</code>, <code>sql-wasm.wasm</code>{' '}
              and <code>db-manifest.json</code> from the same directory as the page.{' '}
              <code>npm run build</code> stages all four; opening <code>dist/index.html</code>{' '}
              straight off the filesystem will not work, because a <code>file://</code> page may
              not start a worker.
            </p>
          </details>
        </div>
      </div>
    )
  }

  return (
    <div className="boot">
      <div className="boot-inner">
        <h1 id="boot-phase">{phrase}</h1>
        <p className="sr-only" role="status">
          {phrase}
        </p>
        <p>
          Seventy-seven seasons are arriving as one database file. It downloads once, then it stays
          in your browser, and later visits open straight away.
        </p>
        {bar}
        <div className="boot-detail">
          <span>{progress || ' '}</span>
          <span>{determinate ? `${Math.round(share * 100)}%` : ' '}</span>
        </div>
      </div>
    </div>
  )
}
