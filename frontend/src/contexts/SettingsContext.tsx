'use client'

import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { useAuth } from './AuthContext'

type TempUnit = 'C' | 'F'

interface SettingsContextValue {
  unit: TempUnit
  toggleUnit: () => void
  convertTemp: (celsius: number | null | undefined) => number | null
  fmtTemp: (celsius: number | null | undefined, decimals?: number) => string
  unitLabel: string
}

const SettingsContext = createContext<SettingsContextValue | null>(null)

const STORAGE_KEY = 'weather_temp_unit'

function toF(c: number): number { return (c * 9) / 5 + 32 }

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const { user, settings, updateSettings } = useAuth()

  const [guestUnit, setGuestUnit] = useState<TempUnit>('C')

  // Load guest preference from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === 'C' || stored === 'F') setGuestUnit(stored)
  }, [])

  // When user logs in, sync their stored preference into local state
  const unit: TempUnit = user ? (settings.temp_unit ?? 'C') : guestUnit

  const toggleUnit = useCallback(() => {
    const next: TempUnit = unit === 'C' ? 'F' : 'C'
    if (user) {
      updateSettings({ temp_unit: next })
    } else {
      localStorage.setItem(STORAGE_KEY, next)
      setGuestUnit(next)
    }
  }, [unit, user, updateSettings])

  const convertTemp = useCallback((celsius: number | null | undefined): number | null => {
    if (celsius === null || celsius === undefined) return null
    return unit === 'F' ? toF(celsius) : celsius
  }, [unit])

  const fmtTemp = useCallback((celsius: number | null | undefined, decimals = 1): string => {
    const v = convertTemp(celsius)
    return v === null ? '—' : `${v.toFixed(decimals)}${unit === 'F' ? '°F' : '°C'}`
  }, [convertTemp, unit])

  return (
    <SettingsContext.Provider value={{ unit, toggleUnit, convertTemp, fmtTemp, unitLabel: unit === 'F' ? '°F' : '°C' }}>
      {children}
    </SettingsContext.Provider>
  )
}

export function useSettings() {
  const ctx = useContext(SettingsContext)
  if (!ctx) throw new Error('useSettings must be inside SettingsProvider')
  return ctx
}
