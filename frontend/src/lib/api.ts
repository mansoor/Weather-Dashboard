const BASE = '/api'

function getToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem('auth_token')
}

async function request<T>(method: string, path: string, body?: unknown, params?: Record<string, string | number>): Promise<T> {
  const url = new URL(`${BASE}${path}`, window.location.origin)
  if (params) Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, String(v)))

  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  const token = getToken()
  if (token) headers['Authorization'] = `Bearer ${token}`

  const res = await fetch(url.toString(), {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
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
    update: (id: number, data: Partial<{ value: number; enabled: boolean; notify_email: boolean; severity: string }>) =>
      put(`/thresholds/${id}`, data),
  },
  geocoding: {
    search: (q: string) => get('/geocoding/search', { q }),
  },
  auth: {
    register: (data: { name: string; email: string; password: string; password_confirmation: string }) =>
      post('/auth/register', data),
    login: (data: { email: string; password: string }) => post('/auth/login', data),
    logout: () => post('/auth/logout'),
    me: () => get('/auth/me'),
    resendVerification: () => post('/auth/email/resend'),
    verifyEmail: (target: string) => get(target.startsWith('/api') ? target.slice(4) : target),
  },
  user: {
    getSettings: () => get('/user/settings'),
    updateSettings: (data: Partial<{ temp_unit: 'C' | 'F'; theme: 'dark' | 'light'; notification_urls: string | null }>) => put('/user/settings', data),
    changePassword: (data: { current_password: string; password: string; password_confirmation: string }) =>
      post('/user/password', data),
    getLocations: () => get('/user/locations'),
    addLocation: (data: { name: string; country?: string; latitude: number; longitude: number }) =>
      post('/user/locations', data),
    setDefault: (id: number) => patch(`/user/locations/${id}/default`),
    removeLocation: (id: number) => del(`/user/locations/${id}`),
  },
}
