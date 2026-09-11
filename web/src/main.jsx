import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import { currentProgress, onProgress } from './data/client.js'
import { setPending } from './data/pending.js'
import './styles/app.css'

/**
 * Hand over from the prerendered page to the app.
 *
 * scripts/prerender.js writes each route's facts into #prerendered as static
 * HTML, so the reader has the page before twenty megabytes of database has
 * arrived. This removes it the moment the app can answer for itself.
 *
 * On 'ready' and only on 'ready'. If the database cannot be fetched — offline,
 * a blocked request, a host that lost the file — the static page stays, and a
 * reader who would otherwise have got an error panel and nothing else still
 * has the facts they came for.
 *
 * Removing the static page collapses the document, so the browser clamped
 * the scroll to the top: a reader eleven seconds into a 7,000 px page was
 * thrown back to its start by an event they did not cause, and a keyboard
 * reader's focus went to <body>. The offset is read before the removal and
 * restored after the app has painted, and the new page's heading takes focus
 * so a screen reader learns the document changed.
 */
function handOver() {
  const stop = onProgress((state) => {
    if (state.phase !== 'ready') return
    const y = window.scrollY
    document.getElementById('prerendered')?.remove()
    stop()
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        window.scrollTo(0, y)
        document.querySelector('#root main h1')?.focus({ preventScroll: true })
      }),
    )
  })
}

/**
 * A click on the static page before the database is ready used to be a full
 * navigation, which abandoned the download in flight and started it again:
 * measured at 14.9 s to ready instead of 11.9 s, 4.7 MB pulled twice, and it
 * compounds with every further click. The reader had no way to know, because
 * the links look and behave like links.
 *
 * So a same-origin click becomes a route change: the URL updates, the router
 * hears the popstate and renders the asked-for page the moment the database
 * opens, and the boot strip says what is pending. The static page stays where
 * it is meanwhile. Modified clicks, new-tab links and downloads are left to
 * the browser.
 */
function holdLinks() {
  const pre = document.getElementById('prerendered')
  if (!pre) return
  pre.addEventListener(
    'click',
    (event) => {
      if (currentProgress().phase === 'ready') return
      if (event.defaultPrevented || event.button !== 0) return
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
      const anchor = event.target.closest('a[href]')
      if (!anchor || anchor.target === '_blank' || anchor.hasAttribute('download')) return
      const url = new URL(anchor.href, location.href)
      if (url.origin !== location.origin) return
      event.preventDefault()
      history.pushState({}, '', url.pathname + url.search + url.hash)
      dispatchEvent(new PopStateEvent('popstate'))
      setPending(anchor.textContent.trim() || url.pathname)
    },
    true,
  )
}

holdLinks()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

handOver()
