'use client'

import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import type { User, UserLocation, UserSettings } from '@/types/weather'
import { api } from '@/lib/api'

interface AuthState {
  user: User | null
  locations: UserLocation[]
  settings: UserSettings
  token: string | null
  loading: boolean
}

interface AuthContextValue extends AuthState {
  login: (email: string, password: string) => Promise<void>
  register: (name: string, email: string, password: string) => Promise<void>
  logout: () => void
  addLocation: (loc: { name: string; country?: string; latitude: number; longitude: number }) => Promise<UserLocation>
  removeLocation: (id: number) => Promise<void>
  setDefaultLocation: (id: number) => Promise<void>
  updateSettings: (s: Partial<UserSettings>) => Promise<void>
  refreshLocations: () => Promise<void>
  refreshUser: () => Promise<void>
  resendVerification: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    locations: [],
    settings: { temp_unit: 'C' },
    token: null,
    loading: true,
  })

  const applyAuthPayload = useCallback((payload: { user: User; token: string; settings: UserSettings; locations: UserLocation[] }) => {
    localStorage.setItem('auth_token', payload.token)
    setState(prev => ({
      ...prev,
      user: payload.user,
      token: payload.token,
      settings: payload.settings ?? { temp_unit: 'C' },
      locations: payload.locations ?? [],
      loading: false,
    }))
  }, [])

  // Restore session on mount
  useEffect(() => {
    const token = localStorage.getItem('auth_token')
    if (!token) { setState(prev => ({ ...prev, loading: false })); return }

    api.auth.me()
      .then((data: any) => applyAuthPayload({ ...data, token }))
      .catch(() => {
        localStorage.removeItem('auth_token')
        setState(prev => ({ ...prev, loading: false }))
      })
  }, [applyAuthPayload])

  // Handle 401 dispatched from api.ts
  useEffect(() => {
    const handler = () => setState(prev => ({ ...prev, user: null, token: null, locations: [], loading: false }))
    window.addEventListener('auth:logout', handler)
    return () => window.removeEventListener('auth:logout', handler)
  }, [])

  const login = async (email: string, password: string) => {
    const data: any = await api.auth.login({ email, password })
    applyAuthPayload(data)
  }

  const register = async (name: string, email: string, password: string) => {
    const data: any = await api.auth.register({ name, email, password, password_confirmation: password })
    applyAuthPayload(data)
  }

  const logout = useCallback(() => {
    api.auth.logout().catch(() => {})
    localStorage.removeItem('auth_token')
    setState(prev => ({ ...prev, user: null, token: null, locations: [], settings: { temp_unit: 'C' } }))
  }, [])

  const refreshLocations = useCallback(async () => {
    const locs: any = await api.user.getLocations()
    setState(prev => ({ ...prev, locations: locs }))
  }, [])

  const addLocation = useCallback(async (loc: { name: string; country?: string; latitude: number; longitude: number }) => {
    const created: any = await api.user.addLocation(loc)
    setState(prev => ({ ...prev, locations: [...prev.locations.filter(l => l.id !== created.id), created] }))
    return created
  }, [])

  const removeLocation = useCallback(async (id: number) => {
    await api.user.removeLocation(id)
    setState(prev => ({ ...prev, locations: prev.locations.filter(l => l.id !== id) }))
  }, [])

  const setDefaultLocation = useCallback(async (id: number) => {
    await api.user.setDefault(id)
    setState(prev => ({
      ...prev,
      locations: prev.locations.map(l => ({ ...l, is_default: l.id === id })),
    }))
  }, [])

  const updateSettings = useCallback(async (patch: Partial<UserSettings>) => {
    const updated: any = await api.user.updateSettings({ ...state.settings, ...patch })
    setState(prev => ({ ...prev, settings: updated }))
  }, [state.settings])

  const refreshUser = useCallback(async () => {
    const token = localStorage.getItem('auth_token')
    if (!token) return
    const data: any = await api.auth.me()
    setState(prev => ({ ...prev, user: data.user ?? prev.user }))
  }, [])

  const resendVerification = useCallback(async () => {
    await api.auth.resendVerification()
  }, [])

  return (
    <AuthContext.Provider value={{
      ...state,
      login, register, logout,
      addLocation, removeLocation, setDefaultLocation,
      updateSettings, refreshLocations,
      refreshUser, resendVerification,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be inside AuthProvider')
  return ctx
}
