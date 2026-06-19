const BASE = '/api'

function getToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem('auth_token')
}

async function request<T>(method: string, path: string, body?: unknown, params?: Record<string, string | number>): Promise<T> {
  const url = new URL(`${BASE}${path}`, window.location.origin)
  if (params) Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, String(v)))

  // Accept JSON so Laravel returns 401/422 JSON (not HTML redirects) on auth/validation errors.
  const headers: Record<string, string> = { 'Content-Type': 'application/json', 'Accept': 'application/json' }
  const token = getToken()
  if (token) headers['Authorization'] = `Bearer ${token}`

  const res = await fetch(url.toString(), {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    // Weather data must always be fresh — never serve a stale cached response
    // (this is what caused the hourly forecast to show an old "Now" hour).
    cache: 'no-store',
  })

  if (res.status === 401) {
    localStorage.removeItem('auth_token')
    window.dispatchEvent(new Event('auth:logout'))
    throw new Error('Unauthenticated')
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw Object.assign(new Error(err.message || `HTTP ${res.status}`), { status: res.status, errors: err.errors })
  }

  return res.json()
}

const get = <T>(path: string, params?: Record<string, string | number>) => request<T>('GET', path, undefined, params)
const post = <T>(path: string, body?: unknown) => request<T>('POST', path, body)
const put = <T>(path: string, body: unknown) => request<T>('PUT', path, body)
const patch = <T>(path: string, body?: unknown) => request<T>('PATCH', path, body)
const del = <T>(path: string) => request<T>('DELETE', path)

export const api = {
  weather: {
    current: () => get('/weather/current'),
    fetch: () => post('/weather/fetch'),
    live: (lat: number, lon: number, name: string) =>
      get('/weather/live', { lat, lon, name }),
    history: (hours = 24, lat?: number, lon?: number) => {
      const params: Record<string, string | number> = { hours }
      if (lat !== undefined) params.lat = lat
      if (lon !== undefined) params.lon = lon
      return get('/weather/history', params)
    },
    stats: (hours = 24, lat?: number, lon?: number) => {
      const params: Record<string, string | number> = { hours }
      if (lat !== undefined) params.lat = lat
      if (lon !== undefined) params.lon = lon
      return get('/weather/stats', params)
    },
  },
  alerts: {
    list: () => get('/alerts'),
    acknowledge: (id: number) => post(`/alerts/${id}/acknowledge`),
    acknowledgeAll: () => post('/alerts/acknowledge-all'),
  },
  thresholds: {
    list: () => get('/thresholds'),
    update: (id: number, data: Partial<{ value: number; enabled: boolean; notify_email: boolean; severity: string; monitor_lat: number | null; monitor_lon: number | null; monitor_name: string | null }>) =>
      put(`/thresholds/${id}`, data),
  },
  forecast: {
    get: (lat?: number, lon?: number) => {
      const params: Record<string, string | number> = {}
      if (lat !== undefined) params.lat = lat
      if (lon !== undefined) params.lon = lon
      return get('/weather/forecast', params)
    },
  },
  geocoding: {
    search: (q: string) => get('/geocoding/search', { q }),
    reverse: (lat: number, lon: number) => get('/geocoding/reverse', { lat, lon }),
  },
  auth: {
    register: (data: { name: string; email: string; password: string; password_confirmation: string }) =>
      post('/auth/register', data),
    login: (data: { email: string; password: string }) => post('/auth/login', data),
    logout: () => post('/auth/logout'),
    me: () => get('/auth/me'),
    resendVerification: () => post('/auth/email/resend'),
    verifyEmail: (target: string) => get(target.startsWith('/api') ? target.slice(4) : target),
    forgotPassword: (email: string) => post('/auth/forgot-password', { email }),
    resetPassword: (data: { token: string; email: string; password: string; password_confirmation: string }) =>
      post('/auth/reset-password', data),
  },
  admin: {
    users: () => get('/admin/users'),
    updateUser: (id: number, data: Partial<{ name: string; email: string; password: string; role: 'user' | 'admin' | 'super_admin' }>) =>
      patch(`/admin/users/${id}`, data),
    sendReset: (id: number) => post(`/admin/users/${id}/send-reset`),
    getSettings: () => get('/admin/settings'),
    updateSettings: (data: Partial<{
      share_max_recipients: number; share_max_per_day: number; share_max_per_email_per_day: number
      verify_deadline_days: number; verify_reminder1_days: number; verify_reminder2_days: number; verify_reminder3_days: number
      mail_mailer: string; mail_host: string | null; mail_port: number | null; mail_username: string | null
      mail_password: string; mail_encryption: string; mail_from_address: string | null; mail_from_name: string | null
    }>) => patch('/admin/settings', data),
    testEmail: () => post('/admin/settings/test-email'),
  },
  share: {
    limits: () => get('/share/limits'),
    location: (data: { latitude: number; longitude: number; name: string; emails: string[] }) =>
      post('/share/location', data),
  },
  user: {
    getSettings: () => get('/user/settings'),
    updateSettings: (data: Partial<{ temp_unit: 'C' | 'F'; unit_system: 'auto' | 'metric' | 'imperial'; theme: 'dark' | 'light'; notification_urls: string | null }>) => put('/user/settings', data),
    changePassword: (data: { current_password: string; password: string; password_confirmation: string }) =>
      post('/user/password', data),
    getLocations: () => get('/user/locations'),
    addLocation: (data: { name: string; country?: string; latitude: number; longitude: number }) =>
      post('/user/locations', data),
    setDefault: (id: number) => patch(`/user/locations/${id}/default`),
    removeLocation: (id: number) => del(`/user/locations/${id}`),
  },
}
