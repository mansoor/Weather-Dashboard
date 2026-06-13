'use client'

import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { RefreshCw, Bell, Settings, MapPin, User, LogOut, Star } from 'lucide-react'
import type { WeatherReading, WeatherAlert, WeatherStats, GeoResult, ForecastData } from '@/types/weather'
import { api } from '@/lib/api'
import { useAuth } from '@/contexts/AuthContext'
import { loadGuestFavs, saveGuestFavs } from '@/components/FavoritesBar'
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
import ThemeToggle from '@/components/ThemeToggle'
import VerificationBanner from '@/components/VerificationBanner'
import AccountSettings from '@/components/AccountSettings'
import AdminPanel from '@/components/AdminPanel'
import HourlyForecast from '@/components/HourlyForecast'
import DailyForecast from '@/components/DailyForecast'
import SunriseSunset from '@/components/SunriseSunset'
import AIRecommendations from '@/components/AIRecommendations'

type ActiveLocation = { name: string; latitude: number; longitude: number; isDefault?: boolean }

function useHeaderClock() {
  const [display, setDisplay] = useState({ time: '', date: '' })
  useEffect(() => {
    const tick = () => {
      const now = new Date()
      setDisplay({
        time: now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        date: now.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }),
      })
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [])
  return display
}

export default function Dashboard() {
  const { user, locations, loading: authLoading, logout, addLocation, removeLocation } = useAuth()
  const clock = useHeaderClock()
  const initialLoadDone = useRef(false)

  const [current, setCurrent] = useState<WeatherReading | null>(null)
  const [alerts, setAlerts] = useState<WeatherAlert[]>([])
  const [stats, setStats] = useState<WeatherStats | null>(null)
  const [forecast, setForecast] = useState<ForecastData | null>(null)
  const [loading, setLoading] = useState(true)
  const [fetching, setFetching] = useState(false)
  const [activeTab, setActiveTab] = useState<'dashboard' | 'alerts' | 'settings'>('dashboard')
  const [historyHours, setHistoryHours] = useState(24)
  const [error, setError] = useState<string | null>(null)
  const [showAuth, setShowAuth] = useState(false)
  const [activeLocation, setActiveLocation] = useState<ActiveLocation | null>(null)
  const [guestFavs, setGuestFavs] = useState<ReturnType<typeof loadGuestFavs>>([])
  const [guestFavVersion, setGuestFavVersion] = useState(0)

  useEffect(() => { setGuestFavs(loadGuestFavs()) }, [guestFavVersion])

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
    } catch {
      setError('Could not reach the backend. Is it running?')
    } finally {
      setLoading(false)
    }
  }, [historyHours])

  const loadLiveData = useCallback(async (loc: ActiveLocation) => {
    try {
      setError(null)
      const [live, al, st] = await Promise.all([
        api.weather.live(loc.latitude, loc.longitude, loc.name) as Promise<WeatherReading>,
        api.alerts.list() as Promise<WeatherAlert[]>,
        api.weather.stats(historyHours, loc.latitude, loc.longitude) as Promise<WeatherStats>,
      ])
      setCurrent(live)
      setAlerts(al)
      setStats(st)
    } catch {
      setError('Could not fetch weather for this location.')
    } finally {
      setLoading(false)
    }
  }, [historyHours])

  const loadData = useCallback(async () => {
    if (activeLocation) await loadLiveData(activeLocation)
    else await loadDefaultData()
  }, [activeLocation, loadDefaultData, loadLiveData])

  // Initial load: try geolocation first, fall back to configured default
  useEffect(() => {
    if (authLoading || initialLoadDone.current) return
    initialLoadDone.current = true

    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const loc: ActiveLocation = {
            name: 'My Location',
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
          }
          setActiveLocation(loc)
          setLoading(true)
          loadLiveData(loc)
        },
        () => loadDefaultData(), // permission denied or error
        { timeout: 5000, maximumAge: 300_000 }
      )
    } else {
      loadDefaultData()
    }
  }, [authLoading, loadLiveData, loadDefaultData])

  // Auto-refresh every 60 s (runs regardless of how initial load happened)
  useEffect(() => {
    if (authLoading) return
    const interval = setInterval(loadData, 60_000)
    return () => clearInterval(interval)
  }, [loadData, authLoading])

  // Fetch forecast whenever active location changes
  useEffect(() => {
    const lat = activeLocation?.latitude
    const lon = activeLocation?.longitude
    api.forecast.get(lat, lon)
      .then(d => setForecast(d as ForecastData))
      .catch(() => setForecast(null))
  }, [activeLocation?.latitude, activeLocation?.longitude])

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

  // Fix #5: reset goes to user's default favorite, not hardcoded configured location
  const handleReturnToDefault = () => {
    const defaultFav = locations.find(l => l.is_default)
    if (defaultFav) {
      const loc: ActiveLocation = {
        name: defaultFav.name,
        latitude: defaultFav.latitude,
        longitude: defaultFav.longitude,
        isDefault: true,
      }
      setActiveLocation(loc)
      setLoading(true)
      loadLiveData(loc)
    } else {
      setActiveLocation(null)
      setLoading(true)
      loadDefaultData()
    }
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

  const isSaved = useMemo(() => {
    if (!displayLocation) return false
    if (user) return locations.some(l => Math.abs(l.latitude - displayLocation.latitude) < 0.01 && Math.abs(l.longitude - displayLocation.longitude) < 0.01)
    return guestFavs.some(f => Math.abs(f.latitude - displayLocation.latitude) < 0.01 && Math.abs(f.longitude - displayLocation.longitude) < 0.01)
  }, [displayLocation, user, locations, guestFavs])

  const toggleSave = async () => {
    if (!displayLocation) return
    if (user) {
      const existing = locations.find(l => Math.abs(l.latitude - displayLocation.latitude) < 0.01 && Math.abs(l.longitude - displayLocation.longitude) < 0.01)
      if (existing) await removeLocation(existing.id)
      else await addLocation({ name: displayLocation.name, latitude: displayLocation.latitude, longitude: displayLocation.longitude })
    } else {
      const favs = loadGuestFavs()
      const idx = favs.findIndex(f => Math.abs(f.latitude - displayLocation.latitude) < 0.01 && Math.abs(f.longitude - displayLocation.longitude) < 0.01)
      if (idx >= 0) favs.splice(idx, 1)
      else favs.push({ ...displayLocation, country: null })
      saveGuestFavs(favs)
      setGuestFavVersion(v => v + 1)
    }
  }

  return (
    <div className="min-h-screen bg-slate-200 dark:bg-gradient-to-br dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}
      <VerificationBanner />

      {/* Header */}
      <header className="border-b border-slate-300 bg-white dark:border-slate-800/80 dark:bg-slate-900/80 dark:backdrop-blur-sm sticky top-0 z-10 shadow-sm dark:shadow-none">

        {/* ── Row 1: logo + location + save | search | clock + theme + user ── */}
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between gap-3">

          {/* Left: logo, location name, save/reset */}
          <div className="flex items-center gap-2 min-w-0 shrink-0">
            <span className="text-2xl shrink-0">🌤️</span>
            <span className="font-semibold text-slate-800 dark:text-slate-100 hidden sm:block shrink-0">Weather</span>
            {displayLocation && (
              <>
                <div className="w-px h-4 bg-slate-200 dark:bg-slate-700 hidden sm:block" />
                <MapPin size={12} className="text-slate-500 dark:text-slate-400 shrink-0" />
                <span className="text-slate-600 dark:text-slate-300 text-sm truncate max-w-[140px]">
                  {displayLocation.name}
                </span>
                {/* Save / unsave current location */}
                <button
                  onClick={toggleSave}
                  title={isSaved ? 'Remove from saved' : 'Save location'}
                  className={`p-1 rounded transition-colors shrink-0 ${
                    isSaved
                      ? 'text-yellow-400 hover:text-yellow-500'
                      : 'text-slate-400 hover:text-yellow-400'
                  }`}
                >
                  <Star size={14} fill={isSaved ? 'currentColor' : 'none'} />
                </button>
                {activeLocation && (
                  <button onClick={handleReturnToDefault} className="text-xs text-sky-500 hover:underline shrink-0">
                    reset
                  </button>
                )}
              </>
            )}
          </div>

          {/* Center: location search */}
          <div className="flex-1 flex justify-center px-2 min-w-0">
            <LocationSearch onSelect={handleLocationSelect} />
          </div>

          {/* Right: clock + theme + user */}
          <div className="flex items-center gap-2 shrink-0">
            <ThemeToggle />

            <div className="hidden md:flex flex-col items-end leading-none px-1">
              <span className="text-base font-semibold tabular-nums text-slate-700 dark:text-slate-200 tracking-tight">
                {clock.time}
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {clock.date}
              </span>
            </div>

            {user ? (
              <div className="flex items-center gap-2 pl-2 border-l border-slate-200 dark:border-slate-700">
                <div className="hidden lg:flex flex-col items-end leading-none">
                  <span className="text-xs font-medium text-slate-700 dark:text-slate-300">{user.name}</span>
                  <span className="text-xs text-slate-400 mt-0.5">{user.email}</span>
                </div>
                <button onClick={logout} title="Sign out" className="p-1.5 rounded-md text-slate-400 hover:text-red-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                  <LogOut size={14} />
                </button>
              </div>
            ) : (
              <button onClick={() => setShowAuth(true)} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-sm text-slate-500 hover:text-slate-800 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-800 transition-colors">
                <User size={14} />
                <span className="hidden sm:inline">Sign in</span>
              </button>
            )}
          </div>
        </div>

        {/* ── Row 2: full-width scrollable saved locations ── */}
        <div className="max-w-7xl mx-auto px-4 py-2 border-t border-slate-200 dark:border-slate-800/60 min-h-[2.5rem] flex items-center">
          <FavoritesBar
            currentLocation={displayLocation}
            onSelect={handleLocationSelect}
            guestFavVersion={guestFavVersion}
          />
        </div>

        {/* ── Row 3: nav tabs (center) | unit toggle + fetch (right) ── */}
        <div className="max-w-7xl mx-auto px-4 pt-1 pb-2 border-t border-slate-200 dark:border-slate-800/60 flex items-center">
          {/* Left spacer = same width as right controls to keep tabs centered */}
          <div className="flex-1" />

          <nav className="flex items-center gap-1">
            {(['dashboard', 'alerts', 'settings'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => {
                  if (!user && tab !== 'dashboard') { setShowAuth(true); return }
                  setActiveTab(tab)
                }}
                className={`px-3 py-1.5 rounded-md text-sm capitalize transition-colors relative ${
                  activeTab === tab
                    ? 'bg-slate-200 text-slate-900 dark:bg-slate-700 dark:text-white'
                    : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-800'
                }`}
              >
                {tab === 'alerts' && unacknowledgedCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-xs flex items-center justify-center text-white font-bold">
                    {unacknowledgedCount > 9 ? '9+' : unacknowledgedCount}
                  </span>
                )}
                {tab === 'alerts' && <Bell size={13} className="inline mr-1" />}
                {tab === 'settings' && <Settings size={13} className="inline mr-1" />}
                {tab}
              </button>
            ))}
          </nav>

          <div className="flex-1 flex items-center justify-end gap-2">
            <UnitToggle />
            <button
              onClick={triggerFetch}
              disabled={fetching}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-sky-600 hover:bg-sky-500 disabled:opacity-50 rounded-md text-sm text-white transition-colors"
            >
              <RefreshCw size={13} className={fetching ? 'animate-spin' : ''} />
              <span className="hidden sm:inline">{fetching ? 'Fetching…' : 'Fetch'}</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 dark:bg-red-950/50 dark:border-red-800/50 dark:text-red-300 rounded-lg text-sm">{error}</div>
        )}

        {loading || authLoading ? (
          <div className="flex items-center justify-center h-64 text-slate-400 dark:text-slate-500">
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
                    <AIRecommendations reading={current} forecast={forecast} />
                    {forecast && <HourlyForecast hourly={forecast.hourly} timezone={forecast.timezone} />}
                    <MetricCards reading={current} />
                    <AirQuality reading={current} />
                    {forecast && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <SunriseSunset
                          sunrise={forecast.sunrise}
                          sunset={forecast.sunset}
                          moonrise={forecast.moonrise}
                          moonset={forecast.moonset}
                          moon_phase={forecast.moon_phase}
                          timezone={forecast.timezone}
                          dayHourly={forecast.day_hourly}
                          currentTemp={current?.temperature}
                        />
                        <DailyForecast daily={forecast.daily} />
                      </div>
                    )}
                    <div className="glass rounded-xl p-5">
                      <div className="flex items-center justify-between mb-4">
                        <h2 className="font-semibold text-slate-800 dark:text-slate-200">History</h2>
                        <div className="flex gap-2">
                          {[6, 24, 48, 168].map(h => (
                            <button key={h} onClick={() => setHistoryHours(h)}
                              className={`px-2 py-1 rounded text-xs transition-colors ${historyHours === h ? 'bg-sky-600 text-white' : 'bg-slate-100 text-slate-600 border border-slate-300 hover:bg-slate-200 dark:bg-slate-700 dark:border-transparent dark:text-slate-400 dark:hover:bg-slate-600'}`}>
                              {h < 48 ? `${h}h` : `${h / 24}d`}
                            </button>
                          ))}
                        </div>
                      </div>
                      <HistoryChart
                        hours={historyHours}
                        location={activeLocation ? { lat: activeLocation.latitude, lon: activeLocation.longitude } : undefined}
                      />
                    </div>
                  </>
                ) : (
                  <div className="text-center py-16 text-slate-400 dark:text-slate-500">
                    <p className="text-5xl mb-4">🌡️</p>
                    <p className="text-lg mb-2">No weather data yet</p>
                    <button onClick={triggerFetch} disabled={fetching}
                      className="px-4 py-2 bg-sky-600 hover:bg-sky-500 rounded-lg text-sm text-white disabled:opacity-50">
                      {fetching ? 'Fetching…' : 'Fetch Weather Data'}
                    </button>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'alerts' && <AlertPanel alerts={alerts} onRefresh={loadData} />}

            {activeTab === 'settings' && (
              <>
                <ThresholdsPanel
                  onUpdate={loadData}
                  locations={user ? locations : []}
                  defaultLocation={displayLocation}
                />
                <AccountSettings />
                {user?.is_admin && <AdminPanel />}
              </>
            )}
          </>
        )}
      </main>
    </div>
  )
}
