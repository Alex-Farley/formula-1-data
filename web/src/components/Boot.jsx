import { useEffect, useState } from 'react'
import { onProgress, openDatabase } from '../data/client.js'
import { bytes as formatBytes } from '../lib/format.js'

/**
 * The wait, made legible.
 *
 * Twenty megabytes of database has to arrive before the first question can be
 * asked, and pretending otherwise with a spinner is how a reader decides the
 * site is broken. This says which of four things is happening, how far through
 * it is, and — on a second visit, when the bytes come out of IndexedDB — it
 * is gone before it can be read.
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

export default function Boot({ children }) {
  const [state, setState] = useState({ phase: 'idle' })

  useEffect(() => {
    const stop = onProgress(setState)
    openDatabase().catch(() => {})
    return stop
  }, [])

  if (state.phase === 'ready') return children

  if (state.phase === 'failed') {
    return (
      <div className="boot">
        <div className="boot-inner">
          <h1>{WORDS.failed}</h1>
          <div className="error" role="alert">
            <pre>{state.error}</pre>
          </div>
          <p className="small">
            The site serves <code>f1.db.gz</code>, <code>f1.db</code>, <code>sql-wasm.wasm</code>{' '}
            and <code>db-manifest.json</code> from the same directory as the page. If you are
            running this from a checkout, <code>npm run build</code> stages all four; opening{' '}
            <code>dist/index.html</code> straight off the filesystem will not work, because a{' '}
            <code>file://</code> page may not start a worker.
          </p>
        </div>
      </div>
    )
  }

  const determinate = state.phase === 'downloading' && state.total > 0
  const share = determinate ? Math.min(1, state.loaded / state.total) : 0

  return (
    <div className="boot">
      <div className="boot-inner">
        <h1>{WORDS[state.phase] ?? WORDS.idle}</h1>
        <p>
          Seventy-seven seasons are arriving as one database file. It downloads once, then it stays
          in your browser — later visits open straight away, and work offline.
        </p>
        <div className={`bar${determinate ? '' : ' indeterminate'}`} role="progressbar" aria-valuenow={determinate ? Math.round(share * 100) : undefined}>
          <i style={determinate ? { width: `${share * 100}%` } : undefined} />
        </div>
        <div className="boot-detail">
          <span>
            {determinate
              ? `${formatBytes(state.loaded)} of ${formatBytes(state.total)}`
              : state.phase === 'downloading' && state.loaded
                ? formatBytes(state.loaded)
                : ' '}
          </span>
          <span>{determinate ? `${Math.round(share * 100)}%` : ' '}</span>
        </div>
      </div>
    </div>
  )
}
