// VD-96 comparison: which variant this frame shows, from its query string -
// ?font=source-serif|newsreader (none: the site as built), ?theme=light|dark,
// ?heads=mixed|caps. The page is a copy and its links lead nowhere, so they
// are made inert rather than left to open a missing file.
;(() => {
  const q = new URLSearchParams(location.search)
  const root = document.documentElement
  const font = q.get('font')
  if (font === 'source-serif' || font === 'newsreader') root.dataset.font = font
  root.dataset.theme = q.get('theme') === 'dark' ? 'dark' : 'light'
  root.dataset.heads = q.get('heads') === 'caps' ? 'caps' : 'mixed'
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href]')
    if (a && !a.closest('summary')) e.preventDefault()
  })
})()
