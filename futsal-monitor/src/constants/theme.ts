export type Theme = 'light' | 'dark'

const THEME_KEY = 'futsal_theme'

export function getStoredTheme(): Theme {
  if (typeof localStorage === 'undefined') return 'light'
  return (localStorage.getItem(THEME_KEY) as Theme) || 'light'
}

export function setStoredTheme(t: Theme): void {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(THEME_KEY, t)
}

export function applyTheme(t: Theme): void {
  document.documentElement.classList.toggle('dark', t === 'dark')
}

export function toggleTheme(): Theme {
  const next = getStoredTheme() === 'light' ? 'dark' : 'light'
  setStoredTheme(next)
  applyTheme(next)
  return next
}
