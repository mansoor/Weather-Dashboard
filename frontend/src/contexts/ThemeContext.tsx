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

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY) as Theme | null
    setGuestTheme(stored === 'light' ? 'light' : 'dark')
    setMounted(true)
  }, [])

  const theme: Theme = user ? ((settings.theme as Theme) ?? 'dark') : guestTheme

  useEffect(() => {
    if (mounted) applyTheme(theme)
  }, [theme, mounted])

  const toggleTheme = useCallback(() => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark'
    if (user) {
      updateSettings({ theme: next })
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
