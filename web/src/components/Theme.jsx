import { useEffect, useState } from 'react'

/**
 * Light, dark, or whatever the machine says.
 *
 * Three states rather than two: a reader who has set their system to dark
 * should get dark without touching anything, and a reader who wants this one
 * site the other way should be able to say so and have it stick. The stamp
 * goes on the root element, which is what the token file's [data-theme] rules
 * key off.
 */
// Renamed with the site. The old key is read once so a returning reader
// keeps the theme they chose, then dropped.
const KEY = 'lapledger-theme'
const LEGACY_KEY = 'f1-theme'
const NEXT = { system: 'light', light: 'dark', dark: 'system' }
const LABEL = { system: 'System theme', light: 'Light theme', dark: 'Dark theme' }
const GLYPH = { system: '◐', light: '☀', dark: '☾' }

function apply(choice) {
  const root = document.documentElement
  if (choice === 'system') root.removeAttribute('data-theme')
  else root.setAttribute('data-theme', choice)
}

export default function ThemeToggle() {
  const [choice, setChoice] = useState('system')

  useEffect(() => {
    let stored = null
    try {
      stored = localStorage.getItem(KEY) ?? localStorage.getItem(LEGACY_KEY)
    } catch {
      stored = null
    }
    const initial = stored === 'light' || stored === 'dark' ? stored : 'system'
    setChoice(initial)
    apply(initial)
  }, [])

  const cycle = () => {
    const next = NEXT[choice]
    setChoice(next)
    apply(next)
    try {
      localStorage.setItem(KEY, next)
    } catch {
      // A browser with site data blocked still gets the theme, just not next time.
    }
  }

  return (
    <button
      type="button"
      className="chip"
      onClick={cycle}
      title={LABEL[choice]}
      aria-label={`${LABEL[choice]} — click to change`}
      style={{ padding: '4px 9px', lineHeight: 1.4 }}
    >
      <span aria-hidden="true">{GLYPH[choice]}</span>
    </button>
  )
}
