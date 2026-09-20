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
 * put back as soon as there is a document tall enough to hold it, and the new
 * page's heading takes focus so a screen reader learns the document changed.
 *
 * App.jsx's ScrollToTop used to undo that restore on its own first render and
 * win the race on a long page, which is what IX-30 measured; it now leaves the
 * arrival alone, so this is the only thing that decides where the reader is
 * standing when the app takes over.
 */
function handOver() {
  const arrival = location.pathname
  const stop = onProgress((state) => {
    if (state.phase !== 'ready') return
    // Unless the reader has moved on. A click on the static page is held as a
    // route change (below), so by the time this runs the app may be about to
    // render a different page from the one that was scrolled: the offset
    // belongs to what they were reading, not to a stranger, and 1,500 px into
    // the circuit register is nowhere in particular on one circuit's page.
    const y = location.pathname === arrival ? window.scrollY : 0
    document.getElementById('prerendered')?.remove()
    stop()

    /*
     * Two frames was a guess at "once the app has painted", and it was wrong
     * on any machine slower than the one it was written on. Every data page
     * renders a skeleton while its query resolves, so two frames after the
     * removal the document can be a few hundred pixels tall -- scrollTo then
     * clamps the offset to 0 and the reader is returned to the top after all,
     * which is the defect this whole function exists to prevent, arriving by
     * a different route. CI read 0 where the laptop read 1,500.
     *
     * So: put the offset back as soon as there is a document that can hold it,
     * rather than counting frames. It gives up after a second, because a page
     * that has legitimately got shorter is not going to grow (the drivers page
     * shrinks fivefold, which is IX-19 and a different problem), and it gives
     * up the moment the reader scrolls for themselves -- being dragged back to
     * where you were a second ago is worse than the thing being fixed.
     */
    const land = (tries, left) => {
      if (left !== null && window.scrollY !== left) return
      window.scrollTo(0, y)
      const room = document.documentElement.scrollHeight - window.innerHeight
      if (tries > 0 && window.scrollY < y && room < y) {
        const at = window.scrollY
        requestAnimationFrame(() => land(tries - 1, at))
      }
    }

    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        land(60, null)
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
      // A fragment link into the page the reader is already on is not a
      // navigation to hold. The skip link is the first one this site has ever
      // had inside the static page, and held, it became a route change to
      // /circuits/monza#main: focus stayed on the link, the reader never
      // reached the content, and the boot strip promised to open "Skip to
      // content" when the database was ready. Let the browser do what it does
      // with a fragment.
      if (url.hash && url.pathname === location.pathname && url.search === location.search) return
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
