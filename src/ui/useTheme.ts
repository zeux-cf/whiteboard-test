import { useSyncExternalStore } from 'react'

type Theme = 'light' | 'dark'
const changeEvent = 'whiteboard-theme-change'
const themeKey = 'whiteboard.theme'

function currentTheme(): Theme {
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'
}

function systemTheme(): Theme {
  return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function apply(theme: Theme) {
  document.documentElement.dataset.theme = theme
  window.dispatchEvent(new Event(changeEvent))
}

function readTheme(): Theme {
  try {
    const preference = localStorage.getItem(themeKey)
    if (preference === 'dark' || preference === 'light') return preference
  } catch {
    // The system theme still works when browser storage is disabled.
  }
  return systemTheme()
}

function subscribe(callback: () => void) {
  const media = matchMedia('(prefers-color-scheme: dark)')
  const sync = () => apply(readTheme())
  window.addEventListener(changeEvent, callback)
  window.addEventListener('storage', sync)
  media.addEventListener('change', sync)
  if (!document.documentElement.dataset.theme) sync()
  return () => {
    window.removeEventListener(changeEvent, callback)
    window.removeEventListener('storage', sync)
    media.removeEventListener('change', sync)
  }
}

const initialTheme = (): Theme => 'light'

export function useTheme() {
  const theme = useSyncExternalStore(subscribe, currentTheme, initialTheme)
  return {
    theme,
    toggleTheme() {
      const next = theme === 'light' ? 'dark' : 'light'
      try {
        localStorage.setItem(themeKey, next)
      } catch {
        // Apply the preference for the current visit.
      }
      apply(next)
    },
  }
}
