import { useEffect, useState } from 'react'

export type Theme = 'light' | 'dark'

const THEME_KEY = 'trucktap.theme'

function getInitialTheme(): Theme {
  try {
    const stored = window.localStorage.getItem(THEME_KEY)
    if (stored === 'light' || stored === 'dark') return stored
  } catch {
    // Fall back to the system preference.
  }

  return window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light'
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(getInitialTheme)

  useEffect(() => {
    const root = document.documentElement
    root.classList.toggle('dark', theme === 'dark')
    root.style.colorScheme = theme

    try {
      window.localStorage.setItem(THEME_KEY, theme)
    } catch {
      // Theme persistence is optional.
    }

    const themeColor = theme === 'dark' ? '#0b0f13' : '#f4f5f2'
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', themeColor)
  }, [theme])

  return {
    theme,
    toggleTheme: () =>
      setTheme((current) => (current === 'dark' ? 'light' : 'dark')),
  }
}
