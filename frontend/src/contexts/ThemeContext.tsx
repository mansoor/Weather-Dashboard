'use client'

import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { useAuth } from './AuthContext'

type Theme = 'dark' | 'light'

interface ThemeContextValue {
  theme: Theme
  toggleTheme: () => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

const STORAGE_KEY = 'weather_theme'

function applyTheme(theme: Theme) {
  if (theme === 'dark') {
    document.documentElement.classList.add('dark')
  } else {
    document.documentElement.classList.remove('dark')
  }
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { user, settings, updateSettings } = useAuth()
  const [guestTheme, setGuestTheme] = useState<Theme>('dark')
  const [mounted, setMounted] = useState(false)
  // Optimistic override so the toggle flips instantly, even before the settings
  // API round-trips (otherwise it can feel unresponsive on mobile).
  const [override, setOverride] = useState<Theme | null>(null)

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY) as Theme | null
    setGuestTheme(stored === 'light' ? 'light' : 'dark')
    setMounted(true)
  }, [])

  const serverTheme: Theme = user ? ((settings.theme as Theme) ?? 'dark') : guestTheme
  const theme: Theme = override ?? serverTheme

  // Once the source of truth catches up to the override, drop the override.
  useEffect(() => {
    if (override && serverTheme === override) setOverride(null)
  }, [override, serverTheme])

  useEffect(() => {
    if (mounted) applyTheme(theme)
  }, [theme, mounted])

  const toggleTheme = useCallback(() => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark'
    setOverride(next) // apply immediately
    if (user) {
      updateSettings({ theme: next }).catch(() => setOverride(null))
    } else {
      localStorage.setItem(STORAGE_KEY, next)
      setGuestTheme(next)
    }
  }, [theme, user, updateSettings])

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be inside ThemeProvider')
  return ctx
}
