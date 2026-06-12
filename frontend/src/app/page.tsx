'use client'

import { useEffect, useState, useCallback } from 'react'
import { RefreshCw, Bell, Settings, MapPin, Clock, User, LogOut } from 'lucide-react'
import { format } from 'date-fns'
import type { WeatherReading, WeatherAlert, WeatherStats, GeoResult } from '@/types/weather'
import { api } from '@/lib/api'
import { useAuth } from '@/contexts/AuthContext'
import CurrentConditions from '@/components/CurrentConditions'
import MetricCards from '@/components/MetricCards'
import AirQuality from '@/components/AirQuality'
import HistoryChart from '@/components/HistoryChart'
import AlertPanel from '@/components/AlertPanel'
import ThresholdsPanel from '@/components/ThresholdsPanel'
import LocationSearch from '@/components/LocationSearch'
import FavoritesBar from '@/components/FavoritesBar'
import AuthModal from '@/components/AuthModal'
import UnitToggle from '@/components/UnitToggle'
import VerificationBanner from '@/components/VerificationBanner'

type ActiveLocation = { name: string; latitude: number; longitude: number; isDefault?: boolean }

export default function Dashboard() {
  const { user, loading: authLoading, logout } = useAuth()

  const [current, setCurrent] = useState<WeatherReading | null>(null)
  const [alerts, setAlerts] = useState<WeatherAlert[]>([])
  const [stats, setStats] = useState<WeatherStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [fetching, setFetching] = useState(false)
  const [activeTab, setActiveTab] = useState<'dashboard' | 'alerts' | 'settings'>('dashboard')
  const [historyHours, setHistoryHours] = useState(24)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showAuth, setShowAuth] = useState(false)
  // null = use default (scheduled) data; otherwise = live fetch for this location
  const [activeLocation, setActiveLocation] = useState<ActiveLocation | null>(null)

  const loadDefaultData = useCallback(async () => {
    try {
      setError(null)
      const [cur, al, st] = await Promise.all([
        api.weather.current() as Promise<WeatherReading>,
        api.alerts.list() as Promise<WeatherAlert[]>,
        api.weather.stats(historyHours) as Promise<WeatherStats>,
      ])
      setCurrent(cur)
      setAlerts(al)
      setStats(st)
      setLastUpdated(new Date())
    } catch {
      setError('Could not reach the backend. Is it running?')
    } finally {
      setLoading(false)
    }
  }, [historyHours])

  const loadLiveData = useCallback(async (loc: ActiveLocation) => {
    try {
      setError(null)
      const [live, al] = await Promise.all([
        api.weather.live(loc.latitude, loc.longitude, loc.name) as Promise<WeatherReading>,
        api.alerts.list() as Promise<WeatherAlert[]>,
      ])
      setCurrent(live)
      setAlerts(al)
      setStats(null) // no history for live locations
      setLastUpdated(new Date())
    } catch {
      setError('Could not fetch weather for this location.')
    } finally {
      setLoading(false)
    }
  }, [])

  const loadData = useCallback(async () => {
    if (activeLocation) await loadLiveData(activeLocation)
    else await loadDefaultData()
  }, [activeLocation, loadDefaultData, loadLiveData])

  useEffect(() => {
    if (authLoading) return
    loadData()
    const interval = setInterval(loadData, 60_000)
    return () => clearInterval(interval)
  }, [loadData, authLoading])

  const handleLocationSelect = (result: GeoResult | ActiveLocation) => {
    const loc: ActiveLocation = {
      name: result.name,
      latitude: result.latitude,
      longitude: result.longitude,
    }
    setActiveLocation(loc)
    setLoading(true)
    loadLiveData(loc)
  }

  const handleReturnToDefault = () => {
    setActiveLocation(null)
    setLoading(true)
    loadDefaultData()
  }

  const triggerFetch = async () => {
    setFetching(true)
    try {
      await api.weather.fetch()
      await new Promise(r => setTimeout(r, 3000))
      await loadData()
    } finally {
      setFetching(false)
    }
  }

  const unacknowledgedCount = alerts.filter(a => !a.acknowledged).length
  const displayLocation = current
    ? { name: current.location_name, latitude: current.latitude, longitude: current.longitude }
    : null

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}
      <VerificationBanner />

      {/* Header */}
      <header className="border-b border-slate-800/80 bg-slate-900/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <span className="text-2xl shrink-0">🌤️</span>
            <span className="font-semibold text-slate-100 shrink-0 hidden sm:block">Weather</span>
            {displayLocation && (
              <div className="flex items-center gap-1.5 min-w-0">
                <MapPin size={12} className="text-slate-400 shrink-0" />
                <span className="text-slate-300 text-sm truncate">{displayLocation.name}</span>
                {activeLocation && (
                  <button onClick={handleReturnToDefault} className="text-xs text-sky-400 hover:underline shrink-0 ml-1">
                    (reset)
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Centre: location search */}
          <div className="flex-1 flex justify-center px-2">
            <LocationSearch onSelect={handleLocationSelect} />
          </div>

          <nav className="flex items-center gap-1 shrink-0">
            {(['dashboard', 'alerts', 'settings'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-2.5 py-1.5 rounded-md text-sm capitalize transition-colors relative ${
                  activeTab === tab ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                }`}
              >
                {tab === 'alerts' && unacknowledgedCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-xs flex items-center justify-center text-white font-bold">
                    {unacknowledgedCount > 9 ? '9+' : unacknowledgedCount}
                  </span>
                )}
                {tab === 'alerts' ? <Bell size={14} className="inline mr-1" /> : tab === 'settings' ? <Settings size={14} className="inline mr-1" /> : null}
                <span className="hidden sm:inline">{tab}</span>
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-2 shrink-0">
            <UnitToggle />

            {lastUpdated && (
              <span className="text-slate-500 text-xs hidden md:flex items-center gap-1">
                <Clock size={11} />
                {format(lastUpdated, 'HH:mm:ss')}
              </span>
            )}

            {!activeLocation && (
              <button
                onClick={triggerFetch}
                disabled={fetching}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-sky-600 hover:bg-sky-500 disabled:opacity-50 rounded-md text-sm transition-colors"
              >
                <RefreshCw size={13} className={fetching ? 'animate-spin' : ''} />
                <span className="hidden sm:inline">{fetching ? 'Fetching…' : 'Fetch'}</span>
              </button>
            )}

            {user ? (
              <div className="flex items-center gap-2">
                <span className="text-slate-400 text-xs hidden lg:block">{user.name}</span>
                <button onClick={logout} title="Sign out" className="p-1.5 rounded-md text-slate-400 hover:text-red-400 hover:bg-slate-800 transition-colors">
                  <LogOut size={14} />
                </button>
              </div>
            ) : (
              <button onClick={() => setShowAuth(true)} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-sm text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors">
                <User size={14} />
                <span className="hidden sm:inline">Sign in</span>
              </button>
            )}
          </div>
        </div>

        {/* Favorites bar */}
        {(displayLocation || true) && (
          <div className="max-w-7xl mx-auto px-4 pb-2">
            <FavoritesBar currentLocation={displayLocation} onSelect={handleLocationSelect} />
          </div>
        )}
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        {error && (
          <div className="mb-6 p-4 bg-red-950/50 border border-red-800/50 rounded-lg text-red-300 text-sm">{error}</div>
        )}

        {loading || authLoading ? (
          <div className="flex items-center justify-center h-64 text-slate-400">
            <RefreshCw size={24} className="animate-spin mr-3" />
            Loading…
          </div>
        ) : (
          <>
            {activeTab === 'dashboard' && (
              <div className="space-y-6">
                {current ? (
                  <>
                    <CurrentConditions reading={current} stats={stats} />
                    <MetricCards reading={current} />
                    <AirQuality reading={current} />
                    {!activeLocation && (
                      <div className="glass rounded-xl p-5">
                        <div className="flex items-center justify-between mb-4">
                          <h2 className="font-semibold text-slate-200">History</h2>
                          <div className="flex gap-2">
                            {[6, 24, 48, 168].map(h => (
                              <button key={h} onClick={() => setHistoryHours(h)}
                                className={`px-2 py-1 rounded text-xs transition-colors ${historyHours === h ? 'bg-sky-600 text-white' : 'bg-slate-700 text-slate-400 hover:bg-slate-600'}`}>
                                {h < 48 ? `${h}h` : `${h / 24}d`}
                              </button>
                            ))}
                          </div>
                        </div>
                        <HistoryChart hours={historyHours} />
                      </div>
                    )}
                    {activeLocation && (
                      <div className="glass rounded-xl p-4 text-center text-slate-400 text-sm">
                        History is only available for the default configured location.{' '}
                        <button onClick={handleReturnToDefault} className="text-sky-400 hover:underline">Return to default</button>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-center py-16 text-slate-400">
                    <p className="text-5xl mb-4">🌡️</p>
                    <p className="text-lg mb-2">No weather data yet</p>
                    <button onClick={triggerFetch} disabled={fetching}
                      className="px-4 py-2 bg-sky-600 hover:bg-sky-500 rounded-lg text-sm disabled:opacity-50">
                      {fetching ? 'Fetching…' : 'Fetch Weather Data'}
                    </button>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'alerts' && <AlertPanel alerts={alerts} onRefresh={loadData} />}
            {activeTab === 'settings' && <ThresholdsPanel onUpdate={loadData} />}
          </>
        )}
      </main>
    </div>
  )
}
