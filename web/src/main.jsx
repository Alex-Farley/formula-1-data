import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import { currentProgress, onProgress } from './data/client.js'
import { setPending } from './data/pending.js'
import { captureStaticTables, staticArrival } from './lib/handover.js'
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
  const stop = onProgress((state) => {
    if (state.phase !== 'ready') return
    // Unless the reader has moved on. A click on the static page is held as a
    // route change (below), so by the time this runs the app may be about to
    // render a different page from the one that was scrolled: the offset
    // belongs to what they were reading, not to a stranger, and 1,500 px into
    // the circuit register is nowhere in particular on one circuit's page.
    // staticArrival() is the route of the static page ACTUALLY on screen,
    // which a held click now replaces rather than leaves behind (IX-37).
    const y = location.pathname === staticArrival() ? window.scrollY : 0
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
     * that has legitimately got shorter is not going to grow. A register no
     * longer shrinks fivefold under the offset - DataTable opens on the rows
     * captureStaticTables() counted below (IX-19) - and it gives
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
 * The static page follows the address bar, for as long as it is the page.
 *
 * A click on the static page used to be a full navigation, which abandoned
 * the download in flight and started it again: measured at 14.9 s to ready
 * instead of 11.9 s, 4.7 MB pulled twice, and it compounds with every further
 * click. So the click was held as a route change instead — and the reader was
 * left looking at the page they had clicked away from until the database
 * opened. At 1.6 Mbps, /drivers clicked a second BEFORE this script runs is
 * 862 rows on screen at t = 5.6 s, straight from the prerendered page; the
 * same click a second after it changed the URL, left the homepage up, and
 * showed 150 rows at t ≈ 30 s. The site prerenders 2,385 pages and used to
 * switch them off at the moment they are worth most (IX-37).
 *
 * Neither cost is necessary. The click is still held, so the download is
 * never restarted — and the asked-for page's static half, 224 KB of HTML, is
 * fetched and put in place of the one on screen. The router renders the same
 * route for real when the database opens, out of the same download.
 *
 * Driven by popstate rather than by the click, so Back and Forward move the
 * static page too: the strip used to name a destination the reader had
 * already backed out of, over a title belonging to a third page (IX-21).
 *
 * Modified clicks, new-tab links and downloads are left to the browser.
 */
const staticPage = { route: location.pathname, work: Promise.resolve(true) }

/**
 * Put the prerendered half of `route` on screen in place of the one there.
 * Resolves false when it could not be had — an offline fetch, a route with no
 * prerendered page of its own, or an answer that arrived too late to be the
 * right one — and the caller then falls back to saying what is pending.
 *
 * The element is kept and its children replaced: holdLinks()'s listener is on
 * #prerendered itself, and replacing the node would take the links with it.
 */
async function fetchStatic(route) {
  const pre = document.getElementById('prerendered')
  if (!pre) return false
  const response = await fetch(route, { headers: { accept: 'text/html' } })
  if (!response.ok) return false
  const doc = new DOMParser().parseFromString(await response.text(), 'text/html')
  const next = doc.getElementById('prerendered')
  if (!next?.firstElementChild) return false
  // While this was in flight the database may have opened and taken the
  // static page away, or the reader may have asked for somewhere else. Either
  // way this answer is no longer the page to show.
  if (currentProgress().phase === 'ready' || !pre.isConnected) return false
  if (location.pathname !== route) return false
  pre.replaceChildren(...document.importNode(next, true).childNodes)
  // What the new page drew, so the app opens on at least those rows (IX-19),
  // and so handOver() knows which route the reader's offset belongs to.
  captureStaticTables()
  if (doc.title) document.title = doc.title
  // A page the reader has just asked for starts at its top, and its content
  // takes focus so a screen reader learns the document changed — the same
  // arrival handOver() gives the app's own page.
  window.scrollTo(0, 0)
  pre.querySelector('main')?.focus({ preventScroll: true })
  return true
}

/** One fetch per route, shared by the click that asked for it and by popstate. */
function showStatic(route) {
  if (staticPage.route !== route) {
    staticPage.route = route
    staticPage.work = fetchStatic(route).catch(() => false)
  }
  return staticPage.work
}

function holdLinks() {
  const pre = document.getElementById('prerendered')
  if (!pre) return

  addEventListener('popstate', () => {
    if (!document.getElementById('prerendered')) return
    const { phase } = currentProgress()
    if (phase === 'ready' || phase === 'failed') return
    // Whatever was pending was asked for at the address we have just left.
    setPending(null)
    showStatic(location.pathname)
  })

  pre.addEventListener(
    'click',
    (event) => {
      const { phase } = currentProgress()
      // Ready: the app is the page, and owns its own links.
      if (phase === 'ready') return
      // Failed: no router is coming to render the held route, so holding one
      // more click would leave the reader on a page the address bar does not
      // name — URL /records, heading Drivers, for good. The anchors are the
      // only navigation left, and the page at the other end is a whole answer.
      if (phase === 'failed') return
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
      const route = url.pathname
      history.pushState({}, '', route + url.search + url.hash)
      dispatchEvent(new PopStateEvent('popstate'))
      // Said at once, because fetching the page it names takes a moment on the
      // connection this exists for — and withdrawn once the reader is looking
      // at that page rather than waiting for it.
      const label = anchor.textContent.trim() || route
      setPending(label)
      showStatic(route).then((shown) => {
        if (shown && location.pathname === route) setPending(null)
      })
    },
    true,
  )
}

holdLinks()
// Before anything can remove the static page: how many rows each of its
// tables drew is what DataTable opens on, so the handover does not delete
// rows under a reader who has scrolled past them (IX-19).
captureStaticTables()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

handOver()
