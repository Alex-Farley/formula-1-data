import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import { onProgress } from './data/client.js'
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
 */
function handOver() {
  const stop = onProgress((state) => {
    if (state.phase !== 'ready') return
    document.getElementById('prerendered')?.remove()
    stop()
  })
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

handOver()
