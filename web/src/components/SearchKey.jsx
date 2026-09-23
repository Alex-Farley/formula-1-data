/**
 * The key that opens search, named for the keyboard the reader has.
 *
 * Search used to open on a bare `/` as well as on Cmd/Ctrl+K. A single
 * character with no modifier and no way to turn it off fails WCAG 2.1.4
 * for anyone driving the page by speech, whose dictated words arrive as
 * keystrokes (AX-15). Cmd/Ctrl+K already did the same job, so `/` went, and
 * every place that told a reader to press it names this instead.
 *
 * `navigator.platform` is deprecated but still the one field every browser
 * fills; `userAgentData` is read first where it exists. A wrong guess costs
 * a label and nothing else: App.jsx accepts either modifier on any platform.
 * The glyph is hidden from a screen reader, which is told the key's name.
 */
const onApple = () => {
  try {
    const platform = navigator.userAgentData?.platform || navigator.platform || ''
    return /mac|iphone|ipad|ipod/i.test(platform)
  } catch {
    return false
  }
}

export default function SearchKey() {
  return (
    <kbd>
      {onApple() ? (
        <>
          <span aria-hidden="true">⌘</span>
          <span className="sr-only">Command </span>K
        </>
      ) : (
        'Ctrl K'
      )}
    </kbd>
  )
}
