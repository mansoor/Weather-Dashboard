'use client'

import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { RefreshCw, Bell, Settings, MapPin, User, LogOut, Star, Share2, Shield } from 'lucide-react'
import type { WeatherReading, WeatherAlert, WeatherStats, GeoResult, ForecastData } from '@/types/weather'
import { api } from '@/lib/api'
import { useAuth } from '@/contexts/AuthContext'
import { useSettings } from '@/contexts/SettingsContext'
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
import ShareModal from '@/components/ShareModal'
import VerifyEmailModal from '@/components/VerifyEmailModal'
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

// IANA timezones where US customary units (mph, inches) are the norm.
const US_TIMEZONES = new Set([
  'America/New_York', 'America/Detroit', 'America/Chicago', 'America/Menominee',
  'America/Denver', 'America/Boise', 'America/Phoenix', 'America/Los_Angeles',
  'America/Anchorage', 'America/Juneau', 'America/Sitka', 'America/Metlakatla',
  'America/Yakutat', 'America/Nome', 'America/Adak', 'Pacific/Honolulu',
])
function isUsTimezone(tz: string | null | undefined): boolean {
  if (!tz) return false
  return US_TIMEZONES.has(tz) ||
    tz.startsWith('America/Indiana/') || tz.startsWith('America/Kentucky/') ||
    tz.startsWith('America/North_Dakota/')
}

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
  const { setAutoSystem } = useSettings()
  const clock = useHeaderClock()
  const initialLoadDone = useRef(false)

  const [current, setCurrent] = useState<WeatherReading | null>(null)
  const [alerts, setAlerts] = useState<WeatherAlert[]>([])
  // Guests can view alerts; dismissals persist only in their browser.
  const [guestDismissed, setGuestDismissed] = useState<number[]>([])
  const [stats, setStats] = useState<WeatherStats | null>(null)
  const [forecast, setForecast] = useState<ForecastData | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [loading, setLoading] = useState(true)
  const [fetching, setFetching] = useState(false)
  const [activeTab, setActiveTab] = useState<'dashboard' | 'alerts' | 'settings' | 'admin'>('dashboard')
  const [historyHours, setHistoryHours] = useState(24)
  const [error, setError] = useState<string | null>(null)
  const [showAuth, setShowAuth] = useState(false)
  const [showShare, setShowShare] = useState(false)
  const [showVerifyShare, setShowVerifyShare] = useState(false)
  const [sharePrompt, setSharePrompt] = useState<string | null>(null)
  const [shareRecipientKnown, setShareRecipientKnown] = useState(false)  // recipient already has an account
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login')
  const [activeLocation, setActiveLocation] = useState<ActiveLocation | null>(null)
  const [guestFavs, setGuestFavs] = useState<ReturnType<typeof loadGuestFavs>>([])
  const [guestFavVersion, setGuestFavVersion] = useState(0)

  useEffect(() => { setGuestFavs(loadGuestFavs()) }, [guestFavVersion])

  // Load guest alert dismissals from localStorage on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem('weather_dismissed_alerts')
      if (raw) setGuestDismissed(JSON.parse(raw))
    } catch { /* ignore */ }
  }, [])

  const persistGuestDismissed = (ids: number[]) => {
    setGuestDismissed(ids)
    try { localStorage.setItem('weather_dismissed_alerts', JSON.stringify(ids)) } catch { /* ignore */ }
  }
  const dismissGuestAlert = (id: number) => persistGuestDismissed(Array.from(new Set([...guestDismissed, id])))
  const dismissAllGuestAlerts = (ids: number[]) => persistGuestDismissed(Array.from(new Set([...guestDismissed, ...ids])))

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
    setLastUpdated(new Date())
  }, [activeLocation, loadDefaultData, loadLiveData])

  const loadForecast = useCallback(async () => {
    try {
      const d = await api.forecast.get(activeLocation?.latitude, activeLocation?.longitude)
      setForecast(d as ForecastData)
    } catch {
      setForecast(null)
    }
  }, [activeLocation?.latitude, activeLocation?.longitude])

  // Initial load: shared deep-link → geolocation → configured default
  useEffect(() => {
    if (authLoading || initialLoadDone.current) return
    initialLoadDone.current = true

    // Shared deep link: /?shared=1&lat=&lon=&name=
    if (typeof window !== 'undefined') {
      const p = new URLSearchParams(window.location.search)
      const lat = parseFloat(p.get('lat') || '')
      const lon = parseFloat(p.get('lon') || '')
      if (p.get('shared') && Number.isFinite(lat) && Number.isFinite(lon)) {
        const name = p.get('name') || 'Shared location'
        const loc: ActiveLocation = { name, latitude: lat, longitude: lon }
        setActiveLocation(loc)
        setLoading(true)
        loadLiveData(loc)
        setSharePrompt(name)
        setShareRecipientKnown(p.get('r') === '1')
        // Clean the URL so a refresh doesn't re-trigger the prompt.
        window.history.replaceState({}, '', window.location.pathname)
        return
      }
    }

    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const latitude = pos.coords.latitude
          const longitude = pos.coords.longitude
          // Resolve the actual city name instead of a generic "My Location".
          let name = 'My Location'
          try {
            const r = await api.geocoding.reverse(latitude, longitude) as { name?: string | null }
            if (r?.name) name = r.name
          } catch { /* keep fallback */ }
          const loc: ActiveLocation = { name, latitude, longitude }
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

  // Fetch forecast on location change and refresh it every 10 min
  useEffect(() => {
    loadForecast()
    const interval = setInterval(loadForecast, 600_000)
    return () => clearInterval(interval)
  }, [loadForecast])

  // Derive the location's default measurement system (US → imperial) for "Auto" mode.
  // Use the current reading's timezone first (loads with the main data), then forecast.
  useEffect(() => {
    const tz = current?.timezone ?? forecast?.timezone
    setAutoSystem(isUsTimezone(tz) ? 'imperial' : 'metric')
  }, [current?.timezone, forecast?.timezone, setAutoSystem])

  // Refresh immediately when the tab regains focus / becomes visible so the
  // data is never stale after the page has been in the background.
  useEffect(() => {
    if (authLoading) return
    const refresh = () => {
      if (document.visibilityState === 'visible') {
        loadData()
        loadForecast()
      }
    }
    document.addEventListener('visibilitychange', refresh)
    window.addEventListener('focus', refresh)
    return () => {
      document.removeEventListener('visibilitychange', refresh)
      window.removeEventListener('focus', refresh)
    }
  }, [authLoading, loadData, loadForecast])

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

  const unacknowledgedCount = user
    ? alerts.filter(a => !a.acknowledged).length
    : alerts.filter(a => !guestDismissed.includes(a.id)).length
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
      {showAuth && <AuthModal onClose={() => setShowAuth(false)} initialMode={authMode} />}
      {showShare && displayLocation && (
        <ShareModal location={displayLocation} onClose={() => setShowShare(false)} />
      )}
      {showVerifyShare && <VerifyEmailModal onClose={() => setShowVerifyShare(false)} />}
      <VerificationBanner />

      {/* Shared-link arrival prompt */}
      {sharePrompt && !user && (
        <div className="bg-sky-50 dark:bg-sky-950/40 border-b border-sky-200 dark:border-sky-900/60 px-4 py-2.5">
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-3 text-sm">
            <span className="text-sky-800 dark:text-sky-200">
              📍 Someone shared <strong>{sharePrompt}</strong> weather with you.{' '}
              {shareRecipientKnown
                ? 'Log in to save it and manage your weather alerts.'
                : 'Sign up to save it and get severe-weather alerts.'}
            </span>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => { setAuthMode(shareRecipientKnown ? 'login' : 'register'); setShowAuth(true) }}
                className="px-3 py-1 rounded-md bg-sky-600 hover:bg-sky-500 text-white text-xs font-medium"
              >
                {shareRecipientKnown ? 'Log in' : 'Sign up'}
              </button>
              <button onClick={() => setSharePrompt(null)} className="text-sky-700 dark:text-sky-300 hover:opacity-70 text-xs">
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="border-b border-slate-300 bg-white dark:border-slate-800/80 dark:bg-slate-900/80 dark:backdrop-blur-sm sticky top-0 z-10 shadow-sm dark:shadow-none">

        {/* ── Row 1: logo + location + save | search | clock + theme + user ── */}
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between gap-3">

          {/* Left: logo */}
          <div className="flex items-center gap-2 min-w-0 shrink-0">
            <span className="text-2xl shrink-0">🌤️</span>
            <span className="font-semibold text-slate-800 dark:text-slate-100 hidden sm:block shrink-0">Weather</span>
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

        {/* ── Row 3: location (left) | nav tabs (center) | unit toggle + fetch (right) ── */}
        <div className="max-w-7xl mx-auto px-4 pt-1 pb-2 border-t border-slate-200 dark:border-slate-800/60 flex items-center">
          {/* Left: current location — prominent */}
          <div className="flex-1 flex items-center min-w-0">
            {displayLocation && (
              <div className="flex items-center gap-1.5 min-w-0">
                <MapPin size={18} className="text-sky-500 shrink-0" />
                <span className="font-semibold text-base sm:text-lg text-slate-800 dark:text-slate-100 truncate max-w-[150px] sm:max-w-[220px]">
                  {displayLocation.name}
                </span>
                <button
                  onClick={toggleSave}
                  title={isSaved ? 'Remove from saved' : 'Save location'}
                  className={`p-1 rounded transition-colors shrink-0 ${
                    isSaved ? 'text-yellow-400 hover:text-yellow-500' : 'text-slate-400 hover:text-yellow-400'
                  }`}
                >
                  <Star size={16} fill={isSaved ? 'currentColor' : 'none'} />
                </button>
                {/* Share — registered users only (activity is logged & throttled server-side) */}
                {user && (
                  <button
                    onClick={() => user.email_verified_at ? setShowShare(true) : setShowVerifyShare(true)}
                    title="Share this location"
                    className="p-1 rounded text-slate-400 hover:text-sky-500 transition-colors shrink-0"
                  >
                    <Share2 size={15} />
                  </button>
                )}
                {activeLocation && (
                  <button onClick={handleReturnToDefault} className="text-xs text-sky-500 hover:underline shrink-0">
                    reset
                  </button>
                )}
              </div>
            )}
          </div>

          <nav className="flex items-center gap-1">
            {(['dashboard', 'alerts', 'settings', ...(user?.is_admin ? ['admin' as const] : [])] as const).map(tab => (
              <button
                key={tab}
                onClick={() => {
                  if (!user && tab === 'settings') { setShowAuth(true); return }
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
                {tab === 'admin' && <Shield size={13} className="inline mr-1" />}
                {tab}
              </button>
            ))}
          </nav>

          <div className="flex-1 flex items-center justify-end gap-2">
            {lastUpdated && (
              <span className="hidden md:flex items-center gap-1.5 text-xs text-slate-400 dark:text-slate-500 mr-1" title="Auto-refreshes every minute">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Updated {lastUpdated.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
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
                    {forecast && <HourlyForecast hourly={forecast.hourly} timezone={forecast.timezone} aqiScale={forecast.aqi_scale} />}
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
                          hourly={forecast.hourly}
                          currentTemp={current?.temperature}
                          aqiScale={forecast.aqi_scale}
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

            {activeTab === 'alerts' && (
              <AlertPanel
                alerts={alerts}
                onRefresh={loadData}
                guest={!user}
                dismissedIds={guestDismissed}
                onGuestDismiss={dismissGuestAlert}
                onGuestDismissAll={dismissAllGuestAlerts}
              />
            )}

            {activeTab === 'settings' && (
              <>
                <ThresholdsPanel
                  onUpdate={loadData}
                  locations={user ? locations : []}
                  defaultLocation={displayLocation}
                  aqiScale={forecast?.aqi_scale ?? 'eu'}
                />
                <AccountSettings />
              </>
            )}

            {activeTab === 'admin' && user?.is_admin && <AdminPanel />}
          </>
        )}
      </main>
    </div>
  )
}
