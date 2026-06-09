const BASE = '/api'

async function get<T>(path: string, params?: Record<string, string | number>): Promise<T> {
  const url = new URL(`${BASE}${path}`, window.location.origin)
  if (params) {
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, String(v)))
  }
  const res = await fetch(url.toString())
  if (!res.ok) throw new Error(`API error ${res.status}`)
  return res.json()
}

async function post<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) throw new Error(`API error ${res.status}`)
  return res.json()
}

async function put<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`API error ${res.status}`)
  return res.json()
}

export const api = {
  weather: {
    current: () => get('/weather/current'),
    history: (hours = 24) => get('/weather/history', { hours }),
    stats: (hours = 24) => get('/weather/stats', { hours }),
    fetch: () => post('/weather/fetch'),
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
}
