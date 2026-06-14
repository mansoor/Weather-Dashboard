'use client'

import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { useAuth } from './AuthContext'

type TempUnit = 'C' | 'F'
type UnitSystem = 'auto' | 'metric' | 'imperial'
type EffectiveSystem = 'metric' | 'imperial'

interface SettingsContextValue {
  // Temperature (independent C/F toggle)
  unit: TempUnit
  toggleUnit: () => void
  convertTemp: (celsius: number | null | undefined) => number | null
  convertToC: (displayValue: number) => number
  fmtTemp: (celsius: number | null | undefined, decimals?: number) => string
  unitLabel: string

  // Measurement system (wind & precipitation)
  unitSystem: UnitSystem               // user preference: auto / metric / imperial
  effectiveSystem: EffectiveSystem     // resolved system actually in use
  setUnitSystem: (s: UnitSystem) => void
  setAutoSystem: (s: EffectiveSystem) => void   // location-derived default (used when 'auto')

  convertWind: (kmh: number | null | undefined) => number | null
  windToBase: (displayValue: number) => number  // back to km/h
  windLabel: string
  fmtWind: (kmh: number | null | undefined, decimals?: number) => string

  convertPrecip: (mm: number | null | undefined) => number | null
  precipToBase: (displayValue: number) => number // back to mm
  precipLabel: string
  fmtPrecip: (mm: number | null | undefined, decimals?: number) => string
}

const SettingsContext = createContext<SettingsContextValue | null>(null)

const TEMP_KEY = 'weather_temp_unit'
const SYSTEM_KEY = 'weather_unit_system'

const KMH_PER_MPH = 1.609344
const MM_PER_IN = 25.4

function toF(c: number): number { return (c * 9) / 5 + 32 }

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const { user, settings, updateSettings } = useAuth()

  const [guestUnit, setGuestUnit] = useState<TempUnit>('C')
  const [guestSystem, setGuestSystem] = useState<UnitSystem>('auto')
  // Location-derived system (e.g. US → imperial). Defaults to metric until known.
  const [autoSystem, setAutoSystem] = useState<EffectiveSystem>('metric')

  // Load guest preferences from localStorage on mount
  useEffect(() => {
    const t = localStorage.getItem(TEMP_KEY)
    if (t === 'C' || t === 'F') setGuestUnit(t)
    const s = localStorage.getItem(SYSTEM_KEY)
    if (s === 'auto' || s === 'metric' || s === 'imperial') setGuestSystem(s)
  }, [])

  const unit: TempUnit = user ? (settings.temp_unit ?? 'C') : guestUnit
  const unitSystem: UnitSystem = user ? (settings.unit_system ?? 'auto') : guestSystem
  const effectiveSystem: EffectiveSystem = unitSystem === 'auto' ? autoSystem : unitSystem
  const imperial = effectiveSystem === 'imperial'

  const toggleUnit = useCallback(() => {
    const next: TempUnit = unit === 'C' ? 'F' : 'C'
    if (user) updateSettings({ temp_unit: next })
    else { localStorage.setItem(TEMP_KEY, next); setGuestUnit(next) }
  }, [unit, user, updateSettings])

  const setUnitSystem = useCallback((next: UnitSystem) => {
    if (user) updateSettings({ unit_system: next })
    else { localStorage.setItem(SYSTEM_KEY, next); setGuestSystem(next) }
  }, [user, updateSettings])

  // ── Temperature ──
  const convertTemp = useCallback((celsius: number | null | undefined): number | null => {
    if (celsius === null || celsius === undefined) return null
    const n = Number(celsius)
    if (!Number.isFinite(n)) return null
    return unit === 'F' ? toF(n) : n
  }, [unit])

  const convertToC = useCallback((displayValue: number): number =>
    unit === 'F' ? (displayValue - 32) * 5 / 9 : displayValue, [unit])

  const fmtTemp = useCallback((celsius: number | null | undefined, decimals = 1): string => {
    const v = convertTemp(celsius)
    return v === null ? '—' : `${v.toFixed(decimals)}${unit === 'F' ? '°F' : '°C'}`
  }, [convertTemp, unit])

  // ── Wind (base unit km/h) ──
  const convertWind = useCallback((kmh: number | null | undefined): number | null => {
    if (kmh === null || kmh === undefined) return null
    const n = Number(kmh)
    if (!Number.isFinite(n)) return null
    return imperial ? n / KMH_PER_MPH : n
  }, [imperial])

  const windToBase = useCallback((v: number): number => imperial ? v * KMH_PER_MPH : v, [imperial])

  const fmtWind = useCallback((kmh: number | null | undefined, decimals = 1): string => {
    const v = convertWind(kmh)
    return v === null ? '—' : `${v.toFixed(decimals)} ${imperial ? 'mph' : 'km/h'}`
  }, [convertWind, imperial])

  // ── Precipitation (base unit mm) ──
  const convertPrecip = useCallback((mm: number | null | undefined): number | null => {
    if (mm === null || mm === undefined) return null
    const n = Number(mm)
    if (!Number.isFinite(n)) return null
    return imperial ? n / MM_PER_IN : n
  }, [imperial])

  const precipToBase = useCallback((v: number): number => imperial ? v * MM_PER_IN : v, [imperial])

  const fmtPrecip = useCallback((mm: number | null | undefined, decimals?: number): string => {
    const v = convertPrecip(mm)
    if (v === null) return '—'
    const d = decimals ?? (imperial ? 2 : 1)
    return `${v.toFixed(d)} ${imperial ? 'in' : 'mm'}`
  }, [convertPrecip, imperial])

  return (
    <SettingsContext.Provider value={{
      unit, toggleUnit, convertTemp, convertToC, fmtTemp, unitLabel: unit === 'F' ? '°F' : '°C',
      unitSystem, effectiveSystem, setUnitSystem, setAutoSystem,
      convertWind, windToBase, windLabel: imperial ? 'mph' : 'km/h', fmtWind,
      convertPrecip, precipToBase, precipLabel: imperial ? 'in' : 'mm', fmtPrecip,
    }}>
      {children}
    </SettingsContext.Provider>
  )
}

export function useSettings() {
  const ctx = useContext(SettingsContext)
  if (!ctx) throw new Error('useSettings must be inside SettingsProvider')
  return ctx
}
